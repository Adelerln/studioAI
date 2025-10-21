import { randomUUID } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

function toCodeCandidate(userId: string, attempt: number): string {
  const base = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
  if (attempt === 0) {
    return base;
  }
  const random = randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `${base}${random}`;
}

export async function ensureReferralCodeForUser(userId: string): Promise<string> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('referral_codes')
    .select('code')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existing?.code) {
    return existing.code;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = toCodeCandidate(userId, attempt);
    const { data: inserted, error } = await supabaseAdmin
      .from('referral_codes')
      .insert({ user_id: userId, code })
      .select('code')
      .maybeSingle();

    if (!error && inserted?.code) {
      return inserted.code;
    }

    if (error && error.code !== '23505') {
      throw error;
    }
  }

  throw new Error('Unable to allocate referral code for user.');
}

export async function findReferrerByCode(code: string): Promise<string | null> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('referral_codes')
    .select('user_id')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.user_id ?? null;
}

