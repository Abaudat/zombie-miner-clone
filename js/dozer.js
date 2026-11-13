import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MASK_DOZER } from './config.js';

const std = (color, rough = 0.4, metal = 0.05, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export function buildCat(mats) {
  const cat = new THREE.Group();
  const { fur, white, pink, black, stripe } = mats;
  const body = mesh(new THREE.SphereGeometry(0.42, 20, 14), fur, 0, 0.34, 0, cat); body.scale.set(1, 1.05, 0.9);
  const belly = mesh(new THREE.SphereGeometry(0.3, 16, 12), white, 0, 0.32, 0.17, cat); belly.scale.set(1, 1.1, 0.7);
  const head = mesh(new THREE.SphereGeometry(0.38, 24, 18), fur, 0, 0.98, 0.02, cat); head.scale.set(1.08, 0.95, 0.95);
  const earG = new THREE.ConeGeometry(0.13, 0.26, 12);
  const innerG = new THREE.ConeGeometry(0.075, 0.16, 10);
  for (const sx of [-1, 1]) {
    const e = mesh(earG, fur, sx * 0.22, 1.29, -0.02, cat); e.rotation.z = -sx * 0.35;
    const ie = mesh(innerG, pink, sx * 0.215, 1.27, 0.035, cat); ie.rotation.z = -sx * 0.35;
    const eye = mesh(new THREE.SphereGeometry(0.068, 12, 10), black, sx * 0.14, 1.02, 0.31, cat); eye.scale.set(0.9, 1.15, 0.6);
    mesh(new THREE.SphereGeometry(0.022, 8, 6), white, sx * 0.14 + 0.02, 1.06, 0.355, cat);
    const cheek = mesh(new THREE.SphereGeometry(0.1, 12, 10), white, sx * 0.08, 0.88, 0.28, cat); cheek.scale.set(1.1, 0.8, 0.8);
    const paw = mesh(new THREE.SphereGeometry(0.1, 12, 10), white, sx * 0.24, 0.55, 0.36, cat); paw.scale.set(1, 0.8, 1.1);
  }
  mesh(new THREE.SphereGeometry(0.04, 10, 8), pink, 0, 0.93, 0.37, cat);
  for (let i = -1; i <= 1; i++) {
    const s = mesh(new THREE.BoxGeometry(0.05, 0.03, 0.2), stripe, i * 0.12, 1.3, 0.06, cat);
    s.rotation.y = i * 0.3; s.rotation.x = -0.4;
  }
  const tail = mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 16, Math.PI * 1.1), fur, 0.25, 0.25, -0.35, cat);
  tail.rotation.set(0, Math.PI / 2, 0.4);
  // hard hat
  const hatMat = std(0xffd21f, 0.35, 0.05);
  const hat = mesh(new THREE.SphereGeometry(0.33, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatMat, 0, 1.17, 0.0, cat);
  hat.scale.set(1.05, 0.75, 1.05);
  mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 24), hatMat, 0, 1.18, 0.05, cat);
  mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), hatMat, 0, 1.38, 0, cat);
  return cat;
}

export function catMats() {
  return {
    fur: std(0xff9a3c, 0.6), white: std(0xfff6ea, 0.6), pink: std(0xff8fa8, 0.5),
    black: std(0x1a1414, 0.2), stripe: std(0xd9661a, 0.6),
  };
}

export class Dozer {
  constructor(scene) {
    this.x = 0; this.z = 0; this.heading = Math.PI; this.speed = 0;
    this.maxSpeed = 5.6; this.bladeW = 2.6; this.load = 0;
    this.trackDist = 0; this.bob = 0; this.squash = 0; this.lastSpeed = 0;
    this.root = new THREE.Group();
    this.model = new THREE.Group();
    this.root.add(this.model);
    scene.add(this.root);

    const yellow = std(0xffb21e, 0.35, 0.1);
    const dark = std(0x2a2a33, 0.7, 0.1);
    const metal = std(0x9aa0aa, 0.3, 0.8);
    this.mats = { yellow, dark, metal, blade: std(0xff8c12, 0.35, 0.15) };
    const M = this.model;

    for (const sx of [-1, 1]) {
      mesh(new RoundedBoxGeometry(0.56, 0.64, 2.55, 3, 0.22), dark, sx * 0.92, 0.32, -0.15, M);
      for (let i = 0; i < 3; i++) {
        const w = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 14), metal, sx * 1.21, 0.32, -0.95 + i * 0.8, M);
        w.rotation.z = Math.PI / 2;
      }
    }
    mesh(new RoundedBoxGeometry(1.5, 0.7, 2.1, 3, 0.16), yellow, 0, 0.88, -0.15, M);
    mesh(new RoundedBoxGeometry(1.25, 0.5, 0.9, 3, 0.14), yellow, 0, 1.38, 0.45, M);
    mesh(new RoundedBoxGeometry(1.0, 0.08, 0.5, 2, 0.03), dark, 0, 1.63, 0.5, M);
    const ex = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.75, 10), dark, 0.42, 1.9, 0.62, M);
    this.exhaust = ex;
    mesh(new RoundedBoxGeometry(1.1, 0.3, 0.9, 2, 0.1), dark, 0, 1.3, -0.55, M); // seat
    // roll bar
    for (const sx of [-1, 1]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8), dark, sx * 0.62, 1.95, -1.05, M);
    const bar = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8), dark, 0, 2.7, -1.05, M); bar.rotation.z = Math.PI / 2;
    const beacon = mesh(new THREE.SphereGeometry(0.11, 12, 8), std(0xff4422, 0.3, 0, { emissive: 0xff2200, emissiveIntensity: 0.8 }), 0.45, 2.8, -1.05, M);
    this.beacon = beacon;
    // arms
    for (const sx of [-1, 1]) {
      const a = mesh(new RoundedBoxGeometry(0.16, 0.22, 1.25, 2, 0.06), yellow, sx * 0.86, 0.66, 1.0, M);
      a.rotation.x = 0.12;
    }
    this.cat = buildCat(catMats());
    this.cat.position.set(0, 1.25, -0.55);
    this.cat.scale.setScalar(0.95);
    M.add(this.cat);

    this.blade = new THREE.Group();
    this.blade.position.set(0, 0, 1.75);
    M.add(this.blade);
    this.setBlade(2.6);
  }

  setBlade(w) {
    this.bladeW = w;
    const B = this.blade;
    while (B.children.length) { const c = B.children.pop(); c.geometry.dispose(); }
    const { blade, metal } = this.mats;
    const plate = mesh(new RoundedBoxGeometry(w, 0.95, 0.2, 2, 0.06), blade, 0, 0.52, 0, B);
    plate.rotation.x = -0.08;
    mesh(new RoundedBoxGeometry(w + 0.06, 0.14, 0.36, 2, 0.05), blade, 0, 1.0, -0.05, B);
    mesh(new THREE.BoxGeometry(w, 0.1, 0.16), metal, 0, 0.07, 0.1, B);
    const n = Math.max(3, Math.round(w / 0.45));
    const toothG = new THREE.ConeGeometry(0.09, 0.22, 4);
    for (let i = 0; i < n; i++) {
      const tx = -w / 2 + 0.2 + (w - 0.4) * (i / (n - 1));
      const t = mesh(toothG, metal, tx, 0.06, 0.24, B); t.rotation.x = Math.PI / 2;
    }
    for (const sx of [-1, 1]) {
      const wing = mesh(new RoundedBoxGeometry(0.12, 0.9, 0.7, 2, 0.04), blade, sx * (w / 2 + 0.12), 0.5, 0.28, B);
      wing.rotation.y = sx * 0.4;
    }
  }

  // kinematic colliders for the physics
  colliders() {
    const a = this.heading, s = Math.sin(a), c = Math.cos(a);
    const at = (lx, lz) => [this.x + lx * c + lz * s, this.z - lx * s + lz * c];
    const w = this.bladeW;
    const [bx, bz] = at(0, 1.78);
    const [rx, rz] = at(w / 2 + 0.12, 2.05);
    const [lx, lz] = at(-(w / 2 + 0.12), 2.05);
    const [cx, cz] = at(0, -0.15);
    return [
      { x: bx, z: bz, a, hx: w / 2, hz: 0.14, h: 1.05, pusher: true },
      { x: rx, z: rz, a: a + 0.4, hx: 0.07, hz: 0.36, h: 1.0, pusher: true },
      { x: lx, z: lz, a: a - 0.4, hx: 0.07, hz: 0.36, h: 1.0, pusher: true },
      { x: cx, z: cz, a, hx: 1.22, hz: 1.4, h: 1.7, pusher: false },
    ];
  }

  step(dt, inp, physics, loadContacts, belts = []) {
    // load slows the dozer down a bit: feel the weight of the pile
    this.load += (loadContacts - this.load) * Math.min(1, dt * 6);
    const loadF = Math.max(0.55, 1 - this.load * 0.0035);
    let desired = 0;
    if (inp.mag > 0) {
      const target = Math.atan2(inp.x, -inp.y);
      let diff = target - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const turn = 4.6 * dt;
      this.heading += Math.max(-turn, Math.min(turn, diff));
      const align = Math.cos(diff);
      desired = this.maxSpeed * loadF * inp.mag * (align > 0 ? Math.max(0.3, align) : 0.12);
    }
    const k = desired > this.speed ? 3.5 : 7;
    this.speed += (desired - this.speed) * Math.min(1, dt * k);
    let nx = this.x + Math.sin(this.heading) * this.speed * dt;
    let nz = this.z + Math.cos(this.heading) * this.speed * dt;
    for (const b of belts) { // ride the conveyor
      if (this.x > b.x0 && this.x < b.x1 && this.z > b.z0 && this.z < b.z1) { nx += b.dx * b.speed * 0.6 * dt; nz += b.dz * b.speed * 0.6 * dt; }
    }
    const [cx, cz] = physics.collideCircle(nx, nz, 1.35, MASK_DOZER);
    // front circle (blade area) also stays inside walls
    const fx = Math.sin(this.heading) * 1.4, fz = Math.cos(this.heading) * 1.4;
    const [qx, qz] = physics.collideCircle(cx + fx, cz + fz, 0.9, MASK_DOZER);
    const ddx = qx - fx - this.x, ddz = qz - fz - this.z;
    this.x = qx - fx; this.z = qz - fz;
    physics.kin = this.colliders();
    for (const c of physics.kin) if (c.pusher) { c.dx = ddx; c.dz = ddz; }
  }

  updateVisual(dt, time) {
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.heading;
    const acc = (this.speed - this.lastSpeed) / Math.max(dt, 1e-3);
    this.lastSpeed = this.speed;
    this.squash += (Math.max(-1, Math.min(1, acc * 0.08)) - this.squash) * Math.min(1, dt * 8);
    const sp = Math.abs(this.speed);
    this.model.position.y = Math.abs(Math.sin(time * 22)) * 0.025 * Math.min(1, sp);
    this.model.rotation.x = -this.squash * 0.05 + Math.min(0.04, this.load * 0.0004);
    this.model.scale.set(1 + this.squash * 0.02, 1 - this.squash * 0.03, 1 + this.squash * 0.04);
    this.exhaust.scale.y = 1 + Math.sin(time * 30) * 0.06 * (0.3 + sp * 0.1);
    this.cat.rotation.z = Math.sin(time * 3) * 0.04;
    this.cat.position.y = 1.25 + Math.sin(time * 6) * 0.015;
    this.beacon.material.emissiveIntensity = 0.4 + 0.6 * (Math.sin(time * 8) > 0 ? 1 : 0);
  }
}
