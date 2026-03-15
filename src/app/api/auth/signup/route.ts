import { NextRequest, NextResponse } from 'next/server';
import type { AuthApiResponse, SignupPayload } from '@/lib/auth-contract';
import {
  normalizeEmailAddress,
  validateSignupPayload,
} from '@/lib/auth-contract';
import {
  PRIVACY_POLICY_VERSION,
  TERMS_OF_SERVICE_VERSION,
} from '@/lib/policy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/supabase/config';

function parseSignupPayload(body: unknown): SignupPayload {
  if (!body || typeof body !== 'object') {
    return {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
    };
  }

  const value = body as Record<string, unknown>;

  return {
    fullName: typeof value.fullName === 'string' ? value.fullName.trim() : '',
    email:
      typeof value.email === 'string' ? normalizeEmailAddress(value.email) : '',
    password: typeof value.password === 'string' ? value.password : '',
    confirmPassword:
      typeof value.confirmPassword === 'string' ? value.confirmPassword : '',
    acceptedTerms: value.acceptedTerms === true,
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

  const payload = parseSignupPayload(body);
  const fieldErrors = validateSignupPayload(payload);

  if (Object.keys(fieldErrors).length > 0) {
    const response: AuthApiResponse = {
      success: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors,
    };
    return NextResponse.json(response, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const emailRedirectTo = `${getSiteUrl(request.nextUrl.origin)}/auth/login`;
  const acceptedAt = new Date().toISOString();

  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      emailRedirectTo,
      data: {
        full_name: payload.fullName,
        accepted_terms_at: acceptedAt,
        terms_version: TERMS_OF_SERVICE_VERSION,
        accepted_privacy_at: acceptedAt,
        privacy_version: PRIVACY_POLICY_VERSION,
      },
    },
  });

  if (error) {
    const lowerMessage = error.message.toLowerCase();
    const errorCode = typeof error.code === 'string' ? error.code.toLowerCase() : '';

    if (
      errorCode === 'over_email_send_rate_limit' ||
      lowerMessage.includes('email rate limit exceeded') ||
      lowerMessage.includes('over_email_send_rate_limit')
    ) {
      const response: AuthApiResponse = {
        success: false,
        error:
          'Too many verification emails were sent recently. Please wait a few minutes and try again. If you already signed up, use Sign in or Forgot password.',
        fieldErrors: {
          email: 'Verification email rate limit reached. Please retry shortly.',
        },
      };
      return NextResponse.json(response, {
        status: 429,
        headers: {
          'Retry-After': '60',
        },
      });
    }

    if (lowerMessage.includes('already registered')) {
      const response: AuthApiResponse = {
        success: false,
        error: 'An account with this email already exists.',
        fieldErrors: {
          email: 'Use a different email or sign in with this account.',
        },
      };
      return NextResponse.json(response, { status: 409 });
    }

    const response: AuthApiResponse = {
      success: false,
      error: error.message,
    };
    return NextResponse.json(response, { status: 400 });
  }

  if (data.user?.id) {
    await supabase
      .from('profiles')
      .update({ display_name: payload.fullName })
      .eq('id', data.user.id);
  }

  const requiresEmailVerification = !data.session;

  const response: AuthApiResponse = {
    success: true,
    message: requiresEmailVerification
      ? 'Account created. Please verify your email before signing in.'
      : 'Account created successfully. You can now sign in.',
    requiresEmailVerification,
    redirectTo: '/auth/login',
  };

  return NextResponse.json(response, { status: 201 });
}
