import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, prune, dedup } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
const [,, basePath, animPath, outPath] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const base = await io.read(basePath), anim = await io.read(animPath);
const bRoot = base.getRoot(), aRoot = anim.getRoot();
const byName = new Map(bRoot.listNodes().map(n => [n.getName(), n]));
// rest-pose sanity: the animation file's rest TRS should match the site model's
let worst = 0;
for (const n of aRoot.listNodes()) {
  const b = byName.get(n.getName()); if (!b || !/^Bip001/.test(n.getName())) continue;
  const q1 = n.getRotation(), q2 = b.getRotation();
  const d = Math.abs(Math.abs(q1[0]*q2[0]+q1[1]*q2[1]+q1[2]*q2[2]+q1[3]*q2[3]) - 1);
  worst = Math.max(worst, d);
}
console.log('rest rotation mismatch (0 = identical):', worst.toExponential(2));
bRoot.listAnimations().forEach(a => a.dispose());
const buf = bRoot.listBuffers()[0];
let chans = 0;
for (const a of aRoot.listAnimations()) {
  const out = base.createAnimation(a.getName());
  for (const c of a.listChannels()) {
    const tn = c.getTargetNode(); if (!tn) continue;
    const name = tn.getName();
    if (!/^Bip001/.test(name)) continue;                       // body only; hair/cloth stay physics
    const path = c.getTargetPath();
    if (path === 'scale') continue;
    if (path === 'translation' && !/Pelvis/.test(name)) continue;
    const b = byName.get(name); if (!b) continue;
    const s = c.getSampler();
    const inp = base.createAccessor().setArray(s.getInput().getArray().slice()).setType('SCALAR').setBuffer(buf);
    const outA = base.createAccessor().setArray(s.getOutput().getArray().slice()).setType(s.getOutput().getType()).setBuffer(buf);
    const ns = base.createAnimationSampler().setInput(inp).setOutput(outA).setInterpolation(s.getInterpolation());
    out.addSampler(ns).addChannel(base.createAnimationChannel().setTargetNode(b).setTargetPath(path).setSampler(ns));
    chans++;
  }
}
await base.transform(resample({ tolerance: 1e-4 }), dedup(), prune());
await io.write(outPath, base);
console.log('channels', chans, 'animations', bRoot.listAnimations().map(a => a.getName()).join(','));
