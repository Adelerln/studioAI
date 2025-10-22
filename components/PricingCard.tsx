import React from 'react';

interface PricingCardProps {
  title: string;
  price: string;
  description: string;
  quota: number;
  features: string[];
  ctaLabel: string;
  onSubscribe: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function PricingCard({
  title,
  price,
  description,
  quota,
  features,
  ctaLabel,
  onSubscribe,
  disabled,
  loading
}: PricingCardProps) {
  return (
    <article style={styles.card}>
      <header style={styles.header}>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.price}>{price}</p>
        <p style={styles.description}>{description}</p>
      </header>

      <p style={styles.quota}>
        {quota} generations / month
      </p>

      <ul style={styles.featureList}>
        {features.map((feature) => (
          <li key={feature} style={styles.featureItem}>
            <span style={styles.featureBullet} aria-hidden>
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        style={{
          ...styles.button,
          ...(disabled ? styles.buttonDisabled : {})
        }}
        onClick={onSubscribe}
        disabled={disabled || loading}
      >
        {loading ? 'Redirecting…' : ctaLabel}
      </button>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    padding: '28px',
    background: 'rgba(255,255,255,0.95)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    boxShadow: '0 35px 80px -50px rgba(15, 23, 42, 0.55)'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  title: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  price: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 600,
    color: '#4338ca'
  },
  description: {
    margin: 0,
    color: '#475569',
    fontSize: '0.95rem',
    lineHeight: 1.6
  },
  quota: {
    margin: 0,
    fontWeight: 600,
    color: '#0f172a'
  },
  featureList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#1f2937',
    fontSize: '0.95rem'
  },
  featureBullet: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '0.75rem'
  },
  button: {
    marginTop: 'auto',
    borderRadius: '999px',
    border: 'none',
    padding: '14px 18px',
    fontWeight: 600,
    fontSize: '1rem',
    color: '#fff',
    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
    cursor: 'pointer'
  },
  buttonDisabled: {
    cursor: 'not-allowed',
    opacity: 0.6
  }
};
