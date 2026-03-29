import { NextResponse } from 'next/server';
import { getCloudSyncStatus } from '@/lib/cloud-sync-server';
import { isAuthRequiredError } from '@/lib/supabase/server';

export async function GET() {
  try {
    const status = await getCloudSyncStatus();
    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to inspect cloud backup.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}