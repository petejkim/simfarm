"""Static analysis only: index Microsoft overlays and disassemble chosen file ranges.
Usage: npm run analyze -- [--start 0x4543c --size 0x810]
No DOS program execution. Tools live in this repository's .venv.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from capstone import Cs, CS_ARCH_X86, CS_MODE_16

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=Path('../simfarm-dos/SIMFARM.EXE'))
parser.add_argument('--start', type=lambda s: int(s, 0))
parser.add_argument('--size', type=lambda s: int(s, 0), default=0x200)
args = parser.parse_args()
data = args.source.read_bytes()
# This map is for the analyzed distribution; never silently apply it to another build.
expected = '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce'
if hashlib.sha256(data).hexdigest() != expected:
    raise ValueError('Executable fingerprint differs from the mapped version')
h = struct.unpack_from('<14H', data)
header_bytes = h[4] * 16
resident_size = (h[2] - 1) * 512 + (h[1] or 512)
manager = header_bytes + 0x24e6 * 16
count = struct.unpack_from('<H', data, manager + 0xc19)[0]
overlays = []
for index in range(count):
    off = manager + 0xc1f + index * 18
    load_segment, unknown, file_para, flags, memory_para, reloc_count, parent, next_id, init_para = struct.unpack_from('<9H', data, off)
    reloc_offset = ((flags & 0xff) * 65536 + file_para) * 16
    code_offset = reloc_offset + ((reloc_count + 3) // 4) * 16
    overlays.append(dict(index=index, tableOffset=off, loadSegment=load_segment,
                         relocationOffset=reloc_offset, relocationCount=reloc_count,
                         fileOffset=code_offset, initializedBytes=init_para * 16,
                         memoryBytes=memory_para * 16, flags=flags))
result = dict(sha256=expected, headerBytes=header_bytes, residentFileBytes=resident_size,
              entryFileOffset=header_bytes + h[11] * 16 + h[10], overlays=overlays,
              dataSegmentFileOffset=overlays[29]['fileOffset'] + (0x6190 - overlays[29]['loadSegment']) * 16)
out = Path('artifacts'); out.mkdir(exist_ok=True)
(out / 'executable-map.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'Mapped {count} overlays; initialized DS at file 0x{result["dataSegmentFileOffset"]:x}')
if args.start is not None:
    if args.start < 0 or args.size < 1 or args.start + args.size > len(data):
        raise ValueError('Invalid disassembly range')
    # Use file offsets for reproducible citations; branch operands therefore show file addresses.
    decoder = Cs(CS_ARCH_X86, CS_MODE_16)
    lines = [f'{i.address:06x}  {i.bytes.hex():22s} {i.mnemonic:8s} {i.op_str}'
             for i in decoder.disasm(data[args.start:args.start + args.size], args.start)]
    filename = out / f'disassembly-{args.start:06x}.asm'
    filename.write_text('\n'.join(lines) + '\n')
    print(f'Wrote {len(lines)} instructions to {filename}; chosen ranges may contain data.')
