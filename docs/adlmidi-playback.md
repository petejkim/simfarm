# MIDI playback with libadlmidi-js

The user's 2026-10-11 instruction supersedes the earlier non-FM music requirement: use `libadlmidi-js/light`, bank39 (AIL/SimFarm), and converted `.mid` files. This synthesizes OPL3 instruments in WebAssembly; it does not run SimFarm machine code or a DOS environment. Original PCM sound effects remain separate.

Dependency: libadlmidi-js2.2.0, pinned in package.json/bun.lock; packaged libADLMIDI1.6.2, upstream commit `ad001c83551779934bacd642fce801c51a5b7b4c`. [Upstream API, profiles and licensing](https://github.com/libadlmidi-js/libadlmidi-js) describes the light profile and LGPL-3.0 wrapper; upstream engine/component licensing is documented there. Dependencies, caches and tools remain local. Vite emits the light worklet and WASM as local assets, with no runtime CDN requests. Explicit `?url` imports work in development and production.

`MidiPlayer` initializes one AudioWorklet synth on the first audio gesture, waits for successful bank39 selection, then loads Standard MIDI bytes. Output passes through the existing volume control. Native source-condition music selection, persisted Music preference, mute cancellation and independent effects remain in their existing owners. `amain` disables looping and its worklet completion event starts `genfarm`; other tracks enable looping. Generation guards and serialized loads prevent stale asynchronous requests from starting replaced/muted tracks. Serialization is required because the package's `midiLoaded` replies have no request IDs.

`tools/import.ts` continues reproducible XMIDI conversion. Standard MIDI type0 uses60 PPQN and500000us/quarter, preserving the source120Hz timebase. Export adds `loopStart` and `loopEnd` sequencer markers from recovered loop metadata. The packaged engine recognizes genfarm's bounds as0 and7199/120seconds. Other source tracks have no internal loop descriptor. Raw source events/JSON and the old pure loop-window tests remain preservation evidence; the old oscillator renderer no longer drives playback.

The engine now owns note allocation, release tails and loop synthesis. Marker positions and audible looping are verified; sample-exact equivalence to the DOS MIDI driver, especially voices crossing loop boundaries, is not claimed. This intentionally replaces the previous custom per-voice scheduler with the requested MIDI-file synthesizer.

Validation includes rendering all eight supplied converted tracks through the actual light WASM core, checking the embedded bank39 name and exact recovered loop times, audible AudioWorklet output across repeats, mute silence, startup completion/cancellation, Options, situational tracks and pending-load cancellation. The production preview also exercises emitted worklet/WASM URLs. Gameplay/save schemas and original source files are unchanged.

## Bank 58 and mobile playback (2026-10-12)

The user chose embedded bank 58, "WOPL (The Fat Man 2op set; Win9x)", replacing bank 39 (AIL/SimFarm). `MUSIC_BANK` lives in `src/audio/music-bank.ts`. All eight converted tracks render through it, checked by `tests/adlmidi.test.ts`.

The user reported that music did not play on mobile. Three causes were addressed:
- **Unlock event.** Audio was unlocked only on `pointerdown` and `keydown`, with a one-shot latch. Per the HTML spec, a touch `pointerdown` is not an activation-triggering event; `pointerup` and `touchend` are. iOS WebKit follows this. Both players now listen on `pointerdown`, `pointerup`, `touchend`, `click` and `keydown`, in the capture phase (`ACTIVATION_EVENTS`, `src/audio/user-activation.ts`). They call `unlock()` synchronously on every activation event until the context is running, and a failed start clears the latch so the next tap retries. This also recovers contexts that iOS suspends after interruptions.
- **iOS unlock details.** `unlockAudioContext` sets `navigator.audioSession.type = 'playback'` where supported, so iOS 17+ plays music although the ringer switch is on silent. It also starts a one-sample silent buffer, which older iOS releases need.
- **No AudioWorklet.** AudioWorklet exists only in secure contexts (HTTPS or localhost), so a phone on a LAN `http://` address had no synthesizer. `MidiPlayer` now falls back to `AdlMidiCore` on the main thread: core loader and WASM through Vite `?url` imports, rendered into a 4096-frame `ScriptProcessorNode`. It has the same bank, loop and `amain`→`genfarm` end handling. The fallback costs main-thread CPU and may stutter on slow phones.

Sound effects (`PcmPlayer`/`useSound`) use the same unlock path.

The status line now reads "Playing <track> · MIDI · FM bank 58".

Validation:
- `tests/browser/mobile-audio.spec.ts` emulates a touch phone under a strict policy: contexts start suspended and `resume()` works only during user activation. It checks that a tap unlocks both contexts and plays music. Limitation: Chromium grants activation already on a touch `pointerdown`, so the spec cannot distinguish pointerdown-only unlocking. Playwright's WebKit was considered but not adopted.
- The spec also removes AudioWorklet and checks audible main-thread output with no worklet node.
- The user confirmed playback on their phone (2026-10-12).
