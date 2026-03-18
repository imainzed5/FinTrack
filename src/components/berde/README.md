# Berde — Moneda's Mascot System

## Files

| File | Purpose |
|---|---|
| `berde.types.ts` | Shared TypeScript types |
| `berde.logic.ts` | State resolution + quote selection (pure, testable) |
| `BerdeSprite.tsx` | Pixel-art canvas renderer with blink + bounce animation |
| `BerdeCard.tsx` | Full dashboard card component |
| `useBerdeInputs.ts` | Hook to derive BerdeInputs from DashboardData |

## Usage in DashboardClientPage.tsx

```tsx
import BerdeCard from '@/components/berde/BerdeCard';
import { useBerdeInputs } from '@/components/berde/useBerdeInputs';

export default function DashboardClientPage({ data }: { data: DashboardData }) {
  const berdeInputs = useBerdeInputs(data, data.recentTransactions, daysUntilPayday);

  return (
    <>
      <BerdeCard inputs={berdeInputs} className="mb-4" />
      {/* rest of dashboard */}
    </>
  );
}
```

## State Priority

```
hype > worried > proud > sarcastic > neutral
```

First matching trigger wins. See `berde.logic.ts` for full priority chain.

## Adding New Triggers

1. Add the signal to `BerdeInputs` in `berde.types.ts`
2. Add a quote to the relevant state array in `QUOTES` in `berde.logic.ts`
3. Add the condition in `resolveBerdeState()` at the correct priority level
4. Pass the new value through `useBerdeInputs.ts`

## Extending States

To add a 6th state (e.g. `confused`):
1. Add `'confused'` to the `BerdeState` union in `berde.types.ts`
2. Add `EYES.confused`, `MOUTHS.confused`, `BROWS.confused`, `EXTRAS.confused` in `BerdeSprite.tsx`
3. Add `STATE_BG.confused` in `BerdeCard.tsx`
4. Add quotes and trigger logic in `berde.logic.ts`
