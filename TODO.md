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

1. ~~**Free play after round 21.**~~ Done. Holding all twenty-one still ends
   the game the way it did, and the victory overlay now offers "Keep going"
   beside Restart. Taking it puts the run into free play, where `waveAt` grows
   one of the three late shapes -- mass, the swarm, everything at once -- by
   seven percent a round, rotating so no two extra rounds are the same round
   twice. It is a pure function of the round number, so round thirty is the
   same round thirty on every seed and `npm run campaign -- --endless` can
   compare one board's free play against another's.

   Bodies per second is what grows, not hit points, for the reason the review
   below measured: a splash knot at the double-back deletes a crowd for a fixed
   cost however large or healthy the crowd, so a round that only grew `scale`
   would never arrive. Growth stops at four times the shape it grew from, past
   which only `scale` climbs -- a ceiling that also keeps a deep round inside
   the harness's tick limit and a browser's frame budget.

   Measured at eight seeds a build: the boards that clear the campaign get one
   to seven rounds of free play out of it -- `support` reaches 22, `corner` 25,
   `mixed` 28 -- and none reaches the harness's cap of 60. Read those as a
   floor rather than a figure. The harness plays a written plan and stops
   buying when the plan runs out, so `corner` enters free play with 3500
   unspent coins it has nothing to do with, where a player at the board would
   still be spending.

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

6. ~~**Clicking an enemy in "Next round brings" should show a picture of
   it.**~~ Done -- `enemyArtUrl` mirrors `towerArtUrl` (falling back to the
   emoji glyph the same way), and `paintEnemy` now prepends a portrait to
   the stat rows using the exact fold-out markup a build card already uses.
   Covers both the previewed-type and live-tapped cases, since both already
   routed through the same function.

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

- ~~**The renderer leaks map entries.**~~ Done, and the leak turned out to be
  the lesser half of it. `advance` now sweeps ids the board no longer answers
  for, triggered by the maps holding more entries than there are towers -- a
  comparison rather than an allocation on the ordinary frame -- and the rule
  itself is `staleKeys` in `decisions.ts`, where the renderer's other rules
  already live and can be tested without a canvas. The other half is that
  `Restart` builds a fresh world whose ids begin again at one while the
  `Renderer` survives, so an entry left from the run before is not unused
  memory but a different tower's recoil and facing, worn by whoever is placed
  first. `Renderer.reset()`, called from `onRestart`, drops the lot; the size
  check cannot see that case, since old ids and new ids can coincide exactly.
- ~~**Inspecting a regenerating Walter rebuilds the whole panel several times
  a second.**~~ Done alongside the readout fix above, which had to touch the
  same key. `hp` has moved out of `panelKey` and into the `paintStats` key,
  where `sentHome` already lived for the same reason, so a rebuild no longer
  re-measures the reserved height or destroys the upgrade card under the
  pointer six times a second.
- ~~**`rangeMult` is uncapped**~~ Done. `MAX_RANGE_MULT` is 1.5, just under
  the 1.52 that three maxed Claras reach, so it is a rail and not a change:
  `--all-builds` comes back byte-identical with the cap at 1.5 and with it
  removed entirely. Left at a number nothing can afford today on purpose --
  the point is that range multiplied and range added are the same thing at
  one Clara and very different things at six, which is what rate had to learn
  the expensive way. The tests had single-Clara coverage of both multipliers
  and stacking coverage of neither, `MAX_RATE_MULT` included; one test now
  crowds four maxed Claras onto one knitter and holds both caps.
- ~~**`Tower.capstone` is `string | null`.**~~ Done, and the #49 mismatch is
  now a compile error -- verified by writing it: `s('norah', 'bigBatch')`
  fails to build. `CapstoneIds` in `types.ts` says which two capstones each
  defender has, and `UPGRADES`, `UPGRADE_LOOK` and `builds.ts`'s slot helper
  are all checked against it, so a misspelt or misplaced id fails in the data
  itself rather than at runtime in a campaign rich enough to reach it.
  `UPGRADE_LOOK` being keyed the same way turns its "must match the sim
  exactly" header from a convention into something the compiler holds.

  Two boundaries genuinely receive an unvalidated string and both narrow by
  looking the id up rather than by asserting: the loadout grammar, which
  already threw on an unknown capstone, and a button's `data-choice`, now
  `upgradeChoiceOf` in `decisions.ts`. That second one closed a real gap
  rather than only a typing one -- the panel is rebuilt under the pointer, so
  the button clicked need not still belong to the tower being inspected.
  The runtime checks in `builds.ts` and `loadout.ts` stay: they guard
  `grow()`'s output and text a player pasted, neither of which a type reaches.

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

## From an analysis, September 2026

A whole-project pass -- code, balance, security, speed, tests and documents --
checked against measurements rather than read alone. Balance numbers are from
`npm run campaign -- --all-builds` and `npm run sim -- --all-waves` at 20 runs
on commit 7e2e7a3. The two things worth fixing straight away are in PR #85,
which left every campaign result byte-identical; the rest is here.

### Fixed in #85

- ~~**`npm run sim` put upgrades on the wrong towers for any board saved with
  `L`.**~~ Done. It placed each entry as a new tower without checking that it
  took, then bought that entry's upgrades on whichever tower had been built
  last. A saved board writes a cell once per purchase, so 5 of `corner`'s 13
  towers, 3 of `binoculars`' 10 and 4 of `wall`'s 15 ended with the wrong
  upgrades, and nothing said so. Both harnesses now call `applyPlacement` in
  `src/sim/loadout.ts`. `npm run campaign` was never affected.
- ~~**`effectiveDef` spent 37% of a campaign's CPU building its cache key.**~~
  Done. The key is now a slot number instead of a string built on every call,
  and `tests/balance.test.ts` went from 32.4s to 21.1s. The fold is
  deliberately not stored on the tower: tests write the upgrade fields
  directly, and a stored fold would go stale.

### Balance questions

1. **Coffee Clara is in every board that clears.** She is in 10 of the 11
   boards. The one without her, `swarm` (only Norahs), clears 0%. All five
   boards that clear at least half the time -- `bowling`, `mixed`, `corner`,
   `binoculars` and `wall` -- include her, and `support`, the board built
   around her, has cleared 0% since her buff was lowered. That drop was
   accepted at the time (see the comment on the clearing-count assertion in
   `tests/balance.test.ts`); what it leaves is that "towers that make their
   neighbours better" now measures as something every board must have, not
   as a way to win. Whether she is truly required is unmeasured, because no
   mixed board without Clara has been run. The measurement to take is `mixed`
   and `corner` with their Claras removed. (`wall` without its Claras dies at
   round 20 -- see "What `wall` showed" above.)
2. **Three defenders have almost no measured boards.** No played board uses
   Hose Harold or Bowling Betty, and none has more than one Protest Pete.
   Harold's only board, `slip`, clears 5%. Betty's only board, `bowling`,
   clears 100%, so she at least has a winning shape. "Several viable builds"
   is so far shown with Norah, Bill, Barbara and Clara in different amounts. A
   board played around Harold and saved with `L` would answer it.
3. **Pizza Paul has no quiet first round.** DESIGN.md ("Composition is the
   difficulty dial") says each troublemaker first arrives in a round of its
   own. Paul first appears in round 13, next to 13 Mikes and 6 Bens, and the
   comment in `waves.ts` calls him "added pressure". A small data test -- each
   troublemaker's first round holds few others -- would keep the rule.
4. **`npm run sim -- --all-waves` says nothing after round 12.** Its default
   board is four towers with no upgrades. It wins rounds 1-11, wins round 12
   45% of the time, and loses every round from 13 to 17 and from 19 to 21.
   Round 18 it wins, losing 8 points -- possibly a dip in the curve, though
   `campaign` shows no losses gathering there. A stronger default, such as a
   played board with its repeated cells collapsed, would make the back half
   readable.
5. **Generated boards that clear still take nothing until the end.** `bowling`
   first loses points at round 19 and `mixed` at round 20, while the played
   boards first lose at rounds 9-12. This is #2 above, still true.

Where the boards stood (20 runs each):

| Board | Clears | Average round reached | First points lost | Points left on a clear |
|---|---|---|---|---|
| swarm | 0% | 16.0 | 15 | -- |
| slip | 5% | 19.1 | 9 | 15.0 |
| bowling | 100% | 21 | 19 | 14.3 |
| sniper | 35% | 19.7 | 14 | 6.0 |
| area | 0% | 17.9 | 9 | -- |
| control | 0% | 19.1 | 12 | -- |
| support | 0% | 19.1 | 9 | -- |
| mixed | 100% | 21 | 20 | 9.8 |
| corner | 100% | 21 | 12 | 14.8 |
| binoculars | 100% | 21 | 12 | 12.8 |
| wall | 100% | 21 | 9 | 16.1 |

In free play (`--endless`, 10 runs) the boards that clear go on for 1.6
(`bowling`), 3.4 (`binoculars`), 3.7 (`corner`), 4.0 (`mixed`) and 7.0
(`wall`) rounds past 21.

### Code

- **`tests/architecture.test.ts` has blind spots.** Its import check matches
  only `from '...'`, so `import('../render/x')` and `import '../render/x'`
  would pass. It reads `src/sim/` without its subfolders, so a future
  `src/sim/something/` would go unchecked. Nothing checks that
  `src/render/decisions.ts` stays free of the DOM, which it is today. Every
  rule in CLAUDE.md was checked by hand in this pass and holds.
- **Unused code.** Nothing imports `src/sim/stats.ts`. `BUILD_NAMES`,
  `effectiveCooldown`, `TURN_RATE`, `laneCoverage`, `distanceToPath` and
  `isOnBoard` are exported but used only inside their own files.
- **`builds.ts` keeps display text in `src/sim/`.** Its `blurb` strings break
  CLAUDE.md's rule of no blurbs in the simulation. Only the harness reads
  them, so either the rule gets a stated exception or the strings move.
- **A Walter knocked down and rebuilt records as one Walter.** The saved board
  then has his cell twice, and a harness reads the second entry as the Walter
  already standing there, so it neither pays for the rebuild nor makes it.
  `recordingOf` only warns about towers that were sold. No played board is
  affected: `wall`'s three Walters were never rebuilt.

### Security

A whole-tree review found nothing exploitable. Loadout parsing is a strict
pattern with a list of known ids, the page only ever puts built-in text into
its HTML and ships `script-src 'self'`, the workflows have minimal permissions
and no `pull_request_target`, and `npm audit` reports nothing. Two things to
harden, neither a vulnerability:

- GitHub Actions are pinned by version tag rather than by commit SHA.
- `.claude/settings.json` asks before `Bash(git push:*)`, but that is a prefix
  match -- `git -C . push` or `gh api` would not ask. The approval rule for
  pushing rests on habit more than the settings suggest.

### Speed

After #85 nothing stands out. The biggest shares of a campaign run are `step`
(19%), `advanceAim` (9%), `effectiveDef` (8%) and `advanceAuras` (6%). The
drawing loop already reuses the painted floor and does its ageing outside
`draw`. The built site is 936 KB, mostly PNGs (the cinnamon roll alone is
122 KB); the JavaScript is 64 KB, or 22 KB compressed. Converting the images
to WebP would help a little.

### Tests

- **The balance test holds less than DESIGN.md promises.** DESIGN.md's
  balance section says at least three boards clear; `tests/balance.test.ts`
  asks for two, lowered when Clara's buff was. Five clear today, so nothing
  fails, but the promise itself is unguarded. Either the test goes back to
  three or the document says two.
- `src/headless.ts` is still not imported by any test. Its placement now runs
  through the tested `applyPlacement`; what is left is printing.

### Documentation

- CLAUDE.md's commands list says `--all-builds` plays "all seven boards";
  there are eleven.
- CLAUDE.md never mentions this file, though it holds the live balance
  findings and DESIGN.md points here. Its "Where things live" table also
  leaves out `src/main.ts`, `src/render/ui.ts`, `src/render/clock.ts`,
  `src/render/sprites.ts` and `src/sim/rng.ts`.
- The `window.street` comment in `src/main.ts` still suggests
  `--loadout "<the string>"`, which CLAUDE.md warns against for shared boards.
- `.claude/hooks/check-after-edit.sh` says "twenty-round campaigns"; there are
  twenty-one rounds.
- `tests/architecture.test.ts` mentions a BALANCE.md that does not exist.
- Board numbers in DESIGN.md and in #2 above are snapshots from different
  dates, and some no longer match: #2 has `wall` ending on 17.3 points, and it
  now ends on 16.1. Nothing in the text marks them as snapshots.

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
