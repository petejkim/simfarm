# Original Edit cursors

The original cursor raster renderer is at file8062..8145 (0416:1d02). The shared decoder reads three header words32,2,16, followed by32 write-mask bytes and32 monochrome color bytes. For each visible mask bit, color0 paints black and1 paints white; zero mask preserves the background. Native transparent RGBA replaces the VGA read/modify/write. All five cursor records decode to16×16 CSS images at1×, independent of map zoom, with top-left hotspot0,0 established by the renderer's unadjusted171b/171d coordinates. No executable instructions run in the browser.

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

Reproducible import emits ignored edit-view.png/edit-bulldoze.png alongside move-pick.png/move-drop.png. Asset loading validates dimensions. React derives cursor selection from current presentation tools: Bulldoze, Move pickup/drop, or View while the map performs inspection. Switching away from placement/movement or cancelling returns to View; construction and Spray are now covered below; Plant, purchase placement and aircraft retain their current fallback. Original cursors for those remaining modes, exact clipping/held-button behavior and source modal timing are still separate gaps. No canonical command, simulation state, save schema, price or collision rule changes.


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

Plant3834a..3836c sets pixel dimensions0x80×0x80 and tile dimensions8×8; it does **not** select an8-pixel bitmap. The current8×8-tile placement preview has the right footprint, but exact original border drawing/cursor inheritance remains unresolved. Purchased-object and aircraft cursor behavior is also not established by this construction/Spray audit.

Range SHA256 (end exclusive):

- 217a8..21eac: `6017665ba8ac5efa9ed16bb6f208e72d3a6a660b375abb8eff4fc204db065f2d`
- 38310..38509: `5e9c1a27237dba32140f87ee30e76324efb09c9d4313711eafe6c2629c48c80f`
- 85f7c..85fc2, Spray pointer: `280d1918fc7beca2ba26a651a523e1e884d8e62fe2f46d31ff2e788ed3bfa6e5`
