import type { EnemyDef, EnemyId } from './types.ts';

/**
 * The troublemakers.
 *
 * Each one puts a different kind of pressure on a board, but none of them is
 * the answer to a particular tower or has a particular tower as its answer.
 * Sam arrives in numbers, Mike arrives armoured, the Gang arrives twice, Ben
 * makes his neighbours harder to chip down and Tina makes towers stop. A board
 * that only does one thing well will find one of them expensive; a board that
 * does two or three things will not.
 *
 * Armour subtracts from every hit, which is the honest way to make a slow
 * heavy hit and a fast light one genuinely different without any lookup table
 * existing. Ben's shield does the same job from the other side.
 */
export const ENEMIES: Record<EnemyId, EnemyDef> = {
  sam: {
    id: 'sam',
    hp: 22,
    speed: 1.9,
    armour: 0,
    bounty: 5,
    leakCost: 1,
    stunImmune: false,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: null,
    splitCount: 0,
    blockerDps: 12,
  },
  mike: {
    id: 'mike',
    hp: 90,
    speed: 1.0,
    armour: 3,
    bounty: 14,
    leakCost: 2,
    // The reason Pete cannot be the whole answer to a round.
    stunImmune: true,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: null,
    splitCount: 0,
    blockerDps: 30,
  },
  ben: {
    id: 'ben',
    hp: 55,
    speed: 1.15,
    armour: 1,
    bounty: 12,
    leakCost: 2,
    stunImmune: false,
    shieldAura: 2,
    disablesTowers: false,
    auraRange: 90,
    splitsInto: null,
    splitCount: 0,
    blockerDps: 18,
  },
  tina: {
    id: 'tina',
    hp: 48,
    speed: 1.3,
    armour: 0,
    bounty: 12,
    leakCost: 2,
    stunImmune: false,
    shieldAura: 0,
    disablesTowers: true,
    auraRange: 80,
    splitsInto: null,
    splitCount: 0,
    blockerDps: 14,
  },
  gang: {
    id: 'gang',
    hp: 70,
    speed: 1.25,
    armour: 2,
    bounty: 10,
    leakCost: 2,
    stunImmune: false,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: 'walker',
    splitCount: 2,
    blockerDps: 20,
  },
  walker: {
    id: 'walker',
    hp: 16,
    speed: 2.4,
    armour: 0,
    bounty: 3,
    leakCost: 1,
    stunImmune: false,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: null,
    splitCount: 0,
    blockerDps: 8,
  },
};
