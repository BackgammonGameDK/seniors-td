import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng.ts';

/**
 * The seeded generator every measurement in this project inherits from.
 *
 * `npm run sim`, `npm run campaign` and `npm run diversity` all rest on the
 * claim that a seed reproduces a run exactly. Until now nothing tested the one
 * class that claim depends on.
 */
describe('seeded rng', () => {
  it('reproduces a sequence exactly from the same seed', () => {
    const draw = (seed: number) => {
      const r = new Rng(seed);
      return Array.from({ length: 50 }, () => r.next());
    };
    expect(draw(1234)).toEqual(draw(1234));
  });

  it('diverges on different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('survives a seed of zero rather than degenerating', () => {
    // A generator that gets stuck on 0 would make seed 0 silently useless, and
    // nothing in the harnesses forbids passing it.
    const r = new Rng(0);
    const draws = Array.from({ length: 20 }, () => r.next());
    expect(new Set(draws).size).toBeGreaterThan(15);
  });

  it('stays inside the unit interval', () => {
    const r = new Rng(99);
    for (let i = 0; i < 500; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('keeps range() within its bounds, including negative lower bounds', () => {
    // Layer breaking scatters children with range(-12, 12); a generator that
    // strayed outside would place a child off the lane.
    const r = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.range(-12, 12);
      expect(v).toBeGreaterThanOrEqual(-12);
      expect(v).toBeLessThan(12);
    }
  });

  it('spreads reasonably rather than clustering', () => {
    const r = new Rng(31);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 5000; i++) buckets[Math.floor(r.next() * 10)]!++;
    for (const b of buckets) expect(b).toBeGreaterThan(300);
  });
});
