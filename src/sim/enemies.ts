import type { EnemyDef, EnemyId } from './types.ts';

/**
 * The troublemakers.
 *
 * Each one puts a different kind of pressure on a board, but none of them is
 * the answer to a particular tower or has a particular tower as its answer.
 * Sam arrives in numbers, Mike arrives armoured, the Gang arrives twice, Ben
 * makes his neighbours harder to chip down, Tina makes towers stop and Skye
 * arrives too fast for a slow to hold, and Duke arrives once, slowly, dropping
 * Runaways behind him the whole way down the street. A board that only does
 * one thing well will find one of them expensive; a board that does two or
 * three things will not.
 *
 * Armour subtracts from every hit, which is the honest way to make a slow
 * heavy hit and a fast light one genuinely different without any lookup table
 * existing. Ben's shield does the same job from the other side, and Skye's
 * slow resistance does it for the effect rather than the damage.
 */
export const ENEMIES: Record<EnemyId, EnemyDef> = {
  sam: {
    id: 'sam',
    hp: 22,
    speed: 1.9,
    armour: 0,
    bounty: 2,
    leakCost: 1,
    stunImmune: false,
    slowResist: 0,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: null,
    splitCount: 0,
    dropsInto: null,
    dropInterval: 0,
    blockerDps: 12,
  },
  mike: {
    id: 'mike',
    hp: 90,
    speed: 1.0,
    armour: 3,
    bounty: 6,
    leakCost: 2,
    // The reason Pete cannot be the whole answer to a round.
    stunImmune: true,
    slowResist: 0,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: null,
    splitCount: 0,
    dropsInto: null,
    dropInterval: 0,
    blockerDps: 30,
  },
  ben: {
    id: 'ben',
    hp: 55,
    speed: 1.15,
    armour: 1,
    bounty: 5,
    leakCost: 2,
    stunImmune: false,
    slowResist: 0,
    shieldAura: 2,
    disablesTowers: false,
    auraRange: 90,
    splitsInto: null,
    splitCount: 0,
    dropsInto: null,
    dropInterval: 0,
    blockerDps: 18,
  },
  tina: {
    id: 'tina',
    hp: 48,
    speed: 1.3,
    armour: 0,
    bounty: 5,
    leakCost: 1,
    stunImmune: false,
    slowResist: 0,
    shieldAura: 0,
    disablesTowers: true,
    auraRange: 60,
    splitsInto: null,
    splitCount: 0,
    dropsInto: null,
    dropInterval: 0,
    blockerDps: 14,
  },
  gang: {
    id: 'gang',
    hp: 70,
    speed: 1.25,
    armour: 2,
    bounty: 4,
    leakCost: 1,
    stunImmune: false,
    slowResist: 0,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: 'walker',
    splitCount: 2,
    dropsInto: null,
    dropInterval: 0,
    blockerDps: 20,
  },
  skye: {
    id: 'skye',
    hp: 70,
    speed: 2.6,
    armour: 0,
    bounty: 5,
    leakCost: 1,
    // Stun and a blockade both still stop her, so the speed is a cost to a
    // board that leans on slows rather than a tower she is immune to.
    stunImmune: false,
    slowResist: 0.75,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: null,
    splitCount: 0,
    dropsInto: null,
    dropInterval: 0,
    blockerDps: 16,
  },
  duke: {
    id: 'duke',
    hp: 1000,
    speed: 0.55,
    armour: 4,
    bounty: 10,
    leakCost: 4,
    // Matches Mike's precedent, and also stops a stun-lock from trivially
    // neutering the drop mechanic below.
    stunImmune: true,
    slowResist: 0,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: null,
    splitCount: 0,
    dropsInto: 'walker',
    dropInterval: 240,
    blockerDps: 40,
  },
  walker: {
    id: 'walker',
    hp: 16,
    speed: 2.4,
    armour: 0,
    bounty: 1,
    leakCost: 1,
    stunImmune: false,
    slowResist: 0,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: null,
    splitCount: 0,
    dropsInto: null,
    dropInterval: 0,
    blockerDps: 8,
  },
};
