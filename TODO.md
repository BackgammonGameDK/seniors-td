# Follow-up work

Not yet scheduled. Notes to self so these aren't lost.

## Upgrade panel UX (from playtesting the tower-upgrades feature)

1. **Preview range on hover.** Hovering an upgrade card that changes range
   (e.g. Norah's "Longer Thread") should show that larger range circle on
   the board for the selected tower, the same way the current range circle
   already shows on inspect -- so the player can see what they'd be buying
   before buying it.
2. **Tapping an illegal cell should drop the armed tower.** Right now,
   arming a tower to place and then tapping somewhere it can't go leaves it
   armed. It should unselect instead, matching the existing "tap the card
   again to change your mind" behaviour.
3. **Upgrades should be visible immediately on selecting a tower**, without
   scrolling past "The neighbours" build list first. Consider swapping "The
   neighbours" out for the upgrade panel while a placed tower is selected,
   rather than showing both build cards and upgrades at once.
4. **Start/pause/speed controls need a home that doesn't require
   scrolling.** They currently sit below the fold on a normal viewport.
