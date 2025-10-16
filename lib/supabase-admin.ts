import { createClient } from '@supabase/supabase-js';

function resolveEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function createSupabaseAdminClient() {
  const supabaseUrl = resolveEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey =
    resolveEnv('SUPABASE_SERVICE_ROLE_KEY') ?? resolveEnv('SUPABASE_SERVICE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[supabase-admin] Missing configuration', {
      hasUrl: Boolean(supabaseUrl),
      hasServiceRole: Boolean(serviceRoleKey)
    });
    throw new Error('Supabase URL or service role key missing from configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}
