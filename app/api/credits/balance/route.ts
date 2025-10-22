import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getCreditBalance } from '@/services/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    const balance = await getCreditBalance(user.id);
    return NextResponse.json({ balance });
  } catch (error) {
    console.error('[credits.balance] error', error);
    return NextResponse.json({ message: 'Unable to retrieve credit balance.' }, { status: 500 });
  }
}
