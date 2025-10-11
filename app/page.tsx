'use client';

import { HeroSection } from '@/features/landing';

export default function LandingPage() {
  return (
    <main style={styles.page}>
      <HeroSection />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: '120px'
  }
};
