export const TERMS_OF_SERVICE_VERSION = '1.0';
export const PRIVACY_POLICY_VERSION = '1.0';

export const TERMS_OF_SERVICE_EFFECTIVE_DATE = '2026-03-15';
export const PRIVACY_POLICY_EFFECTIVE_DATE = '2026-03-15';

export type PolicyType = 'terms_of_service' | 'privacy_policy';

export interface PolicyVersionStatus {
  current_version: string;
  accepted_version: string | null;
}

export interface ConsentPolicySummary {
  terms_of_service: PolicyVersionStatus;
  privacy_policy: PolicyVersionStatus;
}

export interface ConsentCheckResponse {
  needs_reconsent: boolean;
  policies: ConsentPolicySummary;
}

export interface AcceptedPolicyVersions {
  termsOfService: string | null;
  privacyPolicy: string | null;
}

function toMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getCurrentPolicyVersions(): Record<PolicyType, string> {
  return {
    terms_of_service: TERMS_OF_SERVICE_VERSION,
    privacy_policy: PRIVACY_POLICY_VERSION,
  };
}

export function readAcceptedPolicyVersions(metadata: unknown): AcceptedPolicyVersions {
  const metadataRecord = toMetadataRecord(metadata);

  return {
    termsOfService: readMetadataString(metadataRecord, 'terms_version'),
    privacyPolicy: readMetadataString(metadataRecord, 'privacy_version'),
  };
}

export function buildConsentSummary(
  acceptedVersions: AcceptedPolicyVersions
): ConsentPolicySummary {
  const currentVersions = getCurrentPolicyVersions();

  return {
    terms_of_service: {
      current_version: currentVersions.terms_of_service,
      accepted_version: acceptedVersions.termsOfService,
    },
    privacy_policy: {
      current_version: currentVersions.privacy_policy,
      accepted_version: acceptedVersions.privacyPolicy,
    },
  };
}

export function needsReconsent(policies: ConsentPolicySummary): boolean {
  return (
    policies.terms_of_service.accepted_version !== policies.terms_of_service.current_version ||
    policies.privacy_policy.accepted_version !== policies.privacy_policy.current_version
  );
}
