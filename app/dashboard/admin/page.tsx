'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { isAdminUser } from '@/lib/admin';

interface AnalyticsPayload {
  revenue: {
    amount: number;
    currency: string;
  };
  paymentsCount: number;
  activeSubscriptions: number;
  visitorsCount: number | null;
  conversionRate: number | null;
}

interface FetchState {
  loading: boolean;
  error: string | null;
  data: AnalyticsPayload | null;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount / 100);
}

function formatPercentage(value: number) {
  return `${(value * 100).toFixed(2)} %`;
}

export default function AdminDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<FetchState>({ loading: true, error: null, data: null });

  const isAdmin = useMemo(() => isAdminUser(user ?? null), [user]);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace('/dashboard');
    }
  }, [isAdmin, loading, router, user]);

  useEffect(() => {
    if (!user || !isAdmin) {
      return;
    }

    const controller = new AbortController();

    const loadAnalytics = async () => {
      setState({ loading: true, error: null, data: null });
      try {
        const response = await fetch('/api/admin/analytics', {
          method: 'GET',
          signal: controller.signal
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? 'Impossible de charger les analytics.');
        }
        const payload: AnalyticsPayload = await response.json();
        setState({ loading: false, error: null, data: payload });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('[admin.dashboard] analytics fetch error', error);
        setState({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Impossible de charger les analytics.',
          data: null
        });
      }
    };

    loadAnalytics();

    return () => {
      controller.abort();
    };
  }, [isAdmin, user]);

  if (loading || !user || !isAdmin) {
    return (
      <section style={styles.wrapper}>
        <div style={styles.card}>
          <p style={styles.muted}>Vérification des autorisations administrateur…</p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Analytics - Tableau de bord admin</h1>
            <p style={styles.subtitle}>
              Surveillez les performances financières et l’engagement des utilisateurs.
            </p>
          </div>
        </div>

        {state.loading ? (
          <p style={styles.muted}>Chargement des analytics…</p>
        ) : state.error ? (
          <p style={styles.error}>{state.error}</p>
        ) : state.data ? (
          <div style={styles.grid}>
            <MetricCard
              label="Revenu total (mois en cours)"
              value={formatCurrency(
                state.data.revenue.amount,
                state.data.revenue.currency
              )}
            />
            <MetricCard label="Nombre de paiements" value={state.data.paymentsCount.toString()} />
            <MetricCard
              label="Abonnements actifs"
              value={state.data.activeSubscriptions.toString()}
            />
            <MetricCard
              label="Taux de conversion"
              value={
                state.data.conversionRate !== null
                  ? formatPercentage(state.data.conversionRate)
                  : 'N/A'
              }
              helper={
                state.data.visitorsCount === null
                  ? 'Aucune donnée de visiteurs disponible.'
                  : `Visiteurs : ${state.data.visitorsCount}`
              }
            />
          </div>
        ) : (
          <p style={styles.muted}>Aucune donnée disponible.</p>
        )}
      </div>
    </section>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div style={styles.metricCard}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={styles.metricValue}>{value}</p>
      {helper ? <p style={styles.metricHelper}>{helper}</p> : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    padding: '48px 24px'
  },
  card: {
    width: 'min(1040px, 100%)',
    backgroundColor: '#fff',
    borderRadius: '24px',
    boxShadow: '0 30px 60px -45px rgba(15,23,42,0.28)',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px'
  },
  title: {
    margin: 0,
    fontSize: '2.1rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#475569'
  },
  muted: {
    color: '#64748b'
  },
  error: {
    color: '#b91c1c',
    fontWeight: 600
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '18px'
  },
  metricCard: {
    padding: '20px 22px',
    borderRadius: '18px',
    border: '1px solid rgba(226,232,240,0.9)',
    background: 'linear-gradient(135deg, rgba(248,250,252,0.95), rgba(241,245,249,0.95))',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  metricLabel: {
    margin: 0,
    color: '#475569',
    fontSize: '0.9rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  metricValue: {
    margin: 0,
    fontSize: '1.8rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  metricHelper: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.9rem'
  }
};
