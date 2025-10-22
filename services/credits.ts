import { createSupabaseAdminClient } from '@/lib/supabase-admin';

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

interface CreditMetadata {
  credit_balance?: number;
  referral_credits?: number;
  [key: string]: unknown;
}

function normaliseMetadata(input: unknown): CreditMetadata {
  if (!input || typeof input !== 'object') {
    return {};
  }
  return input as CreditMetadata;
}

async function loadUserMetadata(
  admin: SupabaseAdminClient,
  userId: string
): Promise<{ metadata: CreditMetadata }> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    throw error;
  }
  const metadata = normaliseMetadata(data?.user?.user_metadata);
  return { metadata };
}

function resolveBalance(metadata: CreditMetadata): number {
  const balance = Number(metadata.credit_balance ?? 0);
  if (Number.isNaN(balance) || balance < 0) {
    return 0;
  }
  return balance;
}

async function persistBalance(
  admin: SupabaseAdminClient,
  userId: string,
  metadata: CreditMetadata,
  nextBalance: number
) {
  const cleanBalance = Math.max(0, Math.floor(nextBalance));
  const updated: CreditMetadata = {
    ...metadata,
    credit_balance: cleanBalance
  };

  if (updated.referral_credits !== undefined) {
    updated.referral_credits = 0;
  }

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: updated
  });
}

async function migrateReferralCredits(
  admin: SupabaseAdminClient,
  userId: string,
  metadata: CreditMetadata
): Promise<number> {
  const legacy = Number(metadata.referral_credits ?? 0);
  if (!legacy || Number.isNaN(legacy) || legacy <= 0) {
    return resolveBalance(metadata);
  }

  const nextBalance = resolveBalance(metadata) + legacy;
  await persistBalance(admin, userId, metadata, nextBalance);
  return nextBalance;
}

export async function getCreditBalance(userId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { metadata } = await loadUserMetadata(admin, userId);
  if (metadata.credit_balance === undefined && metadata.referral_credits) {
    return migrateReferralCredits(admin, userId, metadata);
  }
  return resolveBalance(metadata);
}

export async function addCredits(userId: string, amount: number): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Credit amount must be a positive number.');
  }

  const admin = createSupabaseAdminClient();
  const { metadata } = await loadUserMetadata(admin, userId);
  const current = metadata.credit_balance === undefined && metadata.referral_credits
    ? await migrateReferralCredits(admin, userId, metadata)
    : resolveBalance(metadata);
  const next = current + Math.floor(amount);
  await persistBalance(admin, userId, metadata, next);
  return next;
}

export async function consumeCredits(userId: string, amount: number): Promise<boolean> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }
  const admin = createSupabaseAdminClient();
  const { metadata } = await loadUserMetadata(admin, userId);
  const current = metadata.credit_balance === undefined && metadata.referral_credits
    ? await migrateReferralCredits(admin, userId, metadata)
    : resolveBalance(metadata);

  if (current < amount) {
    return false;
  }

  const next = current - Math.floor(amount);
  await persistBalance(admin, userId, metadata, next);
  return true;
}
