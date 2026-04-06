import { createActionId } from '@/lib/berde/chat/actions';
import {
  buildDateIso,
  extractAmount,
  extractDate,
  extractDescription,
  extractGoalMention,
} from '@/lib/berde/chat/extractors';
import { normalizeForReply } from '@/lib/berde/chat/normalize';
import type { BerdeChatParserContext, BerdeParsedAction } from '@/lib/berde/chat.types';

export function parseSavingsAction(
  message: string,
  context: BerdeChatParserContext,
  existing?: Extract<BerdeParsedAction, { kind: 'savings' }>,
): Extract<BerdeParsedAction, { kind: 'savings' }> | null {
  const normalized = normalizeForReply(message);
  const savingsLike =
    /\b(save|saved|deposit|add|hulog|dagdag)\b/i.test(normalized) ||
    /\b(withdraw|take out|pull out|kuha)\b/i.test(normalized) ||
    /\b(savings|ipon)\b/i.test(normalized);
  if (!savingsLike && !existing) {
    return null;
  }

  const now = context.now ?? new Date();
  const { amount, stripped: withoutAmount } = extractAmount(message);
  const { date, stripped: withoutDate } = extractDate(withoutAmount, now);
  const { goal, stripped: withoutGoal } = extractGoalMention(withoutDate, context.savingsGoals ?? []);
  const savingsType = /\b(withdraw|take out|pull out|kuha)\b/i.test(normalized)
    ? 'withdrawal'
    : /\b(save|saved|deposit|add|hulog|dagdag)\b/i.test(normalized)
      ? 'deposit'
      : existing?.savingsType;

  return {
    id: existing?.id ?? createActionId('savings'),
    kind: 'savings',
    amount: amount ?? existing?.amount,
    savingsType,
    goalId: goal?.id ?? existing?.goalId,
    goalName: goal?.name ?? existing?.goalName,
    note: extractDescription(withoutGoal) ?? existing?.note,
    date: date ?? existing?.date ?? buildDateIso(now, 0),
    sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
  };
}
