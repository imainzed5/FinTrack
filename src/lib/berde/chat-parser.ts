import {
  CATEGORY_ALIASES,
  findAliasMatch,
  INCOME_CATEGORY_ALIASES,
} from '@/lib/berde/chat/aliases';
import { YES_REPLIES } from '@/lib/berde/chat/config';
import {
  detectTransactionType,
  extractAccountMention,
  extractAmount,
  extractDate,
  extractGoalMention,
} from '@/lib/berde/chat/extractors';
import { applyFollowUp } from '@/lib/berde/chat/follow-up';
import {
  createBatchResponse,
  createUnsupportedResponse,
  getConfidence,
} from '@/lib/berde/chat/intent';
import { normalizeChatMessage, normalizeForReply } from '@/lib/berde/chat/normalize';
import { parseDebtAction, resolveDebtDirectionReply } from '@/lib/berde/chat/parsers/debt';
import { mergeTransactionAction } from '@/lib/berde/chat/parsers/transaction';
import { parseSavingsAction } from '@/lib/berde/chat/parsers/savings';
import { parseTransferAction } from '@/lib/berde/chat/parsers/transfer';
import { splitCompositeMessage } from '@/lib/berde/chat/segmenter';
import type {
  Account,
  Category,
  DebtDirection,
  IncomeCategory,
  SavingsGoal,
} from '@/lib/types';
import type {
  BerdeActionMissingField,
  BerdeChatParserContext,
  BerdeChatResponse,
  BerdeParsedAction,
} from '@/lib/berde/chat.types';

function parseFreshAction(message: string, context: BerdeChatParserContext): BerdeParsedAction | null {
  const normalized = normalizeForReply(message);

  if (/\b(transfer|move|send|lipat|nilipat)\b/i.test(normalized) || /\bfrom\b.*\bto\b/i.test(normalized)) {
    return parseTransferAction(message, context);
  }
  if (/\b(save|saved|deposit|add|withdraw|take out|pull out|savings|hulog|dagdag|ipon|kuha)\b/i.test(normalized)) {
    const savingsAction = parseSavingsAction(message, context);
    if (savingsAction) {
      return savingsAction;
    }
  }
  if (/\b(lent|loaned|borrowed|utang|paid me back|settle|settled|pinahiram|may utang|nagbayad|paid)\b/i.test(normalized)) {
    const debtAction = parseDebtAction(message, context);
    if (debtAction) {
      return debtAction;
    }
  }

  return mergeTransactionAction(undefined, message, context);
}

function interpretDirectConfirmation(message: string, context: BerdeChatParserContext): BerdeChatResponse | null {
  if (!context.pendingBatch || context.pendingIntent?.stage !== 'awaiting_confirmation') {
    return null;
  }
  if (!YES_REPLIES.has(normalizeForReply(message))) {
    return null;
  }

  const confidence = getConfidence(context.pendingBatch);
  return {
    intent: {
      kind: 'confirm',
      stage: 'awaiting_confirmation',
      confidence: confidence.score,
      confidenceLabel: confidence.label,
      missingFields: [],
      quickReplies: ['Yes', 'Cancel'],
      batch: context.pendingBatch,
    },
    replyText: "Locked in. I'll log that now.",
  };
}

export function parseBerdeChatInput(
  message: string,
  context: BerdeChatParserContext,
): BerdeChatResponse {
  const sourceText = normalizeChatMessage(message);
  const normalizedSource = normalizeForReply(sourceText);
  if (!sourceText) {
    return createUnsupportedResponse(sourceText);
  }

  const directConfirmation = interpretDirectConfirmation(sourceText, context);
  if (directConfirmation) {
    return directConfirmation;
  }

  if (!context.pendingBatch && YES_REPLIES.has(normalizedSource)) {
    return createUnsupportedResponse(sourceText);
  }

  if (!context.pendingBatch && /^(?:hi|hello|hey|yo|sup|kamusta|kumusta)\b/i.test(sourceText)) {
    return createUnsupportedResponse(sourceText);
  }

  if (
    !context.pendingBatch
    && /^(?:what|how|should|can|could|would|when|where|why)\b/i.test(sourceText)
  ) {
    return createUnsupportedResponse(sourceText);
  }

  const followUp = applyFollowUp(sourceText, context);
  if (followUp) {
    return followUp;
  }

  const actions = splitCompositeMessage(sourceText)
    .map((segment) => parseFreshAction(segment, context))
    .filter((action): action is BerdeParsedAction => Boolean(action));

  if (actions.length === 0) {
    return createUnsupportedResponse(sourceText);
  }

  return createBatchResponse({ actions }, context);
}
