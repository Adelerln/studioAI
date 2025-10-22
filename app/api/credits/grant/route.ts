import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { addCredits } from '@/services/credits';
import { isAdminUser } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GrantPayload {
  userId?: string;
  amount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as GrantPayload;
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    if (!user || !isAdminUser(user)) {
      return NextResponse.json({ message: 'Admin privileges required.' }, { status: 403 });
    }

    const targetUserId = payload.userId?.trim();
    const amount = Number(payload.amount ?? 0);

    if (!targetUserId) {
      return NextResponse.json({ message: 'A user identifier is required.' }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: 'Amount must be a positive number.' }, { status: 400 });
    }

    const balance = await addCredits(targetUserId, amount);

    return NextResponse.json({ balance });
  } catch (error) {
    console.error('[credits.grant] error', error);
    return NextResponse.json({ message: 'Unable to grant credits.' }, { status: 500 });
  }
}
