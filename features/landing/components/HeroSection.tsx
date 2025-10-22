'use client';

import Link from 'next/link';
import { heroContent } from '@/features/landing/constants';

export function HeroSection() {
  return (
    <section id="product" style={styles.wrapper}>
      <div style={styles.copy}>
        <span style={styles.eyebrow}>{heroContent.eyebrow}</span>
        <h1 style={styles.heading}>{heroContent.title}</h1>
        <p style={styles.subtitle}>{heroContent.subtitle}</p>
        <div style={styles.actions}>
          {heroContent.secondaryCta && (
            <Link href={heroContent.secondaryCta.href} style={styles.secondaryAction}>
              {heroContent.secondaryCta.label}
            </Link>
          )}
          <Link href="/dashboard" style={styles.primaryAction}>
            Access studio
          </Link>
        </div>
      </div>

      <div style={styles.media}>
        <div style={styles.mediaCard}>
          <div style={styles.mediaHeader}>
            <span style={styles.mediaBadge}>{heroContent.mediaCaption}</span>
          </div>
          <div style={styles.mediaBody}>
            <div style={styles.mockWindow}>
              <div style={styles.mockSidebar}>
                <div style={styles.dotRow}>
                  <span style={{ ...styles.dot, backgroundColor: '#2563eb' }} />
                  <span style={{ ...styles.dot, backgroundColor: '#1d4ed8' }} />
                  <span style={{ ...styles.dot, backgroundColor: '#0f172a' }} />
                </div>
                <div style={styles.sidebarItem} />
                <div style={{ ...styles.sidebarItem, width: '70%' }} />
                <div style={{ ...styles.sidebarItem, width: '60%' }} />
              </div>
              <div style={styles.mockCanvas}>
                <div style={styles.canvasHeader}>
                  <span style={styles.canvasTag}>Creative orchestrator</span>
                  <div style={styles.canvasBadges}>
                    <span style={{ ...styles.canvasBadge, backgroundColor: 'rgba(59,130,246,0.15)' }}>v2.4</span>
                    <span style={{ ...styles.canvasBadge, backgroundColor: 'rgba(16,185,129,0.15)' }}>Live</span>
                  </div>
                </div>
                <div style={styles.canvasGrid}>
                  <div style={styles.canvasCard}>
                    <span style={styles.cardTitle}>Input image</span>
                    <div style={{ ...styles.cardPreview, background: 'linear-gradient(135deg, #a5b4fc, #c4d1ff)' }} />
                  </div>
                  <div style={{ ...styles.canvasCard, backgroundColor: '#0f172a', color: '#fff' }}>
                    <span style={styles.cardTitle}>Prompt</span>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                      Generate an editorial portrait inspired by modern lifestyle magazines.
                    </p>
                  </div>
                  <div style={styles.canvasCard}>
                    <span style={styles.cardTitle}>Output</span>
                    <div style={{ ...styles.cardPreview, background: 'linear-gradient(135deg, #fda4af, #c084fc)' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    alignItems: 'center',
    gap: '48px',
    padding: '96px clamp(24px, 6vw, 120px)',
    position: 'relative'
  },
  copy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: 580
  },
  eyebrow: {
    fontSize: '0.85rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderRadius: '999px',
    padding: '6px 14px',
    alignSelf: 'flex-start'
  },
  heading: {
    margin: 0,
    fontFamily: "'Futura', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 'clamp(2.8rem, 5vw, 4.2rem)',
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
    color: '#0f172a'
  },
  subtitle: {
    margin: 0,
    fontSize: '1.2rem',
    lineHeight: 1.7,
    color: 'rgba(15,23,42,0.7)'
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px'
  },
  secondaryAction: {
    borderRadius: '999px',
    border: '1px solid rgba(15,23,42,0.15)',
    padding: '12px 22px',
    fontWeight: 600,
    color: '#0f172a',
    backgroundColor: '#fff',
    boxShadow: '0 20px 45px -35px rgba(15,23,42,0.45)'
  },
  primaryAction: {
    borderRadius: '999px',
    padding: '12px 24px',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #2563eb, #6366f1)',
    boxShadow: '0 24px 50px -35px rgba(37, 99, 235, 0.6)'
  },
  media: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center'
  },
  mediaCard: {
    position: 'relative',
    borderRadius: '32px',
    padding: '24px',
    background: 'rgba(255,255,255,0.95)',
    boxShadow: '0 40px 120px -60px rgba(15, 23, 42, 0.45)',
    width: 'min(540px, 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  mediaHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mediaBadge: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#1e293b',
    background: 'rgba(148,163,184,0.14)',
    padding: '8px 16px',
    borderRadius: '12px'
  },
  mediaBody: {
    position: 'relative',
    borderRadius: '20px',
    overflow: 'hidden',
    border: '1px solid rgba(203,213,225,0.6)',
    minHeight: 320,
    background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(14,165,233,0.08))',
    padding: '18px'
  },
  mockWindow: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    gap: '18px'
  },
  mockSidebar: {
    borderRadius: '16px',
    background: 'rgba(15,23,42,0.04)',
    border: '1px solid rgba(148,163,184,0.35)',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  dotRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px'
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '999px',
    display: 'inline-block'
  },
  sidebarItem: {
    height: 12,
    borderRadius: '999px',
    backgroundColor: 'rgba(148,163,184,0.5)'
  },
  mockCanvas: {
    borderRadius: '18px',
    background: '#fff',
    border: '1px solid rgba(226,232,240,0.8)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    boxShadow: '0 25px 60px -45px rgba(15,23,42,0.4)'
  },
  canvasHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  canvasTag: {
    fontWeight: 600,
    fontSize: '0.95rem',
    color: '#0f172a'
  },
  canvasBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  canvasBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#0f172a',
    padding: '6px 10px',
    borderRadius: '999px'
  },
  canvasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px'
  },
  canvasCard: {
    borderRadius: '16px',
    border: '1px solid rgba(203,213,225,0.6)',
    padding: '18px',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: '0.9rem'
  },
  cardPreview: {
    borderRadius: '12px',
    height: 110,
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)'
  }
};
