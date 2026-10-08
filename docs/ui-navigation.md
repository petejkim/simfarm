# Native control navigation

The browser navigation is a native usability enhancement, not a reconstruction of the DOS menu/window layout. It changes no game rules or persistent simulation state. Source-backed land, field-plan and loan operations still run through the existing canonical commands; see [land and field reconstruction](reverse-engineering.md), [field calendar](field-calendar.md), [finances](finances.md) and their tests. No new original-game defect is claimed by this UI work.

## Routes

**Farm controls**, directly below the time controls, exposes six shortcuts:

- **Crop planner** opens the planner and focuses its summary. **Plan for field** selects the same field used by map inspection and Locate a field. The planner remains discoverable before any field is selected. An empty farm offers **Create a field**. Switching fields/year resets the editor as before; closing and reopening a panel preserves its current choices.
- **Buy land** selects the original land tool and focuses its quote panel. **Choose on map** scrolls to and focuses the viewport; after selecting a tile, **Review plot** returns to the quote. Buying is still a separate explicit command.
- **New field** selects field placement and focuses its panel. The same map round trip uses **Review field**. Existing land selection and crop-selection behavior are preserved; the shortcut itself cannot buy, clear or plant.
- **Seeds & chemicals** opens the supply shop and focuses its heading. The delivery chooser selects compatible storage; **Choose on map / Review supplies** makes a focused round trip. **Build storage** opens construction with equipment storage selected. Navigation does not purchase anything. See [manual supplies](crop-supply-purchase.md).
- **Roads & fences** opens the construction panel and focuses its heading. **Choose on map / Review construction** returns between the map and quote; construction and gate operation require their explicit action buttons. See [network placement](network-placement.md).
- **Loans** opens and focuses the existing loan panel. Borrowing and repayment still require their own buttons and original eligibility checks.

Existing map-tool and disclosure routes remain usable. During town/default/flight restrictions, placement/planner shortcuts are disabled; Loans remains available for inspection with its mutation controls disabled. Loading or replacing a farm resets all navigation state.

## Ownership and verification

FarmView owns disclosure/navigation state in React. A post-render layout effect scrolls/focuses element refs; it neither dispatches simulation commands nor draws game content. FieldPlanner splits its chooser/disclosure from the existing per-field editor. The map viewport ref is shared with FarmView solely for navigation; rendering remains in src/render and simulation ownership remains in GameSimulation. No native-save version change is required.

Browser tests use actual buttons and keyboard input to verify that shortcuts open, focus and bring their targets into view, synchronize field selection, reopen manually closed disclosures, and reset on load/scenario changes. Full checkpoint equality before/after navigation confirms no canonical mutation. The390px flow buys original plot0,16 for18060, creates/plants field9, edits its plan and borrows1000 through the shortcut routes. The empty-farm case offers creation rather than an absent planner. Desktop/mobile screenshots are generated under ignored artifacts. Existing planner/land/loan, modal and flight regressions remain part of the full browser gate.


**New farm** sits above the original scenario selector and opens custom climate, water and year controls, plus the original region map. **Restart current session** is the default and calls the retained generated/loaded setup operations. **Start fresh session** resets history and enables a reproducible map seed. Older saves without terrain history explain why custom retained generation is unavailable, with numbered regions and fresh creation still accessible. Both farm origins use **Choose another farm** after financial default; cancellation keeps the ended farm available for saving/loading.

Creation replaces the session only after original assets and canonical state validate. Generated views center on the homestead and use the same Farm controls for fields, construction, loans and planning. The setup component now lives alongside the current simulation in FarmView; its form, focus, request cancellation and error state belong to React, while all reset/load/generation rules and state remain in GameSimulation. Opening or cancelling the chooser never resets the farm. A running old session continues during asset loading; replacement starts paused after reading the latest available simulation state. See new-farm.md, original-load-startup.md and native-save.md for source phases, v19 continuation and remaining original preview/menu timing limits.


## Original terrain design

Open **New farm**, choose the session/seed/year settings and **Design your own**, then **Preview terrain**. The original terrain-design panel now displays the map, with H for home and T for town. Adjust the climate bars using the arrow buttons or keyboard; River and Lake are toggle buttons. **Generate World** applies rainfall/water settings and chooses another landscape/sites without reseeding. **Play** accepts the displayed map. Changing settings alone does not regenerate it. **Cancel** leaves the previous farm intact. The panel scales to phone widths; sliders also accept Home/End and arrow keys, and buttons accept Enter/Space. Geographic region selections still use their separate chooser paths. This is the first live restored setup screen, not a claim that all original UI is complete.
