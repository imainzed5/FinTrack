import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  AUTH_SESSION_COOKIE_NAME,
  revokeOtherTrackedSessions,
} from '@/lib/auth-session-tracking';
import { isAuthRequiredError, requireSupabaseUser } from '@/lib/supabase/server';

export async function POST() {
  const cookieStore = await cookies();
  const currentSessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;

  try {
    const { supabase, user } = await requireSupabaseUser();

    const revokedCount = await revokeOtherTrackedSessions({
      supabase,
      userId: user.id,
      currentSessionToken,
      reason: 'manual_logout_other_sessions',
    });

    const { error: signOutOthersError } = await supabase.auth.signOut({
      scope: 'others',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Other sessions were signed out successfully.',
        revokedCount,
        warning: signOutOthersError ? signOutOthersError.message : null,
      },
      { status: 200 }
    );
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to sign out other sessions.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
