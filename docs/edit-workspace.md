# Permanent Edit workspace

The user's current UI policy is the original desktop arrangement, with Edit always visible/maximized and no close, minimize or resize controls. Mobile rearrangement is deferred. Native pacing remains a four-second day at1×; all24 crops remain available. This increment replaces the scrolling dashboard with a permanent canvas below the restored menu/control strip, the original two-column tool artwork on the left, and nonmodal React windows over the map.

## Source palette and interactions

Source offsets, decoding confidence and caption masks are recorded in [edit-palette.md](edit-palette.md).

The visible icon order is Move object/View object, paved/dirt road, fence/gate, ditch/valve, hay/trough, trees/bulldoze. The matching archived `edithelp.bmp` also supplies the tool grouping labels. The live palette routes these icons to existing native tool commands. Trees remains disabled because tree planting has not been reconstructed. Plant opens the original crop popup and arms new-field placement; Spray opens the original four-treatment popup and arms an existing-field click. See [field-tools.md](field-tools.md). View object clicks open Schedule for fields and Examine for other tiles. Move object selects machinery or a supply on the map, then accepts its destination through the canonical movement commands; see [manual-movement.md](manual-movement.md). Other tools retain their action windows. Source-exact one-click/drag operations, selection cursors, complete field-functions dispatch and original dialog interiors remain unfinished.

## React window ownership and remaining adaptations

`WindowDesktop` owns only the active UI window. Simulation state stays in `GameSimulation`; windows subscribe through FarmView and send existing commands. Showing/closing a window does not pause, advance or reset the simulation. Farm loads reset the UI window selection, while the canvas remains mounted when ordinary windows open/close. Edit always occupies the remaining desktop area, with fixed1× menu/palette coordinates and no small-screen breakpoint. Window bodies scroll within their bounds. No DOS window manager or executable code runs.

The generic frame borders, most sizes/positions, single-front-window presentation and remaining standard form interiors are provisional native scaffolding. Bank, Buy, Sell, Map and Schedule now use source interiors/descriptors; shared titlebars use original wooden tiles and native pointer/keyboard movement (see [window-titlebars.md](window-titlebars.md)). Evaluation, crop guide, tools, weather/time and object panels retain working commands. Options exposes audio and file/tool shortcuts; Speed exposes the requested native slider/pause/day controls rather than resurrecting original PC presets. Disasters opens the existing event controls. Financial default and town decisions remain visible and preserve their simulation command gates. File continues to offer original command ordering, native checkpoints and ordinary SSM import. New Game uses the existing region/design workflow inside a window.

Next reconstruct individual original window layouts and interactions, beginning with Bank and Buy/Sell/land and field dialogs. Recover exact Edit hit regions/callback routing and the original compression routine before generalizing its decoder. Preserve original defect notes; no new original-game defect is established by this UI increment.

## Native artwork scale

Per user direction, one source pixel displays as one CSS pixel, matching the terrain at default zoom. The control strip is640×32 below the16-pixel menu; the Edit palette is48×208 with24×24 icon hit regions. Menu coordinates and popup pitch use source dimensions. The maximized desktop has a640-pixel minimum width, with no mobile rearrangement. Region artwork is472×328, terrain design is352×304 and crop illustrations are112×64 (plus their CSS border). Text remains HTML with readable replacement font metrics. Map zoom remains an independent existing control. Provisional form interiors remain subject to later source-layout reconstruction.

Bank now uses its source terminal artwork, control rectangles and window position rather than the interim loan disclosure. See [bank-dialog.md](bank-dialog.md). Buy/Sell, land and field interiors are next.

Schedule opens from Crop planner or View object on an active field; it replaces the provisional planner disclosure. Other Edit tool forms remain transitional until their original immediate gestures are reconstructed. See [schedule-window.md](schedule-window.md) for the source layout and supported controls.

Plant/Spray now use their original popup geometry and map command routes. Immediate existing-field replant/harvest remain accessible through **? → Field orders** until their original object interactions are reconstructed. Other Edit tool forms remain transitional.

View object now uses the original208×208 Examine card for non-field objects, with photographs, item names/descriptions, building contents/damage and original condition/value views. Its persistent draggable frame and compact action footer are native adaptations; source evidence is in [examine-window.md](examine-window.md).


Right-click buildings, gates or valves to open/close them without switching tools. This uses the verified original secondary-button press path; current Move object selection stays armed, and ordinary command guards remain. Source evidence, valve side effects and remaining town/aircraft/primary-button routes are in [map-interactions.md](map-interactions.md).
