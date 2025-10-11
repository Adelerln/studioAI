'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { featureCards } from '@/features/landing/constants';

export function FeatureCardsSection() {
  return (
    <section id="features" style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Capabilities</span>
        <h2 style={styles.heading}>Design, evaluate, and deploy your AI experiences in one place</h2>
        <p style={styles.description}>
          Studio AI brings together leading models, your proprietary data, and collaborative tooling to deliver an
          end-to-end creative process.
        </p>
      </div>
      <div style={styles.grid}>
        {featureCards.map((card) => (
          <Card key={card.id} className="min-h-[220px] rounded-2xl">
            <CardHeader className="flex flex-row items-start gap-4">
              <div style={{ ...styles.cardAccent, background: card.accent }} />
              <div>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent />
          </Card>
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
  cardAccent: {
    width: 48,
    height: 48,
    borderRadius: '16px'
  }
};
