/* =====================================================================
   NIMBUS MOTION: hand-keyed animation clips + spring physics for the mascot.

   Clips are keyframed full-body poses (like an animator's key poses) played on smooth
   Catmull-Rom curves. Body parts sample the clip slightly late (head, arms, legs trail the
   torso) so motion flows through her instead of everything moving at once.

   Pose space (her own body): x = her left, y = up, z = forward (toward her face).
   Arm / leg entries are directions: [upper arm -> elbow, forearm -> wrist], [thigh -> knee, calf -> ankle].
   Angles are radians: pitch + = lean forward; spine/chest/head [bend forward, twist to her left, tilt to her left].

   Used by nimbus3d.js:  NimbusMotion.createPlayer(), NimbusMotion.createDynamics(chains)
   ===================================================================== */
(function () {
  'use strict';

  // ---------------- pose helpers ----------------
  const VEC = ['aLu', 'aLf', 'aRu', 'aRf', 'lLt', 'lLc', 'lRt', 'lRc'];
  const ANG = ['spine', 'chest', 'head'];
  const mir = v => [-v[0], v[1], v[2]];
  // a full pose = the hover base plus overrides. Arms / legs given for her left are mirrored to her right unless set.
  function P(o) {
    const p = Object.assign({}, BASE, o);
    if (o.aL) { p.aLu = o.aL[0]; p.aLf = o.aL[1]; if (!o.aR) { p.aRu = mir(o.aL[0]); p.aRf = mir(o.aL[1]); } }
    if (o.aR) { p.aRu = o.aR[0]; p.aRf = o.aR[1]; }
    if (o.lL) { p.lLt = o.lL[0]; p.lLc = o.lL[1]; if (!o.lR) { p.lRt = mir(o.lL[0]); p.lRc = mir(o.lL[1]); } }
    if (o.lR) { p.lRt = o.lR[0]; p.lRc = o.lR[1]; }
    delete p.aL; delete p.aR; delete p.lL; delete p.lR;
    return p;
  }
  const BASE = {
    pitch: 0.04, roll: 0, spine: [0.03, 0, 0], chest: [0, 0, 0], head: [-0.02, 0, 0],
    curl: 0.45, wrist: 0.1, footPt: 0.35,           // finger curl 0..1, wrist trail, toe point
    aLu: [0.32, -1, 0.12], aLf: [0.18, -1, 0.38], aRu: [-0.32, -1, 0.12], aRf: [-0.18, -1, 0.38],
    lLt: [0.07, -1, 0.1], lLc: [0, -1, -0.28], lRt: [-0.05, -1, -0.03], lRc: [0, -1, -0.12]
  };

  // ---------------- the clips (floating-glide style) ----------------
  const CLIPS = {
    // floating in place while she talks: slow breathing sway, contrapposto legs, arms relaxed away from the body
    hover: {
      loop: true, dur: 3.6,
      keys: [
        { t: 0, ...P({}) },
        { t: 1.8, ...P({
          pitch: 0.07, roll: -0.025, spine: [0.06, 0.02, -0.015], chest: [0.02, -0.02, 0], head: [0.01, 0.02, -0.025], curl: 0.52, wrist: 0.16, footPt: 0.42,
          aL: [[0.36, -0.95, 0.18], [0.24, -0.95, 0.46]], aR: [[-0.3, -1, 0.08], [-0.14, -1, 0.3]],
          lL: [[0.06, -1, 0.04], [0, -1, -0.18]], lR: [[-0.06, -1, 0.08], [0, -1, -0.27]]
        }) },
        { t: 3.6, ...P({}) }
      ]
    },
    // gather (knees up, arms in), spring (arched, arms sweep back), stretch into the glide
    takeoff: {
      loop: false, dur: 0.8, next: 'glide',
      keys: [
        { t: 0, ...P({}) },
        { t: 0.24, ...P({
          pitch: 0.22, spine: [0.28, 0, 0], chest: [0.1, 0, 0], head: [-0.18, 0, 0], curl: 0.7, wrist: -0.1, footPt: 0.15,
          aL: [[0.28, -0.9, 0.45], [0.12, -0.55, 0.85]], lL: [[0.08, -0.5, 0.85], [0, -1, -0.32]]
        }) },
        { t: 0.46, ...P({
          pitch: 0.42, spine: [-0.14, 0, 0], chest: [-0.08, 0, 0], head: [-0.32, 0, 0], curl: 0.12, wrist: 0.75, footPt: 0.95,
          aL: [[0.32, -0.7, -0.62], [0.16, -0.65, -0.75]], lL: [[0.05, -1, -0.38], [0, -0.75, -0.66]]
        }) },
        { t: 0.8, ...GLIDE_A() }
      ]
    },
    // gliding: leaning into the flight, arms held out and back like wings that rise and fall a little,
    // legs together trailing, one knee bending as the other straightens
    glide: {
      loop: true, dur: 2.8,
      keys: [
        { t: 0, ...GLIDE_A() },
        { t: 1.4, ...P({
          pitch: 0.55, roll: -0.04, spine: [0.02, -0.05, 0], chest: [0.03, -0.03, 0], head: [-0.36, -0.03, 0.02], curl: 0.3, wrist: 0.45, footPt: 0.8,
          aL: [[0.62, -0.6, -0.45], [0.42, -0.55, -0.62]], aR: [[-0.55, -0.74, -0.35], [-0.35, -0.75, -0.52]],
          lL: [[0.03, -1, -0.17], [0, -0.7, -0.74]], lR: [[-0.04, -1, -0.29], [0, -0.86, -0.52]]
        }) },
        { t: 2.8, ...GLIDE_A() }
      ]
    },
    // flare (body up, arms out to catch herself, legs swing under), absorb (knees soften), settle into the hover
    land: {
      loop: false, dur: 0.95, next: 'hover',
      keys: [
        { t: 0, ...GLIDE_A() },
        { t: 0.3, ...P({
          pitch: -0.26, roll: 0, spine: [-0.12, 0, 0], chest: [-0.06, 0, 0], head: [0.06, 0, 0], curl: 0.08, wrist: -0.3, footPt: 0.05,
          aL: [[0.76, -0.38, 0.45], [0.55, -0.18, 0.78]], lL: [[0.06, -1, 0.46], [0, -1, 0.1]]
        }) },
        { t: 0.58, ...P({
          pitch: 0.14, spine: [0.16, 0, 0], chest: [0.05, 0, 0], head: [-0.06, 0, 0], curl: 0.55, wrist: 0.05, footPt: 0.25,
          aL: [[0.42, -0.9, 0.25], [0.26, -0.82, 0.48]], lL: [[0.08, -0.8, 0.55], [0, -1, -0.42]]
        }) },
        { t: 0.95, ...P({}) }
      ]
    }
  };
  function GLIDE_A() {
    return P({
      pitch: 0.62, roll: 0.04, spine: [0.05, 0.05, 0], chest: [0.03, 0.03, 0], head: [-0.4, 0.03, -0.02], curl: 0.22, wrist: 0.55, footPt: 0.88,
      aL: [[0.55, -0.74, -0.35], [0.35, -0.75, -0.52]], aR: [[-0.62, -0.6, -0.45], [-0.42, -0.55, -0.62]],
      lL: [[0.04, -1, -0.29], [0, -0.86, -0.52]], lR: [[-0.03, -1, -0.17], [0, -0.7, -0.74]]
    });
  }

  // body parts sample the clip this many seconds late: the torso leads, the limbs follow through
  const LAG = { pitch: 0, roll: 0.02, spine: 0.03, chest: 0.05, head: 0.08, curl: 0.16, wrist: 0.15, footPt: 0.2, aLu: 0.09, aRu: 0.09, aLf: 0.13, aRf: 0.13, lLt: 0.12, lRt: 0.12, lLc: 0.17, lRc: 0.17 };
  const FADE = 0.28;                // seconds to cross-fade between clips

  // ---------------- sampling ----------------
  function catmull(p0, p1, p2, p3, u) {
    const u2 = u * u, u3 = u2 * u;
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
  }
  function sampleValue(clip, key, t) {
    const ks = clip.keys, n = ks.length;
    t = clip.loop ? ((t % clip.dur) + clip.dur) % clip.dur : Math.min(Math.max(t, 0), clip.dur);
    let i = 0;
    while (i < n - 2 && t > ks[i + 1].t) i++;
    const a = ks[i], b = ks[i + 1];
    const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
    const prev = i > 0 ? ks[i - 1] : (clip.loop ? ks[n - 2] : a);
    const next = i + 2 < n ? ks[i + 2] : (clip.loop ? ks[1] : b);
    const va = a[key], vb = b[key], vp = prev[key], vn = next[key];
    if (typeof va === 'number') return catmull(vp, va, vb, vn, u);
    return [0, 1, 2].map(j => catmull(vp[j], va[j], vb[j], vn[j], u));
  }
  function samplePose(clip, t) {
    const out = {};
    Object.keys(LAG).forEach(k => { out[k] = sampleValue(clip, k, t - LAG[k]); });
    return out;
  }
  function blendPose(a, b, w) {
    const out = {};
    Object.keys(LAG).forEach(k => {
      const x = a[k], y = b[k];
      out[k] = typeof x === 'number' ? x + (y - x) * w : [0, 1, 2].map(j => x[j] + (y[j] - x[j]) * w);
    });
    return out;
  }

  // ---------------- clip player: state machine with cross-fades ----------------
  function createPlayer() {
    let cur = 'hover', req = 'hover', t0 = 0, from = null, fadeT0 = -1, last = null;
    function enter(name, T) { from = last; fadeT0 = T; cur = name; t0 = T; }
    const api = {
      get state() { return cur; },
      // called every frame with the wanted clip: only a change of request starts a clip, so a
      // one-shot that already handed over to its next clip is not restarted
      play(name, T) {
        if (!CLIPS[name] || name === req) return;
        req = name;
        if (name !== cur) enter(name, T);
      },
      sample(T) {
        let clip = CLIPS[cur], t = T - t0;
        if (!clip.loop && t >= clip.dur && clip.next) {          // one-shots hand over to their next clip
          const over = t - clip.dur;
          enter(clip.next, T - over);
          clip = CLIPS[cur]; t = T - t0;
        }
        let pose = samplePose(clip, t);
        if (from && fadeT0 >= 0) {
          const w = Math.min(1, (T - fadeT0) / FADE);
          const s = w * w * (3 - 2 * w);
          pose = blendPose(from, pose, s);
          if (w >= 1) from = null;
        }
        last = pose;
        return pose;
      }
    };
    return api;
  }

  // =====================================================================
  //  SPRING PHYSICS ("dynamic bones") for coat tails, chains, trouser panels, rope and hair.
  //  Each link's tip is a point mass on a spring pulled toward where the animation puts it,
  //  with gravity, inertia from her own movement, and air drag. The bone is then turned to
  //  point at the simulated tip, so cloth lags, overshoots, swings and streams in the wind.
  // =====================================================================
  function createDynamics(chains) {
    const T = THREE;
    const O = new T.Vector3(), P2 = new T.Vector3(), A = new T.Vector3(), D = new T.Vector3();
    const q = new T.Quaternion(), pq = new T.Quaternion(), bq = new T.Quaternion();
    chains.forEach(ch => ch.links.forEach(L => { L.p = new T.Vector3(); L.v = new T.Vector3(); L.init = false; }));
    let warm = 0;
    return {
      reset() { chains.forEach(ch => ch.links.forEach(L => { L.init = false; })); warm = 0; },
      // dt seconds; inertia + wind are world vectors (cm/s^2, cm/s)
      step(dt, inertia, wind) {
        if (dt <= 0) return;
        const sub = dt > 0.02 ? 2 : 1, h = dt / sub;
        warm = Math.min(1, warm + dt * 2);
        chains.forEach(ch => {
          const k = ch.stiff, damp = ch.damp, air = ch.air, g = ch.gravity;
          ch.links.forEach(L => {
            L.bone.updateMatrixWorld(true);
            L.bone.getWorldPosition(O); L.tip.getWorldPosition(P2);
            const len = Math.max(0.01, P2.distanceTo(O));
            if (!L.init) { L.p.copy(P2); L.v.set(0, 0, 0); L.init = true; }
            for (let s = 0; s < sub; s++) {
              A.copy(P2).sub(L.p).multiplyScalar(k);                       // spring toward the animated pose
              A.addScaledVector(L.v, -damp);                               // damping
              A.y -= g;                                                    // gravity sag
              A.addScaledVector(inertia, warm);                            // she accelerates, the cloth lags
              D.copy(wind).sub(L.v); A.addScaledVector(D, air * warm);     // air drag streams it back
              L.v.addScaledVector(A, h);
              L.p.addScaledVector(L.v, h);
              D.copy(L.p).sub(O).normalize();                              // keep the link's length
              L.p.copy(O).addScaledVector(D, len);
            }
            // turn the bone so its tip points at the simulated point
            const from = P2.sub(O).normalize();
            D.copy(L.p).sub(O).normalize();
            q.setFromUnitVectors(from, D);
            L.bone.getWorldQuaternion(bq);
            L.bone.parent.getWorldQuaternion(pq);
            L.bone.quaternion.copy(pq.invert().multiply(q.multiply(bq)));
          });
        });
      }
    };
  }

  window.NimbusMotion = { CLIPS, createPlayer, createDynamics };
})();
