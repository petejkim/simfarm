# Original Edit cursors

The original cursor raster renderer is at file8062..8145 (0416:1d02). The shared decoder reads three header words32,2,16, followed by32 write-mask bytes and32 monochrome color bytes. For each visible mask bit, color0 paints black and1 paints white; zero mask preserves the background. Native transparent RGBA replaces the VGA read/modify/write. All six cursor records decode to16×16 CSS images at1×, independent of map zoom, with top-left hotspot0,0 established by the renderer's unadjusted171b/171d coordinates. No executable instructions run in the browser.

Source: immutable SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are hexadecimal file offsets; initialized DS6190 begins846f0.

| Tool/state | Palette dispatcher and pointer assignment | Raster |
| --- | --- | --- |
| Bulldoze | action1, table22352→215ea;21649 loads18d2 and2164c loads6190; stores window+58/+5a and current pointer1888/188a | DS18d2/file85fc2, original arrow |
| View object | action2, table22354→21688;21692 sets Edit mode2;21698/2169e assign6190:19a4 | DS19a4/file86094, magnifying glass |
| Move pickup | action26→21726;2173e assigns6190:1a2e | DS1a2e/file8611e, FROM |
| Move destination | successful pickup137e5 assigns6190:19ea | DS19ea/file860da, TO |

The earlier Move reconstruction's renderer and transition evidence remains in manual-movement.md. Decoder/source tests pin selectors and compare every composited pixel over all16 original background colors. Header corruption and every truncated70-byte read span reject. The Move records' final color word overlaps adjacent initialized data, but its empty mask row hides it; this remains a bounded observation, not an asserted original defect. View/Bulldoze use the same verified decoder.

Additional range SHA256 (end exclusive):

- 215ea..216b9: `da2f9a0f7380c00686aed3d2d98ca039ed1c41957cc660168ed9dcfb37c33f47`
- 85fc2..86008, Bulldoze: `280d1918fc7beca2ba26a651a523e1e884d8e62fe2f46d31ff2e788ed3bfa6e5`
- 86094..860da, View: `fcf04c77d96bac75f8dfe811d3c59a118ace028738ae3accf9b8afe2471e804a`

Reproducible import emits ignored edit-view.png/edit-bulldoze.png alongside move-pick.png/move-drop.png. Asset loading validates dimensions. React derives cursor selection from current presentation tools: Bulldoze, Move pickup/drop, or View while the map performs inspection. Switching away from placement/movement or cancelling returns to View; construction and Spray are now covered below; Plant and purchase placement are covered below. Aircraft cursor, exact clipping/held-button behavior and source modal timing remain separate gaps. No canonical command, simulation state, save schema, price or collision rule changes.


## Construction and Spray selectors

All nine exposed construction actions selectDS18d2, the same arrow as Bulldoze. Their palette IDs, handler targets and pointer loads are source-pinned:

| Action | Handler | Load6190:18d2 |
| --- | --- | --- |
|11 Fence |217a8 |217c5 |
|12 Gate |21864 |21881 |
|13 Hay |21920 |2193d |
|14 Trough |219dc |219f9 |
|15 Paved road |21a9a |21ab7 |
|16 Dirt road |21b56 |21be3 |
|17 Trees |21c16 |21c33 |
|19 Valve |21d74 |21d91 |
|20 Ditch |21e30 |21e4d |

Each loadsAX=18d2/CX=6190 and writes the window cursor at+58/+5a. Dirt road reloadsES:BX before those stores. React now reuses the existing arrow asset for every construction tool; placement rules, prices and drag behavior are unchanged.

Spray's four selection branches at383fb,38449,3848f,384d7 assign6190:188c. That record is byte-identical toDS18d2 over the70 bytes read by the renderer, despite the separate source identity. The importer preserves it as edit-spray.png, using the same decoder. Persistent spraying retains this arrow until cancellation/another control, per the user's existing adaptation. Restoring inspection selects the magnifier. All five source record decodes retain boundary/header/pixel tests.

Plant3834a..3836c sets pixel dimensions0x80×0x80 and tile dimensions8×8; it does **not** select an8-pixel bitmap. The current8×8-tile placement preview has the right footprint. The follow-up trace below establishes cursor inheritance and original border drawing; the border is now implemented for Plant, Buy, construction and Bulldoze.

Range SHA256 (end exclusive):

- 217a8..21eac: `6017665ba8ac5efa9ed16bb6f208e72d3a6a660b375abb8eff4fc204db065f2d`
- 38310..38509: `5e9c1a27237dba32140f87ee30e76324efb09c9d4313711eafe6c2629c48c80f`
- 85f7c..85fc2, Spray pointer: `280d1918fc7beca2ba26a651a523e1e884d8e62fe2f46d31ff2e788ed3bfa6e5`


## Plant inheritance and Buy hourglass

Palette action22's table entry2237c resolves to21eec. At21f23..21f3f the handler assigns6190:18d2 to window+58/+5a and current1888/188a, then sets mode1 at21f41. Choosing a crop through38310..38397 changes mode to4 and installs the128×128pixel/8×8tile footprint, definition and tool, without replacing that cursor pointer. Plant therefore retains the arrow; native now selects the existing original arrow until a successful field command or cancellation returns to View.

Non-aircraft BUY47cc4..47d08 reads definition bytes8/9 into tile dimensions and shifts them by4 into pixel dimensions. The existing-window branch47d55 and newly-created-window branch47e3a both load6190:1aba, store window+58/+5a at47d60/47e49 and current1888/188a at47d6c/47e55, then set Edit mode9 at47d7e/47e67. DS1aba/file861aa is a16×16 monochrome **hourglass**, not the placement object's sprite. It is now imported as edit-buy.png and remains selected across successful/rejected repeated purchases; cancellation restores View. Aircraft's separate47c08 branch is excluded. Boundary and all-background pixel tests cover the sixth record.

Range SHA256 (end exclusive):

- 21eec..21f47: `76534a1a3b79154e10c017ab3cbd3e50b0982b9a85603b19af167c0bd24b48a6`
- 38310..38398: `70c45321024d884a24db3efddc383fdd2f0e311090a40646e8b59ec9db5e484e`
- 47cc4..47eba: `5a11eb45da9848cfe65b77551f592c9d91c822c0ad3baf457dc70df8f12618c6`
- 861aa..861f0: `91b36d09bde205b32acd33d4ae3132fb675fccf2d4e4f035544c1a3e3a0847cb`

## Placement outline reconstruction

208d6..20a48 handles a moved pointer for Edit modes9,4,15,16,17,2,1. It restores a previous rectangle with22684, snaps coordinates to16pixel boundaries, then draws the next rectangle using that same routine. Bounds are left=x&~15, top=y&~15, right=((x+width)&~15)-1, bottom=((y+height)&~15)-1. No placement-validity/color branch occurs in this draw path.

22684..2279d sets the Edit client clipping bounds and hides/restores the software cursor around eight inclusive lines. Four horizontal calls to0416:059f/file68ff draw from left through right at top, top-1, bottom, bottom-1. Four vertical calls to0416:0411/file6771 draw from top through bottom at left, left-1, right-1, right. These primitives enable all four VGA planes, set/reset all ones, select the XOR raster operation(1803h at67d7/696d), then latch-read/write each covered pixel. The effect is **palette-index XOR15**, with overlaps toggled twice. It is not white paint, RGB inversion or a filled validity tint. The original two-pixel geometry is asymmetric at top/left and its intersections cancel; preserve these details when implementing the source outline.

View, Spray, Plant, Buy, construction and Bulldoze now use this outline in place of the provisional green/red filled preview. Atlas loading retains an inverse companion decoded from the same source bitplanes using palette[index^15], preserving the original transparent index. The renderer uses even-odd clipping of all eight inclusive lines, then repaints only cells that can intersect the border with the inverse terrain, recreation and masked atlases. This preserves double-toggle intersections and leaves interiors unchanged. Existing browser redraws erase old borders and keep animation frame selection consistent. No simulation data or canonical commands change. Do not approximate this as Canvas difference-white: arbitrary VGA palettes need not have complementary RGB entries. Existing source primitive clipping uses inclusive bounds; modern viewport clipping and zoom are explicit browser adaptations. No new original-game defect is established by these normal raster operations.

Range SHA256 (end exclusive):

- 208d6..20a49: `b43e195860024867f854da681fb2ef0f36fbcb726f5ebfa7cc7d434b64e7c7ab`
- 22684..2279e: `ce3eaf01b112aef79a55564062de1617033a1952216c2e3b4297feffffc1ccc5`
- 6771..681d: `dd06b6f5c3b30a1bde7afb70934ab065643ea1ab5aa82b01a70f58a11dd5e6a4`
- 68ff..69f1: `16a19c1b3270968f9d277187386cf6297d88155d70925f1b9a38b59ea21ae8a3`


The interim persistent yellow selected-field/cell highlights have been removed from the world renderer. Selection remains in React for Schedule and other commands; the source map outline follows the pointer and erases on exit. Validity still controls canonical commands and readable rejection feedback; it no longer invents a red/green fill for these source modes. Move retains its existing provisional footprint presentation pending its distinct input/selection audit. View and Spray hover ownership is covered below. Browser map-edge clipping and zoom remain native adaptations. Current masked atlas artwork retains its existing normal palette independently of weather-colored terrain; the inverse companion follows that same palette. This increment does not claim restoration of the original global VGA palette on every UI/object/sprite. Review that remaining palette gap separately.

Verification compares browser canvas pixels against independent four-bit reads of supplied terrain/masked/recreation data for normal/rain/frost palettes, both border positions, untouched interiors, overlapping corner strokes, rejected placement, off-map footprints, cancellation and reload. Existing all24 Plant, repeated Buy, direct construction/Bulldoze and worker-animation flows retain command/save behavior. Source routine hashes and primitive calls are pinned in placement-outline.test.ts. Companion atlases are weakly owned presentation assets, reclaimed with their farm artwork; no new generated files or save fields are introduced.


## View, Spray and Bulldoze footprint ownership

View action2 sets Edit mode2 at21692. At216e4..21709 it writes16 to both pixel dimensions0a6a/0a6c and1 to both tile dimensions0a72/0a74. Mode2 is explicitly included in the pointer rectangle draw path209e4..209e9; field lookup/size is absent there. The browser now updates a one-tile XOR outline while inspecting the map, instead of retaining a yellow field/cell selection after a click. Clicking still opens the same original dialogs and commands.

Spray selection shares3821c..3826c: it reads popup node bytes+12/+13, shifts each by4 into pixel dimensions and also retains the unshifted tile counts. These bytes are width/height, correcting the earlier classification of the word+12 as unknown flags. All four supplied Spray nodes DS54a2,5494,5486,5478 contain01,01. The four treatment branches383ce..384f0 select mode1 and the Spray arrow without replacing those dimensions. Mode1 enters the same rectangle path209eb..209f0. Native Spray therefore uses a one-tile border even over an8×8 field; it still treats the whole field on a click and remains active as requested by the user. No red/green tint or field-size outline comes from this draw path.

Bulldoze2161d..21646 similarly assigns16×16pixels and1×1tiles, then mode15 at21667. Corrected the previous native preview's target-sized footprint: hovering a building/field shows one tile, while clicking still resolves the complete removal target and confirmation. Pending removal dialogs suppress hover feedback; canonical removal and drag stops remain unchanged.

Pointer tracking remains presentation state plus the existing unsaved simulation input used by source tools. Canvas hit-testing suppresses feedback beneath floating/modal controls, and leaving the map removes the outline. Browser clipping, visibility and event cadence remain adaptations. The source addresses establish pixel geometry/ownership, not full DOS message-loop timing. No new original defect is established.

Additional range SHA256 (end exclusive):

- 21688..21726: `54036ee66febc90a4d36bccb94dc3c4dc74b1ae173ae0195494ce34629308bc8`
- 3821c..3826d: `c40ea427fbf6aa1bafdaea4828964deba28eded676c10e270960302a9eadc5d7`
- 383ce..384f1: `7031693e850fe4f45ba8866c7d671733ceefbd664084985fe9c50f3526de7765`
