# Original secondary-button map interactions

Source: immutable `SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are hexadecimal file offsets. Static disassembly only; the browser does not run the executable, interrupt handler or DOS event queue.

## Mouse event identity

At `5ffa..6008`, the program registers interrupt33 function0C with mask007F and callback `03df:0020` (file6010). That callback writes raw AX event flags to `DS1278 + slot*32` at60a0, then advances the bounded eight-entry queue. Consumer `e68e..e698` computes the word index `16*slot+1`, so its later `[index*2+1276]` reads those same event flags. The dispatcher tests mask08 atf1b9 and sends event7 to the hit window's callback atf1f2/f1f6. Mask10 sends event8 atf206/f237.

The archived Microsoft reference identifies function0C event bit3 as right-button press and bit4 as release, with AX carrying the event flags. This primary documentation corroborates the executable's callback path: [MS-DOS interrupt33 function0C, archived MSDN September1992](https://library.thedatadungeon.com/msdn-1992-09/advdos/html/advd76u9.content.htm). This establishes press rather than release or double-click as the source trigger.

Edit's callback2041c converts screen coordinates to16-pixel map cells at20449..20480. Its event table213c4 maps7 to20dfc and8 to the return at2140d. Event7 checksDS6ab6, calls the shared interaction255ca at20e1a, finds a building at20e2c and toggles its interior at20e65. Existing native modal guards and bounded coordinates remain in force.

| Source range (exclusive end) | SHA-256 |
| --- | --- |
| `5ffa..60e2` | `99b8a7247792ccbf353022ef9393e46321448741eb77c34c67c385a42c40f48e` |
| `f1b4..f242` | `578e1a5d4c314fa6db084b7f93c935365b222dcf631e55cf18473f62d58d9ea1` |
| `20dfc..20e70` | `cea277d90b3d601acb27681ac5cfe8cc63219760c54c2839f808742f14171de5` |
| `255ca..25708` | `2b49d2af22b50a6ddb16667ccb44753f66007b3caa81097d4644cb62208ac8de` |

## Fixture operations

Gates use the previously recovered188↔189 and190↔191 transitions at25708..257ad, preserving upper terrain bits with no payment or ownership check; see [network-placement.md](network-placement.md). Buildings use the existing canonical interior command and storage redraw. Pumps/windmills have no storage interior. Right-click is independent of the current selected tool, so a player can open a shed while Move object remains armed, then select the stored machinery normally. Closing a building after selection does not bypass the canonical drop preflight.

Valves require a newly recovered source operation, separate from construction. At25616..25705 the four states toggle122↔123 and124↔125, retaining all upper terrain bits. These branches do not impose the construction command's town/occupancy/ownership/cash gates. They consume no random values and request no audio. After changing the tile they look up the first active field containing `(x+1,y+1)` through1b928. Field bounds are origin-inclusive and far-edge-exclusive. The native scan is bounded by allocated records rather than a stale count.

Source transition122→123 clears field byte6 bit0 at25653;123→122 sets it at256af. Both124→125 and125→124 converge on the set-bit branch. This orientation asymmetry is retained and recorded as SF-162; no irrigation meaning is invented for the flag. The original bytes persist through the existing save format. The older explicit valve form remains a native tile-state control and has not acquired these additional source interaction effects.

## Browser integration and limits

`mapObjectInteraction` is a read-only projection to canonical commands. The canvas uses a primary pointer's secondary-button press, suppresses the browser context menu only on the game canvas, and ignores middle-button/release/context-menu events as actions. Tile mapping follows map zoom and scrolling. React retains only text feedback; simulation owns every tile/field/storage mutation. Town/default/flight gates still prevent gameplay commands. No UI scale, layout, save-schema or simulation-speed changes.

Text feedback and the canvas tooltip explain the gesture. Existing Examine open/close buttons remain available to keyboard and touch users. Long-press remapping and mobile layout are deferred. This increment covers farm fixtures, not all of255ca: town-building window dispatch and aircraft entry are traced below but not yet connected; primary-button interception and held-button construction remain follow-ups.

At257b0 the tiles71/72/111/112 use the equipment finder and open AIRPLANE descriptorDS658c when a machine is found. Helper9536 recognizes nine3×3 town image groups usingDS9484 bases320/323/326/329/332/335/338/352/355 with row offsets0/40/80. Table2590a dispatches its first five groups to MARKET VALUE (`DSbbfa`), SELL (`DSbdbe`), BANK (`DSb32a`), BUY (`DSb4a6`), FARM EXPERT (`DSbe9c`); remaining groups return. Source primary-button path20ab8 also calls255ca before its tool action, except that the helper bypasses interception for Edit mode15/event5. Reconstruct these routes alongside their remaining window interiors; do not substitute another dialog for Market Value.

Tests pin the mouse registration/queue/event mapping, source valve writes and building calls. They enumerate2048 terrain IDs, all256 field flag values for all four valve transitions, invalid coordinates, every supplied building footprint, nonmutation, zero-charge/no-audio semantics, saved raw bytes,35-day continuation and modal gates. Browser checks exercise press versus release, building entry during Move object, stale-selection protection, both gate orientations, all valve states, zoom/scroll mapping, default guards and exact downloaded checkpoints.


The six direct construction tools now apply the initial primary-button gate/valve branches before entering their held construction stroke. Other-tool interception and town/aircraft entry remain follow-ups. See [direct-construction.md](direct-construction.md) for exact branch ordering and tests.


Parked aircraft entry is now connected for primary/secondary presses and initial construction presses, with the primary Bulldoze bypass preserved. See [aircraft-window.md](aircraft-window.md). Town-building window routes and remaining original interiors still follow; earlier historical gaps above are not claims that those completed construction/aircraft increments remain absent.


Town-building image routes are now connected to Market, Sell, Bank, Buy and Farm Expert for primary/secondary and initial construction presses. Market has its reconstructed source chart; Expert still uses the interim crop guide pending its original interior. See [market-window.md](market-window.md). The primary Bulldoze bypass remains in force.
