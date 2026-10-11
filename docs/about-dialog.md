# About dialog

Source executable SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`; initialized DS6190 starts at file846f0. File handler3eb9c creates DSa452. Descriptor begins1061,0,96,96,400,240: original position96,96 and400×240 outer dimensions, including16-pixel titlebar. DSa3c0 title is ABOUT, a3c6 names about.bmp, a3d0 names lzrdlogo.bmp. Callback stubs12f8/1302 resolve through overlay17(base3dc50) to3e13f/3e170. Paint dispatch ultimately calls3dc50. Evidence is static; no DOS runtime capture or execution.

Original archive members, unchanged:

| Member | Bytes | SHA256 |
| --- | ---: | --- |
| about.bmp |44808|abdb074afbf560d99f0452387a87b7edf7a31f40e87eeeefb89899169919f805|
| lzrdlogo.bmp |5832|99552faeaf5bd38a1592b62081554881870d16f9578d03cf70aa65fce4a44c98|
| creditz.txt |2517|36855786d3cb12c28a17175cabff93dd983ffa2e42c51438de50163a82b67e6d|

about.bmp is400×224 client artwork. Preserve its wood frame, banner and fruit illustration. Import masks the bitmap SIMFARM lettering and entire registration label; the user explicitly requested omitting the registered-owner line. Do not decode or display the owner. Replace SIMFARM and both logo caption lines with HTML. Keep the104×112 lizard artwork, masking its caption rows90..111. Replacement font metrics and the cleaned banner background are native approximations, not pixel-identical original glyphs.

Intro strings DSa3dd..a43e are Concept / Programming / And / Design / By / Eric Albers / Leaping Lizard / Software, preserving source leading spaces. Draw calls3ddc4..3df68 place them at window x144,y88 with9-pixel pitch; logo3dd9a..3ddbc atx264,y80. Subtract16 for client coordinates. The following state clears the logo region3dfa1 and starts reading creditz.txt, named DSa43e. 3e026 bounds pages to12 lines;3e060..3e09a draws them at the same text origin,8-pixel pitch. Backtick at3e041 terminates the credits and later returns to the intro. Supplied file includes leading/blank lines, names and the music/sound-library attribution; retain them as text, not bitmap pixels.

Native React presentation uses8seconds for the introductory page and6seconds per twelve-line credits page, then repeats. Original source delays512(3df90) and384(3e0bc/3e0e1) establish relative phases; exact interrupt timing is intentionally not ported under the user's pacing direction. Presentation does not own/change simulation state. Shared movable wooden titlebar provides close, Escape and keyboard movement. About is a native modal, matching the previous File-dialog input policy; exact original window/pause nesting remains unverified.

Import is reproducible with `./tools/bun run import`; generated assets remain ignored. Credits parsing rejects missing sentinel, invalid bytes, oversized input and lines beyond79 characters instead of relying on source stream state. Tests pin descriptor/intro/12-line boundary and member hashes, verify mask pixels and unchanged inputs, and exercise truncated/wrong-size artwork. Browser checks cover original1× geometry, HTML title/credits, omitted registration, credit cycling/bounds, movement and reopening/close. SF-175 records a separate source registration-decoder hazard; no native owner decoder is implemented.
