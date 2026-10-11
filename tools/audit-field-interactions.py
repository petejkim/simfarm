"""Bounded field-interaction audit; static source bytes only, no DOS execution.
Run .venv/bin/python tools/audit-field-interactions.py.
"""
import hashlib
import json
import struct
from pathlib import Path

root = Path(__file__).resolve().parent.parent
exe = (root.parent / 'simfarm-dos/SIMFARM.EXE').read_bytes()
sha = hashlib.sha256(exe).hexdigest()
assert sha == '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce'
ds = 0x846f0
for offset, segment in {0xc97a: 0x6190, 0xc97c: 0x2be7, 0xca1c: 0x6190, 0xc9e6: 0x6190}.items():
    assert struct.unpack_from('<H', exe, ds + offset)[0] == segment
pins = {
    0x38386: '26c7068a01feff',       # Plant popup selects tool FFFE.
    0x23e9b: '26833e8a01fe7403',     # Map dispatch compares that sentinel.
    0x23eae: '9a0e2c751d',           # New-field wrapper 1d75:2c0e.
    0x22571: '9a30085719',           # Wrapper calls constructor1957:0830.
    0x26c75: '9ab8015719',           # Spray resolves a field at the clicked point.
    0x26c84: '26a18a013d9003',       # Field-action dispatch reads selected tool.
    0x26c95: '487418',               # Tool1 branches to Waiting-field handler.
    0x26cc4: '2680bf3424007403e9d902',
    0x26ccf: '26c68734240226c687352400',  # State2/step0.
    0x26cdb: '6a006a006a01509a4a11e624', # Recorder order1, not a cancellation.
    0x2f697: '3d01007c0948500ee898f2',   # Weekly cleanup before order dispatch.
}
for offset, value in pins.items():
    assert exe[offset:offset + len(bytes.fromhex(value))] == bytes.fromhex(value), hex(offset)
pattern = bytes.fromhex('c7068a010100')
hits = [hex(i) for i in range(len(exe) - len(pattern) + 1) if exe.startswith(pattern, i)]
# Original Edit's linked control descriptors; action ID is distinct from tool018a.
palette = []
pointer = 0x5614
seen = set()
while pointer:
    assert pointer not in seen
    seen.add(pointer)
    words = struct.unpack_from('<11H', exe, ds + pointer)
    action = words[5]
    assert 1 <= action <= 32 and (words[10] == 0x6190 or words[9] == words[10] == 0)
    target = 0x1f950 + struct.unpack_from('<H', exe, 0x22352 + (action - 1) * 2)[0]
    palette.append(dict(descriptor=hex(pointer), x=words[1], y=words[2], width=words[3], height=words[4], action=action, target=hex(target)))
    pointer = words[9]
assert [p['action'] for p in palette] == [26, 2, 15, 16, 11, 12, 20, 19, 13, 14, 17, 1, 22, 23, 30, 32]
assert palette[0]['target'] == '0x21726'
assert exe[0x2172f:0x21735].hex() == '26c747020b00'
assert exe[0x2174a:0x21750].hex() == '6a060ee8b40d'
computed = []
for action, definition, expected in [(11,0x7466,177),(12,0x74d2,188),(13,0x749c,1020),(14,0x748a,176),(15,0x741e,150),(16,0x73c4,161),(17,0x73fa,131),(18,0x74ae,172),(19,0x74e4,122),(20,0x73d6,87)]:
    graphic = exe[ds + definition]
    value = struct.unpack_from('<H', exe, 0x4ec60 + 0x85e + graphic * 2)[0] + (1 if action == 14 else 0)
    assert value == expected
    computed.append(dict(action=action, definition=hex(definition), graphic=graphic, initializedSelectedTool=value))
assert exe[0x21a86:0x21a8c].hex() == '268b875e0840' # Trough increments base175.
report = {
    'exeSha256': sha,
    'editControls': palette,
    'computedPaletteTools': computed,
    'sourcePins': {hex(k): v for k, v in pins.items()},
    'sourceRanges': [{'start': hex(a), 'endExclusive': hex(b), 'sha256': hashlib.sha256(exe[a:b]).hexdigest()}
                     for a, b in [(0x38310, 0x38397), (0x23e9b, 0x23ec0), (0x26c64, 0x26d3c), (0x2f66a, 0x2f6a5), (ds+0x54ca, ds+0x562a), (0x21726,0x21eec), (0x22344,0x22392)]],
    'literalImmediateTool1Stores': hits,
    'conclusions': [
        'Inspected Plant route constructs a new field; it does not establish an existing-field cancellation gesture.',
        'The weekly dispatcher already calls forced completion before new orders.',
        'The Waiting-field tool1 handler exists; its selector/UI reachability remains unproven.',
        'Action26 is the first visible Move object control, already implemented; it selects Edit mode11, not field tool1.',
        'Initialized computed palette selections are graphic bases, none equal1; dynamic table mutations are outside this bounded audit.',
    ],
    'limits': 'Literal immediate-store scan is not exhaustive: computed, indirect, aliased and bulk writes may select tool1. No absent-original-feature claim follows from zero hits.',
}
out = root / 'artifacts/field-interaction-audit.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
