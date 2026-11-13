import * as THREE from 'three';
import { fmt, zw } from './config.js';

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function drawIcon(g, type, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.scale(s / 100, s / 100);
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineJoin = 'round'; g.lineCap = 'round';
  switch (type) {
    case 'blade':
      g.beginPath(); g.moveTo(-46, -22); g.quadraticCurveTo(0, -6, 46, -22); g.lineTo(40, 18); g.quadraticCurveTo(0, 30, -40, 18); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-60, 0); g.lineTo(-74, 0); g.moveTo(60, 0); g.lineTo(74, 0); g.stroke();
      g.beginPath(); g.moveTo(-74, -14); g.lineTo(-88, 0); g.lineTo(-74, 14); g.moveTo(74, -14); g.lineTo(88, 0); g.lineTo(74, 14); g.stroke();
      break;
    case 'speed':
      for (const ox of [-30, 10]) { g.beginPath(); g.moveTo(ox - 14, -38); g.lineTo(ox + 22, 0); g.lineTo(ox - 14, 38); g.lineWidth = 16; g.stroke(); }
      break;
    case 'crusher':
      for (const ox of [-24, 24]) {
        g.beginPath();
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 22 : 34; g.lineTo(ox + Math.cos(a) * r, Math.sin(a) * r); }
        g.closePath(); g.fill();
      }
      break;
    case 'bridge':
      g.beginPath(); g.moveTo(-60, 20); g.quadraticCurveTo(0, -36, 60, 20); g.lineWidth = 12; g.stroke();
      for (let i = -2; i <= 2; i++) { g.fillRect(i * 24 - 8, -8 + Math.abs(i) * 7, 16, 34 - Math.abs(i) * 7); }
      break;
    case 'conveyor':
      rr(g, -62, -18, 124, 36, 18); g.lineWidth = 9; g.stroke();
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(i * 38, 0, 9, 0, 7); g.fill(); }
      g.beginPath(); g.moveTo(-20, -40); g.lineTo(20, -40); g.moveTo(8, -50); g.lineTo(20, -40); g.lineTo(8, -30); g.lineWidth = 7; g.stroke();
      break;
    case 'next':
      g.beginPath(); g.moveTo(0, -48); g.lineTo(40, -4); g.lineTo(16, -4); g.lineTo(16, 42); g.lineTo(-16, 42); g.lineTo(-16, -4); g.lineTo(-40, -4); g.closePath(); g.fill();
      break;
    case 'statue':
      g.beginPath(); g.moveTo(-40, 40); g.lineTo(-40, -20); g.lineTo(-30, -52); g.lineTo(-12, -30); g.lineTo(12, -30); g.lineTo(30, -52); g.lineTo(40, -20); g.lineTo(40, 40); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(-16, -6, 6, 0, 7); g.arc(16, -6, 6, 0, 7); g.fill();
      break;
  }
  g.restore();
}

export function drawCoin(g, x, y, r) {
  g.fillStyle = '#ffcf3a'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = '#c98a10'; g.lineWidth = r * 0.22; g.beginPath(); g.arc(x, y, r * 0.7, 0, 7); g.stroke();
}

export class Pad {
  constructor(scene, def, k) {
    this.def = def; this.type = def.type; this.k = k;
    this.x = def.x; this.z = zw(k, def.s); this.half = def.size / 2;
    this.fill = 0; this.pulse = 0; this.visible = true; this.needsDraw = true; this.pop = 0;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = 256;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: this.tex, transparent: true, roughness: 0.7, emissive: 0xffffff, emissiveMap: this.tex, emissiveIntensity: 0.06, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(def.size, def.size), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(this.x, 0.03, this.z);
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  draw(label, cost, lvText) {
    const g = this.canvas.getContext('2d');
    const W = 256;
    g.clearRect(0, 0, W, W);
    rr(g, 8, 8, W - 16, W - 16, 30);
    g.fillStyle = this.def.color; g.globalAlpha = 0.88; g.fill(); g.globalAlpha = 1;
    g.setLineDash([22, 14]); g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,0.95)';
    rr(g, 18, 18, W - 36, W - 36, 22); g.stroke(); g.setLineDash([]);
    drawIcon(g, this.type, W / 2, 62, 50);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    g.lineJoin = 'round'; g.strokeStyle = 'rgba(42,22,64,0.6)'; g.lineWidth = 8;
    let fs = 36; g.font = `${fs}px 'Lilita One', 'Hiragino Sans', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif`;
    while (g.measureText(label).width > 200 && fs > 18) { fs -= 2; g.font = `${fs}px 'Lilita One', 'Hiragino Sans', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif`; }
    g.strokeText(label, W / 2, 118); g.fillText(label, W / 2, 118);
    const remain = fmt(cost - this.fill);
    g.font = `62px 'Lilita One', sans-serif`;
    const tw = g.measureText(remain).width;
    drawCoin(g, W / 2 - tw / 2 - 16, 170, 19);
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(42,22,64,0.6)'; g.lineWidth = 8;
    g.strokeText(remain, W / 2 + 16, 173); g.fillText(remain, W / 2 + 16, 173);
    // fill bar
    rr(g, 34, 208, W - 68, 20, 10); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill();
    const p = Math.min(1, this.fill / cost);
    if (p > 0) { rr(g, 34, 208, Math.max(20, (W - 68) * p), 20, 10); g.fillStyle = '#ffe14a'; g.fill(); }
    if (lvText) {
      g.font = `26px 'Lilita One', sans-serif`;
      const w = g.measureText(lvText).width + 20;
      rr(g, W - 30 - w, 26, w, 34, 17); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
      g.fillStyle = '#fff'; g.fillText(lvText, W - 30 - w / 2, 44);
    }
    this.tex.needsUpdate = true;
  }

  setVisible(v) { this.visible = v; this.mesh.visible = v; }

  contains(x, z) { return this.visible && Math.abs(x - this.x) < this.half - 0.15 && Math.abs(z - this.z) < this.half - 0.15; }

  update(dt) {
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 5);
    if (this.pop > 0) this.pop = Math.max(0, this.pop - dt * 2.5);
    const s = 1 + this.pulse * 0.05 + Math.sin(this.pop * Math.PI) * 0.25;
    this.mesh.scale.set(s, s, 1);
    this.mesh.position.y = 0.03 + Math.sin(this.pop * Math.PI) * 0.4;
  }
}
