# Original Edit palette asset

## Source artwork and confidence

`editeasy.lzs` is in MEGADATA.EEA at1716591, size2225, SHA-256 `fa398c509ed630a9d9f21197e47cde2e102291e7954d1f489ef39cb8ec55d84b`. EXE3fdc1..3fdd4 reads the filename at6190:a9b9 through24e6:138e;3fde8..3fdf3 links descriptor562a to5614. Stub138e resolves to overlay25:1bd4/file4a294. That routine allocates and reads the compressed resource; it is not itself the decompressor. The EXE hash and original Windows descriptor evidence are retained in [control-bar.md](control-bar.md).

A standard LZSS decode with4096 zero-initialized ring bytes, initial write index4078, low flag bit first, twelve-bit reference offset and length nibble+3 yields exactly5000 bytes, with bitmap header `06 00 d0 00 04 00 01 00` and48×208 four-plane pixels. Visual inspection coherently resolves every tool and caption. Format confidence is high for this supplied asset; equivalence to all branches/initialization/bounds of the original decompressor is not yet established. `decodeEditPalette` is deliberately bounded to this asset's expected output, rejects trailing data and truncation, and checks output growth on every byte. Do not claim the native bounds checks reproduce the original routine or constitute evidence of an original vulnerability.

Import preserves the source resource and writes ignored `edit-palette.png`. It removes only three caption interiors (x4..43, twelve rows starting at148,172,192), replacing them with gameplay palette12. All other pixels, including the tool pictograms and outer bevels, remain unchanged. Plant, Spray and the Help question mark are React text. The original `buttons.til` caption atlas is not displayed.

