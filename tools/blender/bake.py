import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from rig import load, upd
from body import Body
import clips
FPS, STEP = 30, 2
arm, P = load(); B = Body(arm, P)
bpy.context.scene.render.fps = FPS
arm.animation_data_create()
for name in clips.CLIPS:
    part_at, dur, loop = clips.sampler(name)
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data.action = act
    n = int(round(dur * FPS))
    frames = list(range(0, n + 1, STEP))
    if frames[-1] != n: frames.append(n)
    for f in frames:
        B.apply(part_at(f / FPS)); B.key(f)
    print('baked', name, len(frames))
arm.animation_data.action = None
B.reset()
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), "anims.glb"),
    export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIONS',
    export_force_sampling=True, export_optimize_animation_size=True, export_def_bones=False,
    export_skins=True, export_morph=False, export_apply=False)
print('EXPORTED')
