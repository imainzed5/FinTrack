export type AuthPagePath = '/auth/login' | '/auth/signup';

export function normalizeRedirectTarget(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/')) {
    return null;
  }

  if (value.startsWith('//')) {
    return null;
  }

  return value;
}

export function buildAuthPagePath(
  path: AuthPagePath,
  options: {
    next?: string | null;
    oauthError?: string | null;
  } = {}
): string {
  const url = new URL(path, 'http://localhost');
  const redirectTarget = normalizeRedirectTarget(options.next);

  if (redirectTarget) {
    url.searchParams.set('next', redirectTarget);
  }

  if (options.oauthError) {
    url.searchParams.set('oauthError', options.oauthError);
  }

  return `${url.pathname}${url.search}`;
}

export function getOAuthErrorMessage(errorCode: string | null | undefined): string {
  switch (errorCode) {
    case 'oauth_access_denied':
      return 'Google sign-in was canceled before completion.';
    case 'oauth_init_failed':
      return 'Unable to connect to Google right now. Please try again.';
    case 'oauth_callback_missing_code':
    case 'oauth_callback_failed':
    case 'oauth_provider_error':
      return 'We could not finish Google sign-in. Please try again.';
    default:
      return '';
  }
}