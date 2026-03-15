import { NextRequest, NextResponse } from 'next/server';
import type { AuthApiResponse } from '@/lib/auth-contract';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/lib/auth-contract';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/supabase/config';

interface ForgotPasswordPayload {
  email: string;
}

function parseForgotPasswordPayload(body: unknown): ForgotPasswordPayload {
  if (!body || typeof body !== 'object') {
    return { email: '' };
  }

  const value = body as Record<string, unknown>;
  return {
    email: typeof value.email === 'string' ? normalizeEmailAddress(value.email) : '',
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

  const payload = parseForgotPasswordPayload(body);
  if (!payload.email) {
    const response: AuthApiResponse = {
      success: false,
      error: 'Email is required.',
      fieldErrors: {
        email: 'Email is required.',
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  if (!isValidEmailAddress(payload.email)) {
    const response: AuthApiResponse = {
      success: false,
      error: 'Enter a valid email address.',
      fieldErrors: {
        email: 'Enter a valid email address.',
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = `${getSiteUrl(request.nextUrl.origin)}/auth/login?reset=1`;

  const { error } = await supabase.auth.resetPasswordForEmail(payload.email, {
    redirectTo,
  });

  if (error) {
    const response: AuthApiResponse = {
      success: false,
      error: error.message,
    };
    return NextResponse.json(response, { status: 400 });
  }

  const response: AuthApiResponse = {
    success: true,
    message: 'If an account exists for this email, a password reset link has been sent.',
  };

  return NextResponse.json(response, { status: 200 });
}
