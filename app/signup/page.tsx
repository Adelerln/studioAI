'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { useAuth } from '@/context/AuthContext';

export default function SignupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, router, user]);

  return (
    <section style={styles.wrapper}>
      <Suspense fallback={<div>Chargement…</div>}>
        <AuthForm initialMode="signup" />
      </Suspense>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '60px 16px'
  }
};
