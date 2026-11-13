import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ZONES, LAYOUT, COIN_R, zw } from './config.js';
import { GEM, COIN } from './physics.js';

const COIN_CAP = 2600;

function gemGeometry(type) {
  switch (type) {
    case 'marble': return new THREE.IcosahedronGeometry(1, 2);
    case 'orb': return new THREE.IcosahedronGeometry(1, 2);
    case 'crystal': { const g = new RoundedBoxGeometry(1.55, 1.55, 1.55, 2, 0.42); return g; }
    case 'emerald': { const g = new THREE.IcosahedronGeometry(1.05, 0); g.scale(1, 0.85, 1); return g; }
    case 'nugget': {
      const g = new THREE.IcosahedronGeometry(1.05, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = 1 + 0.16 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.7 - x * 2.1);
        p.setXYZ(i, x * n, y * n * 0.85, z * n);
      }
      g.computeVertexNormals();
      return g;
    }
  }
}

function gemMaterial(Z) {
  const base = { color: Z.gemColor, emissive: Z.gemEmissive };
  switch (Z.gem) {
    case 'marble': return new THREE.MeshStandardMaterial({ ...base, roughness: 0.22, metalness: 0.1, envMapIntensity: 1.7, emissiveIntensity: 1.0 });
    case 'crystal': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.2, emissiveIntensity: 1.5 });
    case 'orb': return new THREE.MeshStandardMaterial({ ...base, roughness: 0.08, metalness: 1, envMapIntensity: 1.6 });
    case 'emerald': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.05, metalness: 0.1, clearcoat: 1, flatShading: true, envMapIntensity: 1.6, emissiveIntensity: 1.2 });
    case 'nugget': return new THREE.MeshStandardMaterial({ ...base, roughness: 0.22, metalness: 1, flatShading: true, envMapIntensity: 1.6 });
  }
}

function coinGeometry() {
  const pts = [[0, -0.17], [0.92, -0.17], [1, -0.11], [1, 0.11], [0.92, 0.17], [0.8, 0.17], [0.74, 0.1], [0, 0.1]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 18);
}

export class Bodies {
  constructor(scene, physics) {
    this.scene = scene; this.ph = physics;
    const cap = physics.cap;
    this.qx = new Float32Array(cap); this.qy = new Float32Array(cap); this.qz = new Float32Array(cap); this.qw = new Float32Array(cap);
    this.lx = new Float32Array(cap); this.lz = new Float32Array(cap);
    this.meshes = [];
    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xffc22e, roughness: 0.28, metalness: 1, envMapIntensity: 2.2, emissive: 0x6b3d00, emissiveIntensity: 0.5 });
    this.coinMesh = this.makeMesh(coinGeometry(), this.coinMat, COIN_CAP, COIN_R * 1.5);
    this.gemMeshes = [];
    physics.onRemove = i => this.hide(i);
  }

  makeMesh(geo, mat, cap, scale) {
    const im = new THREE.InstancedMesh(geo, mat, cap);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.instanceMatrix.array.fill(0);
    im.frustumCulled = false;
    im.castShadow = true; im.receiveShadow = true;
    this.scene.add(im);
    const free = [];
    for (let i = cap - 1; i >= 0; i--) free.push(i);
    const m = { im, free, scale, id: this.meshes.length, dirty: true };
    this.meshes.push(m);
    return m;
  }

  hide(i) {
    const m = this.meshes[this.ph.meshId[i]];
    m.im.instanceMatrix.array.fill(0, this.ph.inst[i] * 16, this.ph.inst[i] * 16 + 16);
    m.free.push(this.ph.inst[i]);
    m.dirty = true;
  }

  randQuat(i) {
    let x = Math.random() - 0.5, y = Math.random() - 0.5, z = Math.random() - 0.5, w = Math.random() - 0.5;
    const n = Math.hypot(x, y, z, w) || 1;
    this.qx[i] = x / n; this.qy[i] = y / n; this.qz[i] = z / n; this.qw[i] = w / n;
  }

  // Pre-placed field of gems, asleep, hex-packed in a wobbly blob
  spawnField(k) {
    if (this.gemMeshes[k]) return;
    const Z = ZONES[k], r = Z.gemR, F = LAYOUT.field;
    const ph = this.ph;
    const gen = (f, emit) => {
      const rx = F.maxRx * f, rs = F.maxRs * f;
      const dx = 2 * r * 1.002, ds = dx * Math.sqrt(3) / 2;
      const inside = (x, s) => {
        const a = (x / rx), b = (s - F.cs) / rs;
        const ang = Math.atan2(b, a);
        const wob = 1 + 0.12 * Math.sin(ang * 3 + k * 1.7) + 0.08 * Math.sin(ang * 5 + k);
        return (a * a + b * b) / (wob * wob);
      };
      let n = 0;
      const nj = Math.ceil(rs * 1.25 / ds), ni = Math.ceil(rx * 1.25 / dx);
      for (let j = -nj; j <= nj; j++) for (let i = -ni; i <= ni; i++) {
        const x = i * dx + (j & 1) * r, s = F.cs + j * ds;
        const v = inside(x, s);
        if (v > 1) continue;
        n++; if (emit) emit(x, r, s);
        if (v < 0.42) {
          const x2 = x + r, s2 = s + r / Math.sqrt(3);
          if (inside(x2, s2) < 0.42) { n++; if (emit) emit(x2, r + 2 * r * Math.sqrt(2 / 3), s2); }
        }
      }
      return n;
    };
    let lo = 0.2, hi = 1;
    for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (gen(mid) < Z.gemCount) lo = mid; else hi = mid; }
    const total = gen(hi);
    const mesh = this.makeMesh(gemGeometry(Z.gem), gemMaterial(Z), total, r * (Z.gem === 'crystal' ? 1.12 : 1.02));
    this.gemMeshes[k] = mesh;
    gen(hi, (x, y, s) => {
      const inst = mesh.free.pop();
      const i = ph.add(GEM, x + (Math.random() - 0.5) * 0.01, y, zw(k, s), r, k, Z.value, mesh.id, inst, false);
      if (i < 0) { mesh.free.push(inst); return; }
      this.randQuat(i); this.lx[i] = ph.px[i]; this.lz[i] = ph.pz[i];
    });
  }

  spawnCoin(x, y, z, vx, vy, vz, value, zone) {
    const m = this.coinMesh;
    if (!m.free.length) return -1;
    const inst = m.free.pop();
    const i = this.ph.add(COIN, x, y, z, COIN_R, zone, value, m.id, inst, true);
    if (i < 0) { m.free.push(inst); return -1; }
    this.ph.vx[i] = vx; this.ph.vy[i] = vy; this.ph.vz[i] = vz;
    this.randQuat(i); this.lx[i] = x; this.lz[i] = z;
    return i;
  }

  sync() {
    const ph = this.ph, n = ph.maxIndex;
    const { px, py, pz, alive, dirty, kind, r } = ph;
    const { qx, qy, qz, qw, lx, lz } = this;
    for (let i = 0; i < n; i++) {
      if (!alive[i] || !dirty[i]) continue;
      dirty[i] = 0;
      const m = this.meshes[ph.meshId[i]];
      const x = px[i], y = py[i], z = pz[i];
      if (kind[i] === GEM) {
        const dx = x - lx[i], dz = z - lz[i], d = Math.hypot(dx, dz);
        if (d > 1e-4) {
          const a = d / r[i] * 0.5, s = Math.sin(a) / d;
          const ax = dz * s, az = -dx * s, aw = Math.cos(a);
          const bx = qx[i], by = qy[i], bz = qz[i], bw = qw[i];
          let nx = ax * bw + aw * bx - az * by;
          let ny = aw * by + az * bx - ax * bz;
          let nz = az * bw + aw * bz + ax * by;
          let nw = aw * bw - ax * bx - az * bz;
          const nn = 1 / Math.hypot(nx, ny, nz, nw);
          qx[i] = nx * nn; qy[i] = ny * nn; qz[i] = nz * nn; qw[i] = nw * nn;
        }
      }
      lx[i] = x; lz[i] = z;
      writeMatrix(m.im.instanceMatrix.array, ph.inst[i] * 16, x, y, z, qx[i], qy[i], qz[i], qw[i], m.scale);
      m.dirty = true;
    }
    for (const m of this.meshes) if (m.dirty) { m.im.instanceMatrix.needsUpdate = true; m.dirty = false; }
  }
}

function writeMatrix(a, o, x, y, z, qx, qy, qz, qw, s) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  a[o] = (1 - (yy + zz)) * s; a[o + 1] = (xy + wz) * s; a[o + 2] = (xz - wy) * s; a[o + 3] = 0;
  a[o + 4] = (xy - wz) * s; a[o + 5] = (1 - (xx + zz)) * s; a[o + 6] = (yz + wx) * s; a[o + 7] = 0;
  a[o + 8] = (xz + wy) * s; a[o + 9] = (yz - wx) * s; a[o + 10] = (1 - (xx + yy)) * s; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
}
