import { describe, expect, it } from 'vitest';
import { runCampaign } from '../src/campaign.ts';
import { parseLoadout } from '../src/sim/loadout.ts';
import type { Placement } from '../src/sim/loadout.ts';
import { ENEMIES } from '../src/sim/enemies.ts';
import { TOWERS } from '../src/sim/towers.ts';
import { createWorld, placeTower, purchaseUpgrade, spawnEnemy } from '../src/sim/world.ts';
import { TOWER_IDS } from '../src/sim/types.ts';
import { AUTHORED_ROUNDS, waveAt } from '../src/sim/waves.ts';
import {
  ABSORB_HINT_MS,
  absorbHintLeft,
  advanceFades,
  afterFrameError,
  BREAKDOWN,
  FRAME_FAILURE_LIMIT,
  staleKeys,
  armTower,
  boardAction,
  capstoneLocked,
  carryReach,
  cardState,
  describeStats,
  enemyTypeView,
  hintText,
  hoveredStat,
  upgradeChoiceOf,
  previewRing,
  previewStats,
  endOverlay,
  enemyReadout,
  facingAngle,
  focusAfterTap,
  focusKey,
  focusMark,
  focusedTowerId,
  hudReadouts,
  roundReadout,
  recordingOf,
  runButton,
  runKeyAction,
  stepOf,
  panelKey,
  sentHomeRow,
  pathCard,
  pathTierLocked,
  pickEnemy,
  rate,
  roundPreview,
  towerCard,
  towerForKey,
  upgradeAction,
  upgradeCardState,
  waveLabel,
} from '../src/render/decisions.ts';
import type { StatRow } from '../src/render/decisions.ts';
import { effectiveDef, UPGRADES } from '../src/sim/upgrades.ts';
import { cooldownAt } from '../src/sim/world.ts';
import type { Stats, Tower } from '../src/sim/types.ts';

const noStats: Stats = {
  kills: 3,
  leaks: 2,
  leaksByEnemy: { sam: 0, mike: 0, ben: 0, tina: 0, gang: 0, skye: 0, duke: 0, walker: 0, paul: 0 },
  livesLost: 2,
  goldEarned: 40,
  blockersLost: 0,
};

const tower = (over: Partial<Tower> = {}): Tower => ({
  id: 1,
  def: 'norah',
  col: 2,
  row: 2,
  x: 100,
  y: 100,
  cooldown: 0,
  hp: 0,
  laneDist: -1,
  rateMult: 1,
  rangeMult: 1,
  disabled: false,
  upgradeA: 0,
  upgradeB: 0,
  capstone: null,
  revivesUsed: 0,
  reviveAt: null,
  targetId: null,
  aimAngle: null,
  jetOn: false,
  jetReach: 0,
  sentHome: 0,
  ...over,
});

describe('arming a tower can always be undone', () => {
  it('tapping the armed tower again disarms it', () => {
    expect(armTower('norah', 'norah')).toBeNull();
  });

  it('tapping a different tower swaps to it', () => {
    expect(armTower('norah', 'bill')).toBe('bill');
    expect(armTower(null, 'bill')).toBe('bill');
  });
});

describe('what a tap on the board means', () => {
  it('places when a legal empty cell is tapped with a tower armed', () => {
    expect(
      boardAction({
        selected: 'norah',
        occupied: false,
        legal: true,
        inspectingSame: false,
        hasInspected: false,
      }),
    ).toBe('place');
  });

  it('does nothing on an illegal cell with no tower armed and nothing inspected', () => {
    expect(
      boardAction({
        selected: null,
        occupied: false,
        legal: false,
        inspectingSame: false,
        hasInspected: false,
      }),
    ).toBe('nothing');
  });

  it('an illegal tap drops the armed tower, matching tapping the card again', () => {
    expect(
      boardAction({
        selected: 'norah',
        occupied: false,
        legal: false,
        inspectingSame: false,
        hasInspected: false,
      }),
    ).toBe('unarm');
  });

  it('a legal but unaffordable tap also drops the armed tower', () => {
    expect(
      boardAction({
        selected: 'norah',
        occupied: false,
        legal: true,
        affordable: false,
        inspectingSame: false,
        hasInspected: false,
      }),
    ).toBe('unarm');
  });

  it('inspects an occupied cell even while a tower is armed', () => {
    expect(
      boardAction({
        selected: 'bill',
        occupied: true,
        legal: true,
        inspectingSame: false,
        hasInspected: false,
      }),
    ).toBe('inspect');
  });

  it('closes the panel when the tower already being inspected is tapped again', () => {
    expect(
      boardAction({
        selected: null,
        occupied: true,
        legal: false,
        inspectingSame: true,
        hasInspected: true,
      }),
    ).toBe('close');
  });

  it('closes the panel when an empty, unarmed spot is tapped elsewhere on the board', () => {
    expect(
      boardAction({
        selected: null,
        occupied: false,
        legal: false,
        inspectingSame: false,
        hasInspected: true,
      }),
    ).toBe('close');
  });
});

describe('the inspect panel never shows the previous tower', () => {
  it('changes its key when the tower changes', () => {
    expect(panelKey(tower({ id: 1 }))).not.toBe(panelKey(tower({ id: 2 })));
  });

  it('ignores health, which only the stat rows redraw for', () => {
    // Same reason as the running total below. A regenerating Walter's health
    // moves six times a second, and rebuilding the panel that often would tear
    // down the upgrade card under the pointer on every tick of it.
    expect(panelKey(tower({ def: 'walter', hp: 220 }))).toBe(
      panelKey(tower({ def: 'walter', hp: 100 })),
    );
  });

  it('is stable when nothing has changed, so the panel is not rebuilt each frame', () => {
    expect(panelKey(tower())).toBe(panelKey(tower()));
  });

  it('ignores the running total, which only the stat rows redraw for', () => {
    // Deliberate. A kill must not rebuild the whole panel: that would
    // re-measure the reserved height and tear down the upgrade card under the
    // pointer mid-hover. `paintStats` keys on the total separately.
    expect(panelKey(tower({ sentHome: 0 }))).toBe(panelKey(tower({ sentHome: 9 })));
  });
});

describe('a tower shows how many troublemakers it has seen off', () => {
  it('counts them in words a first-time player can read', () => {
    expect(sentHomeRow(tower({ def: 'norah', sentHome: 7 }))).toEqual({
      label: 'Sent home',
      value: '7 troublemakers',
    });
  });

  it('does not say "1 troublemakers"', () => {
    expect(sentHomeRow(tower({ def: 'norah', sentHome: 1 }))?.value).toBe('1 troublemaker');
  });

  it('says none yet rather than a bare zero', () => {
    expect(sentHomeRow(tower({ def: 'norah', sentHome: 0 }))?.value).toBe('none yet');
  });

  it('leaves the row off towers that never deal damage', () => {
    // Clara only makes her neighbours better and Walter only stands in the
    // way. A row stuck at zero would read as either of them doing badly.
    expect(sentHomeRow(tower({ def: 'clara' }))).toBeNull();
    expect(sentHomeRow(tower({ def: 'walter' }))).toBeNull();
  });

  it('is never struck through by an upgrade preview', () => {
    // It is not one of `describeStats`' rows, so `previewStats` cannot pair it
    // with a "was" value and show a total as though an upgrade would change it.
    const labels = previewStats(TOWERS.norah, { damage: 99 }).map((r) => r.label);
    expect(labels).not.toContain('Sent home');
  });
});

describe('number keys arm towers', () => {
  it('maps 1..n onto the build menu in order', () => {
    TOWER_IDS.forEach((id, i) => expect(towerForKey(String(i + 1))).toBe(id));
  });

  it('ignores everything else, so a handler can pass every key through', () => {
    for (const k of ['0', '9', 'a', 'Escape', '', ' ']) {
      if (k === '9' && TOWER_IDS.length >= 9) continue;
      expect(towerForKey(k)).toBeNull();
    }
  });
});

describe('build cards', () => {
  it('greys out what the wallet cannot cover', () => {
    expect(cardState({ gold: 10, cost: 40, isSelected: false }).affordable).toBe(false);
    expect(cardState({ gold: 10, cost: 40, isSelected: false }).className).toContain('poor');
    expect(cardState({ gold: 40, cost: 40, isSelected: false }).affordable).toBe(true);
  });

  it('marks the armed one', () => {
    expect(cardState({ gold: 99, cost: 40, isSelected: true }).className).toContain('on');
  });

  it('dims the armed one too when it outspends the wallet', () => {
    const state = cardState({ gold: 10, cost: 40, isSelected: true });
    expect(state.className).toContain('poor');
    expect(state.className).toContain('on');
  });

  it('gives every tower a name, a blurb and at least a cost', () => {
    for (const id of TOWER_IDS) {
      const card = towerCard(id);
      expect(card.name.length).toBeGreaterThan(3);
      expect(card.blurb.length).toBeGreaterThan(10);
      expect(card.rows.length).toBeGreaterThan(0);
    }
  });

  it('explains a tower in plain words rather than field names', () => {
    const rows = describeStats(TOWERS.barbara);
    const slow = rows.find((r) => r.label === 'Slow');
    expect(slow?.value).toMatch(/%/);
    expect(slow?.value).toMatch(/s$/);
    expect(rows.some((r) => /slowFactor|slowTicks/.test(r.value))).toBe(false);
  });

  it('leaves everyone but the jet hitting people', () => {
    // "a soaking" arrived with Harold's jet and was briefly written on every
    // tower's Damage row, so Norah's knitting needles read as water.
    for (const id of ['norah', 'barbara', 'bill'] as const) {
      expect(describeStats(TOWERS[id]).find((r) => r.label === 'Damage')?.value).toMatch(/a hit$/);
    }
  });

  it('describes the jet as water standing on people rather than as a gun', () => {
    const rows = describeStats(TOWERS.harold);
    // "a hit" and "shots a second" would read as a gun that happens to be
    // blue. He does not hit anybody: he stands water on them.
    expect(rows.find((r) => r.label === 'Damage')?.value).toMatch(/soaking/);
    expect(rows.some((r) => r.label === 'Rate')).toBe(false);
    expect(rows.find((r) => r.label === 'Soaks them')).toBeDefined();
    expect(rows.find((r) => r.label === 'Catches')?.value).toMatch(/everyone/);
    // The push is Full Mains and nothing before it, and it is said per second
    // rather than per tick -- 21 px a second is a fact about the street.
    expect(rows.some((r) => r.label === 'Pushes them back')).toBe(false);
    const full = describeStats(effectiveDef(tower({ def: 'harold', capstone: 'fullMains' })));
    expect(full.find((r) => r.label === 'Pushes them back')?.value).toMatch(/px a second/);
  });

  it('describes the two towers that never shoot without pretending they do', () => {
    const walter = describeStats(TOWERS.walter);
    expect(walter.some((r) => /road/.test(r.value))).toBe(true);
    expect(walter.some((r) => r.label === 'Damage')).toBe(false);

    const clara = describeStats(TOWERS.clara);
    expect(clara.some((r) => /faster/.test(r.value))).toBe(true);
  });

  it('shows a neighbour\'s coffee in the rate, not just on the board', () => {
    const plain = describeStats(TOWERS.norah);
    const buffed = describeStats(TOWERS.norah, { rateMult: TOWERS.clara.buffRate });
    const rateOf = (rows: StatRow[]) => rows.find((r) => r.label === 'Rate')!.value;
    expect(rateOf(buffed)).not.toBe(rateOf(plain));
    expect(rateOf(buffed)).toContain(rate(cooldownAt(TOWERS.norah.cooldown, TOWERS.clara.buffRate)));
    expect(rateOf(buffed)).toContain(rateOf(plain));
  });

  it('shows a widened reach, and leaves an unbuffed one alone', () => {
    const reachOf = (rows: StatRow[]) => rows.find((r) => r.label === 'Reach')!.value;
    expect(reachOf(describeStats(TOWERS.norah, { rangeMult: 1.15 }))).toContain(
      `${Math.round(TOWERS.norah.range * 1.15)} px`,
    );
    expect(reachOf(describeStats(TOWERS.norah))).toBe(`${TOWERS.norah.range} px`);
  });
});

describe('the line a carrying shot knocks down, in words', () => {
  const knocksDown = (def: typeof TOWERS.betty) =>
    describeStats(def).find((r) => r.label === 'Knocks down')?.value;

  it('counts them while there is a number to count', () => {
    expect(knocksDown(TOWERS.betty)).toContain(`${TOWERS.betty.pierce! + 1} in a line`);
  });

  it('words an unlimited line instead of printing one', () => {
    // `Infinity + 1` is `Infinity`, and a template renders that as the word,
    // so the panel read "Infinity in a line, whoever is in the way". Nothing
    // asserted on this row at all until The Whole Lot came along.
    const value = knocksDown({ ...TOWERS.betty, pierce: Infinity })!;
    expect(value).not.toContain('Infinity');
    expect(value).toMatch(/everyone/);
  });

  it('never prints a raw Infinity in any row of any tower, however it is upgraded', () => {
    for (const id of TOWER_IDS) {
      for (const cap of UPGRADES[id].capstones) {
        const t = tower({ def: id, upgradeA: 2, upgradeB: 2, capstone: cap.id });
        const rows = describeStats(effectiveDef(t));
        for (const row of rows) {
          expect(`${row.label} ${row.value}`, `${id} / ${cap.id}`).not.toContain('Infinity');
        }
      }
    }
  });
});

describe('the second range, on the one tower that has two', () => {
  it('is the throw plus the roll, for the ring the board draws outside the first', () => {
    expect(carryReach(TOWERS.betty)).toBe(TOWERS.betty.range + TOWERS.betty.rollOut!);
  });

  it('widens with a neighbour, since a further throw is a further ball', () => {
    expect(carryReach(TOWERS.betty, 1.15)).toBeGreaterThan(carryReach(TOWERS.betty)!);
  });

  it('is nothing at all for everyone who does not roll', () => {
    expect(carryReach(TOWERS.norah)).toBeNull();
    expect(carryReach(TOWERS.barbara)).toBeNull();
    expect(carryReach(TOWERS.walter)).toBeNull();
  });

  it('previews a reach tier as the reach it buys', () => {
    const tier = UPGRADES.norah.pathB[0];
    expect(previewRing(TOWERS.norah, tier.stat)).toBe(tier.stat.range);
  });

  it('previews a roll tier as where the ball ends up, since the throw does not move', () => {
    // Betty's whole second path. Without this the hovered card drew her
    // unchanged throw circle, which reads as an upgrade that does nothing.
    const tier = UPGRADES.betty.pathB[0];
    expect(tier.stat.range).toBeUndefined();
    expect(previewRing(TOWERS.betty, tier.stat)).toBe(TOWERS.betty.range + tier.stat.rollOut!);
    expect(previewRing(TOWERS.betty, tier.stat)!).toBeGreaterThan(carryReach(TOWERS.betty)!);
  });

  it('previews nothing for a card that moves neither', () => {
    expect(previewRing(TOWERS.betty, UPGRADES.betty.pathA[0].stat)).toBeNull();
  });
});

describe('an upgrade under the pointer previews its own stats', () => {
  const rowsBy = (rows: StatRow[]) => new Map(rows.map((r) => [r.label, r]));

  it('marks only the row the tier moves, and says what it moved from', () => {
    const longerThread = UPGRADES.norah.pathB[0].stat;
    const rows = rowsBy(previewStats(TOWERS.norah, longerThread));
    const reach = rows.get('Reach')!;
    expect(reach.was).toBe(`${TOWERS.norah.range} px`);
    expect(reach.value).toBe(`${longerThread.range} px`);
    expect(reach.changed).toBe(true);
    expect(rows.get('Damage')!.changed).toBeUndefined();
    expect(rows.get('Rate')!.was).toBeUndefined();
  });

  it('shows a stat the plain panel would have had no row for at all', () => {
    const tripleKnit = UPGRADES.norah.capstones.find((c) => c.stat.multiShot)!;
    const rows = rowsBy(previewStats(TOWERS.norah, tripleKnit.stat));
    const picks = rows.get('Picks');
    expect(picks?.changed).toBe(true);
    expect(picks?.value).toContain(`${tripleKnit.stat.multiShot}`);
    expect(rowsBy(describeStats(TOWERS.norah)).has('Picks')).toBe(false);
  });

  it('leaves every row alone when nothing is hovered', () => {
    expect(previewStats(TOWERS.norah, {})).toEqual(describeStats(TOWERS.norah));
  });

  it('resolves a hovered card back to the stats it would apply', () => {
    const t = tower({ def: 'norah', upgradeA: 1, upgradeB: 2 });
    expect(hoveredStat(t, 'pathA')).toBe(UPGRADES.norah.pathA[1].stat);
    expect(hoveredStat(t, 'pathB')).toBeNull();
    expect(hoveredStat(t, 'doubleEspresso')).toBeNull();
    expect(hoveredStat(t, null)).toBeNull();

    const clara = tower({ def: 'clara' });
    expect(hoveredStat(clara, 'doubleEspresso')).toBe(
      UPGRADES.clara.capstones.find((c) => c.id === 'doubleEspresso')!.stat,
    );
  });

  it('turns a button\'s dataset into a choice, or into nothing', () => {
    // The panel is rebuilt while the pointer is over it, so the button clicked
    // need not still belong to the tower being inspected -- a Clara's capstone
    // read off a Norah's panel must not be bought on the Norah.
    const norah = tower({ def: 'norah' });
    expect(upgradeChoiceOf(norah, 'pathA')).toBe('pathA');
    expect(upgradeChoiceOf(norah, 'pathB')).toBe('pathB');
    expect(upgradeChoiceOf(norah, 'tripleKnit')).toBe('tripleKnit');
    expect(upgradeChoiceOf(norah, 'doubleEspresso')).toBeNull();
    expect(upgradeChoiceOf(norah, 'pathC')).toBeNull();
    expect(upgradeChoiceOf(norah, undefined)).toBeNull();
  });
});

describe('rate reads as shots per second', () => {
  it('converts a cooldown in ticks', () => {
    expect(rate(60)).toBe('1.0/s');
    expect(rate(30)).toBe('2.0/s');
  });

  it('says nothing rather than dividing by zero for a tower that never fires', () => {
    expect(rate(0)).toBe('--');
  });
});

describe('the round read-out', () => {
  it('counts the round from one and stops at the last', () => {
    expect(waveLabel(0)).toBe(`1/${AUTHORED_ROUNDS}`);
    expect(waveLabel(AUTHORED_ROUNDS)).toBe(`${AUTHORED_ROUNDS}/${AUTHORED_ROUNDS}`);
  });

  it('totals each troublemaker across the groups it arrives in', () => {
    const rows = roundPreview(0);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.count).toBeGreaterThan(0);
      expect(r.name.length).toBeGreaterThan(3);
    }
  });

  it('is empty past the last round rather than throwing', () => {
    expect(roundPreview(AUTHORED_ROUNDS)).toEqual([]);
  });

  it('drops the total and just counts once free play has started', () => {
    expect(waveLabel(AUTHORED_ROUNDS, true)).toBe(String(AUTHORED_ROUNDS + 1));
    expect(waveLabel(30, true)).toBe('31');
  });

  it('shows what a free play round brings, where the campaign shows nothing', () => {
    expect(roundPreview(AUTHORED_ROUNDS + 4, true).length).toBeGreaterThan(0);
    expect(roundPreview(AUTHORED_ROUNDS + 4)).toEqual([]);
  });
});

describe('the end overlay', () => {
  it('stays hidden while the run is going', () => {
    expect(endOverlay({ status: 'idle', waveIndex: 3, stats: noStats }).show).toBe(false);
    expect(endOverlay({ status: 'running', waveIndex: 3, stats: noStats }).show).toBe(false);
  });

  it('names the round that beat you', () => {
    const o = endOverlay({ status: 'lost', waveIndex: 6, stats: noStats });
    expect(o.show).toBe(true);
    expect(o.body).toContain('round 7');
  });

  it('congratulates a finished run, and offers to carry on', () => {
    const o = endOverlay({ status: 'won', waveIndex: 20, stats: noStats });
    expect(o.title).toMatch(/quiet/i);
    expect(o.canContinue).toBe(true);
  });

  it('says how far past the end free play got, and offers nothing further', () => {
    const o = endOverlay({
      status: 'lost',
      waveIndex: AUTHORED_ROUNDS + 3,
      endless: true,
      stats: noStats,
    });
    expect(o.body).toContain(`round ${AUTHORED_ROUNDS + 4}`);
    expect(o.body).toContain('4 past the end');
    expect(o.canContinue).toBe(false);
  });
});

describe('tapping a troublemaker', () => {
  it('picks the nearest one under the finger, not the first in the list', () => {
    const targets = [
      { id: 1, x: 100, y: 100, radius: 20 },
      { id: 2, x: 105, y: 100, radius: 20 },
    ];
    expect(pickEnemy(targets, { x: 106, y: 100 })).toBe(2);
  });

  it('returns nothing when the tap was on empty road', () => {
    expect(pickEnemy([{ id: 1, x: 100, y: 100, radius: 10 }], { x: 400, y: 400 })).toBeNull();
  });

  it('allows a few pixels of slack, because a fingertip is not a pixel', () => {
    expect(pickEnemy([{ id: 1, x: 100, y: 100, radius: 10 }], { x: 113, y: 100 })).toBe(1);
  });
});

describe('tier two is locked until tier one is bought', () => {
  it('leaves the first tier open regardless of what has been bought', () => {
    expect(pathTierLocked(0, 0)).toBe(false);
    expect(pathTierLocked(0, 1)).toBe(false);
  });

  it('locks the second tier until the first is owned', () => {
    expect(pathTierLocked(1, 0)).toBe(true);
    expect(pathTierLocked(1, 1)).toBe(false);
    expect(pathTierLocked(1, 2)).toBe(false);
  });
});

describe('a capstone waits for both paths to be maxed', () => {
  it('stays locked until upgradeA and upgradeB both reach 2', () => {
    expect(capstoneLocked(2, 1)).toBe(true);
    expect(capstoneLocked(1, 2)).toBe(true);
    expect(capstoneLocked(2, 2)).toBe(false);
  });
});

describe('an upgrade card reads bought before it reads anything else', () => {
  it('shows bought even when the wallet could no longer afford it again', () => {
    expect(
      upgradeAction({ gold: 0, cost: 999, alreadyBought: true, locked: false }),
    ).toBe('bought');
  });

  it('is locked when its prerequisite is missing', () => {
    expect(
      upgradeAction({ gold: 999, cost: 10, alreadyBought: false, locked: true }),
    ).toBe('locked');
  });

  it('greys out what the wallet cannot cover, once unlocked', () => {
    expect(
      upgradeAction({ gold: 5, cost: 10, alreadyBought: false, locked: false }),
    ).toBe('unaffordable');
  });

  it('is buyable once affordable and unlocked', () => {
    expect(
      upgradeAction({ gold: 10, cost: 10, alreadyBought: false, locked: false }),
    ).toBe('buy');
  });
});

describe('a capstone choice cannot be undone', () => {
  it('reads as its own case, not as plain "locked", once a sibling was chosen', () => {
    expect(
      upgradeAction({
        gold: 999,
        cost: 10,
        alreadyBought: false,
        locked: false,
        otherCapstoneChosen: true,
      }),
    ).toBe('otherCapstoneChosen');
  });

  it('never offers to buy the sibling once one capstone is owned', () => {
    const state = upgradeCardState({
      gold: 999,
      cost: 10,
      alreadyBought: false,
      locked: false,
      otherCapstoneChosen: true,
    });
    expect(state.action).not.toBe('buy');
    expect(state.className).toContain('locked');
  });
});

describe('the troublemaker read-out teaches the mechanic', () => {
  it('says what armour does rather than naming it', () => {
    const r = enemyReadout({ def: 'mike', hp: 90, scale: 1, shield: 0 });
    expect(r.lines.join(' ')).toMatch(/every hit lands/);
    expect(r.lines.join(' ')).toMatch(/cannot be stopped/i);
  });

  it('warns that the Gang comes back', () => {
    expect(enemyReadout({ def: 'gang', hp: 70, scale: 1, shield: 0 }).lines.join(' ')).toMatch(/Breaks into/);
  });

  it('says in words that slowing barely works on Skye', () => {
    const line = enemyReadout({ def: 'skye', hp: 70, scale: 1, shield: 0 }).lines.join(' ');
    expect(line).toMatch(/slowing works 75% less/);
    expect(line).not.toMatch(/slowResist/);
  });

  it('has nothing special to say about the plain ones', () => {
    expect(enemyReadout({ def: 'sam', hp: 22, scale: 1, shield: 0 }).lines).toHaveLength(1);
  });

  it('says the bus cannot be pushed back, and says it of nobody else', () => {
    // A player who has bought Full Mains and watched the water do nothing to a
    // bus should be able to read why, rather than take it for a bug.
    expect(enemyReadout({ def: 'duke', hp: 1000, scale: 1, shield: 0 }).lines.join(' ')).toMatch(
      /Too heavy to push back/,
    );
    expect(enemyReadout({ def: 'mike', hp: 90, scale: 1, shield: 0 }).lines.join(' ')).not.toMatch(
      /push back/,
    );
  });
});

describe('the one button that runs the game', () => {
  it('starts the round when nothing is running', () => {
    const b = runButton({ status: 'idle', paused: false });
    expect(b).toEqual({ label: 'Start round', action: 'start', disabled: false });
  });

  it('pauses a running round, and resumes a paused one', () => {
    // The same button, because it is the same question: should time be
    // passing? Two buttons meant one of them was always greyed out.
    expect(runButton({ status: 'running', paused: false })).toEqual({
      label: 'Pause',
      action: 'toggle',
      disabled: false,
    });
    expect(runButton({ status: 'running', paused: true })).toEqual({
      label: 'Resume',
      action: 'toggle',
      disabled: false,
    });
  });

  it('goes dead once the game is over', () => {
    // The overlay is up and there is no round left to start or pause. It
    // still reads "Start round" rather than going blank, so the button does
    // not change shape underneath the overlay.
    for (const status of ['won', 'lost']) {
      const b = runButton({ status, paused: false });
      expect(b.disabled).toBe(true);
      expect(b.label).toBe('Start round');
    }
  });
});

describe('the readouts on the board', () => {
  it('reads coins then lives, with no words on either', () => {
    const rows = hudReadouts({ gold: 120, lives: 20 });
    expect(rows.map((r) => r.value)).toEqual(['120', '20']);
    expect(rows.map((r) => r.label)).toEqual(['', '']);
  });

  it('floors the coin count', () => {
    // Gold accrues in fractions during a round. A readout of "40" beside a
    // card priced at 40 has to mean the card is affordable, so the number
    // shown is never rounded up past what can actually be spent.
    const [coins] = hudReadouts({ gold: 39.97, lives: 20 });
    expect(coins?.value).toBe('39');
  });

  it('gives the two resources a picture and no words', () => {
    // The picture is the whole readout: a number with an icon beside it and
    // nothing to read. An icon may be named before its artwork exists -- the
    // renderer draws an emoji until the file lands -- so this never depends
    // on a picture being there.
    const rows = hudReadouts({ gold: 0, lives: 0 });
    expect(rows.map((r) => r.icon)).toEqual(['coin', 'heart']);
  });

  it('keeps the round out of the resources, and keeps its word', () => {
    // It goes in its own panel in the far corner, so it is not measured or
    // placed with the two numbers that change every second. On its own, 1/20
    // could be anything -- so this is the one readout that says what it is.
    const round = roundReadout(0);
    expect(round.value).toBe(`1/${AUTHORED_ROUNDS}`);
    expect(round.label).toBe('round');
    expect(round.icon).toBeNull();
  });

  it('stops counting rounds up at the last authored one', () => {
    expect(roundReadout(AUTHORED_ROUNDS + 5).value).toBe(
      `${AUTHORED_ROUNDS}/${AUTHORED_ROUNDS}`,
    );
  });
});

describe('both upgrade paths stay on show', () => {
  it('offers the first tier before anything is bought', () => {
    expect(pathCard(0)).toEqual({ tierIndex: 0, finished: false });
  });

  it('offers the second tier once the first is bought', () => {
    expect(pathCard(1)).toEqual({ tierIndex: 1, finished: false });
  });

  it('keeps a finished path on show, marked owned', () => {
    // The point of the whole function. A finished path used to vanish, and
    // a tower that had gone all the way down speed then looked like a tower
    // with no speed upgrades at all -- the panel stopped reading as a choice
    // between two routes and started reading as one route.
    expect(pathCard(2)).toEqual({ tierIndex: 1, finished: true });
  });

  it('never asks for a tier the path does not have', () => {
    for (const bought of [0, 1, 2] as const) {
      expect(pathCard(bought).tierIndex).toBeLessThanOrEqual(1);
    }
  });
});

describe('which way a tower looks', () => {
  // The sprites are drawn facing the viewer, which is straight down the
  // screen, so a target below the tower needs no turn at all.
  it('turns a head-on sprite towards the target', () => {
    expect(facingAngle(100, 100, 100, 200)).toBeCloseTo(0);
    // Half a turn, expressed as the negative half -- `rotate` cannot tell the
    // two apart, and the simulation's `easeAngle` wraps either into the
    // shorter route.
    expect(facingAngle(100, 100, 100, 0)).toBeCloseTo(-Math.PI);
    expect(facingAngle(100, 100, 200, 100)).toBeCloseTo(-Math.PI / 2);
    expect(facingAngle(100, 100, 0, 100)).toBeCloseTo(Math.PI / 2);
  });

  // The easing itself moved into `src/sim/` when Harold became a jet -- his
  // water lands where he is looking, so the heading stopped being decoration.
  // Its tests went with it, to `tests/sim.test.ts`.
});

describe('the game explains why a hit did nothing', () => {
  it('tells the player to hit harder while shots are being soaked up', () => {
    const line = hintText({ selected: null, idle: false, absorbing: true });
    expect(line).toMatch(/every single hit/);
    expect(line).toMatch(/hits harder/);
  });

  it('goes back to the ordinary line once hits are landing again', () => {
    expect(hintText({ selected: null, idle: false, absorbing: false })).toMatch(/Tap anyone/);
  });

  it('never talks over the placement instructions', () => {
    // Mid-placement the player has a job in hand; the explanation can wait.
    expect(hintText({ selected: 'norah', idle: false, absorbing: true })).toMatch(/green square/);
  });

  it('shows the shield a troublemaker is carrying right now', () => {
    const lines = enemyReadout({ def: 'mike', hp: 90, scale: 1, shield: 4 }).lines.join(' ');
    expect(lines).toMatch(/Shielded right now: 4/);
    // 3 armour + 4 shield, so 7 is nearly all eaten and 8 is the first that
    // pays in full.
    expect(lines).toMatch(/under 8 damage is nearly all eaten/);
  });

  it('says nothing about shields when none is on them', () => {
    const lines = enemyReadout({ def: 'sam', hp: 22, scale: 1, shield: 0 }).lines.join(' ');
    expect(lines).not.toMatch(/Shielded/);
  });
});

describe('space does whatever the run button says', () => {
  it('starts a round that has not begun', () => {
    expect(runKeyAction(' ', { status: 'idle', paused: false })).toBe('start');
  });

  it('pauses a running round and resumes a paused one', () => {
    expect(runKeyAction(' ', { status: 'running', paused: false })).toBe('toggle');
    expect(runKeyAction(' ', { status: 'running', paused: true })).toBe('toggle');
  });

  it('is as dead as the button once the game is over', () => {
    // The button is disabled on won and lost, and the key has to agree with
    // it -- a shortcut that still fired there was the old bug.
    for (const status of ['won', 'lost']) {
      expect(runKeyAction(' ', { status, paused: false })).toBeNull();
      expect(runButton({ status, paused: false }).disabled).toBe(true);
    }
  });

  it('no longer answers to p, which used to pause on its own', () => {
    // p flipped the pause flag without asking the button, so it "paused" a
    // round that had not started yet.
    expect(runKeyAction('p', { status: 'idle', paused: false })).toBeNull();
    expect(runKeyAction('P', { status: 'running', paused: false })).toBeNull();
  });

  it('ignores everything else, so a handler can pass every key through', () => {
    for (const k of ['a', 'Escape', 'f', '1', '']) {
      expect(runKeyAction(k, { status: 'running', paused: false })).toBeNull();
    }
  });
});

describe('recording a played board', () => {
  // The point of the recorder is that a board somebody played can be measured.
  // The round trip is therefore the whole guarantee: whatever comes out has to
  // go back through `parseLoadout` unchanged, and be something the campaign
  // harness will actually spend money on.
  const at = (col: number, row: number, extra: Partial<Placement> = {}): Placement => ({
    def: 'norah',
    col,
    row,
    upgradeA: 0,
    upgradeB: 0,
    capstone: null,
    ...extra,
  });

  it('writes each purchase as the tower stood after it', () => {
    const steps = [at(4, 4), at(4, 4, { upgradeA: 1 }), at(4, 4, { upgradeA: 2 })];
    expect(recordingOf(steps, 0).loadout).toBe('norah@4,4 norah@4,4+a1 norah@4,4+a2');
  });

  it('comes back out of parseLoadout as exactly what went in', () => {
    const steps = [
      at(4, 4),
      at(4, 4, { upgradeA: 1 }),
      at(10, 2, { def: 'bill' }),
      at(10, 2, { def: 'bill', upgradeA: 2, upgradeB: 2 }),
      at(10, 2, { def: 'bill', upgradeA: 2, upgradeB: 2, capstone: 'deadeye' }),
    ];
    expect(parseLoadout(recordingOf(steps, 0).loadout)).toEqual(steps);
  });

  it('reads a tower off the board rather than being told what it is', () => {
    const w = createWorld(1);
    w.gold = 100000;
    expect(placeTower(w, 'barbara', 10, 2)).toBe(true);
    const t = w.towers[0]!;
    expect(stepOf(t)).toEqual(at(10, 2, { def: 'barbara' }));
    expect(purchaseUpgrade(w, t.id, 'pathB')).toBe(true);
    expect(stepOf(t)).toEqual(at(10, 2, { def: 'barbara', upgradeB: 1 }));
  });

  it('says so when a sell has made the recording a lie', () => {
    // A loadout can only buy. A run that sold something records as though it
    // never did, which is wrong in a way nobody would spot once the string had
    // been pasted into builds.ts -- so it has to announce itself.
    expect(recordingOf([at(4, 4)], 0).warning).toBeNull();
    expect(recordingOf([at(4, 4)], 1).warning).toContain('1 tower was sent home');
    expect(recordingOf([at(4, 4)], 2).warning).toContain('2 towers were sent home');
  });

  it('produces a plan the campaign harness will actually spend on', () => {
    // The real consumer, not just the parser: `costOf` prices an entry and
    // `apply` carries it out, and either can reject a plan the parser accepted.
    const w = createWorld(1);
    w.gold = 100000;
    placeTower(w, 'norah', 4, 4);
    const t = w.towers[0]!;
    purchaseUpgrade(w, t.id, 'pathA');
    const recorded = recordingOf([stepOf(t)], 0).loadout;

    const run = runCampaign(parseLoadout(recorded), 1);
    expect(run.planBought).toBeGreaterThan(0);
  });
});

describe('a tapped troublemaker stays on screen after the frame it was tapped in', () => {
  // The bug this is named after: `Ui` kept its own copy of what the panel was
  // showing, `showEnemy` wrote into that copy, and the next frame -- driven by
  // main's state, which knew nothing of it -- decided the panel should close.
  // The panel now has one owner, and its key is a pure function of what is on
  // screen, so a frame that changes nothing cannot decide to close it.
  const walking = { id: 7, def: 'mike', hp: 90, scale: 1, shield: 0, x: 200, y: 140 } as const;

  it('keeps the same key frame after frame while nothing about it changes', () => {
    const first = focusKey({ kind: 'enemy', enemy: walking });
    const second = focusKey({ kind: 'enemy', enemy: { ...walking } });
    expect(second).toBe(first);
    expect(second).not.toBe(focusKey(null));
  });

  it('redraws when the health comes down', () => {
    expect(focusKey({ kind: 'enemy', enemy: { ...walking, hp: 40 } })).not.toBe(
      focusKey({ kind: 'enemy', enemy: walking }),
    );
  });

  it('redraws when a Ben starts shielding it', () => {
    expect(focusKey({ kind: 'enemy', enemy: { ...walking, shield: 4 } })).not.toBe(
      focusKey({ kind: 'enemy', enemy: walking }),
    );
  });

  it('tells two troublemakers apart even when they read identically', () => {
    expect(focusKey({ kind: 'enemy', enemy: { ...walking, id: 8 } })).not.toBe(
      focusKey({ kind: 'enemy', enemy: walking }),
    );
  });

  it('is marked on the board wherever it currently stands', () => {
    // The mark follows the troublemaker rather than the tap: it is read from
    // the enemy every frame, so it walks down the street with it.
    expect(focusMark({ kind: 'enemy', enemy: walking })).toEqual({ x: 200, y: 140 });
    expect(focusMark({ kind: 'enemy', enemy: { ...walking, x: 260 } })).toEqual({
      x: 260,
      y: 140,
    });
  });

  it('never collides with a defender panel', () => {
    expect(focusKey({ kind: 'enemy', enemy: walking })).not.toBe(
      focusKey({ kind: 'tower', tower: tower({ id: 7 }) }),
    );
  });
});

describe('inspecting a troublemaker from the round preview, before it has spawned', () => {
  it('reads at full health and unshielded', () => {
    expect(enemyTypeView('mike', 0)).toEqual({
      kind: 'enemyType',
      enemy: { def: 'mike', hp: ENEMIES.mike.hp, scale: 1, shield: 0 },
    });
  });

  it('reads at the health the round it belongs to will give it', () => {
    const round = 5;
    const { scale } = waveAt(round);
    expect(scale).toBeGreaterThan(1);
    const view = enemyTypeView('mike', round);
    expect(view).toEqual({
      kind: 'enemyType',
      enemy: { def: 'mike', hp: Math.round(ENEMIES.mike.hp * scale), scale, shield: 0 },
    });
  });

  it('agrees to the number with the one that walks on, so the preview and the board never disagree', () => {
    const round = 1;
    const w = createWorld(4);
    w.waveIndex = round;
    const walked = spawnEnemy(w, 'sam', 0, waveAt(round).scale);
    const previewed = enemyTypeView('sam', round);
    expect(previewed?.kind === 'enemyType' ? previewed.enemy.hp : null).toBe(walked.hp);
  });

  it('draws no selection ring, since nothing has walked on yet', () => {
    expect(focusMark(enemyTypeView('mike', 0))).toBeNull();
  });

  it('keeps the same key frame after frame, so the panel does not rebuild while parked open', () => {
    expect(focusKey(enemyTypeView('mike', 0))).toBe(focusKey(enemyTypeView('mike', 0)));
  });

  it('tells two previewed types apart', () => {
    expect(focusKey(enemyTypeView('mike', 0))).not.toBe(focusKey(enemyTypeView('gang', 0)));
  });

  it('never collides with a live troublemaker of the same kind', () => {
    const walking = { id: 7, def: 'mike', hp: 90, scale: 1, shield: 0, x: 200, y: 140 } as const;
    expect(focusKey(enemyTypeView('mike', 0))).not.toBe(focusKey({ kind: 'enemy', enemy: walking }));
  });

  it('never collides with a defender panel', () => {
    expect(focusKey(enemyTypeView('mike', 0))).not.toBe(
      focusKey({ kind: 'tower', tower: tower({ id: 7 }) }),
    );
  });
});

describe('what a tap on the board leaves the panel open on', () => {
  it('shows the troublemaker under the finger, not the cell beneath it', () => {
    expect(
      focusAfterTap({ enemyHit: 3, towerId: 9, action: 'inspect', current: null }),
    ).toEqual({ kind: 'enemy', id: 3 });
  });

  it('opens the tapped defender', () => {
    expect(
      focusAfterTap({ enemyHit: null, towerId: 9, action: 'inspect', current: null }),
    ).toEqual({ kind: 'tower', id: 9 });
  });

  it('closes on the tap that means close', () => {
    expect(
      focusAfterTap({
        enemyHit: null,
        towerId: null,
        action: 'close',
        current: { kind: 'tower', id: 9 },
      }),
    ).toBeNull();
  });

  it('leaves the panel alone while a tower is being placed', () => {
    // Buying a defender is not a decision about what you were reading.
    const open = { kind: 'enemy', id: 3 } as const;
    for (const action of ['place', 'unarm', 'nothing'] as const) {
      expect(focusAfterTap({ enemyHit: null, towerId: null, action, current: open })).toBe(open);
    }
  });

  it('names the focused defender, and nothing else', () => {
    expect(focusedTowerId({ kind: 'tower', id: 9 })).toBe(9);
    expect(focusedTowerId({ kind: 'enemy', id: 9 })).toBeNull();
    expect(focusedTowerId(null)).toBeNull();
  });
});

describe('the renderer ages what it draws in ticks, not in frames', () => {
  // The bug this is named after: every fading thing decremented once per
  // `draw()` call, which is once per screen refresh. On a 120Hz display that
  // ran every effect at half its intended length, and at 3x speed -- three
  // ticks between one frame and the next -- three times too long in the game's
  // own time.
  const fades = () => [{ life: 4 }, { life: 2 }];

  it('ages by the ticks that happened, not by one', () => {
    expect(advanceFades(fades(), 2)).toEqual([{ life: 2 }]);
  });

  it('retires in half the frames when a frame is worth two ticks', () => {
    const slow = advanceFades(advanceFades(fades(), 1), 1);
    const fast = advanceFades(fades(), 2);
    expect(fast).toEqual(slow);
  });

  it('leaves everything alone on a frame worth no ticks', () => {
    // Not an edge case: a 120Hz frame often falls between two ticks, and a
    // paused game produces nothing else.
    expect(advanceFades(fades(), 0)).toEqual(fades());
  });

  // `easeAngleOver` used to live here, to keep a tower's turn the same length
  // in game-time however the frames fell. It is gone: the simulation eases
  // once per tick now, so a frame worth three ticks and three frames worth one
  // cannot come apart in the first place. See `tests/sim.test.ts`.
});

describe('the renderer forgets towers that have left the board', () => {
  // What the renderer keeps per tower id -- last cooldown, recoil, facing --
  // was never dropped when a tower was sold or a blocker fell. Piling up is
  // the small half of it: a restart begins ids again at one, so a leftover
  // entry is not unused memory but somebody else's recoil.
  const kept = () => new Map([
    [1, 0.5],
    [2, 0.5],
    [3, 0.5],
  ]);

  it('names the ids no tower answers for, and only those', () => {
    expect(staleKeys(kept().keys(), new Set([1, 3]))).toEqual([2]);
  });

  it('keeps everything when every id is still on the board', () => {
    expect(staleKeys(kept().keys(), new Set([1, 2, 3]))).toEqual([]);
  });

  it('names everything when the board is empty', () => {
    expect(staleKeys(kept().keys(), new Set())).toEqual([1, 2, 3]);
  });

  it('has nothing to say about an empty map', () => {
    expect(staleKeys(new Map<number, number>().keys(), new Set([1]))).toEqual([]);
  });
});

describe('the absorbed-hit hint is measured in seconds a player can read', () => {
  it('starts full whenever another hit is absorbed', () => {
    expect(absorbHintLeft(10, 16.7, true)).toBe(ABSORB_HINT_MS);
  });

  it('counts down in real time, so 3x speed does not cut it short', () => {
    expect(absorbHintLeft(ABSORB_HINT_MS, 100, false)).toBe(ABSORB_HINT_MS - 100);
  });

  it('survives a tab coming back from the background', () => {
    // One frame can arrive with seconds on it. Counting all of them would
    // retire the hint before it had been on screen at all.
    expect(absorbHintLeft(ABSORB_HINT_MS, 5000, false)).toBeGreaterThan(0);
  });

  it('stops at zero rather than going negative', () => {
    expect(absorbHintLeft(10, 200, false)).toBe(0);
  });
});


describe('the board marks whatever was tapped, range or no range', () => {
  // Tapping something used to change nothing on screen unless it happened to
  // have a range circle, so the tap read as though it had missed. Walter and
  // Clara have no range, and neither has any troublemaker.
  it('marks a defender at its own position', () => {
    expect(focusMark({ kind: 'tower', tower: tower({ x: 180, y: 100 }) })).toEqual({
      x: 180,
      y: 100,
    });
  });

  it('marks a defender that has no range to draw', () => {
    expect(focusMark({ kind: 'tower', tower: tower({ def: 'walter', x: 220, y: 180 }) })).toEqual({
      x: 220,
      y: 180,
    });
  });

  it('marks nothing when nothing is selected', () => {
    expect(focusMark(null)).toBeNull();
  });
});


describe('a frame that threw', () => {
  // The loop this serves used to book the next frame after the work rather
  // than before it, so one exception anywhere below ended it for good and the
  // board froze with every button still responding. These are the two halves
  // of the policy that replaced that: survive a flicker, give up on a fault.
  it('carries on after the first one, because one bad frame is a flicker', () => {
    expect(afterFrameError(1)).toBe('carryOn');
  });

  it('carries on right up to the limit', () => {
    expect(afterFrameError(FRAME_FAILURE_LIMIT - 1)).toBe('carryOn');
  });

  it('gives up at the limit, rather than throwing sixty times a second', () => {
    expect(afterFrameError(FRAME_FAILURE_LIMIT)).toBe('stop');
  });

  it('stays given up past the limit', () => {
    expect(afterFrameError(FRAME_FAILURE_LIMIT + 20)).toBe('stop');
  });

  it('says what happened in words a player can act on', () => {
    // The exception belongs in the console. What goes on screen is the one
    // thing the person holding the mouse can do about it.
    expect(BREAKDOWN.title).toBeTruthy();
    expect(BREAKDOWN.body).toMatch(/again/);
  });
});
