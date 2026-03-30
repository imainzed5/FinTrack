import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  AUTH_SESSION_COOKIE_NAME,
  ensureTrackedSession,
  getAuthSessionCookieOptions,
  getExpiredAuthSessionCookieOptions,
  USER_AUTH_SESSION_SELECT,
  type SessionDeviceType,
  type UserAuthSessionRow,
} from '@/lib/auth-session-tracking';
import {
  parseRememberMeCookie,
  REMEMBER_ME_COOKIE_NAME,
} from '@/lib/supabase/auth-state';
import {
  deriveSupabaseUserDisplayName,
  readSupabaseUserMetadataDisplayName,
} from '@/lib/supabase/user-profile';
import { isAuthRequiredError, requireSupabaseUser } from '@/lib/supabase/server';

interface PublicSessionRecord {
  id: string;
  deviceType: SessionDeviceType;
  deviceLabel: string;
  browser: string;
  os: string;
  ipAddress: string | null;
  signedInAt: string;
  lastActiveAt: string;
  current: boolean;
}

interface LoginActivityRecord {
  id: string;
  timestamp: string;
  deviceLabel: string;
  browser: string;
  os: string;
  ipAddress: string | null;
}

function mapSession(row: UserAuthSessionRow, currentSessionToken: string | null): PublicSessionRecord {
  return {
    id: row.id,
    deviceType: row.device_type,
    deviceLabel: row.device_label,
    browser: row.browser,
    os: row.os,
    ipAddress: row.ip_address,
    signedInAt: row.signed_in_at,
    lastActiveAt: row.last_active_at,
    current: currentSessionToken ? row.session_token === currentSessionToken : false,
  };
}

function mapLoginActivity(row: UserAuthSessionRow): LoginActivityRecord {
  return {
    id: row.id,
    timestamp: row.signed_in_at,
    deviceLabel: row.device_label,
    browser: row.browser,
    os: row.os,
    ipAddress: row.ip_address,
  };
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const rememberMe = parseRememberMeCookie(cookieStore.get(REMEMBER_ME_COOKIE_NAME)?.value);
  const existingTrackedSessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;

  try {
    const { supabase, user } = await requireSupabaseUser();

    let trackedSession: {
      sessionToken: string;
      shouldSetCookie: boolean;
      currentSessionId: string | null;
      revoked: boolean;
      trackingAvailable: boolean;
    } = {
      sessionToken: existingTrackedSessionToken ?? '',
      shouldSetCookie: false,
      currentSessionId: null,
      revoked: false,
      trackingAvailable: false,
    };

    try {
      trackedSession = await ensureTrackedSession({
        supabase,
        userId: user.id,
        headers: request.headers,
        sessionToken: existingTrackedSessionToken,
      });
    } catch {
      trackedSession = {
        sessionToken: existingTrackedSessionToken ?? '',
        shouldSetCookie: false,
        currentSessionId: null,
        revoked: false,
        trackingAvailable: false,
      };
    }

    if (trackedSession.trackingAvailable && trackedSession.revoked) {
      await supabase.auth.signOut();

      const response = NextResponse.json(
        { success: false, error: 'Session is no longer active. Please sign in again.' },
        { status: 401 }
      );
      response.cookies.set(REMEMBER_ME_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      response.cookies.set(
        AUTH_SESSION_COOKIE_NAME,
        '',
        getExpiredAuthSessionCookieOptions()
      );
      return response;
    }

    let fullName = readSupabaseUserMetadataDisplayName(user.user_metadata) ?? '';

    if (!fullName) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

      fullName = deriveSupabaseUserDisplayName(
        user,
        profile && typeof profile.display_name === 'string' ? profile.display_name : null
      );
    }

    let rows: UserAuthSessionRow[] = [];

    if (trackedSession.trackingAvailable) {
      const { data: sessionsRows, error: sessionsError } = await supabase
        .from('user_auth_sessions')
        .select(USER_AUTH_SESSION_SELECT)
        .eq('user_id', user.id)
        .order('last_active_at', { ascending: false });

      if (sessionsError) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to load sessions: ${sessionsError.message}`,
          },
          { status: 500 }
        );
      }

      rows = Array.isArray(sessionsRows) ? (sessionsRows as UserAuthSessionRow[]) : [];
    }

    const currentSessionToken = trackedSession.trackingAvailable
      ? trackedSession.sessionToken
      : existingTrackedSessionToken || null;

    const activeSessions = rows
      .filter((row) => row.ended_at === null && row.revoked_at === null)
      .map((row) => mapSession(row, currentSessionToken));

    const currentSession = activeSessions.find((session) => session.current) ?? null;

    const loginActivities = [...rows]
      .sort((a, b) => {
        const left = Date.parse(a.signed_in_at);
        const right = Date.parse(b.signed_in_at);
        return right - left;
      })
      .slice(0, 5)
      .map(mapLoginActivity);

    const response = NextResponse.json(
      {
        success: true,
        account: {
          userId: user.id,
          email: user.email ?? '',
          fullName,
          createdAt: typeof user.created_at === 'string' ? user.created_at : new Date().toISOString(),
          lastLoginAt: typeof user.last_sign_in_at === 'string' ? user.last_sign_in_at : null,
        },
        currentSession,
        activeSessions,
        loginActivities,
      },
      { status: 200 }
    );

    if (trackedSession.trackingAvailable && trackedSession.shouldSetCookie) {
      response.cookies.set(
        AUTH_SESSION_COOKIE_NAME,
        trackedSession.sessionToken,
        getAuthSessionCookieOptions(rememberMe)
      );
    }

    return response;
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to load account sessions.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
