/**
 * Merge class names utility, inspired by the shadcn/ui `cn` helper.
 */
export function cn(...inputs: Array<string | undefined | null | false>) {
  return inputs.filter(Boolean).join(' ');
}

/**
 * No-op sleep helper for simulating network latency in feature demos.
 */
export async function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export function resolveSiteUrl(options?: { origin?: string | null; fallback?: string }) {
  const { origin, fallback } = options ?? {};
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  return origin ?? envUrl ?? fallback ?? 'http://localhost:3000';
}
