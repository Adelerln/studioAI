function resolveEnv(name: string): string | null {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export const REFERRAL_REWARD_BONUS = 10;
export const STRIPE_REFERRAL_COUPON_ID = resolveEnv('STRIPE_REFERRAL_COUPON_ID');

