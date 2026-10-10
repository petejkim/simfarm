# Original Plant and Spray popups

Source: immutable `SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are hexadecimal file offsets unless marked DS. DS6190 maps to file846f0. Evidence is static disassembly and source data; no DOS code runs in the browser.

## Descriptors and rendering

| Popup | Descriptor | Edit-relative position | Size | Items | Columns |
| --- | --- | --- | --- | --- | --- |
| Plant Field | DS545e | 48,64 | 224×160 | 16 | 2 |
| Spray Field | DS54b0 | 48,144 | 112×88 | 4 | 1 |

Descriptor words+0..6 give x/y/width/height, +8 is item count, +10 is retained zero, +12 gives columns and +14 gives112-pixel column pitch. Byte+16 gives rows including the title (9/5); byte+17 is17-pixel row pitch. Far pointers+18/+22 identify the first node/title. Titles are DS5338/536c. Every14-byte node contains a label far pointer, tile/tool ID at+4, next far pointer at+6 and retained flags at+10/+12. Source checks bound traversal and pin the complete chains.

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

The Edit callback at1d75:1ba0/file214f0 uses jump table22352. Palette IDs22/23 branch to21eec/21fa6, assigning Plant/Spray popup modes1/7 and selecting DS545e/54b0. Calls at21f67/2201a use24e6:1140/file281a0; the overlay thunk resolves to overlay11:0000/file37a20. The source callback also requests `click.voc` at2150e..21512; reproducing that UI sound dispatch remains unfinished.

Plant selection38310..38397 derives the original crop slot from its icon, stores DS56de at38332, selects Edit mode4 and requests an8×8 cursor (3835d,38364,3836c). At38386 it writes selected tool018a=`fffe`. The map branch23e22 reads coordinates and tests that sentinel at23e9b. Call23eae reaches1d75:2c0e/file2255e, which calls1957:0830/file1bfa0 at22571, the recovered new-field constructor/validator. This evidence establishes **new-field placement**, not an existing-field replant gesture.

Native Plant therefore selects a crop and arms an8×8 map preview; clicking calls the existing `create-field` command. Source placement, ownership, separation, seed acquisition, accounts and machinery remain in the simulation. Occupied field terrain rejects placement. Original plan creation precedes seed acquisition at23f73/23f85; native retains the previously documented SF-018 atomic failure correction. Failed seed orders do not create a field or change a checkpoint.

Spray's map route resolves a field through26c75→1957:01b8/file1b928. Treatment handlers26d3c..26f86 check field presence, Waiting/Growing state and both equipment words before consuming supplies and starting state6..9 work. The existing `treat-field` command already owns those rules, seed/chemical purchase policy and current-week plan entry. Native popup selection only chooses the treatment; a map click dispatches it. No new simulation rules or save schema are introduced.

## Native interaction policies and remaining work

All24 crops remain available without loading/swapping files. Two pages reuse the source16-item grid; small previous/next controls at x192/208 in the title row are a native extension. Arrow keys, Home/End, visible focus, outside-click dismissal and Escape are browser interaction policies. These menus are attached Edit popups, not movable document windows; Bank/Buy/Sell/Map/Schedule retain their wooden draggable titlebars.

Selecting an item only arms a tool. A valid click issues one canonical command and returns to inspection, consistent with the source mode reset after new-field placement. Rejected commands retain the selected tool and display readable feedback. Escape/Cancel clears the tool without a farm mutation. Live placement outlines and the footer are native additions, not claims of complete DOS cursor/event-loop fidelity. Pending town/default/flight gates remain respected.

Schedule opens through View object on an active field or **? → Farm controls → Crop planner**. Immediate existing-field replant/harvest remains available through the transitional **? → Field orders** panel. Recovering original field/object context actions and retiring the remaining forms is subsequent work. Other unresolved UI areas include tree planting, multiple-window stacking, complete frames and source UI sound callbacks. Mobile rearrangement remains deferred. This increment does not complete the game port.

Validation pins source descriptors, chains and instruction call sites; compares popup geometry and exact crop icon pixels; and exercises keyboard/cancellation without save mutations. Browser flows create all24 crops, reject occupied/out-of-bounds placements and missing seeds, apply all four treatments, reject busy/invalid fields, and compare saved outcomes/continued work with independently dispatched canonical commands. Full results are in [progress.md](progress.md). No new original defect was established; SF-018 remains recorded in [original-bugs.md](original-bugs.md).
