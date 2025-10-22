import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { resolveQuotaLimit, upsertSubscriptionForUser } from '@/services/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CheckoutSessionPayload {
  sessionId?: string;
}

function assertSessionId(sessionId: string | undefined): string {
  if (!sessionId) {
    throw new Error('A valid session identifier is required.');
  }
  return sessionId.trim();
}

function toIso(epochSeconds: number | null | undefined): string | null {
  if (!epochSeconds) {
    return null;
  }
  return new Date(epochSeconds * 1000).toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as CheckoutSessionPayload;
    const sessionId = assertSessionId(payload.sessionId);

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });

    const metadataUserId =
      (session.metadata?.supabase_user_id as string | undefined) ??
      (typeof session.subscription !== 'string'
        ? ((session.subscription?.metadata?.supabase_user_id as string | undefined) ?? undefined)
        : undefined);

    if (metadataUserId && metadataUserId !== user.id) {
      throw new Error('This session does not belong to your account.');
    }

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null;

    if (!subscriptionId) {
      throw new Error('Unable to resolve subscription from checkout session.');
    }

    const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
    type SubscriptionWithLegacyFields = Stripe.Subscription & {
      current_period_start?: number | null;
      current_period_end?: number | null;
    };
    const subscription = subscriptionResponse as SubscriptionWithLegacyFields;

    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    const priceId = subscription.items.data[0]?.price?.id ?? null;

    if (!priceId) {
      throw new Error('Subscription is missing price information.');
    }

    const quotaLimit = resolveQuotaLimit(priceId);
    const current_period_start = subscription.current_period_start ?? null;
    const current_period_end = subscription.current_period_end ?? null;

    await upsertSubscriptionForUser(
      user.id,
      {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        status: subscription.status,
        quota_limit: quotaLimit,
        quota_used: 0,
        current_period_start: toIso(current_period_start),
        current_period_end: toIso(current_period_end)
      },
      {
        createDefaults: {
          quota_limit: quotaLimit,
          quota_used: 0
        }
      }
    );

    return NextResponse.json({
      status: subscription.status,
      priceId,
      quota_limit: quotaLimit
    });
  } catch (error) {
    console.error('[checkout-session] finalise error', error);
    const message = error instanceof Error ? error.message : 'Unable to process checkout session.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
