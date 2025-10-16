import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import { FREE_TIER_QUOTA, STRIPE_PLAN_QUOTAS } from '@/constants/subscriptions';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  quota_limit: number | null;
  quota_used: number | null;
}

export async function fetchSubscriptionForUser(
  userId: string
): Promise<PostgrestSingleResponse<SubscriptionRecord | null>> {
  const supabaseAdmin = createSupabaseAdminClient();
  console.info('[subscriptions] fetchSubscriptionForUser', {
    userId,
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_KEY)
  });
  return supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
}

export async function ensureSubscriptionRow(
  userId: string,
  defaults?: Partial<Omit<SubscriptionRecord, 'id' | 'user_id'>>
): Promise<SubscriptionRecord | null> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    if (defaults && Object.keys(defaults).length > 0) {
      await supabaseAdmin
        .from('subscriptions')
        .update(defaults)
        .eq('id', existing.id);
      return { ...existing, ...defaults };
    }
    return existing;
  }

  const insertPayload = {
    user_id: userId,
    stripe_customer_id: defaults?.stripe_customer_id ?? null,
    stripe_subscription_id: defaults?.stripe_subscription_id ?? null,
    stripe_price_id: defaults?.stripe_price_id ?? null,
    status: defaults?.status ?? 'free',
    current_period_start: defaults?.current_period_start ?? null,
    current_period_end: defaults?.current_period_end ?? null,
    quota_limit: defaults?.quota_limit ?? FREE_TIER_QUOTA,
    quota_used: defaults?.quota_used ?? 0
  };

  const { data: inserted, error } = await supabaseAdmin
    .from('subscriptions')
    .insert(insertPayload)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return inserted;
}

export function resolveQuotaLimit(priceId: string | null | undefined): number {
  if (!priceId) {
    return FREE_TIER_QUOTA;
  }
  return STRIPE_PLAN_QUOTAS[priceId] ?? FREE_TIER_QUOTA;
}

export function hasActiveSubscription(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }
  return PAID_STATUSES.has(status);
}

export function shouldResetUsage(
  previousPeriodStart: string | null,
  nextPeriodStart: number
): boolean {
  if (!nextPeriodStart) {
    return false;
  }
  if (!previousPeriodStart) {
    return true;
  }
  const previousEpoch = Math.floor(new Date(previousPeriodStart).getTime() / 1000);
  return previousEpoch !== nextPeriodStart;
}

export async function upsertSubscriptionForUser(
  userId: string,
  updates: Partial<Omit<SubscriptionRecord, 'id' | 'user_id'>>,
  options?: { createDefaults?: Partial<Omit<SubscriptionRecord, 'id' | 'user_id'>> }
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from('subscriptions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
    return;
  }

  await supabaseAdmin
    .from('subscriptions')
    .insert({
      user_id: userId,
      quota_limit: FREE_TIER_QUOTA,
      quota_used: 0,
      status: 'free',
      ...options?.createDefaults,
      ...updates
    })
    .select()
    .maybeSingle();
}
