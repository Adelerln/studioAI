'use client';

import Link from 'next/link';
import { HeroSection } from '@/components/sections/HeroSection';
import { FeatureCardsSection } from '@/components/sections/FeatureCardsSection';
import { SecuritySection } from '@/components/sections/SecuritySection';
import { UseCasesSection } from '@/components/sections/UseCasesSection';

export default function LandingPage() {
  return (
    <main style={styles.page}>
      <HeroSection />
      <FeatureCardsSection />
      <SecuritySection />
      <UseCasesSection />
      <section id="pricing" style={styles.ctaBlock}>
        <div style={styles.ctaCopy}>
          <h2 style={styles.ctaHeading}>Prêt à livrer votre prochaine expérience IA ?</h2>
          <p style={styles.ctaSubtitle}>
            Lancez-vous gratuitement, puis équipez vos collaborateurs de workspaces dédiés. Support Enterprise et SLA
            disponibles.
          </p>
        </div>
        <div style={styles.ctaActions}>
          <Link href="/signup" style={{ ...styles.ctaButton, ...styles.ctaPrimary }}>
            Créer un compte
          </Link>
          <Link href="/contact" style={{ ...styles.ctaButton, ...styles.ctaSecondary }}>
            Parler à nos équipes
          </Link>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '48px',
    paddingBottom: '120px'
  },
  ctaBlock: {
    margin: '0 clamp(24px, 6vw, 120px)',
    padding: '48px clamp(24px, 6vw, 72px)',
    borderRadius: '36px',
    background: 'linear-gradient(135deg, #2563eb, #6366f1)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '32px',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#fff',
    boxShadow: '0 35px 120px -70px rgba(37,99,235,0.7)'
  },
  ctaCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: 520
  },
  ctaHeading: {
    margin: 0,
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    fontFamily: "'Manrope','Inter',sans-serif'",
    lineHeight: 1.15
  },
  ctaSubtitle: {
    margin: 0,
    fontSize: '1.05rem',
    lineHeight: 1.8,
    color: 'rgba(255,255,255,0.82)'
  },
  ctaActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px'
  },
  ctaButton: {
    borderRadius: '999px',
    padding: '14px 28px',
    fontWeight: 600,
    border: '1px solid transparent'
  },
  ctaPrimary: {
    backgroundColor: '#fff',
    color: '#1d4ed8'
  },
  ctaSecondary: {
    borderColor: 'rgba(255,255,255,0.5)',
    color: '#fff'
  }
};
