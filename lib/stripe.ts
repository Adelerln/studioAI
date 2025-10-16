import Stripe from 'stripe';
import {
  STRIPE_BASIC_PRICE_ID,
  STRIPE_PLAN_QUOTAS,
  STRIPE_PRO_PRICE_ID,
  FREE_TIER_QUOTA
} from '@/constants/subscriptions';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is missing.`);
  }
  return value;
}

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-06-20',
      appInfo: {
        name: 'Replicate Image Editor',
        url: 'https://replicate.com'
      }
    });
  }
  return stripeInstance;
}

export { STRIPE_BASIC_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_PLAN_QUOTAS, FREE_TIER_QUOTA };
