'use client';

import { useCasesColumns } from '@/features/landing/constants';

export function UseCasesSection() {
  return (
    <section id="use-cases" style={styles.wrapper}>
      <header style={styles.intro}>
        <h2 style={styles.heading}>Which agent will you launch today?</h2>
        <p style={styles.subtitle}>
          Ready-to-use agents for every team. Customize prompts, connect your data sources, and share internally or via
          API.
        </p>
      </header>
      <div style={styles.columns}>
        {useCasesColumns.map((column) => (
          <article
            key={column.heading}
            style={{
              ...styles.column,
              backgroundColor: column.tone.background,
              borderColor: column.tone.border
            }}
          >
            <div style={styles.badge}>
              <span>{column.badge.label}</span>
              <strong>{column.badge.highlight}</strong>
            </div>
            <h3 style={styles.columnHeading}>{column.heading}</h3>
            <ul style={styles.list}>
              {column.points.map((point) => (
                <li key={point} style={styles.listItem}>
                  {point}
                </li>
              ))}
            </ul>
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
    gap: '48px'
  },
  intro: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: 720
  },
  heading: {
    margin: 0,
    fontSize: 'clamp(2.4rem, 4vw, 3.2rem)',
    fontFamily: "'Futura', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif",
    lineHeight: 1.15
  },
  subtitle: {
    margin: 0,
    fontSize: '1.05rem',
    lineHeight: 1.8,
    color: 'rgba(15,23,42,0.7)'
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '24px'
  },
  column: {
    borderRadius: '32px',
    border: '1px solid',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    boxShadow: '0 25px 80px -55px rgba(15,23,42,0.35)'
  },
  badge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    padding: '12px 16px',
    borderRadius: '18px',
    backgroundColor: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(255,255,255,0.7)',
    fontSize: '0.9rem'
  },
  columnHeading: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  list: {
    margin: 0,
    paddingLeft: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  listItem: {
    fontSize: '1rem',
    lineHeight: 1.65,
    color: 'rgba(15,23,42,0.75)'
  }
};
