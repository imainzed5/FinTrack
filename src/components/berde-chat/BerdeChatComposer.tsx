import type { KeyboardEvent, RefObject } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { getActionFocusLabel } from '@/lib/berde/chat/presenters';
import type { BerdeChatIntent, BerdeParsedAction } from '@/lib/berde/chat.types';

interface FocusedAction {
  action: BerdeParsedAction;
  index: number;
  total: number;
}

export default function BerdeChatComposer(props: {
  activeIntent: BerdeChatIntent | null;
  focusedAction: FocusedAction | null;
  input: string;
  savingMessageId: string | null;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onQuickReply: (value: string) => void;
  onSubmit: () => void;
}) {
  const {
    activeIntent,
    composerRef,
    focusedAction,
    input,
    onInputChange,
    onQuickReply,
    onSubmit,
    savingMessageId,
  } = props;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !savingMessageId) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="border-t border-[#dfe7e3] bg-white/90 px-3 py-3 backdrop-blur-sm sm:px-5 sm:py-4 lg:px-8 lg:py-5">
      <div className="mx-auto w-full max-w-none rounded-[24px] border border-zinc-200 bg-white p-3 shadow-[0_18px_36px_rgba(16,24,40,0.08)]">
        {(activeIntent?.stage === 'collecting_field' || activeIntent?.stage === 'awaiting_confirmation') ? (
          <div className="mb-2 hidden flex-wrap items-center gap-2 px-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400 md:flex">
            {activeIntent?.stage === 'collecting_field' ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Waiting on one missing detail
              </span>
            ) : null}
            {activeIntent?.stage === 'awaiting_confirmation' ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Draft ready
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mb-2 flex items-center justify-end gap-2 px-1 md:hidden">
          {activeIntent?.stage === 'collecting_field' ? (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              One detail left
            </span>
          ) : null}
        </div>

        {activeIntent?.quickReplies && activeIntent.quickReplies.length > 0 && activeIntent.stage === 'collecting_field' ? (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {activeIntent.quickReplies.map((reply) => (
              <button
                key={`composer-${reply}`}
                type="button"
                onClick={() => onQuickReply(reply)}
                className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE]"
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}

        {focusedAction ? (
          <div className="mb-3 rounded-2xl border border-[#cfe8dd] bg-[#f6fffb] px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                Item {focusedAction.index + 1} needs input
              </span>
              <span className="text-xs font-medium text-zinc-700">
                {getActionFocusLabel(focusedAction.action)}
              </span>
            </div>
            {focusedAction.total > 1 ? (
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Berde is only waiting on this one action. The other {focusedAction.total - 1} item{focusedAction.total - 1 === 1 ? '' : 's'} {focusedAction.total - 1 === 1 ? 'stays' : 'stay'} as parsed.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <textarea
            ref={composerRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="What happened today?"
            className="min-h-[56px] flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#1D9E75] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!input.trim() || Boolean(savingMessageId)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#0F6E56] text-white transition-colors hover:bg-[#0b5b47] disabled:cursor-not-allowed disabled:bg-zinc-300"
            aria-label="Send message to Berde"
          >
            <Send size={18} />
          </button>
        </div>

        <div className="mt-2 hidden items-center gap-2 px-1 text-xs text-zinc-500 md:flex">
          <Sparkles size={14} className="text-[#0F6E56]" />
          Rules first. No AI required for these common logging flows.
        </div>
      </div>
    </div>
  );
}