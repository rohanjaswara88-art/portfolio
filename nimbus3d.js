/* =====================================================================
   NIMBUS 3D: the corner mascot, a rigged glTF model (models/daffodill-anim.glb).
   The page's mascot script keeps all the behaviour (reading, scrolling, hair rubbing)
   and calls draw() every frame with its eased expression numbers.

     const nimbus = createNimbus3D(canvas, 'models/daffodill-anim.glb');
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
  const FULL = { centerY: 92, halfHeight: 104 };              // tour framing: her whole body (she flies around)
  const HIP = 100;                                            // cm: she pitches forward around her hips when flying
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
    hips:  [V(0.85, -0.7, -0.15), V(-0.75, -0.75, 0.2)], // hands on hips: annoyed
    fly:   [V(0.3, -1, -0.5), V(0.15, -1, -0.65)]        // gliding: arms swept back
  };
  // leg poses in her body space (x = her left): [thigh -> knee, calf -> ankle]
  const LEG = {
    fly:    [V(0.06, -1, -0.2), V(0, -0.75, -0.66)],    // gliding: knees bent back
    crouch: [V(0.08, -0.65, 0.75), V(0, -1, -0.25)],    // take-off: knees pulled up
    flare:  [V(0.06, -1, 0.4), V(0, -1, 0.12)],         // landing: legs swing under her
    hover:  [V(0.05, -1, 0.02), V(0, -1, -0.14)]        // floating: relaxed, slightly bent
  };
  const ARM_EXTRA = {
    crouch: [V(0.2, -1, 0.35), V(0.1, -0.9, 0.55)],
    flare:  [V(0.75, -0.45, 0.45), V(0.55, -0.25, 0.7)], // arms out to catch herself
    reach:  [V(0.12, 1, 0.1), V(0.05, 1, 0.12)],         // climbing: one fist up
    fast:   [V(0.22, -1, -0.95), V(0.1, -1, -1)]         // top speed: arms swept far back
  };
  const WIND_BEND = 1.0;            // radians a cloth chain bends at full speed
  // "tour" input from tour.js: whole-body poses on top of the expression state
  const NO_TOUR = { zoom: 0, fly: 0, yaw: null, bob: 0, point: 0, pointSide: 1, pointDir: [0, 0, 1], wave: 0, waveSide: 1, talk: 0,
    speed: 0, vel: [0, 0], crouch: 0, flare: 0, roll: 0 };
  const lerp = (a, b, t) => a + (b - a) * t;

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

    let model = null, B = null, rest = null, dyn = null, body = null;   // body = whole-body life layer (nimbus-body.js)
    const player = window.NimbusMotion ? NimbusMotion.createPlayer() : null;   // hand-keyed clips (tour)
    let lastT = 0;
    // Blender-made clips (idle, talk, waveL/R, takeoff, glide, land) played by an AnimationMixer
    let mixer = null, acts = {}, playing = '', finished = false, talkHold = 0;
    const NEXT = { takeoff: 'glide', land: 'idle', waveL: 'idle', waveR: 'idle' };
    const FADE = { takeoff: 0.15, glide: 0.3, land: 0.2, idle: 0.6, talk: 0.6, waveL: 0.35, waveR: 0.35 };
    function wantClip(tp, dt) {
      talkHold = tp.talk > 0.25 ? 1.2 : Math.max(0, talkHold - dt);           // don't flip between words
      const s = tp.state;
      if (s === 'takeoff' || s === 'glide' || s === 'land') return s;
      if (tp.wave > 0.3) return tp.waveSide > 0 ? 'waveL' : 'waveR';
      return s && talkHold > 0 ? 'talk' : 'idle';
    }
    let requested = '';
    function driveClips(tp, dt) {
      const want = wantClip(tp, dt);
      let name = want;
      if (want === requested && finished && NEXT[playing]) name = NEXT[playing];     // one-shot done -> its follow-up
      else if (want === requested) name = playing || want;
      if (want !== requested) { requested = want; }
      if (name !== playing && acts[name]) {
        const next = acts[name], prev = acts[playing];
        next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
        const fade = playing === 'glide' && (name === 'idle' || name === 'talk') ? 1.3 : (FADE[name] || 0.4);
        if (prev) prev.crossFadeTo(next, fade, false);
        playing = name; finished = false;
      }
      mixer.update(dt);
    }
    const lastVel = new THREE.Vector3(), velW = new THREE.Vector3(), inertia = new THREE.Vector3(), windW = new THREE.Vector3();
    const hair = [], cloth = [];       // cloth = coat tails, chains, trouser panels, rope, hair strands (wind)
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
        pelvis: need('Bip001-Pelvis'), spine0: need('Bip001-Spine'), spine1: need('Bip001-Spine1'), spine2: need('Bip001-Spine2'), neck: need('Bip001-Neck'), head: need('Bip001-Head'),
        arm: [1, -1].map(s => {
          const k = s > 0 ? 'L' : 'R';
          return { side: s, upper: need('Bip001-' + k + '-UpperArm'), fore: need('Bip001-' + k + '-Forearm'), hand: need('Bip001-' + k + '-Hand') };
        }),
        lids: ['BON_eyelid_up_L', 'BON_eyelid04_up_L', 'BON_eyelid05_up_L', 'BON_eyelid_up_R', 'BON_eyelid04_up_R', 'BON_eyelid05_up_R'].map(need),
        lowLids: ['BON_eyelid_lo_L', 'BON_eyelid_lo_R'].map(need),
        cornerL: need('Bon_zuiba_L'), cornerR: need('Bon_zuiba_R'),
        lowerLip: [['Bon_Lolip_M', 0.4], ['Bon_Lolip01_L', 0.3], ['Bon_Lolip01_R', 0.3], ['Bon_Lolip02_L', 0.15], ['Bon_Lolip02_R', 0.15], ['Bon_yachi_lo', 0.3]]
          .map(([n, k]) => ({ bone: need(n), k })),
        leg: [1, -1].map(s => {
          const k = s > 0 ? 'L' : 'R';
          return { side: s, thigh: need('Bip001-' + k + '-Thigh'), calf: need('Bip001-' + k + '-Calf'), foot: need('Bip001-' + k + '-Foot') };
        })
      };
      Object.keys(bones).forEach(n => {          // hair chains: the first two links of every strand
        const m = /^Bn_([FB])_hair(?:_mawei|\d+_)(0[01])$/.exec(n);
        if (m) hair.push({ bone: bones[n], back: m[1] === 'B', braid: n.includes('mawei'), link: +m[2], r1: Math.random() * 2 - 1, r2: Math.random() * 2 - 1, ph: Math.random() * 6.28 });
      });
      // spring physics chains: coat tails, chains, trouser panels, rope, hair. Links root first;
      // each link's tip is its child bone. Softer settings = floppier.
      const groups = {};
      Object.keys(bones).forEach(n => {
        let m = /^(Bone_Chain_[FH]|Bn_[BL]_legpd_[AB]|Bn_[RB]_pigu_pd_[AB])(\d\d)$/.exec(n), kind = 'cloth';
        if (!m) { m = /^(Bn_F_shengzi_A)(\d\d)$/.exec(n); kind = 'rope'; }
        if (!m) { m = /^(Bn_[FB]_hair(?:_mawei|\d+_))(\d\d)$/.exec(n); kind = 'hair'; }
        if (m) (groups[m[1]] = groups[m[1]] || { kind, list: [] }).list.push({ bone: bones[n], link: +m[2] });
      });
      const PHYS = {
        cloth: { stiff: 70, damp: 7, air: 1.3, gravity: 220 },
        rope:  { stiff: 40, damp: 5, air: 1.0, gravity: 320 },
        hair:  { stiff: 150, damp: 11, air: 0.7, gravity: 120 }
      };
      Object.values(groups).forEach(g => {
        g.list.sort((a, b) => a.link - b.link);
        const links = g.list.map(c => ({ bone: c.bone, tip: c.bone.children.find(x => x.isBone) })).filter(L => L.tip);
        if (links.length) cloth.push(Object.assign({ links }, PHYS[g.kind]));
      });
      if (window.NimbusMotion) dyn = NimbusMotion.createDynamics(cloth);
      gltf.scene.updateMatrixWorld(true);
      if (window.NimbusBody) body = NimbusBody.create(bones, { rotateWorld, aimBlend, AY, FWD, SIDE, get model() { return model; } });
      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach(c => {
          const a = mixer.clipAction(c);
          if (NEXT[c.name]) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
          acts[c.name] = a;
        });
        mixer.addEventListener('finished', e => { if (acts[playing] === e.action) finished = true; });
      }
      rest = new Map();
      Object.values(bones).forEach(b => rest.set(b, { p: b.position.clone(), q: b.quaternion.clone() }));
      model = gltf.scene;
      model.rotation.order = 'YXZ';
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
    // an arm direction in her own body space (x = her left), blended between poses
    function armLocal(w, i, side, tp, T, cp, clipW) {
      const d = ARM.rest[i].clone().multiplyScalar(Math.max(0, 1 - w.brace - w.hips))
        .addScaledVector(ARM.brace[i], w.brace).addScaledVector(ARM.hips[i], w.hips);
      if (tp.fly > 0) d.normalize().lerp(ARM.fly[i], tp.fly);
      if (tp.fly > 0 && tp.speed > 0) d.normalize().lerp(ARM_EXTRA.fast[i], tp.fly * tp.speed * 0.6);
      if (tp.crouch > 0) d.normalize().lerp(ARM_EXTRA.crouch[i], tp.crouch);
      if (tp.flare > 0) d.normalize().lerp(ARM_EXTRA.flare[i], tp.flare);
      const climb = Math.max(0, -tp.vel[1]) * tp.speed * tp.fly;
      if (climb > 0.05 && side === 1) d.normalize().lerp(ARM_EXTRA.reach[i], Math.min(1, climb * 1.6));
      if (cp && clipW > 0) {                          // hand-keyed clip pose (stored with x = her left)
        const cv = cp[side > 0 ? (i ? 'aLf' : 'aLu') : (i ? 'aRf' : 'aRu')];
        d.normalize().lerp(V(cv[0] * side, cv[1], cv[2]).normalize(), clipW);
      }
      if (tp.wave > 0 && side === tp.waveSide) {
        const wave = i === 0 ? V(0.8, 0.6, 0.25) : V(0.15 + 0.38 * Math.sin(T * 9), 1, 0.2);
        d.normalize().lerp(wave, tp.wave);
      }
      d.x *= side;
      return d.normalize();
    }
    function aimBlend(bone, child, dirW, w) {       // turn a bone part of the way toward a world direction
      bone.updateMatrixWorld(true);
      bone.getWorldPosition(tv); child.getWorldPosition(tv2);
      const cur = tv2.sub(tv).normalize();
      aim(bone, child, cur.lerp(dirW, w).normalize());
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

    // ---------- momentum layer: her body answers her real velocity, acceleration and turning ----------
    // Damped springs stepped in fixed 1/120 s slices (frame-rate independent). The core leans into the
    // acceleration first; the head re-levels a beat later; arms then forearms, thighs then shins trail
    // behind and settle with a little overshoot; on a turn the hips lead and the chest and head counter.
    const MS = (w, z) => ({ x: V(), v: V(), w, z });
    // well damped (zeta 0.8-0.9): limbs follow and settle softly instead of swinging past and back
    const MO = { core: MS(5.5, 0.9), head: MS(3.4, 0.95), arm: MS(3.8, 0.8), fore: MS(3.0, 0.78),
                 leg: MS(3.3, 0.82), shin: MS(2.6, 0.8), twist: MS(4.5, 0.9) };
    const mA = V(), mVel = V(), mPrev = V(), mAcc = V(), mDrive = V(), mAx = V(), mTw = V(), mH = V(), UPV = V(0, 1, 0);
    let mPrevYaw = null, mInit = false;
    function springStep(s, target, dt) {
      for (let t = dt; t > 1e-6;) {
        const h = Math.min(1 / 120, t); t -= h;
        mA.copy(target).sub(s.x).multiplyScalar(s.w * s.w).addScaledVector(s.v, -2 * s.z * s.w);
        s.v.addScaledVector(mA, h); s.x.addScaledVector(s.v, h);
      }
    }
    function tiltToward(bone, vec, k, max) {       // tip a bone's far end toward a (world) direction
      mH.set(vec.x, 0, vec.z);
      const m = mH.length(); if (m < 1e-4) return;
      mAx.crossVectors(UPV, mH).normalize();
      rotateWorld(bone, mAx, Math.sign(k) * Math.min(max, m * Math.abs(k)));
    }
    function momentum(tp, dt, yaw, cmPerPx) {
      const vp = tp.velPx || [0, 0];
      mVel.set(vp[0] * cmPerPx, -vp[1] * cmPerPx, 0);
      if (!mInit) { mPrev.copy(mVel); mPrevYaw = yaw; mInit = true; }
      if (dt > 0) {
        mAcc.copy(mVel).sub(mPrev).multiplyScalar(1 / dt);
        mPrev.copy(mVel);
        // what the body feels: acceleration plus air drag at speed (both in rough "g" units)
        mDrive.copy(mAcc).multiplyScalar(1 / 1100).addScaledVector(mVel, 0.3 / 300).clampLength(0, 1.0);
        springStep(MO.core, mDrive, dt);
        springStep(MO.head, MO.core.x, dt);
        springStep(MO.arm, mDrive, dt);
        springStep(MO.fore, MO.arm.x, dt);
        springStep(MO.leg, mDrive, dt);
        springStep(MO.shin, MO.leg.x, dt);
        const yr = Math.max(-6, Math.min(6, (yaw - mPrevYaw) / dt)); mPrevYaw = yaw;
        springStep(MO.twist, mTw.set(Math.max(-0.35, Math.min(0.35, yr * 0.12)), 0, 0), dt);
      }
      const c = MO.core.x, hd = MO.head.x, ar = MO.arm.x, fo = MO.fore.x, lg = MO.leg.x, sh = MO.shin.x, tw = MO.twist.x.x;
      // core: the torso leans into the push, spread down the spine (hips least, chest most);
      // pushing up compresses (a little forward flex), dropping opens the chest
      [[B.pelvis, 0.07], [B.spine0, 0.09], [B.spine1, 0.12], [B.spine2, 0.13]].forEach(([b, k]) => tiltToward(b, c, k, 0.16));
      rotateWorld(B.spine1, SIDE, c.y * 0.06); rotateWorld(B.spine2, SIDE, c.y * 0.05);
      // head stabilisation: it rides with the chest, then re-levels (keeps her eyes steady)
      tiltToward(B.neck, hd, -0.16, 0.2); tiltToward(B.head, hd, -0.2, 0.24);
      // turning: hips lead, chest and head counter-rotate
      rotateWorld(B.pelvis, AY, tw); rotateWorld(B.spine2, AY, -0.5 * tw); rotateWorld(B.neck, AY, -0.25 * tw); rotateWorld(B.head, AY, -0.2 * tw);
      // limbs trail the push and swing back with overshoot; dropping lifts the arms out, rising tucks them in
      B.arm.forEach(a => {
        tiltToward(a.upper, ar, 0.55, 0.5);
        rotateWorld(a.upper, FWD, a.side * -ar.y * 0.3);
        tiltToward(a.fore, fo, 0.45, 0.45);
      });
      B.leg.forEach(l => {
        tiltToward(l.thigh, lg, 0.45, 0.45);
        tiltToward(l.calf, sh, 0.4, 0.4);
        rotateWorld(l.calf, SIDE, -Math.max(-0.4, Math.min(0.4, sh.y * 0.35)));   // rising: knees fold under
      });
    }

    // ---------- one frame from the expression state ----------
    const AY = V(0, 1, 0), FWD = V(), SIDE = V(), PIVOT = V(0, HIP, 0);
    const headTurn = new THREE.Quaternion();
    function frameCamera(zoom) {
      const cy = lerp(FRAME.centerY, FULL.centerY, zoom), hh = lerp(FRAME.halfHeight, FULL.halfHeight, zoom);
      camera.position.set(0, cy + 6 * (1 - zoom), hh / Math.tan(FRAME.fov / 2 * DEG));
      camera.lookAt(0, cy, 0);
    }
    function draw(f) {
      resize();
      const tp = f.tour || NO_TOUR;
      frameCamera(tp.zoom);
      if (!model) { renderer.render(scene, camera); return; }
      const st = f.st, T = f.T, touch = f.touch || 0;
      rest.forEach((r, b) => { b.position.copy(r.p); b.quaternion.copy(r.q); });
      const fdt = Math.min(0.3, Math.max(0, T - lastT)); lastT = T;
      const M = !!mixer;                     // body comes from the Blender clips; code adds gaze, face, pointing, reactions
      if (M) driveClips(tp, Math.min(0.1, fdt));

      // whole body: facing, lean from speed (more when flying sideways), nose up when climbing,
      // tuck on take-off, flare back on landing; pivot = her hips; floating bob
      const yaw = tp.yaw == null ? BODY_YAW : tp.yaw;
      const side = Math.abs(tp.vel[0]), up = -tp.vel[1];
      const pitch = tp.fly * (0.12 + 0.55 * tp.speed * (0.35 + 0.65 * side)) - up * tp.speed * tp.fly * 0.25
        + tp.crouch * 0.25 - tp.flare * 0.4;
      // hand-keyed clip (tour): it owns the body pose, faded in with the full-body framing
      const clipW = !M && tp.state && player ? tp.zoom : 0;
      let cp = null;
      if (clipW > 0) { player.play(tp.state, T); cp = player.sample(T); }
      const bodyPitch = cp ? pitch * (1 - clipW) + (cp.pitch + (player.state === 'hover' ? 0.25 * tp.speed : 0)) * clipW : pitch;
      model.rotation.set(M ? 0 : bodyPitch, yaw, tp.roll + (cp ? cp.roll * clipW : 0));
      model.position.copy(PIVOT).sub(PIVOT.clone().applyEuler(model.rotation));
      if (!M) model.position.y += tp.bob * Math.sin(T * 2.2);
      FWD.set(Math.sin(yaw), 0, Math.cos(yaw)); SIDE.set(Math.cos(yaw), 0, -Math.sin(yaw));
      model.updateMatrixWorld(true);
      const mess = Math.max(0, Math.min(1.1, st.mess)), an = Math.max(0, st.anger), belt = clamp01(st.belt);

      // body: breathing, idle sway, scroll bank + shake, lean
      const shake = Math.sin(T * 58) * st.sh * 1.2;
      if (M) momentum(tp, Math.min(0.1, fdt), yaw, 2 * lerp(FRAME.halfHeight, FULL.halfHeight, tp.zoom) / Math.max(1, canvas.clientHeight));
      const own = M ? 0 : 1;                   // the clips already breathe and sway
      rotateWorld(B.spine1, FWD, -(st.bank + st.tilt * 0.6 + own * Math.sin(T * 0.8) * 0.8 - shake) * DEG);
      rotateWorld(B.spine1, SIDE, (st.lean - 1) * 1.8 + own * Math.sin(T * 1.5) * 0.012 - belt * 0.06);
      rotateWorld(B.spine2, AY, st.gx * 0.12);
      if (cp) {
        rotateWorld(B.spine1, SIDE, cp.spine[0] * clipW); rotateWorld(B.spine1, AY, cp.spine[1] * clipW); rotateWorld(B.spine1, FWD, -cp.spine[2] * clipW);
        rotateWorld(B.spine2, SIDE, cp.chest[0] * clipW); rotateWorld(B.spine2, AY, cp.chest[1] * clipW); rotateWorld(B.spine2, FWD, -cp.chest[2] * clipW);
      }

      // head + neck follow her gaze; a little head shake when she's really annoyed
      const headRest = B.head.getWorldQuaternion(new THREE.Quaternion());
      rotateWorld(B.neck, AY, st.gx * 0.25);
      rotateWorld(B.head, AY, st.gx * 0.45);
      rotateWorld(B.neck, SIDE, st.gy * 0.18);
      rotateWorld(B.head, SIDE, st.gy * 0.28);
      rotateWorld(B.head, FWD, -st.tilt * 1.6 * DEG + an * 0.05 * Math.sin(T * 14) * Math.min(1, mess * 2));
      if (cp) { rotateWorld(B.head, SIDE, cp.head[0] * clipW); rotateWorld(B.head, AY, cp.head[1] * clipW); rotateWorld(B.head, FWD, -cp.head[2] * clipW); }
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
      // talking: the lower lip and jaw open and close in an uneven rhythm
      const open = tp.talk * (0.3 + 0.7 * Math.abs(Math.sin(T * 13) * Math.sin(T * 7.3 + 1)));
      if (open > 0.01) B.lowerLip.forEach(l => nudge(l.bone, headTurn, 0, -l.k * open, 0));

      if (body && !M) body.torso(T, cp, clipW);

      // arms: rest -> brace (while you scroll) -> hands on hips (annoyed)
      const hips = clamp01(an * 1.4), w = { brace: clamp01(belt * (1 - hips)), hips };
      const pointW = V().fromArray(tp.pointDir).normalize();
      const react = Math.max(w.brace, w.hips);
      if (M) B.arm.forEach(a => {              // clip arms; scroll-brace / hands-on-hips / pointing blend over them
        [0, 1].forEach(i => {
          const bone = i ? a.fore : a.upper, child = i ? a.hand : a.fore;
          if (react > 0.01) aimBlend(bone, child, armLocal(w, i, a.side, NO_TOUR, T, null, 0).applyQuaternion(model.quaternion), react);
          // pointing: the upper arm stays lower and closer to the body so the elbow keeps a natural bend
          if (tp.point > 0 && a.side === tp.pointSide) aimBlend(bone, child, (i === 0 ? pointW.clone().multiplyScalar(0.8).add(V(-a.side * 0.12, -0.6, 0)) : pointW.clone()).normalize(), tp.point * (i === 0 ? 0.9 : 1));
        });
      });
      else B.arm.forEach(a => {
        const dirs = [0, 1].map(i => {
          const d = armLocal(w, i, a.side, tp, T, cp, clipW);
          if (i === 0) d.x += Math.sin(T * 0.8 + a.side) * 0.03;
          d.normalize().applyQuaternion(model.quaternion);
          if (tp.point > 0 && a.side === tp.pointSide) d.lerp(i === 0 ? pointW.clone().add(V(0, -0.25, 0)) : pointW, tp.point);
          return d.normalize();
        });
        aim(a.upper, a.fore, dirs[0]);
        aim(a.fore, a.hand, dirs[1]);
      });

      // legs: slow kicks while gliding, tucked on take-off, swung under on landing, relaxed while hovering
      const hoverW = tp.zoom * 0.6 * (1 - tp.fly);
      const legW = { fly: tp.fly, crouch: tp.crouch, flare: tp.flare, hover: hoverW };
      const legSum = legW.fly + legW.crouch + legW.flare + legW.hover;
      if (M) { /* legs come from the clips */ }
      else if (cp) B.leg.forEach(l => {                     // clip legs
        const t = cp[l.side > 0 ? 'lLt' : 'lRt'], c = cp[l.side > 0 ? 'lLc' : 'lRc'];
        aimBlend(l.thigh, l.calf, V(t[0], t[1], t[2]).normalize().applyQuaternion(model.quaternion), clipW);
        aimBlend(l.calf, l.foot, V(c[0], c[1], c[2]).normalize().applyQuaternion(model.quaternion), clipW);
      });
      else if (legSum > 0.01) B.leg.forEach(l => {
        const kick = Math.sin(T * 2.4 + l.side * 1.7), dangle = Math.sin(T * 1.4 + l.side);
        [0, 1].forEach(i => {
          const d = V();
          Object.keys(legW).forEach(k => { if (legW[k] > 0) d.addScaledVector(LEG[k][i], legW[k]); });
          if (i === 0) { d.z += 0.18 * kick * tp.fly + 0.06 * dangle * hoverW; d.x *= l.side; }
          else d.z += 0.15 * Math.sin(T * 2.4 + l.side * 1.7 + 0.8) * tp.fly;
          d.normalize().applyQuaternion(model.quaternion);
          if (i === 0) aimBlend(l.thigh, l.calf, d, Math.min(1, legSum));
          else aimBlend(l.calf, l.foot, d, Math.min(1, legSum));
        });
      });

      // whole-body life: wrists, fingers, toes, slow drift on every joint, then joint springs
      if (body && !M) {
        body.extremities(T, cp, clipW, tp);
        body.drift(T, 0.7 + 0.3 * tp.zoom, tp.speed * clipW);
        body.settle(fdt);
      }

      // hair: swings behind her (spring in st.hs) and gets ruffled when messy
      model.updateMatrixWorld(true);
      const swing = st.hs * 1.6 * DEG;
      hair.forEach((h, i) => {
        const k = (h.link ? 0.6 : 1) * (h.braid ? 0.3 : 1), jit = touch * 0.07 * Math.sin(T * 30 + i * 1.3);
        rotateWorld(h.bone, FWD, (swing * (h.back ? 1.4 : 0.7) + mess * 0.22 * h.r1 + jit) * k);
        rotateWorld(h.bone, SIDE, (mess * 0.16 * h.r2 + Math.sin(T * 1.2 + h.ph) * 0.02) * k);
      });

      // spring physics for coat, chains, trouser panels, rope and hair: they lag her motion,
      // swing, overshoot and stream back in the air while she flies
      const dt = Math.min(0.05, fdt);
      if (dyn && dt > 0) {
        const cmPerPx = 2 * lerp(FRAME.halfHeight, FULL.halfHeight, tp.zoom) / Math.max(1, canvas.clientHeight);
        const vp = tp.velPx || [0, 0];
        velW.set(vp[0] * cmPerPx, -vp[1] * cmPerPx, 0);
        inertia.copy(velW).sub(lastVel).multiplyScalar(-1 / dt).clampLength(0, 2500);   // she speeds up -> cloth lags
        lastVel.copy(velW);
        windW.copy(velW).multiplyScalar(-1);                                             // air rushing past
        windW.x += Math.sin(T * 0.7) * 6 * tp.zoom; windW.z += Math.cos(T * 0.5) * 5 * tp.zoom;   // a light breeze while floating
        model.updateMatrixWorld(true);
        dyn.step(dt, inertia, windW);
      }

      // anger mark floats by her head and pulses
      B.head.getWorldPosition(anger.position);
      anger.position.add(V(12, 22, 6));
      anger.material.opacity = Math.min(1, an * 1.5);
      anger.scale.setScalar(Math.max(0.001, an * (1 + 0.12 * Math.sin(T * 9)) * 11));

      renderer.render(scene, camera);
    }

    return { draw, hitHair, resize, restYaw: BODY_YAW, get root() { return model; }, get clip() { return playing; } };
  };
})();
