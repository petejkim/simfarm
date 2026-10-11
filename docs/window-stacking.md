# Independent native windows

Source: immutable SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. All addresses below are hexadecimal file offsets. This reconstructs ordinary window coexistence, independent closing and title activation; it does not complete the original window manager or emulate DOS.

## Source evidence

The original manager stores a doubly linked window chain using descriptor far pointers at+44/+46 and+48/+4a (hexadecimal). Creation2a5bc..2a7f5 searches existing descriptors, allocates/copies106-byte descriptors and links nodes rather than discarding every existing window. The insertion branch2a753..2a7b4 writes the new node's next pointer, repairs the next node's previous pointer, and links the existing node to the new one. Flags influence insertion; not all flag-specific ordering policies have been reconstructed. Common title renderer2b09a uses tile1 for a null next pointer and tile237 otherwise, as documented in window-titlebars.md. This establishes simultaneous windows with distinct front/inactive title artwork.

Windows callback3e7b8..3ea9f checks each window's runtime pointer. Missing windows call24e6:1028 to create, then24e6:101e to initialize. Existing windows converge on3ea21, calling24e6:106e. Stub280ce selects overlay0:0b64/file2ac14, whose body unlinks the specified node, repairs neighbors, releases the descriptor and decrements the window count. It does not close all other windows. Thus choosing an already-open original window is a close toggle, not a raise request. The Edit toggle is deliberately overridden by the user's permanent-maximized-Edit requirement.

Pinned SHA256 ranges:

| File range (end exclusive) | SHA256 |
|---|---|
| 3e7b8..3eaa0 | f81c18c6282f011f536f10b30490ac7fdfd04e35eb5d40a12f75fd16b8acf89b |
| 2a5bc..2a7f6 | 07a89ac3da785fc8c5e393f9b8b88f0e78e29f0899f163c192ad4f52fb833025 |
| 2ac14..2ad6e | b2eaea3e9e49888a470af4cbde2dcbea95a300b2303023a3cf5381de6729358c |

Confidence is high for linked ownership, single-window removal and launcher toggle semantics from static instructions. Exact original pointer activation, special-window flags and depth controls are not claimed reconstructed by these ranges.

## Native ownership and behavior

WindowDesktop now owns an ordered list of open window keys in React presentation state. Opening a different ordinary window retains the others. Pointer/focus interaction raises that window; this is the explicit browser activation policy while original event routing remains incompletely traced. Its title uses the source light strip and other titles use the dark strip. Shared close controls and each original interior CLOSE button remove only their own window; closing the front focuses the revealed window's title unless another control or Edit has explicitly received focus. Positions survive closing/reopening; existing component selection/reset policies are retained. Map and Weather continue rendering while visible behind another window. Menu controls remain above the ordinary stack; mandatory modal dialogs retain the browser top layer and canonical simulation gates.

Toolbar/Windows commands toggle an existing original window closed, while internal navigation can raise it without toggling. Edit stays fixed/maximized with no movement/close/resize controls. Explicit Return to Edit and map-tool activation retain the prior native clearing of floating windows, rather than a fully reconstructed original Edit depth operation. This is a known remaining fidelity gap; restoring it requires tracing original Edit activation with the user's permanent-window constraint. Window checkmarks, original right-side depth/zoom controls, descriptor-specific insertion policies and complete source focus/audio timing also remain incomplete.

Simulation ownership, commands, clocks, MIDI policy and v25 saves are unchanged. Window order/focus never enters a checkpoint. No new original-game defect was established. No mobile rearrangement is introduced.

## Validation

Source tests pin the dispatcher/creation/removal ranges, toggle stub, insertion and unlink writes. Browser tests exercise simultaneous moved Buy/Bank windows, retained catalog selection, exposed-title activation, original inactive artwork, independent interior close, Escape focus continuation, toggle commands, permanent Edit and unchanged full saves. Existing movement/titlebar/toolbar tests remain part of focused checks. Because visibility/focus is shared across the UI, a complete browser regression is required for this increment; results and any remaining gaps are recorded in progress.md. Full simulation regression is not repeated for presentation-only state.
