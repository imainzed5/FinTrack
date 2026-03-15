import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_SESSION_COOKIE_NAME } from '@/lib/auth-session-tracking';
import { isAuthRequiredError, requireSupabaseUser } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params;
  if (!sessionId || sessionId.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Session id is required.' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const currentSessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;

  try {
    const { supabase, user } = await requireSupabaseUser();

    const { data: targetSession, error: targetSessionError } = await supabase
      .from('user_auth_sessions')
      .select('id, session_token, ended_at, revoked_at')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (targetSessionError) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to load session: ${targetSessionError.message}`,
        },
        { status: 500 }
      );
    }

    if (!targetSession) {
      return NextResponse.json(
        { success: false, error: 'Session not found.' },
        { status: 404 }
      );
    }

    if (
      currentSessionToken &&
      typeof targetSession.session_token === 'string' &&
      targetSession.session_token === currentSessionToken
    ) {
      return NextResponse.json(
        { success: false, error: 'Use normal logout to end your current session.' },
        { status: 400 }
      );
    }

    if (targetSession.ended_at || targetSession.revoked_at) {
      return NextResponse.json(
        { success: false, error: 'This session is already inactive.' },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    const { error: revokeError } = await supabase
      .from('user_auth_sessions')
      .update({
        revoked_at: nowIso,
        revoked_reason: 'manual_revoke',
        last_active_at: nowIso,
      })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (revokeError) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to revoke session: ${revokeError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Session revoked successfully.',
      },
      { status: 200 }
    );
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to revoke session.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
