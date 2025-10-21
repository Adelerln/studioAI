'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  receipt_url: string | null;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount / 100);
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function BillingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadPayments = async () => {
      setLoadingPayments(true);
      setError(null);
      try {
        const response = await fetch('/api/billing/history');
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? 'Impossible de récupérer votre historique de paiements.');
        }
        const payload = await response.json();
        setPayments(payload?.payments ?? []);
      } catch (err) {
        console.error('[billing] fetch error', err);
        setError(err instanceof Error ? err.message : 'Impossible de récupérer votre historique de paiements.');
      } finally {
        setLoadingPayments(false);
      }
    };

    loadPayments();
  }, [user]);

  if (loading || !user) {
    return (
      <section style={styles.page}>
        <div style={styles.card}>
          <p style={styles.muted}>Chargement de votre compte…</p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Historique des paiements</h1>
        <p style={styles.subtitle}>Consultez vos transactions récentes et téléchargez les reçus PDF.</p>

        {loadingPayments ? (
          <p style={styles.muted}>Chargement de votre historique…</p>
        ) : error ? (
          <p style={styles.error}>{error}</p>
        ) : payments.length === 0 ? (
          <p style={styles.muted}>Aucun paiement n’a encore été enregistré pour votre compte.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Montant</th>
                  <th style={styles.th}>Statut</th>
                  <th style={styles.th}>Facture PDF</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} style={styles.tr}>
                    <td style={styles.td}>{formatDate(payment.created)}</td>
                    <td style={styles.td}>{formatCurrency(payment.amount, payment.currency)}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.status, ...resolveStatusStyle(payment.status) }}>
                        {translateStatus(payment.status)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {payment.receipt_url ? (
                        <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                          Télécharger
                        </a>
                      ) : (
                        <span style={styles.muted}>Non disponible</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function translateStatus(status: string) {
  switch (status) {
    case 'succeeded':
      return 'Réussi';
    case 'processing':
      return 'En cours';
    case 'requires_payment_method':
      return 'Paiement requis';
    case 'requires_action':
      return 'Action requise';
    case 'canceled':
      return 'Annulé';
    default:
      return status;
  }
}

function resolveStatusStyle(status: string): CSSProperties {
  switch (status) {
    case 'succeeded':
      return { backgroundColor: 'rgba(34,197,94,0.12)', color: '#166534' };
    case 'processing':
      return { backgroundColor: 'rgba(59,130,246,0.12)', color: '#1d4ed8' };
    case 'requires_payment_method':
    case 'requires_action':
      return { backgroundColor: 'rgba(234,179,8,0.12)', color: '#854d0e' };
    case 'canceled':
      return { backgroundColor: 'rgba(248,113,113,0.12)', color: '#b91c1c' };
    default:
      return { backgroundColor: 'rgba(148,163,184,0.12)', color: '#475569' };
  }
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    padding: '48px 24px'
  },
  card: {
    width: 'min(860px, 100%)',
    backgroundColor: '#fff',
    borderRadius: '24px',
    boxShadow: '0 30px 60px -40px rgba(15,23,42,0.25)',
    padding: '36px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: 0,
    color: '#0f172a'
  },
  subtitle: {
    margin: 0,
    color: '#475569'
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '16px',
    border: '1px solid rgba(226,232,240,0.8)'
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0
  },
  th: {
    textAlign: 'left',
    padding: '16px',
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(226,232,240,0.8)'
  },
  tr: {
    borderBottom: '1px solid rgba(226,232,240,0.6)'
  },
  td: {
    padding: '16px',
    color: '#1f2937',
    borderBottom: '1px solid rgba(226,232,240,0.6)'
  },
  link: {
    color: '#2563eb',
    fontWeight: 600
  },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 12px',
    borderRadius: '999px',
    fontWeight: 600,
    fontSize: '0.85rem'
  },
  muted: {
    color: '#64748b',
    fontSize: '0.95rem'
  },
  error: {
    color: '#dc2626',
    fontWeight: 600
  }
};
