// Fully procedural audio: SFX + a light looping tune.

const PENTA = [0, 2, 4, 7, 9];

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.lastClack = 0; this.chimes = 0; this.chimeT = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.22; this.music.connect(this.master);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // engine
    this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 48;
    this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 24;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    this.engOsc.connect(lp); this.engOsc2.connect(g2); g2.connect(lp); lp.connect(this.engGain); this.engGain.connect(this.sfx);
    this.engOsc.start(); this.engOsc2.start();

    // crusher grind
    const ns = ctx.createBufferSource(); ns.buffer = this.noise; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1.4;
    this.grindGain = ctx.createGain(); this.grindGain.gain.value = 0;
    ns.connect(bp); bp.connect(this.grindGain); this.grindGain.connect(this.sfx); ns.start();
    this.grindLevel = 0;

    this.startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  get ok() { return this.ctx && this.ctx.state === 'running' && !this.muted; }

  blip(freq, dur, type = 'sine', vol = 0.1, when = 0, slide = 0) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noiseHit(freq, dur, vol, when = 0, q = 3) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.02);
  }

  // marble clatter: density-driven, called every frame with contact count
  clatter(contacts, dt, zone) {
    if (!this.ok || contacts <= 0) return;
    const rate = Math.min(28, contacts * 0.35);
    let n = rate * dt + (Math.random() < (rate * dt) % 1 ? 1 : 0);
    n = Math.floor(n);
    const base = [3600, 2600, 3000, 2200, 1500][zone] || 3000;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * dt;
      this.blip(base * (0.75 + Math.random() * 0.6), 0.035 + Math.random() * 0.03, 'sine', 0.025 + Math.random() * 0.02, w);
      if (Math.random() < 0.4) this.noiseHit(base * 1.4, 0.025, 0.04, w, 6);
    }
  }

  crush() { this.grindLevel = Math.min(1, this.grindLevel + 0.12); if (this.ok && Math.random() < 0.3) this.noiseHit(300 + Math.random() * 300, 0.08, 0.12, 0, 1.5); }

  chime() {
    if (!this.ok) return;
    const now = this.ctx.currentTime;
    if (now - this.chimeT < 0.035) return;
    this.chimeT = now;
    const note = PENTA[(Math.random() * 5) | 0] + 12 * (2 + ((Math.random() * 2) | 0));
    const f = 261.6 * Math.pow(2, note / 12);
    this.blip(f, 0.25, 'sine', 0.05); this.blip(f * 2.01, 0.12, 'sine', 0.02);
  }

  coinSpill() { if (this.ok && Math.random() < 0.5) this.chime(); }

  kaching() {
    if (!this.ok) return;
    this.noiseHit(6000, 0.12, 0.15, 0, 1);
    [1046, 1318, 1568, 2093].forEach((f, i) => this.blip(f, 0.3, 'triangle', 0.12, i * 0.06));
    this.blip(2637, 0.6, 'sine', 0.08, 0.24);
  }

  build() {
    if (!this.ok) return;
    for (let i = 0; i < 12; i++) this.noiseHit(180 + i * 25, 0.09, 0.18, i * 0.07, 2);
    [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.35, 'triangle', 0.1, 0.85 + i * 0.09));
  }

  fanfare() {
    if (!this.ok) return;
    const seq = [523, 659, 784, 1046, 784, 1046, 1318, 1568];
    seq.forEach((f, i) => { this.blip(f, 0.45, 'square', 0.05, i * 0.13); this.blip(f / 2, 0.45, 'triangle', 0.08, i * 0.13); });
    for (let i = 0; i < 20; i++) setTimeout(() => this.chime(), 1100 + i * 60);
  }

  update(dt, speed01, moving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engOsc.frequency.setTargetAtTime(44 + speed01 * 46, t, 0.1);
    this.engOsc2.frequency.setTargetAtTime(22 + speed01 * 23, t, 0.1);
    this.engGain.gain.setTargetAtTime(moving ? 0.05 + speed01 * 0.06 : 0.025, t, 0.15);
    this.grindLevel = Math.max(0, this.grindLevel - dt * 1.6);
    this.grindGain.gain.setTargetAtTime(this.grindLevel * 0.35, t, 0.05);
  }

  startMusic() {
    const ctx = this.ctx;
    const bpm = 104, step = 60 / bpm / 2; // eighth notes
    const chords = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]]; // C Am F G
    const roots = [0, -3, -7, -5];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const melody = [];
    for (let b = 0; b < 4; b++) {
      const bar = [];
      for (let s = 0; s < 8; s++) bar.push(rnd() < 0.55 ? PENTA[(rnd() * 5) | 0] + (rnd() < 0.3 ? 12 : 0) : null);
      melody.push(bar);
    }
    let idx = 0, next = ctx.currentTime + 0.1;
    const note = (semi) => 261.63 * Math.pow(2, semi / 12);
    const play = (f, t, dur, type, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.05);
    };
    const tick = () => {
      while (next < ctx.currentTime + 0.25) {
        const bar = Math.floor(idx / 8) % 4, s = idx % 8;
        if (!this.muted) {
          if (s === 0 || s === 4) play(note(roots[bar] - 24), next, step * 3, 'triangle', 0.5);
          if (s === 2 || s === 6) chords[bar].forEach(c => play(note(c), next, step * 1.2, 'triangle', 0.09));
          const m = melody[(bar + Math.floor(idx / 32)) % 4][s];
          if (m !== null && Math.floor(idx / 32) % 2 === 1) play(note(m + 12), next, step * 1.6, 'sine', 0.16);
          if (s % 2 === 1) {
            const src = ctx.createBufferSource(); src.buffer = this.noise;
            const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
            const g = ctx.createGain(); g.gain.setValueAtTime(0.06, next); g.gain.exponentialRampToValueAtTime(0.0001, next + 0.04);
            src.connect(f); f.connect(g); g.connect(this.music); src.start(next, rnd() * 0.5); src.stop(next + 0.05);
          }
        }
        next += step; idx++;
      }
    };
    setInterval(tick, 60);
  }
}
