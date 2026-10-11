# Original Edit help legend

The palette “?” now shows the original88×200 legend beside the tools. Its15 captions are actual HTML text; the source border and leader lines are retained at1×. Advanced controls remain accessible below the legend as an explicit native addition.

## Evidence

Immutable SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Palette callback214f0 decrements the item ID at22344 and indexes table22352. ID30 selects2228e using resident segment base1f950. Range2228e..22344 (end exclusive) SHA256 `00373787bcd8265137f29796845b077ab31fc6d42afd95e9b7dc6a7bb18d938d`.

The branch unchecks the control, pushes DS5729=`edithelp.bmp` at222ad, and loads through24e6:0f92. At222cf..222de it reads Edit window y/x, adds16/48 respectively, and calls0416:0849 to display the bitmap. The loop222ec..222f6 waits while primary button bit0 at1721 remains set. After release,222fb sets window mode2;22301..22307 assigns the cursor pointer and subsequent stores restore16-pixel/1×1 cursor dimensions. This is a held-button legend, not a separate source document window or a menu of field actions. Confidence high on these instructions.

Archive member `edithelp.bmp`: offset268488, length8808, SHA256 `3316d1a47b2def6d5840111d68cc251ccea7d179084010b1fb635f64b582e2b5`. Header encodes11 byte-columns,200 rows, four bitplanes and one image. Source captions are transcribed from the decoded artwork at x20 with top y4,12,28,36,52,60,76,84,100,108,124,132,156,164,188. They name Move/View Object, both roads, fence/gate, ditch/valve, hay/trough, trees/bulldoze, Field Functions and Help. The artwork's field-functions bracket groups Plant and Spray; no additional immediate field command is established by this legend.

The importer validates88×200 and writes ignored edit-help.png. Clearing x19..86/y2..197 with palette12 removes the bitmap lettering. All other pixels remain identical; supplied files are never written. React renders the15 caption lines at their source positions with a compact browser font. Glyph shapes are not claimed pixel-identical.

## Native interactions and limits

Edit remains fixed at screen y48, so the legend begins48,64; CSS compensates for the2-pixel Edit border. It is an attached popup, like Plant/Spray, not a movable floating window. Browser activation toggles it instead of requiring a held button. Escape returns focus to “?”; another click, an outside pointer press or selection of a palette tool dismisses it. Opening cancels active movement/placement/painting drafts and closes other panels without issuing simulation commands. The advanced category remains selected for compatibility with its existing controls. AutoScroll is suppressed while help is visible.

The Advanced controls button beneath the original200-pixel image opens the existing interim tools panel. It is not source artwork or a recovered original command. No small-screen layout change, simulation/save schema, MIDI or pacing change is included. The browser legend does not pause simulation or reproduce the source synchronous button-wait loop. Remaining original sound/cursor/window lifecycle work is still incomplete.

## Focused validation

Tests pin source ID/table mapping, filename, coordinates and button-wait bytes. Decoder checks cover all8808 truncation points, malformed dimensions and exact retained/cleared pixels without source mutation. Browser checks cover original geometry and leader pixels, real text, keyboard focus, Escape/toggle/outside dismissal, advanced access, tool cancellation, unchanged checkpoints and missing-asset failure. Related Edit workspace, Options and Plant/Spray flows remain covered. See progress.md for results and rechecks.
