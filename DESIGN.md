# Why the game is shaped this way

This is the reasoning behind Seniors vs Troublemakers. `CLAUDE.md` says what
the rules are; this file says why they were chosen, and what the previous
project taught that led to them.

Numbers are not repeated here. Damage, range and cost live in
`src/sim/towers.ts`, enemy statistics in `src/sim/enemies.ts`, and the
twenty-one rounds in `src/sim/waves.ts`. A number copied into prose goes stale the first
time it is tuned, and a stale number is worse than no number, because someone
will believe it.

## There is no counter table

The previous project was built on one. Every attack had an element, every enemy
had a state, and a twenty-cell table decided both how much damage the pair did
and how strong the lingering effect was. It worked, in the sense that it was
fair and could be won on every seed. It was still wrong, for two reasons.

The first is that it collapsed the game into lookup. Once a player knew the
table, a round with a particular enemy in it had a particular answer, and
building the board was recall rather than judgement.

The second is that it left exactly one build worth making. The table decided
which tower was best against what was coming, so the strongest board was
simply the board that answered the schedule. Being balanced turned out to be
necessary and not sufficient: **the standard this game is judged by is whether
more than one build works**, not whether it can be won.

So there is no element chart here, no type matchups, and no
rock-paper-scissors. Proposing one is re-opening a decision that has already
been made and paid for.

## What tells two defenders apart instead

The classic axes of the genre, which are all shape rather than matchup:

- **Range** — how much of the street a defender can reach at all.
- **Rate** — how often it acts.
- **Damage per hit** — and, crucially, whether that arrives as many small hits
  or few large ones, which armour then makes a real difference (see below).
- **Single target or area** — whether a hit lands on one troublemaker or on
  everyone standing near them, which pays for itself only when a crowd exists.
- **Support** — defenders that never attack, and instead make their neighbours
  faster or hold the street still so the neighbours get more shots.

Knitting Norah is cheap, short-sighted and constant. Binocular Bill is
expensive, slow and sees a long way down the street. Baking Barbara is weak per hit and
lands across a crowd, so she is paid for density and wasted on a lone target.
None of them is *for* a particular troublemaker.

## Two of the six defenders never deal damage

Protest Pete buys time and Coffee Clara buys rate, and both are worth their
cost only in the company of defenders that actually do damage. This is
deliberate, and it is what stops support from being a free purchase: a board of
nothing but support loses, because nothing on it kills anything. The player
therefore has to decide how much of their money goes into the attack and how
much into multiplying it, which is a real decision rather than a strictly
better one.

Walker Walter is the third defender that never attacks. He stands *in* the
road and is attacked instead, which turns a stretch of street into time.

## Armour and shields are arithmetic, not a lookup

Armour subtracts a flat amount from every hit that lands. That means the same
total damage delivered as six small hits loses six subtractions, while
delivered as one large hit it loses one. A fast, cheap, light-hitting board
therefore genuinely struggles against an armoured troublemaker, and a slow
heavy-hitting board does not — without any table saying so anywhere.

Boombox Ben does the same job from the other side: he grants a flat absorption
to the troublemakers *around* him, which blunts many light hits far more than
it blunts a few heavy ones.

Skateboard Skye applies the same arithmetic to the *effect* rather than to the
damage. A slow is only ever worth the extra seconds it buys a defender to keep
shooting, so she ignores three quarters of any slow and crosses the street too
quickly to be worn down. A board that leans on glaze to buy time finds it has
bought a quarter of what it paid for; a board that simply hits hard barely
notices her. Measured on round 11, an all-Barbara board loses 16 of its 20
points to her round while a Norah-and-Bill board loses 3.

She resists a slow rather than being immune to one, and stun and a blockade
both still stop her dead, so the answer to her is never a single defender.

All three are stats on an enemy rather than a cell in a chart, so no defender is
ever the designated answer to one troublemaker. The difference is that a player
can work out what to do from what they see happening, rather than by learning a
table.

**Ben never shields himself.** A shield carrier that did would be nearly
unkillable by exactly the light, fast defenders he exists to punish. The
intended reading is "shoot the carrier and the rest get easier", and that only
works if the carrier is shootable.

Status effects land even when the damage does not, so Pete still stuns at zero
damage and Barbara's glaze still slows something armoured. An effect that was
gated behind damage would make support defenders quietly useless against
exactly the enemies they are meant to answer.

Moped Mike ignores stuns entirely. That is the one hard immunity in the game,
and it exists so that Pete cannot be the whole answer to a round.

**A repeated stun gets shorter.** Each one that lands on the same troublemaker
is 20% shorter than the last, down to a floor, and the fatigue fades again
after a short lull. This exists because Clara multiplies how *often* a tower
acts but not how *long* its stun lasts, so past a certain rate the stuns simply
overlapped and the street stopped moving: measured at 89% of the time for a
Pete with no upgrades at all and two Claras beside him, and 100% with either of
his capstones. `bullhorn` was the worst of it at 60 ticks of stun on a 60-tick
cooldown -- permanent on its own, before any coffee -- and its cooldown is now
110 so that a gap exists at all for fatigue to work with.

The recovery is deliberately quicker than the gap a lone Pete leaves between
shouts. He therefore sheds fatigue as fast as he causes it and is left exactly
as strong as he was, measured at 37% either way; it is only the hurried,
coffee-fed Pete who never gets his lull. That is the shape support is supposed
to have here -- a force multiplier with diminishing returns, not a win
condition -- and it is the same reason `MAX_RATE_MULT` exists at all.

Fatigue shortens a stun and never refuses one, so this adds no second hard
immunity: Mike's remains the only one.

## The street is the decision

The lane is a polyline with four hairpins, and that is not decoration. A corner
is where one long-range defender covers several stretches of road at once, and
where a crowd bunches up tightly enough for an area hit to be worth its price.
Placement is most of the decision in this game, so the shape of the street is
what gives placement something to decide.

Ordinary defenders must be built clear of the road. Walter must be built in it.
He is the one defender who inverts the clearance test rather than being
exempted from it, which keeps the rule single rather than special-cased.

Selling returns less than the defender cost, so a misplacement costs something
real. Without that, placement carries no risk and the hairpins stop mattering.

## Composition is the difficulty dial

A late round is not an early round with more in it. Each troublemaker arrives
in a quiet round of its own before it turns up inside a busy one, so the first
time a player meets armour, or a shield, or a defender going silent, they can
see what happened and why.

Rounds do carry a toughness multiplier, but it multiplies hit points only.
Speed and armour stay where they are, so a late round is harder without quietly
becoming a different game — a troublemaker that got faster every round would
eventually outrun the mechanics rather than test them.

The round clear bonus is the part of the income that does *not* scale with how
much walked down the street. Bounties alone would let a bigger round pay for
the defenders that beat it, which makes round size useless as a dial. The clear
bonus is therefore what actually decides how much board the player owns by the
end.

## The simulation is pure so that balance can be measured

`src/sim/` is a pure function of state, input and seed: a fixed 60Hz timestep,
one seeded random number generator, no wall clock, no DOM, and no import from
`src/render/`. `tests/architecture.test.ts` enforces this by reading the
source.

The point is not tidiness. It is that the same rounds can be played thousands
of times without a browser, which is what makes `npm run sim` possible and
what turns a claim about difficulty into a measurement instead of an opinion.
Every balance change is expected to be followed by a run of it. The rule is
also what will make the campaign and build-variety harnesses possible, and
those are what would actually prove the standard at the top of this file — that
more than one build works.

## Interface decisions live where a test can reach them

Every interface bug the previous project shipped came from logic tangled up
with the DOM in an event handler, where nothing could test it: a selected tower
that could not be deselected, a panel showing the tower clicked before this
one, and a board that read its target cell from the last `mousemove`, which
made the game completely unplayable on a phone.

So anything of the form "what should happen if the player does this" is a pure
function in `src/render/decisions.ts` with a test named after the bug it
prevents, and `src/render/ui.ts` only applies the answer. A tap's target cell
is read from the tap's own coordinates, always.

## Effects resolve once

A lingering effect is resolved at the moment the hit lands and then ticks down
as flat numbers. Nothing that advances an effect may re-enter damage
application, because an effect that re-ran its own hit would re-apply itself
and never expire.

The same instinct runs through the rest of the tick. Auras are recomputed from
nothing every tick rather than accumulated, so a buff cannot leak, double up or
outlive the defender that granted it. Anything created during a tick is queued
and flushed at the end, so an area hit can never reach the troublemakers it
just created by splitting something.

## Upgrades: two roads, then a fork

Every defender gets two upgrade paths that stay true to what already tells
defenders apart -- one path pushes the axis that makes it fast or precise
(rate, or reach), the other pushes the axis that makes it strong or lasting
(power, or control). Both paths are bought independently and neither locks out
the other; a player who wants both halves of a defender can have them. Only at
the very end, once every tier on both paths is bought, does a single expensive
final upgrade fork the defender one more time between two mutually exclusive
finishers. Taking one closes off the other for that defender.

The fork exists so a fully invested defender still asks a question instead of
just getting bigger. One finisher is always "more of what this defender
already does" -- a stat push past what either path alone could reach. The
other is a genuine change of shape: Norah's finisher choice is between hitting
harder at range and hitting up to three targets at once, which is a different
defender to build around, not a stronger version of the same one. That mirrors
the rule the whole roster already follows -- no defender should become the
designated answer to a specific troublemaker, and a finisher that only added
raw power everywhere would start to smell like one.

Two defenders needed a different reasoning path to get there. Protest Pete
never deals damage today, and neither of his finishers changes that -- an
upgrade is not licence to break a defender's founding rule, even a rule as
central as "buys time, not kills." Walker Walter's finisher fork nearly became
the ability to get back up after falling instead of just being tougher, but a
comeback that a player has to choose between is not really part of his
identity -- once decided, it changed his base kit instead: every Walter now
gets back up once per round at a fraction of his health, no upgrade required,
and his base toughness was lowered to pay for it. His two upgrade paths and
his finisher fork are built on top of that, not instead of it.

## Names

Ids are lowercase first names and display names are the full ones: `norah` is
Knitting Norah, `bill` is Binocular Bill. They must never drift apart, because
the loadout grammar the harnesses parse is built from the ids — `norah@5,4`.

The vocabulary is meant to teach rather than to be known in advance. A panel
says "slows them by 35%", not "slowFactor 0.35", and the game's two currencies
are named after what they are: Pension Coins to spend, Peace & Quiet Points to
lose.

The readout on the board goes one step further and drops the words for both
resources: a coin and a heart beside their numbers are read the same way in
every language, where "pension coins" and "peace & quiet" have to be learnt
first. The round keeps its word, since 1/21 on its own could be anything. Each
readout shows the number and then its picture, so the counts line up down the
row instead of starting at whatever width the icon before them happened to
be.

## Balance: the difficulty the game is aimed at

Measured with `npm run campaign -- --all-builds`, which plays whole twenty-one-round
runs on a real purse against the six named boards in `src/sim/builds.ts`.
`npm run sim` answers a different question -- how hard is one round with a given
board -- and cannot answer this one, because a round is only ever as hard as
what the player could afford by the time it arrived.

The curve is graded rather than flat-then-vertical:

| Rounds | What they are for |
|---|---|
| 1-8 | Teaching. Each troublemaker arrives in a quiet round of its own, and those rounds are deliberately discounted below the curve. A clumsy board keeps most of its points. |
| 9-16 | The decisions. Saving against spending, a second tower against a better one. Points start leaving. |
| 17-21 | The wall. It wants a committed, upgraded board, and it is meant to be lost sometimes. |

The three numbers worth holding on to, all enforced by `tests/balance.test.ts`:

- **More than one board finishes.** At least three of the six clear round
  twenty-one at least half the time. One build clearing is a solved game, not a balanced one.
- **Nobody finishes untouched.** A clear leaves at most about seventy per cent of
  the starting points. A board that never felt the wall was never tested by it.
- **The end is the hard part.** Every build is alive at round eleven and has lost
  ground by round twenty-one, so the difficulty is a slope and not a spike.

Two findings from the pass are worth not re-learning the hard way.

**Arrival windows matter more than hit points.** Rounds used to arrive in six to
thirteen seconds. A burst that short is indivisible: a board either out-shoots it
and takes nothing, or it does not and takes everything, which is why the old
curve was flat for thirteen rounds and then vertical. Windows now run from about
eight seconds to half a minute, and boards that are not quite enough now bleed
instead of collapsing.

**Armour is not hit points.** Damage is flat subtraction, so armour costs the
towers a share of every shot rather than costing the round a pool of health. An
armoured round is far harder than its hit-point total suggests, and any attempt
to author rounds against raw totals puts a cliff wherever the armour is.
