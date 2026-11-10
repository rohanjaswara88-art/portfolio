# Pose application for the Daffodill Bip001 rig, in her own body frame.
# Body coords: x = her left, f = forward, u = up. Angles in radians.
import math
from mathutils import Vector, Quaternion, Matrix
from rig import upd

class Body:
    def __init__(self, arm, P):
        self.arm, self.P = arm, P
        A = arm.matrix_world.to_3x3()
        self.Ai = A.inverted()
        self.L = (self.Ai @ Vector((1, 0, 0))).normalized()
        self.F = (self.Ai @ Vector((0, -1, 0))).normalized()
        self.U = (self.Ai @ Vector((0, 0, 1))).normalized()
        g = lambda n: P[n]
        self.pelvis, self.spine, self.spine1, self.spine2 = g('Bip001-Pelvis'), g('Bip001-Spine'), g('Bip001-Spine1'), g('Bip001-Spine2')
        self.neck, self.head = g('Bip001-Neck'), g('Bip001-Head')
        self.side = {}
        for s, k in ((1, 'L'), (-1, 'R')):
            b = lambda n: P['Bip001-%s-%s' % (k, n)]
            fingers = []
            for f in range(5):
                names = ['Finger0', 'Finger01', 'Finger02'] if f == 0 else ['Finger%d' % f, 'Finger%d1' % f, 'Finger%d2' % f, 'Finger%d3' % f]
                fingers.append([P['Bip001-%s-%s' % (k, n)] for n in names])
            self.side[s] = dict(clav=b('Clavicle'), upper=b('UpperArm'), fore=b('Forearm'), hand=b('Hand'), fingers=fingers,
                                thigh=b('Thigh'), calf=b('Calf'), foot=b('Foot'), toe=b('Toe0'), toe_end=P['Bip001-%s-Toe0_end' % k])
        self.keyed = [self.pelvis, self.spine, self.spine1, self.spine2, self.neck, self.head]
        for s in (1, -1):
            d = self.side[s]
            self.keyed += [d['clav'], d['upper'], d['fore'], d['hand'], d['thigh'], d['calf'], d['foot'], d['toe']]
            for ch in d['fingers']: self.keyed += ch
        self.rest_q = {}
        # the glTF import keeps the model's rest pose in the pose channels: remember it, "reset" restores it
        self.init = {pb.name: (pb.location.copy(), pb.rotation_quaternion.copy(), pb.scale.copy()) for pb in arm.pose.bones}
        upd()
        for pb in self.keyed: self.rest_q[pb.name] = pb.matrix.to_quaternion()
        # finger curl direction (toward the palm) from the rest bend of the middle finger
        self.curl_sign = {}
        for s in (1, -1):
            m = self.side[s]['fingers'][2]
            a, b_, c = [x.matrix.to_translation() for x in m[:3]]
            bend = (b_ - a).cross(c - b_)
            ax = self.knuckle_axis(s)
            self.curl_sign[s] = -1 if bend.dot(ax) < 0 else 1

    # ---------- low level ----------
    @staticmethod
    def h(pb): return pb.matrix.to_translation()

    def rot(self, pb, axis, ang):
        if abs(ang) < 1e-9: return
        hh = self.h(pb)
        R = Quaternion(axis.normalized(), ang).to_matrix().to_4x4()
        pb.matrix = Matrix.Translation(hh) @ R @ Matrix.Translation(-hh) @ pb.matrix
        upd()

    def rotq(self, pb, q):
        hh = self.h(pb)
        pb.matrix = Matrix.Translation(hh) @ q.to_matrix().to_4x4() @ Matrix.Translation(-hh) @ pb.matrix
        upd()

    def aim(self, pb, child, d):
        cur = (self.h(child) - self.h(pb)).normalized()
        self.rotq(pb, cur.rotation_difference(d.normalized()))

    def frame_of(self, pb):          # rotation of a bone relative to its rest (armature space)
        return pb.matrix.to_quaternion() @ self.rest_q[pb.name].inverted()

    def knuckle_axis(self, s):
        f = self.side[s]['fingers']
        return (self.h(f[1][0]) - self.h(f[4][0])).normalized()

    def bv(self, R, x, f, u):        # body vector -> armature space, rotated by frame R
        return R @ (self.L * x + self.F * f + self.U * u)

    # ---------- the pose ----------
    def reset(self):
        for pb in self.arm.pose.bones:
            l, q, sc = self.init[pb.name]
            pb.location = l; pb.rotation_quaternion = q; pb.scale = sc
        upd()

    def torso_rot(self, pb, R, pitch=0, roll=0, yaw=0):
        # pitch +: bend forward; roll +: lean to her left; yaw +: turn to her left
        self.rot(pb, R @ self.U, yaw)
        self.rot(pb, R @ self.L, pitch)
        self.rot(pb, R @ self.F, -roll)

    def apply(self, part):
        """part(name) -> pose dict sampled at that body part's own (lagged) time."""
        self.reset()
        I = Quaternion()
        r = part('root')['root']
        # whole body: hips are the pivot; offset in body cm
        off = r['off']
        pv = self.pelvis
        self.torso_rot(pv, I, r['pitch'], r['roll'], r['yaw'])
        Rb = self.frame_of(pv)
        pv.matrix = Matrix.Translation(self.L * off[0] + self.F * off[1] + self.U * off[2]) @ pv.matrix
        upd()
        p = part('pelvis'); self.torso_rot(pv, Rb, *p['pelvis'])
        for name, bone in (('spine', self.spine), ('spine1', self.spine1), ('spine2', self.spine2), ('neck', self.neck), ('head', self.head)):
            q = part(name)[name]
            self.torso_rot(bone, self.frame_of(bone.parent), *q)
        Rc = self.frame_of(self.spine2)
        Rp = self.frame_of(self.pelvis)
        for s in (1, -1):
            self.arm_side(s, Rc, part)
            self.leg_side(s, Rp, part)

    def arm_side(self, s, Rc, part):
        d = self.side[s]
        k = 'L' if s > 0 else 'R'
        c = part('clav')['clav' + k]                       # (lift, forward)
        self.rot(d['clav'], Rc @ self.F, -s * c[0])
        self.rot(d['clav'], Rc @ self.U, -s * c[1])
        a = part('upper')['arm' + k]
        u = self.bv(Rc, a['up'][0] * s, a['up'][1], a['up'][2]).normalized()
        g = a.get('hang', 0)                               # gravity pull on a relaxed arm
        if g: u = u.lerp(-self.U, g).normalized()
        self.aim(d['upper'], d['fore'], u)
        # elbow: hinge the forearm toward the body's front (and a bit inward)
        e = part('fore')['arm' + k]
        bd = e.get('bend')
        fwd = self.bv(Rc, bd[0] * s, bd[1], bd[2]) if bd else self.bv(Rc, -0.25 * s * e.get('in', 0), 1, 0)
        perp = (fwd - u * fwd.dot(u)).normalized()
        fdir = (u * math.cos(e['elbow']) + perp * math.sin(e['elbow'])).normalized()
        self.aim(d['fore'], d['hand'], fdir)
        tw = e['twist'] * 0.6
        self.rot(d['fore'], fdir, -s * tw)
        hnd = part('hand')['arm' + k]
        self.rot(d['hand'], fdir, -s * hnd['twist'] * 0.4)
        ax = self.knuckle_axis(s) * self.curl_sign[s]
        self.rot(d['hand'], ax, hnd['flex'])                # + = toward the palm
        palm_n = ax.cross(fdir).normalized()
        self.rot(d['hand'], palm_n, s * hnd.get('dev', 0))
        fg = part('fingers')['arm' + k]
        ax = self.knuckle_axis(s) * self.curl_sign[s]
        KF = (0.45, 0.8, 0.92, 1.0, 1.12)
        KJ = (0.7, 1.05, 0.75)
        spread = fg.get('spread', 0)
        for fi, chain in enumerate(fg_chain(d)):
            cv = fg['curl'] * KF[fi] + fg.get('per', [0] * 5)[fi]
            if fi == 0:
                for j, bone in enumerate(chain): self.rot(bone, ax, cv * 0.45)
                continue
            n = (palm_n if True else None)
            self.rot(chain[0], palm_n, s * spread * (fi - 2.5) * 0.08)
            for j, bone in enumerate(chain[:3]):
                self.rot(bone, ax, cv * KJ[j] * 0.85)

    def leg_side(self, s, Rp, part):
        d = self.side[s]
        k = 'L' if s > 0 else 'R'
        lg = part('thigh')['leg' + k]
        t = self.bv(Rp, lg['dir'][0] * s, lg['dir'][1], lg['dir'][2]).normalized()
        self.aim(d['thigh'], d['calf'], t)
        kn = part('calf')['leg' + k]['knee']
        back = self.bv(Rp, 0, -1, 0)
        perp = (back - t * back.dot(t)).normalized()
        shin = (t * math.cos(kn) + perp * math.sin(kn)).normalized()
        self.aim(d['calf'], d['foot'], shin)
        pt = part('foot')['leg' + k]['point']
        fwd = self.bv(Rp, 0, 1, 0)
        fperp = (fwd - shin * fwd.dot(shin)).normalized()
        fdir = (fperp * math.cos(pt) + shin * math.sin(pt)).normalized()
        self.aim(d['foot'], d['toe'], fdir)
        tp = part('toe')['leg' + k].get('toe', 0)
        if tp:
            ax = shin.cross(fdir).normalized()
            self.rot(d['toe'], ax, tp)

    def key(self, frame):
        for pb in self.keyed:
            pb.keyframe_insert('rotation_quaternion', frame=frame)
        self.pelvis.keyframe_insert('location', frame=frame)


def fg_chain(d):
    return d['fingers']
