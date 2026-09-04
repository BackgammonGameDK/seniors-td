/**
 * Names and copy for the upgrade tree, kept out of the simulation the same
 * way `display.ts` keeps names and colours out of it.
 *
 * Keyed by the same path/capstone ids `src/sim/upgrades.ts` uses, so a
 * capstone id can never say one thing in the sim and another on screen --
 * the same drift `display.ts` already warns about for tower and enemy ids.
 */
import type { TowerId } from '../sim/types.ts';

export interface TierLook {
  name: string;
  /** Says what the tier does, not the field it sets. */
  blurb: string;
}

export interface CapstoneLook extends TierLook {}

export interface PathLook {
  name: string;
  tiers: [TierLook, TierLook];
}

export interface TowerUpgradeLook {
  pathA: PathLook;
  pathB: PathLook;
  /** Keyed by capstone id, matching `src/sim/upgrades.ts` exactly. */
  capstones: Record<string, CapstoneLook>;
}

export const UPGRADE_LOOK: Record<TowerId, TowerUpgradeLook> = {
  norah: {
    pathA: {
      name: 'Speed',
      tiers: [
        { name: 'Quick Stitch', blurb: 'Fires noticeably faster.' },
        { name: 'Flying Needles', blurb: 'Fires faster again.' },
      ],
    },
    pathB: {
      name: 'Range',
      tiers: [
        { name: 'Longer Thread', blurb: 'Sees further down the street.' },
        { name: 'Full Skein', blurb: 'Sees further again.' },
      ],
    },
    capstones: {
      longYarn: { name: 'Long Yarn', blurb: 'Fires very fast from very far away.' },
      tripleKnit: { name: 'Triple Knit', blurb: 'Fires at up to three targets at once.' },
    },
  },
  barbara: {
    pathA: {
      name: 'Splash',
      tiers: [
        { name: 'Bigger Batch', blurb: 'The burst covers more ground.' },
        { name: 'Extra Glaze', blurb: 'A bigger burst, and a stronger slow.' },
      ],
    },
    pathB: {
      name: 'Rate',
      tiers: [
        { name: 'Second Tray', blurb: 'Bakes and throws faster.' },
        { name: 'Third Tray', blurb: 'Faster again.' },
      ],
    },
    capstones: {
      bigBatch: { name: 'Big Batch', blurb: 'A huge burst that slows for much longer.' },
      freshBatch: { name: 'Fresh Batch', blurb: 'Throws much faster, and each one hits harder.' },
    },
  },
  pete: {
    pathA: {
      name: 'Radius',
      tiers: [
        { name: 'Louder Voice', blurb: "His shout carries further." },
        { name: 'Bullhorn Lungs', blurb: 'Carries further again.' },
      ],
    },
    pathB: {
      name: 'Rate',
      tiers: [
        { name: 'Fresh Breath', blurb: 'Shouts more often.' },
        { name: 'Second Wind', blurb: 'Shouts more often again.' },
      ],
    },
    capstones: {
      megaphone: { name: 'Megaphone', blurb: 'A huge reach, and a longer stop on anyone he hits.' },
      bullhorn: { name: 'Bullhorn', blurb: 'Shouts often, and stops anyone he hits for longer.' },
    },
  },
  bill: {
    pathA: {
      name: 'Power',
      tiers: [
        { name: 'Steadier Hand', blurb: 'Hits harder.' },
        { name: 'Dead Aim', blurb: 'Hits harder again.' },
      ],
    },
    pathB: {
      name: 'Sight',
      tiers: [
        { name: 'Better Lenses', blurb: 'Sees further down the street.' },
        { name: 'Clearer Glass', blurb: 'Sees further again.' },
      ],
    },
    capstones: {
      deadeye: { name: 'Deadeye', blurb: 'Hits very hard from very far away.' },
      piercingShot: { name: 'Piercing Shot', blurb: 'A shot that carries through to whoever is right behind the first.' },
    },
  },
  walter: {
    pathA: {
      name: 'Toughness',
      tiers: [
        { name: 'Thicker Coat', blurb: 'Holds more damage before going down.' },
        { name: 'Steel Cane', blurb: 'Holds even more.' },
      ],
    },
    pathB: {
      name: 'Recovery',
      tiers: [
        { name: 'Catching His Breath', blurb: 'Heals slowly while still standing.' },
        { name: 'Second Cup of Tea', blurb: 'Heals faster while still standing.' },
      ],
    },
    capstones: {
      stoneWall: { name: 'Stone Wall', blurb: 'Holds a huge amount of damage before going down.' },
      rally: { name: 'Rally', blurb: 'Heals fast, and gets back up with more of his health.' },
    },
  },
  clara: {
    pathA: {
      name: 'Strength',
      tiers: [
        { name: 'Stronger Brew', blurb: 'Neighbours fire faster.' },
        { name: 'Double Shot', blurb: 'Neighbours fire faster again.' },
      ],
    },
    pathB: {
      name: 'Reach',
      tiers: [
        { name: 'Bigger Pot', blurb: 'Reaches further to buff neighbours.' },
        { name: 'Whole Thermos', blurb: 'Reaches further again.' },
      ],
    },
    capstones: {
      doubleEspresso: { name: 'Double Espresso', blurb: 'Neighbours fire much faster.' },
      secondRound: { name: 'Second Round', blurb: 'Reaches much further, and also extends the range of anyone she buffs.' },
    },
  },
};
