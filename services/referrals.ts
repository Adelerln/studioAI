import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

function toCodeCandidate(userId: string, attempt: number): string {
  const base = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
  if (attempt === 0) {
    return base;
  }
  const random = randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `${base}${random}`;
}

function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === '42P01' || code === 'PGRST302';
}

async function ensureReferralCodeViaMetadata(
  userId: string,
  supabaseAdmin: SupabaseClient
): Promise<string> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const metadata = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
  let code =
    typeof metadata.referral_code === 'string' && metadata.referral_code.length > 0
      ? metadata.referral_code
      : null;

  if (!code) {
    code = toCodeCandidate(userId, 0);
    const updatedMetadata = {
      ...metadata,
      referral_code: code
    };
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: updatedMetadata
    });
  }

  return code;
}

export async function ensureReferralCodeForUser(userId: string): Promise<string> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: existing, error: fetchError } =
    await supabaseAdmin
      .from('referral_codes')
      .select('code')
      .eq('user_id', userId)
      .maybeSingle();

  if (fetchError) {
    if (isTableMissingError(fetchError)) {
      console.warn('[referrals] referral_codes table missing, using user metadata fallback.');
      return ensureReferralCodeViaMetadata(userId, supabaseAdmin);
    }
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
      if (isTableMissingError(error)) {
        console.warn('[referrals] referral_codes table missing during insert, using metadata fallback.');
        return ensureReferralCodeViaMetadata(userId, supabaseAdmin);
      }
      throw error;
    }
  }

  try {
    return await ensureReferralCodeViaMetadata(userId, supabaseAdmin);
  } catch (metadataError) {
    console.error('[referrals] Unable to generate referral code via metadata fallback', metadataError);
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
    if (isTableMissingError(error)) {
      console.warn('[referrals] referral_codes table missing during lookup, returning null.');
      return null;
    }
    throw error;
  }

  return data?.user_id ?? null;
}
