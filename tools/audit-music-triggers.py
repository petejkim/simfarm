"""Audit literal situational-music calls without executing DOS code.
Run: .venv/bin/python tools/audit-music-triggers.py
This is a bounded direct-call audit, not whole-program reachability proof.
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
ds = 0x846f0

def pin(address, value):
    if exe[address:address + len(value)] != value:
        raise ValueError(f'Unexpected bytes at {address:x}')

def string(offset):
    end = exe.index(b'\0', ds + offset)
    return exe[ds + offset:end].decode('ascii')

expected_calls = {
    0xca7b: (0x2060, 'carnival.xmi'), 0xcb57: (0x2078, 'rodeo.xmi'),
    0x1f147: (0x454c, 'dfarm.xmi'), 0x1f174: (0x4556, 'ffarm.xmi'),
    0x1f38f: (0x45c9, 'cowman.xmi'), 0x3676a: (0x69e2, 'alien.xmi'),
    0x3eaf8: (0xa8a2, 'genfarm.xmi'), 0x40e15: (0xa9cc, 'amain.xmi'),
}
pattern = bytes.fromhex('9a82062a21')
hits = [i for i in range(len(exe) - len(pattern) + 1) if exe.startswith(pattern, i)]
if hits != list(expected_calls):
    raise ValueError('Unexpected literal music call sites')
for address, (offset, name) in expected_calls.items():
    pin(address - 4, b'\x1e\x68' + struct.pack('<H', offset))
    if string(offset) != name:
        raise ValueError(f'Unexpected filename at DS:{offset:x}')
# Pointer segments distinguish DS globals from similarly numbered other-segment data.
for offset, segment in {0xc664: 0x6190, 0xc666: 0x6190, 0xc6ae: 0x6190,
                        0xc6ec: 0x6190, 0xc6ee: 0x2d9f, 0xc6f0: 0x2d9f}.items():
    pin(ds + offset, struct.pack('<H', segment))
for address, value in {
    0x40679: '26a2d21e',                   # Restart mode store.
    0x406a9: '26a2d61e',                   # Restart phase store.
    0x406b1: '26a2d91e',                   # Restart species store.
    0x407ab: '2bc08e061ece26a3d41e',        # Restart timestamp zero.
    0x40902: '2bc08e065ece26a3d01e',        # Restart participation zero.
    0xc920: '26ff065212',                    # Week increments before event checks.
    0xc9b8: '2d0900c1e002',                 # Fair month term.
    0xcb04: '2d0600c1e002',                 # Rodeo month term.
    0xc9d0: '26803ea1a800', 0xcb1c: '26803ea1a800',
    0xc9db: '6a020ee8d10f', 0xcb27: '6a010ee8850e',
    0xd9c2: '26803ebc9c00',                 # Recreation-count gate.
    0xca00: '68c8009a0600661a',             # Fair affordability 200.
    0xcb36: '68e8039a0600661a',             # Rodeo affordability 1000.
    0xcb85: '68f4016aff9a2e00661a',         # Rodeo debit 500/category -1.
    0xcaf4: 'c606d31e03', 0xcba6: 'c606d31e02',
    0xdc0c: '9a7d00fd0524033c02',          # Rodeo random low-two-bit comparison.
    0xdc84: '9a7d00fd05a801',              # Fair random low-bit test.
    0x135b0: 'ff360c239aa300fd05',           # Bounded random ordinal among active animals.
    0x135db: '26f687026420',                # Active record flag, no age/condition filter.
    0xdd34: '6a000ee878fc',                 # Restore recreation mode zero.
}.items():
    pin(address, bytes.fromhex(value))
pin(ds + 0x1ed0, bytes(10))
for pointer in [0xcdde, 0xcdea, 0xcdec, 0xce1e, 0xce5e]:
    pin(ds + pointer, struct.pack('<H', 0x6190))
ranges = [(0xc88e, 0xcbb3), (0xd9b2, 0xdbe4), (0xdbe4, 0xdd3e),
          (0x23b22, 0x23b8a), (0x40e07, 0x40e22), (0x1359a, 0x135f8)]
report = {
    'exeSha256': expected,
    'literalMusicCalls': [{'file': hex(a), 'filenameDS': hex(o), 'filename': n}
                         for a, (o, n) in expected_calls.items()],
    'eventStrings': {hex(o): string(o) for o in [0x1fba, 0x1fd5, 0x2045, 0x206d,
                                              0x2094, 0x20a1, 0x20cf, 0x20fe, 0x212a]},
    'sourceRanges': [{'start': hex(a), 'endExclusive': hex(b),
                      'sha256': hashlib.sha256(exe[a:b]).hexdigest()} for a, b in ranges],
    'limits': 'Literal far calls only; indirect calls, aliases, near loaders and sequence controls remain unaudited. Calendar checks precede month normalization. amain lifecycle not yet classified.',
}
out = root / 'artifacts/music-trigger-audit.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
