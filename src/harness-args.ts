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
