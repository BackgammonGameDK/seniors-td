import { describe, expect, it } from 'vitest';
import { TOWERS } from '../src/sim/towers.ts';
import { TOWER_IDS } from '../src/sim/types.ts';
import { AUTHORED_ROUNDS } from '../src/sim/waves.ts';
import {
  armTower,
  boardAction,
  capstoneLocked,
  cardState,
  describeStats,
  endOverlay,
  enemyReadout,
  panelKey,
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
import type { Stats, Tower } from '../src/sim/types.ts';

const noStats: Stats = {
  kills: 3,
  leaks: 2,
  leaksByEnemy: { sam: 0, mike: 0, ben: 0, tina: 0, gang: 0, skye: 0, walker: 0 },
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

  it('changes its key when a blockade takes damage', () => {
    expect(panelKey(tower({ def: 'walter', hp: 220 }))).not.toBe(
      panelKey(tower({ def: 'walter', hp: 100 })),
    );
  });

  it('is stable when nothing has changed, so the panel is not rebuilt each frame', () => {
    expect(panelKey(tower())).toBe(panelKey(tower()));
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

  it('describes the two towers that never shoot without pretending they do', () => {
    const walter = describeStats(TOWERS.walter);
    expect(walter.some((r) => /road/.test(r.value))).toBe(true);
    expect(walter.some((r) => r.label === 'Damage')).toBe(false);

    const clara = describeStats(TOWERS.clara);
    expect(clara.some((r) => /faster/.test(r.value))).toBe(true);
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

  it('congratulates a finished run', () => {
    expect(endOverlay({ status: 'won', waveIndex: 20, stats: noStats }).title).toMatch(/quiet/i);
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
    const r = enemyReadout({ def: 'mike', hp: 90, scale: 1 });
    expect(r.lines.join(' ')).toMatch(/every hit lands/);
    expect(r.lines.join(' ')).toMatch(/cannot be stopped/i);
  });

  it('warns that the Gang comes back', () => {
    expect(enemyReadout({ def: 'gang', hp: 70, scale: 1 }).lines.join(' ')).toMatch(/Breaks into/);
  });

  it('says in words that slowing barely works on Skye', () => {
    const line = enemyReadout({ def: 'skye', hp: 70, scale: 1 }).lines.join(' ');
    expect(line).toMatch(/slowing works 75% less/);
    expect(line).not.toMatch(/slowResist/);
  });

  it('has nothing special to say about the plain ones', () => {
    expect(enemyReadout({ def: 'sam', hp: 22, scale: 1 }).lines).toHaveLength(1);
  });
});
