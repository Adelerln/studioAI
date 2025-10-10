'use client';

import { featureCards } from '@/data/marketing';

export function FeatureCardsSection() {
  return (
    <section id="solutions" style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Capabilities</span>
        <h2 style={styles.heading}>Créez, évaluez et déployez vos expériences IA au même endroit</h2>
        <p style={styles.description}>
          Studio AI assemble les meilleurs modèles, vos données propriétaires et des outils de collaboration pour
          livrer un processus créatif complet.
        </p>
      </div>
      <div style={styles.grid}>
        {featureCards.map((card) => (
          <article key={card.id} style={{ ...styles.card, boxShadow: styles.cardBoxShadow }}>
            <div style={{ ...styles.cardAccent, background: card.accent }} />
            <h3 style={styles.cardTitle}>{card.title}</h3>
            <p style={styles.cardDescription}>{card.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    padding: '48px clamp(24px, 6vw, 120px) 0',
    display: 'grid',
    gap: '48px'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: 640
  },
  eyebrow: {
    fontSize: '0.85rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#0f172a'
  },
  heading: {
    margin: 0,
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    lineHeight: 1.2,
    fontFamily: "'Manrope', 'Inter', sans-serif'",
    color: '#0f172a'
  },
  description: {
    margin: 0,
    fontSize: '1.05rem',
    lineHeight: 1.8,
    color: 'rgba(15,23,42,0.68)'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '24px'
  },
  card: {
    position: 'relative',
    borderRadius: '28px',
    padding: '32px',
    backgroundColor: '#fff',
    border: '1px solid rgba(203,213,225,0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    minHeight: 220
  },
  cardBoxShadow: '0 18px 80px -50px rgba(15,23,42, 0.6)',
  cardAccent: {
    width: 48,
    height: 48,
    borderRadius: '16px'
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  cardDescription: {
    margin: 0,
    fontSize: '1rem',
    lineHeight: 1.7,
    color: 'rgba(15,23,42,0.65)'
  }
};
