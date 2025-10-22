'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { FREE_TIER_QUOTA, PLAN_DETAILS, STRIPE_PRO_PRICE_ID } from '@/constants/subscriptions';
import { REFERRAL_REWARD_BONUS } from '@/constants/referrals';
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
  stripe_subscription_id: string | null;
  quota_limit: number | null;
  quota_used: number | null;
}

type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

interface ReferralInfo {
  code: string;
  credits: number;
  shareUrl: string;
  referredBy: string | null;
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '1rem', color: '#475569' }}>Chargement du tableau de bord…</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { supabase, user, loading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [checkoutHandled, setCheckoutHandled] = useState(false);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [loadingReferral, setLoadingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralMessage, setReferralMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [upgradingPlan, setUpgradingPlan] = useState(false);
  const [upgradeFeedback, setUpgradeFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

    try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status,stripe_price_id,stripe_subscription_id,quota_limit,quota_used')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setSubscription(data);
        return;
      }

      const ensureResponse = await fetch('/api/subscriptions/ensure', {
        method: 'POST'
      });

      if (!ensureResponse.ok) {
        const payload = await ensureResponse.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Unable to prepare your free plan.');
      }

      const { data: ensured, error: ensuredError } = await supabase
        .from('subscriptions')
        .select('status,stripe_price_id,stripe_subscription_id,quota_limit,quota_used')
        .eq('user_id', user.id)
        .maybeSingle();

      if (ensuredError) {
        throw ensuredError;
      }

      setSubscription(ensured ?? null);
    } catch (subscriptionError) {
      console.error('[subscription] fetch error', subscriptionError);
      setSubscription(null);
      setSubscriptionError('Unable to retrieve your subscription.');
    } finally {
      setLoadingSubscription(false);
    }
  }, [supabase, user]);

  const loadReferralInfo = useCallback(async () => {
    if (!user) {
      setReferralInfo(null);
      return;
    }
    setReferralError(null);
    setLoadingReferral(true);
    try {
      const response = await fetch('/api/referrals/code');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Unable to retrieve your referral code.');
      }
      const payload = (await response.json()) as { code: string; credits: number; referredBy: string | null };
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin.replace(/\/$/, '')
          : (process.env.NEXT_PUBLIC_URL ?? '').replace(/\/$/, '');
      setReferralInfo({
        code: payload.code,
        credits: payload.credits ?? 0,
        referredBy: payload.referredBy ?? null,
        shareUrl: origin ? `${origin}/signup?ref=${payload.code}` : `/signup?ref=${payload.code}`
      });
    } catch (error) {
      console.error('[referral] fetch error', error);
      setReferralError(
        error instanceof Error ? error.message : 'Unable to retrieve your referral code.'
      );
    } finally {
      setLoadingReferral(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) {
      loadProjects();
      loadSubscription();
      loadReferralInfo();
    }
  }, [loadProjects, loadReferralInfo, loadSubscription, loading, user]);

  useEffect(() => {
    if (!user || checkoutHandled || checkoutProcessing) {
      return;
    }

    const checkoutStatus = searchParams?.get('checkout');
    const sessionId = searchParams?.get('session_id');

    if (checkoutStatus === 'success' && sessionId) {
      setCheckoutProcessing(true);
      fetch('/api/stripe/checkout/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      })
        .then(async (response) => {
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.message ?? 'Unable to finalise your subscription.');
          }
          setStatus({ state: 'success', message: 'Your subscription has been activated.' });
          await loadSubscription();
          setCheckoutHandled(true);
          router.replace('/dashboard');
        })
        .catch((error) => {
          console.error('[checkout] finalise error', error);
          setStatus({
            state: 'error',
            message: error instanceof Error ? error.message : 'Failed to activate your subscription.'
          });
        })
        .finally(() => {
          setCheckoutProcessing(false);
        });
    }
  }, [checkoutHandled, checkoutProcessing, loadSubscription, router, searchParams, user]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      return;
    }
    const pending = localStorage.getItem('pending-referral-code');
    if (!pending) {
      return;
    }
    const resolveReferral = async () => {
      try {
        const response = await fetch('/api/referrals/claim', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code: pending })
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          setReferralMessage({ type: 'success', text: 'Referral bonus applied to your account.' });
          await loadReferralInfo();
        } else {
          setReferralMessage({
            type: 'error',
            text: payload?.message ?? 'Unable to validate your referral.'
          });
        }
      } catch (error) {
        console.error('[referral] claim error', error);
        setReferralMessage({ type: 'error', text: 'Unable to validate your referral.' });
      } finally {
        localStorage.removeItem('pending-referral-code');
      }
    };
    resolveReferral();
  }, [loadReferralInfo, user]);

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

  const showUpgradeToPro = useMemo(() => {
    if (!subscription) {
      return false;
    }
    if (!subscription.stripe_subscription_id) {
      return false;
    }
    if (subscription.stripe_price_id === STRIPE_PRO_PRICE_ID) {
      return false;
    }
    return ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status ?? '');
  }, [subscription]);

  const showQuotaReminder = useMemo(() => {
    if (!subscription) {
      return false;
    }
    const limit = quotaSummary.quotaLimit;
    if (!limit || limit <= 0) {
      return false;
    }
    if (quotaSummary.quotaReached) {
      return false;
    }
    return quotaSummary.quotaUsed / limit >= 0.8;
  }, [quotaSummary.quotaLimit, quotaSummary.quotaReached, quotaSummary.quotaUsed, subscription]);

  const canSubmit = useMemo(
    () => Boolean(file && prompt.trim().length > 0 && !quotaSummary.quotaReached),
    [file, prompt, quotaSummary.quotaReached]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (quotaSummary.quotaReached) {
        setStatus({ state: 'error', message: 'Quota reached, switch to the Basic plan.' });
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
          message: error instanceof Error ? error.message : 'An unknown error occurred.'
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
          message: error instanceof Error ? error.message : 'Unable to delete this project.'
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
        throw new Error(payload?.message ?? 'Unable to open the billing portal.');
      }

      if (!payload?.url) {
        throw new Error('Customer portal link missing.');
      }

      window.location.assign(payload.url);
    } catch (error) {
      console.error('[billing-portal] error', error);
      setStatus({
        state: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load the billing portal right now.'
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

  const handleCopyReferralLink = useCallback(async () => {
    if (!referralInfo?.shareUrl) {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setReferralMessage({ type: 'error', text: 'Link copy is not supported by your browser.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(referralInfo.shareUrl);
      setReferralMessage({ type: 'success', text: 'Referral link copied!' });
    } catch (error) {
      console.error('[referral] copy error', error);
      setReferralMessage({ type: 'error', text: 'Unable to copy the link.' });
    }
  }, [referralInfo]);

  const handleShareReferral = useCallback(async () => {
    if (!referralInfo?.shareUrl) {
      return;
    }
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      await handleCopyReferralLink();
      return;
    }
    try {
      await navigator.share({
        title: 'Studio AI - Invitation',
        text: 'Join me on Studio AI and enjoy a welcome discount!',
        url: referralInfo.shareUrl
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError') {
        return;
      }
      console.error('[referral] share error', error);
      setReferralMessage({ type: 'error', text: 'Sharing cancelled or unavailable.' });
    }
  }, [handleCopyReferralLink, referralInfo]);

  const handleUpgradeToPro = useCallback(async () => {
    setUpgradeFeedback(null);
    setUpgradingPlan(true);
    try {
      const response = await fetch('/api/subscriptions/upgrade', {
        method: 'POST'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to upgrade your subscription.');
      }
      setUpgradeFeedback({
        type: 'success',
        text: payload?.message ?? 'Your subscription has been upgraded to the Pro plan.'
      });
      await loadSubscription();
    } catch (error) {
      console.error('[subscription] upgrade error', error);
      setUpgradeFeedback({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Unable to upgrade your subscription right now.'
      });
    } finally {
      setUpgradingPlan(false);
    }
  }, [loadSubscription]);

  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
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

        {showQuotaReminder && (
          <div style={styles.quotaBanner}>
            <p style={styles.quotaBannerTitle}>You have {Math.max(0, quotaSummary.quotaLimit - quotaSummary.quotaUsed)} generations left</p>
            <p style={styles.quotaBannerText}>
              Use the remaining quota before the cycle renews or upgrade to Basic/Pro to increase your limit.
            </p>
          </div>
        )}

        {showUpgradeToPro && (
          <div style={styles.upgradeCard}>
            {upgradeFeedback ? (
              <p
                style={{
                  ...styles.upgradeFeedback,
                  color: upgradeFeedback.type === 'success' ? '#15803d' : '#dc2626'
                }}
              >
                {upgradeFeedback.text}
              </p>
            ) : (
              <p style={styles.upgradeIntro}>
                Need more generations? Upgrade to the Pro plan in one click, Stripe automatically handles proration.
              </p>
            )}
            <button
              type="button"
              style={{
                ...styles.upgradeButton,
                ...(upgradingPlan ? styles.upgradeButtonDisabled : {})
              }}
              onClick={handleUpgradeToPro}
              disabled={upgradingPlan}
            >
              {upgradingPlan ? 'Upgrading…' : 'Upgrade to Pro'}
            </button>
            <p style={styles.upgradeNote}>
              You will be billed pro rata for the remaining period and the new plan will start immediately.
            </p>
          </div>
        )}

        <div style={styles.referralCard}>
          <div style={styles.referralHeader}>
            <div>
              <h3 style={styles.referralTitle}>Invite a friend</h3>
              <p style={styles.referralSubtitle}>
                Share your link: your friend receives a discount and you earn {REFERRAL_REWARD_BONUS} bonus generations.
              </p>
            </div>
            {referralInfo?.credits ? (
              <span style={styles.referralBadge}>+{referralInfo.credits} bonus credits</span>
            ) : null}
          </div>
          {referralMessage && (
            <p
              style={{
                ...styles.referralMessage,
                color: referralMessage.type === 'success' ? '#166534' : '#b91c1c'
              }}
            >
              {referralMessage.text}
            </p>
          )}
          {loadingReferral ? (
            <p style={styles.muted}>Loading your link…</p>
          ) : referralError ? (
            <p style={{ ...styles.muted, color: '#b91c1c' }}>{referralError}</p>
          ) : referralInfo ? (
            <>
              <div style={styles.referralCodeRow}>
                <code style={styles.referralCode}>{referralInfo.code}</code>
                <button type="button" style={styles.referralCopy} onClick={handleCopyReferralLink}>
                  Copy
                </button>
                <button type="button" style={styles.referralShare} onClick={handleShareReferral}>
                  Share
                </button>
              </div>
              <p style={styles.referralLink}>{referralInfo.shareUrl}</p>
              {referralInfo.referredBy ? (
                <p style={styles.referralNote}>
                  Referred with code <strong>{referralInfo.referredBy}</strong>.
                </p>
              ) : null}
            </>
          ) : (
            <p style={styles.muted}>No referral link available.</p>
          )}
        </div>

        {quotaSummary.quotaReached && (
          <div style={styles.quotaCta}>
            <p style={styles.quotaCtaText}>
              You have used your {quotaSummary.quotaLimit} free generations this month.
            </p>
            <Link href="/pricing" style={styles.quotaCtaButton}>
              Upgrade to the Basic plan
            </Link>
          </div>
        )}

        <section style={styles.projects}>
          <h2 style={styles.projectsTitle}>My projects</h2>
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
                      {new Date(project.created_at).toLocaleString('en-US', {
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
      </aside>

      <section style={styles.main}>
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    flex: 1,
    display: 'grid',
    alignItems: 'start',
    gap: '32px',
    gridTemplateColumns: 'minmax(280px, 360px) 1fr',
    padding: '40px clamp(16px, 4vw, 48px)'
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  main: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 25px 60px -40px rgba(15, 23, 42, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  upgradeCard: {
    borderRadius: '16px',
    border: '1px solid rgba(59,130,246,0.2)',
    padding: '14px',
    background: 'linear-gradient(135deg, rgba(219,234,254,0.85), rgba(191,219,254,0.9))',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  upgradeIntro: {
    margin: 0,
    color: '#1d4ed8',
    fontWeight: 600,
    fontSize: '0.9rem'
  },
  upgradeFeedback: {
    margin: 0,
    fontWeight: 600,
    fontSize: '0.9rem'
  },
  upgradeButton: {
    alignSelf: 'flex-start',
    borderRadius: '999px',
    border: 'none',
    padding: '10px 18px',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #1d4ed8, #6366f1)',
    cursor: 'pointer'
  },
  upgradeButtonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed'
  },
  upgradeNote: {
    margin: 0,
    color: '#475569',
    fontSize: '0.85rem'
  },
  quotaBanner: {
    borderRadius: '14px',
    border: '1px solid rgba(250,204,21,0.35)',
    padding: '14px',
    background: 'linear-gradient(135deg, rgba(254,243,199,0.75), rgba(253,230,138,0.8))',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  quotaBannerTitle: {
    margin: 0,
    fontWeight: 700,
    color: '#92400e'
  },
  quotaBannerText: {
    margin: 0,
    color: '#92400e',
    fontSize: '0.9rem'
  },
  referralCard: {
    borderRadius: '16px',
    border: '1px solid rgba(148,163,184,0.3)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: 'linear-gradient(135deg, rgba(236,254,255,0.9), rgba(224,231,255,0.9))'
  },
  referralHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px'
  },
  referralTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  referralSubtitle: {
    margin: '6px 0 0',
    color: '#475569',
    fontSize: '0.95rem'
  },
  referralBadge: {
    alignSelf: 'flex-start',
    borderRadius: '999px',
    padding: '6px 12px',
    fontWeight: 600,
    fontSize: '0.85rem',
    backgroundColor: 'rgba(16,185,129,0.18)',
    color: '#047857'
  },
  referralMessage: {
    margin: 0,
    fontWeight: 600
  },
  referralCodeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '10px'
  },
  referralCode: {
    padding: '10px 16px',
    borderRadius: '12px',
    backgroundColor: '#fff',
    border: '1px solid rgba(148,163,184,0.4)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#1f2937'
  },
  referralCopy: {
    borderRadius: '999px',
    border: 'none',
    padding: '10px 16px',
    fontWeight: 600,
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: '#fff',
    cursor: 'pointer'
  },
  referralShare: {
    borderRadius: '999px',
    border: '1px solid rgba(79,70,229,0.3)',
    padding: '9px 16px',
    fontWeight: 600,
    color: '#4338ca',
    backgroundColor: '#fff',
    cursor: 'pointer'
  },
  referralLink: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#475569',
    wordBreak: 'break-all'
  },
  referralNote: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#1d4ed8'
  },
  quotaCta: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px',
    borderRadius: '14px',
    padding: '10px 14px',
    backgroundColor: 'rgba(254, 243, 199, 0.6)',
    border: '1px solid rgba(251, 191, 36, 0.4)'
  },
  quotaCtaText: {
    margin: 0,
    fontWeight: 600,
    color: '#92400e'
  },
  quotaCtaButton: {
    borderRadius: '999px',
    padding: '10px 16px',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    textDecoration: 'none'
  },
  projects: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 20px 50px -40px rgba(15, 23, 42, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  projectsTitle: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#111827'
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
  empty: {
    margin: 0,
    fontSize: '1rem',
    color: '#475569'
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
    gap: '14px'
  },
  card: {
    borderRadius: '16px',
    border: '1px solid rgba(148,163,184,0.25)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  images: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '10px'
  },
  image: {
    width: '100%',
    borderRadius: '14px',
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
