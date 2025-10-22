import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { isAdminUser } from '@/lib/admin';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHARGE_TYPES = new Set<Stripe.BalanceTransaction.Type>(['charge', 'payment']);
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function startOfCurrentMonth(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return Math.floor(start.getTime() / 1000);
}

async function fetchRevenueMetrics(stripe: Stripe) {
  const createdGte = startOfCurrentMonth();
  let startingAfter: string | undefined;
  let hasMore = true;

  let totalNet = 0;
  let paymentsCount = 0;
  let currency: string | null = null;

  while (hasMore) {
    const page = await stripe.balanceTransactions.list({
      limit: 100,
      created: { gte: createdGte },
      ...(startingAfter ? { starting_after: startingAfter } : {})
    });

    for (const transaction of page.data) {
      if (!CHARGE_TYPES.has(transaction.type)) {
        continue;
      }
      totalNet += transaction.net;
      paymentsCount += 1;
      if (!currency && transaction.currency) {
        currency = transaction.currency;
      }
    }

    hasMore = page.has_more;
    startingAfter = page.data.length > 0 ? page.data[page.data.length - 1]?.id : undefined;
    if (!hasMore || !startingAfter) {
      break;
    }
  }

  return { totalNet, paymentsCount, currency: currency ?? 'usd' };
}

async function fetchVisitorsMetrics(payersCount: number) {
  const supabaseAdmin = createSupabaseAdminClient();
  const tableName = process.env.ANALYTICS_VISITS_TABLE ?? 'analytics_visits';
  const start = new Date(startOfCurrentMonth() * 1000).toISOString();

  try {
    const query = supabaseAdmin
      .from(tableName)
      .select('id', { head: true, count: 'exact' })
      .gte('created_at', start);

    const { error, count } = await query;

    if (error) {
      throw error;
    }

    const visitorsCount = count ?? 0;
    const conversionRate =
      visitorsCount > 0 ? Number((payersCount / visitorsCount).toFixed(4)) : null;

    return { visitorsCount, conversionRate };
  } catch (error) {
    console.warn('[admin.analytics] Unable to retrieve visitors metrics', {
      tableName,
      error
    });
    return { visitorsCount: null, conversionRate: null };
  }
}

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

    if (!user || !isAdminUser(user)) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 403 });
    }

    const stripe = getStripeClient();
    const revenuePromise = fetchRevenueMetrics(stripe);

    const supabaseAdmin = createSupabaseAdminClient();
    const { count: activeSubCount, error: activeError } = await supabaseAdmin
      .from('subscriptions')
      .select('id', { head: true, count: 'exact' })
      .in('status', Array.from(ACTIVE_STATUSES));

    if (activeError) {
      throw activeError;
    }

    const activeSubscriptions = activeSubCount ?? 0;
    const [{ totalNet, paymentsCount, currency }, visitorsMetrics] = await Promise.all([
      revenuePromise,
      fetchVisitorsMetrics(activeSubscriptions)
    ]);

    return NextResponse.json({
      revenue: {
        amount: totalNet,
        currency
      },
      paymentsCount,
      activeSubscriptions,
      visitorsCount: visitorsMetrics.visitorsCount,
      conversionRate: visitorsMetrics.conversionRate
    });
  } catch (error) {
    console.error('[admin.analytics] handler error', error);
    return NextResponse.json(
      { message: 'Unable to retrieve analytics.' },
      { status: 500 }
    );
  }
}
