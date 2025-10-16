'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PricingCard } from '@/components/PricingCard';
import { STRIPE_BASIC_PRICE_ID, STRIPE_PRO_PRICE_ID, PLAN_DETAILS } from '@/constants/subscriptions';

const FEATURES = {
  [STRIPE_BASIC_PRICE_ID]: [
    '50 générations par mois',
    'Accès aux modèles standards',
    'Support email prioritaire sous 24h'
  ],
  [STRIPE_PRO_PRICE_ID]: [
    '200 générations par mois',
    'Accès aux modèles premium',
    'Support prioritaire & roadmap privée'
  ]
};

export default function PricingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plans = useMemo(
    () => [
      {
        id: STRIPE_BASIC_PRICE_ID,
        label: 'Basic',
        plan: PLAN_DETAILS[STRIPE_BASIC_PRICE_ID]
      },
      {
        id: STRIPE_PRO_PRICE_ID,
        label: 'Pro',
        plan: PLAN_DETAILS[STRIPE_PRO_PRICE_ID]
      }
    ],
    []
  );

  const handleSubscribe = useCallback(
    async (priceId: string) => {
      if (!user) {
        router.push('/login?redirect=/pricing');
        return;
      }

      setError(null);
      setPendingPlan(priceId);
      try {
        const response = await fetch('/api/create-subscription-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ priceId })
        });

        const payload = (await response.json().catch(() => ({}))) as { url?: string; message?: string };

        if (!response.ok) {
          throw new Error(payload?.message ?? 'Impossible de démarrer le paiement.');
        }

        if (!payload?.url) {
          throw new Error('Lien de redirection manquant.');
        }

        window.location.assign(payload.url);
      } catch (checkoutError) {
        console.error('[pricing] checkout error', checkoutError);
        setError(
          checkoutError instanceof Error
            ? checkoutError.message
            : 'Une erreur est survenue lors de la création de la session Stripe.'
        );
      } finally {
        setPendingPlan(null);
      }
    },
    [router, user]
  );

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <h1 style={styles.title}>Choisissez le plan qui correspond à votre studio</h1>
        <p style={styles.subtitle}>
          Passez à un plan supérieur pour augmenter votre quota de générations et accéder aux fonctionnalités
          avancées.
        </p>
        {!authLoading && !user && (
          <button type="button" style={styles.loginButton} onClick={() => router.push('/login?redirect=/pricing')}>
            Se connecter pour s’abonner
          </button>
        )}
        {error && <p style={styles.error}>{error}</p>}
      </section>

      <section style={styles.grid}>
        {plans.map(({ id, label, plan }) => (
          <PricingCard
            key={id}
            title={`Plan ${label}`}
            price={plan.priceLabel}
            description={plan.description}
            quota={plan.quota}
            features={FEATURES[id]}
            ctaLabel="S’abonner"
            onSubscribe={() => handleSubscribe(id)}
            loading={pendingPlan === id}
            disabled={authLoading}
          />
        ))}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '48px',
    padding: '60px clamp(16px, 6vw, 120px)'
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'center',
    maxWidth: '720px',
    margin: '0 auto'
  },
  title: {
    margin: 0,
    fontSize: '2.5rem',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.03em'
  },
  subtitle: {
    margin: 0,
    color: '#475569',
    fontSize: '1.05rem',
    lineHeight: 1.6
  },
  loginButton: {
    alignSelf: 'center',
    borderRadius: '999px',
    border: 'none',
    padding: '12px 24px',
    fontWeight: 600,
    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
    color: '#fff',
    cursor: 'pointer'
  },
  error: {
    margin: 0,
    color: '#dc2626',
    fontWeight: 600
  },
  grid: {
    display: 'grid',
    gap: '32px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
  }
};
