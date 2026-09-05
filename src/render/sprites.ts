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
import coinPng from '../assets/coin.png';
import heartPng from '../assets/heart.png';
import norahPng from '../assets/norah.png';
import petePng from '../assets/pete.png';
import samPng from '../assets/sam.png';
import skyePng from '../assets/skye.png';
import walterPng from '../assets/walter.png';

/** Only the characters that have been drawn. The rest fall back to emoji. */
const TOWER_ART: Partial<Record<TowerId, string>> = {
  barbara: barbaraPng,
  norah: norahPng,
  pete: petePng,
  walter: walterPng,
};

const ENEMY_ART: Partial<Record<EnemyId, string>> = {
  sam: samPng,
  skye: skyePng,
};

/** Small pictures that belong to the readouts rather than to a character. */
export type IconId = 'coin' | 'heart';

const ICON_ART: Partial<Record<IconId, string>> = {
  coin: coinPng,
  heart: heartPng,
};

/**
 * What stands in until an icon has been drawn.
 *
 * Every icon needs one, so a readout can name a picture before the artwork
 * exists and still have something to show.
 */
const ICON_GLYPH: Record<IconId, string> = {
  coin: '\u{1FA99}',
  heart: '\u{2764}\u{FE0F}',
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

/**
 * The address of a tower's picture, for the places that want an `<img>`
 * rather than something to draw on a canvas -- `null` if it has none yet.
 */
export function towerArtUrl(id: TowerId): string | null {
  return TOWER_ART[id] ?? null;
}

/** The tower's picture, or `null` while it loads or if it was never drawn. */
export function towerSprite(id: TowerId): HTMLImageElement | null {
  return ready(TOWER_ART[id]);
}

/** The troublemaker's picture, on the same terms. */
export function enemySprite(id: EnemyId): HTMLImageElement | null {
  return ready(ENEMY_ART[id]);
}

/** The readout's picture, or `null` while it loads or before it is drawn. */
export function iconSprite(id: IconId): HTMLImageElement | null {
  return ready(ICON_ART[id]);
}

/** The emoji drawn in an icon's place while it has no picture. */
export function iconGlyph(id: IconId): string {
  return ICON_GLYPH[id];
}
