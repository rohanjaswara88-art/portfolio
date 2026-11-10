# The clips, as functions of time -> pose dict. Each body part samples its clip a little later than
# the part driving it (LAG), so the hips lead and the chest, head, arms, hands, fingers and feet follow.
import math, copy

TAU = math.pi * 2
LAG = dict(root=0.0, pelvis=0.0, spine=0.04, spine1=0.08, spine2=0.12, neck=0.17, head=0.22,
           clav=0.12, upper=0.16, fore=0.24, hand=0.32, fingers=0.4, thigh=0.08, calf=0.18, foot=0.27, toe=0.33)

def arm(up, elbow, twist, flex, curl, hang=0.0, dev=0.0, spread=0.0, inward=0.0):
    return dict(up=list(up), elbow=elbow, twist=twist, flex=flex, curl=curl, hang=hang, dev=dev, spread=spread, **{'in': inward})

def leg(d, knee, point, toe=0.0):
    return dict(dir=list(d), knee=knee, point=point, toe=toe)

def base():
    return dict(
        # a relaxed FLOATING body, not a standing one: hips and knees soft, toes pointed, arms drifting
        # a little away from the body with bent elbows, a gentle C-curve in the back, asymmetric throughout
        root=dict(pitch=0.07, roll=0.0, yaw=0.0, off=[0, 0, 0]),
        pelvis=[0.0, 0.03, 0.02], spine=[0.03, -0.02, -0.01], spine1=[0.05, -0.02, -0.01], spine2=[0.02, 0.01, 0.02],
        neck=[-0.08, 0.0, 0.02], head=[-0.07, 0.05, 0.03],
        clavL=[-0.02, 0.04], clavR=[0.015, 0.02],
        armL=arm((0.34, 0.2, -1), 0.66, 0.75, 0.24, 0.52, hang=0.05),
        armR=arm((0.27, 0.06, -1), 0.44, 0.85, 0.16, 0.4, hang=0.06),
        # legs hang nearly straight under the hips (thighs bent forward made the hips look pushed out)
        legL=leg((0.06, 0.1, -1), 0.42, 0.75, 0.15),
        legR=leg((0.0, -0.02, -1), 0.18, 0.62, 0.1),
    )

# ---------- tiny math ----------
def S(t, P, k, ph=0.0): return math.sin(TAU * k * t / P + ph)
def smooth(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def bump(t, c, w):                      # smooth 0..1..0 bump centred on c, half-width w
    x = abs(t - c) / w
    return 0.0 if x >= 1 else 0.5 * (1 + math.cos(math.pi * x))
def add3(a, b, k=1.0): return [a[i] + b[i] * k for i in range(3)]
def lerp(a, b, w):
    if isinstance(a, (int, float)): return a + (b - a) * w
    if isinstance(a, list): return [lerp(x, y, w) for x, y in zip(a, b)]
    if isinstance(a, dict): return {k: lerp(a[k], b[k], w) for k in a}
    return a
def blend(a, b, w): return lerp(a, b, w)

# ---------- keyed poses with smooth (Catmull-Rom / ease) interpolation ----------
def cat(p0, p1, p2, p3, u):
    if isinstance(p1, (int, float)):
        u2, u3 = u * u, u * u * u
        return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
    if isinstance(p1, list): return [cat(a, b, c, d, u) for a, b, c, d in zip(p0, p1, p2, p3)]
    if isinstance(p1, dict): return {k: cat(p0[k], p1[k], p2[k], p3[k], u) for k in p1}
    return p1
def keyed(keys, t, loop=None):
    """keys: [(time, pose)], times ascending. Catmull-Rom through the poses (ease into holds)."""
    n = len(keys)
    if loop: t = t % loop
    t = max(keys[0][0], min(keys[-1][0], t))
    i = 0
    while i < n - 2 and t > keys[i + 1][0]: i += 1
    (ta, a), (tb, b) = keys[i], keys[i + 1]
    u = (t - ta) / max(1e-6, tb - ta)
    p = keys[i - 1][1] if i > 0 else (keys[-2][1] if loop else a)
    q = keys[i + 2][1] if i + 2 < n else (keys[1][1] if loop else b)
    return cat(p, a, b, q, u)

# =====================================================================
#  HOVER IDLE (12 s loop): breathing, weight shifting between the hips, the chest answering late,
#  a posture adjustment, small looks, relaxed hanging arms swinging from the torso, dangling legs.
# =====================================================================
IDLE_P = 12.0
def idle(t, amt=1.0, P=IDLE_P):
    t = t % P
    p = base()
    br = S(t, P, 3, 0.4) * 0.8 + S(t, P, 6, 1.1) * 0.2           # breathing ~4 s
    shift = S(t, P, 1, 0.3) * 0.75 + S(t, P, 2, 2.0) * 0.25        # weight shift (slow)
    adj = bump(t, 7.3, 0.9)                                                  # a posture adjustment
    look = S(t, P, 1, 1.9) * 0.7 + S(t, P, 3, 0.2) * 0.3
    p['root']['off'] = [shift * 1.4 * amt, 0, (S(t, P, 2, 0.8) * 1.1 + br * 0.25) * amt]
    p['root']['roll'] = 0.0
    b0 = base()
    p['pelvis'] = add3(b0['pelvis'], [0.03 * S(t, P, 2, 0.5) * amt, -0.08 * shift * amt, 0.05 * S(t, P, 1, 2.6) * amt])
    p['spine'] = add3(b0['spine'], [0.012 * br, 0.04 * shift, -0.02 * S(t, P, 1, 2.6)])
    p['spine1'] = add3(b0['spine1'], [-0.02 * br - 0.035 * adj, 0.035 * shift, -0.025 * S(t, P, 1, 2.9)])
    p['spine2'] = add3(b0['spine2'], [-0.035 * br - 0.045 * adj, 0.02 * shift, 0.015 * look])
    p['neck'] = add3(b0['neck'], [0.012 * br + 0.02 * adj, -0.02 * shift, 0.05 * look])
    p['head'] = add3(b0['head'], [0.025 * S(t, P, 2, 1.3) + 0.015 * br, -0.04 * shift + 0.025 * S(t, P, 5, 0.7), 0.07 * look])
    p['clavL'] = [0.025 * br + 0.04 * adj, -0.03 * adj]
    p['clavR'] = [0.025 * br + 0.04 * adj, -0.03 * adj]
    for k, sg, ph in (('armL', 1, 0.0), ('armR', -1, 1.7)):
        a = p[k]
        sw = S(t, P, 1, ph) * 0.6 + S(t, P, 2, ph + 1) * 0.4
        a['up'] = add3(a['up'], [0.05 * sw - 0.06 * shift * sg, 0.07 * S(t, P, 1, ph + 2.2), 0])
        a['elbow'] += 0.1 * S(t, P, 2, ph + 0.5) + 0.06 * adj
        a['twist'] += 0.08 * S(t, P, 1, ph + 1.2)
        a['flex'] += 0.06 * S(t, P, 3, ph)
        a['curl'] += 0.07 * S(t, P, 2, ph + 2.0) - 0.08 * adj
    for k, sg, ph in (('legL', 1, 0.6), ('legR', -1, 2.4)):
        l = p[k]
        dl = S(t, P, 1, ph) * 0.6 + S(t, P, 3, ph + 1) * 0.4
        l['dir'] = add3(l['dir'], [0.03 * shift * sg, 0.05 * dl, 0])
        l['knee'] += 0.08 * S(t, P, 2, ph + 0.4)
        l['point'] += 0.06 * S(t, P, 2, ph + 1.3)
    return p

# =====================================================================
#  TALK (8 s loop): idle base + explaining gestures that land on beats: right hand comes up palm-up,
#  two small beat strokes, both hands open on the main point, a head nod / tilt, then settles.
# =====================================================================
TALK_P = 8.0
def talk(t):
    t = t % TALK_P
    p = idle(t, 0.8, TALK_P)
    g = base()
    R = copy.deepcopy(g['armR']); L = copy.deepcopy(g['armL'])
    gest_R = arm((0.32, 0.55, -0.78), 1.35, 0.15, -0.15, 0.25, 0, 0.05, 0.4)       # hand up, palm up, open
    gest_R2 = arm((0.3, 0.6, -0.72), 1.55, 0.05, -0.25, 0.18, 0, 0.0, 0.5)         # beat, a bit higher
    gest_L = arm((0.3, 0.5, -0.8), 1.3, 0.2, -0.15, 0.28, 0, 0.05, 0.35)
    kR = [(0, 0.0), (0.9, 0.0), (1.5, 1.0), (2.0, 0.85), (2.35, 1.0), (2.8, 0.85), (3.3, 1.0), (4.2, 1.0), (5.6, 1.0), (6.6, 0.0), (8.0, 0.0)]
    kL = [(0, 0.0), (3.3, 0.0), (4.0, 1.0), (4.5, 0.85), (5.3, 1.0), (5.9, 0.6), (6.7, 0.0), (8.0, 0.0)]
    def env(keys):
        return max(0.0, min(1.0, keyed([(a, b) for a, b in keys], t)))
    wR, wL = smooth(env(kR)), smooth(env(kL))
    beat = bump(t, 2.0, 0.25) + bump(t, 2.8, 0.25) + 0.7 * bump(t, 4.5, 0.3)
    gr = lerp(gest_R, gest_R2, bump(t, 4.6, 1.0))
    p['armR'] = lerp(p['armR'], gr, wR)
    p['armR']['up'][2] -= 0.12 * beat * wR; p['armR']['flex'] += 0.2 * beat * wR
    p['armL'] = lerp(p['armL'], gest_L, wL)
    p['armL']['up'][2] -= 0.1 * bump(t, 4.5, 0.3) * wL
    # head: small nods on the beats, a thoughtful tilt, leaning in a touch while explaining
    nod = 0.06 * bump(t, 2.05, 0.3) + 0.05 * bump(t, 2.85, 0.3) + 0.08 * bump(t, 4.55, 0.35)
    p['head'][0] += nod; p['neck'][0] += nod * 0.4
    tilt = 0.07 * bump(t, 5.6, 1.2)
    p['head'][1] += tilt; p['neck'][1] += tilt * 0.3
    p['head'][2] += 0.06 * bump(t, 1.4, 0.8) - 0.05 * bump(t, 4.8, 1.0)
    lean = 0.04 * smooth(env([(0, 0), (1.2, 1), (6.2, 1), (7.5, 0), (8, 0)]))
    p['spine1'][0] += lean; p['root']['pitch'] += lean * 0.5
    p['clavR'][0] += 0.05 * wR + 0.05 * beat * wR
    p['clavL'][0] += 0.04 * wL
    p['spine2'][2] -= 0.05 * wR - 0.04 * wL                       # chest turns toward the gesturing hand
    return p

# =====================================================================
#  WAVE (2.6 s): anticipation, arm sweeps up with the elbow leading, forearm waves 3x, comes down with overshoot.
# =====================================================================
WAVE_D = 2.6
def wave(t, side='R'):
    p = idle(t + 1.0, 0.7)
    k = 'arm' + side
    rest = copy.deepcopy(p[k]); rest['bend'] = [0.0, 1.0, 0.0]
    up = arm((0.85, 0.12, 0.2), 1.45, -0.2, -0.1, 0.1, 0, 0, 0.6)
    up['bend'] = [-0.15, 0.25, 1.0]                     # elbow folds upward: forearm vertical, palm out
    w = smooth(keyed([(0, 0.0), (0.15, -0.08), (0.55, 1.05), (0.7, 1.0), (1.9, 1.0), (2.3, -0.04), (2.6, 0.0)], t))
    a = lerp(rest, up, max(0.0, min(1.05, w)))
    wv = math.sin((t - 0.55) * TAU * 2.2) if 0.55 < t < 1.95 else 0.0
    a['elbow'] += 0.32 * wv * min(1, w)
    a['dev'] = 0.15 * math.sin((t - 0.65) * TAU * 2.2) * min(1, w)
    p[k] = a
    s = 1 if side == 'L' else -1
    p['clav' + side][0] += 0.12 * min(1, w)
    p['spine2'][1] -= 0.04 * s * min(1, w)
    p['head'][1] += 0.06 * s * min(1, w)
    p['head'][0] -= 0.03 * min(1, w)
    return p

# =====================================================================
#  FLIGHT: take-off (gather -> spring -> stretch into the glide), glide loop, landing (flare -> absorb -> settle)
# =====================================================================
def glide_pose(t):
    G = 3.0
    p = base()
    wv = S(t, G, 1)                                           # a slow body wave from the chest to the feet
    p['root'] = dict(pitch=1.2 + 0.03 * wv, roll=0.03 * S(t, G, 1, 1.1), yaw=0.0, off=[0, 0, 1.5 * S(t, G, 1, 0.5)])
    p['pelvis'] = [0, 0.02 * S(t, G, 1, 1.4), 0.02 * S(t, G, 1, 2.0)]
    p['spine'] = [-0.06, 0, 0]; p['spine1'] = [-0.1 + 0.03 * wv, 0, 0]; p['spine2'] = [-0.14 + 0.04 * wv, 0, 0]
    p['neck'] = [-0.32, 0, 0]; p['head'] = [-0.42 + 0.03 * S(t, G, 1, 0.6), 0, 0.03 * S(t, G, 1, 2.2)]
    p['clavL'] = [-0.05, -0.1]; p['clavR'] = [-0.05, -0.1]
    for k, ph in (('armL', 0.0), ('armR', 0.9)):
        fl = S(t, G, 1, ph)
        p[k] = arm((0.42 + 0.05 * fl, -0.62, -0.62 + 0.06 * fl), 0.22 + 0.06 * S(t, G, 1, ph + 1), 0.25, -0.22 + 0.06 * fl, 0.22, 0, 0, 0.15)
    for k, ph in (('legL', 0.0), ('legR', 1.6)):
        b = S(t, G, 1, ph)
        p[k] = leg((0.06, -0.12, -1), 0.22 + 0.16 * (b * 0.5 + 0.5), 1.25, 0.25)
    p['legR']['dir'] = [0.02, -0.2, -1]
    return p

def takeoff(t):
    gather = base()
    gather['root']['pitch'] = 0.25; gather['root']['off'] = [0, 0, -3]
    gather['spine'] = [0.12, 0, 0]; gather['spine1'] = [0.15, 0, 0]; gather['spine2'] = [0.1, 0, 0]
    gather['neck'] = [0.12, 0, 0]; gather['head'] = [0.1, 0, 0]
    gather['clavL'] = gather['clavR'] = [0.05, 0.08]
    gather['armL'] = arm((0.3, 0.35, -0.9), 1.25, 0.6, 0.25, 0.75)
    gather['armR'] = arm((0.3, 0.35, -0.9), 1.3, 0.6, 0.25, 0.75)
    gather['legL'] = leg((0.08, 0.85, -0.55), 1.7, 0.5, 0.1); gather['legR'] = leg((0.04, 0.6, -0.8), 1.45, 0.55, 0.1)
    spring = base()
    spring['root']['pitch'] = 0.55; spring['root']['off'] = [0, 0, 4]
    spring['spine'] = [-0.12, 0, 0]; spring['spine1'] = [-0.18, 0, 0]; spring['spine2'] = [-0.2, 0, 0]
    spring['neck'] = [-0.2, 0, 0]; spring['head'] = [-0.3, 0, 0]
    spring['clavL'] = spring['clavR'] = [0.12, -0.12]
    spring['armL'] = arm((0.35, -0.75, -0.55), 0.15, 0.4, -0.35, 0.1, 0, 0, 0.4)
    spring['armR'] = arm((0.35, -0.75, -0.55), 0.18, 0.4, -0.35, 0.12, 0, 0, 0.4)
    spring['legL'] = leg((0.04, -0.3, -1), 0.12, 1.3, 0.3); spring['legR'] = leg((0.02, -0.38, -1), 0.3, 1.3, 0.3)
    keys = [(0.0, idle(0.0)), (0.28, gather), (0.36, gather), (0.58, spring), (1.0, glide_pose(0.0))]
    return keyed(keys, t)

def land(t):
    flare = base()
    flare['root']['pitch'] = -0.3; flare['root']['off'] = [0, 0, 2]
    flare['spine'] = [-0.08, 0, 0]; flare['spine1'] = [-0.08, 0, 0]; flare['spine2'] = [-0.1, 0, 0]
    flare['neck'] = [0.1, 0, 0]; flare['head'] = [0.12, 0, 0]
    flare['clavL'] = flare['clavR'] = [0.14, 0.06]
    flare['armL'] = arm((0.85, 0.45, -0.2), 0.45, 0.0, -0.3, 0.15, 0, 0, 0.5)
    flare['armR'] = arm((0.85, 0.4, -0.22), 0.5, 0.0, -0.3, 0.15, 0, 0, 0.5)
    flare['legL'] = leg((0.08, 0.45, -1), 0.35, 0.35, 0.0); flare['legR'] = leg((0.04, 0.3, -1), 0.25, 0.4, 0.0)
    absorb = base()
    absorb['root']['pitch'] = 0.18; absorb['root']['off'] = [0, 0, -4]
    absorb['spine'] = [0.1, 0, 0]; absorb['spine1'] = [0.12, 0, 0]; absorb['spine2'] = [0.06, 0, 0]
    absorb['neck'] = [0.1, 0, 0]; absorb['head'] = [0.0, 0, 0]
    absorb['clavL'] = absorb['clavR'] = [-0.03, 0.04]
    absorb['armL'] = arm((0.4, 0.3, -0.9), 0.75, 0.6, 0.2, 0.5)
    absorb['armR'] = arm((0.4, 0.28, -0.9), 0.7, 0.6, 0.2, 0.5)
    absorb['legL'] = leg((0.08, 0.5, -0.85), 1.1, 0.55, 0.1); absorb['legR'] = leg((0.04, 0.3, -0.95), 0.8, 0.55, 0.1)
    over = idle(0.0); over['root']['off'] = [0, 0, 1.2]; over['spine1'][0] -= 0.03
    keys = [(0.0, glide_pose(0.0)), (0.32, flare), (0.6, absorb), (0.85, over), (1.2, idle(0.0))]
    return keyed(keys, t)

CLIPS = {
    # name: (function, duration, loop)
    'idle': (idle, IDLE_P, True),
    'talk': (talk, TALK_P, True),
    'waveR': (lambda t: wave(t, 'R'), WAVE_D, False),
    'waveL': (lambda t: wave(t, 'L'), WAVE_D, False),
    'takeoff': (takeoff, 1.0, False),
    'glide': (glide_pose, 3.0, True),
    'land': (land, 1.2, False),
}

def sampler(name):
    fn, dur, loop = CLIPS[name]
    def part_at(t):
        def part(pn):
            tt = t - LAG[pn]
            if loop: tt %= dur
            else: tt = max(0.0, min(dur, tt))
            return fn(tt)
        return part
    return part_at, dur, loop
