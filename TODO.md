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
