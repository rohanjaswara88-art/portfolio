/* =====================================================================
   AI Auto: a guided tour of the site by the 3D mascot.
   Click "AI Auto" and she flies from her corner through every section, points at each part,
   explains it (speech bubble + browser voice), and drives the interactive effects herself
   with her own cursor. At the end she waves goodbye and flies back to her corner.

   Needs: window.RJ (hooks from index.html), gsap, the mascot (#nimbus, nimbus3d.js).
   The mascot script reads window.RJTour.pose (body) and window.RJTour.face() (face) while active.
   Edit the words in STEPS below; each step = { sec, el, say, act }.
   ===================================================================== */
(function () {
  'use strict';
  const RJ = window.RJ, gsap = window.gsap;
  const nb = document.getElementById('nimbus');
  if (!RJ || !gsap || !nb) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const narrow = () => innerWidth <= 700;
  const GUIDE = 'Daffodill';
  const HUD_H = 70;                 // px kept clear at the top (logo, nav)
  const BAR_H = 66;                 // px kept clear at the bottom (tour control bar)
  const SHOULDER = 0.27;            // her shoulders sit this far down her box (full-body framing)
  const plain = t => String(t || '').replace(/\*/g, '');

  // =====================================================================
  //  THE SCRIPT
  //  sec = section to be on, el = what she flies to and points at, say = her words,
  //  act = what her cursor does while she talks ('sweep' | 'magnet' | 'rush'), wave = waves while talking
  // =====================================================================
  const projs = i => () => $$('#works .proj')[i];
  const nth = (sel, i) => () => $$(sel)[i];
  const graphBox = i => () => $$('#graph .gx-box')[i];
  const graphText = i => () => {
    const s = window.RJGraph && RJGraph.data && RJGraph.data.specs && RJGraph.data.specs[i];
    return s ? plain(s.title) + '. ' + plain(s.text) : '';
  };
  const STEPS = [
    { sec: '#top', el: null, wave: true, say: "Hi, I'm " + GUIDE + "! I'll be your guide today. Sit back, I'll show you everything on Rohan's website." },
    { sec: '#top', el: '#top h1', act: 'sweep', say: "The headline says: Built for speed, finished by hand. That's Rohan's style: fast, smooth websites where every detail is crafted by hand." },
    { sec: '#top', el: '#top .lead', say: "Rohan is a BCA student specialising in AI and machine learning, from West Bengal. He builds AI tools and websites." },
    { sec: '#top', el: '#top .btns', act: 'magnet', say: "These two buttons are magnetic, watch them follow my cursor! See my work takes you to his projects, and Start a project takes you to his contact details." },
    { sec: '#top', el: null, act: 'rush', say: "Now look at the sky. It's not a picture, it's a live 3D scene. Press and hold anywhere and you rush through the clouds. Like this!" },
    { sec: '#top', el: () => narrow() ? $('#menuBtn') : $('.hud .nav'), say: "Up here is the menu, to jump to any section, and the Sound button turns on a soft wind sound. You don't need them right now though, I'll take you everywhere." },

    { sec: '#about', el: '#about h2', say: "This is the About section. One builder, the whole build: Rohan designs, codes and launches everything himself." },
    { sec: '#about', el: '#about .panel', act: 'sweep', say: "He studies BCA with a focus on AI and machine learning in Bardhaman, West Bengal. He loves building practical projects, from an AI voice assistant to a full e-commerce website, and learns something new with every one." },
    { sec: '#about', el: '#about .stats', act: 'sweep', say: "Quick facts: he's in his first year of BCA, he has built three projects so far, and his dream is to become a software developer." },
    { sec: '#about', el: '#about .skills', act: 'sweep', say: "His toolkit: Python, JavaScript, HTML and CSS, Three.js and GSAP for motion, Blender for 3D, voice AI, and Git with GitHub." },

    { sec: '#works', el: '#works h2', say: "Here's his selected work. Every card shows a small live animation of the project." },
    { sec: '#works', el: projs(0), act: 'sweep', say: "First, an AI voice assistant. It listens to your commands and answers you by speech." },
    { sec: '#works', el: projs(1), act: 'sweep', say: "Next, an e-commerce website: an online store with products, a cart and checkout pages." },
    { sec: '#works', el: projs(2), act: 'sweep', say: "And Keyblaze, a typing speed test with live words per minute, ranks, sound packs and thirteen difficulty levels. You can play it live from this card!" },

    { sec: '#approach', el: '#approach h2', say: "This is how Rohan works, in three simple steps." },
    { sec: '#approach', el: nth('#approach .step', 0), act: 'sweep', say: "Step one, Brief. He listens first, then maps your goal, your audience, and what the site must do in its first five seconds." },
    { sec: '#approach', el: nth('#approach .step', 1), act: 'sweep', say: "Step two, Build. You get working prototypes in the browser from week one, so you judge real motion instead of static mockups." },
    { sec: '#approach', el: nth('#approach .step', 2), act: 'sweep', say: "Step three, Launch. Everything is tested on real phones, tuned to run at sixty frames per second, and handed over with clean documentation." },

    { sec: '#flow', el: '#flow h2', say: "From idea to launch in seven weeks. Watch the timeline fill up as we go." },
    { sec: '#flow', el: nth('#flow .stage', 0), act: 'sweep', say: "Week one: discovery. Goals, references and a technical plan." },
    { sec: '#flow', el: nth('#flow .stage', 1), act: 'sweep', say: "Weeks two to three: a prototype, with the key interactions running in the browser." },
    { sec: '#flow', el: nth('#flow .stage', 2), act: 'sweep', say: "Weeks four to six: the full build, with content, performance work and testing." },
    { sec: '#flow', el: nth('#flow .stage', 3), act: 'sweep', say: "And week seven: launch. The site goes live, gets monitored, and is handed over to you." },

    { sec: '#graph', el: '#graph h2', say: "Now my favourite part: how this website was made. As we scroll, glowing lines grow out of the core and reveal each piece." },
    ...[0, 1, 2, 3, 4, 5].map(i => ({ sec: '#graph', graph: i, el: graphBox(i), say: graphText(i) })),

    { sec: '#contact', el: '#contact h2', say: "And finally, contact. Ready to start?" },
    { sec: '#contact', el: '#contact .panel p', say: "Rohan is open to internships, learning opportunities and freelance projects, and he replies within two days." },
    { sec: '#contact', el: '#contact .mail', act: 'sweep', say: "This is his email address. Click it to write to him directly." },
    { sec: '#contact', el: '#resumeDl', act: 'magnet', say: "This button downloads his résumé." },
    { sec: '#contact', el: '#contact .socials', act: 'sweep', say: "And here are his GitHub and LinkedIn profiles." },
    { sec: '#contact', el: null, wave: true, farewell: true, say: "That's the whole tour! Thank you so much for visiting. If you want to see it again, just click AI Auto. Bye bye!" }
  ].filter(s => s.graph == null || (window.RJGraph && RJGraph.data && RJGraph.data.specs && RJGraph.data.specs[s.graph]));

  // =====================================================================
  //  UI: speech bubble, control bar, her cursor
  // =====================================================================
  const mk = (cls, html, parent = document.body) => { const e = document.createElement('div'); e.className = cls; if (html) e.innerHTML = html; parent.appendChild(e); return e; };
  const bubble = mk('tour-bubble tour-ui', '<div class="who">' + GUIDE + '</div><p></p>');
  bubble.setAttribute('aria-live', 'polite');
  const bubbleP = $('p', bubble);
  const bar = mk('tour-bar tour-ui',
    '<span class="tb-tag">&#10022; AI Auto</span><span class="tb-step"></span>' +
    '<button type="button" data-t="back" aria-label="Previous step">&lsaquo; Back</button>' +
    '<button type="button" data-t="pause" aria-label="Pause">Pause</button>' +
    '<button type="button" data-t="next" aria-label="Next step">Next &rsaquo;</button>' +
    '<button type="button" data-t="voice" aria-pressed="true" aria-label="Voice">Voice</button>' +
    '<button type="button" data-t="stop" class="stop" aria-label="Stop the tour">Stop &times;</button>' +
    '<div class="tb-prog"><i></i></div>');
  bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'AI Auto tour controls');
  const stepLbl = $('.tb-step', bar), progBar = $('.tb-prog i', bar), pauseBtn = $('[data-t="pause"]', bar), voiceBtn = $('[data-t="voice"]', bar);
  const cursorEl = mk('tour-cursor tour-ui');

  // =====================================================================
  //  STATE (read by the mascot script every frame)
  // =====================================================================
  const pose = { zoom: 0, fly: 0, yaw: null, bob: 0, point: 0, pointSide: 1, pointDir: [0, 0, 1], wave: 0, waveSide: 1, talk: 0,
    speed: 0, vel: [0, 0], crouch: 0, flare: 0, roll: 0, state: 'hover', velPx: [0, 0] };   // state = hand-keyed clip (nimbus-motion.js)
  const TOP_SPEED = 950;            // px/s that counts as full speed (lean, wind, trail)
  const motion = { vx: 0, vy: 0, lx: 0, ly: 0, lt: 0, lastSpark: 0 };
  let flying = false;
  const look = { x: 0, y: 0.05, smile: 1.2, smirk: 0 };
  let active = false, paused = false, skip = false, backReq = false, stopReq = false;
  let idx = 0, curSec = null, graphP = 0, home = null, hairSwing = 0, speaking = false, typing = false;
  let target = null;                // rect of what she's presenting (the bubble stays clear of it)
  const pos = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const hasVoice = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
  let voiceOn = true;                // recorded lines play even without the browser's speech engine

  window.RJTour = {
    get active() { return active; },
    pose,
    face: () => ({ gx: look.x, gy: look.y, mc: look.smile, ms: look.smirk, hs: hairSwing }),
    start: () => start(),
    lines: () => STEPS.map(s => (typeof s.say === 'function' ? s.say() : s.say) || '').filter(Boolean),   // for voice/make
    stop: () => { stopReq = true; skip = true; }
  };

  // =====================================================================
  //  TIMING HELPERS: everything waits through pause, and finishes at once on Next / Back / Stop
  // =====================================================================
  const cut = () => skip || stopReq;
  function sleep(ms) {
    return new Promise(res => {
      let left = ms, last = performance.now();
      const tick = () => {
        const now = performance.now();
        if (!paused) left -= now - last;
        last = now;
        if (left <= 0 || cut()) res(); else setTimeout(tick, 30);
      };
      tick();
    });
  }
  function tween(target, vars) {
    return new Promise(res => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      const tw = gsap.to(target, Object.assign({}, vars, { onComplete: fin }));
      const watch = () => {
        if (done) return;
        if (cut()) { tw.progress(1); fin(); return; }
        if (tw.paused() !== paused) tw.paused(paused);
        setTimeout(watch, 40);
      };
      watch();
    });
  }

  // =====================================================================
  //  VOICE
  // =====================================================================
  let voice = null;
  function pickVoice() {
    if (!hasVoice) return null;
    const vs = speechSynthesis.getVoices(), en = vs.filter(v => /^en/i.test(v.lang));
    // neural "Natural" voices first (Edge, Windows 11, recent Chrome/Safari), then the best classic ones
    const prefs = [/(ava|emma|aria|jenny|sonia|libby|michelle|natasha|clara).*(natural|neural)/i, /(natural|neural)/i,
      /(samantha|serena|karen|moira|tessa).*(enhanced|premium)/i, /(enhanced|premium)/i, /google uk english female/i,
      /samantha/i, /google us english/i, /zira/i, /female/i];
    for (const p of prefs) { const v = en.find(x => p.test(x.name)); if (v) return v; }
    return en[0] || vs[0] || null;
  }
  if (hasVoice) { voice = pickVoice(); speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); }; }
  // ---- recorded natural voice (Kokoro, pre-generated: voice/<hash>.mp3, listed in voice/manifest.json) ----
  // Same voice in every browser; the browser's own voice is only the fallback for a missing line.
  const voiceHash = t => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
  let recorded = null, actx = null, analyser = null, levelBuf = null, voiceLevel = 0;
  fetch('voice/manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(m => { recorded = m && m.files ? new Set(m.files) : null; }).catch(() => {});
  function audioGraph() {                       // created on the AI Auto click (a user gesture), reused after
    if (actx || !window.AudioContext) return;
    try {
      actx = new AudioContext();
      analyser = actx.createAnalyser(); analyser.fftSize = 512; levelBuf = new Float32Array(analyser.fftSize);
      analyser.connect(actx.destination);
    } catch (e) { actx = null; }
  }
  function readLevel() {                        // loudness of her voice right now -> how far her mouth opens
    if (!analyser || !speaking) return 0;
    analyser.getFloatTimeDomainData(levelBuf);
    let sum = 0; for (let i = 0; i < levelBuf.length; i++) sum += levelBuf[i] * levelBuf[i];
    return Math.min(1, Math.sqrt(sum / levelBuf.length) * 7);
  }
  let curAudio = null;
  function hush() {                              // stop anything still speaking: never two voices at once
    if (curAudio) { try { curAudio.pause(); } catch (e) { /* already gone */ } curAudio = null; }
    if (hasVoice) speechSynthesis.cancel();
  }
  function playRecorded(text) {
    return new Promise(res => {
      hush();
      const a = curAudio = new Audio('voice/' + voiceHash(text) + '.mp3');
      let done = false;
      const fin = () => { if (!done) { done = true; speaking = false; res(true); } };
      a.onended = fin;
      // a missing file falls back to the browser voice; a blocked play() is retried once, never doubled
      a.onerror = () => { if (!done) { done = true; speaking = false; res(a.error && a.error.code === 4 ? false : true); } };
      if (actx) { try { actx.createMediaElementSource(a).connect(analyser); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* plays without the meter */ } }
      a.play().then(() => { speaking = true; }).catch(() => {
        if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
        setTimeout(() => { if (!done) a.play().then(() => { speaking = true; }).catch(() => { if (!done) { done = true; res(true); } }); }, 250);
      });
      // Pause/resume: only a line the tour itself paused is ever resumed. A line that just finished also
      // reports a.paused (before onended fires), and resuming that replayed it from the start.
      let held = false;
      const watch = () => {
        if (done) return;
        if (cut() || !voiceOn || curAudio !== a || a.ended) { if (!a.ended) a.pause(); fin(); return; }
        if (paused && !held && !a.paused) { held = true; a.pause(); }
        else if (!paused && held) { held = false; a.play().catch(() => {}); }
        setTimeout(watch, 60);
      };
      watch();
    });
  }
  async function speak(text) {
    if (!voiceOn || cut()) return;
    if (recorded && recorded.has(voiceHash(text))) {
      if (await playRecorded(text)) return;
      if (cut()) return;
    }
    hush();
    return speakSynth(text);
  }
  function speakSynth(text) {
    if (!voiceOn || !hasVoice || cut()) return Promise.resolve();
    return new Promise(res => {
      let done = false;
      const fin = () => { if (!done) { done = true; speaking = false; clearTimeout(guard); speechSynthesis.cancel(); res(); } };
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      const natural = voice && /(natural|neural|enhanced|premium)/i.test(voice.name);
      u.rate = natural ? 1.0 : 0.96; u.pitch = 1.0;          // a pushed-up pitch is what sounds robotic
      u.onstart = () => { speaking = true; };
      u.onend = fin; u.onerror = fin;
      const guard = setTimeout(fin, text.length * 95 + 5000);     // some browsers never fire onend
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      const watch = () => { if (done) return; if (cut()) { speechSynthesis.cancel(); fin(); return; } setTimeout(watch, 60); };
      watch();
    });
  }

  // =====================================================================
  //  HER CURSOR: synthetic pointer events, so the page's own effects react to her
  // =====================================================================
  let hoverChain = [];
  function elementAt(x, y) {
    return document.elementsFromPoint(x, y).find(e => !(e.closest && e.closest('.tour-ui'))) || null;
  }
  function fire(type, el, extra) {
    el.dispatchEvent(new PointerEvent(type, Object.assign({
      clientX: cur.x, clientY: cur.y, bubbles: !/enter|leave/.test(type), cancelable: true,
      pointerType: 'mouse', isPrimary: true, pointerId: 77
    }, extra)));
  }
  function hoverAt() {
    const el = elementAt(cur.x, cur.y);
    const chain = [];
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) chain.push(e);
    if (el !== hoverChain[0]) {
      if (hoverChain[0]) fire('pointerout', hoverChain[0]);
      hoverChain.filter(e => !chain.includes(e)).forEach(e => fire('pointerleave', e));
      if (el) fire('pointerover', el);
      chain.filter(e => !hoverChain.includes(e)).reverse().forEach(e => fire('pointerenter', e));
      hoverChain = chain;
    }
    if (el) fire('pointermove', el);
  }
  function releaseHover() {
    if (hoverChain[0]) fire('pointerout', hoverChain[0]);
    hoverChain.forEach(e => fire('pointerleave', e));
    hoverChain = [];
  }
  const moveCursor = (x, y, duration, ease = 'power2.inOut') => tween(cur, { x, y, duration, ease, onUpdate: hoverAt });

  async function sweepOver(el, ms) {
    const r = rectOf(el), t0 = performance.now();
    await moveCursor(r.left + r.width * 0.2, r.top + r.height * 0.3, 0.6);
    let k = 0;
    while (!cut() && performance.now() - t0 < ms) {
      const x = r.left + r.width * (0.15 + 0.7 * ((k % 2) ? 0.15 : 0.85)), y = r.top + r.height * (0.25 + 0.5 * ((k >> 1) % 2));
      await moveCursor(x, y, 1.1, 'sine.inOut');
      k++;
    }
  }
  async function magnetize(el, ms) {
    const btns = el.matches('.cta') ? [el] : $$('.cta', el);
    const per = ms / Math.max(1, btns.length);
    for (const b of btns) {
      if (cut()) break;
      const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, t0 = performance.now();
      await moveCursor(cx + r.width * 0.3, cy - r.height * 0.4, 0.6);
      let a = 0;
      while (!cut() && performance.now() - t0 < per) {     // circle around the button: it follows the cursor
        a += 0.9;
        await moveCursor(cx + Math.cos(a) * r.width * 0.42, cy + Math.sin(a) * r.height * 0.6, 0.35, 'sine.inOut');
      }
    }
    await moveCursor(cur.x, cur.y - 80, 0.4);
  }
  async function rushSky(ms) {
    const x = narrow() ? innerWidth * 0.5 : innerWidth * 0.62, y = innerHeight * 0.38;
    await moveCursor(x, y, 0.7);
    await sleep(400);
    const el = elementAt(cur.x, cur.y) || document.body;
    cursorEl.classList.add('down'); fire('pointerdown', el, { button: 0, buttons: 1 });
    await sleep(ms);
    cursorEl.classList.remove('down'); fire('pointerup', el, { button: 0, buttons: 0 });
  }

  // =====================================================================
  //  HER BODY: flying to a spot, pointing, facing
  // =====================================================================
  const size = () => ({ w: nb.offsetWidth, h: nb.offsetHeight });
  function tourHeight() { return narrow() ? Math.min(innerHeight * 0.3, 250) : Math.min(innerHeight * 0.58, 500); }
  function clampSpot(x, y) {
    const { w, h } = size();
    return {
      x: clamp(x, w * 0.32, innerWidth - w * 0.32),
      y: clamp(y, HUD_H + h * 0.42, Math.max(HUD_H + h * 0.42, innerHeight - BAR_H - h * 0.45))
    };
  }
  // the box of what's actually drawn (text or children), not the full-width block around it
  function rectOf(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return r.width > 2 && r.height > 2 ? r : el.getBoundingClientRect();
  }
  // where she should be: she only moves when she has to. Candidate spots (stay here, slide up/down her
  // own side, the other side) are scored by covering the thing she presents, covering other text, and
  // how far she'd travel. Staying put wins whenever it's good enough.
  const TEXTY = /^(H1|H2|H3|H4|P|LI|A|BUTTON|SPAN|STRONG|EM|B|I|SMALL|LABEL|IMG|svg|FIGURE|BLOCKQUOTE)$/;
  function boxAt(x, y) { const { w, h } = size(); return { left: x - w * 0.32, right: x + w * 0.32, top: y - h * 0.45, bottom: y + h * 0.45 }; }
  function hits(a, b, pad = 16) { return a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad; }
  // is this point on real content (text, a heading, a button, an image) rather than empty sky?
  function isText(el) {
    if (!el || el === document.body || el === document.documentElement || el.closest('.tour-ui,.tour-bar')) return false;
    if (el.closest('h1,h2,h3,h4,p,li,a,button,blockquote,figure,img,svg,label,.proj,.panel,.step,.gx-box')) return true;
    return TEXTY.test(el.tagName) || [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim().length > 1);
  }
  function textUnder(bx) {
    let n = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
      const x = bx.left + (bx.right - bx.left) * (i + 0.5) / 4, y = bx.top + (bx.bottom - bx.top) * (j + 0.5) / 6;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      if (isText(document.elementFromPoint(x, y))) n++;
    }
    return n;
  }
  function bestSpot(r) {
    const { w, h } = size();
    const ty = r ? r.top + r.height / 2 : innerHeight / 2;
    const ly = clampSpot(0, ty + h * (0.5 - SHOULDER)).y;
    const cands = narrow()
      ? [[pos.x, pos.y], [innerWidth - w * 0.36, innerHeight - BAR_H - h / 2], [w * 0.36, innerHeight - BAR_H - h / 2], [innerWidth - w * 0.36, HUD_H + h / 2], [w * 0.36, HUD_H + h / 2]]
      : [[pos.x, pos.y], [pos.x, ly], [innerWidth - w * 0.36, ly], [innerWidth - w * 0.36, pos.y], [w * 0.36, ly], [w * 0.36, pos.y]];
    let best = null;
    cands.forEach(([x, y], i) => {
      const c = clampSpot(x, y), bx = boxAt(c.x, c.y);
      const travel = Math.hypot(c.x - pos.x, c.y - pos.y);
      const sideSwitch = Math.abs(c.x - pos.x) > innerWidth * 0.35;
      const score = (r && hits(bx, r) ? 1000 : 0) + textUnder(bx) * 12 + travel * 0.08 + (sideSwitch ? 60 : 0) - (i === 0 ? 25 : 0);
      if (!best || score < best.score) best = { x: c.x, y: c.y, score };
    });
    return best;
  }
  // a real flight: crouch, spring off, follow a curved arc (speeding up, then braking), flare and settle.
  // Her facing, lean, banking, wind and trail all come from the actual motion in tick().
  async function flyToSpot(spot, opts = {}) {
    const d = Math.hypot(spot.x - pos.x, spot.y - pos.y);
    if (d < 6) return;
    const { h } = size();
    const p0 = { x: pos.x, y: pos.y }, long = d > 150;
    const lift = Math.min(110, d * 0.18) * (long ? 1 : 0.4);
    const minY = HUD_H + h * 0.3;
    const c1 = { x: p0.x + (spot.x - p0.x) * 0.3, y: Math.max(minY, p0.y + (spot.y - p0.y) * 0.3 - lift) };
    const c2 = { x: p0.x + (spot.x - p0.x) * 0.75, y: Math.max(minY, p0.y + (spot.y - p0.y) * 0.75 - lift * 0.8) };
    look.x = 0; look.y = 0.05;
    tween(pose, { point: 0, wave: 0, duration: 0.25 });
    // long trips play the keyed take-off (gather, spring) which flows into the glide loop;
    // short hops stay in the hover clip and just lean with the speed
    if (long && !opts.entering) { pose.state = 'takeoff'; await sleep(420); }   // entering: already gliding
    flying = true;
    const path = { t: 0 };
    await tween(path, {
      t: 1, duration: clamp(d / 480, 0.9, 2.6), ease: 'power2.inOut',
      onUpdate: () => {
        const t = path.t, u = 1 - t;
        pos.x = u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * spot.x;
        pos.y = u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * spot.y;
        if (!opts.exiting && t > 0.55 && pose.state !== 'hover') pose.state = 'hover';   // ease out of the glide while slowing
      }
    });
    flying = false;
    if (!opts.exiting) pose.state = 'hover';
  }
  async function presentTo(r) {
    const { h } = size();
    const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    const sx = pos.x, sy = pos.y - h / 2 + h * SHOULDER;
    const dx = tx - sx, dy = ty - sy;
    pose.pointSide = dx >= 0 ? 1 : -1;
    pose.pointDir = [dx, -dy, Math.hypot(dx, dy) * 0.25];
    look.x = clamp(dx / (innerWidth * 0.9), -0.4, 0.4);          // head + body stay within a natural neck twist
    look.y = clamp(dy / (innerHeight * 0.6), -0.7, 0.7);
    await tween(pose, { yaw: clamp(dx / innerWidth * 0.8, -0.4, 0.4), point: 1, duration: 0.7, ease: 'power2.inOut' });
  }
  const faceViewer = () => { look.x = 0; look.y = 0.05; return tween(pose, { yaw: 0, point: 0, duration: 0.45 }); };

  // wind trail: small glowing sparks left behind her while she flies fast
  const sparks = Array.from({ length: 22 }, () => mk('tour-spark tour-ui'));
  let sparkI = 0;
  function spark() {
    const el = sparks[sparkI++ % sparks.length], { h } = size();
    const x = pos.x - pose.vel[0] * 30 + (Math.random() - 0.5) * 26;
    const y = pos.y - h * 0.05 - pose.vel[1] * 30 + (Math.random() - 0.5) * h * 0.35;
    gsap.killTweensOf(el);
    gsap.fromTo(el, { x, y, opacity: 0.95, scale: 0.6 + Math.random() * 0.8 },
      { x: x - motion.vx * 0.18, y: y - motion.vy * 0.18 + 14, opacity: 0, scale: 0.15, duration: 0.6 + Math.random() * 0.4, ease: 'power2.out' });
  }

  // =====================================================================
  //  SECTIONS
  // =====================================================================
  async function goSection(sec) {
    if (sec === curSec) return;
    showBubble(false);
    // she stays where she is and floats while the page zooms through to the next section
    look.x = 0; look.y = 0.05;
    tween(pose, { point: 0, wave: 0, duration: 0.3 });
    await RJ.flyTo(sec);
    RJ.lenis.stop();
    curSec = sec; graphP = 0;
    await sleep(700);                 // let the section's reveal animation settle before measuring
  }
  async function graphTo(i) {
    const box = $$('#graph .gx-box')[i];
    if (!box) return;
    while (!box.classList.contains('is-on') && graphP < 1 && !stopReq) {
      graphP = Math.min(1, graphP + (cut() ? 0.05 : 0.004));
      RJ.lenis.scrollTo(RJ.graphY(graphP), { immediate: true, force: true });
      await new Promise(r => setTimeout(r, 16));
    }
    await sleep(250);
  }
  function centerCard(el) {          // phones: the works cards sit in a sideways carousel
    const grid = el.parentElement;
    if (!grid || grid.scrollWidth <= grid.clientWidth + 2) return Promise.resolve();
    grid.scrollTo({ left: el.offsetLeft - (grid.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
    return sleep(650);
  }

  // =====================================================================
  //  SPEECH BUBBLE
  // =====================================================================
  let bubbleShown = false;
  function showBubble(on) {
    if (on === bubbleShown) return;
    bubbleShown = on;
    gsap.to(bubble, { opacity: on ? 1 : 0, duration: 0.3, overwrite: 'auto' });
  }
  function placeBubble() {
    const { w, h } = size(), bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    let left, top;
    if (narrow()) {
      left = 12;                      // phones: full-width bubble on her side of the screen, toward the middle
      top = pos.y > innerHeight / 2 ? pos.y - h / 2 - bh + h * 0.08 : pos.y + h / 2 - h * 0.08;
    } else {
      // beside her head, on the side away from what she's pointing at (so it never covers it)
      const headY = pos.y - h / 2 + h * 0.1;
      const leftRoom = pos.x - w * 0.2 - 12, rightRoom = innerWidth - pos.x - w * 0.2 - 12;
      let side = pos.x > innerWidth / 2 ? -1 : 1;
      if (target) side = (target.left + target.right) / 2 < pos.x ? 1 : -1;
      if ((side > 0 ? rightRoom : leftRoom) >= bw) {
        left = side > 0 ? pos.x + w * 0.2 : pos.x - w * 0.2 - bw;
        top = headY - bh * 0.35;
      } else {                        // no room on that side: above her head
        left = pos.x - bw / 2;
        top = pos.y - h / 2 - bh + h * 0.04;
        if (top < HUD_H - 10) top = pos.y + h * 0.18;
      }
    }
    bubble.style.transform = 'translate(' + clamp(left, 12, innerWidth - bw - 12).toFixed(1) + 'px,' + clamp(top, HUD_H - 10, innerHeight - BAR_H - bh).toFixed(1) + 'px)';
  }
  let curLine = '';
  async function say(text) {
    text = typeof text === 'function' ? text() : text;
    if (!text) return;
    curLine = text;
    // when she speaks, the voice is the message: no caption. The bubble is only for a muted tour
    // (or a browser with no voice at all), so the words are still there to read.
    const voiced = voiceOn && (hasVoice || !!(recorded && recorded.has(voiceHash(text))));
    bubbleP.textContent = '';
    showBubble(!voiced);
    const typeMs = Math.min(1600, text.length * 16), t0 = performance.now();
    typing = true;
    const typer = setInterval(() => {
      const k = cut() ? 1 : Math.min(1, (performance.now() - t0) / typeMs);
      bubbleP.textContent = text.slice(0, Math.ceil(text.length * k));
      if (k >= 1) { clearInterval(typer); typing = false; }
    }, 30);
    // minimum time on screen: enough to read it, even if the browser's voice fails and ends at once
    const readMs = voiced ? 900 : text.length * 52 + 1400;
    await Promise.all([speak(text), sleep(readMs)]);
    clearInterval(typer); typing = false;
    bubbleP.textContent = text;
    await sleep(350);
    curLine = '';
  }

  // =====================================================================
  //  RUN ONE STEP
  // =====================================================================
  async function runStep(s) {
    await goSection(s.sec);
    if (s.graph != null) await graphTo(s.graph);
    let el = typeof s.el === 'function' ? s.el() : (s.el ? $(s.el) : null);
    if (el && el.closest('#works') && el.classList.contains('proj')) await centerCard(el);
    if (el) {
      const r = rectOf(el);
      if (r.width < 2 || r.bottom < 0 || r.top > innerHeight) el = null;
    }
    target = null;
    if (el) {
      const b = bestSpot(rectOf(el));
      if (Math.hypot(b.x - pos.x, b.y - pos.y) > 40) await flyToSpot(b);
      target = rectOf(el);
      await presentTo(target);
    } else {
      const b = bestSpot(null);
      if (Math.hypot(b.x - pos.x, b.y - pos.y) > 40) await flyToSpot(b);
      await faceViewer();
    }
    if (s.wave) { pose.waveSide = 1; tween(pose, { wave: 1, point: 0, duration: 0.5 }); look.smile = 1.6; }
    let act = null;
    if (s.act === 'sweep' && el) act = sweepOver(el, 4200);
    else if (s.act === 'magnet' && el) act = magnetize(el, 4200);
    else if (s.act === 'rush') act = rushSky(2600);
    await say(s.say);
    if (act) await act;
    look.smile = 1.2;
    await tween(pose, { point: 0, wave: 0, duration: 0.35 });
  }

  // =====================================================================
  //  START / LOOP / END
  // =====================================================================
  function updateBar() {
    stepLbl.textContent = (idx + 1) + ' / ' + STEPS.length;
    progBar.style.transform = 'scaleX(' + ((idx + 1) / STEPS.length).toFixed(3) + ')';
    pauseBtn.textContent = paused ? 'Play' : 'Pause';
    pauseBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    voiceBtn.setAttribute('aria-pressed', String(voiceOn));
  }
  let lastX = 0;
  function tick() {
    if (!active) return;
    nb.style.left = (pos.x - nb.offsetWidth / 2).toFixed(1) + 'px';
    nb.style.top = (pos.y - nb.offsetHeight / 2).toFixed(1) + 'px';
    lastX = pos.x;
    // her real motion -> speed, direction, facing, banking
    const now = performance.now(), dt = clamp((now - (motion.lt || now - 16)) / 1000, 0.001, 0.1);
    motion.lt = now;
    const prevVx = motion.vx;
    motion.vx += ((pos.x - motion.lx) / dt - motion.vx) * 0.3;
    motion.vy += ((pos.y - motion.ly) / dt - motion.vy) * 0.3;
    motion.lx = pos.x; motion.ly = pos.y;
    const sp = Math.hypot(motion.vx, motion.vy);
    pose.speed = clamp(sp / TOP_SPEED, 0, 1);
    pose.vel = sp > 4 ? [motion.vx / sp, motion.vy / sp] : [0, 0];
    pose.velPx = [motion.vx, motion.vy];
    if (flying) pose.yaw += (clamp(motion.vx / 280, -1, 1) * 0.85 - pose.yaw) * 0.12;     // turn toward where she's going
    const ax = (motion.vx - prevVx) / dt;
    pose.roll += ((flying ? clamp(-ax / 14000, -0.12, 0.12) : 0) - pose.roll) * 0.06;       // bank into speed changes
    hairSwing += (clamp(-motion.vx / 70, -14, 14) - hairSwing) * 0.12;
    if (flying && pose.speed > 0.3 && now - motion.lastSpark > 40) { motion.lastSpark = now; spark(); }
    voiceLevel += (readLevel() - voiceLevel) * 0.5;
    pose.mouth = analyser && speaking ? voiceLevel : null;          // recorded voice: the mouth follows the sound
    const target = speaking || (!voiceOn && typing) ? 1 : 0;
    pose.talk += (target - pose.talk) * 0.25;
    cursorEl.style.transform = 'translate(' + cur.x.toFixed(1) + 'px,' + cur.y.toFixed(1) + 'px)';
    placeBubble();
  }

  async function start() {
    if (active || !RJ.isReady()) return;
    audioGraph();
    active = true;
    if (RJ.nimbus && RJ.nimbus.load && !(await RJ.nimbus.load())) { active = false; return; }   // model not fetched yet: wait for it
    paused = false; skip = false; backReq = false; stopReq = false; idx = 0; curSec = null;
    if (document.body.classList.contains('locked') && $('#menuBtn')) $('#menuBtn').click();   // close the menu
    document.body.classList.add('touring');
    RJ.lenis.stop();

    // she isn't on the page until now: she glides in from off-screen right at full size
    const H = tourHeight();
    nb.style.right = 'auto'; nb.style.bottom = 'auto'; nb.style.height = H + 'px';
    const W = nb.offsetWidth || H * 0.75;
    home = { x: innerWidth + W * 0.7, y: innerHeight * 0.42, h: H };
    pos.x = lastX = home.x; pos.y = home.y;
    motion.lx = pos.x; motion.ly = pos.y; motion.vx = motion.vy = 0; motion.lt = 0;
    cur.x = innerWidth * 0.6; cur.y = innerHeight * 0.4;
    Object.assign(pose, { zoom: 1, bob: 2.2, state: 'glide', yaw: -0.85, talk: 0, point: 0, wave: 0 });
    gsap.set(nb, { opacity: 1 });
    gsap.ticker.add(tick);
    tick();
    bar.classList.add('on');
    gsap.to(cursorEl, { opacity: 1, duration: 0.4 });
    updateBar();
    await flyToSpot(bestSpot(null), { entering: true });

    while (idx < STEPS.length && !stopReq) {
      updateBar();
      await runStep(STEPS[idx]);
      if (stopReq) break;
      if (backReq) idx = Math.max(0, idx - 1); else idx++;
      backReq = false; skip = false;
      while (paused && !stopReq && !skip) await new Promise(r2 => setTimeout(r2, 60));
    }
    await finish();
  }

  async function finish() {
    hush();
    releaseHover();
    skip = false; stopReq = false; paused = false;
    showBubble(false);
    gsap.to(cursorEl, { opacity: 0, duration: 0.3 });
    bar.classList.remove('on');
    // farewell done: she flies off-screen and is gone until AI Auto is pressed again
    look.x = 0; look.y = 0.05; look.smile = 1.2;
    await flyToSpot({ x: innerWidth + (nb.offsetWidth || 300) * 0.8, y: innerHeight * 0.3 }, { exiting: true });
    gsap.set(nb, { opacity: 0 });
    gsap.ticker.remove(tick);
    nb.style.left = nb.style.top = nb.style.right = nb.style.bottom = nb.style.height = '';
    pose.yaw = null; pose.talk = 0; pose.speed = 0; pose.vel = [0, 0]; pose.roll = 0; pose.crouch = pose.flare = 0; pose.state = 'hover'; pose.velPx = [0, 0]; hairSwing = 0;
    document.body.classList.remove('touring');
    active = false;
    RJ.lenis.start();
  }

  // =====================================================================
  //  INPUT: buttons, keys, and blocking the visitor's own pointer while she drives
  // =====================================================================
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-ai-auto]');
    if (!b) return;
    e.preventDefault();
    start();
  });
  bar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !active) return;
    const t = b.dataset.t;
    if (t === 'pause') { paused = !paused; if (hasVoice) paused ? speechSynthesis.pause() : speechSynthesis.resume(); }
    else if (t === 'next') { paused = false; skip = true; hush(); }
    else if (t === 'back') { paused = false; backReq = true; skip = true; hush(); }
    else if (t === 'voice') {
      voiceOn = !voiceOn;
      if (!voiceOn) { hush(); if (curLine) { bubbleP.textContent = curLine; showBubble(true); } }   // muted: show the words instead
    }
    else if (t === 'stop') { stopReq = true; skip = true; paused = false; }
    updateBar();
  });
  addEventListener('keydown', e => {
    if (!active) return;
    const map = { Escape: 'stop', ArrowRight: 'next', ArrowLeft: 'back', ' ': 'pause' };
    const t = map[e.key];
    if (!t) return;
    e.preventDefault();
    const b = $('[data-t="' + t + '"]', bar);
    if (b) b.click();
  });
  // while she drives, the visitor's real pointer, wheel and touches don't reach the page (the control bar still works)
  ['pointermove', 'pointerdown', 'pointerup', 'pointerover', 'pointerout', 'mousedown', 'mouseup', 'mousemove', 'click', 'wheel', 'touchstart', 'touchmove', 'contextmenu'].forEach(type => {
    addEventListener(type, e => {
      if (!active || !e.isTrusted) return;
      if (e.target && e.target.closest && e.target.closest('.tour-bar')) return;
      e.stopImmediatePropagation();
      if (type === 'click' || type === 'wheel' || type === 'touchmove' || type === 'contextmenu') e.preventDefault();
    }, { capture: true, passive: false });
  });
})();
