# Original Plant and Spray popups

Source: immutable `SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are hexadecimal file offsets unless marked DS. DS6190 maps to file846f0. Evidence is static disassembly and source data; no DOS code runs in the browser.

## Descriptors and rendering

| Popup | Descriptor | Edit-relative position | Size | Items | Columns |
| --- | --- | --- | --- | --- | --- |
| Plant Field | DS545e | 48,64 | 224×160 | 16 | 2 |
| Spray Field | DS54b0 | 48,144 | 112×88 | 4 | 1 |

Descriptor words+0..6 give x/y/width/height, +8 is item count, +10 is retained zero, +12 gives columns and +14 gives112-pixel column pitch. Byte+16 gives rows including the title (9/5); byte+17 is17-pixel row pitch. Far pointers+18/+22 identify the first node/title. Titles are DS5338/536c. Every14-byte node contains a label far pointer, tile/tool ID at+4, next far pointer at+6 and a retained word at+10 and tile width/height bytes at+12/+13 (reads3822d..38269). Source checks bound traversal and pin the complete chains.

Plant starts DS5450, follows descending14-byte nodes through537e, and uses tiles832..847. Labels are populated at runtime. Spray follows DS54a2→5494→5486→5478 and has these exact source labels/order:

| Label | Tile/tool ID | Native canonical order |
| --- | --- | --- |
| Fertilize | 915 | fertilizer |
| Pesticide | 914 | pesticide |
| Herbicide | 913 | herbicide |
| Fungicide | 912 | fungicide |

Popup implementation37a20..37e2e fills palette12 gray, draws16×16 icons in column-major order at row1 (y17), and draws black labels at icon x+16/y+4. The title begins x+16/y+4. Plant's seed check37bc2..37bed substitutes DS6aaa `NONE OWNED` when stock is empty and automatic seed buying is disabled. Native captions reproduce that state as actual HTML; the accessible name retains the crop identity. Canvas draws icons only. All artwork displays at1×, matching terrain. Edit's48-pixel screen origin and2-pixel CSS left border are accounted for without scaling.

Source-byte fingerprints (SHA-256; end offsets exclusive):

| Range | Hash |
| --- | --- |
| 89a6e..89bba (nodes/descriptors) | `82fabd5c43b59f3b3b58667c4f9c74c7568f5ec3429f8911456464408023416f` |
| 37a20..37e2e (popup paint) | `c1deca0c5317c823de8ac6c62fe76b83edafc60fa83f616ab0b915d6fbdab5ea` |
| 38310..38397 (Plant selection) | `28de6e7b4da650e5078cbf11be0065f951cdd14d820a73fde4b37157ca8b2f51` |
| 21eec..22032 (palette popup branches) | `7e7cfa1dbe87947634c2d11c5e597633447afdbd4e97e1602ec4eb0f299c70d9` |

## Verified command routes

The Edit callback at1d75:1ba0/file214f0 uses jump table22352. Palette IDs22/23 branch to21eec/21fa6, assigning Plant/Spray popup modes1/7 and selecting DS545e/54b0. Calls at21f67/2201a use24e6:1140/file281a0; the overlay thunk resolves to overlay11:0000/file37a20. The source callback also requests `click.voc` at2150e..21512; native buttons now use the shared click-sound handler and its persisted Options preference.

Plant selection38310..38397 derives the original crop slot from its icon, stores DS56de at38332, selects Edit mode4 and sets a128×128-pixel (8×8-tile) placement footprint (3835d,38364,3836c). At38386 it writes selected tool018a=`fffe`. The map branch23e22 reads coordinates and tests that sentinel at23e9b. Call23eae reaches1d75:2c0e/file2255e, which calls1957:0830/file1bfa0 at22571, the recovered new-field constructor/validator. This evidence establishes **new-field placement**, not an existing-field replant gesture.

Native Plant therefore selects a crop and arms an8×8 map preview; clicking calls the existing `create-field` command. Source placement, ownership, separation, seed acquisition, accounts and machinery remain in the simulation. Occupied field terrain rejects placement. Original plan creation precedes seed acquisition at23f73/23f85; native retains the previously documented SF-018 atomic failure correction. Failed seed orders do not create a field or change a checkpoint.

Spray's map route resolves a field through26c75→1957:01b8/file1b928. Treatment handlers26d3c..26f86 check field presence, Waiting/Growing state and both equipment words before consuming supplies and starting state6..9 work. The existing `treat-field` command already owns those rules, seed/chemical purchase policy and current-week plan entry. Native popup selection only chooses the treatment; a map click dispatches it. No new simulation rules or save schema are introduced.

## Native interaction policies and remaining work

All24 crops remain available without loading/swapping files. Per the user request, all24 crops appear together in three112-pixel columns; there is no crop paging. Arrow keys, Home/End, visible focus, outside-click dismissal and Escape are browser interaction policies. These menus are attached Edit popups, not movable document windows; Bank/Buy/Sell/Map/Schedule retain their wooden draggable titlebars.

Selecting an item only arms a tool. Each valid Plant or Spray click issues one canonical command. Both tools then stay armed for repeated clicks until another control is chosen or Escape cancels, per user requests (Plant from 2026-10-12). The original resets the mode after new-field placement (38386 sentinel / 23e9b), so a staying-armed Plant is a deliberate native deviation. Rejected commands retain the selected tool and display readable feedback. Escape/Cancel clears the tool without a farm mutation. Plant uses its8×8-tile source XOR placement outline; Spray uses the one-tile source outline from node bytes+12/+13 (edit-cursors.md). The footer remains a native addition, and these changes do not claim complete DOS event-loop fidelity. Pending town/default/flight gates remain respected.

Schedule opens through View object on an active field or its original window controls. Interim Farm controls/Field orders/Field information windows have been removed. Existing-field planting and harvest use Schedule; the immediate native command adapters remain for simulation compatibility/tests but no React control dispatches them. See [field-interaction-audit.md](field-interaction-audit.md) for the bounded source-route audit. Trees, movable window stacking, original frames and shared button sounds are implemented; these old gaps should not be treated as current backlog. Exact original cursor/event-loop fidelity remains a separate audit limit. Mobile rearrangement is excluded from the current goal.

Validation pins source descriptors, chains and instruction call sites; compares popup geometry and exact crop icon pixels; and exercises keyboard/cancellation without save mutations. Browser flows create all24 crops, reject occupied/out-of-bounds placements and missing seeds, apply all four treatments, reject busy/invalid fields, and compare saved outcomes/continued work with independently dispatched canonical commands. Full results are in [progress.md](progress.md). No new original defect was established; SF-018 remains recorded in [original-bugs.md](original-bugs.md).

## Spray confirmation audio

User report2026-10-13: successful field spraying lacked confirmation even with Button Click Sounds enabled. The native command had restored quick-message68 but omitted the preceding source sound call. Source hash of26d3c..26fa9 (end-exclusive26faa) is `4ed0328215db8173beeb07bc25ee47e5610910da41cc39e6d03f710973e1d6c8`; SIMFARM.EXE SHA256 is `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Initialized DS starts at file846f0.

| Treatment | Successful filename push | DS filename |
| --- | --- | --- |
|Fertilizer|26dc7|5a95|
|Pesticide|26e56|5a9f|
|Fungicide|26ef2|5aa9|
|Herbicide|26f82|5ab3|

All four strings are exactly `click.voc\0`. The first three push DS and the filename pointer, then jump to26f86; the fourth falls through. Shared bytes26f86..26f8d are `9ab6082a2183c404` (call212a:08b6, then discard the pointer), followed by blank quick-message68 at26f8e. No-field exits26d42/26dd4/26e70/26f00 and busy/supply failures26f2e/26e5e bypass this success-only audio. Confidence high from exact caller bytes, shared branch destinations and resource strings; tests pin all of them. Source record boundaries, consumption/state/plan order and source PCM samples remain intact.

The canonical `treat-field` success branch now emits one transient `sound:'click'` event. App routes it to the cached button-click voice so the user's Button Click Sounds preference applies, in addition to Sound Effects mute. Audio requests remain independent of treatment state and never enter checkpoints. This is a native reconstruction omission correction, not a new original bug. Rejections stay silent; clicking a Spray menu item still has ordinary HTML button feedback. Mouse/touch checks verify all four successes, failed/busy orders, both mute preferences and complete checkpoint equality without replay on reload. Other original window/driver arbitration remains a separate fidelity gap.

## Interim treatment form retirement

Removed FieldCare and its Field information props/callbacks. All four immediate treatments now use the original Spray popup and repeated field-click interaction exclusively. Canonical state/equipment/supply guards, stored-stock use, delivery payment and plan recording remain unchanged; the source route26c75/26d3c..26f86 above is the evidence for this replacement. Migrated stored-supply and full farming-cycle checks to actual Spray clicks. The subsequent Field orders retirement removed the immediate existing-field replant/harvest UI; their internal command adapters do not establish original-route fidelity.

## Popups on shared chrome (2026-10-12)

The Plant Crop and Spray Field popups no longer draw their icons on a canvas under transparent buttons. Each popup is a CSS grid: a 17px title row, then column-major 112×17 menu items. Each item holds its 16px `TileSprite` and its caption.
- **Masked atlas:** 37b3c uses the masked atlas only for tiles above 848, so `maskStart` is 849.
- **Unchanged:** popup positions and sizes still follow the source geometry.
- **Removed:** `src/render/field-tool-menu.ts`.

The spec checks each icon's box and tile offset (`cropPlantTile`). `crop-graphics.test.ts` covers the patched crop-atlas pixels. Validation: field-tools, all-crops and edit-status specs pass (10/10).
