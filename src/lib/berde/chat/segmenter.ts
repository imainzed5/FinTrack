import { CONNECTORS } from '@/lib/berde/chat/config';
import { normalizeWhitespace } from '@/lib/berde/chat/normalize';

function looksLikeStandaloneSegment(value: string): boolean {
  return /\d/.test(value) || /\b(spent|salary|received|transfer|save|deposit|withdraw|lent|borrowed|paid me back|kumain|nag|mrt|lrt|fare|pamasahe|load)\b/i.test(value);
}

function getAmountAnchors(value: string): number[] {
  const anchors: number[] = [];
  const amountPattern = /(?:^|[\s(])(?:\u20b1|php|p)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*k)?(?:\s*lang)?(?=$|[\s,!.?])/gi;

  for (const match of value.matchAll(amountPattern)) {
    if (match.index === undefined) {
      continue;
    }

    const token = match[0] ?? '';
    const offset = token.search(/(?:\u20b1|php|p)?\s*\d/i);
    anchors.push(match.index + Math.max(offset, 0));
  }

  return anchors;
}

function looksLikeDenseAmountSegment(value: string): boolean {
  if (!looksLikeStandaloneSegment(value)) {
    return false;
  }

  const tokens = value.split(/\s+/).filter(Boolean);
  const nonNumericTokens = tokens.filter((token) => !/^(?:\u20b1|php|p)?\d/i.test(token));
  return nonNumericTokens.length > 0;
}

function splitDenseAmountSequence(part: string): string[] {
  const anchors = getAmountAnchors(part);
  if (anchors.length < 2) {
    return [part];
  }

  const segments: string[] = [];
  let start = 0;

  for (let index = 1; index < anchors.length; index += 1) {
    const candidate = normalizeWhitespace(part.slice(start, anchors[index]));
    if (candidate) {
      segments.push(candidate);
    }
    start = anchors[index];
  }

  const tail = normalizeWhitespace(part.slice(start));
  if (tail) {
    segments.push(tail);
  }

  if (
    segments.length < 2
    || !segments.every((segment) => looksLikeDenseAmountSegment(segment))
    || !segments.every((segment) => getAmountAnchors(segment).length === 1)
  ) {
    return [part];
  }

  return segments;
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
      segments.push(...splitDenseAmountSequence(part));
    }
  }

  return segments;
}
