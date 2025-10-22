import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { ensureReferralCodeForUser } from '@/services/referrals';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getCreditBalance } from '@/services/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    if (!user) {
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    let code: string | null = null;
    let credits = 0;
    let referredBy: string | null = null;

    try {
      code = await ensureReferralCodeForUser(user.id);
    } catch (ensureError) {
      console.warn('[referral.code] ensureReferralCodeForUser failed, using fallback code', ensureError);
      code = user.id.replace(/-/g, '').slice(0, 10).toUpperCase();
    }

    try {
      const supabaseAdmin = createSupabaseAdminClient();
      const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(user.id);
      const metadata = (adminUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
      referredBy = typeof metadata.referred_by === 'string' ? metadata.referred_by : null;
    } catch (adminError) {
      console.warn('[referral.code] unable to load referral metadata, defaulting to zero credits', adminError);
    }

    try {
      credits = await getCreditBalance(user.id);
    } catch (creditError) {
      console.warn('[referral.code] unable to load credit balance', creditError);
    }

    return NextResponse.json({
      code: code ?? null,
      credits,
      referredBy
    });
  } catch (apiError) {
    console.error('[referral.code] error', apiError);
    return NextResponse.json({ message: 'Unable to retrieve your referral information.' }, { status: 500 });
  }
}
