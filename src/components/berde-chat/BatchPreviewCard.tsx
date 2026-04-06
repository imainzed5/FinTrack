import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import BerdeSprite from '@/components/BerdeSprite';
import {
  getCompactReceiptLine,
  getActionHeadline,
  getActionKindLabel,
  getActionMeta,
  getBatchSummary,
  getConfidenceBadgeClass,
  getLowConfidenceNote,
} from '@/lib/berde/chat/presenters';
import type { BerdeParsedActionBatch } from '@/lib/berde/chat.types';
import type { BerdeChatMessage } from '@/lib/berde/chat/thread';

export default function BatchPreviewCard(props: {
  message: Extract<BerdeChatMessage, { kind: 'preview' }>;
  showSprite: boolean;
  onConfirm: (messageId: string, batch: BerdeParsedActionBatch) => void;
  onCancel: (messageId: string) => void;
  saving: boolean;
  onQuickReply: (value: string) => void;
}) {
  const { message, onConfirm, onCancel, onQuickReply, saving, showSprite } = props;
  let statusCopy: string;
  let statusClass: string;

  switch (message.previewState.kind) {
    case 'pending':
      statusCopy = 'Review';
      statusClass = getConfidenceBadgeClass(message.confidenceLabel);
      break;
    case 'logged':
      statusCopy = 'Logged';
      statusClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      break;
    case 'cancelled':
      statusCopy = 'Cancelled';
      statusClass = 'bg-zinc-100 text-zinc-700 border-zinc-200';
      break;
  }

  const summaryBadge = message.batch.actions.length > 1 ? getBatchSummary(message.batch) : null;
  const showCardText = message.text.trim().length > 0;
  const lowConfidenceNote = message.previewState.kind === 'pending'
    ? getLowConfidenceNote(message.confidenceLabel)
    : null;
  const isLogged = message.previewState.kind === 'logged';
  const shouldShowSummaryBadge = !isLogged && summaryBadge;

  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <div className="flex h-[42px] w-[42px] shrink-0 items-start justify-center sm:h-[46px] sm:w-[46px] sm:items-end">
        {showSprite ? (
          <div className="rounded-2xl bg-[#0F6E56] p-1.5 shadow-[0_10px_24px_rgba(15,110,86,0.16)]">
            <BerdeSprite state="neutral" size={30} />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 max-w-[min(100%,58rem)] lg:max-w-[60rem]">
        <div className="rounded-[22px] rounded-bl-[10px] border border-[#bfe7d9] bg-[#f4fffa] px-4 py-3 text-zinc-900 shadow-[0_12px_28px_rgba(15,110,86,0.1)] sm:rounded-[26px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>
              {statusCopy}
            </span>
            {shouldShowSummaryBadge ? (
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                {shouldShowSummaryBadge}
              </span>
            ) : null}
          </div>

          {showCardText ? (
            <p className="mt-3 text-sm leading-6 text-zinc-700">{message.text}</p>
          ) : null}

          {isLogged ? (
            <div className="mt-4 rounded-2xl border border-white/90 bg-white px-3 py-3 sm:px-4">
              <p className="text-sm font-semibold text-zinc-900">
                Logged {message.batch.actions.length} item{message.batch.actions.length === 1 ? '' : 's'}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-700">
                {message.batch.actions.map((action) => (
                  <li key={action.id} className="flex gap-2">
                    <span className="mt-[3px] text-xs text-[#0F6E56]">•</span>
                    <span>{getCompactReceiptLine(action)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {message.batch.actions.map((action, index) => (
                <div key={action.id} className="rounded-2xl border border-white/90 bg-white px-3 py-3 sm:px-4">
                  {message.batch.actions.length === 1 && action.kind === 'transaction' ? (
                    <p className="text-base font-medium leading-tight text-zinc-900">
                      {getActionHeadline(action)}
                    </p>
                  ) : message.batch.actions.length === 1 ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div>
                        <p className="text-base font-semibold text-zinc-900">
                          {action.kind === 'debt' ? (action.debtMode === 'settle' ? getActionKindLabel(action) : 'Debt') : getActionKindLabel(action)}
                        </p>
                      </div>
                      <p className="text-base font-medium leading-tight text-zinc-900">
                        {getActionHeadline(action)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                          Action {index + 1}
                        </p>
                        <p className="mt-1 text-base font-semibold text-zinc-900">
                          {getActionKindLabel(action)}
                        </p>
                      </div>
                      <p className="text-base font-medium leading-tight text-zinc-900">
                        {getActionHeadline(action)}
                      </p>
                    </div>
                  )}

                  <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 text-sm text-zinc-600 min-[420px]:grid-cols-2 xl:grid-cols-3">
                    {getActionMeta(action).map((entry) => (
                      <div key={`${action.id}-${entry.label}`}>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                          {entry.label}
                        </p>
                        <p className="mt-1">{entry.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {message.previewState.kind === 'pending' ? (
            <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              <button
                type="button"
                onClick={() => onConfirm(message.id, message.batch)}
                disabled={saving}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#0F6E56] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0b5b47] disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {saving ? 'Logging...' : `Log ${message.batch.actions.length > 1 ? 'all' : 'it'}`}
              </button>
              <button
                type="button"
                onClick={() => onCancel(message.id)}
                disabled={saving}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
              >
                <XCircle size={16} />
                Cancel
              </button>
            </div>
          ) : null}

          {lowConfidenceNote ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              {lowConfidenceNote}
            </div>
          ) : null}

          {message.quickReplies && message.quickReplies.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {message.quickReplies.map((reply) => (
                <button
                  key={`${message.id}-${reply}`}
                  type="button"
                  onClick={() => onQuickReply(reply)}
                  className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE]"
                >
                  {reply}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
