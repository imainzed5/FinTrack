import { NextRequest, NextResponse } from 'next/server';
import { getCloudSnapshot, saveCloudSnapshot } from '@/lib/cloud-sync-server';
import { isLocalAppSnapshot } from '@/lib/local-first';
import { isAuthRequiredError } from '@/lib/supabase/server';

export async function GET() {
  try {
    const snapshot = await getCloudSnapshot();
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to load cloud backup.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!isLocalAppSnapshot(body)) {
    return NextResponse.json({ error: 'Invalid device snapshot payload.' }, { status: 400 });
  }

  try {
    await saveCloudSnapshot(body);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to save cloud backup.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}