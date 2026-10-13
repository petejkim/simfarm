# Debug events

The user requested a Debug menu for non-disaster events. This is a native debugging addition, not a claim about an original DOS menu. It appears immediately after Disasters and uses the existing HTML menu focus, hover and Escape behavior. Original menu decoding/artwork and Disasters entries are unchanged.

- **Start rodeo**: requires a recreation district, no active event and at least$1,000 (the original invitation gate; accepting costs$500).
- **Start fair (carnival)**: requires a recreation district and no active event. Uses the original fair announcement if there are no eligible farm animals or insufficient entry cash; otherwise accepting costs$200.
- **Advance event week**: advances only the current event countdown. Rodeo lasts two event weeks and fair three; participation produces the original randomized result dialog and award/cleanup. Farm date, weekly field orders, weather and taxes do not advance.

Start invokes the recovered calendar event entry (`beginTownCalendarEvent`, sourcec9b0..cbb3) with its original event selector dates, while retaining the actual farm calendar. It bypasses the calendar and Messages option deliberately; it does not grant money, add animals or construct recreation land. Other prerequisites, source map changesd9b2..db51, fees, RNG and music remain canonical. Manual countdown uses the same dbe4..dd3d implementation as weekly play; choices use `resolveTownEventDialog`. Existing natural calendar triggers still run normally. Actions are disabled during other modal decisions or flight; an active event cannot be replaced. Disabled controls explain their requirements in tooltips.

New checkpoint version28 adds a `debug` town-event continuation phase. Its saved date must equal the current date, its modal owns pause, and its day-tick counter is retained. Resolution restores the saved run/pause state without calling weekly rollover or the interrupted simulation tick tail. This prevents debug acknowledgement from changing unrelated farming rules. Both entry and result save/load preserve RNG, fees and awards exactly once. Versions1..27 continue to load. Gzip transport remains unchanged.

## Start town expansion (2026-10-12, user request)

**Start town expansion** opens the original town development choice at any date, provided `findTownExpansionSite` finds a free site. The item is disabled otherwise, and during other modal decisions or flight. It deliberately bypasses the original year-end gates:
- **Tax offer:** the year-end tax settlement's expansion offer is not required.
- **Town fund:** the $15,000 expansion fund is neither required nor deducted.

The trigger reserves nothing. Choosing a district reserves the site as the original does (owner flag 2 and `activeSite`; 0x3c03f/0x3c04a) and builds through the unchanged `resolveTownChoice`. It then restores the previous run/pause state without any year-end phases (annual reset, week/day rollover); the farm date and day count are unchanged. A failed choice, e.g. at the recreation limit, keeps the window open and restores the site exactly.

**Saves:** the debug choice is never written to saves (user decision). While it is open, a save records the farm as if the window were closed, so no save-format change was needed and every existing save loads unchanged. A reload simply drops an open debug choice. The original year-end choice is saved as before.

Validation: unit debug-events 5/5 plus live-annual, game, native-save, live-town-event-calendar and town-construction (43 tests); browser debug-menu and town-choice specs pass (7/7).

## Grow town districts (2026-10-12, user request)

**Why:** weekly growth (`developTown`, 0x3b162) only raises `activeSite`, the most recently chosen district, and never revisits an earlier one. Several **Start town expansion** choices in a row therefore leave every district but the last at level 0 (roads, no buildings) permanently. A user save from 2036 showed exactly this: (4,1), (4,2) and (5,2) were owned at level 0 while revenue was $234,624. This is original behavior, not a defect; the debug trigger only makes it reachable within one year.

**What it does:** each use applies the original level step `changeTownLevel(…, +1)` (0x3b3ac, repaint 0x3b4ce) once to every owned district (flag 2) below level 13, scanned x-first. `growableTownSites` excludes level 13+ (0x3b3ac refuses), raw byte 5 (returned untouched) and type 15. Houses appear from level 1, as in normal weekly growth, and the visual RNG is consumed by the repaint as usual. It does not spend town revenue or change `developmentSpent`, does not move `activeSite`, and does not advance the date. The item is disabled when no district can grow, and with the rest of the Debug menu during modal decisions or flight. Nothing new is saved: the result is ordinary town state, so the save format is unchanged.

Validation: unit debug-events 6/6 (two stuck debug districts reach level 13 with buildings; revenue, date and activeSite unchanged; no-op once complete), town-development, live-annual and game (29); browser debug-menu and town-choice specs 7/7; production build. The user save's four unfinished districts reach level 13 after 13 uses.


## Create crop circles

The Debug menu's sixth item, "Create crop circles", dispatches the existing `start-disaster` command with kind `crop-circles`. That runs the original mode-7 start `0x3672c`. In the original it is reachable only through Shift+A while the `eeadebug` flag is set (`0xf6b5`; see disaster-trigger-audit.md), so the Debug menu is its natural native home.

Behaviour is the original's, not a forced success:
- Disasters must be enabled.
- One random active field is chosen through `0x1b802`. If its crop is not wheat, barley, oats or sorghum (crop byte 62 bit 02), nothing happens and there is no retry.
- On success the field takes 10 loss, the seven circle tiles are painted, `alien` MIDI plays, and the mandatory "CLOSE ENCOUNTER" message appears.

The item is disabled when disasters are disabled, when circles are already active (flag 0x40), or when the farm has no active fields. Its tooltip explains the random crop condition. The browser spec now starts circles from this item, rather than constructing an active checkpoint outside the browser, and verifies the message, tiles, saved state and the disabled repeat.

## Show toxic-land warning

The seventh Debug item, "Show toxic-land warning", dispatches `start-disaster` with kind `toxic-land`. That runs original mode 8 at `0x36836`, which the original executable never reaches (SF-179; see disaster-trigger-audit.md).

It sets persistent flag 0x80 of the disaster flags and shows the mandatory message 51. It has no damage, fine, price or sound effect. Nothing clears the flag, so the item works once per farm. It is disabled afterwards, and also while disasters are disabled.

The browser spec starts the warning from this item, checks the message, compares the saved state with the simulation's, and checks that the item is then disabled.
