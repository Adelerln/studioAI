import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ensureSubscriptionRow } from '@/services/subscriptions';
import { ensureReferralCodeForUser, findReferrerByCode } from '@/services/referrals';
import { REFERRAL_REWARD_BONUS, STRIPE_REFERRAL_COUPON_ID } from '@/constants/referrals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ClaimPayload {
  code?: string;
}

function normaliseCode(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as ClaimPayload;
    const code = normaliseCode(payload.code);

    if (!code) {
      return NextResponse.json({ message: 'Code de parrainage manquant.' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError) {
      throw authError;
    }

    if (!user) {
      return NextResponse.json({ message: 'Authentification requise.' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const { data: currentUserData } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const currentMetadata = (currentUserData?.user?.user_metadata ?? {}) as Record<string, unknown>;

    if (typeof currentMetadata.referral_reward_claimed === 'boolean' && currentMetadata.referral_reward_claimed) {
      return NextResponse.json({ message: 'Récompense déjà appliquée.' });
    }

    if (typeof currentMetadata.referred_by === 'string' && currentMetadata.referred_by.length > 0) {
      return NextResponse.json({ message: 'Récompense déjà appliquée.' });
    }

    const referrerId = await findReferrerByCode(code);

    if (!referrerId) {
      return NextResponse.json({ message: 'Code de parrainage invalide.' }, { status: 404 });
    }

    if (referrerId === user.id) {
      return NextResponse.json({ message: 'Vous ne pouvez pas utiliser votre propre code.' }, { status: 400 });
    }

    await ensureSubscriptionRow(user.id, {
      status: 'free'
    });
    await ensureSubscriptionRow(referrerId, undefined);
    await ensureReferralCodeForUser(referrerId);

    const { data: referrerUserData } = await supabaseAdmin.auth.admin.getUserById(referrerId);
    const referrerMetadata = (referrerUserData?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const currentCredits = Number(referrerMetadata.referral_credits ?? 0) || 0;

    await supabaseAdmin.auth.admin.updateUserById(referrerId, {
      user_metadata: {
        ...referrerMetadata,
        referral_credits: currentCredits + REFERRAL_REWARD_BONUS
      }
    });

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...currentMetadata,
        referred_by: code,
        referral_reward_claimed: true,
        referral_coupon_id: currentMetadata.referral_coupon_id ?? STRIPE_REFERRAL_COUPON_ID ?? null,
        referral_coupon_redeemed: false
      }
    });

    try {
      await supabaseAdmin.from('referral_claims').insert({
        referrer_id: referrerId,
        referred_id: user.id,
        referral_code: code
      });
    } catch (trackingError) {
      console.warn('[referral.claim] unable to persist referral claim', trackingError);
    }

    return NextResponse.json({
      message: 'Récompense appliquée !',
      reward: REFERRAL_REWARD_BONUS
    });
  } catch (apiError) {
    console.error('[referral.claim] error', apiError);
    return NextResponse.json(
      { message: 'Impossible de traiter la récompense de parrainage.' },
      { status: 500 }
    );
  }
}

