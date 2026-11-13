import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ZONES, LAYOUT, ZONE_LEN, BRIDGE_W, MASK_ALL, MASK_COIN, MASK_DOZER, MASK_GEM, zw } from './config.js';
import { buildCat } from './dozer.js';

const std = (color, rough = 0.6, metal = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

function noiseTexture(base, var1 = 18, spots = true) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const col = new THREE.Color(base);
  g.fillStyle = '#' + col.getHexString(); g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = (Math.random() - 0.5) * var1;
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255 * 2.2})`;
    const r = 1 + Math.random() * (spots ? 6 : 2);
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function roundedRectShape(x0, y0, x1, y1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

// slab whose top is at y=0, spanning world x [x0,x1] and "north" n [n0,n1] (world z = -n)
function slab(x0, n0, x1, n1, topMat, sideMat, depth = 5) {
  const shape = roundedRectShape(x0, n0, x1, n1, 1.6);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.5, bevelSegments: 3, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.max.y, 0);
  const m = new THREE.Mesh(geo, [topMat, sideMat]);
  m.receiveShadow = true;
  return m;
}

function labelTexture(text, w = 256, h = 128, size = 92) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = `${size}px 'Lilita One', sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = '#2a1640';
  g.strokeText(text, w / 2, h / 2 + 4);
  g.fillStyle = '#ffffff'; g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.zones = [];
    this.wallMeshes = null;
    this.bridges = [];
    this.conveyors = [];
    this.rollers = [];
    this.lavaTex = null;
    this.beltTex = this.makeBeltTexture();
    this.woodMat = std(0xc98a4b, 0.7);
    this.woodDark = std(0x8a5a2e, 0.8);
    this.metalMat = std(0x8c96a3, 0.35, 0.7);
    this.time = 0;
    for (let k = 0; k < ZONES.length; k++) this.buildZone(k);
    this.buildAbyss();
  }

  makeBeltTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#2b2f36'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#3d434d'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 16, 64, 6);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  buildAbyss() {
    for (let k = 0; k < ZONES.length; k++) {
      const Z = ZONES[k];
      let mat;
      if (Z.lava) {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#ff4d0d'; g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 60; i++) {
          g.fillStyle = Math.random() < 0.5 ? 'rgba(255,200,40,0.55)' : 'rgba(150,20,0,0.5)';
          g.beginPath(); g.ellipse(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 14, 2 + Math.random() * 6, Math.random() * 3, 0, 7); g.fill();
        }
        this.lavaTex = new THREE.CanvasTexture(c); this.lavaTex.wrapS = this.lavaTex.wrapT = THREE.RepeatWrapping;
        this.lavaTex.repeat.set(6, 6); this.lavaTex.colorSpace = THREE.SRGBColorSpace;
        mat = new THREE.MeshBasicMaterial({ map: this.lavaTex });
      } else {
        mat = new THREE.MeshBasicMaterial({ color: Z.abyss });
      }
      const p = new THREE.Mesh(new THREE.PlaneGeometry(260, ZONE_LEN + 0.5), mat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(0, -9, zw(k, ZONE_LEN / 2 - 6));
      this.scene.add(p);
    }
  }

  buildZone(k) {
    const Z = ZONES[k], L = LAYOUT;
    const group = new THREE.Group();
    this.scene.add(group);
    const tex = noiseTexture(Z.ground, 22); tex.repeat.set(0.09, 0.09);
    const tex2 = noiseTexture(Z.ground2, 18); tex2.repeat.set(0.09, 0.09);
    const topF = std(0xffffff, 0.9, 0, { map: tex });
    const topP = std(0xffffff, 0.9, 0, { map: tex2 });
    const side = std(Z.side, 0.85);
    const base = k * ZONE_LEN;
    const mF = 3.2, mP = 3.2;
    group.add(slab(L.F.x0 - mF, base + L.F.s0 - 1.6, L.F.x1 + mF, base + L.F.s1 + 1.6, topF, side, 6));
    group.add(slab(L.P.x0 - mP, base + L.P.s0 - 1.6, L.P.x1 + mP, base + L.P.s1 + (k === 4 ? 7 : 1.6), topP, side, 6));
    // field tint decal: darker patch under the gems
    const zone = { k, group, crusherLabel: null };
    this.buildCrusher(zone);
    this.buildDecor(zone);
    if (k === 4) this.buildStatue(zone);
    this.zones.push(zone);
  }

  buildCrusher(zone) {
    const { k, group } = zone, Z = ZONES[k], C = LAYOUT.crusher;
    const z0 = zw(k, C.s1), z1 = zw(k, C.s0), zc = (z0 + z1) / 2;
    const pm = std(Z.pillar, 0.35, 0.1);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new RoundedBoxGeometry(C.pillarW, 3.2, 2.2, 3, 0.3), pm);
      p.position.set(sx * (C.x1 + C.pillarW / 2), 1.6, zc); p.castShadow = p.receiveShadow = true;
      group.add(p);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10), pm);
      cap.position.set(sx * (C.x1 + C.pillarW / 2), 3.25, zc); cap.castShadow = true;
      group.add(cap);
    }
    // 4 vertical spiked rollers
    const parts = [new THREE.CylinderGeometry(0.62, 0.62, 2.4, 18)];
    const cone = new THREE.ConeGeometry(0.16, 0.42, 6);
    for (let row = 0; row < 5; row++) for (let a = 0; a < 8; a++) {
      const g = cone.clone();
      g.rotateZ(-Math.PI / 2);
      const ang = a / 8 * Math.PI * 2 + row * 0.39;
      g.translate(0.78, 0, 0);
      g.rotateY(ang);
      g.translate(0, -0.95 + row * 0.48, 0);
      parts.push(g);
    }
    const rollerGeo = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));
    const rm = std(0xff6a1f, 0.4, 0.15);
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(rollerGeo, rm);
      r.position.set(-3 + i * 2, 1.2, zc); r.castShadow = true;
      r.userData.dir = i % 2 ? 1 : -1;
      group.add(r); this.rollers.push(r);
    }
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    lbl.position.set(0, 4.2, zc); lbl.rotation.x = -0.75;
    group.add(lbl);
    zone.crusherLabel = lbl;
  }

  setMultiplier(mult) {
    for (const z of this.zones) {
      if (z.crusherLabel.material.map) z.crusherLabel.material.map.dispose();
      z.crusherLabel.material.map = labelTexture('x' + mult);
      z.crusherLabel.material.needsUpdate = true;
      z.labelPop = 1;
    }
  }

  buildDecor(zone) {
    const { k, group } = zone, Z = ZONES[k], L = LAYOUT;
    let seed = 1234 + k * 77;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const spots = [];
    // margins along both long sides of both islands
    for (const isl of [L.F, L.P]) {
      for (const sx of [-1, 1]) {
        for (let s = isl.s0 + 1; s < isl.s1 - 1; s += 2.2 + rnd() * 2.5) {
          spots.push([sx * (Math.abs(sx > 0 ? isl.x1 : isl.x0) + 1.6 + rnd() * 1.1), s]);
        }
      }
    }
    // floating islets in the chasm
    const islets = [];
    for (let i = 0; i < 6; i++) {
      const sx = rnd() < 0.5 ? -1 : 1;
      islets.push([sx * (25 + rnd() * 12), 5 + rnd() * 70, 2 + rnd() * 2.5]);
    }
    const sideMat = std(Z.side, 0.85), topMat = std(Z.ground2, 0.9);
    for (const [x, s, r] of islets) {
      const g = new THREE.CylinderGeometry(r, r * 0.35, r * 1.6, 8, 1);
      const m = new THREE.Mesh(g, [sideMat, topMat, sideMat]);
      m.position.set(x, -1 - rnd() * 2, zw(k, s)); m.receiveShadow = true;
      group.add(m);
      spots.push([x, s, m.position.y + r * 0.8]);
    }
    const mk = this.decorMaker(Z.decor, rnd);
    for (const sp of spots) {
      if (rnd() < 0.25) continue;
      const o = mk();
      o.position.set(sp[0], sp[2] ?? 0, zw(k, sp[1]));
      o.rotation.y = rnd() * 6.28;
      o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      group.add(o);
    }
  }

  decorMaker(type, rnd) {
    const M = this.decorMats || (this.decorMats = {
      rock: std(0x8a6a4e, 0.9, 0, { flatShading: true }), cone: std(0xff6a1a, 0.5), white: std(0xffffff, 0.5),
      barrel: std(0x3f7fd9, 0.5, 0.2), dark: std(0x2a2026, 0.9, 0, { flatShading: true }),
      glow: std(0xff7a1a, 0.5, 0, { emissive: 0xff5a00, emissiveIntensity: 1.6 }),
      ice: std(0xbfe8ff, 0.1, 0.1, { flatShading: true, transparent: true, opacity: 0.85 }), snow: std(0xffffff, 0.8),
      trunk: std(0x7a5232, 0.9), leaf: std(0x3fa34d, 0.7, 0, { flatShading: true }), leaf2: std(0x67c25a, 0.7, 0, { flatShading: true }),
      stone: std(0xa8a68f, 0.9, 0, { flatShading: true }), moss: std(0x5c8a3a, 0.9),
      gold: std(0xffc23a, 0.22, 1), chest: std(0x8a4a22, 0.6), purple: std(0x7a4aa8, 0.5),
    });
    const G = (geo, mat, x = 0, y = 0, z = 0, s = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.setScalar(s); return m; };
    return () => {
      const o = new THREE.Group();
      const r = rnd();
      if (type === 'quarry') {
        if (r < 0.5) { const s = 0.6 + rnd() * 0.9; o.add(G(new THREE.DodecahedronGeometry(1, 0), M.rock, 0, s * 0.5, 0, s)); }
        else if (r < 0.75) { o.add(G(new THREE.ConeGeometry(0.3, 0.8, 12), M.cone, 0, 0.4, 0)); o.add(G(new THREE.CylinderGeometry(0.2, 0.24, 0.12, 12), M.white, 0, 0.45, 0)); o.add(G(new THREE.BoxGeometry(0.7, 0.06, 0.7), M.cone, 0, 0.03, 0)); }
        else { o.add(G(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 14), M.barrel, 0, 0.45, 0)); const ring = G(new THREE.TorusGeometry(0.35, 0.04, 6, 16), M.white, 0, 0.7, 0); ring.rotation.x = Math.PI / 2; o.add(ring); }
      } else if (type === 'lava') {
        if (r < 0.6) { const h = 1.2 + rnd() * 2.2; o.add(G(new THREE.ConeGeometry(0.6 + rnd() * 0.4, h, 6), M.dark, 0, h / 2, 0)); o.add(G(new THREE.SphereGeometry(0.15, 8, 6), M.glow, 0.25, h * 0.3, 0.3)); }
        else { const s = 0.5 + rnd() * 0.6; o.add(G(new THREE.DodecahedronGeometry(1, 0), M.dark, 0, s * 0.4, 0, s)); o.add(G(new THREE.SphereGeometry(0.12, 8, 6), M.glow, 0, s * 0.9, s * 0.5)); }
      } else if (type === 'ice') {
        if (r < 0.6) { for (let i = 0; i < 3; i++) { const h = 0.8 + rnd() * 1.8; const m = G(new THREE.OctahedronGeometry(0.4, 0), M.ice, (rnd() - 0.5) * 0.8, h * 0.45, (rnd() - 0.5) * 0.8); m.scale.set(1, h * 1.4, 1); m.rotation.z = (rnd() - 0.5) * 0.5; o.add(m); } }
        else { o.add(G(new THREE.SphereGeometry(0.5, 14, 10), M.snow, 0, 0.4, 0)); o.add(G(new THREE.SphereGeometry(0.35, 14, 10), M.snow, 0.5, 0.25, 0.2)); }
      } else if (type === 'jungle') {
        if (r < 0.6) {
          const h = 1.5 + rnd() * 1.5;
          o.add(G(new THREE.CylinderGeometry(0.15, 0.22, h, 8), M.trunk, 0, h / 2, 0));
          o.add(G(new THREE.IcosahedronGeometry(1, 0), M.leaf, 0, h + 0.3, 0, 0.9 + rnd() * 0.4));
          o.add(G(new THREE.IcosahedronGeometry(1, 0), M.leaf2, 0.4, h - 0.1, 0.3, 0.6));
        } else {
          const h = 1 + rnd() * 1.8;
          o.add(G(new THREE.BoxGeometry(0.8, h, 0.8), M.stone, 0, h / 2, 0));
          o.add(G(new THREE.BoxGeometry(1.0, 0.25, 1.0), M.stone, 0, h + 0.12, 0));
          o.add(G(new THREE.SphereGeometry(0.3, 8, 6), M.moss, 0.3, h + 0.2, 0.2));
        }
      } else {
        if (r < 0.45) { const h = 2 + rnd() * 1.5; o.add(G(new THREE.CylinderGeometry(0.35, 0.4, h, 14), M.purple, 0, h / 2, 0)); o.add(G(new THREE.BoxGeometry(1, 0.25, 1), M.gold, 0, h + 0.12, 0)); o.add(G(new THREE.BoxGeometry(1, 0.25, 1), M.gold, 0, 0.12, 0)); }
        else if (r < 0.75) { o.add(G(new THREE.BoxGeometry(1.1, 0.6, 0.7), M.chest, 0, 0.3, 0)); const lid = G(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 12, 1, false, 0, Math.PI), M.chest, 0, 0.6, 0); lid.rotation.z = Math.PI / 2; o.add(lid); o.add(G(new THREE.BoxGeometry(1.14, 0.1, 0.74), M.gold, 0, 0.55, 0)); }
        else { for (let i = 0; i < 4; i++) o.add(G(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 16), M.gold, (rnd() - 0.5) * 0.4, 0.06 + i * 0.12, (rnd() - 0.5) * 0.4)); }
      }
      return o;
    };
  }

  buildStatue(zone) {
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, roughness: 0.18, metalness: 1 });
    const mats = { fur: gold, white: gold, pink: gold, black: std(0x2a1a08, 0.2, 0.6), stripe: gold };
    const g = new THREE.Group();
    const cat = buildCat(mats);
    cat.scale.setScalar(3.6);
    cat.position.y = 1.4;
    g.add(cat);
    const ped = new THREE.Mesh(new RoundedBoxGeometry(4.6, 1.4, 4.2, 3, 0.25), std(0x4a2566, 0.5, 0.2));
    ped.position.y = 0.7; g.add(ped);
    const trim = new THREE.Mesh(new RoundedBoxGeometry(4.8, 0.25, 4.4, 2, 0.1), gold);
    trim.position.y = 1.35; g.add(trim);
    g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    g.position.set(4.6, 0, zw(4, 77.2));
    zone.group.add(g);
    this.statue = g;
  }

  // ---- dynamic: walls, bridges, conveyors ----
  rebuild(state) {
    const walls = [];
    const L = LAYOUT, T = 1;
    const bw = BRIDGE_W[state.levels.bridge];
    const add = (k, x0, x1, s0, s1, mask = MASK_ALL, vis = 'rim') => {
      if (x1 - x0 < 0.01 || s1 - s0 < 0.01) return;
      walls.push({ x0, x1, z0: zw(k, s1), z1: zw(k, s0), mask, vis, k });
    };
    const edge = (k, x0, x1, s0, s1, openings, vis) => {
      let x = x0;
      for (const [a, b] of openings.sort((p, q) => p[0] - q[0])) { add(k, x, a, s0, s1, MASK_ALL, vis); x = b; }
      add(k, x, x1, s0, s1, MASK_ALL, vis);
    };
    for (let k = 0; k < ZONES.length; k++) {
      const conv = state.conveyors[k];
      // field island
      const F = L.F;
      add(k, F.x0 - T, F.x0, F.s0 - T, F.s1 + T);
      add(k, F.x1, F.x1 + T, F.s0 - T, F.s1 + T);
      edge(k, F.x0, F.x1, F.s0 - T, F.s0, k > 0 && state.unlocked >= k ? [[-L.nz.w / 2, L.nz.w / 2]] : []);
      const nOpen = [[-bw / 2, bw / 2]];
      if (conv) nOpen.push([L.belt.x0, L.belt.x1]);
      edge(k, F.x0, F.x1, F.s1, F.s1 + T, nOpen);
      // internal bridge rails
      add(k, -bw / 2 - 0.5, -bw / 2, L.bridge.s0, L.bridge.s1, MASK_ALL, 'rail');
      add(k, bw / 2, bw / 2 + 0.5, L.bridge.s0, L.bridge.s1, MASK_ALL, 'rail');
      // pad island
      const P = L.P;
      add(k, P.x0 - T, P.x0, P.s0 - T, P.s1 + T);
      add(k, P.x1, P.x1 + T, P.s0 - T, P.s1 + T);
      const sOpen = [[-bw / 2, bw / 2]];
      if (conv) sOpen.push([L.belt.x0, L.belt.x1]);
      edge(k, P.x0, P.x1, P.s0 - T, P.s0, sOpen);
      const nzBuilt = state.unlocked > k;
      edge(k, P.x0, P.x1, P.s1, P.s1 + T, nzBuilt ? [[-L.nz.w / 2, L.nz.w / 2]] : []);
      if (nzBuilt) {
        add(k, -L.nz.w / 2 - 0.5, -L.nz.w / 2, L.nz.s0, L.nz.s1, MASK_ALL, 'rail');
        add(k, L.nz.w / 2, L.nz.w / 2 + 0.5, L.nz.s0, L.nz.s1, MASK_ALL, 'rail');
      }
      // crusher: pillars solid; roller band solid for coins & dozer (gems get crushed)
      const C = L.crusher;
      add(k, C.x0 - C.pillarW, C.x0, C.s0 - 0.4, C.s1 + 0.4, MASK_ALL, 'none');
      add(k, C.x1, C.x1 + C.pillarW, C.s0 - 0.4, C.s1 + 0.4, MASK_ALL, 'none');
      add(k, C.x0, C.x1, C.s0, C.s1, MASK_COIN | MASK_DOZER, 'none');
      // conveyor lane
      if (conv) {
        const B = L.belt;
        add(k, B.x0 - 0.4, B.x0, B.s0 - 0.4, B.s1, MASK_ALL, 'metal');
        add(k, B.x1, B.x1 + 0.4, B.s0 - 0.4, B.s1, MASK_ALL, 'metal');
        add(k, B.x0, B.x1, B.s0 - 0.4, B.s0, MASK_ALL, 'metal');
      }
    }
    this.walls = walls;
    this.buildWallMeshes(walls);
    this.buildBridges(state);
    this.buildConveyors(state);
    return walls;
  }

  buildWallMeshes(walls) {
    if (this.wallMeshes) { this.scene.remove(this.wallMeshes); this.wallMeshes.dispose(); }
    const vis = walls.filter(w => w.vis !== 'none');
    const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.18);
    const im = new THREE.InstancedMesh(geo, std(0xffffff, 0.6, 0.05), vis.length);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    vis.forEach((w, i) => {
      const h = w.vis === 'rail' ? 0.75 : w.vis === 'metal' ? 0.6 : 0.55;
      m.makeScale(w.x1 - w.x0, h, w.z1 - w.z0);
      m.setPosition((w.x0 + w.x1) / 2, h / 2, (w.z0 + w.z1) / 2);
      im.setMatrixAt(i, m);
      c.set(w.vis === 'rail' ? 0xa86a35 : w.vis === 'metal' ? 0x8c96a3 : ZONES[w.k].rim);
      im.setColorAt(i, c);
    });
    im.castShadow = true; im.receiveShadow = true;
    this.scene.add(im);
    this.wallMeshes = im;
  }

  buildBridges(state) {
    for (const b of this.bridges) { this.scene.remove(b); }
    this.bridges = [];
    const L = LAYOUT, bw = BRIDGE_W[state.levels.bridge];
    const plank = new THREE.BoxGeometry(1, 0.28, 0.72);
    const mk = (k, s0, s1, w, animate) => {
      const g = new THREE.Group();
      const n = Math.round((s1 - s0 + 2) / 0.8);
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(plank, i % 2 ? this.woodMat : this.woodDark);
        p.scale.x = w + 0.9;
        const s = s0 - 1 + (i + 0.5) * ((s1 - s0 + 2) / n);
        p.position.set(0, -0.14, zw(k, s));
        p.rotation.y = (Math.sin(i * 12.9) * 0.03);
        p.receiveShadow = true; p.castShadow = true;
        if (animate) { p.userData.target = -0.14; p.userData.delay = i * 0.06; p.position.y = 14; p.userData.t = 0; }
        g.add(p);
      }
      for (const sx of [-1, 1]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, s1 - s0 + 2), this.woodDark);
        beam.position.set(sx * (w / 2 + 0.1), -0.55, zw(k, (s0 + s1) / 2));
        g.add(beam);
        if (animate) { beam.userData.target = -0.55; beam.userData.delay = 0; beam.position.y = -20; beam.userData.t = 0; }
      }
      g.userData.animate = animate;
      this.scene.add(g); this.bridges.push(g);
      return g;
    };
    for (let k = 0; k < ZONES.length; k++) {
      mk(k, L.bridge.s0, L.bridge.s1, bw, false);
      if (state.unlocked > k) mk(k, L.nz.s0, L.nz.s1, L.nz.w, state.justBuilt === k);
    }
    state.justBuilt = -1;
  }

  buildConveyors(state) {
    for (const c of this.conveyors) this.scene.remove(c);
    this.conveyors = [];
    const B = LAYOUT.belt;
    const beltMat = new THREE.MeshStandardMaterial({ map: this.beltTex, roughness: 0.8 });
    for (let k = 0; k < ZONES.length; k++) {
      if (!state.conveyors[k]) continue;
      const g = new THREE.Group();
      const len = B.s1 - B.s0;
      const belt = new THREE.Mesh(new THREE.BoxGeometry(B.x1 - B.x0, 0.12, len), beltMat);
      belt.position.set((B.x0 + B.x1) / 2, 0.02, zw(k, (B.s0 + B.s1) / 2));
      belt.receiveShadow = true;
      this.beltTex.repeat.set(1, len / 2);
      g.add(belt);
      const under = new THREE.Mesh(new THREE.BoxGeometry(B.x1 - B.x0 + 0.9, 0.5, len), this.metalMat);
      under.position.set((B.x0 + B.x1) / 2, -0.3, zw(k, (B.s0 + B.s1) / 2));
      g.add(under);
      for (const s of [46, 52]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 8), this.metalMat);
        leg.position.set((B.x0 + B.x1) / 2, -4.8, zw(k, s)); g.add(leg);
      }
      // hopper next to crusher
      const hop = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.8, 1.1, 4, 1, true), this.metalMat);
      hop.rotation.y = Math.PI / 4; hop.position.set((B.x0 + B.x1) / 2, 1.0, zw(k, B.s0 + 0.6));
      hop.material.side = THREE.DoubleSide;
      g.add(hop);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 5.2, 10), std(ZONES[k].pillar, 0.4, 0.2));
      pipe.rotation.z = Math.PI / 2; pipe.position.set(7.4, 2.6, zw(k, 29)); g.add(pipe);
      g.traverse(c => { if (c.isMesh) c.castShadow = true; });
      this.scene.add(g); this.conveyors.push(g);
    }
  }

  update(dt) {
    this.time += dt;
    for (const r of this.rollers) r.rotation.y += r.userData.dir * dt * 4;
    if (this.lavaTex) { this.lavaTex.offset.x += dt * 0.01; this.lavaTex.offset.y += dt * 0.006; }
    this.beltTex.offset.y -= dt * 2.4;
    for (const z of this.zones) {
      if (z.labelPop > 0) { z.labelPop = Math.max(0, z.labelPop - dt * 2); z.crusherLabel.scale.setScalar(1 + Math.sin(z.labelPop * Math.PI) * 0.4); }
    }
    for (const b of this.bridges) {
      if (!b.userData.animate) continue;
      let done = true;
      for (const p of b.children) {
        if (p.userData.target === undefined) continue;
        p.userData.t += dt;
        const t = Math.max(0, p.userData.t - p.userData.delay);
        if (t < 0.45) {
          done = false;
          const u = t / 0.45;
          const start = p.userData.target > -0.3 ? 14 : -20;
          // ease out back
          const e = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);
          p.position.y = start + (p.userData.target - start) * e;
        } else p.position.y = p.userData.target;
      }
      if (done) b.userData.animate = false;
    }
    if (this.statue) this.statue.rotation.y = Math.sin(this.time * 0.6) * 0.12;
  }
}
