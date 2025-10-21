import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { fetchSubscriptionForUser, upsertSubscriptionForUser, resolveQuotaLimit } from '@/services/subscriptions';
import { STRIPE_PRO_PRICE_ID } from '@/constants/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requireProPriceId(): string {
  if (!STRIPE_PRO_PRICE_ID) {
    throw new Error('STRIPE_PRO_PRICE_ID is not configured.');
  }
  return STRIPE_PRO_PRICE_ID;
}

export async function POST(_request: NextRequest) {
  try {
    const proPriceId = requireProPriceId();
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError) {
      throw authError;
    }

    if (!user) {
      return NextResponse.json({ message: 'Authentification requise.' }, { status: 401 });
    }

    const { data: subscription, error: subscriptionError } = await fetchSubscriptionForUser(user.id);

    if (subscriptionError) {
      throw subscriptionError;
    }

    if (!subscription || !subscription.stripe_subscription_id) {
      return NextResponse.json(
        { message: 'Aucun abonnement actif trouvé. Souscrivez d’abord à une offre.' },
        { status: 400 }
      );
    }

    if (subscription.stripe_price_id === proPriceId) {
      return NextResponse.json({ message: 'Vous êtes déjà sur le plan Pro.' });
    }

    const stripe = getStripeClient();

    const stripeSubscription = (await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id,
      {
        expand: ['items.data.price']
      }
    )) as Stripe.Subscription;

    const subscriptionItem = stripeSubscription.items.data[0];

    if (!subscriptionItem) {
      throw new Error('Impossible de trouver le produit associé à votre abonnement Stripe.');
    }

    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [
        {
          id: subscriptionItem.id,
          price: proPriceId
        }
      ],
      proration_behavior: 'create_prorations'
    });

    const updatedSubscription = (await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    )) as Stripe.Subscription;

    await upsertSubscriptionForUser(user.id, {
      stripe_price_id: proPriceId,
      status: updatedSubscription.status,
      quota_limit: resolveQuotaLimit(proPriceId)
    });

    return NextResponse.json({ message: 'Votre abonnement est en cours de mise à niveau vers le plan Pro.' });
  } catch (error) {
    console.error('[subscriptions.upgrade] error', error);
    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : error instanceof Error
        ? error.message
        : 'Impossible de mettre à niveau votre abonnement.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
