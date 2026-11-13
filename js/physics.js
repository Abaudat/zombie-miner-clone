// Custom sphere solver (position based) with spatial hash, sleeping, static AABB walls,
// kinematic oriented boxes (bulldozer), kill zones (crushers) and belts (conveyors).

export const GEM = 0, COIN = 1;

export class Physics {
  constructor(cap) {
    this.cap = cap;
    const F = Float32Array;
    this.px = new F(cap); this.py = new F(cap); this.pz = new F(cap);
    this.ox = new F(cap); this.oy = new F(cap); this.oz = new F(cap);
    this.vx = new F(cap); this.vy = new F(cap); this.vz = new F(cap);
    this.r = new F(cap); this.still = new F(cap);
    this.alive = new Uint8Array(cap); this.awake = new Uint8Array(cap);
    this.dirty = new Uint8Array(cap);
    this.kind = new Uint8Array(cap); this.zone = new Uint8Array(cap);
    this.value = new Float64Array(cap);
    this.meshId = new Int16Array(cap); this.inst = new Int32Array(cap);
    this.free = [];
    for (let i = cap - 1; i >= 0; i--) this.free.push(i);
    this.maxIndex = 0;
    this.count = [0, 0];

    this.cell = 1.05;
    let ts = 1; while (ts < cap * 2) ts <<= 1;
    this.tableSize = ts;
    this.cellStart = new Int32Array(ts + 1);
    this.cellEntries = new Int32Array(cap);

    this.walls = [];
    this.wallGrid = new Map();
    this.kin = [];          // kinematic OBBs
    this.killZones = [];
    this.belts = [];
    this.crushed = [];      // events
    this.kinContacts = 0;
    this.gravity = -24;
    this.friction = 9;
    this.contactFriction = 0.18;
    this.onRemove = null;
  }

  hash(ix, iz) {
    return ((Math.imul(ix, 92837111) ^ Math.imul(iz, 689287499)) >>> 0) & (this.tableSize - 1);
  }

  add(kind, x, y, z, r, zone, value, meshId, inst, awake = true) {
    if (!this.free.length) return -1;
    const i = this.free.pop();
    this.px[i] = this.ox[i] = x; this.py[i] = this.oy[i] = y; this.pz[i] = this.oz[i] = z;
    this.vx[i] = this.vy[i] = this.vz[i] = 0;
    this.r[i] = r; this.kind[i] = kind; this.zone[i] = zone; this.value[i] = value;
    this.meshId[i] = meshId; this.inst[i] = inst;
    this.alive[i] = 1; this.awake[i] = awake ? 1 : 0; this.still[i] = 0; this.dirty[i] = 1;
    if (i + 1 > this.maxIndex) this.maxIndex = i + 1;
    this.count[kind]++;
    return i;
  }

  remove(i) {
    if (!this.alive[i]) return;
    this.alive[i] = 0; this.awake[i] = 0;
    this.count[this.kind[i]]--;
    this.free.push(i);
    if (this.onRemove) this.onRemove(i);
  }

  wake(i) {
    if (this.awake[i]) return;
    this.awake[i] = 1; this.still[i] = 0;
    this.ox[i] = this.px[i]; this.oy[i] = this.py[i]; this.oz[i] = this.pz[i];
    this.vx[i] = this.vy[i] = this.vz[i] = 0;
  }

  setWalls(walls) {
    this.walls = walls;
    const g = new Map();
    const C = 8;
    walls.forEach((w, idx) => {
      const a = Math.floor((w.x0 - 1) / C), b = Math.floor((w.x1 + 1) / C);
      const c = Math.floor((w.z0 - 1) / C), d = Math.floor((w.z1 + 1) / C);
      for (let ix = a; ix <= b; ix++) for (let iz = c; iz <= d; iz++) {
        const key = ix * 100003 + iz;
        let arr = g.get(key); if (!arr) g.set(key, arr = []);
        arr.push(idx);
      }
    });
    this.wallGrid = g;
  }

  wallsAt(x, z) {
    return this.wallGrid.get(Math.floor(x / 8) * 100003 + Math.floor(z / 8));
  }

  // circle vs walls for the bulldozer
  collideCircle(x, z, rad, mask) {
    for (let pass = 0; pass < 2; pass++) {
      const list = this.wallsAt(x, z);
      if (!list) break;
      for (const wi of list) {
        const w = this.walls[wi];
        if (!(w.mask & mask)) continue;
        const qx = Math.min(Math.max(x, w.x0), w.x1), qz = Math.min(Math.max(z, w.z0), w.z1);
        let dx = x - qx, dz = z - qz; const d2 = dx * dx + dz * dz;
        if (d2 >= rad * rad) continue;
        if (d2 > 1e-9) { const d = Math.sqrt(d2); x = qx + dx / d * rad; z = qz + dz / d * rad; }
        else {
          const l = x - w.x0, rr = w.x1 - x, t = z - w.z0, b = w.z1 - z, m = Math.min(l, rr, t, b);
          if (m === l) x = w.x0 - rad; else if (m === rr) x = w.x1 + rad; else if (m === t) z = w.z0 - rad; else z = w.z1 + rad;
        }
      }
    }
    return [x, z];
  }

  buildHash() {
    const { cellStart, cellEntries, px, pz, alive } = this;
    const inv = 1 / this.cell, n = this.maxIndex;
    cellStart.fill(0);
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      cellStart[this.hash(Math.floor(px[i] * inv), Math.floor(pz[i] * inv))]++;
    }
    let s = 0;
    for (let h = 0; h < this.tableSize; h++) { s += cellStart[h]; cellStart[h] = s; }
    cellStart[this.tableSize] = s;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      const h = this.hash(Math.floor(px[i] * inv), Math.floor(pz[i] * inv));
      cellStart[h]--; cellEntries[cellStart[h]] = i;
    }
  }

  step(dt) {
    const { px, py, pz, ox, oy, oz, vx, vy, vz, alive, awake, r, kind } = this;
    const n = this.maxIndex;

    // belts
    for (const b of this.belts) {
      for (let i = 0; i < n; i++) {
        if (!alive[i] || kind[i] !== 1) continue;
        if (px[i] < b.x0 || px[i] > b.x1 || pz[i] < b.z0 || pz[i] > b.z1) continue;
        this.wake(i);
        const k = Math.min(1, dt * 10);
        vx[i] += (b.dx * b.speed - vx[i]) * k;
        vz[i] += (b.dz * b.speed - vz[i]) * k;
      }
    }

    // integrate
    const g = this.gravity * dt;
    for (let i = 0; i < n; i++) {
      if (!alive[i] || !awake[i]) continue;
      vy[i] += g;
      ox[i] = px[i]; oy[i] = py[i]; oz[i] = pz[i];
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
    }

    this.buildHash();
    this.kinContacts = 0;
    for (let it = 0; it < 2; it++) {
      this.solveContacts();
      this.solveKinematics(it === 0);
      this.solveStatic();
    }

    // kill zones (crushers)
    for (let i = 0; i < n; i++) {
      if (!alive[i] || !awake[i] || kind[i] !== 0) continue;
      const x = px[i], z = pz[i];
      for (const kz of this.killZones) {
        if (x > kz.x0 && x < kz.x1 && z > kz.z0 && z < kz.z1) {
          this.crushed.push({ x, y: py[i], z, zone: this.zone[i], value: this.value[i], k: kz.k });
          this.remove(i);
          break;
        }
      }
    }

    // velocities & sleep
    const idt = 1 / dt, fr = Math.max(0, 1 - this.friction * dt);
    for (let i = 0; i < n; i++) {
      if (!alive[i] || !awake[i]) continue;
      this.dirty[i] = 1;
      let x = (px[i] - ox[i]) * idt, y = (py[i] - oy[i]) * idt, z = (pz[i] - oz[i]) * idt;
      if (py[i] <= r[i] + 0.03) { x *= fr; z *= fr; }
      x *= 0.998; z *= 0.998;
      const s2 = x * x + y * y + z * z;
      if (kind[i] === 0 && y > 4.5) y = 4.5; // gems shoved by the blade must not launch over the dozer
      const vmax = kind[i] === 1 ? 9 : 12;
      if (s2 > vmax * vmax) { const k = vmax / Math.sqrt(s2); x *= k; y *= k; z *= k; }
      vx[i] = x; vy[i] = y; vz[i] = z;
      if (s2 < 0.03) {
        this.still[i] += dt;
        if (this.still[i] > 0.45) { awake[i] = 0; vx[i] = vy[i] = vz[i] = 0; }
      } else this.still[i] = 0;
    }
  }

  solveContacts() {
    const { px, py, pz, ox, oy, oz, alive, awake, r, cellStart, cellEntries } = this;
    const inv = 1 / this.cell, n = this.maxIndex;
    for (let i = 0; i < n; i++) {
      if (!alive[i] || !awake[i]) continue;
      const ri = r[i];
      const cx = Math.floor(px[i] * inv), cz = Math.floor(pz[i] * inv);
      for (let ax = cx - 1; ax <= cx + 1; ax++) for (let az = cz - 1; az <= cz + 1; az++) {
        const h = this.hash(ax, az);
        const e = cellStart[h + 1];
        for (let k = cellStart[h]; k < e; k++) {
          const j = cellEntries[k];
          if (j === i) continue;
          const jAwake = awake[j];
          if (jAwake && j < i) continue;
          const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
          const rr = ri + r[j];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= rr * rr) {
            if (!jAwake && py[j] > r[j] + 0.05 && d2 < (rr + 0.08) * (rr + 0.08)) this.wake(j);
            continue;
          }
          const d = Math.sqrt(d2) || 1e-5;
          const pen = rr - d, nx = dx / d, ny = dy / d, nz = dz / d;
          // relative displacement this step, tangential part -> friction
          let rx = (px[i] - ox[i]), ry = (py[i] - oy[i]), rz = (pz[i] - oz[i]);
          if (jAwake) { rx -= px[j] - ox[j]; ry -= py[j] - oy[j]; rz -= pz[j] - oz[j]; }
          const rn = rx * nx + ry * ny + rz * nz;
          const f = this.contactFriction;
          const tx = (rx - rn * nx) * f, ty = (ry - rn * ny) * f, tz = (rz - rn * nz) * f;
          if (jAwake || pen > 0.035) {
            if (!jAwake) this.wake(j);
            const c = pen * 0.5;
            px[i] -= nx * c + tx * 0.5; py[i] -= ny * c + ty * 0.5; pz[i] -= nz * c + tz * 0.5;
            px[j] += nx * c + tx * 0.5; py[j] += ny * c + ty * 0.5; pz[j] += nz * c + tz * 0.5;
          } else {
            px[i] -= nx * pen + tx; py[i] -= ny * pen + ty; pz[i] -= nz * pen + tz;
          }
        }
      }
    }
  }

  solveKinematics(count) {
    const { px, py, pz, alive, r, cellStart, cellEntries } = this;
    const inv = 1 / this.cell;
    for (const b of this.kin) {
      const Rx = Math.cos(b.a), Rz = -Math.sin(b.a), Fx = Math.sin(b.a), Fz = Math.cos(b.a);
      const br = Math.hypot(b.hx, b.hz) + 0.6;
      const c0 = Math.floor((b.x - br) * inv), c1 = Math.floor((b.x + br) * inv);
      const d0 = Math.floor((b.z - br) * inv), d1 = Math.floor((b.z + br) * inv);
      for (let ax = c0; ax <= c1; ax++) for (let az = d0; az <= d1; az++) {
        const h = this.hash(ax, az);
        const e = cellStart[h + 1];
        for (let k = cellStart[h]; k < e; k++) {
          const j = cellEntries[k];
          if (!alive[j]) continue;
          const rad = r[j];
          const wx = px[j] - b.x, wz = pz[j] - b.z;
          let lx = wx * Rx + wz * Rz, lz = wx * Fx + wz * Fz, y = py[j];
          if (Math.abs(lx) > b.hx + rad || Math.abs(lz) > b.hz + rad || y > b.h + rad) continue;
          const qx = Math.max(-b.hx, Math.min(b.hx, lx));
          const qz = Math.max(-b.hz, Math.min(b.hz, lz));
          const qy = Math.max(0, Math.min(b.h, y));
          const dx = lx - qx, dy = y - qy, dz = lz - qz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= rad * rad) continue;
          this.wake(j);
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2), p = (rad - d) / d;
            lx += dx * p; y += dy * p; lz += dz * p;
          } else {
            const ex = b.hx - Math.abs(lx), ez = b.hz - Math.abs(lz), ey = b.h - y;
            if (ey < ex && ey < ez) y = b.h + rad;
            else if (ex < ez) lx = Math.sign(lx || 1) * (b.hx + rad);
            else lz = Math.sign(lz || 1) * (b.hz + rad);
          }
          px[j] = b.x + lx * Rx + lz * Fx;
          pz[j] = b.z + lx * Rz + lz * Fz;
          py[j] = y;
          if (b.dx !== undefined) { // grip: carried along with the blade
            px[j] += (b.dx - (px[j] - this.ox[j])) * 0.3;
            pz[j] += (b.dz - (pz[j] - this.oz[j])) * 0.3;
          }
          if (count && b.pusher) this.kinContacts++;
        }
      }
    }
  }

  solveStatic() {
    const { px, py, pz, alive, awake, r, kind, walls } = this;
    const n = this.maxIndex;
    for (let i = 0; i < n; i++) {
      if (!alive[i] || !awake[i]) continue;
      const rad = r[i];
      if (py[i] < rad) py[i] = rad;
      const list = this.wallsAt(px[i], pz[i]);
      if (!list) continue;
      const bit = 1 << kind[i];
      for (let q = 0; q < list.length; q++) {
        const w = walls[list[q]];
        if (!(w.mask & bit)) continue;
        const x = px[i], z = pz[i];
        if (x < w.x0 - rad || x > w.x1 + rad || z < w.z0 - rad || z > w.z1 + rad) continue;
        const qx = Math.min(Math.max(x, w.x0), w.x1), qz = Math.min(Math.max(z, w.z0), w.z1);
        const dx = x - qx, dz = z - qz, d2 = dx * dx + dz * dz;
        if (d2 >= rad * rad) continue;
        if (d2 > 1e-9) { const d = Math.sqrt(d2); px[i] = qx + dx / d * rad; pz[i] = qz + dz / d * rad; }
        else {
          const l = x - w.x0, rr = w.x1 - x, t = z - w.z0, b = w.z1 - z, m = Math.min(l, rr, t, b);
          if (m === l) px[i] = w.x0 - rad; else if (m === rr) px[i] = w.x1 + rad;
          else if (m === t) pz[i] = w.z0 - rad; else pz[i] = w.z1 + rad;
        }
      }
    }
  }
}
