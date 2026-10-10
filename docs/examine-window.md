# Original object examination

Source is the immutable `SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are hexadecimal file offsets. Static disassembly establishes the dispatch and display behavior; no DOS execution or window manager is embedded.

## Source entry and resources

Overlay12 begins38790. Entry38790 calls38868, which checks primary-button state, converts screen coordinates to Edit world tiles, and calls38b4a. The original loops while the button is held (3892e..38a16), updating the card when the pointer crosses a tile or screen quadrant. Helpers387a8/38ab4/38a1e choose opposite quadrants and save/restore a208×208 rectangle. A field lookup at38b9b calls1957:01b8/file1b928; the field branch38bf2..38c69 creates Schedule with DS5d8c, sets the selected field/current month, and does not draw Examine.

Other objects load `examine.bmp` at38ca5. It is208×208, archive offset311096,21640 bytes, SHA-256 `8cc7e89c7c270b701fbbeaa8e21d8e721815e710c55df2b49127c32afe902fc9`. It contains the wooden frame and two gray insets, with **no bitmap text to erase**. Import validates its dimensions and retains every pixel. Native rendering uses its192-pixel client below the shared16-pixel wooden titlebar. The source has a blank title; native adds actual text “Examine,” a close control and dragging, consistent with the user's window policy.

Photographs reuse `alltiles.btl`:112×64 at card-relative48,24. Item sprites use the existing terrain/masked atlases. Condition badges reuse the text-free Sell atlas, with actual HTML grade letters and HIGH/FAIR/POOR/BAD captions. All source coordinates and art remain1×. The importer also reads the160 one-byte tile spans from2be7:099e/file4f5fe and the literal DS6ad1..6c73 messages, preserving source wording.

Byte-range SHA-256 (end exclusive):

| Range | Hash |
| --- | --- |
|38790..39a4c (overlay12 code)|`7d7ef4998984ba263f80a680f52b87e301c89f457cdb58d12b8ebb6a38bd561f`|
|4801c..480ad (name reader)|`0138644051a8b6c8b727184511d345ef5d1c81c8972a24cc1756317a85f2384a`|
|4f5fe..4f69e (tile spans)|`c6dbe148357a62638e5431dd0cabb1d6729858e92649866308f59d95ec7c06d0`|

## Verified dispatch and values

After the field branch, dispatch preserves this order:

1. Ground tiles73/74/113/114 show wreck photograph41 and the damaged-aircraft description (38d15..38d9f).
2. Ground tiles83..86 show water-tower interior photograph50 and its fill explanation (38da0..38e05).
3. Overlay bit4000 shows town photograph74 and the town-area description (38e06..38e65).
4. Homestead coordinates000c/000e plus inclusive offsets1..3 show photograph67 and item description12 (38e66..38eeb).
5. A closed building shows its definition photograph, name, damage strip and contents (38eec..390ed). Open buildings fall through to their contents. Types70/71 omit the interior grid; type72 converts stored water to tile83+(word10>>6). Empty graphic0 becomes217. Contents use column stride3 and paint at24+16*x,116+16*y.
6. Equipment lookup390f4→0d5f:000e/filef7fe uses the first active footprint, including rotation. Display uses the definition's unrotated row-major sprite grid at32,112, name at24,96, condition at56,104 and price at96,116. Quote39282→1192e returns the existing wear-dependent word; `%d` displays the signed word. Rentals and busy machines remain inspectable.
7. Animal lookup392ea→0f87:0df0/file12860 precedes chemical lookup. Animal flag1 selects photograph+1; it does not change the name. The existing animal valuation/condition helper12958 supplies the signed word price and grade (3948c). Display uses one sprite at32,112.
8. Chemical lookup394da→1234:0148/file14688 uses active coordinates. Helper1454e returns the unchanged definition price and condition3−(byte9>>6). That display does not change treatment effectiveness. Name, sprite, condition and price use the same source positions.
9. Town classification398bc recognizes the3×3 and3×2 atlas footprints. Its residential return1 is unreachable; preserve the static result and record SF-161. Remaining cases show Empty Storage Spot for217, the programmer description for tile-base125 through base+8 inclusive, the first matching tile-base/span item description, or NO TEXT FOR ITEM.

Name reader4801c seeks a physical128-byte `itemtext.dat` record, then stops at the first tilde or `@`; full descriptions use480ae and text wrapping. Native readers validate indices and record boundaries. Names and descriptions are actual React text, with browser font metrics and line wrapping. Native extended seed/harvest tiles resolve to their actual CRP descriptions, covering all24 crops without reading nonexistent original slots.

Building damage is byte6>>2, a maximum63 of64 pixels. Caller38fc5..38fe4 invokesa114 with width64, height8, filled palette3 and remaining palette13. Condition badges and all dynamic values are read-only views. Examination never writes the original shared text buffers, prices, quote caches, random streams or saved data; canonical simulation still owns all state and commands.

## Native controls and remaining fidelity

Choose **View object**, then click an object. A field opens Schedule; other tiles open Examine. The card remains open for keyboard access and can be moved, closed or reopened with its position retained. Initial position32,64 keeps the title under the fixed browser menu/control strip. This click-to-keep-open behavior replaces the DOS press-and-hold/quadrant popup loop; it is an explicit browser usability adaptation, not equivalent original input timing.

A compact footer outside the208×208 source frame offers **Open building / Close building** through the existing guarded simulation command and **Object actions** for transitional controls. Opening a building allows inspecting its contents directly on the map. The footer, persistent title and initial placement are native additions. Source object movement/construction gestures, remaining provisional action forms, complete window stacking and original UI sound callbacks remain unfinished. Edit stays permanently maximized; mobile layout changes remain deferred.

Validation covers source instructions/hash, string/table boundaries, every artwork pixel, source name termination, all branch priorities, building contents, signed quotes, all256 chemical condition bytes, all24 crop descriptions and examination of every tile in all eight original farms without any record/finance mutation. Browser checks compare exact photograph pixels and1× geometry, inspect all object families, open/close stored machinery, move/reopen the window and compare complete native checkpoints. Results and limitations remain in [progress.md](progress.md).
