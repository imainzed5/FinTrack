import { STARTER_QUICK_REPLIES } from '@/lib/berde/chat/config';
import { normalizeForReply } from '@/lib/berde/chat/normalize';
import type {
  BerdeActionMissingField,
  BerdeChatParserContext,
  BerdeChatResponse,
  BerdeParsedAction,
  BerdeParsedActionBatch,
} from '@/lib/berde/chat.types';
import type { Debt } from '@/lib/types';

export function buildDebtChoiceLabel(debt: Debt): string {
  const dateLabel = new Date(debt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${debt.personName} · ${debt.reason || 'No note'} · ${dateLabel}`;
}

export function getMissingFieldsForAction(action: BerdeParsedAction): BerdeActionMissingField[] {
  switch (action.kind) {
    case 'transaction': {
      const missing: BerdeActionMissingField[] = [];
      if (typeof action.amount !== 'number') {
        missing.push('amount');
      }
      if (!action.entryType) {
        missing.push('type');
        return missing;
      }
      if (action.entryType === 'expense' && !action.category) {
        missing.push('category');
      }
      if (action.entryType === 'income' && !action.incomeCategory) {
        missing.push('incomeCategory');
      }
      return missing;
    }
    case 'transfer': {
      const missing: BerdeActionMissingField[] = [];
      if (typeof action.amount !== 'number') {
        missing.push('amount');
      }
      if (!action.fromAccountId) {
        missing.push('fromAccount');
      }
      if (!action.toAccountId) {
        missing.push('toAccount');
      }
      return missing;
    }
    case 'savings': {
      const missing: BerdeActionMissingField[] = [];
      if (typeof action.amount !== 'number') {
        missing.push('amount');
      }
      if (!action.savingsType) {
        missing.push('savingsType');
      }
      if (!action.goalId) {
        missing.push('goal');
      }
      return missing;
    }
    case 'debt': {
      const missing: BerdeActionMissingField[] = [];
      if (!action.debtMode) {
        missing.push('debt');
        return missing;
      }
      if (action.debtMode === 'settle') {
        if (!action.debtId) {
          missing.push('debt');
        }
        return missing;
      }
      if (!action.personName) {
        missing.push('person');
      }
      if (!action.direction) {
        missing.push('direction');
      }
      if (typeof action.amount !== 'number') {
        missing.push('amount');
      }
      return missing;
    }
  }
}

export function getConfidence(batch?: BerdeParsedActionBatch): { score: number; label: 'low' | 'medium' | 'high' } {
  if (!batch || batch.actions.length === 0) {
    return { score: 0, label: 'low' };
  }

  const completionScores = batch.actions.map((action) => {
    const missing = getMissingFieldsForAction(action);
    if (missing.length === 0) {
      return 1;
    }
    if (missing.length === 1) {
      return 0.65;
    }
    return 0.35;
  });

  const score = Number((completionScores.reduce((sum, value) => sum + value, 0) / completionScores.length).toFixed(2));
  if (score >= 0.85) {
    return { score, label: 'high' };
  }
  if (score >= 0.65) {
    return { score, label: 'medium' };
  }
  return { score, label: 'low' };
}

export function getQuickReplies(field?: BerdeActionMissingField, context?: BerdeChatParserContext): string[] {
  if (field === 'type') {
    return ['Expense', 'Income'];
  }
  if (field === 'category') {
    return ['Food', 'Transportation', 'Utilities', 'Health', 'Miscellaneous'];
  }
  if (field === 'incomeCategory') {
    return ['Salary', 'Freelance', 'Side Job', 'Gift', 'Other Income'];
  }
  if (field === 'fromAccount' || field === 'toAccount') {
    return (context?.accounts ?? [])
      .filter((account) => !account.isArchived)
      .slice(0, 4)
      .map((account) => account.name);
  }
  if (field === 'savingsType') {
    return ['Deposit', 'Withdrawal'];
  }
  if (field === 'direction') {
    return ['They owe me', 'I owe them'];
  }
  if (field === 'goal') {
    return (context?.savingsGoals ?? [])
      .filter((goal) => goal.status === 'active')
      .slice(0, 4)
      .map((goal) => goal.name);
  }
  if (field === 'debt') {
    return (context?.debts ?? [])
      .filter((debt) => debt.status === 'active')
      .slice(0, 4)
      .map((debt) => buildDebtChoiceLabel(debt));
  }
  if (field === 'amount') {
    return ['100', '250', '500', '1000'];
  }
  return [];
}

export function getActionReference(action: BerdeParsedAction, index: number, batchSize: number): string {
  if (batchSize > 1) {
    return `For item ${index + 1}`;
  }
  switch (action.kind) {
    case 'transaction':
      return action.description || action.merchant ? `For "${action.description || action.merchant}"` : 'For this entry';
    case 'transfer':
      return 'For this transfer';
    case 'savings':
      return 'For this savings move';
    case 'debt':
      return 'For this debt entry';
  }
}

export function getFollowUpPrompt(
  action: BerdeParsedAction,
  field: BerdeActionMissingField,
  index: number,
  batchSize: number,
): string {
  const prefix = getActionReference(action, index, batchSize);
  if (field === 'type') return `${prefix}, should I log it as an expense or income?`;
  if (field === 'category') return `${prefix}, which category should I use?`;
  if (field === 'incomeCategory') return `${prefix}, was that salary, freelance, bonus, gift, or something else?`;
  if (field === 'fromAccount') return `${prefix}, which account is the money coming from?`;
  if (field === 'toAccount') return `${prefix}, which account is the money going to?`;
  if (field === 'goal') return `${prefix}, which savings goal should I use?`;
  if (field === 'savingsType') return `${prefix}, is this a deposit or a withdrawal?`;
  if (field === 'direction') return `${prefix}, do they owe you or do you owe them?`;
  if (field === 'person') return `${prefix}, sino ang person sa utang na ito?`;
  if (field === 'reason') return `${prefix}, para saan ito kung gusto mong lagyan ng note?`;
  if (field === 'debt') return `${prefix}, aling active utang ang gagalaw dito?`;
  return `${prefix}, how much should I log?`;
}

export function findFirstIncompleteAction(batch: BerdeParsedActionBatch): { index: number; field: BerdeActionMissingField } | null {
  for (let index = 0; index < batch.actions.length; index += 1) {
    const missingFields = getMissingFieldsForAction(batch.actions[index]);
    if (missingFields.length > 0) {
      return { index, field: missingFields[0] };
    }
  }
  return null;
}

export function createBatchResponse(
  batch: BerdeParsedActionBatch,
  context: BerdeChatParserContext,
  replyOverride?: string,
): BerdeChatResponse {
  const incomplete = findFirstIncompleteAction(batch);
  const confidence = getConfidence(batch);

  if (incomplete) {
    return {
      intent: {
        kind: 'ambiguous',
        stage: 'collecting_field',
        confidence: confidence.score,
        confidenceLabel: confidence.label,
        missingFields: getMissingFieldsForAction(batch.actions[incomplete.index]),
        expectedField: incomplete.field,
        quickReplies: getQuickReplies(incomplete.field, context),
        batch: {
          ...batch,
          focusActionIndex: incomplete.index,
        },
      },
      replyText: getFollowUpPrompt(batch.actions[incomplete.index], incomplete.field, incomplete.index, batch.actions.length),
    };
  }

  return {
    intent: {
      kind: 'action_batch',
      stage: 'awaiting_confirmation',
      confidence: confidence.score,
      confidenceLabel: confidence.label,
      missingFields: [],
      quickReplies: ['Yes', 'Cancel'],
      batch,
    },
    replyText:
      replyOverride
      ?? (batch.actions.length > 1
        ? `I parsed ${batch.actions.length} actions. Review them and confirm when you're ready.`
        : "Here's what I understood. Review it and confirm when you're ready."),
  };
}

export function createUnsupportedResponse(message: string): BerdeChatResponse {
  const normalized = normalizeForReply(message);

  if (/^(?:what|how|should|can|could|would|when|where|why)\b/i.test(message)) {
    return {
      intent: {
        kind: 'unsupported',
        stage: 'unsupported',
        confidence: 0,
        confidenceLabel: 'low',
        missingFields: [],
        quickReplies: [...STARTER_QUICK_REPLIES],
      },
      replyText:
        'Gets ko, pero pang-log muna ako dito. Sabihin mo lang kung may ginastos, natanggap, nilipat, o utang na kailangan i-track.',
    };
  }

  if (/\b(?:paid me back|paid back|settle|settled)\b/i.test(normalized)) {
    return {
      intent: {
        kind: 'unsupported',
        stage: 'unsupported',
        confidence: 0,
        confidenceLabel: 'low',
        missingFields: [],
        quickReplies: ['Track utang', 'Log expense', 'Move money'],
      },
      replyText:
        "Mukhang debt update 'yan, pero kulang pa ako sa exact match. Banggitin mo kung sino, magkano ang binayad, at alin sa active utang ang gagalaw.",
    };
  }

  if (/^(?:hi|hello|hey|yo|sup|kamusta|kumusta)\b/i.test(normalized) || normalized.split(/\s+/).length <= 3) {
    return {
      intent: {
        kind: 'unsupported',
        stage: 'unsupported',
        confidence: 0,
        confidenceLabel: 'low',
        missingFields: [],
        quickReplies: [...STARTER_QUICK_REPLIES],
      },
      replyText:
        "Ready ako mag-log. Pwede mong sabihin ang expense, income, transfer, o utang in one line tapos gagawa ako ng draft.",
    };
  }

  return {
    intent: {
      kind: 'unsupported',
      stage: 'unsupported',
      confidence: 0,
      confidenceLabel: 'low',
      missingFields: [],
      quickReplies: [...STARTER_QUICK_REPLIES],
    },
    replyText:
      "Hindi ko pa ma-log 'yan as-is. Try mo sabihin in a direct logging format, then I'll draft it before anything gets saved.",
  };
}
