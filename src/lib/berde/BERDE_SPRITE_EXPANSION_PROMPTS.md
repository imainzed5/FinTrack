# Berde Sprite Expansion Art Prompt

Use this prompt pack to produce new Berde states in the exact Moneda sprite style.

## Global Style Lock

- Character: Berde, rounded leafy mascot, same body proportions as existing sprites.
- Art style: retro pixel art, clean silhouette, readable at small size.
- Canvas: 24x24 logical pixel grid.
- Export size: keep native 24x24 sprite and also provide upscaled 4x preview (96x96) using nearest-neighbor scaling.
- Background: transparent.
- Outline and shading: match existing Berde shading (dark green outline, light mint interior highlights).
- Do not anti-alias.
- Keep visual center aligned with existing baseline pose.

## Locked Palette

Use only these core colors unless there is an approved style expansion:

- Primary green: #1D9E75
- Dark green: #0F6E56
- Highlight green: #5DCAA5
- Mint fill: #E1F5EE
- Deep line color: #085041
- Accent orange: #D85A30
- Accent yellow: #FAC775
- Iris purple: #3C3489
- Spark yellow-orange: #EF9F27

## State 1: Motivational

Context: user is making progress, but slowly; Berde gives a pep talk.

Visual direction:

- Supportive expression, confident eyes.
- Warm smile (encouraging, not overhyped).
- One small thumbs-up gesture or compact arm bump shape.
- Optional tiny spark near raised side to suggest momentum.

Prompt:

"Create a 24x24 transparent-background pixel art sprite of Berde, Moneda's green mascot, in a motivational pose. Keep the same body shape and palette as existing Berde sprites. Expression should feel supportive and encouraging: focused eyes, slight smile, reassuring confidence. Add a subtle thumbs-up gesture with minimal pixels so readability remains clear at tiny sizes. Retro game sprite quality, no anti-aliasing, crisp nearest-neighbor look."

## State 2: Celebratory

Context: major wins like debt-free moment or huge savings goal reached.

Visual direction:

- Big joyful grin.
- Raised arms or lifted side accents.
- Confetti/spark particles around head.
- Highest positive energy among all states.

Prompt:

"Create a 24x24 transparent pixel art sprite of Berde in a celebratory party pose after a major financial achievement. Keep exact Moneda Berde style, shape, and palette. Give Berde a big smile, raised arms, and clear joyful eyes. Add compact confetti bits and spark particles around the character while preserving silhouette readability. No anti-aliasing, consistent pixel density, same proportion as neutral Berde."

Optional animation notes:

- 4-frame loop.
- Confetti falls vertically while Berde does a tiny 1px bounce every 2 frames.
- Keep body redraw minimal; animate mostly confetti and mouth/eye sparkle.

## State 3: Helper

Context: settings and budget setup, Berde acting as guide.

Visual direction:

- Friendly, attentive expression.
- Calm smile with "ready to assist" posture.
- Add a tiny prop: clipboard, note card, or pointer stick.
- Should read as practical and helpful, not hype.

Prompt:

"Create a 24x24 transparent pixel sprite of Berde in helper/assistant mode for a finance app settings page. Keep existing Berde visual style and locked palette. Expression should be friendly and helpful, with calm eyes and a small polite smile. Include a minimal assistant prop (tiny clipboard or pointer) using very few pixels. The result should feel guiding and trustworthy, still playful. Crisp pixel edges, no anti-aliasing."

## State 4: Excited (Optional but recommended)

Context: streak unlocked, surprise win, burst of good momentum.

Visual direction:

- More energetic than hype, but less "party" than celebratory.
- Wide sparkling eyes.
- Open grin and slight jump impression.
- A few energy sparks near top corners.

Prompt:

"Create a 24x24 transparent pixel art Berde sprite in an excited burst pose, matching Moneda's existing mascot style and palette. Show high energy with wide sparkling eyes, open happy grin, and slight jump/bounce posture. Add a few tiny energy spark accents around Berde. Keep readability at small sizes and preserve original character proportions. No anti-aliasing, retro sprite style."

Optional animation notes:

- 3-frame loop.
- Frame A: base pose.
- Frame B: body lifted by 1px, eyes brighter.
- Frame C: return with sparkle offset.

## Export Checklist

- `berde_motivational.png`
- `berde_celebratory.png`
- `berde_helper.png`
- `berde_excited.png` (optional)
- `berde_celebratory_strip.png` (optional animated strip)
- `berde_excited_strip.png` (optional animated strip)

All files should be transparent PNG and aligned to same anchor as existing Berde sprites for drop-in replacement.
