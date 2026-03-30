import type { User } from '@supabase/supabase-js';

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  return metadata as Record<string, unknown>;
}

export function readSupabaseUserMetadataDisplayName(metadata: unknown): string | null {
  const record = readMetadataRecord(metadata);
  const directKeys = ['full_name', 'name', 'user_name', 'preferred_username'];

  for (const key of directKeys) {
    const value = normalizeDisplayName(record[key]);
    if (value) {
      return value;
    }
  }

  const givenName = normalizeDisplayName(record.given_name);
  const familyName = normalizeDisplayName(record.family_name);

  if (givenName && familyName) {
    return `${givenName} ${familyName}`;
  }

  return givenName;
}

export function deriveSupabaseUserDisplayName(
  user: Pick<User, 'email' | 'user_metadata'>,
  profileDisplayName?: string | null
): string {
  const explicitProfileName = normalizeDisplayName(profileDisplayName);
  if (explicitProfileName) {
    return explicitProfileName;
  }

  const metadataName = readSupabaseUserMetadataDisplayName(user.user_metadata);
  if (metadataName) {
    return metadataName;
  }

  if (user.email) {
    const [emailName] = user.email.split('@');
    const normalizedEmailName = normalizeDisplayName(emailName);
    if (normalizedEmailName) {
      return normalizedEmailName;
    }
  }

  return 'Moneda user';
}