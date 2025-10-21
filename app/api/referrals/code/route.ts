import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { ensureReferralCodeForUser } from '@/services/referrals';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

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
      return NextResponse.json({ message: 'Authentification requise.' }, { status: 401 });
    }

    const code = await ensureReferralCodeForUser(user.id);
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const metadata = (adminUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const credits = Number(metadata.referral_credits ?? 0) || 0;
    const referredBy = typeof metadata.referred_by === 'string' ? metadata.referred_by : null;

    return NextResponse.json({
      code,
      credits,
      referredBy
    });
  } catch (apiError) {
    console.error('[referral.code] error', apiError);
    return NextResponse.json({ message: 'Impossible de récupérer votre code de parrainage.' }, { status: 500 });
  }
}

