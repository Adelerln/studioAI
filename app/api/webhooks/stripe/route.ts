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
import { FREE_TIER_QUOTA } from '@/constants/subscriptions';

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
  const updates = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: subscription.status,
    current_period_start: toIso(subscription.current_period_start),
    current_period_end: toIso(subscription.current_period_end),
    quota_limit: resolveQuotaLimit(priceId)
  };

  if (shouldResetUsage(existingRecord?.current_period_start ?? null, subscription.current_period_start ?? 0)) {
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
      current_period_start: toIso(subscription.current_period_start),
      current_period_end: toIso(subscription.current_period_end),
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
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id ?? null;
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

  const subscriptionItem = invoice.lines.data[0];
  const period = subscriptionItem?.period;
  const priceId = subscriptionItem?.price?.id ?? null;

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
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
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
