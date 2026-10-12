# Original Edit cursors

The original cursor raster renderer is at file8062..8145 (0416:1d02). The shared decoder reads three header words32,2,16, followed by32 write-mask bytes and32 monochrome color bytes. For each visible mask bit, color0 paints black and1 paints white; zero mask preserves the background. Native transparent RGBA replaces the VGA read/modify/write. All four cursors are16×16 CSS images at1×, independent of map zoom, with top-left hotspot0,0 established by the renderer's unadjusted171b/171d coordinates. No executable instructions run in the browser.

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

Reproducible import emits ignored edit-view.png/edit-bulldoze.png alongside move-pick.png/move-drop.png. Asset loading validates dimensions. React derives cursor selection from current presentation tools: Bulldoze, Move pickup/drop, or View while the map performs inspection. Switching away from placement/movement or cancelling returns to View; active construction, crop tools, purchase placement and aircraft retain their current fallback. Original cursors for those remaining modes, exact clipping/held-button behavior and source modal timing are still separate gaps. No canonical command, simulation state, save schema, price or collision rule changes.
