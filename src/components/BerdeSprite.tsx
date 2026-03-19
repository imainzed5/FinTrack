'use client';

import { useEffect, useRef } from 'react';
import type { BerdeState } from '@/lib/berde/berde.types';

interface BerdeSprite {
  size?: number;   // rendered px size (default 64)
  state: BerdeState;
  animated?: boolean;
}

const GRID = 24; // pixel art grid size

type PaletteKey = 'G' | 'g' | 'L' | 'W' | 'K' | 'R' | 'X' | 'P' | 'Y';
type Pixel = [number, number, PaletteKey];

const PAL: Record<PaletteKey, string> = {
  G: '#1D9E75', g: '#0F6E56', L: '#5DCAA5', W: '#E1F5EE',
  K: '#085041', R: '#D85A30', X: '#FAC775', P: '#3C3489', Y: '#EF9F27',
};

// ── Pixel builders ────────────────────────────────────────────

function baseBody(): Pixel[] {
  const p: Pixel[] = [];
  for (let y = 1; y <= 22; y++) {
    let x1 = 1, x2 = 22;
    if (y === 1 || y === 22) { x1 = 5; x2 = 18; }
    else if (y === 2 || y === 21) { x1 = 3; x2 = 20; }
    else if (y === 3 || y === 20) { x1 = 2; x2 = 21; }
    for (let x = x1; x <= x2; x++) p.push([x, y, 'G']);
  }
  for (let y = 3; y <= 20; y++) {
    for (let x = 3; x <= 20; x++) p.push([x, y, 'W']);
  }
  const bodyHighlights: Array<[number, number]> = [
    [5, 2], [6, 2], [7, 2], [4, 3], [5, 3], [6, 3],
    [3, 4], [4, 4], [5, 4], [3, 5], [4, 5],
  ];
  bodyHighlights.forEach(([x, y]) => p.push([x, y, 'L']));
  p.push([11,0,'g'],[12,0,'g'],[11,1,'g'],[12,1,'g']);
  const sideAccents: Array<[number, number]> = [
    [2, 12], [3, 12], [4, 12], [2, 13], [3, 13],
    [19, 12], [20, 12], [21, 12], [20, 13], [21, 13],
  ];
  sideAccents.forEach(([x, y]) => p.push([x, y, 'X']));
  return p;
}

const EYES: Record<BerdeState, Pixel[]> = {
  neutral: [
    ...[5,6,7,8].flatMap(x => [[x,9,'K'],[x,10,'K'],[x,11,'K'],[x,12,'K']] as Pixel[]),
    [6,10,'P'],[7,10,'P'],[6,9,'W'],[7,9,'W'],
    ...[15,16,17,18].flatMap(x => [[x,9,'K'],[x,10,'K'],[x,11,'K'],[x,12,'K']] as Pixel[]),
    [16,10,'P'],[17,10,'P'],[16,9,'W'],[17,9,'W'],
  ],
  proud: [
    [5,11,'K'],[6,10,'K'],[7,10,'K'],[8,11,'K'],[5,12,'K'],[8,12,'K'],
    [15,11,'K'],[16,10,'K'],[17,10,'K'],[18,11,'K'],[15,12,'K'],[18,12,'K'],
  ],
  worried: [
    [4,9,'Y'],[5,9,'Y'],[6,9,'Y'],[7,9,'Y'],[8,9,'Y'],[9,9,'Y'],
    [4,10,'Y'],[9,10,'Y'],[4,11,'Y'],[9,11,'Y'],
    [4,12,'Y'],[5,12,'Y'],[6,12,'Y'],[7,12,'Y'],[8,12,'Y'],[9,12,'Y'],
    [5,10,'K'],[6,10,'K'],[7,10,'K'],[8,10,'K'],
    [5,11,'K'],[6,11,'K'],[7,11,'K'],[8,11,'K'],
    [5,9,'W'],[6,9,'W'],
    [14,9,'Y'],[15,9,'Y'],[16,9,'Y'],[17,9,'Y'],[18,9,'Y'],[19,9,'Y'],
    [14,10,'Y'],[19,10,'Y'],[14,11,'Y'],[19,11,'Y'],
    [14,12,'Y'],[15,12,'Y'],[16,12,'Y'],[17,12,'Y'],[18,12,'Y'],[19,12,'Y'],
    [15,10,'K'],[16,10,'K'],[17,10,'K'],[18,10,'K'],
    [15,11,'K'],[16,11,'K'],[17,11,'K'],[18,11,'K'],
    [15,9,'W'],[16,9,'W'],
  ],
  hype: [
    [4,8,'Y'],[5,8,'Y'],[6,8,'Y'],[7,8,'Y'],[8,8,'Y'],[9,8,'Y'],
    [4,9,'Y'],[9,9,'Y'],[4,10,'Y'],[9,10,'Y'],
    [4,11,'Y'],[5,11,'Y'],[6,11,'Y'],[7,11,'Y'],[8,11,'Y'],[9,11,'Y'],
    [5,9,'K'],[6,9,'K'],[7,9,'K'],[8,9,'K'],
    [5,10,'K'],[6,10,'K'],[7,10,'K'],[8,10,'K'],
    [5,8,'W'],[6,8,'W'],
    [14,8,'Y'],[15,8,'Y'],[16,8,'Y'],[17,8,'Y'],[18,8,'Y'],[19,8,'Y'],
    [14,9,'Y'],[19,9,'Y'],[14,10,'Y'],[19,10,'Y'],
    [14,11,'Y'],[15,11,'Y'],[16,11,'Y'],[17,11,'Y'],[18,11,'Y'],[19,11,'Y'],
    [15,9,'K'],[16,9,'K'],[17,9,'K'],[18,9,'K'],
    [15,10,'K'],[16,10,'K'],[17,10,'K'],[18,10,'K'],
    [15,8,'W'],[16,8,'W'],
  ],
  sarcastic: [
    ...[5,6,7,8].flatMap(x => [[x,9,'K'],[x,10,'K'],[x,11,'K'],[x,12,'K']] as Pixel[]),
    [7,10,'P'],[8,10,'P'],[7,9,'W'],
    ...[15,16,17,18].flatMap(x => [[x,9,'K'],[x,10,'K'],[x,11,'K'],[x,12,'K']] as Pixel[]),
    [17,10,'P'],[18,10,'P'],[17,9,'W'],
  ],
};

const MOUTHS: Record<BerdeState, Pixel[]> = {
  neutral: [
    [10,17,'K'],[11,17,'K'],[12,17,'K'],[13,17,'K'],[14,17,'K'],[15,17,'K'],
    [15,18,'K'],[10,18,'K'],
    [11,18,'R'],[12,18,'R'],[13,18,'R'],[14,18,'R'],
    [10,16,'K'],[11,16,'K'],
  ],
  proud: [
    [9,17,'K'],[10,16,'K'],[11,16,'K'],[12,17,'K'],[13,16,'K'],[14,16,'K'],[15,17,'K'],
    [10,17,'K'],[11,17,'K'],[13,17,'K'],[14,17,'K'],
  ],
  worried: [
    [10,18,'K'],[11,18,'K'],[12,18,'K'],[13,18,'K'],[14,18,'K'],
    [10,17,'K'],[14,17,'K'],[9,17,'K'],[15,17,'K'],
    [11,18,'R'],[12,18,'R'],[13,18,'R'],
  ],
  hype: [
    [8,17,'K'],[9,17,'K'],[10,17,'K'],[11,17,'K'],[12,17,'K'],
    [13,17,'K'],[14,17,'K'],[15,17,'K'],[16,17,'K'],
    [8,18,'K'],[16,18,'K'],
    [9,18,'W'],[10,18,'W'],[11,18,'W'],[12,18,'W'],[13,18,'W'],[14,18,'W'],[15,18,'W'],
    [9,19,'R'],[10,19,'R'],[11,19,'R'],[12,19,'R'],[13,19,'R'],[14,19,'R'],[15,19,'R'],
    [8,19,'K'],[16,19,'K'],
  ],
  sarcastic: [
    [10,17,'K'],[11,17,'K'],[12,17,'K'],[13,17,'K'],[14,17,'K'],[15,17,'K'],
    [15,18,'K'],[10,18,'K'],
    [11,18,'R'],[12,18,'R'],[13,18,'R'],[14,18,'R'],
    [10,16,'K'],[11,16,'K'],
  ],
};

const BROWS: Record<BerdeState, Pixel[]> = {
  neutral: [[5,7,'g'],[6,7,'g'],[7,7,'g'],[8,7,'g'],[15,7,'g'],[16,7,'g'],[17,7,'g'],[18,7,'g']],
  proud:   [[5,6,'g'],[6,6,'g'],[7,6,'g'],[8,6,'g'],[15,6,'g'],[16,6,'g'],[17,6,'g'],[18,6,'g']],
  worried: [[5,7,'g'],[6,7,'g'],[7,8,'g'],[8,8,'g'],[15,8,'g'],[16,8,'g'],[17,7,'g'],[18,7,'g']],
  hype:    [[5,5,'g'],[6,5,'g'],[7,5,'g'],[8,5,'g'],[15,5,'g'],[16,5,'g'],[17,5,'g'],[18,5,'g']],
  sarcastic:[[5,8,'g'],[6,8,'g'],[7,7,'g'],[8,7,'g'],[15,7,'g'],[16,7,'g'],[17,7,'g'],[18,7,'g']],
};

const EXTRAS: Record<BerdeState, Pixel[]> = {
  neutral:   [],
  proud:     [],
  worried:   [[21,5,'L'],[21,6,'L'],[22,6,'L']],
  hype:      [[1,3,'Y'],[3,1,'Y'],[20,2,'Y'],[22,4,'Y'],[0,9,'Y'],[23,7,'Y']],
  sarcastic: [],
};

function buildPixels(state: BerdeState): Pixel[] {
  return [
    ...baseBody(),
    ...BROWS[state],
    ...EYES[state],
    ...MOUTHS[state],
    ...EXTRAS[state],
  ];
}

function renderPixels(ctx: CanvasRenderingContext2D, pixels: Pixel[], scale: number, offsetY = 0) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const [x, y, c] of pixels) {
    ctx.fillStyle = PAL[c];
    ctx.fillRect(x * scale, (y + offsetY) * scale, scale, scale);
  }
}

// ── Component ────────────────────────────────────────────────

export default function BerdeSprite({ size = 64, state, animated = true }: BerdeSprite) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const rafRef = useRef<number>(0);
  const fallbackPixelRatio = 2;

  const scale = size / GRID;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const pixelRatio = Math.max(window.devicePixelRatio || 1, fallbackPixelRatio);

    canvas.width = Math.max(1, Math.round(size * pixelRatio));
    canvas.height = Math.max(1, Math.round(size * pixelRatio));
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    let blinkTimer = 0;
    let blinkPhase: 'open' | 'closing' | 'opening' = 'open';
    let blinkProgress = 0;
    let bounceY = 0;
    let bounceT = -1;
    let prevState = stateRef.current;
    let lastTs = 0;

    const loop = (ts: number) => {
      const dt = ts - lastTs;
      lastTs = ts;

      const currentState = stateRef.current;

      // Bounce on state change
      if (currentState !== prevState) {
        prevState = currentState;
        bounceT = 0;
      }
      if (bounceT >= 0) {
        bounceT += 0.35;
        bounceY = -Math.abs(Math.sin(bounceT)) * 2;
        if (bounceT >= Math.PI * 1.5) { bounceT = -1; bounceY = 0; }
      }

      // Blink
      if (animated) {
        blinkTimer += dt;
        if (blinkPhase === 'open' && blinkTimer > 2800) { blinkPhase = 'closing'; blinkTimer = 0; }
        else if (blinkPhase === 'closing') {
          blinkProgress = Math.min(blinkTimer / 80, 1);
          if (blinkProgress >= 1) { blinkPhase = 'opening'; blinkTimer = 0; }
        } else if (blinkPhase === 'opening') {
          blinkProgress = 1 - Math.min(blinkTimer / 80, 1);
          if (blinkProgress <= 0) { blinkPhase = 'open'; blinkTimer = 0; blinkProgress = 0; }
        }
      }

      const pixels = buildPixels(currentState);

      // Apply blink (draw lid over eyes)
      if (blinkProgress > 0) {
        const lidRows = Math.round(blinkProgress * 4);
        for (let i = 0; i < lidRows; i++) {
          for (let x = 4; x <= 9; x++) pixels.push([x, 9 + i, 'G']);
          for (let x = 14; x <= 19; x++) pixels.push([x, 9 + i, 'G']);
        }
      }

      renderPixels(ctx, pixels, scale, bounceY);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(ts => { lastTs = ts; loop(ts); });
    return () => cancelAnimationFrame(rafRef.current);
  }, [size, scale, animated]);

  // Update state ref without restarting the animation loop
  useEffect(() => { stateRef.current = state; }, [state]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.max(1, Math.round(size * fallbackPixelRatio))}
      height={Math.max(1, Math.round(size * fallbackPixelRatio))}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
      aria-label={`Berde is ${state}`}
    />
  );
}
