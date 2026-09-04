/**
 * The fixed-timestep clock, as arithmetic rather than as a loop.
 *
 * The simulation advances in whole 1/60 ticks and must do so identically in the
 * browser and under `npm run sim` -- that agreement is what makes headless
 * playtesting mean anything. A speed control therefore changes **how many ticks
 * happen per real second**, never the size of a tick: at 3x the sim takes three
 * times as many of exactly the same steps.
 *
 * This lives apart from the loop in main.ts because it is the one part of a
 * speed control that can silently change how fast the game runs, and inside a
 * requestAnimationFrame callback no test can reach it. It is render-side and
 * imports nothing from src/sim.
 */

/** One tick, in milliseconds. 60 per simulated second. */
export const TICK_MS = 1000 / 60;

/**
 * Cap on catch-up work per frame, so a backgrounded tab cannot stall the page
 * when it returns. Scaled by speed below: a fixed cap would quietly throttle
 * fast-forward back toward 1x after any hitch.
 */
export const MAX_CATCHUP_MS = 250;

/** Speeds the player can choose. Zero is pause. */
export type Speed = 0 | 1 | 2 | 3;

export interface Clock {
  /** Unspent simulated time carried between frames. */
  accumulator: number;
}

export function createClock(): Clock {
  return { accumulator: 0 };
}

/**
 * How many ticks to run for a frame, given how long it really took.
 *
 * Mutates the clock's accumulator to carry the remainder: a 60Hz frame is
 * 16.67ms against a 16.67ms tick, so the fractional part matters -- dropping it
 * would lose about a tick a second and make the browser drift away from the
 * harness.
 */
export function ticksFor(clock: Clock, elapsedMs: number, speed: Speed): number {
  if (speed === 0) {
    // Paused: bank nothing. Time spent paused must not be replayed in a burst
    // the moment the player resumes.
    clock.accumulator = 0;
    return 0;
  }

  const scaled = Math.max(0, elapsedMs) * speed;
  clock.accumulator = Math.min(clock.accumulator + scaled, MAX_CATCHUP_MS * speed);

  const ticks = Math.floor(clock.accumulator / TICK_MS);
  clock.accumulator -= ticks * TICK_MS;
  return ticks;
}

/** 1 -> 2 -> 3 -> 1. Pause is a separate control, so it is not in the cycle. */
export function nextSpeed(speed: Speed): Speed {
  return speed >= 3 ? 1 : ((speed + 1) as Speed);
}
