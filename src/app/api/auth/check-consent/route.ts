import { NextResponse } from 'next/server';
import type { ConsentCheckResponse } from '@/lib/policy';
import {
  buildConsentSummary,
  needsReconsent,
  readAcceptedPolicyVersions,
} from '@/lib/policy';
import { isAuthRequiredError, requireSupabaseUser } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { user } = await requireSupabaseUser();
    const acceptedVersions = readAcceptedPolicyVersions(user.user_metadata);
    const policies = buildConsentSummary(acceptedVersions);

    const response: ConsentCheckResponse = {
      needs_reconsent: needsReconsent(policies),
      policies,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : 'Failed to evaluate policy consent.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
