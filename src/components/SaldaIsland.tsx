'use client';

type SaldaSection = 'hero' | 'why' | 'features' | 'how';
type SaldaExpression = 'neutral' | 'wise' | 'smile' | 'proud';
type SaldaExtra = 'tree' | 'coin' | 'flag';

interface SaldaIslandProps {
  section: SaldaSection;
}

const SECTION_CONFIG = {
  hero: {
    bubble: "Hi! Let's find where your money goes.",
    expression: 'neutral',
    extras: [],
  },
  why: {
    bubble: 'Most people just need more clarity.',
    expression: 'wise',
    extras: ['tree'],
  },
  features: {
    bubble: 'Track everything in one place.',
    expression: 'smile',
    extras: ['tree', 'coin'],
  },
  how: {
    bubble: "You're ready. Start free today!",
    expression: 'proud',
    extras: ['tree', 'coin', 'flag'],
  },
} as const satisfies Record<
  SaldaSection,
  {
    bubble: string;
    expression: SaldaExpression;
    extras: SaldaExtra[];
  }
>;

function SaldaExpressionLayer({ expression }: { expression: SaldaExpression }) {
  if (expression === 'neutral') {
    return (
      <>
        <path d="M52 38 Q59 35 66 38" stroke="#2C2520" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M64 38 Q71 35 78 38" stroke="#2C2520" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="59" cy="47" rx="7" ry="7" fill="#2C2520" />
        <ellipse cx="71" cy="47" rx="7" ry="7" fill="#2C2520" />
        <ellipse cx="56" cy="44" rx="3" ry="3" fill="white" opacity="0.85" />
        <ellipse cx="68" cy="44" rx="3" ry="3" fill="white" opacity="0.85" />
        <path d="M55 59 Q65 64 75 59" stroke="#2C2520" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    );
  }

  if (expression === 'wise') {
    return (
      <>
        <path d="M51 37 Q59 33 66 37" stroke="#2C2520" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M64 37 Q71 33 79 37" stroke="#2C2520" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="59" cy="47" rx="7" ry="5.5" fill="#2C2520" />
        <ellipse cx="71" cy="47" rx="7" ry="5.5" fill="#2C2520" />
        <ellipse cx="56" cy="44" rx="3" ry="2.5" fill="white" opacity="0.85" />
        <ellipse cx="68" cy="44" rx="3" ry="2.5" fill="white" opacity="0.85" />
        <path d="M55 59 Q65 65 75 59" stroke="#2C2520" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    );
  }

  if (expression === 'smile') {
    return (
      <>
        <path d="M51 36 Q59 32 66 36" stroke="#2C2520" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M64 36 Q71 32 79 36" stroke="#2C2520" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="59" cy="47" rx="7.5" ry="8" fill="#2C2520" />
        <ellipse cx="71" cy="47" rx="7.5" ry="8" fill="#2C2520" />
        <ellipse cx="56" cy="43" rx="3" ry="3" fill="white" opacity="0.85" />
        <ellipse cx="68" cy="43" rx="3" ry="3" fill="white" opacity="0.85" />
        <path d="M53 59 Q65 68 77 59" stroke="#2C2520" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    );
  }

  return (
    <>
      <path d="M50 35 Q59 30 66 35" stroke="#2C2520" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M64 35 Q71 30 80 35" stroke="#2C2520" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="59" cy="47" rx="7.5" ry="8" fill="#2C2520" />
      <ellipse cx="71" cy="47" rx="7.5" ry="8" fill="#2C2520" />
      <ellipse cx="56" cy="43" rx="3.5" ry="3.5" fill="white" opacity="0.9" />
      <ellipse cx="68" cy="43" rx="3.5" ry="3.5" fill="white" opacity="0.9" />
      <path d="M51 58 Q65 70 79 58" stroke="#2C2520" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="92" cy="38" r="2" fill="#E8C96B" />
      <circle cx="88" cy="30" r="1.2" fill="#1D9E75" />
      <circle cx="96" cy="29" r="1.5" fill="#E8C96B" />
    </>
  );
}

export default function SaldaIsland({ section }: SaldaIslandProps) {
  const config = SECTION_CONFIG[section];
  const extras = config.extras as readonly SaldaExtra[];

  return (
    <div
      className="salda-root pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col items-end"
      style={{ ['--salda-size' as string]: '130px' }}
      aria-hidden
    >
      <div
        key={`bubble-${section}`}
        className="salda-bubble mb-2 mr-2 max-w-[160px] self-end rounded-xl rounded-br-sm border border-[#E0D8C8] bg-white px-3 py-2 text-[11px] leading-snug text-[#3a3020] shadow-sm"
      >
        {config.bubble}
      </div>

      <div key={`island-${section}`} className="salda-enter salda-bob">
        <svg width="130" height="120" viewBox="0 0 130 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="65" cy="112" rx="46" ry="6" fill="rgba(0,0,0,0.07)" />
          <ellipse cx="65" cy="104" rx="44" ry="14" fill="#C8B98A" />
          <ellipse cx="65" cy="100" rx="44" ry="14" fill="#D9C99A" />
          <ellipse cx="65" cy="90" rx="44" ry="10" fill="#6BBF59" />
          <ellipse cx="65" cy="88" rx="40" ry="8" fill="#7DCF68" />

          {extras.includes('tree') && (
            <>
              <rect x="28" y="68" width="6" height="20" rx="3" fill="#8B6340" />
              <ellipse cx="31" cy="62" rx="13" ry="12" fill="#4CAF3F" />
              <ellipse cx="28" cy="56" rx="9" ry="8" fill="#5DC44F" />
            </>
          )}

          {extras.includes('coin') && (
            <>
              <ellipse cx="98" cy="84" rx="9" ry="9" fill="#E8C96B" />
              <ellipse cx="98" cy="84" rx="7" ry="7" fill="#D4B055" />
              <text x="98" y="88" textAnchor="middle" fontSize="8" fontWeight="500" fill="#A88030">
                ₱
              </text>
            </>
          )}

          {extras.includes('flag') && (
            <>
              <rect x="91" y="58" width="2" height="24" rx="1" fill="#888" />
              <path d="M93 60 L104 64 L93 68 Z" fill="#1D9E75" />
            </>
          )}

          <rect x="42" y="28" width="46" height="44" rx="14" fill="#FBF6EC" />
          <rect x="45" y="58" width="40" height="14" rx="8" fill="#EDE3CC" opacity="0.6" />
          <ellipse cx="52" cy="31" rx="7" ry="5" fill="#FBF6EC" />
          <ellipse cx="78" cy="31" rx="7" ry="5" fill="#FBF6EC" />
          <ellipse cx="52" cy="32" rx="4" ry="3" fill="#F0E8D0" />
          <ellipse cx="78" cy="32" rx="4" ry="3" fill="#F0E8D0" />
          <ellipse cx="48" cy="57" rx="7" ry="4" fill="#F2A66E" opacity="0.35" />
          <ellipse cx="82" cy="57" rx="7" ry="4" fill="#F2A66E" opacity="0.35" />
          <rect x="52" y="68" width="26" height="5" rx="2.5" fill="#1D9E75" opacity="0.85" />

          <SaldaExpressionLayer expression={config.expression} />
        </svg>
      </div>
    </div>
  );
}
