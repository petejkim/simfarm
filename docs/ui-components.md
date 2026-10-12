# Shared window chrome components

Status: **in progress.** Done so far:
- Step 1: shared chrome extracted from the toolbar and palette.
- Step 2: `GameWindow framed` with the imported wood 9-slice.
- Rebuilt windows: Examine, Buy, Sell, Bank, Map, Schedule, Balance, Evaluation, Weather, Market, Aircraft, Expert, About, message popups (shared `MessageDialog`), Town choice.

Remaining windows follow one commit each.

**Layout rule (user, 2026-10-12):** use flexbox and avoid absolute positioning as much as possible. Pixel-perfect placement is not required: boxes may grow to fit their text, and items that overlapped in the original may sit side by side.

**Frame implementation notes (2026-10-12).** The wooden sides are not uniform: their grain repeats every 8 rows in every window. `window-frame.png` therefore takes the first 8-row period below Sell's title bar. CSS `border-image-repeat: repeat` centres its tiles, so a window's grain phase may differ from its source by a few pixels. The importer test checks periodicity rather than fixed rows. Bottom corners match exactly for Sell, Market and Evaluation, and within 6 of 128 pixels elsewhere. Examine (9-row bottom) and Sell/Bank/Examine (a grey130 line just inside the left frame) differ by 1px under the common frame; accepted per decision 3. This document records the agreed design for reusable UI chrome. The toolbar (`ControlBar`), Edit palette and every reconstructed window will share it. Implement it incrementally, following the migration order below.

## Decisions (user, 2026-10-11)

1. **Bevels are CSS borders only.** Sunken insets and raised buttons use plain CSS `border` colours and widths. No bevel uses images or `border-image`. Pixel details that CSS borders cannot express are accepted native differences (see the corner note under *Raised button*).
2. **The wooden window frame uses `border-image`.** It is a 9-slice of original frame pixels produced by the importer, so the wood grain and mitred corners stay source-exact at any window size.
3. **Weather uses the common frame.** Its source frame is 1px narrower than every other window's; natively it gets the same frame as the others. This is a deliberate native difference.
4. **No pixel-diff browser tests** (earlier user direction). Verify components structurally: geometry, computed borders and colours, sprite offsets, no absolute positioning in layout, real text. Importer unit tests may still compare source bytes and pixels.

## Palette tokens

Define once on `.game-desktop`; components use these instead of their own copies. `.original-control-bar` and `.edit-palette` currently repeat them, which should be removed during extraction.

| Token | Source palette | RGB | Role |
| --- | --- | --- | --- |
| `--ink` | 0 | 0,0,0 | button frames, text |
| `--bevel-light` | 15 | 255,255,255 | raised top/left, sunken bottom/right |
| `--face` | 12 | 194,194,194 | faces and panels |
| `--bevel-shadow` | 13 | 130,130,130 | raised bottom/right, sunken top/left |
| `--lettering` | 14 | 65,65,65 | source button lettering (with 1px white right-hand shadow) |

## Measured source structures

Coordinates are bitmap-local pixels from imported window artwork (`public/assets/*-window.png`, `bank-terminal.png`, `message-button.png`).

### Wooden frame

| Edge | Source pixels | Width |
| --- | --- | --- |
| Left | `#o.ooooD` (black, wood, light grain, wood ×4, dark inner line) | 8px |
| Right | `Do.oooD#` | 8px |
| Bottom | Dark inner line, five wood rows with a diagonal mitre into each side, dark line, black line | 8 rows |
| Top | None in the client: the shared 16px `GameWindow` title bar (`window-title*.png`) supplies it | 0 |

Edges are uniform along their length; only the two bottom corners carry the mitre. Verified identical:
- **Left edge:** Examine, Bank, Sell, Buy, Market, Balance and Schedule.
- **Right edge and bottom corners:** Sell, Market and Examine.
- **Bottom edge:** Sell, Bank and Market.

Weather's left edge is `#o.oood`, 1px narrower; per decision 3 it is not reproduced.

**Implementation:**
- **Slice source:** the importer writes an ignored `window-frame.png` 9-slice (8px slices plus a repeatable middle) cut from `sell-window.png` (`sell.bmp`). Sell has no client content touching its frame.
- **Importer test:** a unit test checks the slices against the other windows' edges, so a mismatch fails import rather than drifting silently.
- **Applying it:** `GameWindow`'s body uses `border-style: solid; border-width: 0 8px 8px; border-image: var(--window-frame) 0 8 8 repeat`. There is no `fill` keyword, so the client background stays `--face` or the window's own art.
- **Window bitmaps:** once framed this way, window bitmaps no longer supply frame pixels; they keep only unique artwork.

### Sunken inset

A 2px border: `--bevel-shadow` top/left, `--bevel-light` bottom/right. Examples: the toolbar forecast and Date/Funds boxes, Examine's photo and text boxes, and Buy's catalog, description, quantity and price boxes.

### Raised button

One bevel style covers every raised button. Picture buttons: toolbar launchers, Edit palette tools, Buy's category and arrow buttons. Captioned buttons: `buttons.til` captions OK/Buy/Sell/Cancel…, message-dialog OK/YES/NO, and Buy, Aircraft, Map and Schedule caption buttons.
- **Frame:** a 1px `--ink` frame, drawn as the button's own background behind padding. This avoids sub-pixel gaps at fractional zoom (earlier user correction).
- **Face:** a 2px border, `--bevel-light` top/left and `--bevel-shadow` bottom/right, around the face. The face holds a picture sprite or real HTML caption text.
- **Frame-side options:** frame on all four sides (toolbar, Buy), or top/left only (palette cells share their neighbour's black).
- **Drop shadow:** Buy's category buttons add a 1px `--bevel-shadow` drop shadow right and below, as an optional modifier (a shadow, not a bevel).

Where the light and shadow edges meet at a corner, the source paints the two diagonal pixels in face grey. CSS draws a diagonal blend of the two colours instead, which looks close (accepted).

**Correction (2026-10-11):** an earlier draft described a separate caption variant with 1px side bevels and corner pixels. That came from damaged imported images: the importer's caption erasure masks for `message-button.png` and Buy overlapped the inner bevel column. Original `buttons.til` records and window bitmaps use the same uniform 2px bevel. The masks are now fixed (see progress.md). For captions, erase the source lettering inside the face only; HTML text replaces it.

### Shared button behaviour

- **Pressed state:** an active or pressed state swaps the bevel colours. Momentary: `:active`. Persistent: `aria-pressed="true"` / `.is-pressed`, while a window is open or a tool runs (existing toolbar and palette behaviour).
- **Focus:** `focus-visible` uses a 2px blue outline inset inside the face.
- **Disabled:** keeps the bevel; icon faces get a translucent grey overlay (existing palette behaviour).

## Components (planned location `src/ui/chrome/`)

| Component | Responsibility |
| --- | --- |
| `WindowFrame` | Wooden `border-image` frame around a `GameWindow` body, under the existing shared title bar. |
| `SunkenInset` | Sunken bevel box; size from layout or modifier class. Replaces `ToolbarInset`. |
| `BevelButton` | Picture (sprite) or caption (HTML text) face, `pressed`, `frame: 'all' \| 'top-left'`, optional `shadow`. Replaces `WindowLauncher`'s and `EditToolButton`'s duplicated markup and CSS. |
| `Sprite` | A `div` showing one atlas frame via `background-position`, with `image-rendering: pixelated`. |
| `RaisedPanel` | Non-interactive raised panel with the `BevelButton` structure (ink frame, 2px raised bevel, optional shadow), e.g. About's credits panel. |

**Sprite atlases** (all plain images, so CSS sprites work):
- `control-bar.png` and `edit-palette.png` faces.
- `buy-cards.png` photos.
- The per-farm generated tile atlas, passed as `data.tiles.src`. It is the untinted atlas, with crop graphics patched in; weather-tinted variants are only for the map.
- `masked-tiles.png`.

Windows compose these with flex/grid layouts whose spacing derives from source coordinates; text is a child of its inset so it cannot overlap bevels (the Examine overlap fixed in `9a9df95`). Simulation state and commands are unaffected; components only render existing view models.

## Migration order

1. **Extract** `SunkenInset`, `BevelButton`, `Sprite` and the tokens from `ControlBar` and `EditPalette`, with no visual change.
2. **Add** `WindowFrame` to `GameWindow`, plus the importer slice and its equality test. Rebuild **Examine** as the first window, removing its canvas, as described in the design discussion recorded in progress.md.
3. **Convert** the remaining windows one at a time (Buy, Sell, Bank keypad, Map, Schedule, Balance, Evaluation, Weather, Market, Aircraft, message dialogs). For each window:
   - stop baking controls into its imported bitmap;
   - keep unique art (e.g. Bank's terminal bezel, Weather scenes, chart grids) as background sprites;
   - keep that window's source-evidence tests.

Record each step's measurements, accepted differences and validation in progress.md, and in the window's own doc.
