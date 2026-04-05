import { createActionId } from '@/lib/berde/chat/actions';
import { buildDebtChoiceLabel } from '@/lib/berde/chat/intent';
import { buildDateIso, extractAmount, extractDescription } from '@/lib/berde/chat/extractors';
import { escapeRegExp, normalizeForReply, normalizeWhitespace, toTitleCase } from '@/lib/berde/chat/normalize';
import type { BerdeChatParserContext, BerdeParsedAction } from '@/lib/berde/chat.types';
import type { Debt, DebtDirection } from '@/lib/types';

function findDebtCandidatesByPerson(personName: string | undefined, debts: Debt[]): Debt[] {
  if (!personName) {
    return [];
  }

  const normalized = normalizeForReply(personName);
  return debts.filter((debt) => normalizeForReply(debt.personName) === normalized);
}

export function extractPersonFromDebtReply(message: string): string | undefined {
  const normalized = normalizeWhitespace(message);
  if (!normalized) {
    return undefined;
  }

  const cleaned = normalized
    .replace(/^(?:si|kay|ki|ni|from|to)\s+/i, '')
    .replace(/[?.!,]+$/g, '')
    .trim();

  if (!cleaned || /\d/.test(cleaned)) {
    return undefined;
  }

  const normalizedReply = normalizeForReply(cleaned);
  if (['me', 'i', 'ako', 'myself', 'ko'].includes(normalizedReply)) {
    return undefined;
  }

  if (!/^[a-z][a-z\s'.-]*$/i.test(cleaned)) {
    return undefined;
  }

  return toTitleCase(cleaned);
}

function inferDebtMode(
  message: string,
  debts: Debt[],
  existing?: Extract<BerdeParsedAction, { kind: 'debt' }>,
): 'create' | 'settle' | undefined {
  const normalized = normalizeForReply(message);
  if (
    /\b(paid me back|paid back|settle|settled|nagbayad|bayad utang|debt payment)\b/i.test(normalized)
    || /\bpaid\b/i.test(normalized)
  ) {
    return 'settle';
  }

  if (
    /\b(lent|loaned|borrowed|utang|pinahiram|may utang|i owe)\b/i.test(normalized)
    || debts.some((debt) => new RegExp(`(^|\\W)${escapeRegExp(normalizeForReply(debt.personName))}(?=$|\\W)`, 'i').test(normalized))
  ) {
    return 'create';
  }

  return existing?.debtMode;
}

function inferDebtDirection(
  message: string,
  existing?: Extract<BerdeParsedAction, { kind: 'debt' }>,
): { direction?: DebtDirection; source?: 'explicit' | 'inferred' } {
  const normalized = normalizeForReply(message);

  if (
    /\b(they owe me|siya may utang sakin|siya may utang sa akin)\b/i.test(normalized)
    || /\b(?:[a-z][a-z\s'.-]+)\s+may utang sakin\b/i.test(normalized)
    || /\b(?:[a-z][a-z\s'.-]+)\s+may utang sa akin\b/i.test(normalized)
    || /\bmay utang(?:\s+si)?\s+[a-z][a-z\s'.-]+\s+(?:sakin|sa akin)\b/i.test(normalized)
    || /\b(lent|loaned|pinahiram)\b/i.test(normalized)
  ) {
    return { direction: 'owed', source: 'explicit' };
  }

  if (
    /\b(i owe|i owe them|may utang ako|utang ko|borrowed|umutang)\b/i.test(normalized)
    || /\butang\s+(?:kay|ki)\b/i.test(normalized)
    || /\bnagbayad ako kay\b/i.test(normalized)
  ) {
    return { direction: 'owing', source: 'explicit' };
  }

  if (/\bmay utang\b/i.test(normalized) || /\butang\b/i.test(normalized)) {
    return { direction: undefined, source: 'inferred' };
  }

  return {
    direction: existing?.direction,
    source: existing?.directionSource,
  };
}

function extractPersonFromDebtMessage(message: string, mode?: 'create' | 'settle'): string | undefined {
  const patterns = [
    /\b(?:lent|loaned)\s+([a-z][a-z\s'.-]+?)\s*(?:\d|$)/i,
    /\b(?:borrowed|i owe|utang)\s+(?:kay|ki|from)\s+([a-z][a-z\s'.-]+?)(?=(?:\s+(?:ng\s+)?(?:\u20b1|php|p)?\s*\d)|$|\s+(?:for|dahil|para)\b)/i,
    /\b(?:borrowed)\s+\d+(?:\.\d+)?(?:\s*k)?\s+from\s+([a-z][a-z\s'.-]+)$/i,
    /\b(?:may utang ako|umutang ako)\s+(?:kay|ki)\s+([a-z][a-z\s'.-]+?)(?=(?:\s+(?:ng\s+)?(?:\u20b1|php|p)?\s*\d)|$|\s+(?:for|dahil|para)\b)/i,
    /\b(?:pinahiram(?: ko)?)\s+(?:si\s+)?([a-z][a-z\s'.-]+?)(?=(?:\s+(?:ng\s+)?(?:\u20b1|php|p)?\s*\d)|$|\s+(?:for|dahil|para)\b)/i,
    /\b(?:si\s+)?([a-z][a-z\s'.-]+?)\s+may utang\s+(?:sakin|sa akin)\b/i,
    /\bmay utang\s+(?:si\s+)?([a-z][a-z\s'.-]+?)\s+(?:sakin|sa akin)\b/i,
    /\b([a-z][a-z\s'.-]+?)\s+paid me back\b/i,
    /\b([a-z][a-z\s'.-]+?)\s+paid back\b/i,
    /\bnagbayad\s+(?:si\s+)?([a-z][a-z\s'.-]+?)(?=(?:\s+(?:ng\s+)?(?:\u20b1|php|p)?\s*\d)|$)/i,
    /\b(?:si\s+)?([a-z][a-z\s'.-]+?)\s+nagbayad\b/i,
    /\b(?:paid me back|bayad utang|settle(?:d)?(?: debt)?(?: with)?)\s+(?:kay|ki|with)?\s*([a-z][a-z\s'.-]+)$/i,
    /\bnagbayad ako\s+(?:kay|ki)\s+([a-z][a-z\s'.-]+)$/i,
    /\bbinayaran ako ni\s+([a-z][a-z\s'.-]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return toTitleCase(normalizeWhitespace(match[1]));
    }
  }

  if (mode === 'create') {
    const kayMatch = message.match(/\butang\s+(?:kay|ki)\s+([a-z][a-z\s'.-]+)$/i);
    if (kayMatch?.[1]) {
      return toTitleCase(normalizeWhitespace(kayMatch[1]));
    }

    const mayUtangMatch = message.match(/\b([a-z][a-z\s'.-]+?)\s+may utang\s+(?:sakin|sa akin)$/i);
    if (mayUtangMatch?.[1]) {
      return toTitleCase(normalizeWhitespace(mayUtangMatch[1]));
    }

    const ambiguousCreateMatch = message.match(/\b([a-z][a-z\s'.-]+?)\s+utang\s+(?:(?:\u20b1|php|p)?\s*\d|\w)/i);
    if (ambiguousCreateMatch?.[1]) {
      return toTitleCase(normalizeWhitespace(ambiguousCreateMatch[1]));
    }
  }

  if (mode === 'settle') {
    const paidMatch = message.match(/\b([a-z][a-z\s'.-]+?)\s+paid\b/i);
    if (paidMatch?.[1]) {
      return toTitleCase(normalizeWhitespace(paidMatch[1]));
    }
  }

  return undefined;
}

export function inferDebtReason(message: string, personName?: string): string | undefined {
  let normalized = normalizeWhitespace(
    message
      .replace(/\b(?:lent|loaned|borrowed|utang|pinahiram|may utang|paid me back|paid back|settle|settled|nagbayad|bayad utang|i owe)\b/gi, ' ')
      .replace(/\b(?:ako|ko|si|ni|kay|ki|from|to|with|sakin|sa akin|me|them)\b/gi, ' ')
      .replace(/\b(?:for|dahil sa|dahil|para sa|para)\b/gi, ' ')
      .replace(/\b(?:lang|mga|around|about|roughly|approximately|approx|halos)\b/gi, ' '),
  );

  if (personName) {
    normalized = normalizeWhitespace(normalized.replace(new RegExp(`(^|\\W)${escapeRegExp(personName)}(?=$|\\W)`, 'i'), ' '));
  }

  return extractDescription(normalized);
}

function isMeaningfulDebtReason(reason: string | undefined, personName?: string): boolean {
  if (!reason) {
    return false;
  }

  const normalizedReason = normalizeForReply(reason);
  if (!normalizedReason || normalizedReason === 'chat entry') {
    return false;
  }

  if (personName && normalizedReason === normalizeForReply(personName)) {
    return false;
  }

  if (normalizedReason.includes('utang') && (!personName || normalizedReason === `${normalizeForReply(personName)} utang`)) {
    return false;
  }

  return true;
}

export function findDebtByReplyValue(message: string, debts: Debt[]): Debt | undefined {
  const normalizedMessage = normalizeForReply(message);
  const labelMatch = debts.find((debt) => normalizeForReply(buildDebtChoiceLabel(debt)) === normalizedMessage);
  if (labelMatch) {
    return labelMatch;
  }

  const personName = extractPersonFromDebtReply(message);
  if (!personName) {
    return undefined;
  }

  return debts.find((debt) => normalizeForReply(debt.personName) === normalizeForReply(personName));
}

export function resolveDebtDirectionReply(message: string): DebtDirection | undefined {
  const normalized = normalizeForReply(message);
  if (
    normalized === 'they owe me'
    || normalized === 'me'
    || normalized === 'mine'
    || normalized === 'siya may utang sakin'
    || normalized === 'may utang siya sakin'
    || normalized === 'sila may utang sakin'
    || normalized === 'ako'
    || normalized === 'sakin'
  ) {
    return 'owed';
  }
  if (
    normalized === 'i owe them'
    || normalized === 'may utang ako'
    || normalized === 'utang ko'
    || normalized === 'ako may utang'
  ) {
    return 'owing';
  }
  return undefined;
}

export function parseDebtAction(
  message: string,
  context: BerdeChatParserContext,
  existing?: Extract<BerdeParsedAction, { kind: 'debt' }>,
): Extract<BerdeParsedAction, { kind: 'debt' }> | null {
  const normalized = normalizeForReply(message);
  const debts = (context.debts ?? []).filter((debt) => debt.status === 'active');
  const debtLike = /\b(lent|loaned|borrowed|utang|paid me back|settle|settled|pinahiram|may utang|nagbayad|paid)\b/i.test(normalized);
  if (!debtLike && !existing) {
    return null;
  }

  const now = context.now ?? new Date();
  const { amount } = extractAmount(message);
  const debtMode = inferDebtMode(message, debts, existing);
  const personName = extractPersonFromDebtMessage(message, debtMode) ?? existing?.personName;
  const debtCandidates = findDebtCandidatesByPerson(personName, debts);
  const matchingDebt = debtCandidates[0];
  const inferredDirection = inferDebtDirection(message, existing);

  if (debtMode === 'settle') {
    if (amount && matchingDebt && debtCandidates.length === 1) {
      if (amount < matchingDebt.amount - 0.009) {
        return {
          id: existing?.id ?? createActionId('debt'),
          kind: 'debt',
          debtMode: 'settle',
          settlementType: 'partial',
          debtId: matchingDebt.id,
          debtCandidateIds: [matchingDebt.id],
          personName,
          amount,
          remainingAmount: Number((matchingDebt.amount - amount).toFixed(2)),
          reason: matchingDebt.reason ?? existing?.reason,
          direction: matchingDebt.direction ?? existing?.direction,
          date: buildDateIso(now, 0),
          sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
        };
      }

      if (amount > matchingDebt.amount + 0.009) {
        return {
          id: existing?.id ?? createActionId('debt'),
          kind: 'debt',
          debtMode: 'settle',
          settlementType: 'partial',
          debtCandidateIds: debtCandidates.map((debt) => debt.id),
          personName,
          amount,
          remainingAmount: undefined,
          reason: matchingDebt.reason ?? existing?.reason,
          direction: matchingDebt.direction ?? existing?.direction,
          date: buildDateIso(now, 0),
          sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
        };
      }
    }

    if (amount && matchingDebt && Math.abs(matchingDebt.amount - amount) > 0.009) {
      return {
        id: existing?.id ?? createActionId('debt'),
        kind: 'debt',
        debtMode: 'settle',
        settlementType: 'partial',
        debtCandidateIds: debtCandidates.map((debt) => debt.id),
        personName,
        amount,
        reason: matchingDebt.reason ?? existing?.reason,
        date: buildDateIso(now, 0),
        sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
      };
    }

    return {
      id: existing?.id ?? createActionId('debt'),
      kind: 'debt',
      debtMode: 'settle',
      settlementType: amount ? 'partial' : 'full',
      debtId: debtCandidates.length === 1 ? matchingDebt?.id ?? existing?.debtId : existing?.debtId,
      debtCandidateIds: debtCandidates.length > 0 ? debtCandidates.map((debt) => debt.id) : existing?.debtCandidateIds,
      personName,
      amount: amount ?? matchingDebt?.amount ?? existing?.amount,
      reason: matchingDebt?.reason ?? existing?.reason,
      direction: matchingDebt?.direction ?? existing?.direction,
      remainingAmount:
        amount && matchingDebt && amount < matchingDebt.amount - 0.009
          ? Number((matchingDebt.amount - amount).toFixed(2))
          : existing?.remainingAmount,
      date: buildDateIso(now, 0),
      sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
    };
  }

  return {
    id: existing?.id ?? createActionId('debt'),
    kind: 'debt',
    debtMode: 'create',
    personName,
    direction: inferredDirection.direction,
    directionSource: inferredDirection.source,
    amount: amount ?? existing?.amount,
    reason: (() => {
      const candidateReason = inferDebtReason(message, personName) ?? existing?.reason;
      return isMeaningfulDebtReason(candidateReason, personName) ? candidateReason : undefined;
    })(),
    date: buildDateIso(now, 0),
    sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
  };
}
