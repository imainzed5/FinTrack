import { NextRequest, NextResponse } from 'next/server';
import { isAuthRequiredError, requireSupabaseUser } from '@/lib/supabase/server';

interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ChangePasswordFieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

const passwordChangeAttempts = new Map<string, number[]>();

function parsePayload(body: unknown): ChangePasswordPayload {
  if (!body || typeof body !== 'object') {
    return {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };
  }

  const value = body as Record<string, unknown>;
  return {
    currentPassword: typeof value.currentPassword === 'string' ? value.currentPassword : '',
    newPassword: typeof value.newPassword === 'string' ? value.newPassword : '',
    confirmPassword: typeof value.confirmPassword === 'string' ? value.confirmPassword : '',
  };
}

function hasUppercase(value: string): boolean {
  return /[A-Z]/.test(value);
}

function hasNumber(value: string): boolean {
  return /[0-9]/.test(value);
}

function hasSpecial(value: string): boolean {
  return /[^A-Za-z0-9]/.test(value);
}

function validatePayload(payload: ChangePasswordPayload): ChangePasswordFieldErrors {
  const errors: ChangePasswordFieldErrors = {};

  if (!payload.currentPassword) {
    errors.currentPassword = 'Current password is required.';
  }

  if (!payload.newPassword) {
    errors.newPassword = 'New password is required.';
  } else {
    if (payload.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters.';
    } else if (!hasUppercase(payload.newPassword)) {
      errors.newPassword = 'Password must include at least one uppercase letter.';
    } else if (!hasNumber(payload.newPassword)) {
      errors.newPassword = 'Password must include at least one number.';
    } else if (!hasSpecial(payload.newPassword)) {
      errors.newPassword = 'Password must include at least one special character.';
    }
  }

  if (!payload.confirmPassword) {
    errors.confirmPassword = 'Confirm your new password.';
  } else if (payload.confirmPassword !== payload.newPassword) {
    errors.confirmPassword = 'New passwords do not match.';
  }

  if (
    payload.currentPassword &&
    payload.newPassword &&
    payload.currentPassword === payload.newPassword
  ) {
    errors.newPassword = 'New password must be different from your current password.';
  }

  return errors;
}

function pruneAttempts(timestamps: number[]): number[] {
  const now = Date.now();
  return timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
}

function getRateLimitStatus(userId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const current = pruneAttempts(passwordChangeAttempts.get(userId) ?? []);
  passwordChangeAttempts.set(userId, current);

  if (current.length < RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  const oldest = current[0];
  const retryMs = RATE_LIMIT_WINDOW_MS - (Date.now() - oldest);
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
  };
}

function registerFailedAttempt(userId: string): void {
  const current = pruneAttempts(passwordChangeAttempts.get(userId) ?? []);
  current.push(Date.now());
  passwordChangeAttempts.set(userId, current);
}

function clearAttempts(userId: string): void {
  passwordChangeAttempts.delete(userId);
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const payload = parsePayload(body);
  const fieldErrors = validatePayload(payload);
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Please fix the highlighted fields.',
        fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const { supabase, user } = await requireSupabaseUser();

    const rateLimitStatus = getRateLimitStatus(user.id);
    if (!rateLimitStatus.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many password change attempts. Please try again in ${rateLimitStatus.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitStatus.retryAfterSeconds),
          },
        }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Your account is missing an email address. Please contact support.',
        },
        { status: 400 }
      );
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: payload.currentPassword,
    });

    if (verifyError) {
      registerFailedAttempt(user.id);
      return NextResponse.json(
        {
          success: false,
          error: 'Current password is incorrect.',
          fieldErrors: {
            currentPassword: 'Current password is incorrect.',
          },
        },
        { status: 401 }
      );
    }

    const { error: updatePasswordError } = await supabase.auth.updateUser({
      password: payload.newPassword,
    });

    if (updatePasswordError) {
      registerFailedAttempt(user.id);
      return NextResponse.json(
        {
          success: false,
          error: `Unable to change password: ${updatePasswordError.message}`,
        },
        { status: 400 }
      );
    }

    clearAttempts(user.id);

    return NextResponse.json(
      {
        success: true,
        message: 'Password changed successfully. For security, consider signing out and logging in again.',
      },
      { status: 200 }
    );
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to change password.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
