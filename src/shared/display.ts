/**
 * Everything the game looks and reads like, kept out of the simulation.
 *
 * `src/sim/` owns numbers that decide what happens; this module owns names,
 * colours, radii and the sentence shown on a build card. Both layers may
 * import it, which is the point: it lets the simulation be lifted out and run
 * headless without dragging the artwork along, and it stops a projectile from
 * carrying a hex string that nothing in the simulation ever reads.
 *
 * Ids are lowercase first names and the display names are the full ones. They
 * must never drift apart -- an earlier project called the same tower `stamp`
 * in code and "Hammer" on screen, and every document then needed a paragraph
 * explaining that `stamp@5,5` was not a typo.
 */
import type { EnemyId, TowerId } from '../sim/types.ts';

export interface TowerLook {
  name: string;
  /** One line on the build card. Says what it does, not what it is. */
  blurb: string;
  color: string;
  /** Emoji drawn on the tower. */
  glyph: string;
}

export const TOWER_LOOK: Record<TowerId, TowerLook> = {
  norah: {
    name: 'Knitting Norah',
    blurb: 'Fires knitting needles fast at one target. Cheap and short-ranged.',
    color: '#f06292',
    glyph: '🧶',
  },
  barbara: {
    name: 'Baking Barbara',
    blurb: 'Throws cinnamon rolls that burst, and leaves glaze that slows.',
    color: '#ffb74d',
    glyph: '🥐',
  },
  pete: {
    name: 'Protest Pete',
    blurb: 'Shouts in a circle around himself. No damage, but it stops them.',
    color: '#7986cb',
    glyph: '📢',
  },
  bill: {
    name: 'Binocular Bill',
    blurb: 'Sees the whole street. Slow to fire, hits very hard.',
    color: '#4db6ac',
    glyph: '🔭',
  },
  walter: {
    name: 'Walker Walter',
    blurb: 'Stands in the road. Nothing gets past until they knock him down.',
    color: '#a1887f',
    glyph: '🚶',
  },
  clara: {
    name: 'Coffee Clara',
    blurb: 'Pours for the neighbours. Towers beside her fire faster.',
    color: '#8d6e63',
    glyph: '☕',
  },
};

export interface EnemyLook {
  name: string;
  color: string;
  /** Drawn radius in px, and what a tap has to land inside to select. */
  radius: number;
  glyph: string;
}

export const ENEMY_LOOK: Record<EnemyId, EnemyLook> = {
  sam: { name: 'Scooter Sam', color: '#4fc3f7', radius: 10, glyph: '🛴' },
  mike: { name: 'Moped Mike', color: '#78909c', radius: 13, glyph: '🛵' },
  ben: { name: 'Boombox Ben', color: '#ba68c8', radius: 12, glyph: '📻' },
  tina: { name: 'TikTok Tina', color: '#f06292', radius: 11, glyph: '📱' },
  gang: { name: 'E-Scooter Gang', color: '#ffd54f', radius: 14, glyph: '🛴' },
  skye: { name: 'Skateboard Skye', color: '#ff8a65', radius: 10, glyph: '🛹' },
  walker: { name: 'Runaway', color: '#aed581', radius: 8, glyph: '🏃' },
};

/** Board furniture. Kept here so the renderer has one palette to read. */
export const PALETTE = {
  /**
   * Grass, in the same hand-drawn style as the painted characters: soft
   * patches of close greens for the ground, then blades and flowers with a
   * dark outline and a lighter tip, the way the seniors are drawn. The
   * renderer indexes into the ground list, so the order is darkest to
   * lightest.
   */
  grass: ['#74a45e', '#82b46b', '#90c07b', '#a0cd8a'],
  grassBlade: '#67a44e',
  grassBladeTip: '#bde39d',
  /** The outline around every blade and petal. Dark and green, never black. */
  grassLine: '#3f5c34',
  /** The contact shadow that sits a tuft on the ground rather than over it. */
  grassShadow: 'rgba(48, 74, 40, 0.20)',
  grassBloom: '#fbf6df',
  grassBloomCore: '#f2c14e',
  road: '#6d6a63',
  roadEdge: '#5a5751',
  kerb: '#cfc9bd',
  buildable: 'rgba(255,255,255,0.16)',
  blocked: 'rgba(220,60,60,0.22)',
  /**
   * The readout panel that sits on the board itself. Dark and translucent
   * rather than paper-coloured, because it has to stay legible over grass,
   * over the road and over a senior who happens to stand under it.
   */
  hudFill: 'rgba(28, 24, 20, 0.62)',
  hudLine: 'rgba(255,255,255,0.22)',
  hudInk: '#ffffff',
  hudLabel: 'rgba(255,255,255,0.70)',
  rangeFill: 'rgba(255,255,255,0.08)',
  rangeLine: 'rgba(255,255,255,0.45)',
} as const;
