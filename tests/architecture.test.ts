import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The rules the whole project rests on, which until now were held by
 * discipline alone.
 *
 * CLAUDE.md calls the first of these "the one architectural rule": the
 * simulation never imports from the renderer and never touches the DOM. Break
 * it and headless playtesting stops working -- and headless playtesting is the
 * reason every balance claim in this repo is a measurement rather than an
 * opinion. A rule that important should not depend on everyone remembering it.
 *
 * These read the source rather than importing it, so a violation is caught
 * even in a file nothing else pulls in.
 */
const SIM_DIR = new URL('../src/sim/', import.meta.url);

/**
 * Every `src/sim` file, with its comments already stripped.
 *
 * Stripped once here rather than inside one of the checks, which is how it
 * used to be: the `Math.random` check stripped and the DOM check did not, so a
 * file that merely *mentioned* `window.` in a doc comment failed a rule it had
 * not broken. Every check now reads the same `code`, which also means an
 * import written inside a comment cannot trip the import ban.
 */
function simFiles(): { name: string; code: string }[] {
  return readdirSync(SIM_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((name) => ({
      name,
      code: readFileSync(new URL(name, SIM_DIR), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, ''),
    }));
}

describe('the simulation stays pure', () => {
  it('has files to check, so a bad glob cannot pass this suite silently', () => {
    expect(simFiles().length).toBeGreaterThan(5);
  });

  it('never imports from the renderer', () => {
    for (const { name, code } of simFiles()) {
      const imports = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
      const offending = imports.filter((i) => i.includes('render'));
      expect(offending, `src/sim/${name} imports ${offending.join(', ')}`).toEqual([]);
    }
  });

  it('never touches the DOM', () => {
    for (const { name, code } of simFiles()) {
      expect(code, `src/sim/${name}`).not.toMatch(/\bdocument\.|window\.|requestAnimationFrame/);
    }
  });

  it('never reads the wall clock', () => {
    // The third clause of the purity rule, and the one that had no test:
    // CLAUDE.md says the simulation is a pure function of (state, input, seed)
    // with a fixed 60Hz timestep and no wall-clock time. A Date.now() here
    // would pass every other check in this repo and quietly make the browser
    // and `npm run sim` disagree about the same seed, which invalidates every
    // number in BALANCE.md without anything going red.
    for (const { name, code } of simFiles()) {
      expect(code, `src/sim/${name}`).not.toMatch(/\bDate\.now\b|\bperformance\.now\b|\bnew Date\b/);
    }
  });

  it('never calls Math.random', () => {
    // rng.ts states this in prose -- "Nothing in src/sim may call
    // Math.random()" -- and prose is not a test. Every random draw has to go
    // through the seeded Rng or the same seed stops producing the same run,
    // which would make every number this project reports meaningless.
    for (const { name, code } of simFiles()) {
      expect(code, `src/sim/${name}`).not.toContain('Math.random');
    }
  });
});
