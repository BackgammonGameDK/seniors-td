# Follow-up work

Not yet scheduled. Notes to self so these aren't lost.

## Upgrade panel UX (from playtesting the tower-upgrades feature)

1. ~~**Preview range on hover.**~~ Done -- hovering a tier or capstone card
   that changes range draws a dashed preview circle at that range around
   the inspected tower, alongside the normal solid range circle.
2. ~~**Tapping an illegal cell should drop the armed tower.**~~ Done --
   `boardAction` now returns `'unarm'` for this case, matching the existing
   "tap the card again to change your mind" behaviour.
3. ~~**Upgrades should be visible immediately on selecting a tower.**~~
   Done -- build cards are compact by default and expand on arming, "The
   neighbours" is hidden and replaced by the upgrade panel while a placed
   tower is being inspected, and a path now shows only its next buyable
   tier rather than both at once, so the panel never shows more than one
   open card per path.
4. **Start/pause/speed controls need a home that doesn't require
   scrolling.** They currently sit below the fold on a normal viewport.

## Tower stats

1. ~~**Show a placed tower's kill count.**~~ Done -- tapping a placed tower
   shows a "Sent home" row counting the troublemakers it has finished off,
   updating live as the round runs. Lifetime since it was placed, not per
   round. Left off Clara and Walter, who never deal damage and would sit at
   zero forever.

## From a code review, September 2026

Found by reading the whole codebase and measuring, not by playing. Ranked
roughly by how much they matter. The three that were fixed straight away are
in PRs #49 and #50; these are what was left.

### 1. Tapping a troublemaker shows its readout for one frame

The whole "what is this thing" feature is effectively dead in the shipped
game. Verified in the browser: immediately after the tap `#inspect` is
visible and titled correctly, and after the next `frame()` it is hidden and
the build menu is back.

The cause is **two owners of one piece of state**. `src/main.ts` owns
`inspected`; `Ui` keeps its own `this.inspected` and `this.lastPanel`.
`showEnemy` writes into that shadow copy, and the next `sync()` -- driven by
main's state, where `inspected` is null -- overwrites it:

```
syncInspect(null, gold):
  key = panelKey(null)            // 'none'
  key !== this.lastPanel          // 'enemy:Scooter Sam:...'
  this.inspect.hidden = true      // readout gone
```

Note that `enemyReadout` and `pickEnemy` are both thoroughly tested in
`tests/decisions.test.ts` and neither catches this: the bug lives at the
`main.ts` <-> `ui.ts` seam, which has no tests at all, and both files are
excluded from coverage in `vite.config.ts`.

The fix is to give the panel one owner in `main.ts` -- something like
`type Focus = { kind: 'tower'; id: number } | { kind: 'enemy'; id: number } | null`
passed through `sync`, with `showEnemy` deleted as a side door, and the
transition rules in `decisions.ts` with a test named after this bug. Worth
adding one jsdom smoke test that mounts `Ui`, calls `sync` twice, and asserts
the readout survives frame two.

### 2. The difficulty curve is flat for two thirds of the game

Most builds take **zero damage until round 14 or 15**, then fall off a cliff.
`sniper` holds 22 lives through nineteen rounds and loses all 22 in round 20.

`tests/balance.test.ts` asserts the last rounds are the hard ones, and that
passes -- but nothing catches "the first fourteen rounds cost nothing", which
is a long time to ask a player to stay interested. Worth a test asserting some
pressure has landed by round 8-10.

### 3. Render-side animation is frame-counted, not time-counted

`FLOATER_LIFE`, `BURST_LIFE`, `recoil` and `TURN_RATE` in
`src/render/canvas.ts`, and `absorbTicks` in `src/render/ui.ts`, all decrement
once per `draw()`/`sync()` call -- per frame, not per tick. Two consequences:

- On a 120Hz display every effect runs at **half its intended duration**.
  `ABSORB_HINT_TICKS = 180` is 3s at 60Hz and 1.5s at 120Hz.
- At speed 3 the sim runs three ticks per frame but floaters decay one per
  frame, so effects last three times as long in game-time.

`src/render/clock.ts` already solved exactly this for the simulation; the fix
never reached the renderer. Feed the tick count from `frame()` into
`ingest`/`draw` and decay by ticks elapsed.

### 4. Smaller things

- **The renderer leaks map entries.** `lastCooldown`, `recoil` and `facing`
  in `canvas.ts` are keyed by tower id and never pruned when a tower is sold
  or falls. Bounded by `nextId` over a session, so small, but trivial to fix
  by dropping ids absent from `world.towers` once a round.
- **Inspecting a regenerating Walter rebuilds the whole panel several times a
  second.** `panelKey` includes `Math.ceil(t.hp)`; with `rally` (regen 6/s)
  that changes six times a second, and each rebuild runs `reserveStatHeight`,
  which writes `innerHTML` and reads `offsetHeight` five times -- five forced
  synchronous layouts -- and destroys the upgrade card under the pointer.
  That is precisely the flicker the surrounding code works hard to avoid. Move
  `hp` out of `panelKey` and into the `paintStats` key, where `sentHome`
  already lives for the same reason.
- **`rangeMult` is uncapped** in `advanceAuras` while `rateMult` is capped at
  `MAX_RATE_MULT`. Probably fine at 0.15 per Clara, but it is the same
  stacking shape that needed a cap once already.
- **`Tower.capstone` is `string | null`.** A per-tower union would have made
  the capstone mismatch fixed in #49 a compile error instead of a latent
  crash.

## Balance questions this review opened

Both are measurements without a decision attached, and both want a human
opinion rather than another sweep.

- **`control` has a cliff, not a curve.** Eleven towers clears 100% of seeds
  with 24 lives left; ten towers clears 0%. Nothing in between, at any
  composition tried. It ships at ten so it competes without winning, but a
  build with no middle ground is suspicious.
- **`swarm` and `area` clear 0%.** Decided to be intended -- a board of one
  kind of defender is meant to lose, and DESIGN.md now says why -- but the
  numbers have never been checked against what those two shapes are supposed
  to feel like.

## Ruled out, so nobody investigates it twice

- **"Builds bank 400-1000 unspent coins, so the plans are too short."** They
  do bank it, but it is a symptom rather than a cause. Extending every plan by
  four, eight and twelve more towers changed no clear rate at all and moved
  average unspent only from 471 to 373: the builds die before they walk that
  far down their own plan.
- **"Party Bus Duke made the game unwinnable."** He did not. A board played by
  hand clears all twenty seeds with 14.8 lives spare against Duke at his full
  1000 HP. Giving him back counterplay -- blockades stopping him, slow
  resistance halved -- changed nothing either. The boards being measured were
  the problem. See DESIGN.md, "The street is the decision".
