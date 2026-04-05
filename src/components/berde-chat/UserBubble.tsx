export default function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[min(76vw,24rem)] rounded-[24px] rounded-br-[10px] bg-[#0F6E56] px-4 py-3 text-sm font-medium leading-6 text-white shadow-[0_12px_24px_rgba(15,110,86,0.18)] lg:max-w-[28rem]">
        {text}
      </div>
    </div>
  );
}
