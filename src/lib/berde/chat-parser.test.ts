import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBerdeChatInput } from '@/lib/berde/chat-parser';
import type { BerdeChatIntent, BerdeParsedActionBatch } from '@/lib/berde/chat.types';
import type { Account, Debt, SavingsGoal } from '@/lib/types';

const baseNow = new Date('2026-04-05T08:00:00.000Z');

const accounts: Account[] = [
  {
    id: 'cash-wallet',
    userId: 'user-1',
    name: 'Cash',
    type: 'Cash',
    expensePaymentMethod: 'Cash',
    initialBalance: 0,
    isSystemCashWallet: true,
    isArchived: false,
    createdAt: baseNow.toISOString(),
    updatedAt: baseNow.toISOString(),
  },
  {
    id: 'gcash-wallet',
    userId: 'user-1',
    name: 'GCash',
    type: 'E-Wallet',
    initialBalance: 0,
    isArchived: false,
    createdAt: baseNow.toISOString(),
    updatedAt: baseNow.toISOString(),
  },
  {
    id: 'bpi-wallet',
    userId: 'user-1',
    name: 'BPI',
    type: 'Bank',
    initialBalance: 0,
    isArchived: false,
    createdAt: baseNow.toISOString(),
    updatedAt: baseNow.toISOString(),
  },
];

const savingsGoals: SavingsGoal[] = [
  {
    id: 'goal-emergency',
    userId: 'user-1',
    name: 'Emergency Fund',
    emoji: 'X',
    colorAccent: '#22c55e',
    targetAmount: 50000,
    currentAmount: 12500,
    isPrivate: false,
    isPinned: true,
    status: 'active',
    sortOrder: 0,
    createdAt: baseNow.toISOString(),
    updatedAt: baseNow.toISOString(),
  },
];

const debts: Debt[] = [
  {
    id: 'debt-john',
    userId: 'user-1',
    direction: 'owed',
    personName: 'John',
    amount: 500,
    reason: 'Lunch',
    date: '2026-04-03',
    status: 'active',
    createdAt: baseNow.toISOString(),
    updatedAt: baseNow.toISOString(),
  },
];

function parse(
  message: string,
  options: {
    pendingBatch?: BerdeParsedActionBatch | null;
    pendingIntent?: BerdeChatIntent | null;
    customDebts?: Debt[];
  } = {},
) {
  return parseBerdeChatInput(message, {
    accounts,
    savingsGoals,
    debts: options.customDebts ?? debts,
    now: baseNow,
    pendingBatch: options.pendingBatch ?? null,
    pendingIntent: options.pendingIntent ?? null,
  });
}

test('parses spent 5k on food as a complete expense action batch', () => {
  const result = parse('spent 5k on food');

  assert.equal(result.intent.kind, 'action_batch');
  assert.equal(result.intent.stage, 'awaiting_confirmation');
  assert.equal(result.intent.batch?.actions.length, 1);

  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'transaction');
  assert.equal(action.entryType, 'expense');
  assert.equal(action.amount, 5000);
  assert.equal(action.category, 'Food');
});

test('parses 250 lunch and 100 mrt into two expense actions', () => {
  const result = parse('250 lunch and 100 mrt');

  assert.equal(result.intent.kind, 'action_batch');
  assert.equal(result.intent.batch?.actions.length, 2);

  const [lunch, commute] = result.intent.batch?.actions ?? [];
  assert.equal(lunch.kind, 'transaction');
  assert.equal(lunch.amount, 250);
  assert.equal(lunch.category, 'Food');
  assert.equal(commute.kind, 'transaction');
  assert.equal(commute.amount, 100);
  assert.equal(commute.category, 'Transportation');
});

test('parses local separators like tapos and plus in one batch', () => {
  const result = parse('kumain ako jollibee 500 last tuesday tapos nag mrt 80 after plus gcash 200 load');

  assert.equal(result.intent.kind, 'action_batch');
  assert.equal(result.intent.batch?.actions.length, 3);

  const [food, commute, load] = result.intent.batch?.actions ?? [];
  assert.equal(food.kind, 'transaction');
  assert.equal(food.category, 'Food');
  assert.equal(food.amount, 500);
  assert.equal(commute.kind, 'transaction');
  assert.equal(commute.category, 'Transportation');
  assert.equal(commute.amount, 80);
  assert.equal(load.kind, 'transaction');
  assert.equal(load.accountId, 'gcash-wallet');
  assert.equal(load.category, 'Utilities');
});

test('parses income plus transfer in one message', () => {
  const result = parse('salary 15000 then transfer 5k from gcash to cash');

  assert.equal(result.intent.kind, 'action_batch');
  assert.equal(result.intent.batch?.actions.length, 2);

  const [income, transfer] = result.intent.batch?.actions ?? [];
  assert.equal(income.kind, 'transaction');
  assert.equal(income.entryType, 'income');
  assert.equal(income.amount, 15000);
  assert.equal(income.incomeCategory, 'Salary');

  assert.equal(transfer.kind, 'transfer');
  assert.equal(transfer.amount, 5000);
  assert.equal(transfer.fromAccountId, 'gcash-wallet');
  assert.equal(transfer.toAccountId, 'cash-wallet');
});

test('parses savings deposits with a matching goal', () => {
  const result = parse('add 500 to emergency fund');

  assert.equal(result.intent.kind, 'action_batch');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'savings');
  assert.equal(action.amount, 500);
  assert.equal(action.savingsType, 'deposit');
  assert.equal(action.goalId, 'goal-emergency');
});

test('parses debt creation messages', () => {
  const result = parse('lent John 500 for dinner');

  assert.equal(result.intent.kind, 'action_batch');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.debtMode, 'create');
  assert.equal(action.direction, 'owed');
  assert.equal(action.personName, 'John');
  assert.equal(action.amount, 500);
});

test('parses utang kay phrasing as owing debt', () => {
  const result = parse('utang kay Ana 500 pamasahe');

  assert.equal(result.intent.kind, 'action_batch');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.debtMode, 'create');
  assert.equal(action.direction, 'owing');
  assert.equal(action.personName, 'Ana');
  assert.equal(action.amount, 500);
  assert.equal(action.reason, 'Pamasahe');
});

test('utang kay with no amount asks for amount, not person', () => {
  const result = parse('utang kay Ana');

  assert.equal(result.intent.kind, 'ambiguous');
  assert.equal(result.intent.expectedField, 'amount');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.personName, 'Ana');
  assert.equal(action.direction, 'owing');
});

test('parses may utang sakin phrasing as owed debt', () => {
  const result = parse('Ana may utang sakin 500 lunch');

  assert.equal(result.intent.kind, 'action_batch');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.debtMode, 'create');
  assert.equal(action.direction, 'owed');
  assert.equal(action.personName, 'Ana');
  assert.equal(action.amount, 500);
});

test('may utang sakin with no amount asks for amount, not person', () => {
  const result = parse('Ana may utang sakin');

  assert.equal(result.intent.kind, 'ambiguous');
  assert.equal(result.intent.expectedField, 'amount');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.personName, 'Ana');
  assert.equal(action.direction, 'owed');
});

test('ambiguous utang phrasing asks for direction instead of guessing', () => {
  const result = parse('Ana utang 500');

  assert.equal(result.intent.kind, 'ambiguous');
  assert.equal(result.intent.expectedField, 'direction');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.personName, 'Ana');
  assert.equal(action.amount, 500);
});

test('debt creation follow-up fills the missing person without looping', () => {
  const initial = parse('borrowed 500 mamons');
  assert.equal(initial.intent.kind, 'ambiguous');
  assert.equal(initial.intent.expectedField, 'person');

  const followUp = parse('Aketon', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
  });

  assert.equal(followUp.intent.kind, 'action_batch');
  const action = followUp.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.debtMode, 'create');
  assert.equal(action.direction, 'owing');
  assert.equal(action.personName, 'Aketon');
  assert.equal(action.amount, 500);
});

test('debt creation follow-up resolves a direction reply like may utang ako', () => {
  const initial = parse('Ana utang 500');
  assert.equal(initial.intent.kind, 'ambiguous');
  assert.equal(initial.intent.expectedField, 'direction');

  const followUp = parse('may utang ako', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
  });

  assert.equal(followUp.intent.kind, 'action_batch');
  const action = followUp.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.direction, 'owing');
  assert.equal(followUp.intent.expectedField, undefined);
});

test('debt direction follow-up accepts me as they owe me', () => {
  const initial = parse('Ana utang 500');
  assert.equal(initial.intent.kind, 'ambiguous');
  assert.equal(initial.intent.expectedField, 'direction');

  const followUp = parse('me', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
  });

  assert.equal(followUp.intent.kind, 'action_batch');
  const action = followUp.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.direction, 'owed');
});

test('parses debt settlement against an active debt', () => {
  const result = parse('John paid me back');

  assert.equal(result.intent.kind, 'action_batch');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.debtMode, 'settle');
  assert.equal(action.debtId, 'debt-john');
  assert.equal(action.settlementType, 'full');
});

test('parses partial debt settlement against an active debt', () => {
  const result = parse('John paid me back 200');

  assert.equal(result.intent.kind, 'action_batch');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.debtMode, 'settle');
  assert.equal(action.debtId, 'debt-john');
  assert.equal(action.settlementType, 'partial');
  assert.equal(action.amount, 200);
  assert.equal(action.remainingAmount, 300);
});

test('parses nagbayad si phrasing as partial debt settlement', () => {
  const result = parse('nagbayad si John ng 200');

  assert.equal(result.intent.kind, 'action_batch');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.debtMode, 'settle');
  assert.equal(action.debtId, 'debt-john');
  assert.equal(action.settlementType, 'partial');
  assert.equal(action.amount, 200);
});

test('debt settlement follow-up keeps the settlement flow when choosing a debt', () => {
  const initial = parse('paid me back 200');
  assert.equal(initial.intent.kind, 'ambiguous');
  assert.equal(initial.intent.expectedField, 'debt');

  const followUp = parse('John', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
  });

  assert.equal(followUp.intent.kind, 'action_batch');
  const action = followUp.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.debtMode, 'settle');
  assert.equal(action.debtId, 'debt-john');
  assert.equal(action.personName, 'John');
  assert.equal(action.amount, 200);
  assert.equal(action.settlementType, 'partial');
  assert.equal(action.remainingAmount, 300);
});

test('debt settlement with multiple matches asks for the exact debt', () => {
  const customDebts: Debt[] = [
    ...debts,
    {
      id: 'debt-john-2',
      userId: 'user-1',
      direction: 'owed',
      personName: 'John',
      amount: 250,
      reason: 'Fare',
      date: '2026-04-01',
      status: 'active',
      createdAt: baseNow.toISOString(),
      updatedAt: baseNow.toISOString(),
    },
  ];

  const result = parse('John paid me back 100', { customDebts });

  assert.equal(result.intent.kind, 'ambiguous');
  assert.equal(result.intent.expectedField, 'debt');
  assert.ok(result.intent.quickReplies?.some((reply) => /John/.test(reply)));
});

test('resolves debt selection from a decorated quick reply label', () => {
  const customDebts: Debt[] = [
    ...debts,
    {
      id: 'debt-john-2',
      userId: 'user-1',
      direction: 'owed',
      personName: 'John',
      amount: 250,
      reason: 'Fare',
      date: '2026-04-01',
      status: 'active',
      createdAt: baseNow.toISOString(),
      updatedAt: baseNow.toISOString(),
    },
  ];

  const initial = parse('John paid me back 100', { customDebts });
  assert.equal(initial.intent.kind, 'ambiguous');
  assert.equal(initial.intent.expectedField, 'debt');

  const followUp = parse('John · Fare · Apr 1', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
    customDebts,
  });

  assert.equal(followUp.intent.kind, 'action_batch');
  const action = followUp.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'debt');
  assert.equal(action.debtId, 'debt-john-2');
  assert.equal(action.amount, 100);
});

test('gym 500 followed by expense resolves type and asks for category', () => {
  const initial = parse('gym 500');
  const followUp = parse('expense', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
  });

  assert.equal(initial.intent.kind, 'ambiguous');
  assert.equal(initial.intent.expectedField, 'type');

  assert.equal(followUp.intent.kind, 'ambiguous');
  assert.equal(followUp.intent.expectedField, 'category');
  assert.equal(followUp.intent.batch?.actions[0].kind, 'transaction');
  if (followUp.intent.batch?.actions[0].kind === 'transaction') {
    assert.equal(followUp.intent.batch.actions[0].entryType, 'expense');
  }
});

test('spent 500 followed by food completes the pending batch', () => {
  const initial = parse('spent 500');
  const followUp = parse('food', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
  });

  assert.equal(initial.intent.kind, 'ambiguous');
  assert.equal(initial.intent.expectedField, 'category');
  assert.equal(followUp.intent.kind, 'action_batch');
  assert.equal(followUp.intent.stage, 'awaiting_confirmation');
  const action = followUp.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'transaction');
  assert.equal(action.amount, 500);
  assert.equal(action.category, 'Food');
});

test('mixed batch asks only about item 2 when the second action is incomplete', () => {
  const result = parse('250 lunch and spent 500');

  assert.equal(result.intent.kind, 'ambiguous');
  assert.equal(result.intent.expectedField, 'category');
  assert.equal(result.intent.batch?.focusActionIndex, 1);
  assert.match(result.replyText, /item 2/i);

  const [first, second] = result.intent.batch?.actions ?? [];
  assert.equal(first.kind, 'transaction');
  assert.equal(first.amount, 250);
  assert.equal(first.category, 'Food');
  assert.equal(second.kind, 'transaction');
  assert.equal(second.amount, 500);
  assert.equal(second.category, undefined);
});

test('follow-up only completes the focused action in a mixed batch', () => {
  const initial = parse('250 lunch and spent 500');
  const followUp = parse('transportation', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
  });

  assert.equal(followUp.intent.kind, 'action_batch');
  const [first, second] = followUp.intent.batch?.actions ?? [];
  assert.equal(first.kind, 'transaction');
  assert.equal(first.category, 'Food');
  assert.equal(second.kind, 'transaction');
  assert.equal(second.category, 'Transportation');
});

test('yes only confirms when a ready batch exists', () => {
  const initial = parse('salary 15000');
  const confirm = parse('yes', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
  });

  assert.equal(initial.intent.kind, 'action_batch');
  assert.equal(confirm.intent.kind, 'confirm');
  assert.equal(confirm.intent.batch?.actions.length, 1);
});

test('yes without a pending ready batch stays unsupported', () => {
  const result = parse('yes');

  assert.equal(result.intent.kind, 'unsupported');
});

test('resolves weekday phrasing like last tuesday', () => {
  const result = parse('kumain ako jollibee 500 last tuesday');

  assert.equal(result.intent.kind, 'action_batch');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'transaction');
  assert.equal(action.category, 'Food');
  assert.equal(action.amount, 500);
  assert.equal(action.date.startsWith('2026-03-31'), true);
});

test('resolves Filipino weekday phrasing', () => {
  const result = parse('spent 120 pamasahe nung martes');

  assert.equal(result.intent.kind, 'action_batch');
  const action = result.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'transaction');
  assert.equal(action.category, 'Transportation');
  assert.equal(action.date.startsWith('2026-03-31'), true);
});

test('savings follow-up can fill the missing goal', () => {
  const initial = parse('save 500');
  assert.equal(initial.intent.kind, 'ambiguous');
  assert.equal(initial.intent.expectedField, 'goal');

  const followUp = parse('Emergency Fund', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
  });

  assert.equal(followUp.intent.kind, 'action_batch');
  const action = followUp.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'savings');
  assert.equal(action.goalId, 'goal-emergency');
  assert.equal(action.goalName, 'Emergency Fund');
  assert.equal(action.amount, 500);
  assert.equal(action.savingsType, 'deposit');
});

test('transfer follow-up can fill the missing destination account', () => {
  const initial = parse('transfer 500 from gcash');
  assert.equal(initial.intent.kind, 'ambiguous');
  assert.equal(initial.intent.expectedField, 'toAccount');

  const followUp = parse('cash', {
    pendingBatch: initial.intent.batch,
    pendingIntent: initial.intent,
  });

  assert.equal(followUp.intent.kind, 'action_batch');
  const action = followUp.intent.batch?.actions[0];
  assert.ok(action);
  assert.equal(action.kind, 'transfer');
  assert.equal(action.amount, 500);
  assert.equal(action.fromAccountId, 'gcash-wallet');
  assert.equal(action.toAccountId, 'cash-wallet');
});

test('returns unsupported for advice-style prompts', () => {
  const result = parse('what should i focus on this month');

  assert.equal(result.intent.kind, 'unsupported');
  assert.match(result.replyText, /pang-log muna/i);
  assert.deepEqual(result.intent.quickReplies, ['Log expense', 'Log income', 'Move money', 'Track utang']);
});

test('returns bounded unsupported response for vague chat prompts', () => {
  const result = parse('hello berde');

  assert.equal(result.intent.kind, 'unsupported');
  assert.match(result.replyText, /ready ako mag-log/i);
  assert.deepEqual(result.intent.quickReplies, ['Log expense', 'Log income', 'Move money', 'Track utang']);
});
