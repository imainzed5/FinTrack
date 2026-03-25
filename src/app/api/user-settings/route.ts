import { NextRequest, NextResponse } from 'next/server';
import { isAuthRequiredError, requireSupabaseUser } from '@/lib/supabase/server';

export interface UserSettings {
  next_payday: string | null; // ISO date string YYYY-MM-DD
}

export async function GET() {
  try {
    const { supabase, user } = await requireSupabaseUser();

    const { data, error } = await supabase
      .from('profiles')
      .select('next_payday')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings: UserSettings = {
      next_payday: (data as Record<string, unknown> | null)?.next_payday as string | null ?? null,
    };

    return NextResponse.json(settings);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const updates: Partial<Record<string, unknown>> = {};

  if ('next_payday' in payload) {
    const val = payload.next_payday;
    if (val === null || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val))) {
      updates.next_payday = val;
    } else {
      return NextResponse.json({ error: 'next_payday must be a YYYY-MM-DD date or null.' }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  try {
    const { supabase, user } = await requireSupabaseUser();

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Failed to update settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
