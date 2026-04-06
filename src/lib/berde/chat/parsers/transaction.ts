import { CATEGORY_ALIASES, findAliasMatch, INCOME_CATEGORY_ALIASES } from '@/lib/berde/chat/aliases';
import { createActionId } from '@/lib/berde/chat/actions';
import {
  buildDateIso,
  detectTransactionType,
  extractAccountMention,
  extractAmount,
  extractDate,
  extractDescription,
  extractMerchantFromTail,
  inferMerchant,
} from '@/lib/berde/chat/extractors';
import { normalizeWhitespace } from '@/lib/berde/chat/normalize';
import { resolvePaymentMethodForAccount, resolvePreferredDefaultAccount } from '@/lib/accounts-utils';
import type { BerdeChatParserContext, BerdeTransactionAction } from '@/lib/berde/chat.types';
import type { Category, IncomeCategory } from '@/lib/types';
import type { TransactionEntryType } from '@/lib/berde/chat/config';

interface TransactionSignals {
  amount?: number;
  entryType?: TransactionEntryType;
  category?: Category;
  incomeCategory?: IncomeCategory;
  description?: string;
  merchant?: string;
  date?: string;
  accountId?: string;
  accountName?: string;
}

function buildTransactionSignals(message: string, context: BerdeChatParserContext): TransactionSignals {
  const now = context.now ?? new Date();
  const { amount, stripped: withoutAmount } = extractAmount(normalizeWhitespace(message));
  const { date, stripped: withoutDate } = extractDate(withoutAmount, now);
  const { account, stripped: withoutAccount } = extractAccountMention(withoutDate, context.accounts);
  const { merchant, stripped: withoutMerchant } = extractMerchantFromTail(withoutAccount);
  const categoryMatch = findAliasMatch(withoutMerchant, CATEGORY_ALIASES);
  const incomeCategoryMatch = findAliasMatch(withoutMerchant, INCOME_CATEGORY_ALIASES);
  const entryType = detectTransactionType(withoutMerchant, categoryMatch.value, incomeCategoryMatch.value);
  const description = extractDescription(withoutMerchant);

  return {
    amount,
    entryType,
    category: categoryMatch.value,
    incomeCategory: incomeCategoryMatch.value,
    description,
    merchant: merchant ?? inferMerchant(description, categoryMatch.value),
    date,
    accountId: account?.id,
    accountName: account?.name,
  };
}

export function mergeTransactionAction(
  existing: BerdeTransactionAction | undefined,
  message: string,
  context: BerdeChatParserContext,
): BerdeTransactionAction | null {
  const signals = buildTransactionSignals(message, context);
  const defaultAccount = resolvePreferredDefaultAccount(context.accounts);
  const account = context.accounts.find((entry) => entry.id === signals.accountId)
    ?? context.accounts.find((entry) => entry.id === existing?.accountId)
    ?? defaultAccount
    ?? undefined;

  if (
    !existing &&
    !signals.amount &&
    !signals.entryType &&
    !signals.category &&
    !signals.incomeCategory &&
    !signals.description &&
    !signals.merchant
  ) {
    return null;
  }

  const entryType = signals.entryType ?? existing?.entryType;

  return {
    id: existing?.id ?? createActionId('tx'),
    kind: 'transaction',
    entryType,
    amount: signals.amount ?? existing?.amount,
    category: entryType === 'expense' ? signals.category ?? existing?.category : undefined,
    incomeCategory: entryType === 'income' ? signals.incomeCategory ?? existing?.incomeCategory : undefined,
    description: signals.description ?? existing?.description,
    merchant: signals.merchant ?? existing?.merchant,
    date: signals.date ?? existing?.date ?? buildDateIso(context.now ?? new Date(), 0),
    accountId: signals.accountId ?? existing?.accountId ?? account?.id,
    accountName: signals.accountName ?? existing?.accountName ?? account?.name,
    paymentMethod: resolvePaymentMethodForAccount(account, entryType ?? 'expense'),
    sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
  };
}
