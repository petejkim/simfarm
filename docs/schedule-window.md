# Original Schedule window

The immutable `SIMFARM.EXE` SHA-256 is `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are hexadecimal file offsets unless explicitly qualified. This is static reconstruction, without running DOS or x86 code. Planning/execution rules were already recovered separately in [field-calendar.md](field-calendar.md); the window now sends those existing simulation commands.

## Descriptor and artwork

Initialized DS6190 starts at846f0. Descriptor DS5d8c has flags0061, x160, y80, width336 and height240 including the16-pixel title. Its title pointer names `SCHEDULE` atDS5cc2; artwork is `fdstatus.bmp` atDS5ccb. The paint thunk24e6:1172 reaches overlay3:0e68/file2dda8, which delegates to2cf40. Control thunk24e6:117c reaches overlay3:0eac/file2ddec. Overlay3 starts at2cf40. Source opening at38bf5 supplies descriptor5d8c;38c4a/38c5a store the field slot/current month in DS6130/5df7.

The client is336×224. `fdstatus.bmp` is37,640 bytes, SHA-256 `38b29a5769e673d984fd13e9ed09b9ffd2c2f059fc21812786e742fce8a9aa3f`; its bounded decoder retains every pixel outside the documented caption masks in `src/formats/schedule-window.ts`. Import generates ignored `schedule-window.png`. All captions, month/season/date/value text, weather annotations and quality letters/words are actual React text. Original resources remain unchanged. Quality artwork reuses the text-free Sell badge atlas.

The linked controls begin atDS5d76. Coordinates are relative to the complete window, so native client y subtracts16:

| ID | Function | x,y | width,height |
| --- | --- | --- | --- |
|5|Water/rain overlay|82,29|18,23|
|6|Heat/temperature overlay|236,29|18,23|
|9|Previous month|72,104|16,16|
|10|Next month|248,104|16,16|
|29|CUT|272,93|48,16|
|30|TODAY|272,77|48,16|
|31|CLOSE|272,117|48,16|

The callback toggles DS612e/612f mutually exclusively, bounds displayed month to0..57, selects action18 for CUT, resets the displayed month for TODAY and closes for31. Nodes are5d76→5d60→5d4a→5d34→5d1e→5d08→5cf2→0. Tests pin every node, source constants, executable/resource hashes and binary boundaries.

## Original controls and display

Client coordinates below are source-derived. The selected field's32×32 crop badge is at32,8; the selected tool badge is at272,8. Crop tools occupy two rows of eight16-pixel icons at104,8. Original base tile832 is initialized at2be7:090c (file4ec60+090c), used at2da20. The six16-pixel action icons at24,64, two per row, are Harvest440, Contract198, Fertilizer915, Pesticide914, Herbicide913 and Fungicide912. Their large badge indices atDS6128 are30,29,23,16,20,21. The mask/tile bases come from2be7:08f2..08f8; original bitmap/masked routing compares against848 at2d422.

Twelve weekly icons begin at72,72. A click2d08b..2d0aa computes the visible week column and calls the existing2e11a editor with field slot minus one and selected action. There is no separate Apply button. CUT selects erase while retaining the preceding large tool badge (2dcea..2dd35); the native view preserves that display behavior. Month labels appear at96+64*i,50. The source month scrollbar occupies88,88 through248,104, using track tile9 and thumb194 at `88+floor(month/6)*16`. The native range supports every month0..57 with mouse or keyboard, preserving the source thumb artwork while replacing its coarse mouse quantization. Current-week lines use palette1 at week x+6..8, y72..87.

Water mode displays signed climate precipitation bytes fromDS4186, temperature mode usesDS4278. These are absolute plan weeks (0..239), not newly generated weather or an invented forecast. Top crop hints at2da6f/2d99f use definition word40 shifted right1, or word30 divided by7 plus50. Native text follows the source alternating y offsets. Per-week dates/descriptions appear in the supplemental footer and accessible button names; merely focusing a week does not edit it. Activation applies the selected tool through `edit-field-plan`, preserving future-only edits, contract/current-week checks, fixed annual harvest guards, protected treatment weeks and canonical feedback.

Source display2d2b2..2d97a supplies current value through1c092, maturity through1c1aa, and quality through1c24e. Native projection delegates to those already reconstructed helpers. Value appears at120,132; quality at272,128. The maturity strip is80×8 at104,147: helpera0c8 fills palette6 progress and palette12 remainder. Its quantization is `(maturity>>>12)*5`, max75 rather than80; SF-160 records this unchanged display quirk.

`fldgrph.til` is11,520 bytes, SHA-256 `f4f1e37a9465679781786d85d3b2d34b0e3e97757fb0c12bb53eef06a77a5fe6`. Loader4a196..4a200 sign-extends the supplied index byte, seeks index×0240 and reads576 bytes. Each frame is48×24 planar pixels; all20 frames decode into ignored960×24 `field-gauges.png`. Source field paint uses:

| Gauge | Client position | Frame selection |
| --- | --- | --- |
|Disease|24,176|field byte22 /52, integer quotient|
|Pests|80,176|field byte20 /52|
|Weeds|136,176|field byte21 /52|
|Water|216,176|5 + band0,1,2 or4|
|Soil|272,176|10 + field byte29 /52|

Source soil paint first calls1c50a, copying byte29 to cached byte28, then reads28. The native read-only projection reads29 directly; opening/browsing a window does not mutate a farm checkpoint. Water low is `max(0,signedByte(crop[40]-2*field[51]))`; high is sign-extended `crop[42]+2*field[52]`, compared as an unsigned word. Midpoint uses wrapped unsigned-word subtraction/right shift. Bands are below low, below midpoint, below high, and at/above high. No band3 assignment exists (SF-159). Native preserves the signed/wrapped arithmetic; tests exercise thresholds and synthetic signed-byte boundaries.

The season string uses the current calendar week, even when scrolling future years. Source constantsDS406e..4072 are45,10,23,34,45: Winter before10/from45, Spring10..23, Summer24..34, Fall35..44. These label boundaries intentionally remain distinct from the simulation's season routines. Label year is current year plus displayed month/12, word-wrapped. This is verified display behavior, not a new simulation calendar rule.

## Native adaptations and remaining work

All24 crops remain available by user direction. Two pages reuse the original16-icon grid; small previous/next controls occupy the unused gap between Temperature and Tool. Extended crop IDs use the existing native terrain atlas, never the masked atlas. A compact footer adds field selection, readable hovered/focused week descriptions, tool hints and command feedback; its height is additional to the source240-pixel window. Empty farms offer the existing Create a field action. Browsing retains the displayed month/tool when reopening; selecting another field resets the editor to that field/current month. These are explicit native usability choices, not claims of identical DOS event ordering.

View object now opens Schedule when an active field is clicked. The Crop planner shortcut also reaches it. Plant now opens the original crop popup for a new field, and Spray opens the treatment popup; see [field-tools.md](field-tools.md). Immediate existing-field replant and harvest still use **? → Field orders** while original object interactions are reconstructed. The Schedule increment does not claim completion of every Edit tool, window stacking, sound callback, or the whole game port. Window movement/titlebars, fixed maximized Edit,1× artwork, all24 crops and slower native pacing remain intact; no mobile rearrangement or save-schema change.

Validation includes all source caption/non-caption pixels, every gauge frame, truncated assets, all eight original farms, all24 crop hints, exact unchanged checkpoints, signed water boundaries, quality bands, maturity maximum and source season labels. Browser flows exercise actual tools/week clicks, five-year end limits, weather toggles, field-map inspection, all24 crops, fixed/perennial harvest rejection, contracts, treatment protection, plan execution and exact save/load continuation. The original farming rules continue to live in the plain TypeScript simulation; React only owns window selection/drafts. Full validation results are recorded in [progress.md](progress.md).

## View object re-entry

Field-entry audit38b4a..38c6c confirms lookup38b9b calls1b928; nonzero field selection reaches descriptor5d8c/create at38bf2..38bfd. Instructions38c43..38c4a copy the field slot toDS6130;38c52..38c5a copy current calendar monthDS1256 to displayed monthDS5df7. TODAY2df0a..2df0e performs the same month assignment. Confidence high on these direct instructions. No immediate replant/harvest operation is present in this field branch: original field planning remains through Schedule.

Native View object now requests that month reset on every field click, including reopening the same field after browsing future years. Previously the editor key changed only for a different field/year, so a same-field reopen left the future month visible. This is a corrected native presentation defect, not an original-game defect. The request lives in React and cannot edit farm state. Merely raising Schedule through the native planner shortcut preserves browsing. Selected tool, overlay and movable frame position remain intact on same-field re-entry; this is the existing browser presentation policy, not a claim that the complete original create/destroy lifecycle is reconstructed. A newly mounted editor uses the current month rather than a stale prior inspection request.

Focused tests pin the original field/month writes and exercise re-entry from month57, retained tool/overlay, subsequent browsing and exact unchanged checkpoints, alongside the existing Schedule and Plant/Spray cases.

The fixed-harvest rejection now opens its original mandatory Message (portrait74, DS6142) while preserving the existing plan. See [field-messages.md](field-messages.md). Messages off does not suppress this source branch; other validation feedback remains as previously implemented.

Input audit follow-up: event5 at2cfb6 enters crop/week hit testing; crop selection2d002..2d02f only stores the selected action inDS6132. Week activation2d08b..2d0aa derives the visible column, pushes that action and field slot minus one, and calls2e11a. Control callback2ddec handles descriptor controls separately (water/temperature, month, CUT/TODAY/CLOSE). These traced paths establish no immediate planting/harvest bypass of editor2e214..2e22e. This is scoped evidence about these handlers, not proof that every possible original input route has been found.

## Complete scheduled crop-cycle verification (2026-10-11)

`tests/browser/schedule-window.spec.ts` now exercises original Property purchase, Plant, Spray fertilizer, View object → Schedule, future-week Harvest, CUT, Sell and future-week Corn planting on supplied SCEN4. Simulation advances through actual day controls, without immediate `plant-field`/`harvest-field` adapters. Checkpoints decoded through the native loader prove harvest code440 in the chosen future week while the field is still Growing, completed delivery of corn (inventory type168), exact sale proceeds/removal, and a newly Growing crop with age below three weeks. CUT removes the generated repeat planting after harvest; without it, the generated plan can already have replanted by the observation date. Setup uses native scenario selection and disables disasters to isolate the crop cycle; this is not a claim that every ancillary control is original.

This verifies the usable scheduled replacement for the interim immediate orders. It does not establish an original immediate-harvest/replant gesture: editor2e11a still enforces future weeks, and weekly execution2f776..2fa54 supplies the relevant work rules. Next remove the native immediate UI adapters and migrate affected browser flows to the verified Schedule route, retaining simulation/source evidence. No new original defect inferred.

The interim immediate planting form is now removed. Browser checks enter Schedule by View object on the field, select a crop, and choose the next week. Planning itself leaves cash/market unchanged; weekly execution consumes stored seed or buys seed, rents machinery and produces the source crop pixels. Exact native checkpoint comparisons cover this execution and later chemical application. The market check preserves ordering: weekly quotes are sampled before planting adjusts the current history sample (fixture corn quote150 versus adjusted sample113). This is existing source-backed simulation behavior, not a new market rule.

Immediate harvest UI retirement: browser farming flows now queue Harvest through the original window rather than invoking the provisional immediate command. Waiting for the future week is distinct from waiting for machinery and delivery afterward. Original SCEN0 grapes have crop byte76=36 and an existing week36 harvest code440; attempts to move their harvest correctly fail, then seven grape and six almond fields deliver13 lots by the test observation date. This restriction was already recovered in editor2e11a; removing the native button removes a UI bypass rather than changing the original rule. Generated farms, supplied farms and a farm reloaded during fertilizer work use the same scheduled route. Canonical immediate adapters remain for isolated reconstruction fixtures.

## Interim feedback section removed (2026-10-11)

User request: removed the `schedule-feedback` area below the source frame. That covers:
- the field chooser select (`#planner-field`) and the "Create a field" fallback;
- the hovered-week status line and plan-result messages, along with the hover-week state and failure-message table they used.

Fields are chosen by View object + clicking the field on the map (source entry). The window's accessible name ("Field N schedule") identifies the field, and each week button's label ("date: plan") shows edits; rejected edits leave the label unchanged.

Browser helpers:
- `chooseField` and `expectSelectedField` in `tests/support/workspace.ts`;
- `selectedFieldSlot` in `field-checkpoint.ts`;
- `expectWeekPlan` in `schedule-window.ts`.

One native.spec check of the chooser's map centring was dropped with the chooser.

## Rebuilt on shared chrome (2026-10-12)

User request (ui-components.md). Schedule is a framed `GameWindow` around a 320×216 flex client. The canvas (`src/render/schedule-preview.ts`, removed) and the background bitmap are no longer used.

**Top:**
- The crop badge `SunkenInset` with "Crop" below.
- The water and temperature `BevelButton`s (source icon sprites, pressed while their overlay shows) on either side of the 8×2 crop-picker inset.
- The ‹ › page buttons, and the tool badge inset with "Tool".

**Middle:**
- Three month insets.
- The action inset (2×3 tile buttons).
- The black-bordered calendar strip: the source ruler sprite; 12 week tile buttons, with a 3px yellow bar marking the current week; and the month scroll (arrow buttons with source glyphs, the source track sprite with the tile-194 thumb, and a transparent range input on top for pointer and keyboard).
- The season inset, and the TODAY / CUT / CLOSE buttons.

**Bottom:** two sunken panels.
- **Field panel:** value and maturity readouts (maturity is an 80×8 bar, palette 12 with a palette 6 fill), and the Disease, Pests and Weeds gauges.
- **Crop panel:** the Crop/Quality labels with the condition badge inset, and the Water and Soil gauges.

Gauges show the field-gauge frame when a field is selected, otherwise the source dial sprite. Tiles 849..1047 use the masked atlas, as in source 2d2b2.

Performance note: tile helpers are plain functions, not components defined during render (which remounted every sprite on each animation frame and slowed time advancement).

## All crops at once (2026-10-12, user request)

The crop pager is gone. The crop inset holds all twenty-four planting icons in three rows of eight (134×52), where the source pages sixteen at a time. The client grows 16px taller (232px). The Tool badge keeps its former position in the space the pager used. The browser spec checks the icon positions for slots 0, 7, 8 and 23. Validation: schedule-window, all-crops and field-message specs pass (6/6).
