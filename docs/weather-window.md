# Original Weather window

Source `SIMFARM.EXE` SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are hexadecimal file offsets, with initialized DS at846f0. Static source-byte reconstruction only; no DOS/x86 code runs. Canonical climate/calendar/weather state remains in the existing plain-TypeScript simulation; this increment reconstructs its original display.

## Descriptor, layout and resources

DS436e has flags1061, position160,128,336×208 outer dimensions, title pointer DS3f56 `WEATHER`, paint callback1b98:05ea/file1e16a and button callback1b98:061a/file1e19a. The image name is DS3f5e `weather.bmp`,336×192 below the16-pixel wooden title. Descriptor controls are null. Paint forwards to1db80 when its window/event gate permits. Event17 draws values and pictures, event18 updates the instruments, event22 initializes the animation clock. The button callback plays DS43e2 `click.voc` through23d56. It has no purchase, settings or weather-changing command. Native title Close/Escape requests that sample; broader original callback/audio arbitration remains unproven.

The Weather toolbar button and Windows-menu item now open this movable source-sized window. Speed retains its separate native slider, pause and Next day controls, with a compact weather summary. Edit remains fixed/maximized. Positions, animation phase and focus are React presentation state, absent from game saves. All captions, scale numbers, unit letters and Lo/Hi markers are real text. Import removes only black glyph pixels within the documented label rectangles, retaining other wallpaper/instrument pixels. Covered patterned background cannot be recovered from the glyph pixels; native fills them with matching gray, or white on the evaporation face. HTML font metrics replace the bitmap font without scaling artwork or introducing a mobile layout.

Drawing coordinates below are client coordinates (source calls include16 title pixels):

| Content | Position/size | Source |
|---|---|---|
|Current/next season icons|16,5 and304,5, each16×16|1dc73..1dce3, atlas200+season /200+((season+1)&3)|
|Week/month text|40,10|1dd95..1dde9, `Week %d of %s`, week+1 and four-byte month names at502a0|
|Season countdown|184,10|1ddec..1dea1, singular/plural source strings|
|Fahrenheit/Celsius values|24,48 and24,64|1dea4..1df36|
|Average rain/rain to date|304,48 and304,80|1dce6..1dd92|
|Wind speed/evaporation label|264,174 and16,174|1df39..1dfbf|
|Sky/ground scene|112,48 and112,80, each112×32|1dfc2..1e064|
|Thermometer column|72,36/8×44; bottom80|1e067..1e0a8|
|Rain column|248,36/8×55; bottom91|1e0ab..1e0e8|
|Five-day forecast|112+24×day,136, each16×16|1e0eb..1e13f, atlas204+weather code|
|Wind vane|272,104/32×32|1dbca..1dc0c|
|Evaporation needle|24,104/48×24|1dc0f..1dc40, fldgrph.til|

Sky and ground libraries each have a20-byte header, count4 at+18 and four1794-byte records: a2-byte1792 length followed by112×32 four-plane pixels. Resource names are DS3f9d `wethsky.btl` and DS3fa9 `wethgrnd.btl`; the source seeks22+index×1794 and reads1792 bytes. Sky codes0–3 select their matching scene; snow4 deliberately shares the rain scene3. Ground uses the stored calendar season. The forecast reads five consecutive bytes starting at the current day from DS4078; it includes today and crosses into the contiguous next-week array. Native uses the equivalent two seven-day snapshot arrays, without consuming RNG or predicting new weather.

Startup3fc4a..3fc5c loads1024 bytes of `wethvane.til` into2d9f:0024. Animation selects offsets24 or224, two512-byte32×32 planar frames. The evaporation needle uses the existing48×24 field-gauge library;4a196 reads signed frame index×576. Native imports both scene atlases and the vane with strict size/count/record checks. Existing shared field-gauge decoding remains unchanged.

## Display arithmetic and deliberate native bounds

Fahrenheit is signed DS43dc (`WeatherState.displayTemperature`). Celsius is the original arithmetic shift `(F−32)>>1`, an approximation rather than the physical5/9 conversion. Average rain sums48 weeks: it tests the selected precipitation-year entry at1dcfc, but adds the first-year entry at1dd03, then takes the unsigned wrapped-word sum>>2. Rain to date is the signed saved precipitation-day word at2412, arithmetic-shifted right2. Wind is signed DS4368. These source arithmetic quirks are retained and documented in SF-166; no climate, evaporation, rainfall counter or seasonal rule is altered by opening the window.

For zero-based week `month×4+week`, the countdown is10−week through week10,23−week for11–22,34−week for23–33,45−week for34–44, and47+10−week for45–47. The source thus displays0 at week10 and undercounts the winter/year wrap by one. Native preserves those computed values and the separately stored calendar season, including existing calendar-boundary quirks. The text remains an original display rather than a new season scheduler.

Temperature-column height is signed division F/3 truncated toward zero; rain-column height is the shifted signed rain count. Original drawing has no instrument-local clipping. Native clips heights to0..44/0..55 before drawing, preventing negative or very large saved values from overwriting the frame. Original numeric renderer8e8a clears and draws only the requested character count: several fields request two characters, so100 or negative three-digit values lose suffixes. Native shows complete computed numerals within the existing fields with bounded font sizing and accessible text.

Evaporation artwork index is15+(signed temperature>>5). Its label offset uses signed `(temperature & e3)>>2` into eight-byte entries at DS3fb6 (Slow, Slow, Average, Fast, Fast). Negative temperatures select unrelated gauge frames and strings preceding that table. Native clamps the temperature band to0..3 for these visuals. This indicator is temperature-based even though actual daily evaporation depends on wind and sky; it does not change those existing rules. Full original evidence and unresolved ordinary-game reachability are retained in [original-bugs.md](original-bugs.md#sf-166--weather-window-display-arithmetic-and-visual-bounds).

The source toggles vane phase when its pause byte permits and chooses timing through DS4086 indexed by signed wind>>3. Native preserves the two artwork frames and pause behavior, using a browser presentation interval `max(100,800/(1+max(0,wind)/8))` milliseconds while Weather is open. Hidden/paused windows do not animate; background tabs skip updates; timers are cleaned up on close/remount. This is explicitly a native animation choice. The user requested skipping original PC pacing; no DOS timer rate or delay table controls simulation speed. Native1× remains four seconds per full day.

## Hashes, checks and remaining work

| Resource/range | Bytes | SHA-256 |
|---|---:|---|
|weather.bmp|32264|109c54d3ebe5d7188c9b568051d09556229c8f7a5acc8fe88419b0f6307df569|
|wethsky.btl|7196|47cc417ab7854f8a464de88e9c42322ed7f8edba3f80212993c56b1434f27514|
|wethgrnd.btl|7196|b94bc32839743c1053df5671c20d8bb7d5379cfd6682c81eff3685066763c950|
|wethvane.til|1024|427c9aa6fb418899b5421f2030468b5299082910ab3f69b8f245bcc4fe9d281b|
|fldgrph.til|11520|f4f1e37a9465679781786d85d3b2d34b0e3e97757fb0c12bb53eef06a77a5fe6|
|1db80..1e1ad, Weather callbacks||f8e83a4d073f6fc504a79cb14680ec7bc78af99a24e59f4f1063ae1dea4e2b21|
|8e8a..8f29, bounded-character text renderer||2da07c78f17281839c1f0211c2fcf76811b864651f1cd72e116fa3e6e3122351|
|3fc4a..3fc60, vane load||b007cea7658a717b411117366adba872c76ad09ec53da1ea65067306a4d680cc|

Confidence is high for supplied resource formats, draw positions and numeric branches. This is static-byte evidence, not a captured original execution. Unit checks pin descriptors/code/data; compare all imported/source pixels outside text replacements; reject every truncated scene/vane input and corrupted record size; enumerate all calendar weeks across five climate years/eight farms, all signed temperature bytes and every rainfall word; and prove display reads leave saves unchanged. Browser checks compare source scene/gauge/forecast pixels, all season/sky combinations, complete text, movement/reopening, paused/running animation, native speed controls, nine-day rollover/save continuation and missing assets. Final regression results are in progress.md.

Original callback scheduling, stacking and sound arbitration remain incomplete; Weather restoration does not complete those systems or the full preservation project. Original Evaluation/Balance Sheet and other remaining dialog interactions follow. Raw resources and the supplied DOS distribution remain untouched.

## Native rebuild on shared chrome (2026-10-12)

Weather now uses the common wooden frame (`GameWindow framed`, per decision 3 in ui-components.md), with a 320×184 flex client. There is no full-window bitmap or canvas; `src/render/weather-preview.ts` was removed.
- **Wallpaper:** the importer writes `weather-wallpaper.png`, the 8×8 tile at bitmap (8,26). A unit test checks that it repeats across clean areas; isolated source irregularities (e.g. bitmap 55,43) are not reproduced. It is the client's repeating background, positioned so its phase matches the source.
- **Header:** two `SunkenInset` panels holding the season icon insets (tile sprites) and the calendar and countdown outputs.
- **Instruments:** the thermometer, picture window and sill, rain tube, evaporation dial and vane dial are sprites cut from the cleaned `weather-window.png`. Scenes, needle and vane frames are stacked inside them with grid layering, at their source client positions. The temperature and rain levels are palette-coloured spans inside white tracks of the source heights.
- **Text:** scale numbers and captions are HTML labels in flex columns. Value boxes, caption boxes and forecast cells are `SunkenInset`s.

Accepted differences:
- The thermometer sits 8px left and the rain tube 8px right of their source columns, so the HTML scales fit beside them. The shift is a multiple of 8 so the wallpaper inside the sprites stays in phase.
- The F/C reading boxes are 24px wide (source 32).

Tests: the browser spec checks structure (sprite offsets and positions, column geometry and colours, every erased label present as text, no img or canvas). Validation: weather-window unit 6/6, browser weather-window 7/7.
