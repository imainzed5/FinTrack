import { NextRequest, NextResponse } from 'next/server';
import { buildAuthPagePath, normalizeRedirectTarget } from '@/lib/auth-redirect';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AuthSource = 'login' | 'signup';

const DEFAULT_APP_ROUTE = '/dashboard';

function normalizeAuthSource(value: string | null): AuthSource {
  return value === 'signup' ? 'signup' : 'login';
}

function getAuthSourcePath(source: AuthSource): '/auth/login' | '/auth/signup' {
  return source === 'signup' ? '/auth/signup' : '/auth/login';
}

function redirectToAuthPage(
  request: NextRequest,
  source: AuthSource,
  oauthError: string
): NextResponse {
  const redirectPath = buildAuthPagePath(getAuthSourcePath(source), {
    next: request.nextUrl.searchParams.get('next'),
    oauthError,
  });

  return NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin));
}

export async function GET(request: NextRequest) {
  const source = normalizeAuthSource(request.nextUrl.searchParams.get('source'));
  const providerError = request.nextUrl.searchParams.get('error');
  const code = request.nextUrl.searchParams.get('code');

  if (providerError) {
    return redirectToAuthPage(
      request,
      source,
      providerError === 'access_denied' ? 'oauth_access_denied' : 'oauth_provider_error'
    );
  }

  if (!code) {
    return redirectToAuthPage(request, source, 'oauth_callback_missing_code');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToAuthPage(request, source, 'oauth_callback_failed');
  }

  const redirectTarget =
    normalizeRedirectTarget(request.nextUrl.searchParams.get('next')) || DEFAULT_APP_ROUTE;

  return NextResponse.redirect(new URL(redirectTarget, request.nextUrl.origin));
}