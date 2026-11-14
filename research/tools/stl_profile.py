# Height map of an STL seen from above, for reading a case's profile and openings.
# Usage: python3 -I stl_profile.py part.stl [cell_mm] [up_axis 0|1|2]
# Prints the bounding box, a coarse ASCII height map (digits = tenths of the height),
# and the height profile along depth at the middle of the width.
import struct, sys, re
path = sys.argv[1]; cell = float(sys.argv[2]) if len(sys.argv) > 2 else 8.0
up = int(sys.argv[3]) if len(sys.argv) > 3 else 1
b = open(path, 'rb').read()
if b[:5] == b'solid' and b'facet' in b[:400]:
    vs = [tuple(map(float, m.groups())) for m in re.finditer(rb'vertex\s+(\S+)\s+(\S+)\s+(\S+)', b)]
else:
    n = struct.unpack('<I', b[80:84])[0]; vs = []
    for i in range(n):
        o = 84 + i * 50 + 12
        vs += [struct.unpack('<3f', b[o + j * 12:o + j * 12 + 12]) for j in range(3)]
ax = [a for a in (0, 1, 2) if a != up]
lo = [min(v[i] for v in vs) for i in range(3)]; hi = [max(v[i] for v in vs) for i in range(3)]
print('bbox min', [round(x, 1) for x in lo], 'max', [round(x, 1) for x in hi])
W = int((hi[ax[0]] - lo[ax[0]]) / cell) + 1; D = int((hi[ax[1]] - lo[ax[1]]) / cell) + 1
grid = [[None] * W for _ in range(D)]
for t in range(0, len(vs), 3):
    tri = vs[t:t + 3]
    # sample the triangle at its vertices, centroid and edge midpoints
    pts = list(tri) + [tuple(sum(p[i] for p in tri) / 3 for i in range(3))]
    pts += [tuple((tri[a][i] + tri[c][i]) / 2 for i in range(3)) for a, c in ((0, 1), (1, 2), (2, 0))]
    for p in pts:
        x = int((p[ax[0]] - lo[ax[0]]) / cell); y = int((p[ax[1]] - lo[ax[1]]) / cell)
        h = p[up] - lo[up]
        if grid[y][x] is None or h > grid[y][x]: grid[y][x] = h
H = hi[up] - lo[up]
for row in grid:
    print(''.join('.' if h is None else str(min(9, int(h / H * 10))) for h in row))
mid = W // 2
print('profile along depth at mid-width (depth mm: top height mm):')
print(', '.join(f'{y * cell:.0f}:{grid[y][mid]:.1f}' for y in range(D) if grid[y][mid] is not None))
