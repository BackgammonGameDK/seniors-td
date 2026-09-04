/**
 * The painted artwork, loaded once and handed to the canvas.
 *
 * This lives in `src/render/` rather than beside the names and colours in
 * `src/shared/display.ts` for one concrete reason: importing a `.png` is a
 * bundler feature, and `src/shared/` is imported by `npm run sim`, which is
 * plain Node with no bundler in front of it. A picture import there would
 * break headless playtesting the moment it was added.
 *
 * Art is optional and arrives a character at a time. A tower or troublemaker
 * with no entry below -- or whose picture has not finished downloading -- is
 * drawn with the emoji glyph from `display.ts` instead, so the board is never
 * missing a piece and half-finished artwork can be committed safely.
 */
import type { EnemyId, TowerId } from '../sim/types.ts';

import barbaraPng from '../assets/barbara.png';
import norahPng from '../assets/norah.png';
import samPng from '../assets/sam.png';
import skyePng from '../assets/skye.png';
import walterPng from '../assets/walter.png';

/** Only the characters that have been drawn. The rest fall back to emoji. */
const TOWER_ART: Partial<Record<TowerId, string>> = {
  barbara: barbaraPng,
  norah: norahPng,
  walter: walterPng,
};

const ENEMY_ART: Partial<Record<EnemyId, string>> = {
  sam: samPng,
  skye: skyePng,
};

const images = new Map<string, HTMLImageElement>();

/**
 * Loading is lazy, started by the first frame that wants the picture.
 *
 * Nothing is loaded when the module is merely imported, which keeps this file
 * harmless in a test that runs without a DOM.
 */
function image(url: string): HTMLImageElement {
  const existing = images.get(url);
  if (existing !== undefined) return existing;
  const img = new Image();
  img.src = url;
  images.set(url, img);
  return img;
}

function ready(url: string | undefined): HTMLImageElement | null {
  if (url === undefined) return null;
  const img = image(url);
  // `complete` alone is true for a failed load too, so the natural size is
  // what actually says a picture arrived and can be drawn.
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** The tower's picture, or `null` while it loads or if it was never drawn. */
export function towerSprite(id: TowerId): HTMLImageElement | null {
  return ready(TOWER_ART[id]);
}

/** The troublemaker's picture, on the same terms. */
export function enemySprite(id: EnemyId): HTMLImageElement | null {
  return ready(ENEMY_ART[id]);
}
