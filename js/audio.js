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

  // Song: 8-bar jazzy-pop progression, sections layer pad/bass/drums/arp/lead; echo + reverb buses.
  startMusic() {
    const ctx = this.ctx;
    const bpm = 98, six = 60 / bpm / 4; // sixteenth notes
    const out = this.music;
    // reverb (generated impulse) and tempo-synced echo
    const verb = ctx.createConvolver();
    const il = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, il, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < il; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / il, 3); }
    verb.buffer = ir;
    const verbIn = ctx.createGain(); verbIn.gain.value = 0.35; verbIn.connect(verb); verb.connect(out);
    const echo = ctx.createDelay(1); echo.delayTime.value = six * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const echoLp = ctx.createBiquadFilter(); echoLp.type = 'lowpass'; echoLp.frequency.value = 2400;
    const echoIn = ctx.createGain(); echoIn.gain.value = 0.3;
    echoIn.connect(echo); echo.connect(echoLp); echoLp.connect(fb); fb.connect(echo); echoLp.connect(out); echoLp.connect(verbIn);

    const hz = semi => 261.63 * Math.pow(2, semi / 12);
    // F maj7 | E m7 | D m7 | C maj7 | Bb maj7 | A m7 | G m7 | C7sus  (semitones from middle C)
    const CH = [[5, 9, 12, 16], [4, 7, 11, 14], [2, 5, 9, 12], [0, 4, 7, 11], [-2, 2, 5, 9], [-3, 0, 4, 7], [-5, -2, 2, 5], [0, 5, 7, 10]];
    const ROOT = [5, 4, 2, 0, -2, -3, -5, 0];
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // two composed melody variations, built from chord tones with passing notes
    const mkMel = (density) => CH.map((ch) => {
      const bar = new Array(16).fill(null);
      for (let st = 0; st < 16; st += 2) {
        if (rnd() < density || st === 0) {
          const tone = ch[(rnd() * 4) | 0] + 12 + (rnd() < 0.2 ? 2 : 0);
          bar[st] = { n: tone, d: rnd() < 0.4 ? 4 : 2 };
          if (bar[st].d === 4) st += 2;
        }
      }
      return bar;
    });
    const melA = mkMel(0.45), melB = mkMel(0.65);
    // sections: 0 intro, 1 groove+lead, 2 full+arp, 3 breakdown
    const FORM = [0, 1, 2, 1, 3];

    const env = (node, t, a, peak, dur) => {
      node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a);
      node.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    };
    const tone = (f, t, dur, type, vol, { cutoff = 0, a = 0.008, send = 0, echoSend = 0, detune = 0 } = {}) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f; o.detune.value = detune;
      let n = o;
      if (cutoff) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; o.connect(lp); n = lp; }
      n.connect(g); env(g, t, a, vol, dur);
      g.connect(out);
      if (send) { const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(verbIn); }
      if (echoSend) { const eg = ctx.createGain(); eg.gain.value = echoSend; g.connect(eg); eg.connect(echoIn); }
      o.start(t); o.stop(t + dur + 0.05);
    };
    const noise = (t, dur, vol, type, freq, q = 1, send = 0) => {
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(out);
      if (send) { const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(verbIn); }
      src.start(t, Math.random() * 0.8); src.stop(t + dur + 0.02);
    };
    const kick = t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35);
    };
    const BASS = [[0, 0, 3], [3, 0, 1], [6, 7, 2], [8, 12, 2], [11, 7, 1], [14, 10, 2]]; // [step, interval, len]

    let idx = 0, next = ctx.currentTime + 0.15;
    const tick = () => {
      while (next < ctx.currentTime + 0.3) {
        const st = idx % 16, barN = Math.floor(idx / 16), bar = barN % 8;
        const sec = FORM[Math.floor(barN / 8) % FORM.length];
        const t = next, ch = CH[bar], root = ROOT[bar];
        if (!this.muted) {
          // pad: warm detuned saws, swells each bar
          if (st === 0) for (const c of ch) for (const dt of [-9, 9])
            tone(hz(c), t, six * 16 * 1.05, 'sawtooth', sec === 3 ? 0.032 : 0.022, { cutoff: sec === 2 ? 1500 : 950, a: 0.35, send: 0.6, detune: dt });
          // bass
          if (sec !== 3) for (const [bs, iv, len] of BASS) if (bs === st) {
            tone(hz(root - 24 + iv), t, six * len * 1.1, 'triangle', 0.42, { a: 0.006 });
            tone(hz(root - 24 + iv), t, six * len * 0.9, 'sawtooth', 0.06, { cutoff: 420, a: 0.006 });
          }
          if (sec === 3 && st === 0) tone(hz(root - 24), t, six * 15, 'sine', 0.35, { a: 0.05 });
          // drums
          if (sec >= 1 && sec <= 2) {
            if (st === 0 || st === 8 || (st === 10 && bar % 2 === 1)) kick(t);
            if (st === 4 || st === 12) { noise(t, 0.16, 0.22, 'bandpass', 1900, 0.9, 0.5); noise(t, 0.05, 0.12, 'highpass', 5000); }
          }
          if (sec !== 3 && st % 2 === 0) noise(t, st % 4 === 2 ? 0.05 : 0.025, st % 4 === 2 ? 0.07 : 0.04, 'highpass', 8000);
          if (sec === 2 && st === 14) noise(t, 0.18, 0.05, 'highpass', 7000);
          if (sec === 0 && st === 0) kick(t);
          // arp: plucky chord tones rising through two octaves
          if (sec >= 2) {
            const a = ch[st % 4] + 12 + (st >= 8 ? 12 : 0);
            tone(hz(a), t, six * 1.6, 'square', sec === 3 ? 0.035 : 0.028, { cutoff: 2600, echoSend: 0.9, send: 0.3 });
          }
          // lead melody with echo
          if (sec === 1 || sec === 2) {
            const m = (sec === 1 ? melA : melB)[bar][st];
            if (m) {
              tone(hz(m.n), t, six * m.d * 1.3, 'triangle', 0.13, { a: 0.012, echoSend: 0.6, send: 0.4 });
              tone(hz(m.n + 12), t, six * m.d, 'sine', 0.04, { a: 0.012 });
            }
          }
        }
        next += six; idx++;
      }
    };
    setInterval(tick, 50);
  }
}
