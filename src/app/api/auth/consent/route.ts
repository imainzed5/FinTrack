import { NextRequest, NextResponse } from 'next/server';
import type { ConsentCheckResponse, PolicyType } from '@/lib/policy';
import {
  buildConsentSummary,
  getCurrentPolicyVersions,
  readAcceptedPolicyVersions,
} from '@/lib/policy';
import { isAuthRequiredError, requireSupabaseUser } from '@/lib/supabase/server';

interface ConsentUpdatePayload {
  acceptedLatestPolicies: boolean;
}

interface ConsentLogInsertRow {
  user_id: string;
  policy_type: PolicyType;
  version: string;
  accepted_at: string;
  user_agent: string | null;
  source: string;
}

const RECONSENT_SOURCE = 'reconsent';
const MAX_USER_AGENT_LENGTH = 500;

function parseConsentUpdatePayload(body: unknown): ConsentUpdatePayload {
  if (!body || typeof body !== 'object') {
    return { acceptedLatestPolicies: false };
  }

  const value = body as Record<string, unknown>;
  return {
    acceptedLatestPolicies: value.acceptedLatestPolicies === true,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const payload = parseConsentUpdatePayload(body);
  if (!payload.acceptedLatestPolicies) {
    return NextResponse.json(
      { error: 'Latest policy acceptance is required.' },
      { status: 400 }
    );
  }

  try {
    const { supabase, user } = await requireSupabaseUser();
    const currentVersions = getCurrentPolicyVersions();
    const acceptedVersions = readAcceptedPolicyVersions(user.user_metadata);

    const acceptedAt = new Date().toISOString();
    const userAgentHeader = request.headers.get('user-agent');
    const userAgent = userAgentHeader
      ? userAgentHeader.slice(0, MAX_USER_AGENT_LENGTH)
      : null;

    const rows: ConsentLogInsertRow[] = [];

    if (acceptedVersions.termsOfService !== currentVersions.terms_of_service) {
      rows.push({
        user_id: user.id,
        policy_type: 'terms_of_service',
        version: currentVersions.terms_of_service,
        accepted_at: acceptedAt,
        user_agent: userAgent,
        source: RECONSENT_SOURCE,
      });
    }

    if (acceptedVersions.privacyPolicy !== currentVersions.privacy_policy) {
      rows.push({
        user_id: user.id,
        policy_type: 'privacy_policy',
        version: currentVersions.privacy_policy,
        accepted_at: acceptedAt,
        user_agent: userAgent,
        source: RECONSENT_SOURCE,
      });
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('user_consent_log').upsert(rows, {
        onConflict: 'user_id,policy_type,version,source',
      });

      if (insertError) {
        return NextResponse.json(
          { error: `Failed to save consent records: ${insertError.message}` },
          { status: 500 }
        );
      }
    }

    const metadata = {
      ...(user.user_metadata ?? {}),
      accepted_terms_at: acceptedAt,
      terms_version: currentVersions.terms_of_service,
      accepted_privacy_at: acceptedAt,
      privacy_version: currentVersions.privacy_policy,
    };

    const { error: metadataError } = await supabase.auth.updateUser({ data: metadata });
    if (metadataError) {
      return NextResponse.json(
        { error: `Failed to update account consent metadata: ${metadataError.message}` },
        { status: 500 }
      );
    }

    const response: ConsentCheckResponse = {
      needs_reconsent: false,
      policies: buildConsentSummary({
        termsOfService: currentVersions.terms_of_service,
        privacyPolicy: currentVersions.privacy_policy,
      }),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'Failed to update consent.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
