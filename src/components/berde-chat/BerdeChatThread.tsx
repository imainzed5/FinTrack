import type { RefObject } from 'react';
import BerdeSprite from '@/components/BerdeSprite';
import AssistantBubble from '@/components/berde-chat/AssistantBubble';
import BatchPreviewCard from '@/components/berde-chat/BatchPreviewCard';
import ReceiptBubble from '@/components/berde-chat/ReceiptBubble';
import UserBubble from '@/components/berde-chat/UserBubble';
import type { BerdeParsedActionBatch } from '@/lib/berde/chat.types';
import type { BerdeChatMessage } from '@/lib/berde/chat/thread';
import { EMPTY_STATE_CHIPS } from '@/lib/berde/chat/ui-config';
import { formatCurrency } from '@/lib/utils';

interface SessionSummary {
  count: number;
  expenseTotal: number;
  incomeTotal: number;
  debtMoves: number;
}

export default function BerdeChatThread(props: {
  messages: BerdeChatMessage[];
  sessionSummary: SessionSummary | null;
  didClearThread: boolean;
  savingMessageId: string | null;
  threadEndRef: RefObject<HTMLDivElement | null>;
  onStarterPrompt: (value: string, mode: 'submit' | 'seed') => void;
  onQuickReply: (value: string) => void;
  onConfirmBatch: (messageId: string, batch: BerdeParsedActionBatch) => void;
  onCancelBatch: (messageId: string) => void;
}) {
  const {
    didClearThread,
    messages,
    onCancelBatch,
    onConfirmBatch,
    onQuickReply,
    onStarterPrompt,
    savingMessageId,
    sessionSummary,
    threadEndRef,
  } = props;

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
      <div className="flex flex-col">
        {sessionSummary ? (
          <div className="mb-4 rounded-[20px] border border-[#d7eadf] bg-[#f7fffb] px-4 py-3 text-sm text-zinc-700 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0F6E56]">
                This session
              </span>
              <span className="text-sm font-medium text-zinc-900">
                {sessionSummary.count} logged item{sessionSummary.count === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
              <span>Expenses: {formatCurrency(sessionSummary.expenseTotal)}</span>
              <span>Income: {formatCurrency(sessionSummary.incomeTotal)}</span>
              <span>Debt moves: {sessionSummary.debtMoves}</span>
            </div>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="flex min-h-[9.5rem] flex-col items-start justify-center rounded-[20px] border border-dashed border-[#cfe7dd] bg-[linear-gradient(180deg,#f8fffb_0%,#ffffff_100%)] px-4 py-4 text-left md:min-h-[18rem] md:items-center md:rounded-[24px] md:px-5 md:py-8 md:text-center lg:min-h-[22rem] lg:rounded-[28px] lg:px-6 lg:py-10">
            <div className="rounded-2xl bg-[#0F6E56] p-2 shadow-[0_14px_28px_rgba(15,110,86,0.12)]">
              <BerdeSprite state="helper" size={40} />
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold text-zinc-900 md:mt-4 md:text-xl">
              Fresh chat, ready when you are
            </h2>
            <p className="mt-1 max-w-md text-sm leading-5 text-zinc-600 md:mt-2 md:leading-6">
              {didClearThread
                ? 'Your last thread was cleared. Start another quick log and Berde will draft it before anything gets saved.'
                : 'Start another quick log and Berde will draft it before anything gets saved.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 md:mt-4 md:justify-center">
              {EMPTY_STATE_CHIPS.map((chip, index) => (
                <button
                  key={`empty-${chip.label}`}
                  type="button"
                  onClick={() => onStarterPrompt(chip.value, chip.mode)}
                  className={`items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE] ${
                    index < 2 ? 'inline-flex' : 'hidden md:inline-flex'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const previousMessage = messages[index - 1];
          const nextMessage = messages[index + 1];
          const showAssistantSprite = message.role === 'berde' && nextMessage?.role !== 'berde';
          const isGroupedReceipt =
            message.kind === 'receipt'
            && previousMessage?.kind === 'receipt'
            && Boolean(message.receiptMeta?.batchId)
            && message.receiptMeta?.batchId === previousMessage.receiptMeta?.batchId;
          const rowSpacingClass =
            index === 0
              ? ''
              : isGroupedReceipt
                ? 'mt-2'
                : previousMessage?.role === 'berde' && message.role === 'berde'
                  ? 'mt-2'
                  : 'mt-5';

          if (message.role === 'user') {
            return (
              <div key={message.id} className={rowSpacingClass}>
                <UserBubble text={message.text} />
              </div>
            );
          }

          if (message.kind === 'preview') {
            return (
              <div key={message.id} className={rowSpacingClass}>
                <BatchPreviewCard
                  message={message}
                  showSprite={showAssistantSprite}
                  onConfirm={onConfirmBatch}
                  onCancel={onCancelBatch}
                  onQuickReply={onQuickReply}
                  saving={savingMessageId === message.id}
                />
              </div>
            );
          }

          if (message.kind === 'receipt') {
            return (
              <div key={message.id} className={rowSpacingClass}>
                <ReceiptBubble message={message} onQuickReply={onQuickReply} />
              </div>
            );
          }

          return (
            <div key={message.id} className={rowSpacingClass}>
              <AssistantBubble
                message={{
                  id: message.id,
                  role: 'berde',
                  kind: 'text',
                  text: message.text,
                  spriteState: message.spriteState,
                  quickReplies: message.quickReplies,
                }}
                showSprite={showAssistantSprite}
                onQuickReply={onQuickReply}
              />
            </div>
          );
        })}

        <div ref={threadEndRef} />
      </div>
    </div>
  );
}