/**
 * The simulation's ONLY source of randomness.
 *
 * Nothing in src/sim may call Math.random(). Every random draw goes through a
 * seeded Rng so that the same seed always produces the same wave outcome --
 * which is what makes `npm run sim` a measuring instrument instead of an
 * anecdote.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** mulberry32 -- small, fast, good enough, and identical across platforms. */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [a, b). */
  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  /** Integer in [a, b], inclusive at both ends. */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
}
