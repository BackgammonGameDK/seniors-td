import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadoutText } from '../src/harness-args.ts';
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
