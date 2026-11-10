# Mascot animation (Blender)

Builds her clips (idle, talk, waveL/R, takeoff, glide, land) on the model's Bip001 rig and
merges them into `models/daffodill-anim.glb`.

    set DAFFODILL_GLTF=path\to\scene.gltf
    blender -b --python bake.py                                   (writes anims.glb)
    blender -b --python sheet.py -- talk 0,1.5,2.8,4.5 talk.png   (contact sheet to check poses)
    node merge.mjs base.glb anims.glb ../../models/daffodill-anim.glb   (needs @gltf-transform + draco3dgltf)

`clips.py` holds the poses and timing; `body.py` turns a pose into bone rotations.
