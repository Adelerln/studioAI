import React from 'react';
import { PLAN_DETAILS } from '@/constants/subscriptions';

interface SubscriptionStatusProps {
  status: string | null;
  priceId: string | null;
  quotaLimit: number;
  quotaUsed: number;
  loading?: boolean;
  error?: string | null;
  onManage?: () => void;
  manageDisabled?: boolean;
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function SubscriptionStatus({
  status,
  priceId,
  quotaLimit,
  quotaUsed,
  loading,
  error,
  onManage,
  manageDisabled
}: SubscriptionStatusProps) {
  const planKey = ACTIVE_STATUSES.has(status ?? '') && priceId ? priceId : 'free';
  const plan = PLAN_DETAILS[planKey] ?? PLAN_DETAILS.free;
  const remaining = Math.max(0, quotaLimit - quotaUsed);
  const usagePercent = quotaLimit > 0 ? Math.min(100, Math.round((quotaUsed / quotaLimit) * 100)) : 0;
  const isActive = ACTIVE_STATUSES.has(status ?? '');
  const badgeLabel = loading
    ? 'Loading…'
    : isActive
    ? status === 'trialing'
      ? 'Trial'
      : 'Active'
    : 'Free';

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={styles.title}>My subscription</h2>
        <span
          style={{
            ...styles.badge,
            backgroundColor: isActive ? '#dcfce7' : '#e0f2fe',
            color: isActive ? '#15803d' : '#0369a1'
          }}
        >
          {badgeLabel}
        </span>
      </div>

      {error ? (
        <p style={{ ...styles.text, color: '#b91c1c' }}>{error}</p>
      ) : loading ? (
        <p style={styles.text}>Loading your subscription…</p>
      ) : (
        <>
          <p style={styles.text}>
            {plan.label} · {plan.priceLabel}
          </p>
          <p style={styles.quota}>
            {planKey === 'free' ? 'Free plan' : `Plan ${plan.label}`} - {remaining}/{quotaLimit} generations left this
            month
          </p>
          <div style={styles.track}>
            <div
              style={{
                ...styles.progress,
                width: `${usagePercent}%`
              }}
            />
          </div>
        </>
      )}

      {isActive && onManage && (
        <button
          type="button"
          style={styles.manageButton}
          onClick={onManage}
          disabled={manageDisabled}
        >
          {manageDisabled ? 'Opening…' : 'Manage my subscription'}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: '20px',
    border: '1px solid rgba(148,163,184,0.3)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    backgroundColor: 'rgba(248,250,252,0.9)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  badge: {
    borderRadius: '999px',
    padding: '4px 12px',
    fontWeight: 600,
    fontSize: '0.8rem'
  },
  text: {
    margin: 0,
    color: '#475569',
    fontSize: '0.95rem'
  },
  quota: {
    margin: 0,
    color: '#0f172a',
    fontWeight: 600
  },
  track: {
    borderRadius: '999px',
    backgroundColor: 'rgba(226,232,240,0.8)',
    height: '8px',
    overflow: 'hidden',
    position: 'relative'
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)'
  },
  manageButton: {
    borderRadius: '999px',
    border: 'none',
    padding: '10px 18px',
    fontWeight: 600,
    background: 'linear-gradient(135deg, #22d3ee, #818cf8)',
    color: '#fff',
    alignSelf: 'flex-start',
    cursor: 'pointer'
  }
};
