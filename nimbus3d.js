/* =====================================================================
   NIMBUS 3D: the mascot girl as a small three.js model (toon shaded, outlined).
   The page's mascot script keeps all the behaviour (reading, seatbelt, hair rubbing)
   and calls draw() every frame with its expression numbers.

     const nimbus = createNimbus3D(canvas);
     nimbus.draw({ st, T, blink, touch });   // st = the eased expression state
     nimbus.hitHair(clientX, clientY);       // true when the pointer is over her hair
   ===================================================================== */
(function () {
  'use strict';

  const COLOR = {
    skin: 0xfcdcd0, blush: 0xf5a3b3, hair: 0x9fd0f6, hairDeep: 0x82bbee, dress: 0xfcfcff,
    sock: 0xffffff, eye: 0x1a1420, line: 0x34507c, belt: 0x1b3a8a, buckle: 0xe6edf7,
    star: 0xffe27a, wing: 0xffffff, brow: 0x46679a, mouth: 0x7a3b4c, anger: '#ff4d6d'
  };
  const DEG = Math.PI / 180;
  const LID_STEPS = 16;             // pre-built eyelid shapes (0 = open, LID_STEPS = shut)
  const OUTLINE = 0.011;            // outline thickness in model units
  const FRAME = { centerY: 1.0, halfHeight: 1.12, fov: 20 };

  const clamp01 = v => Math.min(1, Math.max(0, v));

  // a 3-band ramp gives the soft cel-shaded look of the drawing
  function toonRamp() {
    const d = new Uint8Array([165, 165, 165, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
    const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  // inverted hull: the back faces pushed out along the normals draw the ink line
  function outlineMaterial(color) {
    return new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(color) }, w: { value: OUTLINE } },
      vertexShader: 'uniform float w; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * w, 1.0); }',
      fragmentShader: 'uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }',
      side: THREE.BackSide
    });
  }

  // a tapered hair strand hanging from y = 0 down to y = -len (round in x, flattened later in z)
  function strandGeometry(len, w) {
    const pts = [[0.0005, -len], [w * 0.35, -len * 0.9], [w * 0.85, -len * 0.55], [w, -len * 0.18], [w * 0.7, -0.01], [0.0005, 0.02]];
    return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 14);
  }

  function starShape(outer, inner) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? inner : outer, a = Math.PI / 2 + i * Math.PI / 5;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    return s;
  }

  function angerTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = COLOR.anger; g.lineWidth = 13; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {           // four curved brackets: the classic anime anger mark
      g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 2);
      g.beginPath(); g.moveTo(14, -44); g.quadraticCurveTo(14, -14, 44, -14); g.stroke();
      g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  function shadowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(10,42,102,0.45)'); r.addColorStop(1, 'rgba(10,42,102,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  window.createNimbus3D = function (canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FRAME.fov, 1, 0.5, 30);
    const camDist = FRAME.halfHeight / Math.tan(FRAME.fov / 2 * DEG);
    camera.position.set(0, FRAME.centerY + 0.15, camDist);
    camera.lookAt(0, FRAME.centerY, 0);

    scene.add(new THREE.HemisphereLight(0xeef7ff, 0x9fb6de, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 0.55); key.position.set(2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfe9ff, 0.3); rim.position.set(-2.5, 1.5, -3); scene.add(rim);

    const ramp = toonRamp();
    const toon = (color, extra) => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: ramp }, extra));
    const ink = outlineMaterial(COLOR.line);
    const inkSoft = outlineMaterial(0x6b86b3);
    const M = {
      skin: toon(COLOR.skin), hair: toon(COLOR.hair), hairDeep: toon(COLOR.hairDeep), dress: toon(COLOR.dress),
      sock: toon(COLOR.sock), eye: new THREE.MeshBasicMaterial({ color: COLOR.eye }), white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      wing: toon(COLOR.wing), brow: new THREE.MeshBasicMaterial({ color: COLOR.brow, depthTest: false }),
      mouth: new THREE.MeshBasicMaterial({ color: COLOR.mouth }),
      blush: new THREE.MeshBasicMaterial({ color: COLOR.blush, transparent: true, opacity: 0.45, depthWrite: false }),
      belt: toon(COLOR.belt, { side: THREE.DoubleSide, transparent: true }), buckle: toon(COLOR.buckle),
      star: toon(COLOR.star, { emissive: new THREE.Color(COLOR.star), emissiveIntensity: 0.3 })
    };

    function mesh(geo, mat, outline) {
      const m = new THREE.Mesh(geo, mat);
      if (outline) m.add(new THREE.Mesh(geo, outline));
      return m;
    }
    function blob(r, sx, sy, sz, mat, outline) {
      const m = mesh(new THREE.SphereGeometry(r, 28, 20), mat, outline);
      m.scale.set(sx, sy, sz);
      return m;
    }

    // ---------------- body (pivot = her feet) ----------------
    const root = new THREE.Group(); scene.add(root);
    const body = new THREE.Group(); root.add(body);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.38), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; root.add(shadow);

    [-1, 1].forEach(side => {
      const leg = mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.42, 16), M.skin, ink);
      leg.position.set(side * 0.09, 0.27, 0); body.add(leg);
      const sock = mesh(new THREE.CylinderGeometry(0.062, 0.058, 0.26, 16), M.sock, ink);
      sock.position.set(side * 0.09, 0.15, 0); body.add(sock);
      const foot = blob(0.07, 1, 0.62, 1.45, M.sock, ink);
      foot.position.set(side * 0.09, 0.04, 0.035); body.add(foot);
    });

    const dressPts = [[0.0005, 0.40], [0.35, 0.42], [0.37, 0.46], [0.25, 0.74], [0.16, 0.95], [0.12, 1.0], [0.0005, 1.0]];
    const dressGroup = new THREE.Group(); dressGroup.scale.z = 0.75; body.add(dressGroup);
    dressGroup.add(mesh(new THREE.LatheGeometry(dressPts.map(p => new THREE.Vector2(p[0], p[1])), 40), M.dress, ink));

    // seatbelt: a band that cinches around the dress, then the buckle clicks in
    const belt = new THREE.Group(); belt.position.y = 0.62; dressGroup.add(belt);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.315, 0.075, 48, 1, true), M.belt);
    belt.add(band);
    const buckle = mesh(new THREE.BoxGeometry(0.1, 0.09, 0.04), M.buckle, ink);
    buckle.position.set(0, 0.62, 0.32); dressGroup.add(buckle);

    [-1, 1].forEach(side => {
      const arm = new THREE.Group(); arm.position.set(side * 0.15, 0.94, 0); arm.rotation.z = side * 14 * DEG; body.add(arm);
      const upper = mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.4, 12), M.skin, ink); upper.position.y = -0.2; arm.add(upper);
      const hand = blob(0.045, 1, 1.1, 0.9, M.skin, ink); hand.position.y = -0.42; arm.add(hand);
    });
    const neck = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 12), M.skin); neck.position.y = 1.03; body.add(neck);

    // ---------------- head (pivot = top of the neck) ----------------
    const head = new THREE.Group(); head.position.y = 1.07; body.add(head);
    const face = new THREE.Group(); face.position.y = 0.42; head.add(face);
    face.add(blob(0.46, 1, 0.93, 0.92, M.skin, ink));

    // eyes: big glossy black ovals with highlights; eyelids are skin-coloured caps that slide down
    const lidGeos = [];
    for (let i = 0; i <= LID_STEPS; i++) lidGeos.push(new THREE.SphereGeometry(0.1, 24, 16, 0, Math.PI * 2, 0, Math.max(0.02, Math.PI * i / LID_STEPS)));
    const eyes = [-1, 1].map(side => {
      const g = new THREE.Group(); g.position.set(side * 0.17, -0.05, 0.36); g.rotation.y = side * 0.36; face.add(g);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), M.eye); ball.scale.set(0.82, 1.18, 0.35); g.add(ball);
      const shine = new THREE.Group(); g.add(shine);
      const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), M.white); h1.position.set(-0.025, 0.045, 0.035); h1.scale.z = 0.4; shine.add(h1);
      const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 6), M.white); h2.position.set(0.028, -0.05, 0.035); h2.scale.z = 0.4; shine.add(h2);
      const lidPivot = new THREE.Group(); g.add(lidPivot);
      const lid = new THREE.Mesh(lidGeos[0], M.skin); lid.scale.set(0.82 * 1.1, 1.18 * 1.08, 0.35 * 1.25); lidPivot.add(lid);
      const lash = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 6), M.eye);   // the lid's lower edge
      lash.rotation.z = Math.PI / 2; lash.visible = false; lidPivot.add(lash);
      const brow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8), M.brow);
      brow.scale.set(0.95, 0.2, 0.2); brow.position.set(side * 0.17, 0.13, 0.4); brow.renderOrder = 10; face.add(brow);
      return { g, shine, lidPivot, lid, lash, brow, side };
    });

    [-1, 1].forEach(side => {
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), M.blush);
      b.position.set(side * 0.29, -0.15, 0.345); b.rotation.y = side * 0.62; b.scale.y = 0.6; face.add(b);
    });

    const mouth = new THREE.Mesh(new THREE.BufferGeometry(), M.mouth);
    mouth.position.set(0, -0.215, 0.405); face.add(mouth);
    let mouthKey = '';
    function shapeMouth(w, curve, smirk) {
      const k = w.toFixed(3) + curve.toFixed(3) + smirk.toFixed(3);
      if (k === mouthKey) return;
      mouthKey = k;
      const path = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w, 0, 0), new THREE.Vector3(smirk * 0.035, -curve * 0.045, 0.012), new THREE.Vector3(w, smirk * 0.04, 0));
      mouth.geometry.dispose();
      mouth.geometry = new THREE.TubeGeometry(path, 10, 0.0085, 6, false);
    }

    // ---------------- hair ----------------
    const hairMeshes = [];
    function hairPiece(geo, mat, flatZ) {
      const m = mesh(geo, mat, inkSoft); m.scale.z = flatZ; hairMeshes.push(m); return m;
    }
    const cap = hairPiece(new THREE.SphereGeometry(0.5, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), M.hair, 1);
    cap.scale.set(1.04, 0.98, 0.98); cap.position.set(0, 0.03, -0.03); cap.rotation.x = -0.55; face.add(cap);

    // long strands swing as one group around the top of her head (the old hair layer rotated the same way)
    const swing = new THREE.Group(); swing.position.y = 0.4; face.add(swing);
    const strands = [];
    function addStrand(parent, x, y, z, yaw, splay, len, w, flat, mat, swingK) {
      const pivot = new THREE.Group(); pivot.position.set(x, y, z); pivot.rotation.order = 'YXZ'; pivot.rotation.y = yaw; parent.add(pivot);
      const m = hairPiece(strandGeometry(len, w), mat, flat); pivot.add(m);
      strands.push({ pivot, splay, swingK, r1: Math.random() * 2 - 1, r2: Math.random() * 2 - 1, ph: Math.random() * 6.28 });
    }
    for (let i = 0; i < 11; i++) {                            // back hair, longer on her left (screen right) like the drawing
      const phi = (95 + i * 17) * DEG, x = 0.45 * Math.sin(phi);
      const len = 1.15 + (x > 0 ? 0.32 : 0.05) + (i % 2) * 0.09;
      addStrand(swing, x, -0.28, 0.45 * Math.cos(phi), phi, 0.08 + Math.abs(Math.sin(phi)) * 0.1, len, 0.2, 0.42, i % 3 ? M.hair : M.hairDeep, 1);
    }
    [-1, 1].forEach(side => addStrand(swing, side * 0.4, -0.3, 0.12, side * 1.25, 0.05, 0.82, 0.11, 0.45, M.hair, 1));
    const bangs = [-58, -38, -19, 0, 19, 38, 58];               // fringe over the forehead
    bangs.forEach((a, i) => {
      const phi = a * DEG, len = Math.abs(a) > 40 ? 0.4 : 0.27;
      addStrand(face, 0.43 * Math.sin(phi), 0.32, 0.43 * Math.cos(phi) * 0.95, phi, -0.28, len, 0.085, 0.4, i % 2 ? M.hair : M.hairDeep, 0.15);
    });

    // fly-away strands that pop out of the top as her hair gets messy
    const frizz = [];
    for (let i = 0; i < 10; i++) {
      const a = -1.1 + i * 0.24, n = new THREE.Vector3(Math.sin(a) * 0.9, 0.85 + Math.cos(i * 1.7) * 0.15, -0.25 + (i % 3) * 0.12).normalize();
      const g = new THREE.Group(); g.position.copy(n).multiplyScalar(0.47).add(new THREE.Vector3(0, 0.03, -0.03));
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), n);
      g.add(hairPiece(strandGeometry(0.2 + (i % 3) * 0.05, 0.035), M.hair, 0.6));
      g.scale.setScalar(0.001); face.add(g); frizz.push(g);
    }

    // wing clip (top left of her head) and the star (right side)
    const wing = new THREE.Group(); wing.position.set(-0.36, 0.26, 0.3); wing.rotation.set(0.2, -0.6, 0.55); wing.scale.setScalar(1.25); face.add(wing);
    [[0, 0, 0.075], [0.03, -0.045, 0.06], [0.05, -0.085, 0.045]].forEach(f => {
      const feather = blob(f[2], 1.6, 0.55, 0.45, M.wing, inkSoft); feather.position.set(f[0] + f[2] * 0.6, f[1], 0); wing.add(feather);
    });
    const star = new THREE.Group(); star.position.set(0.38, -0.02, 0.3); star.rotation.y = 0.5; face.add(star);
    const starGeo = new THREE.ExtrudeGeometry(starShape(0.085, 0.038), { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2 });
    starGeo.center();
    star.add(mesh(starGeo, M.star, ink));

    const anger = new THREE.Sprite(new THREE.SpriteMaterial({ map: angerTexture(), transparent: true, depthTest: false }));
    anger.position.set(0.36, 0.36, 0.3); anger.renderOrder = 11; face.add(anger);

    // ---------------- sizing + hit test ----------------
    let lastW = 0, lastH = 0;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h || (w === lastW && h === lastH)) return;
      lastW = w; lastH = h;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function hitHair(cx, cy) {
      const r = canvas.getBoundingClientRect();
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return false;
      ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(hairMeshes, false).length > 0;
    }

    // ---------------- one frame from the expression state ----------------
    function draw(f) {
      const st = f.st, T = f.T, touch = f.touch || 0;
      resize();

      // whole body: pivot at her feet, sways, breathes, shakes, leans with the scroll
      const shakeX = Math.sin(T * 58) * st.sh * 0.006, shakeY = Math.cos(T * 47) * st.sh * 0.004;
      const sway = Math.sin(T * 0.8) * 0.6, breath = 1 + 0.006 * Math.sin(T * 1.5);
      root.position.set(shakeX, shakeY + Math.sin(T * 1.2) * 0.008, 0);
      root.rotation.set(0, -0.28 + st.gx * 0.22, -(st.bank + st.tilt * 0.6 + st.gx * 2.5 + sway) * DEG);
      body.scale.set(st.lean, st.lean * breath, st.lean);

      // head follows her gaze; the eyes add the last bit
      head.rotation.set(st.gy * 0.32, st.gx * 0.5, -st.tilt * 1.4 * DEG);
      eyes.forEach(e => {
        e.g.scale.setScalar(st.es);
        e.shine.position.set(st.gx * 0.012, -st.gy * 0.012, 0);
        const lh = Math.max(st.lid + st.flinch * 8, f.blink * 28) * 2;   // same units as the drawing (56 = shut)
        const shut = clamp01(lh / 56), step = Math.round(shut * LID_STEPS);
        e.lid.geometry = lidGeos[step];
        e.lid.visible = step > 0;
        e.lidPivot.rotation.z = e.side * (st.lidRot + st.flinch * 5) * DEG;
        const edge = Math.PI * step / LID_STEPS;           // where the lid's edge sits on the eye
        e.lash.visible = step > 0;
        e.lash.position.set(0, 0.118 * Math.cos(edge), 0.046 * Math.sin(edge));
        e.lash.scale.y = Math.max(0.02, 2 * 0.09 * Math.sin(edge));
      });

      // brows: relaxed -> angry (inner ends drop); the right brow lifts for the smirk
      const a = Math.max(0, st.ang + st.flinch * 0.25), r = Math.max(0, st.raise), show = Math.min(1, a * 1.4 + r);
      eyes.forEach(e => {
        const lift = e.side > 0 ? r * 0.045 : 0;
        e.brow.visible = show > 0.02;
        e.brow.scale.x = 0.95 * show;
        e.brow.position.y = 0.13 + lift - a * 0.01;
        e.brow.rotation.z = -e.side * a * 0.42 + (e.side > 0 ? r * 0.22 : 0);
      });

      shapeMouth(st.mw * 1.3 / 160, st.mc - st.flinch * 0.8, st.ms);

      // hair: the long hair swings behind her (spring in st.hs), puffs and frizzes as it gets messy
      const mess = Math.max(0, Math.min(1.1, st.mess));
      swing.rotation.z = -st.hs * 1.3 * DEG;
      swing.rotation.x = Math.sin(T * 0.9) * 0.015;
      strands.forEach((s, i) => {
        const jitter = touch * 0.12 * Math.sin(T * 32 + i * 1.7);
        s.pivot.rotation.x = -(Math.abs(s.splay) + mess * 0.55 * Math.abs(s.r1)) + Math.sin(T * 1.3 + s.ph) * 0.02 * s.swingK;
        s.pivot.rotation.z = mess * 0.5 * s.r2 * s.swingK + jitter;
        s.pivot.scale.set(1 + 0.3 * mess, 1, 1 + 0.3 * mess);
      });
      cap.scale.set(1.04 * (1 + 0.04 * mess), 0.98 * (1 + 0.05 * mess), 0.98 * (1 + 0.04 * mess));
      frizz.forEach((g, i) => {
        const p = clamp01((mess * 1.05 - (0.05 + i * 0.05)) / 0.12);
        g.scale.setScalar(Math.max(0.001, p * (1 + touch * 0.2 * Math.sin(T * 25 + i))));
      });

      // seatbelt cinches in, buckle clicks with a little overshoot
      const b = Math.max(0, st.belt), bs = Math.min(1, b);
      belt.visible = b > 0.01;
      band.material.opacity = bs;
      belt.scale.set(1 + (1 - bs) * 0.7, 1, 1 + (1 - bs) * 0.7);
      const k = Math.max(0, (b - 0.55) / 0.45);
      buckle.visible = k > 0.01;
      buckle.scale.setScalar(Math.max(0.001, k * (1 + Math.max(0, b - 1) * 1.2)));
      buckle.rotation.z = (1 - Math.min(1, k)) * -25 * DEG;

      // star twinkles and spins; anger mark pulses
      star.scale.setScalar(Math.max(0.001, st.star));
      star.rotation.z = Math.sin(T * 0.7) * 0.25;
      M.star.emissiveIntensity = 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(T * 2.8));
      const an = Math.max(0, st.anger);
      anger.material.opacity = Math.min(1, an * 1.5);
      anger.scale.setScalar(Math.max(0.001, an * (1 + 0.12 * Math.sin(T * 9)) * 0.24));

      renderer.render(scene, camera);
    }

    return { draw, hitHair, resize };
  };
})();
