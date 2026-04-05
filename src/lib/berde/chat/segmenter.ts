import { CONNECTORS } from '@/lib/berde/chat/config';
import { normalizeWhitespace } from '@/lib/berde/chat/normalize';

function looksLikeStandaloneSegment(value: string): boolean {
  return /\d/.test(value) || /\b(spent|salary|received|transfer|save|deposit|withdraw|lent|borrowed|paid me back|kumain|nag|mrt|lrt|fare|pamasahe|load)\b/i.test(value);
}

export function splitCompositeMessage(message: string): string[] {
  const topLevelParts = normalizeWhitespace(message)
    .split(CONNECTORS)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  const segments: string[] = [];

  for (const part of topLevelParts) {
    const andParts = part
      .split(/\s+(?:and|tapos|plus|&)\s+/i)
      .map((entry) => normalizeWhitespace(entry))
      .filter(Boolean);
    if (andParts.length > 1 && andParts.every(looksLikeStandaloneSegment)) {
      segments.push(...andParts);
    } else {
      segments.push(part);
    }
  }

  return segments;
}
