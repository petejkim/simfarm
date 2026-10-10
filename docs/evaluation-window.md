# Original Evaluation window

Source SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses are hexadecimal file offsets; initialized DS begins846f0. Static disassembly and resource decoding only, with no DOS/x86 execution. The previous UI incorrectly combined Evaluation and Balance Sheet in an interim financial report. Evaluation now has its own original interior; Balance Sheet still opens the existing tax/report controls pending its next reconstruction increment.

## Descriptor and rendering

DS44ac flags1861 positions the352×208 outer window at128,128. Title DS43ee is EVALUATION; DS43f9 names evaluate.bmp,352×192 beneath the16-pixel shared wooden titlebar. Paint1c78:04f0/file1ee70 forwards to1e98c when its event/window gate permits. Event17 enters the main display at1ea84; the other traced events implement original close/timeout behavior. Original automatic dismissal and independent stacking/event timing remain unfinished; native keeps the movable report open until Close/Escape, per the native pacing policy.

The single control at DS4496 has words `0,288,168,48,24,1,8,3,14,0,0`: Close at288,168 including the title, event1. There are no topic tabs or report-editing controls. Button1c78:051e/file1ee9e requests DS4542 click.voc, updates the control flags and closes event1 through the shared window manager. Native title Close, client CLOSE and Escape use the existing PCM click request and shared frame. Wider original sound arbitration remains unproven.

All positions below are client coordinates (source y minus16). Text is real HTML/React, including source bitmap labels and Close. Import removes only black lettering inside five documented rectangles, preserving bevels and other artwork. No new font images are generated.

| Item | Client geometry | Source |
|---|---|---|
| Five labels |16,8+16×row;160×10 native text boxes|1ecd4..1ee28, strings DS4406/4412/441e/442b/4438 |
| Five gauges |192,8+16×row;80×8|1ed18/1ed64/1edb0/1edfc/1ee48 call a0c8|
| Season picture/text |304,16/16×16 and288,40/48×8|1eb78..1ebe1, atlas200+stored season and DS5df8+season×8|
| Problems |16+32×column,112+32×row; four columns/two rows|1ea88..1eaeb, presence indices advance down each column|
| Suggested crops |152+32×column,112+32×row; four columns/two rows|1eaf0..1eb77, same column-major order|
| Close |288,152/48×24|DS4496|

Badges use1ef38's four atlas tiles539+4×index+[0,1,2,3]. Problem indices16..23 correspond to the eight low field-status bits; crop badges use original slots0..15. Native slots16..23 use the existing separate crop-badge atlas extension, preserving the problem graphics. Browser pixel checks compare all eight problem badges and all24 crops directly with their source resources.

## Canonical report and arithmetic

Source1ea84 calls field aggregation1f020 before painting. The native snapshot already provides the equivalent bounded active-field aggregation (`farmReport.fields`, SF-077), so displaying Evaluation reads it without modifying canonical statistics, music state, RNG or saves. Source paint clears its presence array after drawing, and aggregation can request dfarm/ffarm music; native retains canonical weekly/annual updates and their existing MIDI requests instead of adding hidden state changes to rendering. Reconstructing exact original display-time music arbitration remains deferred.

The five topics are Farm Growth, Town Growth, Productivity, Soil Quality, Environment Quality. Source cached annual words remain raw in `finances.statistics.words`; the already-ported annual recurrences are not replaced with guessed growth percentages.

- Farm Growth takes word444c×80, retaining only the low16 bits, sign-extends that product and divides by signed word4462 (zero denominator becomes1). Town Growth repeats this with4450/4466. An **unsigned** comparison caps the quotient at80, so a negative quotient paints a full green gauge. Native retains this source behavior.
- Productivity wraps4454×12 to16 bits and caps the unsigned result at80.
- Soil/Environment take current nutrient-deficient/chemically-stressed field counts×80, the same low-word signed division by field count (zero becomes1). Zero paints80 green pixels; nonzero paints the computed count in red. These are problem proportions, not a linear good-to-bad score. Native uses the safely counted active records rather than an inconsistent source declared count, and clips graphics to0..80.
- Common bara0c8 paints8 pixels high: first the computed width in palette8 (green) or3 (red), then80−width in palette14 (dark gray). Labels use black/palette12 backgrounds; the source frame carries the light/dark bevels.

The sole signed16-bit division overflow (−32768 divided by−1) is evaluated safely in JavaScript and bounded for artwork. Source arithmetic quirks, reachability limits and remaining optional corrections are retained as SF-167; no new farming or financial rule is introduced.

## Suggested crop scan

1f17c..1f2a9 looks ahead16 weeks including the current week. Start index is signed precipitation-year byte DS4185×48 + month×4 + week; valid native year0..4/calendar data keeps the resulting indices in0..239 after one source subtraction of240. **Both precipitation and temperature use that same year index**, independently of the current temperature-year cursor. This is deliberately preserved.

The source sums signed precipitation bytes into a wrapping word, then logically shifts right1. For each signed temperature above50 it adds7×temperature−350 to a wrapping heat word; below45 it adds45−temperature to a wrapping cold word. For each original128-byte crop definition at2d9f:c5ac, eligibility requires unsigned word+30≤heat, unsigned word+28 divided by7≤cold, and unsigned word+40≤rain. It collects slots in order at DS4468, terminated/padded withffff. This is the source recommendation rule, not a prediction using current forecasts, soil water or crop prices.

The original scans16 crops and paints only the first eight matching slots. Native applies exactly those criteria to all24 available crops. A maximum of three pages uses the original eight32×32 positions; small HTML Prev/Next controls and a page count occupy the blank right-hand column above Close. They are explicit native additions, preserve352×192 dimensions and do not alter the source bitmap or simulation. There is no crop-file loading, swapping or mobile rearrangement. An empty result leaves the original grid empty; subsequent snapshots clear resolved problems/old suggestions. Page selection and window position are presentation state, retained on close/reopen and absent from saves.

## Evidence and checks

| Resource/range (end exclusive) | Bytes | SHA-256 |
|---|---:|---|
| evaluate.bmp |33800|136878cc449017978fc883b656ef788327e28028615defc91cfb6fd62cc224e9|
|1e98c..1ef38, paint and button callbacks||95a192108eac5bae7e30c637ad60dfb226d0488779555cfce6f98536e3bcc3de|
|1ef38..1f2aa, badges/field aggregation/suggestion scan||f95f9cd1fa31f0ab442a95aea76dc1f7e1615e4361cb4813faf798977ba50cec|
|a0c8..a114, gauge painter||c60c7e08f705f4324418fbd401ce73bd8278bce947eadbd1e570f4c1ebb3bed7|
|DS4496..451c, Close/descriptor||f7dd65190e4d01d0bc4f89a5a5582e2a2de996f198ffa5d09c01cca1e1c8633b|

Confidence is high for source geometry, resource formats and arithmetic branches. Unit checks pin source descriptors/hashes, verify every bitmap/import pixel, reject every truncated frame prefix and wrong-sized images, enumerate all48 weeks×five years×eight farms and all65536 multiplication input words, and check status masks/full24 eligibility without save changes. Browser checks cover actual text, source gauge/problem/crop pixels, paging, movement/reopening/Close, independent Balance Sheet routing, season/year rollover through the real town decision, exact save continuation, clearing and missing resources. Final checks are recorded in progress.md. Remaining original window-manager/audio behavior and the wider preservation goal are not claimed complete.
