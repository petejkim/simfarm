# Direct Edit construction

Source is immutable SIMFARM.EXE, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. All addresses below are hexadecimal file offsets, verified by static disassembly and source-byte assertions. No DOS program or input loop runs in the browser.

## Palette and held-button loop

Palette callback214f0 uses jump table22352 (resident segment1d75, filebase1f950). These six branches set Edit mode4 and select the original definition:

| Tool | Palette ID | Branch | Mode4 write | Definition |
| --- | --- | --- | --- | --- |
| Fence | 11 | 217a8 | 217e9 | 297 |
| Gate | 12 | 21864 | 218a5 | 303 |
| Paved road | 15 | 21a9a | 21adb | 293 |
| Dirt road | 16 | 21b56 | 21c0a | 288 |
| Valve | 19 | 21d74 | 21db5 | 304 |
| Ditch | 20 | 21e30 | 21e71 | 289 |

Mode4 resolves through20d9c to20c6c, calling21c2:0002/file23e22 at20c8b. Entry23e2f initializes previous x/y toFFFF. Its ordinary construction path checks one-cell width/height at24178/24187, then enters24196 while mouse button-stateDS1721 bit0 remains set at24b34. It reads current pointer coordinates, rejects points outside the Edit client, and converts screen pixels to world cells using shifts by4 and viewport origins at241ec..24209. Release exits and clears the previous coordinates at24b3f..24b45. This is direct held-button construction, not a select/review/confirm form.

The loop distinguishes unchanged coordinates at2422c..2424a by setting local status2. It can still evaluate placement at those coordinates, but common audio dispatch24b11..24b28 only requests `uhoh.voc` for status0 and `ploptool.voc` for status1. Successful state changes go through the original specialized road/fence/gate/ditch/valve rules already documented in [network-placement.md](network-placement.md) and [irrigation.md](irrigation.md). The native input layer submits once per changed sampled cell; newly constructed network tiles reject ordinary repeat construction anyway. No continuous same-cell retry or repeated failure noise is generated.

## Initial map interaction

Before entering a tool loop, primary-button Edit handler20ab8 calls255ca once. A valve toggles via25616..25705 and returns0, consuming that press. A gate toggles through25708..257ad and, absent a town-building match, returns1 at255f3, allowing construction to continue. Consequently clicking an existing gate with a road tool opens/closes it and then rejects the road placement. A valve encountered later in an already-held construction loop is not toggled: the specialized construction rule receives it and rejects it normally. Browser regression pins this distinction. Right-click fixture operations remain available independently.

This increment connects that initial gate/valve behavior for the six direct construction tools. The shared handler's town-window/aircraft routes and interception for other tools remain unfinished, as recorded in [map-interactions.md](map-interactions.md). Do not claim complete original event dispatch from these six tools alone.

## Native integration

Choose Paved road, Dirt road, Fence, Gate, Ditch or Valve in the original1× Edit palette, then click or hold the primary button and move across map cells. The tool stays selected for repeated work. Each sampled cell uses the existing canonical command, including dynamic price, cash, clearing, ownership, town, occupancy, orientation, connection and crossing checks. No bulk quote, synthetic discount, reserved cash or drag-path transaction is introduced. Failed cells leave state unchanged under the existing SF-095 correction, and later cells can still succeed. The older explicit network/irrigation forms remain secondary access.

React owns the selected tool and feedback, and refs own transient pointer capture/last sampled cell. The simulation owns purchases, terrain, expenses and sound requests. Ditch/valve construction now requests the same original success/failure PCM as the shared source loop; free valve/gate operations remain silent. Native saves require no new version or persistent draft. Restoring a save does not resume a stroke or replay its sounds.

Pointer capture allows release outside the canvas. Captured coordinates must still lie inside the visible map viewport; no painting occurs under the menu/palette/footer. Pointer cancellation, lost capture, window blur, hidden document, modal blocking or changing tools ends the stroke. Escape or Stop construction disarms the tool, retaining already completed purchases. Browser click events following a stroke are suppressed to avoid duplicate placement or opening Examine. Opening tool help cancels direct painting but retains the network/irrigation category for its legacy controls.

Touch uses the same captured pointer path with touch-action disabled only while construction is armed. Desktop layout remains unchanged; no mobile redesign or invented long-press action is added. Input follows browser samples without synthesizing cells between distant samples, axis locking or automatic map-edge scrolling. Browser event scheduling and the native simulation clock remain independent; the DOS busy loop and PC timing are not emulated. These are explicit native input adaptations, not claims of identical DOS event timing.

## Validation and limits

Source tests pin all six palette dispatches, definition IDs, mode4 routing, one-cell gates, coordinate shifts, held-button test and repeat/audio branches. Existing rule tests cover all2048 terrain IDs,16 connection masks, cash/ownership/clearing boundaries and exact saved continuation. New live audio checks cover success/failure, silent free operations, modal guards and no replay.

Five new browser flows exercise all six direct tools, connected lines, water/road crossings, exact source pixels, no mutation from hover, atomic cash/clearing rejection, same-cell suppression, outside release, cancellation/blur/Escape, tool changes, initial versus dragged-over valve behavior, captured touch at2×, save/reload and continued simulation. Preview colors and readable feedback are native additions. No new original-game defect is established; SF-094/095/113/135/162 and other prior rule notes remain in original-bugs.md.

Hay/trough quick placement, Trees, direct Bulldoze and the remaining town/aircraft/window interactions still need reconstruction. This increment does not complete the original Edit tool system or the preservation goal.
