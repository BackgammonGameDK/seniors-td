/**
 * Command-line plumbing shared by the two harnesses.
 *
 * Only the Node entry points import this. It reads files, which is exactly
 * what `src/sim` may not do, so it lives out here beside `headless.ts` and
 * `campaign.ts` rather than next to the parser it feeds.
 */
import { readFileSync } from 'node:fs';

/** The two ways a harness can be handed a board. */
export interface LoadoutArgs {
  loadout?: string | undefined;
  'loadout-file'?: string | undefined;
}

/**
 * The board a run was asked for, as text, or `null` if none was given.
 *
 * `--loadout-file` exists because of what the shell does before Node runs.
 * A board pasted into `--loadout "..."` is inside double quotes, so zsh
 * expands `$(...)` and backticks in it first, and `parseLoadout`'s strict
 * grammar never gets the chance to reject them -- it is checking text that
 * has already been executed. That matters because a recorded board is meant
 * to be shared: press `L`, save the file, send it to someone. The string you
 * paste is not necessarily one you wrote.
 *
 * Passing a path instead means the shell only ever sees a fixed word you
 * typed, and the board's own bytes arrive through the filesystem, which has
 * no interpreter. There is nothing to quote and so nothing to quote wrongly.
 *
 * `--loadout` stays for boards short enough to type: the strings in
 * `builds.ts`, the examples in the docs, a two-tower probe.
 */
export function loadoutText(args: LoadoutArgs): string | null {
  const path = args['loadout-file'];
  if (path !== undefined && args.loadout !== undefined) {
    throw new Error('pass --loadout or --loadout-file, not both');
  }
  // Trailing newlines and one-placement-per-line files both parse: the
  // grammar splits on runs of whitespace and drops the empties.
  if (path !== undefined) return readFileSync(path, 'utf8');
  return args.loadout ?? null;
}

/**
 * Runs a harness, and turns a refusal into a refusal rather than a crash.
 *
 * Everything here and in the parsers below it reports a bad argument by
 * throwing, which Node prints as ten lines of its own internals with the
 * sentence that was actually written for the reader buried at the top. The
 * messages are the useful part -- which flag, what it wanted, what it got, and
 * for a build or a capstone the list of names that would have worked -- so
 * they are printed on their own and the stack is dropped.
 *
 * Only the two entry points call this. A thrown error still behaves normally
 * anywhere a harness is imported as a module, which is how `tests/` uses it.
 */
export function run(main: () => void): void {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/** Digits and nothing else. `Number` is far too willing; this is not. */
const WHOLE = /^\d+$/;

/**
 * A count given on the command line, or the default when it was not given.
 *
 * `Number('abc')` is NaN, and every average taken from it is NaN too, so
 * `--runs abc` used to print a whole report of `NaN%` held and `NaN` lives per
 * round rather than refusing. `--runs 0` did the same by a different route: no
 * seeds ran, and the summary was taken over an empty list. In a project where
 * the measurement *is* the argument, a table that reads as confident and means
 * nothing is worse than one that never appeared.
 *
 * The flag names itself in the message so one check serves `--runs` and
 * `--wave` without either caller writing its own wording.
 */
export function wholeNumberArg(flag: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const text = raw.trim();
  if (!WHOLE.test(text) || Number(text) < 1) {
    throw new Error(`${flag} takes a whole number of at least 1, not "${raw}"`);
  }
  return Number(text);
}
