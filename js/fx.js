import * as THREE from 'three';

const SHARDS = 600, CONF = 400, TRACKS = 700;

export class FX {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    // crush shards
    this.sh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.2, flatShading: true }), SHARDS);
    this.sh.frustumCulled = false;
    this.shP = []; for (let i = 0; i < SHARDS; i++) { this.sh.setMatrixAt(i, m); this.sh.setColorAt(i, new THREE.Color(1, 1, 1)); this.shP.push({ life: 0 }); }
    this.shI = 0; scene.add(this.sh);
    // confetti
    this.cf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONF);
    this.cf.frustumCulled = false;
    this.cfP = []; for (let i = 0; i < CONF; i++) { this.cf.setMatrixAt(i, m); this.cf.setColorAt(i, new THREE.Color(1, 1, 1)); this.cfP.push({ life: 0 }); }
    this.cfI = 0; scene.add(this.cf);
    // tracks
    this.tr = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.26).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }), TRACKS);
    this.tr.frustumCulled = false; this.tr.renderOrder = 0;
    for (let i = 0; i < TRACKS; i++) this.tr.setMatrixAt(i, m);
    this.trI = 0; scene.add(this.tr);

    this.popLayer = document.getElementById('popups');
    this.pops = [];
    this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpE = new THREE.Euler(); this.tmpV = new THREE.Vector3(); this.tmpS = new THREE.Vector3();
    this.col = new THREE.Color();
  }

  shards(x, y, z, color, n = 6) {
    for (let k = 0; k < n; k++) {
      const p = this.shP[this.shI]; const id = this.shI; this.shI = (this.shI + 1) % SHARDS;
      p.life = 0.6 + Math.random() * 0.4; p.x = x; p.y = y; p.z = z;
      p.vx = (Math.random() - 0.5) * 7; p.vy = 3 + Math.random() * 6; p.vz = (Math.random() - 0.5) * 7;
      p.rx = Math.random() * 6; p.ry = Math.random() * 6; p.s = 0.06 + Math.random() * 0.12;
      this.sh.setColorAt(id, this.col.set(color));
      this.sh.instanceColor.needsUpdate = true;
    }
  }

  confetti(x, y, z, n = 60, spread = 6) {
    const cols = [0xff4d6d, 0xffd23f, 0x3ec1ff, 0x7bea5b, 0xb36bff, 0xffffff];
    for (let k = 0; k < n; k++) {
      const p = this.cfP[this.cfI]; const id = this.cfI; this.cfI = (this.cfI + 1) % CONF;
      p.life = 1.6 + Math.random() * 1.2; p.x = x; p.y = y; p.z = z;
      const a = Math.random() * 6.28, sp = Math.random() * spread;
      p.vx = Math.cos(a) * sp; p.vy = 6 + Math.random() * 8; p.vz = Math.sin(a) * sp;
      p.rx = Math.random() * 6; p.ry = Math.random() * 6; p.wr = (Math.random() - 0.5) * 14;
      this.cf.setColorAt(id, this.col.set(cols[(Math.random() * cols.length) | 0]));
      this.cf.instanceColor.needsUpdate = true;
    }
  }

  track(x, z, heading) {
    this.tmpQ.setFromAxisAngle(this.tmpV.set(0, 1, 0), heading);
    this.tmpM.compose(this.tmpS.set(x, 0.015, z), this.tmpQ, this.tmpV.set(1, 1, 1));
    this.tr.setMatrixAt(this.trI, this.tmpM);
    this.trI = (this.trI + 1) % TRACKS;
    this.tr.instanceMatrix.needsUpdate = true;
  }

  popup(text, x, y, z, cls = '') {
    if (this.pops.length > 24) { const o = this.pops.shift(); o.el.remove(); }
    const el = document.createElement('div');
    el.className = 'pop ' + cls; el.textContent = text;
    this.popLayer.appendChild(el);
    this.pops.push({ el, x, y, z, t: 0 });
  }

  update(dt, w, h) {
    const g = -18;
    let any = false;
    for (let i = 0; i < SHARDS; i++) {
      const p = this.shP[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt; p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      p.rx += dt * 8;
      const s = p.life > 0 ? p.s * Math.min(1, p.life * 3) : 0;
      this.tmpQ.setFromEuler(this.tmpE.set(p.rx, p.ry, 0));
      this.tmpM.compose(this.tmpV.set(p.x, p.y, p.z), this.tmpQ, this.tmpS.set(s, s, s));
      this.sh.setMatrixAt(i, this.tmpM);
    }
    if (any) this.sh.instanceMatrix.needsUpdate = true;
    any = false;
    for (let i = 0; i < CONF; i++) {
      const p = this.cfP[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt; p.vy += g * 0.35 * dt; p.vy = Math.max(p.vy, -3);
      p.vx *= 1 - dt * 1.2; p.vz *= 1 - dt * 1.2;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.wr * dt; p.ry += dt * 3;
      const s = p.life > 0 ? Math.min(1, p.life * 2) : 0;
      this.tmpQ.setFromEuler(this.tmpE.set(p.rx, p.ry, 0));
      this.tmpM.compose(this.tmpV.set(p.x, p.y, p.z), this.tmpQ, this.tmpS.set(s, s, s));
      this.cf.setMatrixAt(i, this.tmpM);
    }
    if (any) this.cf.instanceMatrix.needsUpdate = true;

    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t += dt;
      if (p.t > 1.1) { p.el.remove(); this.pops.splice(i, 1); continue; }
      this.tmpV.set(p.x, p.y + p.t * 1.8, p.z).project(this.camera);
      const sx = (this.tmpV.x * 0.5 + 0.5) * w, sy = (-this.tmpV.y * 0.5 + 0.5) * h;
      const sc = p.t < 0.15 ? 0.6 + p.t / 0.15 * 0.6 : 1.2 - Math.min(0.2, (p.t - 0.15));
      p.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(${sc})`;
      p.el.style.opacity = p.t > 0.75 ? String(1 - (p.t - 0.75) / 0.35) : '1';
    }
  }
}
