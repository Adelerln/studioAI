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
  return new Intl.NumberFormat('en-US', {
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
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', {
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

  const subject = 'Payment failure for your subscription';
  const fallbackAmount = formattedAmount ?? 'your latest payment';
  const guidance =
    failureMessage ??
    'Please check your payment details or try another card in the billing portal.';
  const text = [
    'Hello,',
    '',
    `We were unable to collect ${fallbackAmount} for your last payment.`,
    guidance,
    '',
    'You can update your payment details via the billing portal.',
    '',
    'Thank you,',
    'The Studio AI team'
  ].join('\n');

  const html = `<p>Hello,</p>
<p>We were unable to collect ${fallbackAmount} for your last payment.</p>
<p>${guidance}</p>
<p>You can update your payment details via the billing portal.</p>
<p>Thank you,<br/>The Studio AI team</p>`;

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

  const endDate = formatDate(subscription.ended_at ?? null);

  const subject = 'Confirmation of your subscription cancellation';
  const text = [
    'Hello,',
    '',
    'We confirm the cancellation of your Studio AI subscription.',
    endDate ? `Your access will end on ${endDate}.` : 'Your access has been stopped immediately.',
    '',
    'We are available if you have questions or wish to return.',
    '',
    'Thank you,',
    'The Studio AI team'
  ].join('\n');

  const html = `<p>Hello,</p>
<p>We confirm the cancellation of your Studio AI subscription.</p>
<p>${endDate ? `Your access will end on ${endDate}.` : 'Your access has been stopped immediately.'}</p>
<p>We are available if you have questions or would like to come back.</p>
<p>Thank you,<br/>The Studio AI team</p>`;

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
      const subject = 'Your Studio AI subscription summary';
      const amountText =
        amountPaid ??
        (invoice.total !== null && invoice.total !== undefined
          ? `${(invoice.total / 100).toFixed(2)} ${invoice.currency?.toUpperCase() ?? ''}`
          : 'Montant non disponible');

      const lines = [
        'Hello,',
        '',
        'Here is the summary for your Studio AI subscription renewal:',
        `• Plan: ${planDetails.label}`,
        `• Amount charged: ${amountText}`,
        periodStart && periodEnd ? `• Period: ${periodStart} to ${periodEnd}` : null,
        `• Available quota: ${quotaLimit} generations for this cycle`,
        '',
        'You can manage or upgrade your subscription from the dashboard.',
        '',
        'Thank you for your trust,',
        'The Studio AI team'
      ].filter(Boolean) as string[];

      const text = lines.join('\n');
      const html = `<p>Hello,</p>
<p>Here is the summary for your Studio AI subscription renewal:</p>
<ul>
  <li><strong>Plan:</strong> ${planDetails.label}</li>
  <li><strong>Amount charged:</strong> ${amountText}</li>
  ${
    periodStart && periodEnd
      ? `<li><strong>Period:</strong> ${periodStart} to ${periodEnd}</li>`
      : ''
  }
  <li><strong>Available quota:</strong> ${quotaLimit} generations for this cycle</li>
</ul>
<p>You can manage or upgrade your subscription from the dashboard.</p>
<p>Thank you for your trust,<br/>The Studio AI team</p>`;

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
