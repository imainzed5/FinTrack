import { type AliasEntry, buildAccountAliasEntries } from '@/lib/berde/chat/aliases';
import { createActionId } from '@/lib/berde/chat/actions';
import {
  buildDateIso,
  extractAmount,
  extractContextualAccount,
  extractDate,
  extractDescription,
} from '@/lib/berde/chat/extractors';
import { escapeRegExp, normalizeForReply } from '@/lib/berde/chat/normalize';
import type { Account } from '@/lib/types';
import type { BerdeChatParserContext, BerdeParsedAction } from '@/lib/berde/chat.types';

export function parseTransferAction(
  message: string,
  context: BerdeChatParserContext,
  existing?: Extract<BerdeParsedAction, { kind: 'transfer' }>,
): Extract<BerdeParsedAction, { kind: 'transfer' }> | null {
  const normalized = normalizeForReply(message);
  const transferLike =
    /\b(transfer|move|send|lipat|nilipat)\b/i.test(normalized) || /\bfrom\b.*\bto\b/i.test(normalized);
  if (!transferLike && !existing) {
    return null;
  }

  const now = context.now ?? new Date();
  const entries = buildAccountAliasEntries(context.accounts);
  const { amount, stripped: withoutAmount } = extractAmount(message);
  const { date, stripped: withoutDate } = extractDate(withoutAmount, now);
  const fromResult = extractContextualAccount(withoutDate, 'from', entries);
  const toResult = extractContextualAccount(fromResult.stripped, 'to', entries);

  let fromAccount = fromResult.account
    ?? (existing?.fromAccountId ? context.accounts.find((account) => account.id === existing.fromAccountId) : undefined);
  let toAccount = toResult.account
    ?? (existing?.toAccountId ? context.accounts.find((account) => account.id === existing.toAccountId) : undefined);

  if ((!fromAccount || !toAccount) && !fromResult.account && !toResult.account) {
    const genericMatches = entries.filter((entry: AliasEntry<Account>) =>
      entry.aliases.some((alias) => new RegExp(`(^|\\W)${escapeRegExp(alias)}(?=$|\\W)`, 'i').test(normalized)),
    );
    if (genericMatches.length >= 2) {
      fromAccount = fromAccount ?? genericMatches[0].value;
      toAccount = toAccount ?? genericMatches[1].value;
    }
  }

  return {
    id: existing?.id ?? createActionId('transfer'),
    kind: 'transfer',
    amount: amount ?? existing?.amount,
    fromAccountId: fromAccount?.id ?? existing?.fromAccountId,
    fromAccountName: fromAccount?.name ?? existing?.fromAccountName,
    toAccountId: toAccount?.id ?? existing?.toAccountId,
    toAccountName: toAccount?.name ?? existing?.toAccountName,
    date: date ?? existing?.date ?? buildDateIso(now, 0),
    notes: extractDescription(toResult.stripped) ?? existing?.notes,
    sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
  };
}
