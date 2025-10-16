import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { ensureSubscriptionRow, fetchSubscriptionForUser } from '@/services/subscriptions';
import { STRIPE_BASIC_PRICE_ID, STRIPE_PRO_PRICE_ID } from '@/constants/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CheckoutPayload {
  priceId?: string;
}

function requirePublicUrl(): string {
  const value = process.env.NEXT_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null;
  if (!value) {
    throw new Error('NEXT_PUBLIC_URL is required to build redirect URLs.');
  }
  return value.replace(/\/$/, '');
}

const VALID_PRICE_IDS = new Set([STRIPE_BASIC_PRICE_ID, STRIPE_PRO_PRICE_ID].filter(Boolean));

function assertValidPriceId(priceId: string | undefined): string {
  if (!priceId) {
    throw new Error('A price identifier is required.');
  }
  const normalized = priceId.trim();
  if (!VALID_PRICE_IDS.has(normalized)) {
    console.error('[create-subscription-checkout] invalid price id', {
      received: normalized,
      valid: Array.from(VALID_PRICE_IDS)
    });
    throw new Error('Unknown price identifier.');
  }
  return normalized;
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

    const payload = (await request.json().catch(() => ({}))) as CheckoutPayload;
    console.info('[create-subscription-checkout] incoming payload', payload);
    console.info('[create-subscription-checkout] valid price ids', Array.from(VALID_PRICE_IDS));
    const priceId = assertValidPriceId(payload.priceId);
    console.info('[create-subscription-checkout] validated price id', priceId);
    const stripe = getStripeClient();
    console.info('[create-subscription-checkout] environment check', {
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.length),
      hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_KEY?.length),
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.length)
    });
    const { data: subscription, error: subscriptionError } = await fetchSubscriptionForUser(user.id);

    if (subscriptionError) {
      console.error('[create-subscription-checkout] supabase fetch error', {
        message: subscriptionError.message,
        details: subscriptionError.details,
        hint: subscriptionError.hint,
        code: subscriptionError.code
      });
      throw subscriptionError;
    }

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
        stripe_customer_id: customerId,
        status: subscription?.status ?? 'free',
        quota_used: subscription?.quota_used ?? 0
      });
    }

    const publicUrl = requirePublicUrl();
    const successUrl = new URL('/dashboard', publicUrl);
    successUrl.searchParams.set('checkout', 'success');
    successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
    const cancelUrl = `${publicUrl}/pricing`;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      success_url: successUrl.toString(),
      cancel_url: cancelUrl,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        supabase_user_id: user.id
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id
        }
      }
    });

    if (!checkoutSession.url) {
      throw new Error('Stripe did not return a redirect URL.');
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('[create-subscription-checkout] error', error);
    let message = 'Unable to create a subscription checkout session.';
    if (error instanceof Stripe.errors.StripeError) {
      message = error.message;
    } else if (error instanceof Error) {
      message = error.message;
    }

    return NextResponse.json(
      {
        message,
        debug:
          error && typeof error === 'object'
            ? { name: (error as { name?: string }).name, ...(error as { code?: string; hint?: string }) }
            : undefined
      },
      { status: 400 }
    );
  }
}
