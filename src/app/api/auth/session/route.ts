import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { AuthSessionResponse } from '@/lib/auth-contract';
import {
  AUTH_SESSION_COOKIE_NAME,
  ensureTrackedSession,
  getAuthSessionCookieOptions,
  getExpiredAuthSessionCookieOptions,
} from '@/lib/auth-session-tracking';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  parseRememberMeCookie,
  REMEMBER_ME_COOKIE_NAME,
} from '@/lib/supabase/auth-state';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const rememberMe = parseRememberMeCookie(cookieStore.get(REMEMBER_ME_COOKIE_NAME)?.value);
  const existingTrackedSessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    const response: AuthSessionResponse = {
      authenticated: false,
      rememberMe,
      user: null,
    };
    return NextResponse.json(response, { status: 200 });
  }

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

    const revokedResponse: AuthSessionResponse = {
      authenticated: false,
      rememberMe,
      user: null,
    };

    const nextResponse = NextResponse.json(revokedResponse, { status: 200 });
    nextResponse.cookies.set(REMEMBER_ME_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    nextResponse.cookies.set(
      AUTH_SESSION_COOKIE_NAME,
      '',
      getExpiredAuthSessionCookieOptions()
    );
    return nextResponse;
  }

  let fullName = '';
  const metadataName = user.user_metadata?.full_name;
  if (typeof metadataName === 'string' && metadataName.trim().length > 0) {
    fullName = metadataName.trim();
  }

  if (!fullName) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profile && typeof profile.display_name === 'string') {
      fullName = profile.display_name;
    }
  }

  const response: AuthSessionResponse = {
    authenticated: true,
    rememberMe,
    user: {
      id: user.id,
      email: user.email,
      fullName,
    },
  };

  const nextResponse = NextResponse.json(response, { status: 200 });

  if (trackedSession.trackingAvailable && trackedSession.shouldSetCookie) {
    nextResponse.cookies.set(
      AUTH_SESSION_COOKIE_NAME,
      trackedSession.sessionToken,
      getAuthSessionCookieOptions(rememberMe)
    );
  }

  return nextResponse;
}
