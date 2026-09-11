import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadoutText, wholeNumberArg } from '../src/harness-args.ts';
import { parseLoadout } from '../src/sim/loadout.ts';

/** A file holding `text`, in a directory the OS will clean up. */
function fileHolding(text: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'loadout-')), 'loadout.txt');
  writeFileSync(path, text);
  return path;
}

describe('where a harness gets its board', () => {
  it('takes it from --loadout', () => {
    expect(loadoutText({ loadout: 'norah@5,4' })).toBe('norah@5,4');
  });

  it('takes it from a file, which is the path nothing has to quote', () => {
    const path = fileHolding('norah@5,4 bill@11,9');
    expect(loadoutText({ 'loadout-file': path })).toBe('norah@5,4 bill@11,9');
  });

  it('is null when neither was given, so the caller can fall back', () => {
    expect(loadoutText({})).toBeNull();
  });

  it('refuses both at once rather than silently picking one', () => {
    const path = fileHolding('norah@5,4');
    expect(() => loadoutText({ loadout: 'bill@1,1', 'loadout-file': path })).toThrow(/not both/);
  });

  it('parses a saved file verbatim -- trailing newline and all', () => {
    // What the browser's "Save as a file" actually writes, newline included.
    const path = fileHolding('norah@5,4+a1\n');
    expect(parseLoadout(loadoutText({ 'loadout-file': path })!)).toEqual([
      { def: 'norah', col: 5, row: 4, upgradeA: 1, upgradeB: 0, capstone: null },
    ]);
  });
});

describe('a count given on the command line', () => {
  // `--runs abc` used to print a whole report of `NaN%` held rather than
  // refusing, and `--runs 0` summarised an empty list of seeds. A measurement
  // that reads as confident and means nothing is worse than one that never
  // appeared, which is the whole reason this check exists.
  it('takes the default when the flag was not given', () => {
    expect(wholeNumberArg('--runs', undefined, 20)).toBe(20);
  });

  it('takes the number when it is one', () => {
    expect(wholeNumberArg('--runs', '3', 20)).toBe(3);
  });

  it('allows the surrounding space a shell can leave behind', () => {
    expect(wholeNumberArg('--runs', ' 40 ', 20)).toBe(40);
  });

  it('refuses text, rather than passing NaN into every average', () => {
    expect(() => wholeNumberArg('--runs', 'abc', 20)).toThrow(/whole number/);
  });

  it('refuses zero, which measures nothing but reports anyway', () => {
    expect(() => wholeNumberArg('--runs', '0', 20)).toThrow(/at least 1/);
  });

  it('refuses a fraction and a negative and an empty string', () => {
    for (const bad of ['2.5', '-1', '', '1e3', '0x10']) {
      expect(() => wholeNumberArg('--runs', bad, 20), bad).toThrow();
    }
  });

  it('names the flag, so one check can serve --runs and --wave', () => {
    expect(() => wholeNumberArg('--wave', 'abc', 1)).toThrow(/--wave/);
  });
});
