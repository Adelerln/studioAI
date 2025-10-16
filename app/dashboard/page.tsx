'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { FREE_TIER_QUOTA, PLAN_DETAILS } from '@/constants/subscriptions';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';

interface Project {
  id: string;
  prompt: string;
  status: string | null;
  input_image_url: string | null;
  output_image_url: string | null;
  created_at: string;
}

interface SubscriptionSummary {
  status: string | null;
  stripe_price_id: string | null;
  quota_limit: number | null;
  quota_used: number | null;
}

type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

export default function DashboardPage() {
  const { supabase, user, loading, signOut } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ state: GenerationStatus; message?: string }>({ state: 'idle' });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, router, user]);

  const loadProjects = useCallback(async () => {
    setProjectsError(null);
    setLoadingProjects(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setProjectsError('Unable to retrieve your projects right now.');
    } else {
      setProjects(data ?? []);
    }
    setLoadingProjects(false);
  }, [supabase]);

  const loadSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoadingSubscription(false);
      return;
    }

    setSubscriptionError(null);
    setLoadingSubscription(true);
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status,stripe_price_id,quota_limit,quota_used')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[subscription] fetch error', error);
      setSubscriptionError('Impossible de récupérer votre abonnement.');
    } else {
      setSubscription(data ?? null);
    }
    setLoadingSubscription(false);
  }, [supabase, user]);

  useEffect(() => {
    if (!loading && user) {
      loadProjects();
      loadSubscription();
    }
  }, [loadProjects, loadSubscription, loading, user]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;

    setFile(nextFile);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextFile ? URL.createObjectURL(nextFile) : null;
    });
    setStatus({ state: 'idle' });
  }, []);

  const quotaSummary = useMemo(() => {
    const status = subscription?.status ?? 'free';
    const planKey = ACTIVE_SUBSCRIPTION_STATUSES.has(status) && subscription?.stripe_price_id
      ? subscription.stripe_price_id
      : 'free';
    const plan = PLAN_DETAILS[planKey] ?? PLAN_DETAILS.free;
    const quotaLimit = subscription?.quota_limit ?? plan.quota ?? FREE_TIER_QUOTA;
    const quotaUsed = subscription?.quota_used ?? 0;
    return {
      status,
      planKey,
      quotaLimit,
      quotaUsed,
      quotaReached: quotaUsed >= quotaLimit
    };
  }, [subscription]);

  const canSubmit = useMemo(
    () => Boolean(file && prompt.trim().length > 0 && !quotaSummary.quotaReached),
    [file, prompt, quotaSummary.quotaReached]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (quotaSummary.quotaReached) {
        setStatus({ state: 'error', message: 'Quota atteint, passez au plan Pro.' });
        return;
      }
      if (!file) {
        setStatus({ state: 'error', message: 'Select an image to transform.' });
        return;
      }
      if (!prompt.trim()) {
        setStatus({ state: 'error', message: 'Describe the desired output in the text area.' });
        return;
      }

      setStatus({ state: 'loading', message: 'Generating…' });

      try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('prompt', prompt.trim());

        const response = await fetch('/api/generate', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload?.message ?? 'Generation failed.');
        }

        setPrompt('');
        setFile(null);
        setPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return null;
        });

        setStatus({ state: 'success', message: 'Image generated successfully.' });
        await Promise.all([loadProjects(), loadSubscription()]);
      } catch (error) {
        console.error('[generate] error', error);
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'Une erreur inconnue est survenue.'
        });
      }
    },
    [file, loadProjects, loadSubscription, prompt, quotaSummary.quotaReached]
  );

  const handleDelete = useCallback(
    async (projectId: string) => {
      setDeletingId(projectId);
      try {
        const response = await fetch('/api/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ id: projectId })
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload?.message ?? 'Delete failed.');
        }

        setProjects((current) => current.filter((project) => project.id !== projectId));
      } catch (error) {
        console.error('[delete] error', error);
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'Impossible de supprimer ce projet.'
        });
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  const handleOpenBillingPortal = useCallback(async () => {
    setBillingPortalLoading(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST'
      });

      const payload = (await response.json().catch(() => ({}))) as { url?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Impossible d’ouvrir le portail de facturation.');
      }

      if (!payload?.url) {
        throw new Error('Lien du portail client manquant.');
      }

      window.location.assign(payload.url);
    } catch (error) {
      console.error('[billing-portal] error', error);
      setStatus({
        state: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Impossible de charger le portail de facturation pour le moment.'
      });
    } finally {
      setBillingPortalLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    const { error } = await signOut();
    setSigningOut(false);
    if (error) {
      console.error('[signOut] error', error);
      setStatus({ state: 'error', message: 'Sign out failed. Please try again.' });
      return;
    }
    router.replace('/');
  }, [router, signOut]);

  return (
    <div style={styles.layout}>
      <section style={styles.panel}>
        <SubscriptionStatus
          status={subscription?.status ?? null}
          priceId={subscription?.stripe_price_id ?? null}
          quotaLimit={quotaSummary.quotaLimit}
          quotaUsed={quotaSummary.quotaUsed}
          loading={loadingSubscription}
          error={subscriptionError}
          onManage={handleOpenBillingPortal}
          manageDisabled={billingPortalLoading}
        />

        {quotaSummary.quotaReached && (
          <p style={styles.quotaWarning}>Quota atteint, passez au plan Pro.</p>
        )}

        <h1 style={styles.title}>New generation</h1>
        <form style={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="file" style={styles.label}>
            Image source
          </label>
          <label htmlFor="file" style={styles.dropzone}>
            <input
              id="file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" style={styles.preview} />
            ) : (
              <span style={{ color: '#64748b' }}>
                Drag and drop an image or click to browse your files.
              </span>
            )}
          </label>

          <label htmlFor="prompt" style={styles.label}>
            Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            style={styles.textarea}
            rows={4}
            placeholder="Describe the final result you expect."
          />

          {status.state !== 'idle' && (
            <p
              style={{
                ...styles.feedback,
                color:
                  status.state === 'error'
                    ? '#ef4444'
                    : status.state === 'success'
                    ? '#16a34a'
                    : '#0ea5e9'
              }}
            >
              {status.message}
            </p>
          )}

          <button type="submit" style={styles.submit} disabled={!canSubmit || status.state === 'loading'}>
            {status.state === 'loading' ? 'Generating…' : 'Start generation'}
          </button>
        </form>
      </section>

      <section style={styles.gallery}>
        <h2 style={styles.galleryTitle}>My projects</h2>
        {loadingProjects ? (
          <p style={styles.empty}>Loading…</p>
        ) : projectsError ? (
          <p style={{ ...styles.empty, color: '#ef4444' }}>{projectsError}</p>
        ) : projects.length === 0 ? (
          <p style={styles.empty}>No project yet. Launch your first generation!</p>
        ) : (
          <div style={styles.cards}>
            {projects.map((project) => (
              <article key={project.id} style={styles.card}>
                <div style={styles.images}>
                  {project.input_image_url && (
                    <img src={project.input_image_url} alt="Original image" style={styles.image} />
                  )}
                  {project.output_image_url && (
                    <img src={project.output_image_url} alt="AI result" style={styles.image} />
                  )}
                </div>
                <p style={styles.prompt}>{project.prompt}</p>
                <div style={styles.cardFooter}>
                  <time style={styles.time}>
                    {new Date(project.created_at).toLocaleString('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </time>
                  <button
                    onClick={() => handleDelete(project.id)}
                    style={styles.delete}
                    disabled={deletingId === project.id}
                  >
                    {deletingId === project.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {user && (
          <div style={styles.logoutRow}>
            <button onClick={handleSignOut} style={styles.logout} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    flex: 1,
    display: 'grid',
    gap: '32px',
    gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
    padding: '40px clamp(16px, 4vw, 48px)'
  },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 25px 60px -40px rgba(15, 23, 42, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  quotaWarning: {
    margin: 0,
    fontWeight: 600,
    color: '#b91c1c'
  },
  title: {
    margin: 0,
    fontSize: '1.8rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  label: {
    fontWeight: 600,
    fontSize: '0.9rem',
    letterSpacing: '0.06em',
    color: '#1f2937'
  },
  dropzone: {
    border: '2px dashed rgba(99, 102, 241, 0.4)',
    borderRadius: '20px',
    padding: '20px',
    minHeight: '200px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    backgroundColor: 'rgba(248, 250, 252, 0.7)'
  },
  preview: {
    maxWidth: '100%',
    maxHeight: '220px',
    borderRadius: '16px',
    objectFit: 'cover',
    boxShadow: '0 16px 35px -24px rgba(99, 102, 241, 0.6)'
  },
  textarea: {
    borderRadius: '16px',
    border: '1px solid rgba(148,163,184,0.5)',
    padding: '16px',
    resize: 'vertical',
    minHeight: '140px',
    fontSize: '0.95rem'
  },
  submit: {
    borderRadius: '999px',
    border: 'none',
    padding: '14px 18px',
    fontWeight: 600,
    fontSize: '1rem',
    color: '#fff',
    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
    cursor: 'pointer'
  },
  feedback: {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 500
  },
  gallery: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 25px 60px -40px rgba(15, 23, 42, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  galleryTitle: {
    margin: 0,
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#111827'
  },
  empty: {
    margin: 0,
    fontSize: '1rem',
    color: '#475569'
  },
  cards: {
    display: 'grid',
    gap: '20px'
  },
  card: {
    borderRadius: '20px',
    border: '1px solid rgba(148,163,184,0.3)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  images: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px'
  },
  image: {
    width: '100%',
    borderRadius: '16px',
    objectFit: 'cover',
    border: '1px solid rgba(148,163,184,0.3)'
  },
  prompt: {
    margin: 0,
    fontSize: '0.95rem',
    lineHeight: 1.5,
    color: '#1f2937'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  time: {
    fontSize: '0.85rem',
    color: '#64748b'
  },
  delete: {
    borderRadius: '999px',
    border: '1px solid rgba(239,68,68,0.3)',
    padding: '8px 14px',
    backgroundColor: '#fff',
    color: '#ef4444',
    fontWeight: 600,
    cursor: 'pointer'
  },
  logoutRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '12px'
  },
  logout: {
    borderRadius: '999px',
    border: 'none',
    padding: '12px 20px',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #fda4af, #c084fc)',
    boxShadow: '0 25px 60px -40px rgba(240, 149, 171, 0.55)',
    cursor: 'pointer'
  }
};
