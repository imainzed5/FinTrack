import assert from 'node:assert/strict';
import test from 'node:test';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BerdeChatThread from '@/components/berde-chat/BerdeChatThread';
import { getSessionSummary } from '@/lib/berde/chat/presenters';
import type { BerdeChatMessage } from '@/lib/berde/chat/thread';

const previewMessage: Extract<BerdeChatMessage, { kind: 'preview' }> = {
  id: 'preview-1',
  role: 'berde',
  kind: 'preview',
  text: 'Please review this before saving.',
  confidenceLabel: 'low',
  previewState: { kind: 'pending' },
  batch: {
    actions: [
      {
        id: 'tx-1',
        kind: 'transaction',
        entryType: 'expense',
        amount: 250,
        category: 'Food',
        description: 'Lunch',
        accountName: 'Cash',
        date: '2026-04-06T12:00:00.000Z',
        sourceText: 'spent 250 on lunch',
      },
    ],
  },
};

test('BerdeChatThread renders pending preview confirmation controls', () => {
  const markup = renderToStaticMarkup(
    <BerdeChatThread
      messages={[previewMessage]}
      sessionSummary={{
        count: 2,
        expenseTotal: 250,
        incomeTotal: 0,
        debtMoves: 1,
      }}
      didClearThread={false}
      savingMessageId={null}
      threadEndRef={createRef<HTMLDivElement>()}
      onStarterPrompt={() => undefined}
      onQuickReply={() => undefined}
      onConfirmBatch={() => undefined}
      onCancelBatch={() => undefined}
    />,
  );

  assert.match(markup, /This session/);
  assert.match(markup, /2 logged items/);
  assert.match(markup, /Review/);
  assert.match(markup, /Log it/);
  assert.match(markup, /Cancel/);
  assert.match(markup, /Hindi ako sigurado sa ilan dito - check mo muna\./);
});

test('getSessionSummary counts logged preview batches as multiple logged items', () => {
  const loggedBatchMessage: Extract<BerdeChatMessage, { kind: 'preview' }> = {
    ...previewMessage,
    id: 'preview-logged',
    text: 'Logged 2 items. Nasa history mo na sila.',
    confidenceLabel: 'high',
    previewState: { kind: 'logged' },
    quickReplies: ['Add another'],
    batch: {
      actions: [
        {
          id: 'tx-1',
          kind: 'transaction',
          entryType: 'expense',
          amount: 250,
          category: 'Food',
          description: 'Lunch',
          accountName: 'Cash',
          date: '2026-04-06T12:00:00.000Z',
          sourceText: '250 lunch',
        },
        {
          id: 'tx-2',
          kind: 'transaction',
          entryType: 'expense',
          amount: 100,
          category: 'Transportation',
          description: 'Pamasahe',
          accountName: 'Cash',
          date: '2026-04-06T12:00:00.000Z',
          sourceText: '100 pamasahe',
        },
      ],
    },
  };

  const summary = getSessionSummary([loggedBatchMessage]);

  assert.deepEqual(summary, {
    count: 2,
    expenseTotal: 350,
    incomeTotal: 0,
    debtMoves: 0,
  });
});

test('BerdeChatThread renders logged preview batches in a compact receipt-style layout', () => {
  const loggedBatchMessage: Extract<BerdeChatMessage, { kind: 'preview' }> = {
    ...previewMessage,
    id: 'preview-logged-ui',
    text: 'Logged 2 items. Nasa history mo na sila.',
    confidenceLabel: 'high',
    previewState: { kind: 'logged' },
    quickReplies: ['Add another'],
    batch: {
      actions: [
        {
          id: 'tx-1',
          kind: 'transaction',
          entryType: 'expense',
          amount: 250,
          category: 'Food',
          description: 'Lunch',
          accountName: 'Cash',
          date: '2026-04-06T12:00:00.000Z',
          sourceText: '250 lunch',
        },
        {
          id: 'tx-2',
          kind: 'transaction',
          entryType: 'expense',
          amount: 100,
          category: 'Transportation',
          description: 'Mrt',
          accountName: 'Cash',
          date: '2026-04-06T12:00:00.000Z',
          sourceText: '100 mrt',
        },
      ],
    },
  };

  const markup = renderToStaticMarkup(
    <BerdeChatThread
      messages={[loggedBatchMessage]}
      sessionSummary={null}
      didClearThread={false}
      savingMessageId={null}
      threadEndRef={createRef<HTMLDivElement>()}
      onStarterPrompt={() => undefined}
      onQuickReply={() => undefined}
      onConfirmBatch={() => undefined}
      onCancelBatch={() => undefined}
    />,
  );

  assert.match(markup, /Logged 2 items/);
  assert.match(markup, /₱250\.00 expense · Food · Apr 6/);
  assert.match(markup, /₱100\.00 expense · Transportation · Apr 6/);
  assert.doesNotMatch(markup, /Action 1/);
});