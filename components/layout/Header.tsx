'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCallback, useMemo, useState } from 'react';
import { navigationLinks } from '@/features/landing/constants';

export function Header() {
  const { user, signOut, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const showMarketingNav = useMemo(() => pathname === '/', [pathname]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    const { error } = await signOut();
    setSigningOut(false);
    if (error) {
      console.error('[signOut] error', error);
    }
    router.replace('/');
  }, [router, signOut]);

  const showAuthLinks = !loading && !user;

  return (
    <header style={styles.wrapper}>
      <Link href="/" style={styles.brand}>
        <span style={{ fontWeight: 800 }}>Studio</span>
        <span style={{ color: '#2563eb', marginLeft: 4 }}>AI</span>
      </Link>

      <nav style={styles.nav}>
        {showMarketingNav && (
          <div style={styles.primaryLinks}>
            {navigationLinks.map((item) => (
              <a key={item.label} href={item.href} style={styles.navLink}>
                {item.label}
              </a>
            ))}
          </div>
        )}
        {user ? (
          <div style={styles.session}>
            <span style={styles.email}>{user.email}</span>
            <button onClick={handleSignOut} style={styles.signOut} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        ) : (
          showAuthLinks && (
            <div style={styles.links}>
              <Link href="/login" style={{ ...styles.link, ...styles.primaryCta }}>
                log in
              </Link>
              <Link href="/signup" style={{ ...styles.link, ...styles.secondaryCta }}>
                sign up
              </Link>
            </div>
          )
        )}
      </nav>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px clamp(20px, 4vw, 48px)',
    position: 'sticky',
    top: 0,
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(18px)',
    borderBottom: '1px solid rgba(148,163,184,0.25)',
    zIndex: 10
  },
  brand: {
    fontWeight: 700,
    fontSize: '1.2rem',
    letterSpacing: '0.05em'
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '28px'
  },
  primaryLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px'
  },
  navLink: {
    fontSize: '0.95rem',
    fontWeight: 500,
    color: '#475569',
    padding: '8px 0'
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  link: {
    fontWeight: 600,
    padding: '10px 18px',
    borderRadius: '999px',
    border: '1px solid transparent',
    textTransform: 'none'
  },
  primaryCta: {
    background: 'linear-gradient(135deg, #2563eb, #6366f1)',
    color: '#fff'
  },
  secondaryCta: {
    borderColor: 'rgba(15,23,42,0.12)',
    color: '#0f172a',
    backgroundColor: '#fff',
    boxShadow: '0 10px 30px -25px rgba(15,23,42,0.6)'
  },
  session: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  email: {
    fontWeight: 500,
    color: '#1f2937'
  },
  signOut: {
    borderRadius: '999px',
    border: '1px solid rgba(239,68,68,0.4)',
    padding: '8px 16px',
    backgroundColor: '#fff',
    fontWeight: 600,
    color: '#ef4444',
    cursor: 'pointer'
  }
};
