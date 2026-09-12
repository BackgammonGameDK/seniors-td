# Seniors vs Troublemakers

A tower defence. Grandmas and grandpas defend a quiet street from rowdy youths
who come down it in rounds. You pay **Pension Coins** for defenders and lose
**Peace & Quiet Points** when someone gets past.

**There is no counter table, and there will not be one.** No elements, no
types, no chart of what beats what. Defenders are told apart by *shape* --
how far they see, how often they act, whether the hit lands on one
troublemaker or a crowd, and whether they act at all or make their neighbours
better. Armour and shields soften a hit, but they are flat numbers on an enemy
rather than a lookup, so no defender is ever the designated answer to one
troublemaker. This was a deliberate move away from a previous project that was
built entirely on such a table; proposing one again is re-opening a settled
decision.

Ids are lowercase first names and display names are the full ones -- `norah` is
Knitting Norah, `bill` is Binocular Bill. **They must never drift apart.** The
loadout grammar uses the ids, so `norah@5,4` is correct.

| Document | What it holds |
|---|---|
| [DESIGN.md](DESIGN.md) | Why the mechanics are shaped this way, and the lessons carried in from the last project. |

## The one architectural rule

**`src/sim/` never imports from `src/render/` and never touches the DOM.**

The simulation is a pure function of (state, input, seed): fixed 60Hz timestep,
one seeded RNG, no wall-clock time. Breaking this breaks headless playtesting,
which is what makes every balance claim a measurement instead of an opinion.

`tests/architecture.test.ts` enforces it by reading the source -- no import
from `src/render`, no DOM, no `Math.random()`, no wall clock. It has been
verified to fail when violated.

Presentational data lives in `src/shared/`, which both layers may import. No
hex colours, display names or blurbs in `src/sim/`.

## Where things live

| Path | What it is |
|---|---|
| `src/sim/towers.ts`, `src/sim/enemies.ts` | The whole design, as flat data. |
| `src/sim/waves.ts` | Twenty-one authored rounds, and `waveAt`, which grows the late ones into free play past the end. Composition is the difficulty dial. |
| `src/sim/world.ts` | `step()`, placement, auras, status effects, damage, splitting, blockades. The only place damage is resolved. |
| `src/sim/path.ts` | Board dimensions, the street, and which cells take a tower or a blockade. |
| `src/sim/upgrades.ts` | Two paths per defender and the final fork between them, plus `effectiveDef()` -- the only way to read a defender's bought stats. |
| `src/sim/economy.ts` | Bounties, the round clear bonus, and what selling returns. |
| `src/sim/builds.ts` | Eleven named boards the campaign harness plays: eight archetypes, plus `corner`, `binoculars` and `wall`, boards played by hand and kept verbatim. |
| `src/sim/loadout.ts` | The `towerId@col,row` grammar the harnesses parse, and `applyPlacement`, the one way either harness turns an entry into towers. |
| `src/harness-args.ts` | Where a harness gets its board from: `--loadout`, or `--loadout-file`. |
| `src/shared/display.ts` | Names, colours, radii, emoji. Both layers may read it. |
| `src/shared/upgrades.ts` | The words and pictures for the upgrades. Presentational half of `src/sim/upgrades.ts`. |
| `src/render/decisions.ts` | What the interface decides, without the interface. Pure and tested. |
| `src/render/canvas.ts` | Drawing. Read-only over the sim. |
| `src/headless.ts` | One round in isolation, behind `npm run sim`. |
| `src/campaign.ts` | Whole twenty-one-round runs on a real purse, behind `npm run campaign`. |

## Commands

```bash
npm run dev        # play it at localhost:5173
npm test           # vitest -- everything, about twenty seconds
npm run test:fast  # all but tests/balance.test.ts, in well under a second
npm run typecheck  # tsc --noEmit
npm run sim -- --all-waves                   # difficulty for every round
npm run sim -- --wave 7 --runs 60 --json     # machine-readable
npm run sim -- --wave 12 --loadout "norah@4,2 bill@10,8"
npm run sim -- --loadout-file loadout.txt    # a board saved from the game
npm run campaign -- --all-builds             # all seven boards, twenty-one rounds
npm run campaign -- --build sniper --runs 40 --json
npm run campaign -- --build corner --endless        # how far free play carries a board
```

## Turning a board you played into a measurement

While playing at localhost:5173, **press `L`**. It copies everything bought
this run, in the order it was bought, as a loadout string, and shows it in a
box with Copy and **Save as a file** in case the clipboard is refused. No
developer tools needed.

The box is a textarea rather than a `window.prompt` for a reason worth not
rediscovering: Chrome caps how much of a prompt's default value it will show
and cuts the middle out with an ellipsis. A board from a long run came back
`bill@10,6+a1...8,9+a1b1` -- unparseable, and elided in the text the player
copied, so it reached the file they pasted into. Saving as a file is the path
nothing can shorten.

Point a harness at the file you saved. **Prefer this to pasting the string**:
a board is meant to be shared, and a shared string inside double quotes is
text the shell expands -- `$(...)` and backticks run before `parseLoadout`
ever sees them. A path is a fixed word you typed, and the board's own bytes
arrive through the filesystem, which has no interpreter.

```bash
npm run campaign -- --loadout-file ~/Downloads/loadout.txt --runs 20
```

`--loadout "<the string>"` is still there for boards short enough to type by
hand, like the ones in `builds.ts`. Both harnesses take either, and refuse
both at once.

That closes the loop `loadout.ts` describes: a written plan could always be
played, but until now a played board could not be written down, so every board
in `builds.ts` was generated by `grow()` and none had been near a human. A
board that wins in the hand and loses in the harness is a finding about the
harness, not about the game.

Two limits worth knowing. A loadout can only buy, so a run where anything was
sold records as though it never was -- the box says so when that happens.
And **Restart clears the recording**, so press `L` before starting again.

The two harnesses answer different questions and neither substitutes for the
other.

`npm run sim` places towers free and refreshes lives each round, so it measures
one round's pressure in isolation.

`npm run campaign` plays whole twenty-one-round runs on a real purse, so it measures
what a player could actually afford by the time a round arrived. **This is the
one that decides whether the game is balanced**, because a round is only ever as
hard as the board that money could buy. Its builds live in `src/sim/builds.ts`
and `tests/balance.test.ts` asserts against the same measurement.

## Conventions

- **Put interface logic in `src/render/decisions.ts`, not in an event handler.**
  Every interface bug the previous project had came from logic tangled with the
  DOM where no test could reach it -- including a board that read its target
  cell from a `mousemove`, which made the game unplayable on a phone. A tap's
  target is read from the tap's own coordinates.
- **Auras are recomputed from nothing every tick**, never accumulated.
  `advanceAuras` writes `tower.rateMult`, `tower.disabled` and `enemy.shield`
  and is the only thing that may. An aura therefore cannot leak, double up, or
  outlive its source.
- **`speedMult` is written in `advanceEffects` and nowhere else**, so one
  function decides how fast anything walks.
- **A lingering effect resolves once, when the hit lands**, and ticks as flat
  numbers afterwards. Nothing in `advanceEffects` may re-enter `applyHit`.
- **Anything created during a tick is queued, not pushed.** `pendingSpawns` is
  flushed at the end of `step`, so a splash can never reach the enemies it just
  created.
- Balance is measured. Change `towers.ts`, `enemies.ts`, `waves.ts`,
  `upgrades.ts` or `economy.ts`, then re-run `npm run sim -- --all-waves` for
  the shape of each round and `npm run campaign -- --all-builds` for whether
  the run is still winnable by more than one board. The second is the one that
  can fail the standard this game is judged by.

## Automated checks

Two layers, and they run different amounts.

**The hook, while editing.** A `PostToolUse` hook runs
`npm run typecheck && npm run test:fast` after any edit to a `.ts` file under
`src/` or `tests/`. It lives in `.claude/hooks/check-after-edit.sh`. On failure
it exits 2 and prints to stderr, so a broken edit surfaces immediately. It
skips `tests/balance.test.ts`, which is very nearly the whole runtime of the
full suite.

**CI, before anything is published.** `.github/workflows/checks.yml` runs the
typecheck and the *full* suite on every pull request.
`.github/workflows/deploy.yml` runs both again on `main` and only then builds
and publishes to GitHub Pages, so a commit that fails either one cannot reach
the public page. Both have been verified to fail when violated.

## Cost

Every turn re-sends the whole conversation, so the cheap move is a shorter
conversation, not a cleverer prompt.

- **One session per task.** Finish it, then start a new one. A long session
  re-bills its early turns on every later turn.
- **Check the game in the browser early, or in its own session.** A browser
  pass at the end of a long session is the most expensive thing here: every
  fumbling step is billed against the full context. A *hidden* Browser pane
  freezes the animation, so front the tab before screenshotting, and prefer
  `read_page` to a screenshot for text and structure.
- **Delegate noise, not thinking.** The full suite and `npm run campaign`
  belong in the `qa` agent (haiku), whose output then never enters this
  context. Searching thirty-odd files does not -- grep is cheaper than an
  agent that starts cold.
- **Trim shell output where it is produced.** `npm test 2>&1 | tail -20`,
  `npm run campaign -- --json | jq`. Anything read once is re-read every turn
  afterwards.

## Git

- Substantial work gets a feature branch and a pull request. Nothing lands on
  `main` directly.
- **Push and merge need the owner's explicit approval, every time.**
- Commits are coherent and their messages say the intent.
