import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { fetchSubscriptionForUser } from '@/services/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
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
    const { data: subscription, error: subscriptionError } = await fetchSubscriptionForUser(user.id);

    if (subscriptionError) {
      throw subscriptionError;
    }

    const customerId = subscription?.stripe_customer_id ?? null;

    if (!customerId) {
      return NextResponse.json({ payments: [] });
    }

    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 20,
      expand: ['data.latest_charge']
    });

    const payments = paymentIntents.data.map((intent) => {
      const latestCharge = intent.latest_charge;
      const receiptUrl =
        latestCharge && typeof latestCharge !== 'string' ? latestCharge.receipt_url ?? null : null;

      return {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        created: intent.created,
        receipt_url: receiptUrl
      };
    });

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('[billing-history] error', error);
    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : error instanceof Error
        ? error.message
        : 'Unable to retrieve payment history.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
