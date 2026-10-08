# Livestock input and PCM audio

Source: unchanged SIMFARM.EXE, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are file offsets; initialized6190 data begins at0x846f0. This work uses static analysis and source assets, with no DOS execution.

## Pointer coordinates and steering

Animal movement0x11f76 reads the current window pointer at6190:13ae. With a window,0x11f88..0x12029 tests the pointer against its interior bounds and permits window types0/11. Conversion0x1202b..0x12067 subtracts window origin and interior offsets, arithmetic-shifts by4, then adds the window's map origin at+50/+52. This is a tile coordinate, not a click target. At0x120f5 squared distance strictly below50 selects the away-direction table atDS22e8. Countdown, water and food seeking have higher priority, as already reconstructed.

The absent-window branch0x1206e initializes both coordinate locals to0. The existing-window/outside-interior and unsupported-window branches instead reach0x12076 without assigning those locals; the function's prologue also does not initialize them. SF-108 records this undefined stack input. Native pointer absence uses the defined(0,0) fallback in all cases. SF-100's equal-tile direction correction remains in force.

GameSimulation owns a copied, validated `set-map-pointer` input. It does not advance time or publish a snapshot for pointer motion. Input is external to checkpoints: a restored farm starts with no pointer, and deterministic continuation requires the same subsequent input sequence. Pointer updates/clearing remain possible during paused/modal states, which still suspend simulation work.

FarmMap converts client coordinates with its actual canvas bounds and zoom. Canvas pointer motion supplies map coordinates; scrolling, zoom, resize and panel layout recompute them. Pointer exit/cancellation, touch release, window blur, hidden documents and unmount clear them. React keeps only the DOM coordinate/ref integration; simulation owns the gameplay input. Selecting a field or placing an object remains a separate command.

## Verified vocal requests

Vocal helper0x135f8 dispatches types160..163. Initialized strings atDS2340/2322/232c/2334 are `horse1.voc`, `cow%d.voc`, `pig.voc`, `sheep%d.voc`. Cow/sheep choose1/2 with one visual RNG draw, irrespective of whether audio is enabled. The calls at0x13635 enter212a:08b6 =0x23d56, which checks audio flags, consults driver status, loads/reuses the named sample and calls the original playback interface. Native playback uses decoded PCM and Web Audio; it does not invoke that DOS driver.

Live requests now reach the existing transient GameEvent subscription after completed simulation phases: weekly age at0xc16b and collision recovery at0x11c3c. Saving/loading does not replay a request. Background music continues through the separate MIDI path. Need-related death has no recovered vocal call: its argument6 is a report-counter increment, corrected and documented in [livestock.md](livestock.md).

All six archive members have a26-byte Creative Voice header, one type1 codec0 unsigned mono PCM block and a terminator. Samples are converted as(byte−128)/128; sample rate is1000000/(256−rateByte).

| Member | MEGADATA.EEA offset | Bytes | Samples | Rate byte | SHA-256 |
| --- | ---: | ---: | ---: | ---: | --- |
| cow1.voc | 2046848 | 7901 | 7868 | 75 | `3cb705ffd984e36a03ae6e3702af7e2942abe18cd9b71872a008e433b3b20e95` |
| cow2.voc | 2054749 | 8243 | 8210 | 75 | `9b1a384ca0fed18494a9c880cc6ecd3248dfe85b50b924d29f04f3367557e946` |
| sheep1.voc | 2075873 | 6489 | 6456 | 166 | `d7a093603e91aa73f5f9cd1c1eec165d8bd675913bacafdef119174752ec8dc5` |
| sheep2.voc | 2082362 | 11252 | 11219 | 166 | `801f9e35392e327e0fe0d746dd9c6718cd4d7399f6918115aff193f629be7365` |
| horse1.voc | 2116492 | 8333 | 8300 | 75 | `82925dd4a69bb81ea8d1b98e7712b8bba776e27786ab658b74122c12080843f6` |
| pig.voc | 2124825 | 5237 | 5204 | 166 | `2b37747e7efebe87df9e90a154bd0ae8ec89f36271b71b962b3ad95c5f4109ee` |

The reproducible importer already extracts these ignored resources. No new installation or tracked original assets are needed. Enable sounds opts into effects independently of music. The existing native player replaces the previous request and cancels an in-flight fetch; muting cancels playback. Exact original driver-status semantics at0x23d7d, concurrent request arbitration, caching and cross-farm playback lifetime remain presentation fidelity gaps. This increment does not claim full original sound priority/timing.

## Checks

Unit tests pin pointer conversion/distance instructions, cloned/bounded transient input, source resource priority, all four collision vocal branches, weekly source RNG scheduling, detached events, muted-equivalent saved continuation and silent death/report posting. PCM tests fingerprint all six resources, compare every sample and reject truncated boundaries. Two browser flows verify actual hover/zoom/scroll/exit/blur behavior against complete native saves, audible weekly cow PCM, playback of all six variants, mute equivalence and missing-asset recovery. Existing MIDI/homestead and save tests remain regression gates.
