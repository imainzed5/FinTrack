import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { AuthApiResponse } from '@/lib/auth-contract';
import {
  AUTH_SESSION_COOKIE_NAME,
  getExpiredAuthSessionCookieOptions,
  markCurrentTrackedSessionEnded,
} from '@/lib/auth-session-tracking';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { REMEMBER_ME_COOKIE_NAME } from '@/lib/supabase/auth-state';

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    try {
      await markCurrentTrackedSessionEnded({
        supabase,
        userId: user.id,
        sessionToken,
      });
    } catch {
      // Session tracking close should not block sign-out.
    }
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    const response: AuthApiResponse = {
      success: false,
      error: error.message,
    };
    return NextResponse.json(response, { status: 400 });
  }

  const response: AuthApiResponse = {
    success: true,
    message: 'Signed out successfully.',
    redirectTo: '/auth/login',
  };

  const nextResponse = NextResponse.json(response, { status: 200 });
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
