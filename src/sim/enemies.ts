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
    ignoresBlockers: false,
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
    ignoresBlockers: false,
  },
  ben: {
    id: 'ben',
    // 55 for a long time, which meant his shield never happened. Ben's whole
    // identity is the aura -- a flat 2 off every hit landing within 90px of
    // him -- and 55 hit points is less than a splash knot deletes on arrival,
    // so he died before he had protected anybody. Measured against the three
    // played boards: at 55 he was worth nothing to round 20, and `wall`
    // finished the whole campaign on 21.6 lives of 25 having lost nothing
    // after round 6. At 95 he lives long enough to tax the many small hits he
    // is supposed to punish, and `wall` finishes on 17.7 instead.
    //
    // 95 until the shield grew a rail and every hit grew a floor under it. Both
    // of those hand something back to the boards Ben exists to tax -- a hit
    // that used to vanish against him now keeps a fifth of itself -- and the
    // board that gained most was `wall`, the one already gaining most from
    // him: cinnamon rolls are many light hits by definition. Measured at 16
    // seeds, `wall` went from finishing on 18.0 lives of 25 to 20.6, over the
    // line the balance sweep draws at 18. 120 puts it back to 16.0 while
    // `corner` and `binoculars` both still clear, and it is the same lever for
    // the same reason as the move off 55: Ben taxes nothing he does not live
    // long enough to stand next to. 115 measured at 17.8, which is the knife
    // edge 95 was already sitting on and the reason this was invisible until
    // something moved.
    //
    // Hit points rather than a bigger shield on purpose. A stronger shield
    // costs a board that kills one troublemaker at a time far more than it
    // costs a splash knot -- at shieldAura 5, `binoculars` fell to a 25%
    // clear rate while `wall` still cleared half -- which is backwards. More
    // range does nothing to a knot at all. Only survival reaches the shape
    // that was ignoring him.
    hp: 120,
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
    ignoresBlockers: false,
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
    ignoresBlockers: false,
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
    ignoresBlockers: false,
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
    ignoresBlockers: false,
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
    // A bus does not slow down for a shout, a glaze, or a bystander standing
    // in the road -- full slow resistance and a blockade walked straight
    // through are the same idea as the stun immunity above.
    slowResist: 1,
    shieldAura: 0,
    disablesTowers: false,
    auraRange: 0,
    splitsInto: null,
    splitCount: 0,
    dropsInto: 'walker',
    dropInterval: 240,
    blockerDps: 40,
    ignoresBlockers: true,
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
    ignoresBlockers: false,
  },
};
