# Independent native windows

Source: immutable SIMFARM.EXE SHA256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. All addresses below are hexadecimal file offsets. This reconstructs ordinary window coexistence, independent closing and title activation; it does not complete the original window manager or emulate DOS.

## Source evidence

The original manager stores a doubly linked window chain using descriptor far pointers at+44/+46 and+48/+4a (hexadecimal). Creation2a5bc..2a7f5 searches existing descriptors, allocates/copies106-byte descriptors and links nodes rather than discarding every existing window. The insertion branch2a753..2a7b4 writes the new node's next pointer, repairs the next node's previous pointer, and links the existing node to the new one. Flags influence insertion; not all flag-specific ordering policies have been reconstructed. Common title renderer2b09a uses tile1 for a null next pointer and tile237 otherwise, as documented in window-titlebars.md. This establishes simultaneous windows with distinct front/inactive title artwork.

Windows callback3e7b8..3ea9f checks each window's runtime pointer. Missing windows call24e6:1028 to create, then24e6:101e to bring it forward. Existing windows converge on3ea21, calling24e6:106e. Stub280ce selects overlay0:0b64/file2ac14, whose body unlinks the specified node, repairs neighbors, releases the descriptor and decrements the window count. It does not close all other windows. Thus choosing an already-open original window is a close toggle, not a raise request. The Edit toggle is deliberately overridden by the user's permanent-maximized-Edit requirement.

Pinned SHA256 ranges:

| File range (end exclusive) | SHA256 |
|---|---|
| 3e7b8..3eaa0 | f81c18c6282f011f536f10b30490ac7fdfd04e35eb5d40a12f75fd16b8acf89b |
| 2a5bc..2a7f6 | 07a89ac3da785fc8c5e393f9b8b88f0e78e29f0899f163c192ad4f52fb833025 |
| 2ac14..2ad6e | b2eaea3e9e49888a470af4cbde2dcbea95a300b2303023a3cf5381de6729358c |

Confidence is high for linked ownership, single-window removal and launcher toggle semantics from static instructions. Exact original pointer activation, special-window flags and depth controls are not claimed reconstructed by these ranges.

## Native ownership and behavior

WindowDesktop now owns an ordered list of open window keys in React presentation state. Opening a different ordinary window retains the others. Pointer/focus interaction raises that window; this is the explicit browser activation policy while original event routing remains incompletely traced. Its title uses the source light strip and other titles use the dark strip. Shared close controls and each original interior CLOSE button remove only their own window; closing the front focuses the revealed window's title unless another control or Edit has explicitly received focus. Positions survive closing/reopening; existing component selection/reset policies are retained. Map and Weather continue rendering while visible behind another window. Menu controls remain above the ordinary stack; mandatory modal dialogs retain the browser top layer and canonical simulation gates.

Windows menu commands toggle an existing original window closed. Toolbar commands close only the front window and raise a background window, as verified in the follow-up below; internal navigation can raise without toggling. Terrain now stays permanently behind dialogs with no Edit titlebar or window-stack entry; Return to Edit/map tools only focus it, as documented below. The right title end is now verified as decorative (see below); descriptor-specific insertion policies and complete source focus/audio timing remain incomplete.

Simulation ownership, commands, clocks, MIDI policy and v25 saves are unchanged. Window order/focus never enters a checkpoint. No new original-game defect was established. No mobile rearrangement is introduced.

## Validation

Source tests pin the dispatcher/creation/removal ranges, toggle stub, insertion and unlink writes. Browser tests exercise simultaneous moved Buy/Bank windows, retained catalog selection, exposed-title activation, original inactive artwork, independent interior close, Escape focus continuation, toggle commands, permanent Edit and unchanged full saves. Existing movement/titlebar/toolbar tests remain part of focused checks. Because visibility/focus is shared across the UI, a complete browser regression is required for this increment; results and any remaining gaps are recorded in progress.md. Full simulation regression is not repeated for presentation-only state.

## Windows menu open-state checks

The live Windows dropdown now marks every open original window, including windows behind the front one. Menu items use actual React text/check elements and menuitemcheckbox semantics, with source popup208,16,120,128. Edit remains checked and cannot be closed under the user's explicit permanent-workspace rule; choosing it invokes the existing native Return to Edit policy.

Source redraw2a126..2a39e checks each window's runtime far pointer, follows the corresponding item chain fromDSa70e, and ORs item flag bit0 at2a14f/2a181/2a1b7/2a1f1/2a231/2a275/2a2bd/2a309/2a359/2a39a. These are the ten menu entries in order. Close bookkeeping2a7f6..2ab45 nulls the matching runtime pointer and follows the item chain to the shared `AND ...fe` at2a890. Renderer3f3a2 tests that same bit. Native derives checks directly from the React open-window list rather than retaining a second mutable flag array. Simulation/save bytes remain unchanged.

SHA2562a126..2a39f(end exclusive): `b8b6757111f376fa2964aa67e15081d5b69189ba7e659d946ac9161692d6546c`;2a7f6..2ab46: `ae8a44da9da24b54b0ff80673b7a69f4d4cf88a8652e5694ebb99e08523f56db`. Confidence high for pointer/check synchronization from static source; no new original defect established. Tests pin the ranges and all ten setters, then verify simultaneous checks, title/menu closing, permanent Edit, exact geometry, keyboard navigation and unchanged saves. Original flag-specific insertion and exact callback timing remain incomplete; ordinary Edit activation is covered below.


## Toolbar activation correction

The earlier implementation overgeneralized the Windows menu callback to toolbar clicks. Resident input dispatch e8d2 checks toolbar y<48 and e8e7 computes column x>>5; e92a..e9bf resolves the nine corresponding runtime pointers. At e9e0..e9fc an existing descriptor is closed through24e6:106e only when its next far pointer+44/+46 is null (front). Otherwise ea0b..ea16 calls24e6:101e to raise it. Missing descriptors follow ea9e..ebff creation. This is distinct from the menu's unconditional existing-window close at3ea21.

Stub2807e/24e6:101e selects overlay0:0eec/file2af9c. The routine walks to the front descriptor, requires non-null previous/next neighbors, detaches the requested node at2b013..2b02f, appends it after the previous front at2b033..2b060, and clears its next pointer. It then sends callbacks1a/19. This confirms the routine is bring-to-front, correcting the earlier description as initialization. Source null/modal gates and special descriptor insertion remain separate research; ordinary native activation already uses React-owned order.

Native now carries the launcher origin through SaveControls to FarmView. Background toolbar activation changes only order and retains component selections/positions; it does not repeat opening/navigation resets. Front toolbar activation closes that window alone. Menu behavior, fixed Edit adaptation, canonical simulation and saves are unchanged. Confidence high for these ordinary toolbar semantics from the static input/reorder branches. No new original defect established.

SHA256 ranges (end exclusive): e8d2..ea19 `5cdf7c5576ad7ee88982e4bec8285301e29b580da51d77699cc289bd8bb60e1c`;2af9c..2b099 `ff0a666681b8ddc5583cd0cd5a988f7db28ad670b49d1916298c87caf9ea6ec2`. Source tests pin both branches/stub/link writes; browser checks alternate Buy/Bank toolbar activation, preserve Machinery selection/position, close front windows, retain menu toggles and compare complete saves.

Right titlebar art is separately verified at2b180..2b1cf: flag40 enables16-pixel tile2 when front and119 otherwise, placed at x+width−16,y. Its click action is **not yet established** by the bring-forward routine alone; no speculative depth button has been added. Follow-up should inspect remaining resident input branches and distinguish artwork from actual hit regions. Title drag stub24e6:105a resolves overlay9:0000/file35d00; that routine performs drag/clamp/snap, not the assumed depth toggle.


## Right title end: corrected interpretation (2026-10-11)

The earlier “right titlebar control”/depth-button hypothesis was wrong. Tiles2 and119 are beveled wooden end caps, confirmed by decoded source artwork and input dispatch. The renderer2b180..2b1cf draws them under flag40 at x+width−16, with the next-pointer null test choosing the active tile. Resident mouse handling computes local coordinates at ece4..ed0c. At ed0f..ed29, local x>16, local x<descriptor.x+width, local y<16 and flag20 go straight to drag stub24e6:105a at ed2f. The right16-pixel area is not excluded. For the ordinary nonnegative-position windows, clicking the cap therefore follows title dragging; there is no separate depth/zoom branch here. Overlay9:0000/file35d00 receives the window and grab coordinates, updates x/y, clamps below48 and within screen bounds, then snaps/redraws. Existing activation at ec77..ec80 raises a background descriptor separately.

Native now imports exact16×16 active/inactive end tiles and paints them as pointer-transparent CSS decoration on shared titlebars. They add no button, focus stop, resize or depth action. Custom artwork titlebars (Town) keep their own complete image. This corrects the backlog hypothesis rather than adding a new original-game bug. Source confidence is high for ordinary title hit regions/artwork; special window-manager flags remain incomplete; ordinary Edit activation is covered below. Browser movement/clamping remains the previously documented usability policy, not a claim of exact DOS drag snapping.

SHA256 ranges, end exclusive: ed0f..ed35 `b44bdc18d1c3f595f68e17679531c1ed30c887b67e5fe111fb18a4b8d0533ae4`;2b180..2b1cf `1bf0c51f137a3ec45c4b86d1e6765b3d8f26aa9edb896bf59b7c7d71f5a4bb49`. Source tests pin both branches and every imported tile pixel. Browser screenshots compare exact visible16×16 caps for both states, then drag through that region, verify activation/retained size/neighbor visibility and unchanged full saves. Scope does not include mobile adaptation or enhanced audiovisual assets.

## Permanent terrain background (2026-10-11)

Original toolbar tablee9ce selects offset0370/filee9a0 for column7/Edit; e9a4 reads DS13ae/13b0 before common ea0b..ea16 raises a background descriptor. Exposed-background activation ec77..ec80 uses the same bring-forward call. This evidence remains preserved, but the user explicitly superseded original Edit depth behavior: terrain must always be behind dialogs and must no longer be a window.

Native terrain therefore has no stack entry, titlebar, surrounding window border, close, move, resize or visibility operation. Its map/palette start directly below the48-pixel toolbar/menu area. Existing Edit toolbar/menu shortcuts focus the map and retain all floating windows. Their positions, contents and menu checks survive; clicking/focusing a floating window raises it among other dialogs. Map focus changes activation styling without changing dialog order or visibility. Only explicit Close/menu toggles remove a window; farm replacement resets presentation state.

Map-action handoffs (purchase placement, Plant/Spray, movement, construction, flight and Return to Edit) now focus this background instead of closing every dialog. Nested ordinary/modal dialogs do not bubble focus into map activation. Help/status text follow the palette up by16 pixels; attached Plant/Spray source coordinates remain fixed, removing only the obsolete frame compensation. Town and all floating titlebars retain their source artwork. This is the user's explicit native layout policy; exact original Edit depth/close behavior is intentionally excluded. Other special-window flags and audio/input timing remain incomplete. No simulation/save change or new original defect is claimed.

Help and Plant/Spray are transient palette popups above ordinary dialogs (z80), below forced windows (z90) and desktop menus (z100). This keeps their controls usable over retained windows without raising the terrain itself. Browser coverage deliberately places Bank under those popups and clicks through their real controls.
