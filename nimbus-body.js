/* =====================================================================
   nimbus-body.js : makes her whole body move like a living person instead of a rig.

   1. Every joint is posed, not just the big limbs: shoulders shrug and roll with the arms,
      the pelvis sways and counter-twists against the chest, wrists bend, fingers curl
      (relaxed, open while waving, index out while pointing), toes point in flight.
   2. Breathing and slow per-joint drift, so she is never frozen.
   3. Joint springs: every joint follows its target pose through a damped spring, so motion
      eases in, overshoots a touch and settles. The torso is stiffest and leads; arms, hands,
      legs and feet are softer and follow through.

   Used by nimbus3d.js: NimbusBody.create(bones, helpers) -> { torso, extremities, drift, settle }
   ===================================================================== */
(function () {
  'use strict';

  const ZETA = 0.62;                // spring damping ratio (< 1 = a little overshoot)
  // per joint: spring frequency (higher = stiffer, leads) and idle drift amplitude (radians)
  const JOINT = {
    pelvis: [16, 0.012], spine1: [15, 0.015], spine2: [13, 0.016], neck: [12, 0.02], head: [11, 0.028],
    clav: [12, 0.015], upper: [10, 0.035], fore: [8.5, 0.04], hand: [7, 0.07],
    thigh: [10, 0.022], calf: [8, 0.03], foot: [6.5, 0.05], finger: [9, 0.035]
  };
  // how much each finger curls relative to the hand's curl (pinky curls most), and per joint
  const FINGER_K = [0.35, 0.75, 0.9, 1.0, 1.12];        // thumb, index, middle, ring, pinky
  const JOINT_K = [0.75, 1.1, 0.8];                      // knuckle, middle, tip
  const CURL_MAX = 0.8;                                  // radians per joint at full curl

  function create(bones, h) {
    const T3 = THREE, V = (x, y, z) => new T3.Vector3(x, y, z);
    const get = n => bones[n] || null;
    const side = s => (s > 0 ? 'L' : 'R');
    const pelvis = get('Bip001-Pelvis'), spine1 = get('Bip001-Spine1');
    const arms = [1, -1].map(s => {
      const k = side(s), b = n => get('Bip001-' + k + '-' + n);
      const fingers = [0, 1, 2, 3, 4].map(f => (f === 0 ? ['0', '01', '02'] : [f + '', f + '1', f + '2', f + '3'])
        .map(j => b('Finger' + j)).filter(Boolean));
      return { side: s, clav: b('Clavicle'), upper: b('UpperArm'), fore: b('Forearm'), hand: b('Hand'), fingers, curlSign: 1 };
    });
    const legs = [1, -1].map(s => {
      const k = side(s);
      return { side: s, calf: get('Bip001-' + k + '-Calf'), foot: get('Bip001-' + k + '-Foot'), toe: get('Bip001-' + k + '-Toe0') };
    });

    // which way is "into the palm": the rest pose fingers are slightly bent, so two consecutive
    // middle-finger segments give the curl axis with the right sign
    const a = V(), b = V(), c = V(), axis = V(), tmp = V();
    arms.forEach(arm => {
      const m = arm.fingers[2], idx = arm.fingers[1][0], pinky = arm.fingers[4][0];
      if (!m || m.length < 3 || !idx || !pinky) return;
      m[0].updateMatrixWorld(true);
      m[0].getWorldPosition(a); m[1].getWorldPosition(b); m[2].getWorldPosition(c);
      const bend = V().crossVectors(b.clone().sub(a), c.clone().sub(b));
      idx.getWorldPosition(axis); pinky.getWorldPosition(tmp); axis.sub(tmp).normalize();
      arm.curlSign = bend.lengthSq() > 1e-8 && bend.dot(axis) < 0 ? -1 : 1;
      if (bend.lengthSq() <= 1e-8) arm.curlSign = arm.side;
    });

    // ---- joint springs + drift channels ----
    const springs = [];
    const add = (bone, kind) => {
      if (!bone) return;
      const [w, amp] = JOINT[kind];
      const rnd = () => V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      springs.push({
        bone, w, amp, q: new T3.Quaternion(), v: V(), init: false,
        ax1: rnd(), ax2: rnd(), f1: 0.35 + Math.random() * 0.5, f2: 1.0 + Math.random() * 0.9,
        p1: Math.random() * 6.28, p2: Math.random() * 6.28, tip: kind === 'hand' || kind === 'foot' || kind === 'fore' || kind === 'finger'
      });
    };
    add(pelvis, 'pelvis'); add(spine1, 'spine1'); add(get('Bip001-Spine2'), 'spine2');
    add(get('Bip001-Neck'), 'neck'); add(get('Bip001-Head'), 'head');
    arms.forEach(arm => {
      add(arm.clav, 'clav'); add(arm.upper, 'upper'); add(arm.fore, 'fore'); add(arm.hand, 'hand');
      arm.fingers.forEach(f => f.forEach(j => add(j, 'finger')));
    });
    legs.forEach(l => {
      add(get('Bip001-' + side(l.side) + '-Thigh'), 'thigh'); add(l.calf, 'calf'); add(l.foot, 'foot');
    });

    const dq = new T3.Quaternion(), eq = new T3.Quaternion(), err = V(), ax = V();

    return {
      // before the arms are aimed: pelvis sway + counter-twist, breathing in the shoulders, shoulder shrug/roll
      torso(T, cp, clipW) {
        const live = 0.4 + 0.6 * clipW;
        const sway = Math.sin(T * 0.9) * 0.03 * live;
        if (pelvis) {
          h.rotateWorld(pelvis, h.FWD, sway);
          if (cp) h.rotateWorld(pelvis, h.AY, -cp.chest[1] * 0.8 * clipW);
        }
        if (spine1) h.rotateWorld(spine1, h.FWD, -Math.sin(T * 0.9 - 0.5) * 0.026 * live);   // the chest answers late
        const breath = Math.sin(T * 1.7);
        arms.forEach(arm => {
          if (!arm.clav) return;
          let shrug = breath * 0.012, roll = 0;
          if (cp) {
            const u = cp[arm.side > 0 ? 'aLu' : 'aRu'];
            shrug += Math.max(0, Math.min(1.6, u[1] + 0.6)) * 0.13 * clipW;   // arm raised -> shoulder lifts
            roll = -u[2] * 0.09 * clipW;                                       // arm forward/back -> shoulder rolls
          }
          h.rotateWorld(arm.clav, h.FWD, arm.side * shrug);
          h.rotateWorld(arm.clav, h.AY, -arm.side * roll);
        });
      },

      // after the limbs: wrists, fingers, feet
      extremities(T, cp, clipW, tp) {
        const model = h.model;
        arms.forEach(arm => {
          // wrists: trail behind the forearm in flight (keyed "wrist"), stay soft otherwise
          if (cp && arm.hand && arm.fingers[2][0] && clipW > 0) {
            arm.fore.getWorldPosition(a); arm.hand.getWorldPosition(b);
            const fore = b.clone().sub(a).normalize();
            const wr = cp.wrist;
            const bend = V(arm.side * 0.12 * wr, 0.3 * wr, -0.55 * wr).applyQuaternion(model.quaternion);
            h.aimBlend(arm.hand, arm.fingers[2][0], fore.add(bend).normalize(), clipW * 0.85);
          }
          // fingers: relaxed curl from the clip; open when waving; index out when pointing
          const waving = tp.wave * (arm.side === tp.waveSide ? 1 : 0);
          const pointing = tp.point * (arm.side === tp.pointSide ? 1 : 0);
          let curl = cp ? cp.curl * clipW + 0.42 * (1 - clipW) : 0.42;
          curl += Math.sin(T * 0.7 + arm.side) * 0.05;
          curl = curl * (1 - waving) + 0.08 * waving;
          const idx = arm.fingers[1][0], pinky = arm.fingers[4][0];
          if (!idx || !pinky) return;
          idx.getWorldPosition(axis); pinky.getWorldPosition(tmp);
          axis.sub(tmp).normalize().multiplyScalar(arm.curlSign);
          arm.fingers.forEach((chain, f) => {
            let c2 = curl * FINGER_K[f];
            if (pointing > 0) c2 = c2 * (1 - pointing) + pointing * (f === 1 ? 0.03 : f === 0 ? 0.5 : 1.25);
            chain.forEach((j, i) => h.rotateWorld(j, axis, c2 * JOINT_K[Math.min(i, 2)] * CURL_MAX * (f === 0 ? 0.6 : 1)));
          });
        });
        // feet: toes point along the shin while she flies, relax while hovering
        if (cp && clipW > 0) legs.forEach(l => {
          if (!l.calf || !l.foot || !l.toe) return;
          l.calf.getWorldPosition(a); l.foot.getWorldPosition(b);
          h.aimBlend(l.foot, l.toe, b.sub(a).normalize(), Math.min(1, cp.footPt) * 0.75 * clipW);
        });
      },

      // slow living drift on every joint (plus air buffeting on the extremities at speed)
      drift(T, amount, turb) {
        springs.forEach(s => {
          const n1 = Math.sin(T * s.f1 + s.p1) * 0.6 + Math.sin(T * s.f1 * 2.3 + s.p2) * 0.4;
          const n2 = Math.sin(T * s.f2 + s.p2);
          let ang = s.amp * amount;
          if (s.tip && turb > 0) ang += turb * 0.05 * Math.sin(T * 5.3 + s.p1);
          dq.setFromAxisAngle(s.ax1, ang * n1); s.bone.quaternion.multiply(dq);
          dq.setFromAxisAngle(s.ax2, ang * 0.6 * n2); s.bone.quaternion.multiply(dq);
        });
      },

      // every joint chases its target through a damped spring: ease in, slight overshoot, settle
      settle(dt) {
        const snap = !(dt > 0) || dt > 0.25;
        const steps = dt > 1 / 50 ? 2 : 1, hdt = dt / steps;
        springs.forEach(s => {
          const tgt = s.bone.quaternion;
          if (!s.init || snap) { s.q.copy(tgt); s.v.set(0, 0, 0); s.init = true; return; }
          const k = s.w * s.w, d = 2 * ZETA * s.w;
          for (let i = 0; i < steps; i++) {
            eq.copy(s.q).invert().premultiply(tgt);                 // rotation still to go
            if (eq.w < 0) { eq.x = -eq.x; eq.y = -eq.y; eq.z = -eq.z; eq.w = -eq.w; }
            const sinH = Math.hypot(eq.x, eq.y, eq.z);
            if (sinH > 1e-7) err.set(eq.x, eq.y, eq.z).multiplyScalar(2 * Math.atan2(sinH, eq.w) / sinH);
            else err.set(0, 0, 0);
            s.v.addScaledVector(err, k * hdt).multiplyScalar(1 / (1 + d * hdt));
            const ang = s.v.length() * hdt;
            if (ang > 1e-8) { dq.setFromAxisAngle(ax.copy(s.v).normalize(), ang); s.q.premultiply(dq).normalize(); }
          }
          tgt.copy(s.q);
        });
      }
    };
  }

  window.NimbusBody = { create };
})();
