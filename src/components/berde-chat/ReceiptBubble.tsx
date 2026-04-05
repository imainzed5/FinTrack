import { CheckCircle2 } from 'lucide-react';
import type { BerdeChatMessage } from '@/lib/berde/chat/thread';

export default function ReceiptBubble(props: {
  message: Extract<BerdeChatMessage, { kind: 'receipt' }>;
  onQuickReply: (value: string) => void;
}) {
  const { message, onQuickReply } = props;

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircle2 size={16} />
      </div>
      <div className="min-w-0 max-w-[min(84vw,44rem)] lg:max-w-[46rem]">
        <div className="rounded-[18px] border border-[#d8e6df] bg-white px-4 py-2.5 text-sm text-zinc-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
          {message.text}
        </div>
        {message.quickReplies && message.quickReplies.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
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
  );
}
