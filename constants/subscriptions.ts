function resolvePublicEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export const STRIPE_BASIC_PRICE_ID = resolvePublicEnv(
  'NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID',
  'price_1SIwbtLRm8CqJ4igBs7NqkFw'
);
export const STRIPE_PRO_PRICE_ID = resolvePublicEnv(
  'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  'price_1SIwcALRm8CqJ4igmUICsEcB'
);

export const FREE_TIER_QUOTA = 5;

export const STRIPE_PLAN_QUOTAS: Record<string, number> = {
  [STRIPE_BASIC_PRICE_ID]: 50,
  [STRIPE_PRO_PRICE_ID]: 200
};

export const PLAN_DETAILS: Record<
  string,
  {
    label: string;
    priceLabel: string;
    description: string;
    quota: number;
  }
> = {
  free: {
    label: 'Free',
    priceLabel: 'Free',
    description: '5 generations per month to explore the studio.',
    quota: FREE_TIER_QUOTA
  },
  [STRIPE_BASIC_PRICE_ID]: {
    label: 'Basic',
    priceLabel: '€9 / month',
    description: '50 generations per month for your regular projects.',
    quota: STRIPE_PLAN_QUOTAS[STRIPE_BASIC_PRICE_ID]
  },
  [STRIPE_PRO_PRICE_ID]: {
    label: 'Pro',
    priceLabel: '€19 / month',
    description: '200 generations per month for heavy creators.',
    quota: STRIPE_PLAN_QUOTAS[STRIPE_PRO_PRICE_ID]
  }
};
