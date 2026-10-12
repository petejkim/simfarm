# Original town-expansion chooser

Source is immutable SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`; addresses below are hexadecimal file offsets. Evidence comes from static disassembly and archive pixels, without executing a DOS environment.

## Direct bitmap and controls

This chooser is drawn directly, without a normal window descriptor. At3c04e, DS9ddc names `twnchoic.bmp`; manager24e6:0f92 reads41224 bytes to4d9f:0000. The draw at3c0a2..3c0b4 places it at screen96,96. Archive offset513848 holds its368×224 four-plane bitmap, SHA-256 `20923a8dba2ad4624c12335e48512a3450214d7b86083d4ca9bf2fc857187e86`. The chooser range3c04e..3c3a6 hashes to `2d2dfc927c22f13e45efb4386c5edbaa2a3400a59b9c47babbbacb46ff341e2c`.

Inclusive hitboxes share y128..200, with x112..184,200..272,288..360,376..448. The four captions are Residential, Commercial, Airport and Recreational. The original instructions read: “The town is purchasing a new plot of land. The mayor is asking voters to decide what kind of plot should be built. Click on your preference for what kind of plot the town should build.” These captions and instructions are reconstructed as React text. Import removes black lettering within the caption band and instruction-box interior; all other source pixels remain unchanged. Generated `town-choice.png` and `town-choice-pressed.png` remain ignored and reproducible through the local importer.

Each hit requests click.voc at DS9de9/9df3/9dfd/9e07 and calls24e6:0f9c with its rectangle and pressed flag1. The manager stub27ffc dispatches overlay7:081e/file338ee. It writes two palette13 top/left lines and two palette15 bottom/right lines; flag0 reverses these colors. Painter338ee..33aa4 hashes to `b8bf106d379957a6595f2510e2b4c278e72188c98134969058eb20df4f99e7d8`. The native pressed overlay preserves the picture and reproduces these line coordinates. Source calls construction while held, waits for release, then restores the bevel. Native HTML buttons commit on click/release and support keyboard activation; releasing outside cancels the click. This event timing is a browser adaptation, not recovered DOS input polling.

## Canonical continuation and native adaptations

Source handlers3c152/3c1c6/3c24a/3c2bc already map to the canonical Residential `(simulation&7)+6`, Commercial `min(3,(simulation&3)+1)`, Airport5 and Recreation4 construction paths. Original recreation failure redraws the same bitmap at3c2da..3c343 and keeps the decision pending. The native error explains that failure below the source artwork; it does not disable or bypass the constructor. No simulation ownership, RNG, annual ledgers or save schema changed for this UI restoration.

The original dc0 animation-tick timeout at3c0ca..3c0d9 reaches the bounded random branch3c385. Per user direction, native browser pacing does not recreate this DOS timeout. The existing “Let town decide” action invokes that branch explicitly from the blank margin above the instruction box. Failed random recreation keeps the reservation pending and retains the consumed draw, preserving the SF-048 correction. Source timeout failed to check the constructor return; see [original-bugs.md](original-bugs.md#sf-048--town-choice-timeout-ignores-a-rejected-recreational-district).

The original artwork includes a blank wooden strip and fixed outer border. Native adds an actual-text Town development title to that strip and reuses the draggable frame, without increasing the368×224 initial bounds. The source bitmap is split visually at row16 between title and client. Escape/Close cannot discard a paid reservation. Decisions block canonical time and farm commands, but the browser file menu remains available to save/load a pending choice; this is deliberately not an HTML top-layer modal that would make those controls inert. Positions are presentation state only. The fixed/maximized Edit view and desktop layout are unchanged. These browser interaction policies are explicit adaptations; original window-manager/timeout behavior is not claimed.

## Validation

Source tests pin the bitmap and callback hashes, click names, hitboxes and every pressed-overlay pixel. They compare every imported frame pixel, confirm caption glyph removal, reject every truncated bitmap prefix and reject other bitmap dimensions. Browser tests check source geometry, picture pixels, copyable text, text fit, pressed display, cancelled release, movement, forced pending state, each of the five canonical choices, exact full saves, lack of browser-time expiration, keyboard/reload continuation and SF-048 failure/resume. Existing annual tests cover unavailable manual recreation, saving pending annual reset, invalid saves, exactly-once annual continuation, taxes and statistics. Full regression status is recorded in [progress.md](progress.md).

## Native rebuild on shared chrome (2026-10-12)

The town choice window keeps the `twnchoic.bmp` plank as its title-bar artwork and now uses the common frame around a 352×200 flex client.
- **Picture buttons:** four 72×72 `BevelButton`s with shadow, at their source positions. Their faces are the bitmap pictures inside the bevel (sprite at bitmap x+3, 35).
- **Captions:** HTML text centred in 88px columns.
- **Timeout:** the underlined "Let town decide" link.
- **Instructions:** sit in a 240×80 `RaisedPanel`.

The pressed state is now the shared bevel swap. `town-choice-pressed.png` is no longer used by the UI; it is still loaded (cleanup deferred). The browser spec checks button geometry, sprite face offsets, the pressed bevel and that no image or canvas remains. Previously the button box was 73×73 including its shadow; it is now 72×72 with a CSS shadow. Validation: town-choice and town specs pass.
