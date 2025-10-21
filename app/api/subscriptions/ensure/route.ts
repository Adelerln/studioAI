import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { ensureSubscriptionRow } from '@/services/subscriptions';
import { FREE_TIER_QUOTA } from '@/constants/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return NextResponse.json({ message: 'Authentification requise.' }, { status: 401 });
    }

    await ensureSubscriptionRow(user.id, {
      status: 'free',
      quota_limit: FREE_TIER_QUOTA,
      quota_used: 0
    });

    return NextResponse.json({ ensured: true });
  } catch (error) {
    console.error('[subscriptions.ensure] error', error);
    return NextResponse.json(
      { message: 'Impossible de préparer le plan gratuit.' },
      { status: 500 }
    );
  }
}

