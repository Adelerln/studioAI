'use client';

import { securityPillars } from '@/features/landing/constants';

export function SecuritySection() {
  return (
    <section id="security" style={styles.wrapper}>
      <header style={styles.intro}>
        <span style={styles.eyebrow}>Security & compliance</span>
        <h2 style={styles.heading}>Built for teams with the highest compliance needs</h2>
        <p style={styles.subheading}>
          Offload creative workflows to AI while meeting governance requirements. Studio AI fits into your stack and
          respects enterprise security policies out of the box.
        </p>
      </header>

      <div style={styles.pillars}>
        {securityPillars.map((pillar) => (
          <article key={pillar.title} style={styles.card}>
            <div style={{ ...styles.shapeContainer, background: pillar.accent.background }}>
              <div style={{ ...styles.shape, background: pillar.accent.shape }} />
            </div>
            <h3 style={styles.cardTitle}>{pillar.title}</h3>
            <p style={styles.cardText}>{pillar.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    padding: '96px clamp(24px, 6vw, 120px)',
    display: 'grid',
    gap: '48px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(148,163,184,0.08) 100%)',
    borderRadius: '48px',
    margin: '96px clamp(12px, 4vw, 48px)',
    boxShadow: '0 40px 140px -80px rgba(15,23,42,0.35)'
  },
  intro: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: 680
  },
  eyebrow: {
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 600,
    color: '#0f172a'
  },
  heading: {
    margin: 0,
    fontSize: 'clamp(2.4rem, 4vw, 3.2rem)',
    lineHeight: 1.15,
    fontFamily: "'Futura', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif",
    color: '#0f172a'
  },
  subheading: {
    margin: 0,
    fontSize: '1.05rem',
    lineHeight: 1.8,
    color: 'rgba(15,23,42,0.68)'
  },
  pillars: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '24px'
  },
  card: {
    borderRadius: '28px',
    backgroundColor: 'rgba(255,255,255,0.92)',
    border: '1px solid rgba(203,213,225,0.45)',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  shapeContainer: {
    width: 52,
    height: 52,
    borderRadius: '16px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  shape: {
    width: 36,
    height: 36,
    borderRadius: '12px'
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.28rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  cardText: {
    margin: 0,
    fontSize: '1rem',
    lineHeight: 1.7,
    color: 'rgba(15,23,42,0.65)'
  }
};
