# shared helpers: load the model, find bones, pose in armature space, render
import bpy, re, math, mathutils
from mathutils import Vector, Matrix, Quaternion
import os
SRC = os.environ.get("DAFFODILL_GLTF", "scene.gltf")   # the original model

def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC, guess_original_bind_pose=False)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    for o in bpy.data.objects:
        if o.name == 'Icosphere': o.hide_render = True
    P = {}
    for pb in arm.pose.bones:
        P[re.sub(r'_\d+$', '', pb.name)] = pb
        pb.rotation_mode = 'QUATERNION'
    return arm, P

def upd(): bpy.context.view_layer.update()

def head(pb): return pb.matrix.to_translation()

def rot_about(pb, R):            # rotate bone about its own head by armature-space rotation R
    h = head(pb)
    pb.matrix = Matrix.Translation(h) @ R.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
    upd()

def rot(pb, axis, ang):
    if abs(ang) < 1e-9: return
    rot_about(pb, Quaternion(Vector(axis).normalized(), ang))

def aim(pb, child, d, w=1.0):    # turn pb so pb.head->child.head points along d (armature space), weight w
    cur = (head(child) - head(pb)).normalized()
    d = Vector(d).normalized()
    tgt = cur.lerp(d, w).normalized() if w < 1 else d
    rot_about(pb, cur.rotation_difference(tgt))

def setup_render(arm, res=(540, 720)):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new('w') if not sc.world else sc.world
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam); sc.camera = cam
    return cam

def place_cam(cam, target, dist, yaw_deg, pitch_deg=5, lens=50):
    y, p = math.radians(yaw_deg), math.radians(pitch_deg)
    off = Vector((math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p))) * dist
    cam.location = Vector(target) + off
    cam.rotation_euler = (-off).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
