# Original SimFarm defects and hazards

Track defects and suspicious behavior in the supplied DOS executable separately from reconstruction progress. Addresses are file offsets in the executable pinned by `tools/analyze.py`. Static evidence establishes the arithmetic and branches below; end-to-end impact has not been observed by running the DOS game. No security vulnerability is established by these findings.

Keep entries after fixing a defect. Record the original behavior, native behavior, evidence, verification and compatibility decision. Do not silently normalize source quirks while claiming faithful reconstruction.

## SF-001 — reversed regional-condition subtraction

**Status:** confirmed arithmetic defect; preserved in the native port pending a compatibility decision.

The regional decrement helpers compare the current byte with the amount and jump on **above** to a branch that writes zero. Otherwise they subtract the amount in an eight-bit register. Thus `20 - 8` becomes 0, while `5 - 8` becomes 253. The matching field-local decrement saturates at zero, so field and region can diverge substantially.

Evidence: branches at `0x1c5a5`, `0x1c63b`, `0x1c723`, `0x1c767`, `0x1c7fd`; regional offsets `2d56:01dd`, `:014d`, `:038d`, `:026d`, `:02fd`. Caller dispatch: `0x19846`–`0x19c61`. These helpers affect regional condition values used by field operations; exact downstream gameplay impact remains to be traced.

Native handling: `changeFieldCondition` deliberately reproduces the comparison and byte wrap. Regression cases cover both examples. A future correction would clamp subtraction at zero; make that an explicit enhancement/compatibility decision and retain tests for the original mode.

## SF-002 — unassigned season at week 22

**Status:** confirmed branch gap; gameplay defect severity unverified; preserved.

Season assignment uses week-of-year ranges 0–9 / 45–47, 10–21, 23–33, and 34–44. Week 22 matches none and keeps the previous season. This may be an off-by-one defect or intended delayed transition; the intended boundary is not established.

Evidence: `0xc94d`–`0xc9a9`, especially comparison with `0x17` at `0xc982`. Native handling: `advanceCalendarDay` retains the previous season and tests the boundary. No correction made.

## SF-003 — signed eight-bit field age wraps

**Status:** confirmed arithmetic hazard; reachable long-term effects require investigation; preserved.

Field age at record +34 increments as a byte (`0x1930f`) and is sign-extended for comparisons and graphic-stage arithmetic (`0x19306`–`0x1930c`, `0x194db`–`0x194ea`). The sequence crosses from 127 to a signed -128, and later 255 to 0. Long-lived fields could therefore re-enter the age-below-limit branch or produce negative stages if another routine does not reset their age first.

The routine computes a tile from that stage and ORs it into terrain flags without first restricting it to an 11-bit tile index (`0x19567`–`0x1957f`). Negative stages may select unrelated tiles or affect flags. **Reachability is not proven**: inspect perennial renewal, harvesting and age resets before calling this a demonstrated map-corruption bug.

Evidence for the tile operation: `0x19567`–`0x1957f`. Native handling: `growField` preserves byte wrapping, sign extension and 16-bit writes. No fix made; add a reachable long-running scenario case when the lifecycle is reconstructed.

## SF-004 — bounded RNG stores the pre-rejection state

**Status:** confirmed behavior with possible distribution/correlation consequences; not classified as a defect yet; preserved.

`0x8273`–`0x829f` stores the first LFSR step before repeatedly stepping a local copy to reduce it below a bound. Subsequent calls start from the stored first step, not the accepted result. For seed 51 and bound 5, several successive calls return 4 while their stored states differ. This differs from a conventional rejection sampler but may be deliberate.

Native handling: `FarmRandom.below` preserves it and tests stored state separately from returned values. No claim of exploitable predictability or security impact is made; this is a deterministic game RNG.

## SF-005 — water-stress penalty wraps to a byte

**Status:** confirmed truncation; intent and reachable harmful effects unverified; preserved.

Out-of-range water produces `(cropMultiplier * (random & 31) + 128) & 255`. The multiplication's high byte is discarded and adding 128 can wrap the low byte (`0x196ab`–`0x196af`). Larger multipliers can therefore produce smaller penalties. Establish which distributed crops and tolerance states reach those combinations before changing behavior.

Native handling: `waterStress` retains the byte wrap. No correction made.

## SF-006 — water warnings disagree with growth stress

**Status:** confirmed comparison discrepancy; preserved; broader effects of byte thresholds remain unverified.

The status routine uses `water > upper` (`0x190f6`–`0x19103`) to display a wet warning, while growth applies water stress at `water >= upper` (`0x195d0`–`0x196b7`). A grape field with water 28 and unmodified tolerances therefore incurs stress without a wet badge. The regression test demonstrates this using the distributed grape definition.

Status also computes tolerances with signed byte arithmetic (`0x19087`–`0x190c2`), whereas growth uses word arithmetic. Large modifiers can wrap the displayed thresholds differently; reachable effects need investigation. Native handling preserves both routines. No correction made.

## SF-007 — fifth year-end temperature reads the wind byte

**Status:** confirmed table-boundary defect in the recovered calendar path; preserved without native out-of-bounds access.

At `0xcbc6`–`0xcbfc`, temperature is read using `temperatureYear * 48 + month * 4 + week` after week increments to four, but before month and year roll over. For temperature-year index four, month eleven and week four, the index is 240. The 240-byte table starts at `6190:4278`; the next byte at `6190:4368` is current wind. The temperature therefore becomes wind speed until the next weekly temperature update. Other year ends read the following year's first temperature entry, which remains in bounds.

Native handling explicitly selects wind at index 240. A five-year calendar regression with distinct wind and temperature tables verifies this path. No correction made. This is a read into another known global, not evidence of an exploitable security vulnerability.

## SF-008 — unchecked precipitation count indexes outside forecast stack tables

**Status:** confirmed missing upper-bound check; malformed-data hazard; no exploit demonstrated.

The forecast routine reads a signed precipitation count from the climate table, clamps negative values to zero (`0x1e865`–`0x1e872`), then indexes a 56-byte stack table with `count * 7 + day` (`0x1e89d`–`0x1e8ae`, cold path `0x1e8d5`–`0x1e8e6`). It does not clamp counts above seven. Such a value can read beyond the initialized pattern table and produce unrelated weather codes. All eight distributed scenarios contain counts within zero through seven.

Native handling rejects imported climate counts above seven and validates the forecast lookup. The decoder regression includes a mutated scenario with count eight. The original hazard stays documented despite that native validation; additional memory consequences and exploitability are unproven.
