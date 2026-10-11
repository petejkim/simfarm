# Original Options dropdown

Source is immutable SIMFARM.EXE, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. All addresses below are hexadecimal file offsets unless explicitly marked DS. Static disassembly only; no original instructions or DOS environment execute in the browser.

## Verified menu and commands

Initialized descriptor DSa7f2 gives header64,0,56,16 and popup64,16,120,100. Its eight linked items have12-pixel row pitch. The native menu uses those coordinates, actual React labels and accessible checked menu items. Keyboard arrows/Home/End, Enter/Space, Escape and outside click are browser interactions. Artwork remains1× and Edit remains fixed. See [main-menus.md](main-menus.md) for the descriptor/node decoder.

Manager stub24e6:130c/file2836c selects overlay18:06f0/file3eaa0. Table3eb76 dispatches eight indexes;3eb1c copies each resulting runtime byte into the corresponding item's+12 check byte.

| Entry | Branch | Runtime byte | Native action |
| --- | --- | --- | --- |
| Music |3eab0|5741|Toggle browser MIDI; enabling selects genfarm|
| Sound Effects |3eb02|5742|Toggle existing PCM playback|
| AutoBuy |3eb26|DSa89c|Enable automatic seed/chemical buying|
| AutoScroll |3eb30|DSa89e|Enable map edge scrolling|
| AutoDoze |3eb3a|DSa89f|Enable existing automatic terrain clearing|
| AutoGoto |3eb44|DS0189|Center Edit on a newly started tornado/locust swarm|
| Messages |3eb54|DSa8a1|Allow optional notices|
| AutoLease |3eb5e|DSa89d|Enable automatic equipment rental|

Music checks capability1522, XORs5741 at3eac3 and enables DSa8a2 `genfarm.xmi` through212a:0682 at3eaf8. Sound checks5743 and XORs5742 at3eb12. The original hardware capability bytes do not govern Web Audio. Audio begins off until a user gesture, remains browser presentation state and is never synthesized as DOS hardware. Menu checks reflect actual native playback/enabled state, including failures. Advanced track selection, volume, sound error reporting and interim tools remain available through Edit tools → Audio and tools. No extra entries are added to the original eight-row dropdown.

## AutoScroll and AutoGoto

AutoScroll c6a0..c88d first tests DSa89e and Edit descriptor13ae/13b0. It reads pointer171b/171d, moves descriptor tile origin+50/+52 by two cells at screen edges, clamps to96 minus the visible tile count, marks redraw and notifies related windows. Left/top require coordinate zero; right/bottom compare against display dimension minus17. Native applies corresponding edges to the actual Edit viewport, with a one-pixel left/top tolerance and a16-pixel right/bottom band. It moves two16px tiles every200ms while the cursor remains over unobscured terrain. This explicit browser cadence replaces CPU-dependent polling; it is unrelated to the user's four-second game day. It stops over menus/dialogs, outside the map, on blur/hidden document, during flight and pending decisions. Native scroll bounds handle an oversized viewport safely. Manual scrolling/arrows remain available when disabled.

AutoGoto3696b..369a6 tests DS0189 and centers descriptor origins on tornado699c/699e minus half the visible map dimensions. Swarm36c7d..36cd2 similarly uses the selected field's original x/y bytes at243c/243d. These are start actions, not continuous following. Native emits one transient map-focus event only after a successful canonical start. React receives the coordinates; viewport placement stays out of checkpoints and no event replays on load/snapshot reads. It is independent of optional Messages. The interim disaster Locate buttons have been retired; original Map/terrain navigation can revisit locations. Aircraft-follow controls retain their separate behavior.

## Preferences and checkpoints

Loader4625e..463ee performs seventeen single-byte reads after tax countdown2172a. Saved runtime preferences are Messages21733, AutoGoto21735, AutoDoze21737, AutoScroll21739 and AutoBuy2173b, alternating with menu check bytes. AutoLease is21731. Earlier AutoScroll21716 is overwritten by the later21739 read: native honors the final value. All eight supplied scenarios enable Messages/AutoScroll; scenarios0/4/5/7 enable AutoGoto. Initialized new-farm defaults are AutoScroll/Messages on, AutoGoto off. Restart40691 clears AutoGoto;40757/40767 enable AutoScroll/Messages. These values now participate in the existing setup/reset paths.

Checkpoint v25 persists the three newly recovered boolean preferences alongside the existing AutoBuy/AutoDoze/AutoLease fields. It supports both16-slot research simulations and24-slot playable farms, retaining catalog validation. Versions1–24 migrate from retained source SSM bytes when present, or verified generated-farm defaults. V25 rejects missing/nonboolean preferences. Original source bytes, duplicated check bytes and all unknown fields remain preserved unchanged; live native checks derive from canonical booleans. Noncanonical source preference bytes normalize by nonzero, with the SF-170 correction documented separately.

The generic set-option command belongs to GameSimulation, validates its key/value and changes only that preference. It remains usable when farm actions are suspended; it does not advance days, mutate RNG, charge funds or replay events. Existing seed/chemical purchase, lease and clearing rules consume the same canonical fields as before. Audio and map positions remain presentation state.

## Messages scope and remaining work

Dispatcher30220 rejects IDs below128 when DSa8a1 is zero; IDs>=128 bypass the preference. Native optional financial36/39 now follow this gate; mandatory159/161/162/163/165/166/168/169/170 always remain eligible. Existing disaster start/end notice presentation also follows Messages. Disabling Messages does not cancel an already-visible dialog or alter a debt transaction, random draw, sound or AutoGoto action. The source optional3c0 animation-tick cooldown remains deferred, rather than imposing an invented wall-clock notification delay. Other original event popup interiors, event scheduling and exact suspension midway through a financial call remain unfinished. Restoring this menu does not establish complete game fidelity.

## Source hashes and checks

| Range, end exclusive | SHA-256 |
| --- | --- |
|3eaa0..3eb88|473ec9c1d21d0b9e311f52f483d6e85b0acde49fa2dc50e108b309d7d70b5b49|
|c6a0..c88e|374ec9a0d17eb934fa10ef6fe5eb0d4b8b1b9a3f6600341d780284efcfba4dec|
|3696b..369a7|8f4198129705295f3c0366e4968c3e7e7ebe025abdc661288e36a5ae53514f26|
|36c7d..36cd3|1099953899796748c19c43e6168f1c1e3744b2022a1a71f619eb5a45269d9ab9|
|4625e..463f6|e2d868c6e3ad0bb1f3b04e34720113793f4a210ada84a69e687cdb5c70823e27|
|4067d..40773|e43990964afd225452cb76e9e7866eeea84c6e0bc5ef6031852d0d388d8af579|

Confidence high for dispatch, preferences, final loader precedence and disaster start coordinates. Browser scrolling cadence, audio consent and keyboard behavior are explicit native policies. Unit checks pin source instructions/strings, loader destination sequence, all256 source-byte values, truncated boundaries, v25 validation/migration, actual seed/rental outcomes, mandatory/optional financial outcomes, event ordering and no replay. Browser checks cover all eight real-text rows, geometry/checks/keyboard, exact saved continuation, edge scrolling/on-off/manual controls, AutoGoto on/off, financial filtering and genfarm MIDI/PCM access. Reviewed artifacts/browser-options.png at1×.


## User-requested defaults and remembered choices (2026-10-11)

Correction4 supersedes the earlier default-off audio policy. Music and Sound Effects default enabled; playback is activated by the first pointer/key gesture. MIDI defaults to genfarm, with AudioContext created/resumed during that gesture before asynchronous asset loading. Enabled intent is separate from playing/loading/error status; waiting for browser activation is not an unchecked option. Muting cancels pending loads/stops voices. React development effect cleanup restores sound intent on remount rather than silently disabling the default. Pagehide suspends playback without changing stored intent.

Browser key simfarm.options.v1 stores explicitly chosen booleans for all eight Options entries. Unknown/nonboolean fields and malformed values are ignored; denied storage does not prevent current-session controls. The six gameplay choices remain canonical GameSimulation fields, applied by set-option commands when starting the default scenario or accepting a new custom/geographic farm. Explicit checkpoint/original-file loads retain their saved gameplay choices; browser music/effects preferences remain independent. This is a user-requested browser preference layer, not a reconstruction of DOS configuration files. Default values for never-chosen gameplay entries still come from the source scenario/setup.

Focused checks cover all eight persisted checks after refresh, explicit-save authority, accepted custom terrain preferences, invalid/blocked storage, default MIDI, independent mute, actual MIDI/PCM output, cancellation and aircraft engine lifecycle. Older audio regression cases explicitly seed muted preferences because they test enabling/disabled behavior; default-on coverage lives in options.spec.ts. No new original defect, save-schema change or simulation ownership migration.
