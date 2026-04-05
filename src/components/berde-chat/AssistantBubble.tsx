import BerdeSprite from '@/components/BerdeSprite';

export default function AssistantBubble(props: {
  message: {
    id: string;
    role: 'berde';
    kind: 'text';
    text: string;
    spriteState?: 'neutral' | 'helper' | 'excited';
    quickReplies?: string[];
  };
  showSprite: boolean;
  onQuickReply: (value: string) => void;
}) {
  const { message, onQuickReply, showSprite } = props;

  return (
    <div className="flex items-end gap-3">
      <div className="flex h-[46px] w-[46px] shrink-0 items-end justify-center">
        {showSprite ? (
          <div className="rounded-2xl bg-[#0F6E56] p-1.5 shadow-[0_10px_24px_rgba(15,110,86,0.16)]">
            <BerdeSprite state={message.spriteState ?? 'neutral'} size={34} />
          </div>
        ) : null}
      </div>
      <div className="max-w-[min(84vw,44rem)] lg:max-w-[46rem]">
        <div className="rounded-[24px] rounded-bl-[10px] border border-[#d8e6df] bg-white px-4 py-3 text-sm leading-6 text-zinc-700 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
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
