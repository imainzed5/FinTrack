import { NextRequest, NextResponse } from 'next/server';
import type { AuthApiResponse, LoginPayload } from '@/lib/auth-contract';
import {
  normalizeEmailAddress,
  validateLoginPayload,
} from '@/lib/auth-contract';
import {
  AUTH_SESSION_COOKIE_NAME,
  ensureTrackedSession,
  getAuthSessionCookieOptions,
} from '@/lib/auth-session-tracking';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  REMEMBER_ME_COOKIE_MAX_AGE_SECONDS,
  REMEMBER_ME_COOKIE_NAME,
} from '@/lib/supabase/auth-state';

function parseLoginPayload(body: unknown): LoginPayload {
  if (!body || typeof body !== 'object') {
    return { email: '', password: '', rememberMe: false };
  }

  const value = body as Record<string, unknown>;

  return {
    email:
      typeof value.email === 'string' ? normalizeEmailAddress(value.email) : '',
    password: typeof value.password === 'string' ? value.password : '',
    rememberMe: value.rememberMe === true,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    const response: AuthApiResponse = {
      success: false,
      error: 'Invalid JSON payload.',
    };
    return NextResponse.json(response, { status: 400 });
  }

  const payload = parseLoginPayload(body);
  const fieldErrors = validateLoginPayload(payload);

  if (Object.keys(fieldErrors).length > 0) {
    const response: AuthApiResponse = {
      success: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors,
    };
    return NextResponse.json(response, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('invalid login credentials')) {
      const response: AuthApiResponse = {
        success: false,
        error: 'Invalid email or password.',
        fieldErrors: {
          email: 'Invalid email or password.',
          password: 'Invalid email or password.',
        },
      };
      return NextResponse.json(response, { status: 401 });
    }

    if (message.includes('email not confirmed')) {
      const response: AuthApiResponse = {
        success: false,
        error: 'Email is not verified yet. Check your inbox and confirm your account first.',
        fieldErrors: {
          email: 'Please verify this email address before signing in.',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const response: AuthApiResponse = {
      success: false,
      error: error.message,
    };
    return NextResponse.json(response, { status: 400 });
  }

  const response: AuthApiResponse = {
    success: true,
    message: payload.rememberMe
      ? 'Signed in. Your trusted session has been extended.'
      : 'Signed in successfully.',
    redirectTo: '/dashboard',
  };

  const nextResponse = NextResponse.json(response, { status: 200 });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    try {
      const trackedSession = await ensureTrackedSession({
        supabase,
        userId: user.id,
        headers: request.headers,
      });

      if (trackedSession.trackingAvailable) {
        nextResponse.cookies.set(
          AUTH_SESSION_COOKIE_NAME,
          trackedSession.sessionToken,
          getAuthSessionCookieOptions(payload.rememberMe)
        );
      }
    } catch {
      // Session tracking is best-effort and should not block sign-in.
    }
  }

  nextResponse.cookies.set(REMEMBER_ME_COOKIE_NAME, payload.rememberMe ? '1' : '0', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(payload.rememberMe ? { maxAge: REMEMBER_ME_COOKIE_MAX_AGE_SECONDS } : {}),
  });

  return nextResponse;
}
