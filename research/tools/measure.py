# Measures RetroStack's printable case (STL) and KiCad board (.kicad_pcb) files:
# triangle count and size of each STL, footprint count of a board.
# Usage: python3 -I measure.py Original_Top.stl Original_Bottom.stl board.kicad_pcb
# The files are not kept in this repository; see sources/notes-value-check.md, §2.
# The board outline is measured separately (Edge.Cuts), as recorded in the notes.
import struct, sys, re, collections
def stl(path):
    b = open(path,'rb').read()
    if b[:5] == b'solid' and b'facet' in b[:400]:
        vs = [tuple(map(float, m.groups())) for m in re.finditer(rb'vertex\s+(\S+)\s+(\S+)\s+(\S+)', b)]
        n = len(vs)//3
    else:
        n = struct.unpack('<I', b[80:84])[0]; vs=[]
        for i in range(n):
            o = 84 + i*50 + 12
            vs += [struct.unpack('<3f', b[o+j*12:o+j*12+12]) for j in range(3)]
    lo=[min(v[i] for v in vs) for i in range(3)]; hi=[max(v[i] for v in vs) for i in range(3)]
    return n, lo, hi
for p in sys.argv[1:]:
    if p.endswith('.stl'):
        n, lo, hi = stl(p)
        print(p.split('/')[-1], 'triangles', n, 'size mm', [round(hi[i]-lo[i],1) for i in range(3)])
    else:
        t = open(p, encoding='utf-8').read()
        fps = re.findall(r'\(footprint "([^"]+)"', t)
        refs = re.findall(r'\(property "Reference" "([^"]+)"', t)
        xs=[];ys=[]
        for m in re.finditer(r'\(gr_(?:line|arc|rect)\s*\(start ([-\d.]+) ([-\d.]+)\)\s*(?:\(mid [-\d.]+ [-\d.]+\)\s*)?\(end ([-\d.]+) ([-\d.]+)\)[^)]*?(?:\([^)]*\)\s*)*?\(layer "Edge\.Cuts"\)', t):
            x1,y1,x2,y2 = map(float, m.groups()); xs += [x1,x2]; ys += [y1,y2]
        print('footprints', len(fps), 'refs', len(refs))
        kinds = collections.Counter(re.sub(r':.*','',f) for f in fps); print('libraries', kinds.most_common(8))
        print('Z (ICs)', len([r for r in refs if re.match(r'Z\d', r)]), 'C', len([r for r in refs if r.startswith('C')]), 'R', len([r for r in refs if r.startswith('R')]))
        if xs: print('Edge.Cuts bbox mm', round(max(xs)-min(xs),2), 'x', round(max(ys)-min(ys),2))
        print('3D models referenced', len(re.findall(r'\(model "', t)), 'segments', t.count('(segment'), 'layers', re.findall(r'\(\d+ "([FB]\.Cu)"', t))
