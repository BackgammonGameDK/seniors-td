import { describe, expect, it } from 'vitest';
import { MAX_CATCHUP_MS, TICK_MS, createClock, nextSpeed, ticksFor } from '../src/render/clock.ts';

/**
 * The clock decides how fast the game runs, and it is the one place a speed
 * control could silently break the promise the whole project rests on: the
 * browser and `npm run sim` advance the simulation in identical whole ticks.
 * Speed changes how many ticks happen per real second, never what a tick is.
 */
describe('fixed-timestep clock', () => {
  /** A second of real time, delivered as 60Hz frames the way a browser does. */
  function oneSecond(speed: Parameters<typeof ticksFor>[2]): number {
    const c = createClock();
    let ticks = 0;
    for (let i = 0; i < 60; i++) ticks += ticksFor(c, 1000 / 60, speed);
    return ticks;
  }

  it('runs 60 ticks for a second of real time at 1x', () => {
    // Measured across real frames rather than one 1000ms jump, because a
    // single frame that long is a stall and is deliberately clamped.
    expect(oneSecond(1)).toBe(60);
  });

  it('runs proportionally more ticks at higher speeds', () => {
    expect(oneSecond(2)).toBe(120);
    expect(oneSecond(3)).toBe(180);
  });

  it('runs nothing at all while paused', () => {
    const c = createClock();
    expect(ticksFor(c, 1000, 0)).toBe(0);
  });

  it('does not replay banked time in a burst when unpaused', () => {
    // Time spent paused is time that did not happen. Banking it would fire a
    // hundred ticks the instant the player resumes -- which, in a game where
    // a leak costs lives, would be indistinguishable from a bug.
    const c = createClock();
    ticksFor(c, 500, 1);
    ticksFor(c, 30_000, 0);
    expect(ticksFor(c, 1000 / 60, 1)).toBeLessThanOrEqual(1);
  });

  it('carries the remainder between frames instead of dropping it', () => {
    // A 60Hz frame is 16.67ms against a 16.67ms tick. Rounding down each frame
    // and discarding the rest would lose about a tick a second, and the browser
    // would drift away from the harness it is supposed to reproduce.
    const c = createClock();
    let ticks = 0;
    for (let i = 0; i < 60; i++) ticks += ticksFor(c, 1000 / 60, 1);
    expect(ticks).toBe(60);
  });

  it('accumulates fractions across frames that are shorter than a tick', () => {
    const c = createClock();
    expect(ticksFor(c, 10, 1)).toBe(0);
    expect(c.accumulator).toBeCloseTo(10);
    expect(ticksFor(c, 10, 1)).toBe(1);
  });

  it('scales the catch-up clamp with speed rather than throttling fast-forward', () => {
    // A fixed cap would quietly pull 3x back toward 1x after any hitch, which
    // is precisely when the player most wants the speed they asked for.
    const stalled = 10_000;
    const at1 = ticksFor(createClock(), stalled, 1);
    const at3 = ticksFor(createClock(), stalled, 3);
    expect(at1).toBe(Math.floor(MAX_CATCHUP_MS / TICK_MS));
    expect(at3).toBe(Math.floor((MAX_CATCHUP_MS * 3) / TICK_MS));
    expect(at3).toBeGreaterThan(at1);
  });

  it('ignores time running backwards', () => {
    const c = createClock();
    expect(ticksFor(c, -500, 1)).toBe(0);
  });

  it('cycles speeds without ever landing on pause', () => {
    // Pause is its own control; cycling into it would make the speed button
    // able to stop the game, which is not what it says it does.
    expect(nextSpeed(1)).toBe(2);
    expect(nextSpeed(2)).toBe(3);
    expect(nextSpeed(3)).toBe(1);
  });
});
