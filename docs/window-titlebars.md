# Movable windows and original titlebars

Source is the immutable SIMFARM.EXE, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are hexadecimal file offsets. Static disassembly only; no executable code or DOS window manager runs in the browser.

## Verified artwork and title rendering

The common renderer at2b09a belongs to overlay0 (base2a0b0). It draws16×16 atlas tiles through0863:01b4. Window flags select a left control at2b0e5..2b137: flag1 uses tile0. The title-strip flag20 selects the horizontal loop2b1cf..2b24e, which starts at x+16, increments by16 and excludes the right control when flag40 is present. A null next-window pointer at+44/+46 selects tile1 at2b24a; otherwise2b20c selects237. Tile1 is the light wooden strip;237 is its darker inactive appearance. Bank and Buy descriptor flags are0061.

Title routine2b500 reads the string pointer at descriptor+40/+42, positions it at y+4 and centers using its8-pixel glyph width (with the source even-length adjustment). It calls0636:07b6/file8d16. That routine reads characters through NUL or `@`, advances x by8 and draws glyphs with palette15 (white) at8d54. Native titles use real centered uppercase HTML text; browser font metrics intentionally replace the original bitmap font.

The source tiles are in `ega16til.til`, archive offset1807664, size112640, SHA-256 `bab4818f7622b695354435ea9ea8b36268c4c306a2f1a88f79ca19dcd72a3f2d`. Import decodes exactly128 bytes per tile with the existing bounded planar decoder and gameplay palette. It writes ignored16×16 `window-close.png`, `window-title.png` and `window-title-inactive.png`. These contain artwork only, no lettering. Source-pinning checks verify the renderer constants, text color/position and every imported pixel.

## Native movement policy

All shared GameWindow titlebars support primary-pointer dragging with pointer capture, including touch pointers. Release/cancel/lost capture ends movement. Buttons and secondary pointers do not start drags. Focused titlebars also accept arrow keys (10 pixels, or1 with Shift); input controls keep their own keyboard behavior. Window positions are React presentation state, retained on close/reopen and reset when their owning farm UI remounts; they never enter simulation checkpoints.

Bounds keep windows beneath the48-pixel menu/control strip and inside the desktop when they fit. Oversized interim dialogs can move horizontally between either edge, keeping their title accessible. ResizeObserver reclamps moved windows after desktop or content changes. This is a browser usability policy, not a claim of original drag snapping/constraints. Desktop sizing/layout is unchanged; there is no mobile rearrangement.

Edit keeps its permanent maximized placement and has no movement, close, resize or minimize controls. Its title uses the same1× strip, darkened while another window is visible. The shared left title control closes ordinary windows; forced decision dialogs retain their existing close gates. Independent ordinary windows and inactive titles are now restored; see window-stacking.md. Original right zoom/depth controls, flag-specific ordering, full frame borders and DOS event-loop semantics remain unfinished. This increment restores title styling and native movement, not all window-manager behavior. No original-game defect is established and no farming rule, saved state or timing changes.

Browser checks cover mouse/touch movement, cancellation, outside-title release, keyboard movement, edge clamping, resize recovery, reopening, close/input behavior, missing artwork, immutable Edit geometry and identical checkpoints. Reviewed `artifacts/browser-movable-windows.png` at1×.
