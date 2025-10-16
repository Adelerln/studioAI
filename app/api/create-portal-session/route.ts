import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { ensureSubscriptionRow, fetchSubscriptionForUser } from '@/services/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requirePublicUrl(): string {
  const value = process.env.NEXT_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null;
  if (!value) {
    throw new Error('NEXT_PUBLIC_URL is required to build redirect URLs.');
  }
  return value.replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
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
    const { data: subscription } = await fetchSubscriptionForUser(user.id);

    let customerId = subscription?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          supabase_user_id: user.id
        }
      });
      customerId = customer.id;
      await ensureSubscriptionRow(user.id, {
        stripe_customer_id: customerId
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${requirePublicUrl()}/dashboard`
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('[create-portal-session] error', error);
    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : error instanceof Error
        ? error.message
        : 'Unable to open the billing portal.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
