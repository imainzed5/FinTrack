import { NextResponse } from 'next/server';
import type { AuthApiResponse } from '@/lib/auth-contract';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { REMEMBER_ME_COOKIE_NAME } from '@/lib/supabase/auth-state';

export async function POST() {
  const supabase = await createSupabaseServerClient();
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

  return nextResponse;
}
