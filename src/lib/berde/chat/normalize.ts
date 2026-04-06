export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeChatMessage(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\bsa akin\b/gi, ' sakin ')
      .replace(/\bnoong\b/gi, ' nung ')
      .replace(/\bsa'kin\b/gi, ' sakin ')
      .replace(/\bnakabayad\b/gi, ' nagbayad '),
  );
}

export function normalizeForReply(value: string): string {
  return normalizeWhitespace(value.toLowerCase());
}

export function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
