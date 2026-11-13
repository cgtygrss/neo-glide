"""Verify every native library in an AAB supports Android 16 KiB pages."""
import struct
import sys
import zipfile

count = 0
with zipfile.ZipFile(sys.argv[1]) as bundle:
    for name in bundle.namelist():
        if not name.endswith('.so'):
            continue
        elf = bundle.read(name)
        assert elf[:4] == b'\x7fELF', f'Not an ELF library: {name}'
        order = '<' if elf[5] == 1 else '>'
        is64 = elf[4] == 2
        offset = struct.unpack_from(order + ('Q' if is64 else 'I'), elf, 32 if is64 else 28)[0]
        size, number = struct.unpack_from(order + 'HH', elf, 54 if is64 else 42)
        for index in range(number):
            header = offset + index * size
            kind = struct.unpack_from(order + 'I', elf, header)[0]
            alignment = struct.unpack_from(order + ('Q' if is64 else 'I'), elf, header + (48 if is64 else 28))[0]
            if kind == 1:
                assert alignment >= 16384, f'Native library lacks 16 KiB alignment: {name}'
        count += 1
assert count, 'No native libraries were checked'
print(f'{count} native libraries support 16 KiB pages.')
