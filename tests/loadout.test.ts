import { describe, expect, it } from 'vitest';
import { describePlacement, parseLoadout } from '../src/sim/loadout.ts';

describe('the loadout grammar', () => {
  it('reads a board written as a string', () => {
    expect(parseLoadout('norah@5,4 bill@11,9')).toEqual([
      { def: 'norah', col: 5, row: 4 },
      { def: 'bill', col: 11, row: 9 },
    ]);
  });

  it('accepts semicolons and stray whitespace, because shells add both', () => {
    expect(parseLoadout('  norah@1,1 ;\n bill@2,2  ')).toHaveLength(2);
  });

  it('is empty for an empty string rather than throwing', () => {
    expect(parseLoadout('   ')).toEqual([]);
  });

  it('names the unknown tower instead of failing quietly', () => {
    expect(() => parseLoadout('norma@1,1')).toThrow(/unknown tower "norma"/);
  });

  it('rejects a malformed entry', () => {
    expect(() => parseLoadout('norah@1')).toThrow(/bad loadout entry/);
  });

  it('round-trips through its own description', () => {
    const one = parseLoadout('barbara@7,3')[0]!;
    expect(describePlacement(one)).toBe('barbara@7,3');
  });
});
