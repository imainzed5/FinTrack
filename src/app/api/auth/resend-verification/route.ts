import { NextRequest, NextResponse } from 'next/server';
import type { AuthApiResponse } from '@/lib/auth-contract';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/lib/auth-contract';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface ResendVerificationPayload {
  email: string;
}

function parseResendPayload(body: unknown): ResendVerificationPayload {
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

  const payload = parseResendPayload(body);
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

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: payload.email,
  });

  if (error) {
    const lowerMessage = error.message.toLowerCase();
    const errorCode = typeof error.code === 'string' ? error.code.toLowerCase() : '';

    if (lowerMessage.includes('error sending confirmation email')) {
      const response: AuthApiResponse = {
        success: false,
        error:
          'Verification email delivery is currently failing in Supabase. Check the Auth email provider or SMTP settings before retrying.',
      };
      return NextResponse.json(response, { status: 503 });
    }

    if (
      errorCode === 'over_email_send_rate_limit' ||
      lowerMessage.includes('email rate limit exceeded') ||
      lowerMessage.includes('over_email_send_rate_limit')
    ) {
      const response: AuthApiResponse = {
        success: false,
        error:
          'Too many verification emails were sent recently. Please wait a few minutes and try again.',
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

    const response: AuthApiResponse = {
      success: false,
      error: error.message,
    };
    return NextResponse.json(response, { status: 400 });
  }

  const response: AuthApiResponse = {
    success: true,
    message: 'Verification email sent. Please check your inbox.',
  };

  return NextResponse.json(response, { status: 200 });
}
