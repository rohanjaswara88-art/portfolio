/* =====================================================================
   NIMBUS 3D: the corner mascot, a rigged glTF model (models/daffodill.glb).
   The page's mascot script keeps all the behaviour (reading, scrolling, hair rubbing)
   and calls draw() every frame with its eased expression numbers.

     const nimbus = createNimbus3D(canvas, 'models/daffodill.glb');
     nimbus.draw({ st, T, blink, touch });   // st = the eased expression state
     nimbus.hitHair(clientX, clientY);       // true when the pointer is over her head/hair

   The model has no face blend shapes, so expressions are made by moving face bones
   (eyelids, mouth corners) and, mostly, by body language: head turns, arm poses, hair.

   Model credit (CC-BY-4.0): "(Neverness to Everness) Daffodill Default" by symbol aughhhh,
   https://sketchfab.com/3d-models/neverness-to-everness-daffodill-default-f7d7956ae90a4db6b3d2ed5481844191
   ===================================================================== */
(function () {
  'use strict';

  const DEG = Math.PI / 180;
  const FRAME = { centerY: 139, halfHeight: 46, fov: 20 };   // model units are cm: waist to just above the head
  const BODY_YAW = -0.38;           // she stands turned a little toward the page content (to her left)
  const LID_TRAVEL = 1.45;          // cm the upper eyelid bones travel to fully shut the eye
  const HEAD_HIT_RADIUS = 14;       // cm, the "hair" zone around her head for the rub test
  const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/';

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // arm poses as world directions (before her body yaw): [upper arm -> elbow, forearm -> wrist], her left (+x) side
  const ARM = {
    rest:  [V(0.16, -1, 0.06), V(0.08, -1, 0.22)],
    brace: [V(0.32, -1, 0.3), V(-0.42, 0.3, 0.86)],     // forearms up in front of her, bracing
    hips:  [V(0.85, -0.7, -0.15), V(-0.75, -0.75, 0.2)]  // hands on hips: annoyed
  };

  function angerTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.lineCap = 'round';
    [['#ffffff', 22], ['#ff3b5c', 12]].forEach(([col, w]) => {
      g.strokeStyle = col; g.lineWidth = w;
      for (let i = 0; i < 4; i++) {           // four curved brackets: the classic anime anger mark
        g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 2);
        g.beginPath(); g.moveTo(14, -44); g.quadraticCurveTo(14, -14, 44, -14); g.stroke();
        g.restore();
      }
    });
    return new THREE.CanvasTexture(c);
  }

  window.createNimbus3D = function (canvas, url) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FRAME.fov, 1, 10, 2000);
    const camDist = FRAME.halfHeight / Math.tan(FRAME.fov / 2 * DEG);
    camera.position.set(0, FRAME.centerY + 6, camDist);
    camera.lookAt(0, FRAME.centerY, 0);

    scene.add(new THREE.HemisphereLight(0xf2f8ff, 0x7a90c0, 1.05));
    const key = new THREE.DirectionalLight(0xfff6ee, 0.9); key.position.set(-1.5, 2, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0ff, 0.7); rim.position.set(2, 1.5, -2.5); scene.add(rim);

    const anger = new THREE.Sprite(new THREE.SpriteMaterial({ map: angerTexture(), transparent: true, depthTest: false }));
    anger.renderOrder = 10; scene.add(anger);

    let model = null, B = null, rest = null;
    const hair = [];
    const loader = new THREE.GLTFLoader();
    if (THREE.DRACOLoader) { const d = new THREE.DRACOLoader(); d.setDecoderPath(DRACO_PATH); loader.setDRACOLoader(d); }
    loader.load(url, gltf => {
      const bones = {};
      gltf.scene.traverse(o => {
        if (o.isMesh) o.frustumCulled = false;      // skinned + quantized bounds are unreliable
        if (o.isBone) bones[o.name.replace(/_\d+$/, '')] = o;
      });
      const need = n => { if (!bones[n]) throw new Error('nimbus: bone missing ' + n); return bones[n]; };
      B = {
        spine1: need('Bip001-Spine1'), spine2: need('Bip001-Spine2'), neck: need('Bip001-Neck'), head: need('Bip001-Head'),
        arm: [1, -1].map(s => {
          const k = s > 0 ? 'L' : 'R';
          return { side: s, upper: need('Bip001-' + k + '-UpperArm'), fore: need('Bip001-' + k + '-Forearm'), hand: need('Bip001-' + k + '-Hand') };
        }),
        lids: ['BON_eyelid_up_L', 'BON_eyelid04_up_L', 'BON_eyelid05_up_L', 'BON_eyelid_up_R', 'BON_eyelid04_up_R', 'BON_eyelid05_up_R'].map(need),
        lowLids: ['BON_eyelid_lo_L', 'BON_eyelid_lo_R'].map(need),
        cornerL: need('Bon_zuiba_L'), cornerR: need('Bon_zuiba_R')
      };
      Object.keys(bones).forEach(n => {          // hair chains: the first two links of every strand
        const m = /^Bn_([FB])_hair(?:_mawei|\d+_)(0[01])$/.exec(n);
        if (m) hair.push({ bone: bones[n], back: m[1] === 'B', braid: n.includes('mawei'), link: +m[2], r1: Math.random() * 2 - 1, r2: Math.random() * 2 - 1, ph: Math.random() * 6.28 });
      });
      rest = new Map();
      Object.values(bones).forEach(b => rest.set(b, { p: b.position.clone(), q: b.quaternion.clone() }));
      model = gltf.scene;
      model.rotation.y = BODY_YAW;
      scene.add(model);
    }, undefined, err => { console.error('nimbus: model failed to load', err); });

    // ---------- bone helpers ----------
    const tq = new THREE.Quaternion(), pq = new THREE.Quaternion(), tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), ts = new THREE.Vector3();
    function rotateWorld(bone, axis, angle) {       // rotate a bone about a world axis
      if (!angle) return;
      bone.parent.getWorldQuaternion(pq);
      tq.setFromAxisAngle(axis, angle);
      bone.quaternion.premultiply(pq.clone().invert().multiply(tq).multiply(pq));
    }
    function aim(bone, child, dir) {                // point bone -> child along a world direction
      bone.updateMatrixWorld(true);
      bone.getWorldPosition(tv); child.getWorldPosition(tv2);
      tq.setFromUnitVectors(tv2.sub(tv).normalize(), dir);
      bone.getWorldQuaternion(pq);
      const world = tq.clone().multiply(pq);
      bone.parent.getWorldQuaternion(pq);
      bone.quaternion.copy(pq.invert().multiply(world));
    }
    function nudge(bone, headTurn, x, y, z) {       // move a face bone from rest by (x,y,z) cm in head space
      const r = rest.get(bone);
      tv.set(x, y, z).applyQuaternion(headTurn);
      bone.parent.getWorldQuaternion(pq);
      tv.applyQuaternion(pq.invert());
      bone.parent.getWorldScale(ts);
      bone.position.set(r.p.x + tv.x / ts.x, r.p.y + tv.y / ts.y, r.p.z + tv.z / ts.z);
    }
    function armDir(w, i, side) {
      const d = ARM.rest[i].clone().multiplyScalar(Math.max(0, 1 - w.brace - w.hips))
        .addScaledVector(ARM.brace[i], w.brace).addScaledVector(ARM.hips[i], w.hips);
      d.x *= side;
      return d.normalize().applyAxisAngle(AY, BODY_YAW);
    }

    // ---------- sizing + hit test ----------
    let lastW = 0, lastH = 0;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h || (w === lastW && h === lastH)) return;
      lastW = w; lastH = h;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), headSphere = new THREE.Sphere();
    function hitHair(cx, cy) {
      if (!model) return false;
      const r = canvas.getBoundingClientRect();
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return false;
      ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      B.head.getWorldPosition(headSphere.center);
      headSphere.center.y += 11; headSphere.radius = HEAD_HIT_RADIUS;
      return ray.ray.intersectsSphere(headSphere);
    }

    // ---------- one frame from the expression state ----------
    const AY = V(0, 1, 0), FWD = V(Math.sin(BODY_YAW), 0, Math.cos(BODY_YAW)), SIDE = V(Math.cos(BODY_YAW), 0, -Math.sin(BODY_YAW));
    const headTurn = new THREE.Quaternion();
    function draw(f) {
      resize();
      if (!model) { renderer.render(scene, camera); return; }
      const st = f.st, T = f.T, touch = f.touch || 0;
      rest.forEach((r, b) => { b.position.copy(r.p); b.quaternion.copy(r.q); });
      model.updateMatrixWorld(true);
      const mess = Math.max(0, Math.min(1.1, st.mess)), an = Math.max(0, st.anger), belt = clamp01(st.belt);

      // body: breathing, idle sway, scroll bank + shake, lean
      const shake = Math.sin(T * 58) * st.sh * 1.2;
      rotateWorld(B.spine1, FWD, -(st.bank + st.tilt * 0.6 + Math.sin(T * 0.8) * 0.8 - shake) * DEG);
      rotateWorld(B.spine1, SIDE, (st.lean - 1) * 1.8 + Math.sin(T * 1.5) * 0.012 - belt * 0.06);
      rotateWorld(B.spine2, AY, st.gx * 0.12);

      // head + neck follow her gaze; a little head shake when she's really annoyed
      const headRest = B.head.getWorldQuaternion(new THREE.Quaternion());
      rotateWorld(B.neck, AY, st.gx * 0.25);
      rotateWorld(B.head, AY, st.gx * 0.45);
      rotateWorld(B.neck, SIDE, st.gy * 0.18);
      rotateWorld(B.head, SIDE, st.gy * 0.28);
      rotateWorld(B.head, FWD, -st.tilt * 1.6 * DEG + an * 0.05 * Math.sin(T * 14) * Math.min(1, mess * 2));
      B.head.getWorldQuaternion(headTurn).multiply(headRest.invert());

      // eyelids: blink, half-lidded (smug / reading / annoyed), flinch
      const lh = Math.max(st.lid + st.flinch * 8, f.blink * 28) * 2;   // old drawing units: 56 = shut
      const shut = clamp01(lh / 56);
      B.lids.forEach(b => nudge(b, headTurn, 0, -LID_TRAVEL * shut, 0.15 * shut));
      B.lowLids.forEach(b => nudge(b, headTurn, 0, 0.25 * shut, 0));
      // mouth corners: smile / frown, and a one-sided smirk
      const curve = (st.mc - st.flinch * 0.8) * 0.18, smirk = st.ms * 0.45;
      nudge(B.cornerL, headTurn, smirk * 0.3, curve + smirk, 0);
      nudge(B.cornerR, headTurn, 0, curve, 0);

      // arms: rest -> brace (while you scroll) -> hands on hips (annoyed)
      const hips = clamp01(an * 1.4), w = { brace: clamp01(belt * (1 - hips)), hips };
      B.arm.forEach(a => {
        const d1 = armDir(w, 0, a.side);
        d1.x += Math.sin(T * 0.8 + a.side) * 0.03;
        aim(a.upper, a.fore, d1.normalize());
        aim(a.fore, a.hand, armDir(w, 1, a.side));
      });

      // hair: swings behind her (spring in st.hs) and gets ruffled when messy
      model.updateMatrixWorld(true);
      const swing = st.hs * 1.6 * DEG;
      hair.forEach((h, i) => {
        const k = (h.link ? 0.6 : 1) * (h.braid ? 0.3 : 1), jit = touch * 0.07 * Math.sin(T * 30 + i * 1.3);
        rotateWorld(h.bone, FWD, (swing * (h.back ? 1.4 : 0.7) + mess * 0.22 * h.r1 + jit) * k);
        rotateWorld(h.bone, SIDE, (mess * 0.16 * h.r2 + Math.sin(T * 1.2 + h.ph) * 0.02) * k);
      });

      // anger mark floats by her head and pulses
      B.head.getWorldPosition(anger.position);
      anger.position.add(V(12, 22, 6));
      anger.material.opacity = Math.min(1, an * 1.5);
      anger.scale.setScalar(Math.max(0.001, an * (1 + 0.12 * Math.sin(T * 9)) * 11));

      renderer.render(scene, camera);
    }

    return { draw, hitHair, resize };
  };
})();
