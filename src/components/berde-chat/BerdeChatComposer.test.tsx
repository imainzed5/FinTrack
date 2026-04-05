import assert from 'node:assert/strict';
import test from 'node:test';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BerdeChatComposer from '@/components/berde-chat/BerdeChatComposer';
import type { BerdeChatIntent } from '@/lib/berde/chat.types';

const followUpIntent: BerdeChatIntent = {
  kind: 'ambiguous',
  stage: 'collecting_field',
  confidence: 0.65,
  confidenceLabel: 'medium',
  missingFields: ['category'],
  expectedField: 'category',
  quickReplies: ['Food', 'Transportation'],
  batch: {
    actions: [
      {
        id: 'tx-1',
        kind: 'transaction',
        entryType: 'expense',
        amount: 120,
        category: 'Food',
        description: 'Coffee',
        date: '2026-04-06T09:00:00.000Z',
        sourceText: 'coffee 120',
      },
      {
        id: 'tx-2',
        kind: 'transaction',
        entryType: 'expense',
        amount: 80,
        description: 'Lunch',
        date: '2026-04-06T12:00:00.000Z',
        sourceText: 'lunch 80',
      },
    ],
    focusActionIndex: 1,
  },
};

test('BerdeChatComposer renders follow-up quick replies and focused-action guidance', () => {
  const markup = renderToStaticMarkup(
    <BerdeChatComposer
      activeIntent={followUpIntent}
      focusedAction={{
        action: followUpIntent.batch!.actions[1],
        index: 1,
        total: 2,
      }}
      input=""
      savingMessageId={null}
      composerRef={createRef<HTMLTextAreaElement>()}
      onInputChange={() => undefined}
      onQuickReply={() => undefined}
      onSubmit={() => undefined}
    />,
  );

  assert.match(markup, /Waiting on one missing detail/);
  assert.match(markup, /One detail left/);
  assert.match(markup, /Item 2 needs input/);
  assert.match(markup, /Lunch/);
  assert.match(markup, /The other 1 item stays as parsed\./);
  assert.match(markup, /Food/);
  assert.match(markup, /Transportation/);
});