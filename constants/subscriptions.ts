function resolvePublicEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export const STRIPE_BASIC_PRICE_ID = resolvePublicEnv(
  'NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID',
  'price_1SIqRxLm8HeEccYQxPFjeTlh'
);
export const STRIPE_PRO_PRICE_ID = resolvePublicEnv(
  'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  'price_1SIqa1Lm8HeEccYQoSkKzdMk'
);

export const FREE_TIER_QUOTA = 10;

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
    label: 'Essentiel',
    priceLabel: 'Gratuit',
    description: '10 générations par mois pour découvrir le studio.',
    quota: FREE_TIER_QUOTA
  },
  [STRIPE_BASIC_PRICE_ID]: {
    label: 'Basic',
    priceLabel: '9€ / mois',
    description: '50 générations par mois pour vos projets réguliers.',
    quota: STRIPE_PLAN_QUOTAS[STRIPE_BASIC_PRICE_ID]
  },
  [STRIPE_PRO_PRICE_ID]: {
    label: 'Pro',
    priceLabel: '19€ / mois',
    description: '200 générations par mois pour les créateurs intensifs.',
    quota: STRIPE_PLAN_QUOTAS[STRIPE_PRO_PRICE_ID]
  }
};
