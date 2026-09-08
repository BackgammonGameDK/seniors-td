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
4. ~~**Start/pause/speed controls need a home that doesn't require
   scrolling.**~~ Done, and this note simply outlived the fix. `ebf38bf` took
   `#controls` out of the page flow and gave it `position: absolute` inside
   `#boardWrap`, and `3ee14ac` settled it in the bottom-right corner. The
   buttons now float over the lawn, so they sit wherever the board sits and
   cannot be pushed below anything. They are opaque dark rather than
   see-through for a reason the CSS explains: a translucent element over the
   canvas is at the mercy of how the browser composites the two, and rendered
   too light in testing.

## Tower stats

1. ~~**Show a placed tower's kill count.**~~ Done -- tapping a placed tower
   shows a "Sent home" row counting the troublemakers it has finished off,
   updating live as the round runs. Lifetime since it was placed, not per
   round. Left off Clara and Walter, who never deal damage and would sit at
   zero forever.

## From playing, September 2026

Noticed at the board rather than in the code.

1. **Free play after round 21.** The campaign ends when the twenty-one
   authored rounds are done. There should be something to carry on with
   afterwards for a player who wants to keep going.

2. ~~**You cannot see what you have selected.**~~ Done. Whatever the inspect
   panel is open on now carries a mark on the board: a caret above the head
   and a pool of colour on the ground, in the same accent the build menu uses
   for an armed card. The same mark for a troublemaker and for a defender, and
   drawn whether or not the thing has a range -- which was the whole problem,
   since the range circle was the only feedback and Walter, Clara and every
   troublemaker have none. Deliberately not a ring: a troublemaker already
   wears rings that mean armour and shield. `Renderer.draw` takes the
   `FocusView` rather than a tower, which is what let the board see a selected
   troublemaker at all.

3. ~~**An armed card with no money left should be easy to drop.**~~ Done --
   the card already dimmed itself once unaffordable (`cardState` never
   exempted the armed one from the `poor` class), so the only missing piece
   was what a board tap then did. `boardAction` now folds affordability into
   the same branch that already drops the arming on an illegal cell, so a
   legal-but-unaffordable tap reads as `'unarm'` too -- no forced deselect
   the instant gold dips (which could undo itself a second later on a kill),
   only when you actually try to spend it. The board's own hover preview had
   the same gap from the other direction -- it painted a legal, unaffordable
   cell green with a range circle, promising a placement the wallet would
   refuse. `drawPlacementPreview` now calls `canPlace` (the exact check
   `placeTower` runs) instead of a hand-rolled cell-shape check, so the
   preview can no longer lie about what a tap will do.

4. **Killing a splitter should cost more than one life.** Right now finishing
   off a troublemaker who breaks into two costs the same one life as any
   other kill that gets through, even though it hands you two troublemakers
   in the same spot instead of zero. That can leave you worse off than if
   you had dealt less damage and not triggered the split at all. A split
   kill should probably cost two or three lives, not one.

5. ~~**The "next round brings" overview should let you inspect one enemy at
   a time.**~~ Done -- clicking an entry opens the same `#inspect` panel a
   board tap does, since `Focus` grew a third kind, `enemyType`, that
   `enemyReadout` reads from `ENEMIES` alone (full health, no shield, no
   position, so the board draws no ring for something that hasn't spawned).
   Every existing way to close the panel -- tapping elsewhere, Close,
   starting the round -- already worked on it for free, since they all just
   set `focus = null` regardless of what kind it was.

6. **Clicking an enemy in "Next round brings" should show a picture of it.**
   The panel that opens (see item 5) is text-only stat rows -- no portrait,
   for a previewed type or for a live-tapped troublemaker either. A tower's
   build card already has one (`towerArtUrl`, with an emoji fallback); the
   inspect panel has nothing equivalent for a troublemaker.

## From a code review, September 2026

Found by reading the whole codebase and measuring, not by playing. Ranked
roughly by how much they matter. The three that were fixed straight away are
in PRs #49 and #50; these are what was left.

### 1. ~~Tapping a troublemaker shows its readout for one frame~~

Done. The panel has one owner in `main.ts` -- a `Focus` of `{ kind, id }`
resolved against the world each frame -- `showEnemy` is gone as a side door,
and the transition rules live in `decisions.ts` as `focusAfterTap`,
`focusedTowerId` and `focusKey`, tested under a heading named after the bug.
Two things came free with it: the readout is live, so health counts down and
the shield line appears as a Ben walks past, and the panel closes itself when
its troublemaker is sent home. The `Close` button, dead for the same reason,
works.

The diagnosis is kept below because it is why the fix is shaped this way.

The whole "what is this thing" feature was effectively dead in the shipped
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

### 2. The difficulty curve is flat for two thirds of the game -- for some boards

Most *generated* builds take **zero damage until round 14 or 15**, then fall
off a cliff. `sniper` holds 22 lives through nineteen rounds and loses all 22
in round 20. `tests/balance.test.ts` now has a reference-build section that
would catch a played board sailing through untouched, which nothing did
before, and `binoculars` joins `corner` as a recorded board.

A round of tuning against this went in and came back out, and what it measured
is worth keeping:

- **The flatness is the board, not the game.** `corner` loses points on two
  rounds out of twenty-one. `binoculars`, the second played board, loses ten
  at round 12 and six at round 14 on the same waves. Every conclusion drawn
  from `corner` alone was a conclusion about an unusually strong knot.
- **The middle pays for the end.** Bounties from a bigger round 10 bought
  `corner` four more plan entries before round 20, and round 20 then cost it
  nothing. Making the middle harder makes the end easier, through the purse.
- **Hit points are not the lever.** Round 16 at `scale` 1.95 -- above round
  21's -- still cost `corner` nothing. What gets past a board is bodies per
  second.
- **Swarms are all-or-nothing.** 48 Sams at gap 28 cost nothing; 52 at gap 26
  cost six. Runners grade where a swarm cliffs -- but a runner group tuned to
  cost `corner` four points took `binoculars` from a 94% clear rate to 63%.

So the open question is not "make the middle harder". It is why one played
board is immune to rounds that visibly hurt another one. A third played board,
`wall`, was recorded and answers a good part of it.

#### What `wall` showed

It clears every seed with 21.75 lives of 25, losing points only at rounds 4
and 6 and nothing at all from round 7 to round 21. Two assertions fail because
of it and are left failing: nobody-finishes-untouched, and the-end-is-the-hard-
part. It owns seventeen plan entries at round 10, the same as `corner`, so it
is not out-spending the curve.

**The three garden walls do nothing.** Removing all three Walters from the
board changes the result not at all -- still 100%, still 21.4 lives. The lane
distances say why: the walls stand at 560-640, and the knot that does the
killing is at 320-400. Everything is dead before it reaches them. Removing any
other piece ends the run -- no Barbaras dies at round 5, no Norahs at round 13,
no Claras at round 20 -- so the board is a splash-and-volume knot with a rate
buff, and the blockades are ornament.

**Splash throughput does not care how big the crowd is.** That is the likeliest
reason no late round touches this shape. Every round from 17 to 21 is composed
of *more bodies*, and a Barbara hitting all of them at once answers more bodies
for free, while two Claras keep six Norahs firing through the pile. The only
played board that volume hurts is `binoculars`, which kills one troublemaker at
a time. So the back half of the game currently asks one question -- can you
delete a crowd -- and a splash knot at the double-back has already answered it.

#### The shield was the answer, and Ben was too fragile to give it

The lead was tested and it was right. Ben's whole identity is the aura -- a
flat 2 off every hit landing within 90px of him -- and he had 55 hit points,
which is less than a splash knot deletes on arrival. He died before he had
protected anybody, so the one mechanic built to punish many weak hits never
happened.

Measured against the three played boards, at twelve seeds each:

| change | corner | binoculars | wall |
|---|---|---|---|
| as shipped | 100% / 15.0 | 92% / 8.8 | 100% / 21.6 |
| hp 55 -> 160 | 50% | 42% | 0% |
| shieldAura 2 -> 5 | 17% | 25% | 50% / 12.3 |
| auraRange 90 -> 140 | 50% | 42% | 100% / 20.6 |

Only survival reaches the knot. A stronger shield costs a board that kills one
at a time far more than it costs a splash board, which is backwards, and more
range does nothing to a knot at all.

**Ben now has 95 hit points.** Every played board still clears, `wall` pays
something at last, and the whole cohort feels round 20:

    build      held 20   lives left        build      held 20   lives left
    support        63%          2.6        corner         88%         10.7
    mixed          75%          4.3        binoculars     75%          7.0
                                           wall          100%         17.3

Five of the nine boards now clear at least half the time, where three did
before, so this was a gain in variety and not only in difficulty.

Two things it did not fix, both worth knowing:

- **`wall` ends on 17.3 against a threshold of 18.** The assertion passes on a
  thin margin and seed noise could flip it. If it does, the answer is another
  played board or a harder look at the knot, not a bigger number.
- **Rounds 16 to 21 still cost `wall` nothing.** The change taxes it once, at
  round 15. The back half of the game still asks the one question a splash
  knot has already answered.

### 3. ~~Render-side animation is frame-counted, not time-counted~~

`FLOATER_LIFE`, `BURST_LIFE`, `recoil` and `TURN_RATE` in
`src/render/canvas.ts`, and `absorbTicks` in `src/render/ui.ts`, all decrement
once per `draw()`/`sync()` call -- per frame, not per tick. Two consequences:

- On a 120Hz display every effect runs at **half its intended duration**.
  `ABSORB_HINT_TICKS = 180` is 3s at 60Hz and 1.5s at 120Hz.
- At speed 3 the sim runs three ticks per frame but floaters decay one per
  frame, so effects last three times as long in game-time.

`src/render/clock.ts` already solved exactly this for the simulation; the fix
never reached the renderer.

Done. `frame()` now hands the tick count to a new `Renderer.advance`, which
does all the ageing, so `draw` is read-only over what it draws -- the ageing
used to happen inside `drawEffects` and `drawTower`, which is why it counted
frames. The rules live in `decisions.ts` as `advanceFades` and `easeAngleOver`
and are tested there.

The absorbed-hit hint was deliberately left on real time rather than moved to
ticks, and is now `ABSORB_HINT_MS = 3000` counted through `absorbHintLeft`. It
is a sentence a player has to read: tied to game time it would flash past in
one second at 3x speed, exactly when somebody watching their shots do nothing
has least chance of reading why, and it would freeze unread on a pause. A very
long frame -- a tab returning from the background -- is clamped so it cannot
retire the hint before it has been seen.

### 4. Smaller things

- **The renderer leaks map entries.** `lastCooldown`, `recoil` and `facing`
  in `canvas.ts` are keyed by tower id and never pruned when a tower is sold
  or falls. Bounded by `nextId` over a session, so small, but trivial to fix
  by dropping ids absent from `world.towers` once a round.
- ~~**Inspecting a regenerating Walter rebuilds the whole panel several times
  a second.**~~ Done alongside the readout fix above, which had to touch the
  same key. `hp` has moved out of `panelKey` and into the `paintStats` key,
  where `sentHome` already lived for the same reason, so a rebuild no longer
  re-measures the reserved height or destroys the upgrade card under the
  pointer six times a second.
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
