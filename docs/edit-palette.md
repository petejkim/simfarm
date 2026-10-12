# Original Edit palette asset

## Source artwork and confidence

`editeasy.lzs` is in MEGADATA.EEA at1716591, size2225, SHA-256 `fa398c509ed630a9d9f21197e47cde2e102291e7954d1f489ef39cb8ec55d84b`. EXE3fdc1..3fdd4 reads the filename at6190:a9b9 through24e6:138e;3fde8..3fdf3 links descriptor562a to5614. Stub138e resolves to overlay25:1bd4/file4a294. That routine allocates and reads the compressed resource; it is not itself the decompressor. The EXE hash and original Windows descriptor evidence are retained in [control-bar.md](control-bar.md).

A standard LZSS decode with4096 zero-initialized ring bytes, initial write index4078, low flag bit first, twelve-bit reference offset and length nibble+3 yields exactly5000 bytes, with bitmap header `06 00 d0 00 04 00 01 00` and48×208 four-plane pixels. Visual inspection coherently resolves every tool and caption. Format confidence is high for this supplied asset; equivalence to all branches/initialization/bounds of the original decompressor is not yet established. `decodeEditPalette` is deliberately bounded to this asset's expected output, rejects trailing data and truncation, and checks output growth on every byte. Do not claim the native bounds checks reproduce the original routine or constitute evidence of an original vulnerability.

Import preserves the source resource and writes ignored `edit-palette.png`. It removes only three caption interiors (x4..43, twelve rows starting at148,172,192), replacing them with gameplay palette12. All other pixels, including the tool pictograms and outer bevels, remain unchanged. Plant, Spray and the Help question mark are React text. The original `buttons.til` caption atlas is not displayed.


## Component reconstruction (2026-10-11)

User request: rebuild the palette like the control strip. `EditPalette` now composes `EditToolButton` and `EditCaptionButton` in a flex-wrap column; nothing is absolutely positioned and no full-palette `<img>` remains. Geometry measured from the decoded bitmap (local pixels):

| Element | Source pixels | Native construction |
| --- | --- | --- |
| Tool cell i (0..11) | (24·(i%2), 24·⌊i/2⌋) 24×24: black only on top row/left column; 2px raised bevel (white top/left, grey130 bottom/right); 19×19 face at +3,+3 | `<button>` black background behind 1px top/left padding; face with 2px CSS bevel and `edit-palette.png` sprite at background-position(-(24c+3), -(24r+3)), `image-rendering:pixelated` |
| Plant / Spray / ? | Full-width cells at y144/166/188, heights 22/22/16, plain grey faces with lettering | Same cell construction; real HTML captions |
| Foot | Row204 black across 48; rows205..207 black at x0, grey elsewhere | 48×4 span with black top/left borders |

The palette's right edge (x47) has no black frame in the source; the neighbouring cell's black is the separator between cells. The previous native hit regions (Plant top144/h24, Spray top168/h22, ? top190/h18) did not match the source cells and now follow them. Disabled tools overlay the face with translucent grey (previous native look); pressed cells swap bevel colours on `:active` as a native affordance. The ? caption erasure was narrowed from rows192..203 to the face rows191..201, so it no longer overwrites bevel rows 202..203 in the imported PNG.

Validation was structural only, at the user's request (no pixel-diff tests): browser tests check cell bounds, black backgrounds, padding, sprite offsets, pixelated rendering, captions and pressed state. The old dashboard `box-shadow` on the terrain panel faintly darkened the palette and strip; it is now `none` inside the game desktop.
