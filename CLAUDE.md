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
| `src/sim/waves.ts` | Twenty authored rounds. Composition is the difficulty dial. |
| `src/sim/world.ts` | `step()`, placement, auras, status effects, damage, splitting, blockades. The only place damage is resolved. |
| `src/sim/path.ts` | Board dimensions, the street, and which cells take a tower or a blockade. |
| `src/sim/loadout.ts` | The `towerId@col,row` grammar the harnesses parse. |
| `src/shared/display.ts` | Names, colours, radii, emoji. Both layers may read it. |
| `src/render/decisions.ts` | What the interface decides, without the interface. Pure and tested. |
| `src/render/canvas.ts` | Drawing. Read-only over the sim. |
| `src/headless.ts` | The playtest harness behind `npm run sim`. |

## Commands

```bash
npm run dev        # play it at localhost:5173
npm test           # vitest
npm run test:fast  # everything but the slow balance sweeps -- the same as
                   # npm test until those sweeps exist
npm run typecheck  # tsc --noEmit
npm run sim -- --all-waves                   # difficulty for every round
npm run sim -- --wave 7 --runs 60 --json     # machine-readable
npm run sim -- --wave 12 --loadout "norah@4,2 bill@10,8"
```

`npm run sim` places towers free and refreshes lives each round, so it measures
one round's pressure in isolation.

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
- Balance is measured. Change `towers.ts`, `enemies.ts` or `waves.ts`, then
  re-run `npm run sim -- --all-waves`.

## Automated checks (hook)

A `PostToolUse` hook runs `npm run typecheck && npm run test:fast` after any
edit to a `.ts` file under `src/` or `tests/`. It lives in
`.claude/hooks/check-after-edit.sh`. On failure it exits 2 and prints to
stderr, so a broken edit surfaces immediately.

## Git

- Substantial work gets a feature branch and a pull request. Nothing lands on
  `main` directly.
- **Push and merge need the owner's explicit approval, every time.**
- Commits are coherent and their messages say the intent.
