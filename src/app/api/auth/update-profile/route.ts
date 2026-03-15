import { NextRequest, NextResponse } from 'next/server';
import { isAuthRequiredError, requireSupabaseUser } from '@/lib/supabase/server';

interface UpdateProfilePayload {
  fullName: string;
}

interface UpdateProfileFieldErrors {
  fullName?: string;
}

function parsePayload(body: unknown): UpdateProfilePayload {
  if (!body || typeof body !== 'object') {
    return { fullName: '' };
  }

  const value = body as Record<string, unknown>;
  return {
    fullName: typeof value.fullName === 'string' ? value.fullName.trim() : '',
  };
}

function validateFullName(fullName: string): UpdateProfileFieldErrors {
  if (!fullName) {
    return { fullName: 'Full name is required.' };
  }

  if (fullName.length > 50) {
    return { fullName: 'Full name must be 50 characters or fewer.' };
  }

  return {};
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const payload = parsePayload(body);
  const fieldErrors = validateFullName(payload.fullName);
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

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: payload.fullName })
      .eq('id', user.id);

    if (profileError) {
      return NextResponse.json(
        { success: false, error: `Failed to update profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    const { error: authMetadataError } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata ?? {}),
        full_name: payload.fullName,
      },
    });

    if (authMetadataError) {
      return NextResponse.json(
        {
          success: false,
          error: `Profile was updated, but account metadata sync failed: ${authMetadataError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Profile updated successfully.',
        user: {
          id: user.id,
          email: user.email ?? '',
          fullName: payload.fullName,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to update profile.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
