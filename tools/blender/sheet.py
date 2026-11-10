import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# usage: blender -b --python sheet.py -- clip t1,t2,... out.png [yaw] [dist]
import bpy, numpy as np
from mathutils import Vector
from rig import load, setup_render, place_cam, upd
from body import Body
import clips
argv = sys.argv[sys.argv.index('--') + 1:]
name, times, out = argv[0], [float(x) for x in argv[1].split(',')], argv[2]
yaw = float(argv[3]) if len(argv) > 3 else 30
dist = float(argv[4]) if len(argv) > 4 else 330
zoff = float(argv[5]) if len(argv) > 5 else 20
arm, P = load()
B = Body(arm, P)
cam = setup_render(arm, (300, 400))
part_at, dur, loop = clips.sampler(name)
tiles = []
tmp = os.path.join(os.path.dirname(out), '_tile.png')
for t in times:
    B.apply(part_at(t))
    tgt = arm.matrix_world @ B.h(B.pelvis) + Vector((0, 0, zoff))
    place_cam(cam, tgt, dist, yaw, 6, 50)
    bpy.context.scene.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp, check_existing=False)
    a = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
    tiles.append(a); bpy.data.images.remove(img)
cols = min(6, len(tiles)); rows = (len(tiles) + cols - 1) // cols
h, w = tiles[0].shape[:2]
sheet = np.ones((rows * h, cols * w, 4), dtype=np.float32)
for i, a in enumerate(tiles):
    r, c = i // cols, i % cols
    sheet[(rows - 1 - r) * h:(rows - r) * h, c * w:(c + 1) * w] = a
im = bpy.data.images.new('sheet', cols * w, rows * h, alpha=True)
im.pixels = sheet.ravel()
im.filepath_raw = out; im.file_format = 'PNG'; im.save()
print('SHEET', out)
