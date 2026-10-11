"""Reproduce the bounded crop-circle/toxic-warning input audit; no DOS execution.
Run with .venv/bin/python tools/audit-disaster-triggers.py.
Literal references do not exclude indirect calls or alternate segment aliases.
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
entry = manager + 0xc1f + 10 * 18
segment, _, para, flags, _, relocations, _, _, initialized = struct.unpack_from('<9H', exe, entry)
start = ((flags & 255) * 65536 + para) * 16 + ((relocations + 3) // 4) * 16
end = start + initialized * 16
target, stub = 0x36574, manager + 0x1096

def hits(pattern):
    return [i for i in range(len(exe) - len(pattern) + 1) if exe.startswith(pattern, i)]

def pin(address, pattern):
    if exe[address:address + len(pattern)] != pattern:
        raise ValueError(f'Unexpected source bytes at {address:x}')

pin(stub, bytes.fromhex('e8f4f4eac400ce270a00'))
pin(0xf350, bytes.fromhex('26803e781b007503e96a03'))  # Zero debug flag skips through f6c5.
pin(0xf6b5, bytes.fromhex('807ef041750a6a079a9610e62483c402'))
pin(0x846f0 + 0x5d, b'eeadebug\0')
pin(0x846f0 + 0x1b78, b'\0')
pin(0x22ac, bytes.fromhex('817ed2c9077706807ed10b760d'))
far_calls = hits(bytes.fromhex('9a9610e624'))
if far_calls != [0xf6bd, 0x1e1fa, 0x1e20b, 0x3e3c2, 0x3e3e4, 0x3e3f4]:
    raise ValueError('Unexpected direct general-disaster callers')
near_candidates = [i for i in range(start, end - 2)
                   if exe[i] in (0xe8, 0xe9)
                   and i + 3 + struct.unpack_from('<h', exe, i + 1)[0] == target]
ranges = [(0x227e, 0x22d0), (0x5dba, 0x5dd5), (0x6338, 0x6369),
          (0xf254, 0xf35b), (0xf6b5, 0xf6c5), (0x3e3b0, 0x3e456), (0x36836, 0x36853), (0x364b0, 0x36574)]
report = {
    'sha256': expected,
    'debugArgument': 'eeadebug', 'debugFlagDS': '1b78', 'initialDebugFlag': 0,
    'startupGate': 'argc>1, argv[1] matches, DOS year<=1993 AND month<=11',
    'circleInput': 'No Ctrl; ASCII uppercase A; debug flag nonzero; mode7 at f6bb',
    'generalStart': hex(target), 'managerStub': hex(stub),
    'overlay10': {'start': hex(start), 'endExclusive': hex(end)},
    'directManagerCalls': [{'file': hex(i), 'precedingPushBytes': exe[i-2:i].hex()} for i in far_calls],
    'nearCallOrJumpCandidatesWithinOverlay10': [hex(i) for i in near_candidates],
    'literalManagerPointerHits': [hex(i) for i in hits(struct.pack('<HH', 0x1096, 0x24e6))],
    'literalOverlayPointerCandidates': [hex(i) for i in hits(struct.pack('<HH', target-start, segment))],
    'overlayPointerClassification': {'0x280fa': 'overlay10 manager stub', '0x484f4': 'overlay25 relocation table, not an executable call'},
    'nearCallerModes': {'0x364e9': [6, 1], '0x364fd': [4], '0x36519': [3], '0x3652e': [2]},
    'sourceRanges': [{'start': hex(a), 'endExclusive': hex(b), 'sha256': hashlib.sha256(exe[a:b]).hexdigest()} for a,b in ranges],
    'limits': 'Bounded literal/relative scan and inspected direct branches only. Computed, indirect and alternate-segment references are not excluded. No proven ordinary mode8 caller; not proof of dead code.',
}
out = root / 'artifacts/disaster-trigger-audit.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
