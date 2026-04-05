import assert from 'node:assert/strict';
import test from 'node:test';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BerdeChatThread from '@/components/berde-chat/BerdeChatThread';
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