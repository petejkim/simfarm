# Original Farm Expert cards

Source `SIMFARM.EXE` SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are hexadecimal file offsets; initialized DS begins846f0. These findings come from static bytes/disassembly, without running DOS or x86 code. The native implementation interprets bounded resource records into React controls and artwork, not executable instructions.

## Window and card reader

DSbe9c has flags0061, position128,96 and400×240 outer dimensions. DSbe52 is `FARM EXPERT`; DSbe5e names `farmburo.bmp`. Its400×224 client contains no bitmap lettering. The title remains the shared16-pixel wooden strip with HTML text. Paint/button stubs24e6:146a/1474 resolve into overlay28 (base4c820) at4d22e/4d252. The latter is a no-op: this window creates its controls from card records instead of a descriptor control chain.

Loader4d25a formats DSc10d `card%d.hc`, opens the archive resource and copies its contents to DSbf06. DSc107 is the current page, initially1; c108 is the parser cursor; c10b/c10c count navigation/sound rectangles. Event17 reaches paint4c9f2. It clears the inner area to palette12 and dispatches through4d1ec. End-of-page resets the cursor. Event5 reaches primary-click4c858. Sound rectangles are checked first, then navigation rectangles; navigation plays DSbe6b `click.voc` at4c999. The target's low byte becomes the current page. Target255 closes and resets page1. Native uses HTML buttons and also resets to home on title Close/Escape; keyboard focus and bounds are browser presentation policies.

The43 supplied resources are cards1,2,5–8,10–37,40–48, totaling8351 bytes, with individual sizes85–464. Their links form a complete graph reachable from page1. No missing page is synthesized in the original chapter graph. Native import validates each source record; startup validates its predecoded commands in the shared [UI content bundle](ui-content.md).

| Opcode | Handler | Fields after opcode, little-endian words unless noted |
|---|---|---|
|83|4cb7c|x1,y1,x2,y2,target: clickable navigation rectangle|
|84|4cc2c|x,y,button frame,target:48×24 button|
|86|4ccfc|card index,x,y:112×64 `alltiles.btl` illustration|
|87|4cd86|x,y,width,NUL-terminated text|
|89|4ceca|crop slot,x,y:256-pixel-wide crop text|
|8a|4cf50|x1,y1,x2,y2,NUL-terminated sound filename|
|8b|4d03a|x,y:48×24 Close button, targetffff/low byteff|
|8c|4d0d8|x,y,width in tiles,height in tiles,first tile: sequential16×16 graphics|
|ff|4d206|Stop/reset parser|

Coordinates include the title: native client positions subtract16 from y. Source button frames3/13/14/15 read CANCEL/NEXT/PREV/CLOSE. Their bevel pixels match the existing caption-free48×24 message button outside its text mask. Native retains that bevel and renders captions as real text. `alltiles.btl` has a20-byte header and80 records of3586 bytes (two header bytes plus3584 planar bytes). Crop pictures0–15 come from the corresponding live crop's CRP0400..11ff image rather than the static library placeholder.

Illustration66 retains its original FARM BUREAU cap logo. At the user's explicit request, import preserves every original portrait pixel and React adds no lettering overlay or plain-color patch. This logo and About's SIMFARM logo are exceptions to the HTML-text policy. Raw library bytes remain untouched. Paragraphs use10px browser monospace text with10px line spacing to remain readable within the original rectangles; source glyphs use8-pixel pitch. No screen-dependent layout or artwork scaling is introduced.

Unused source operations80/85 are no-ops;81 loads a named bitmap,82 draws a text variant and88 draws a single normal/masked tile. Their full semantics are not required by any shipped card and are explicitly unsupported by the bounded native decoder. It rejects unknown opcodes instead of treating arbitrary bytes as instructions. The supplied sound filename is always `rooster.voc`; no arbitrary resource/path is accepted.

## Pages and text

Home1 links to Field Icon Index2, Crops10–25, Sprays26–29, Machinery30–37, Structures40–48 and Livestock5–8. Source picture positions are24/144/264 at y32/112. Category cards have a portrait at144,24, topic heading near y96, item image24,120 and description136,120. The portrait is a112×64 rooster-sound hotspot; its audio is conditional on the existing sound preference and independent of MIDI music. The field index reconstructs eight32×32 icons from pairs of two-tile strips, with actual-text explanations at the supplied positions.

Crop handler4cf23 calls24e6:13ca, resolving to46814. That routine seeks to CRP1600 at46884 and reads exactly0100 bytes at46899. This is a separate expert description from the128-byte short advice at1580 used by other screens. The previous interim guide combined the two. CropDefinition now exposes the bounded expert block independently. `description` is likewise bounded to the 128-byte advice block (0x1580–0x15ff), so Buy and Examine no longer repeat the Expert block (user request, 2026-10-13). The paragraph renderer8932 skips `@` and physical whitespace/padding, treats `~` as an explicit line break and backtick as an embedded space. Native text preserves the words and explicit breaks while browser font metrics handle wrapping. It does not reproduce bitmap glyphs. Source plurals “Sunflowers”/“Sweet Potatoes” remain even though definition names are singular.

All prose is retained as original advice, including prices, animal ages and care claims. Displayed advice is not proof of underlying simulation fidelity. No prose-driven farming rule or purchase command is added. Original malformed-resource/string hazards are retained in [original-bugs.md](original-bugs.md#sf-165--farm-expert-resource-and-string-boundaries-are-not-enforced).

The user's all24-crops policy extends the source crop chapter: page25 gains Next, and native pages64–71 copy card11's layout for slots16–23. Previous/Next form one24-crop chain, with the final Previous button at288,200 as on source page25. All other supplied pages/layouts remain source-backed. Raw cards are never rewritten. Page/position/focus/sound requests are presentation state, absent from saves; crop order and identities come from the plain-TypeScript simulation snapshot. Selecting a field no longer changes an unrelated global guide dropdown. That interim dropdown and raw tile-debug panel are retired.

## Evidence and verification

| Byte range/resource | SHA-256 |
|---|---|
|4c820..4d2bd, Expert dispatch/parser/loader|75e712e963e9f747bb4ad1104daa47111f13eb3a734c6132c1e89a8e50b38490|
|46814..468c0, crop expert text reader|5913c8d1db596f5471e3799aa01db9eac76eeb31c109c9e13062592920145922|
|8932..8a4b, paragraph renderer|e756369c3d98fc49476c7b0b15b7765b683fadd1da802bd7f71ebfffd7e9e34a|
|43 card files concatenated in ascending numeric order|52aca80ac8d649e09446a7368ee6360f9d89c109a2bc942a7a521d37c25cfdfc|
|farmburo.bmp,44808 bytes|f83003044612a61cf22a6b1cec08f6c2287a32ae1d841cd603bf993f51f4fc6f|
|buttons.til,10368 bytes|326c56476dc871cfd583b89d23b8c8b085463884ea25b5c0985a0fe44976cfb2|
|alltiles.btl,286900 bytes|f77032c6726cc13c38adf15082c59babf0573724a8a0a01dc7a61d866e4dd502|

Source evidence is high confidence for the supplied opcodes, positions, links, text blocks and sound callbacks. Browser wrapping, standard exclusive right/bottom hit boundaries, keyboard focus, close policy and extra eight crop pages are explicit native adaptations. Original sound arbitration, unused opcode behavior and the wider window manager remain incomplete. Other original dialog interiors and preservation of all game systems are still pending.

Tests pin source ranges, source/imported pixels and captions; traverse the complete43-page graph; reject every truncated source prefix, malformed coordinate/target/string and excessive control count; verify16–24 crop-chain boundaries without altering the original deck; and read all24 CRP expert blocks. Browser coverage checks source geometry, static chapters and icon/illustration pixels, all24 crop photographs and actual text, forward/back navigation, keyboard/movement/reopening, save equality, enabled/muted/failed PCM and startup resource failures. Final results are recorded in progress.md.

## Native rebuild on shared chrome (2026-10-12)

`farmburo.bmp` holds only the frame and a plain face, so Farm Expert now uses the common frame around a 384×216 client, and the full-window bitmap and `src/render/expert-artwork.ts` canvas were removed.
- **Placement:** card commands are positional source data, so each element is placed at its recorded coordinates less the 8px frame and 16px title. This is the one deliberate exception to the flex-layout rule.
- **Pictures:** `buy-cards.png` cards and crop photos are `Sprite`s.
- **Tile strips:** grids of `TileSprite`s.
- **Captions:** NEXT, PREV, CANCEL and CLOSE are 48×24 `BevelButton`s, the same bevel as `message-button.png`.
- **Unchanged:** text stays HTML, and topic and rooster links stay transparent hotspots. The portrait keeps its bitmap FARM BUREAU cap.

Absolute screen positions of hotspots, pictures and tile strips are unchanged. The browser spec checks them structurally (sprite offsets and boxes). Validation: expert specs pass (4/4).
