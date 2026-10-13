"""Reproduce the toxic-land warning (disaster mode 8) reachability trace; static bytes only, no DOS execution.
Run with .venv/bin/python tools/audit-toxic-warning.py. Exits nonzero if any route to mode 8 or message 51 appears.
"""
import hashlib
import re
import struct
from pathlib import Path

root = Path(__file__).resolve().parent.parent
exe = (root.parent / 'simfarm-dos/SIMFARM.EXE').read_bytes()
if hashlib.sha256(exe).hexdigest() != '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce':
    raise ValueError('Executable fingerprint differs from the mapped version')
header = struct.unpack_from('<H', exe, 8)[0] * 16
problems = []

# 1. Bit 0x80 of the shared disaster flags DS:6996: every direct operand, with or without an ES override.
ops = rb'(\xf6\x06|\x80\x0e|\x80\x26|\x8a\x06|\xa0|\x80\x3e|\xa2|\x88\x06|\x08\x06|\x20\x06|\x84\x06|\x30\x06|\xfe\x06|\x8a\x1e|\x8a\x0e|\x8a\x16)'
flag80 = []
for m in re.finditer(rb'\x26?' + ops + rb'\x96\x69', exe):
    i, op = m.start(), m.group(1)
    imm = exe[m.end()] if op in (b'\xf6\x06', b'\x80\x0e', b'\x80\x26', b'\x80\x3e') else None
    if imm is None: problems.append(f'whole-byte access to DS:6996 at {i:x}')
    elif (op == b'\x80\x26' and not imm & 0x80) or (op != b'\x80\x26' and imm & 0x80): flag80.append((i, op.hex(), imm))
print('bit 0x80 accesses:', [(hex(i), o, hex(v)) for i, o, v in flag80])
if [i for i, _, _ in flag80] != [0x36836, 0x36840]: problems.append('unexpected bit 0x80 producer/consumer')

# 2. events.dat record 51: literal loads through 24e6:1000, and message-dispatcher (24e6:0fd8) requests 51/179.
loads = [m.start() for m in re.finditer(rb'\x6a\x33\x1e\x68..\x9a\x00\x10\xe6\x24', exe, re.S)]
print('record 51 loads:', [hex(i) for i in loads])
if loads != [0x36845]: problems.append('unexpected record 51 load')
for m in re.finditer(rb'\x9a\xd8\x0f\xe6\x24', exe):
    i = m.start(); p = exe[i - 4:i]
    ident = p[3] if p[2] == 0x6a else struct.unpack_from('<H', p, 2)[0] if p[1] == 0x68 else None
    if ident in (51, 179): problems.append(f'dispatcher requests message {ident} at {i:x}')
# Variable dispatcher requests: debug browser (ID capped at 42 behind DS1b78) and wrapper 1d766 (IDs 0x27/0x24).
for address, pattern in [(0xf2f8, '26803e781b007440'), (0xf30a, '833e9a212a7e06c7069a212a00'), (0xcc7a, '6a27'), (0xcd28, '6a24')]:
    if exe[address:address + len(pattern) // 2] != bytes.fromhex(pattern): problems.append(f'unexpected bytes at {address:x}')

# 3. Disaster manager requests: literal far calls to stub 24e6:1096, aliases, stored pointers and overlay-10 near calls.
stub = header + 0x24e6 * 16 + 0x1096
far = [(m.start(), exe[m.start() - 2:m.start()]) for m in re.finditer(rb'\x9a\x96\x10\xe6\x24', exe)]
print('manager far calls (push imm8):', [(hex(i), p[1]) for i, p in far])
if any(p[0] != 0x6a or p[1] == 8 for _, p in far): problems.append('non-literal or mode-8 manager far call')
for m in re.finditer(rb'[\x9a\xea]', exe[:-4]):
    off, seg = struct.unpack_from('<HH', exe, m.start() + 1)
    if header + seg * 16 + off == stub and (seg, off) != (0x24e6, 0x1096): problems.append(f'stub alias at {m.start():x}')
data = [m.start() for m in re.finditer(rb'\x96\x10\xe6\x24', exe) if exe[m.start() - 1] != 0x9a]
if data: problems.append(f'stored manager pointers at {[hex(i) for i in data]}')
near = [i for i in range(0x364b0, 0x364b0 + 0x1490 - 3) if exe[i] == 0xe8 and i + 3 + struct.unpack_from('<h', exe, i + 1)[0] == 0x36574]
modes = [exe[i - 2] for i in near]  # push imm8; push cs; call near
print('overlay-10 near calls:', [hex(i) for i in near], 'modes', modes)
if 8 in modes or any(exe[i - 3] != 0x6a or exe[i - 1] != 0x0e for i in near): problems.append('non-literal or mode-8 near call')
table = [0x364b0 + struct.unpack_from('<H', exe, 0x364b0 + 0x848 + 2 * k)[0] for k in range(8)]
if table[7] != 0x36836: problems.append('mode 8 jump-table entry moved')

print('PROBLEMS:' if problems else 'No route to mode 8 or message 51 in the shipped executable.', *problems, sep='\n')
raise SystemExit(1 if problems else 0)
