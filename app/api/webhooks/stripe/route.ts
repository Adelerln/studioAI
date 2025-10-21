import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import {
  ensureSubscriptionRow,
  resolveQuotaLimit,
  shouldResetUsage,
  upsertSubscriptionForUser
} from '@/services/subscriptions';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { FREE_TIER_QUOTA, PLAN_DETAILS } from '@/constants/subscriptions';
import { sendEmail } from '@/services/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requireWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set.');
  }
  return secret;
}

function toIso(epochSeconds: number | null | undefined): string | null {
  if (!epochSeconds) {
    return null;
  }
  return new Date(epochSeconds * 1000).toISOString();
}

function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (amount === null || amount === undefined || !currency) {
    return null;
  }
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(epochSeconds: number | null | undefined): string | null {
  if (!epochSeconds) {
    return null;
  }
  return new Date(epochSeconds * 1000).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function resolveUserContactByCustomerId(customerId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: subscriptionRecord, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (error) {
    console.error('[stripe.webhook] Unable to match customer to subscription', error);
    return null;
  }

  const userId = subscriptionRecord?.user_id ?? null;

  if (!userId) {
    return null;
  }

  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = data?.user?.email ?? null;
    return { userId, email };
  } catch (adminError) {
    console.error('[stripe.webhook] Unable to retrieve user for customer', adminError);
    return { userId, email: null };
  }
}

async function notifyPaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const customerId =
    typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : paymentIntent.customer?.id ?? null;

  if (!customerId) {
    console.warn('[stripe.webhook] payment_intent.payment_failed missing customer.');
    return;
  }

  const contact = await resolveUserContactByCustomerId(customerId);

  if (!contact?.email) {
    console.warn('[stripe.webhook] payment failure email skipped, user email unavailable.');
    return;
  }

  const formattedAmount = formatCurrency(paymentIntent.amount ?? null, paymentIntent.currency ?? null);
  const failureMessage = paymentIntent.last_payment_error?.message ?? null;

  const subject = 'Échec de paiement pour votre abonnement';
  const fallbackAmount = formattedAmount ?? 'votre dernier paiement';
  const guidance =
    failureMessage ??
    'Veuillez vérifier vos informations de paiement ou utiliser une autre carte dans le portail de facturation.';
  const text = [
    'Bonjour,',
    '',
    `Nous n’avons pas pu prélever ${fallbackAmount} pour votre dernier paiement.`,
    guidance,
    '',
    'Vous pouvez mettre à jour vos informations de paiement via le portail de facturation.',
    '',
    'Merci,',
    'L’équipe Studio AI'
  ].join('\n');

  const html = `<p>Bonjour,</p>
<p>Nous n’avons pas pu prélever ${fallbackAmount} pour votre dernier paiement.</p>
<p>${guidance}</p>
<p>Vous pouvez mettre à jour vos informations de paiement via le portail de facturation.</p>
<p>Merci,<br/>L’équipe Studio AI</p>`;

  try {
    await sendEmail({
      to: contact.email,
      subject,
      text,
      html,
      category: 'billing_payment_failed'
    });
  } catch (emailError) {
    console.error('[stripe.webhook] Unable to send payment failure email', emailError);
  }
}

async function notifySubscriptionCancellation(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null;

  if (!customerId) {
    console.warn('[stripe.webhook] subscription cancellation missing customer.');
    return;
  }

  const contact = await resolveUserContactByCustomerId(customerId);

  if (!contact?.email) {
    console.warn('[stripe.webhook] cancellation email skipped, user email unavailable.');
    return;
  }

  const endDate = formatDate(subscription.ended_at ?? subscription.current_period_end ?? null);

  const subject = 'Confirmation de résiliation de votre abonnement';
  const text = [
    'Bonjour,',
    '',
    'Nous confirmons la résiliation de votre abonnement Studio AI.',
    endDate ? `L’accès à votre offre se terminera le ${endDate}.` : 'L’accès à votre offre a été immédiatement interrompu.',
    '',
    'Nous restons à votre disposition si vous souhaitez revenir ou si vous avez des questions.',
    '',
    'Merci,',
    'L’équipe Studio AI'
  ].join('\n');

  const html = `<p>Bonjour,</p>
<p>Nous confirmons la résiliation de votre abonnement Studio AI.</p>
<p>${endDate ? `L’accès à votre offre se terminera le ${endDate}.` : 'L’accès à votre offre a été immédiatement interrompu.'}</p>
<p>Nous restons à votre disposition si vous avez des questions ou si vous souhaitez revenir.</p>
<p>Merci,<br/>L’équipe Studio AI</p>`;

  try {
    await sendEmail({
      to: contact.email,
      subject,
      text,
      html,
      category: 'billing_subscription_cancelled'
    });
  } catch (emailError) {
    console.error('[stripe.webhook] Unable to send cancellation email', emailError);
  }
}

type LegacySubscription = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const stripe = getStripeClient();
  const supabaseAdmin = createSupabaseAdminClient();

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null;

  if (!customerId) {
    console.warn('[stripe.webhook] Subscription event missing customer identifier.');
    return;
  }

  const { data: existingRecord } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  let userId =
    (subscription.metadata?.supabase_user_id as string | undefined) ??
    existingRecord?.user_id ??
    null;

  if (!userId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted) {
        userId = (customer.metadata?.supabase_user_id as string | undefined) ?? null;
      }
    } catch (customerError) {
      console.error('[stripe.webhook] Unable to retrieve customer metadata', customerError);
    }
  }

  if (!userId) {
    console.warn('[stripe.webhook] Unable to resolve user for subscription event.');
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const legacy = subscription as LegacySubscription;
  const currentPeriodStart = legacy.current_period_start ?? null;
  const currentPeriodEnd = legacy.current_period_end ?? null;

  const updates = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: subscription.status,
    current_period_start: toIso(currentPeriodStart),
    current_period_end: toIso(currentPeriodEnd),
    quota_limit: resolveQuotaLimit(priceId)
  };

  if (shouldResetUsage(existingRecord?.current_period_start ?? null, currentPeriodStart ?? 0)) {
    Object.assign(updates, { quota_used: 0 });
  }

  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    Object.assign(updates, {
      quota_limit: FREE_TIER_QUOTA,
      stripe_price_id: null,
      quota_used: 0
    });
  }

  await upsertSubscriptionForUser(userId, updates, {
    createDefaults: {
      status: subscription.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      current_period_start: toIso(currentPeriodStart),
      current_period_end: toIso(currentPeriodEnd),
      quota_limit: resolveQuotaLimit(priceId),
      quota_used: 0
    }
  });
}

async function handleCheckoutSession(session: Stripe.Checkout.Session) {
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null;
  const userId = (session.metadata?.supabase_user_id as string | undefined) ?? null;

  if (!customerId || !userId) {
    return;
  }

  await ensureSubscriptionRow(userId, {
    stripe_customer_id: customerId,
    status: 'pending',
    stripe_subscription_id:
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionDetails = invoice.parent?.subscription_details ?? null;
  const subscriptionId =
    typeof subscriptionDetails?.subscription === 'string'
      ? subscriptionDetails.subscription
      : subscriptionDetails?.subscription?.id ?? null;
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id ?? null;

  if (!subscriptionId || !customerId) {
    return;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (!existing?.user_id) {
    return;
  }

  const subscriptionItem = invoice.lines.data[0] ?? null;
  const period = subscriptionItem?.period ?? null;
  const priceId = subscriptionItem?.pricing?.price_details?.price ?? null;

  await upsertSubscriptionForUser(
    existing.user_id,
    {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      quota_used: 0,
      status: 'active',
      current_period_start: toIso(period?.start ?? null),
      current_period_end: toIso(period?.end ?? null),
      stripe_price_id: priceId ?? undefined,
      quota_limit: resolveQuotaLimit(priceId)
    },
    {
      createDefaults: {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: 'active',
        quota_used: 0,
        stripe_price_id: priceId,
        current_period_start: toIso(period?.start ?? null),
        current_period_end: toIso(period?.end ?? null),
        quota_limit: resolveQuotaLimit(priceId)
      }
    }
  );

  let userRecord: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.getUserById>>['data'] | null = null;
  try {
    const lookup = await supabaseAdmin.auth.admin.getUserById(existing.user_id);
    userRecord = lookup.data ?? null;
  } catch (metadataError) {
    console.error('[stripe.webhook] unable to retrieve user for invoice email', metadataError);
  }

  if (userRecord?.user) {
    const metadata = (userRecord.user.user_metadata ?? {}) as Record<string, unknown>;
    if (metadata.referral_coupon_id && !metadata.referral_coupon_redeemed) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(existing.user_id, {
          user_metadata: {
            ...metadata,
            referral_coupon_redeemed: true
          }
        });
      } catch (updateError) {
        console.error('[stripe.webhook] unable to mark referral coupon redeemed', updateError);
      }
    }

    const email = userRecord.user.email ?? null;
    if (email) {
      const amountPaid = formatCurrency(invoice.total ?? null, invoice.currency ?? null);
      const planKey =
        priceId && PLAN_DETAILS[priceId]
          ? priceId
          : 'free';
      const planDetails = PLAN_DETAILS[planKey] ?? PLAN_DETAILS.free;
      const periodStart = formatDate(period?.start ?? null);
      const periodEnd = formatDate(period?.end ?? null);
      const quotaLimit = resolveQuotaLimit(priceId);
      const subject = 'Votre récapitulatif d’abonnement Studio AI';
      const amountText =
        amountPaid ??
        (invoice.total !== null && invoice.total !== undefined
          ? `${(invoice.total / 100).toFixed(2)} ${invoice.currency?.toUpperCase() ?? ''}`
          : 'Montant non disponible');

      const lines = [
        'Bonjour,',
        '',
        'Voici le récapitulatif de votre renouvellement d’abonnement Studio AI :',
        `• Plan : ${planDetails.label}`,
        `• Montant facturé : ${amountText}`,
        periodStart && periodEnd ? `• Période : du ${periodStart} au ${periodEnd}` : null,
        `• Quota disponible : ${quotaLimit} générations pour ce cycle`,
        '',
        'Vous pouvez gérer votre abonnement et mettre à niveau votre offre depuis le tableau de bord.',
        '',
        'Merci pour votre confiance,',
        'L’équipe Studio AI'
      ].filter(Boolean) as string[];

      const text = lines.join('\n');
      const html = `<p>Bonjour,</p>
<p>Voici le récapitulatif de votre renouvellement d’abonnement Studio AI :</p>
<ul>
  <li><strong>Plan :</strong> ${planDetails.label}</li>
  <li><strong>Montant facturé :</strong> ${amountText}</li>
  ${
    periodStart && periodEnd
      ? `<li><strong>Période :</strong> du ${periodStart} au ${periodEnd}</li>`
      : ''
  }
  <li><strong>Quota disponible :</strong> ${quotaLimit} générations pour ce cycle</li>
</ul>
<p>Vous pouvez gérer votre abonnement et mettre à niveau votre offre depuis le tableau de bord.</p>
<p>Merci pour votre confiance,<br/>L’équipe Studio AI</p>`;

      try {
        await sendEmail({
          to: email,
          subject,
          text,
          html,
          category: 'billing_monthly_summary'
        });
      } catch (emailError) {
        console.error('[stripe.webhook] Unable to send monthly summary email', emailError);
      }
    }
  }
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ message: 'Missing Stripe signature header.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, requireWebhookSecret());
  } catch (error) {
    console.error('[stripe.webhook] signature verification failed', error);
    return NextResponse.json({ message: 'Invalid signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSession(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        if (event.type === 'customer.subscription.deleted') {
          await notifySubscriptionCancellation(event.data.object as Stripe.Subscription);
        }
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'payment_intent.payment_failed':
        await notifyPaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error('[stripe.webhook] handler error', error);
    return NextResponse.json({ message: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
