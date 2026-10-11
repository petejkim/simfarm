"""Static reference audit for Schedule helper2e80e; no executable code is run.
Run with .venv/bin/python tools/audit-field-helper.py. Candidate scans cannot
prove absence of computed pointers, alternate segments or indirect dispatch.
"""
import hashlib
import json
import struct
from pathlib import Path

root = Path(__file__).resolve().parent.parent
exe = (root.parent / 'simfarm-dos/SIMFARM.EXE').read_bytes()
expected = '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce'
if hashlib.sha256(exe).hexdigest() != expected:
    raise ValueError('Executable fingerprint differs from the mapped version')
header = struct.unpack_from('<H', exe, 8)[0] * 16
manager = header + 0x24e6 * 16
entry = manager + 0xc1f + 3 * 18
segment, _, para, flags, _, relocations, _, _, initialized = struct.unpack_from('<9H', exe, entry)
start = ((flags & 255) * 65536 + para) * 16 + ((relocations + 3) // 4) * 16
end = start + initialized * 16
target = 0x2e80e
offset = target - start
pointer = struct.pack('<HH', offset, segment)
far_hits = [hex(i) for i in range(len(exe) - 3) if exe[i:i+4] == pointer]
near_hits = []
for i in range(start, end - 2):
    if exe[i] in (0xe8, 0xe9) and i + 3 + struct.unpack_from('<h', exe, i+1)[0] == target:
        near_hits.append({'file': hex(i), 'bytes': exe[i:i+3].hex()})
# Manager stubs: near call275ed, far jump, trailing overlay identifier.
stubs = []
for i in range(3, len(exe) - 6):
    if exe[i-3] != 0xe8 or exe[i] != 0xea:
        continue
    if i + struct.unpack_from('<h', exe, i-2)[0] != 0x275ed:
        continue
    destination, selector, overlay = struct.unpack_from('<HHH', exe, i+1)
    if selector == segment and overlay == 3:
        stubs.append({'stub': hex(i-3), 'offset': hex(destination), 'target': hex(start+destination)})
report = {
    'sha256': expected, 'overlay': 3, 'start': hex(start), 'endExclusive': hex(end),
    'helper': hex(target), 'offset': hex(offset), 'segment': hex(segment),
    'helperSha256': hashlib.sha256(exe[target:0x2e939]).hexdigest(),
    'literalFarPointerHits': far_hits, 'nearCallOrJumpCandidates': near_hits,
    'overlayManagerStubs': stubs,
    'helperManagerStubs': [s for s in stubs if s['target'] == hex(target)],
    'limits': 'Literal/candidate scan only; indirect/computed/alternate-segment references are not excluded.',
}
if not stubs:
    raise ValueError('Manager-stub scan found no known overlay3 entries')
out = root / 'artifacts/field-helper-audit.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
