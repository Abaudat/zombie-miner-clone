// Coins as real rigid bodies (Rapier): rounded-cylinder discs that tumble, roll on edge,
// stack and slide with friction. Gems keep the custom sphere solver (physics.js).
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { MASK_COIN } from './config.js';

export const COIN_RAD = 0.32, COIN_HALF = 0.055;
// coin tiers (value in zone units): bronze, silver, gold, big gold, royal purple
export const TIERS = [
  { v: 1, color: 0xc77a3c, metal: 0.9, size: 1 },
  { v: 5, color: 0xe4e9f0, metal: 1, size: 1.06 },
  { v: 25, color: 0xffc22e, metal: 1, size: 1.14 },
  { v: 100, color: 0xffb21a, metal: 1, size: 1.32 },
  { v: 500, color: 0xb44dff, metal: 0.6, size: 1.5 },
];
const STEP = 1 / 60;

function coinGeometry() {
  // lathe profile in unit coords (radius 1, half thickness 1), scaled to the collider below
  const pts = [[0, -1], [0.93, -1], [1, -0.6], [1, 0.6], [0.93, 1], [0.8, 1], [0.74, 0.55], [0, 0.55]]
    .map(([x, y]) => new THREE.Vector2(x * COIN_RAD, y * COIN_HALF));
  return new THREE.LatheGeometry(pts, 20);
}

export class Coins {
  static async create(scene, cap) {
    await RAPIER.init();
    return new Coins(scene, cap);
  }

  constructor(scene, cap) {
    this.cap = cap;
    const w = this.world = new RAPIER.World({ x: 0, y: -24, z: 0 });
    w.timestep = STEP;
    w.integrationParameters.numSolverIterations = 2;
    // one big floor; the island rims are walls, so coins never reach the chasms
    const floor = w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1, -200));
    w.createCollider(RAPIER.ColliderDesc.cuboid(400, 1, 420).setFriction(0.7), floor);
    this.wallBodies = [];
    // bulldozer parts: kinematic boxes driven every step
    this.kin = [];

    this.body = new Array(cap).fill(null);
    this.value = new Float64Array(cap); this.tier = new Uint8Array(cap);
    this.px = new Float32Array(cap); this.py = new Float32Array(cap); this.pz = new Float32Array(cap);
    this.alive = new Uint8Array(cap);
    // our own sleeping: resting coins become fixed bodies until something disturbs them
    this.frozen = new Uint8Array(cap); this.rest = new Float32Array(cap);
    this.free = [];
    for (let i = cap - 1; i >= 0; i--) this.free.push(i);
    this.maxIndex = 0; this.count = 0;
    this.acc = 0;

    // one instanced mesh per tier so each keeps its own metal look
    this.meshes = TIERS.map(t => {
      const c = new THREE.Color(t.color);
      const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: t.metal, envMapIntensity: 2.2, emissive: c.clone().multiplyScalar(0.28), emissiveIntensity: 0.6 });
      const geo = coinGeometry(); geo.scale(t.size, t.size, t.size);
      const im = new THREE.InstancedMesh(geo, mat, cap);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.instanceMatrix.array.fill(0);
      im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      scene.add(im);
      return im;
    });
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1);
    this.belts = [];
  }

  setWalls(walls) {
    for (const b of this.wallBodies) this.world.removeRigidBody(b);
    this.wallBodies = [];
    for (const wl of walls) {
      if (!(wl.mask & MASK_COIN)) continue;
      const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation((wl.x0 + wl.x1) / 2, 2, (wl.z0 + wl.z1) / 2));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid((wl.x1 - wl.x0) / 2, 2, (wl.z1 - wl.z0) / 2).setFriction(0.3), b);
      this.wallBodies.push(b);
    }
  }

  // colliders: [{x,z,a,hx,hz,h}] as produced by Dozer.colliders()
  setKinematic(cols) {
    const w = this.world;
    while (this.kin.length < cols.length) {
      const c = cols[this.kin.length];
      const b = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(c.x, c.h / 2, c.z));
      w.createCollider(RAPIER.ColliderDesc.cuboid(c.hx, c.h / 2, c.hz).setFriction(0.5), b);
      this.kin.push({ b, hx: c.hx });
    }
    cols.forEach((c, i) => {
      const k = this.kin[i];
      if (Math.abs(k.hx - c.hx) > 1e-3) { // blade width changed: rebuild its collider
        w.removeCollider(k.b.collider(0), false);
        w.createCollider(RAPIER.ColliderDesc.cuboid(c.hx, c.h / 2, c.hz).setFriction(0.5), k.b);
        k.hx = c.hx;
      }
      k.b.setNextKinematicTranslation({ x: c.x, y: c.h / 2, z: c.z });
      k.b.setNextKinematicRotation({ x: 0, y: Math.sin(c.a / 2), z: 0, w: Math.cos(c.a / 2) });
    });
  }

  spawn(x, y, z, vx, vy, vz, value, tier = 0) {
    if (!this.free.length) return -1;
    const i = this.free.pop();
    const q = this.q.setFromEuler(new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinvel(vx, vy, vz).setAngvel({ x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 30 })
      .setLinearDamping(0.15).setAngularDamping(0.6);
    const b = this.world.createRigidBody(desc);
    const sz = TIERS[tier].size;
    this.world.createCollider(RAPIER.ColliderDesc.roundCylinder(COIN_HALF * sz - 0.025, COIN_RAD * sz - 0.025, 0.025)
      .setFriction(0.55).setRestitution(0.12).setDensity(2), b);
    this.body[i] = b; this.value[i] = value; this.tier[i] = tier; this.alive[i] = 1; this.frozen[i] = 0; this.rest[i] = 0;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    if (i + 1 > this.maxIndex) this.maxIndex = i + 1;
    this.count++;
    return i;
  }

  remove(i) {
    if (!this.alive[i]) return;
    this.wakeAround(this.px[i], this.py[i], this.pz[i], 1.0);
    this.world.removeRigidBody(this.body[i]);
    this.body[i] = null; this.alive[i] = 0; this.count--;
    const im = this.meshes[this.tier[i]];
    im.instanceMatrix.array.fill(0, i * 16, i * 16 + 16);
    im.instanceMatrix.needsUpdate = true;
    this.free.push(i);
  }

  freeze(i) {
    const b = this.body[i];
    b.setLinvel({ x: 0, y: 0, z: 0 }, false); b.setAngvel({ x: 0, y: 0, z: 0 }, false);
    b.setBodyType(RAPIER.RigidBodyType.Fixed, false);
    this.frozen[i] = 1;
  }

  thaw(i) {
    if (!this.frozen[i]) return;
    this.body[i].setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.frozen[i] = 0; this.rest[i] = 0;
  }

  wakeAround(x, y, z, r) {
    const { px, py, pz, alive, frozen } = this, r2 = r * r;
    for (let i = 0; i < this.maxIndex; i++) {
      if (!alive[i] || !frozen[i]) continue;
      const dx = px[i] - x, dy = py[i] - y, dz = pz[i] - z;
      if (dx * dx + dy * dy + dz * dz < r2) this.thaw(i);
    }
  }

  // spots: [{x, z, r}] areas where coins must be live (around the bulldozer)
  manage(dt, spots) {
    const { px, py, pz, alive, frozen, rest, body } = this;
    let thawed = 0;
    for (let i = 0; i < this.maxIndex; i++) {
      if (!alive[i]) continue;
      if (frozen[i]) {
        for (const s of spots) {
          const dx = px[i] - s.x, dz = pz[i] - s.z;
          if (dx * dx + dz * dz < s.r * s.r) { this.thaw(i); thawed++; break; }
        }
        continue;
      }
      const b = body[i], v = b.linvel(), a = b.angvel();
      if (v.x * v.x + v.y * v.y + v.z * v.z < 0.36 && a.x * a.x + a.y * a.y + a.z * a.z < 6.0 && !this.onBelt(px[i], py[i], pz[i])) {
        rest[i] += dt;
        if (rest[i] > 0.15) this.freeze(i);
      } else rest[i] = 0;
    }
    // coins shoved along the ground knock the frozen coins they run into back to life
    const fast = [];
    for (let i = 0; i < this.maxIndex; i++) {
      if (!alive[i] || frozen[i] || py[i] > 1.4) continue;
      let near = false; // only coins being shoved by the dozer (not ones raining from the crusher)
      for (const s of spots) { const dx = px[i] - s.x, dz = pz[i] - s.z; if (dx * dx + dz * dz < (s.r + 1.5) * (s.r + 1.5)) { near = true; break; } }
      if (!near) continue;
      const v = body[i].linvel();
      if (v.x * v.x + v.z * v.z > 1.0 && Math.abs(v.y) < 1.5) fast.push(i);
    }
    if (fast.length) {
      const grid = new Map();
      for (let i = 0; i < this.maxIndex; i++) {
        if (!alive[i] || !frozen[i]) continue;
        const key = Math.floor(px[i]) * 65536 + Math.floor(pz[i]);
        const l = grid.get(key); if (l) l.push(i); else grid.set(key, [i]);
      }
      for (const f of fast) {
        const cx = Math.floor(px[f]), cz = Math.floor(pz[f]);
        for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) {
          const l = grid.get(gx * 65536 + gz); if (!l) continue;
          for (const j of l) {
            if (!frozen[j]) continue;
            const dx = px[j] - px[f], dy = py[j] - py[f], dz = pz[j] - pz[f];
            if (dx * dx + dy * dy + dz * dz < 0.85 * 0.85) { this.thaw(j); thawed++; }
          }
        }
      }
    }
    return thawed;
  }

  onBelt(x, y, z) {
    for (const bt of this.belts) if (y < 0.9 && x > bt.x0 && x < bt.x1 && z > bt.z0 && z < bt.z1) return true;
    return false;
  }

  // random live coin (used to fold value when at the hard cap)
  randomAlive() {
    for (let t = 0; t < 30; t++) { const j = (Math.random() * this.maxIndex) | 0; if (this.alive[j]) return j; }
    return -1;
  }

  // advance with a fixed 60 Hz step; kinematic targets must be set before calling
  step(dt) {
    this.acc += dt;
    let n = 0;
    // at most one step per frame: under load the coins slow down instead of spiralling
    if (this.acc >= STEP * 0.9) {
      this.applyBelts();
      this.world.step();
      this.acc = Math.max(0, Math.min(this.acc - STEP, STEP)); n = 1;
    }
    return n;
  }

  applyBelts() {
    if (!this.belts.length) return;
    const { px, py, pz, alive, body } = this;
    for (let i = 0; i < this.maxIndex; i++) {
      if (!alive[i] || py[i] > 0.9) continue;
      if (this.frozen[i]) { if (this.onBelt(px[i], py[i], pz[i])) this.thaw(i); else continue; }
      for (const bt of this.belts) {
        if (px[i] < bt.x0 || px[i] > bt.x1 || pz[i] < bt.z0 || pz[i] > bt.z1) continue;
        const b = body[i], v = b.linvel();
        b.setLinvel({ x: v.x + (bt.dx * bt.speed - v.x) * 0.25, y: v.y, z: v.z + (bt.dz * bt.speed - v.z) * 0.25 }, true);
        break;
      }
    }
  }

  sync() {
    const { alive, body, px, py, pz, m4, q, v, one, tier, meshes } = this;
    const dirty = meshes.map(() => false);
    for (let i = 0; i < this.maxIndex; i++) {
      if (!alive[i]) continue;
      const b = body[i], arr = meshes[tier[i]].instanceMatrix.array;
      if ((this.frozen[i] || b.isSleeping()) && arr[i * 16 + 15] === 1) continue;
      const t = b.translation(), r = b.rotation();
      px[i] = t.x; py[i] = t.y; pz[i] = t.z;
      m4.compose(v.set(t.x, t.y, t.z), q.set(r.x, r.y, r.z, r.w), one);
      m4.toArray(arr, i * 16);
      dirty[tier[i]] = true;
    }
    dirty.forEach((d, k) => { if (d) meshes[k].instanceMatrix.needsUpdate = true; });
  }

}
