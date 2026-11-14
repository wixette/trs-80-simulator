# SPDX-License-Identifier: Apache-2.0
# Cuts an STL with a plane perpendicular to one axis and prints the section as points,
# for reading a case's profile. Usage:
#   python3 -I stl_section.py part.stl AXIS VALUE [step_mm] [along_axis]
# AXIS 0/1/2 is the STL axis the plane is perpendicular to; VALUE is in STL coordinates.
# For each step along `along_axis` (default: the first remaining axis), prints the min
# and max of the other remaining axis.
import struct, sys
path, axis, value = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
step = float(sys.argv[4]) if len(sys.argv) > 4 else 5.0
b = open(path, 'rb').read(); n = struct.unpack('<I', b[80:84])[0]
u, w = [a for a in (0, 1, 2) if a != axis]
if len(sys.argv) > 5 and int(sys.argv[5]) == w:
    u, w = w, u
pts = []
for i in range(n):
    o = 84 + i * 50 + 12
    tri = [struct.unpack('<3f', b[o + j * 12:o + j * 12 + 12]) for j in range(3)]
    for a, c in ((0, 1), (1, 2), (2, 0)):
        p, q = tri[a], tri[c]
        if (p[axis] - value) * (q[axis] - value) < 0:
            t = (value - p[axis]) / (q[axis] - p[axis])
            pts.append((p[u] + t * (q[u] - p[u]), p[w] + t * (q[w] - p[w])))
lo = min(p[0] for p in pts); hi = max(p[0] for p in pts)
k = lo
while k <= hi:
    col = [p[1] for p in pts if k <= p[0] < k + step]
    if col:
        print(f'{k:8.1f}  {min(col):7.1f} {max(col):7.1f}  ({len(col)} pts)')
    k += step
