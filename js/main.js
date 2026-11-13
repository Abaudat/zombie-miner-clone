import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ZONES, ZONE_LEN, LAYOUT, PADS, UPG, BLADE_W, SPEEDS, MULTS, upgradeCost, fmt, zw } from './config.js';
import { Physics } from './physics.js';
import { Coins, TIERS } from './coins.js';
import { World } from './world.js';
import { Bodies } from './bodies.js';
import { Dozer } from './dozer.js';
import { Pad } from './pads.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { LANGS, detectLang, setLang, getLang, t } from './i18n.js';
import { Post } from './post.js';

const SAVE_KEY = 'purrdozer-save-v1';
const $ = id => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------- state ----------
function defaultState() {
  return {
    v: 1, levels: { blade: 0, speed: 0, crusher: 0, bridge: 0 }, conveyors: [0, 0, 0, 0, 0],
    unlocked: 0, fills: {}, stats: { crushed: 0, time: 0 }, won: false, dozer: null,
    hints: { drive: 0, crush: 0, pads: 0 }, muted: false, lang: null, justBuilt: -1,
  };
}
let state = defaultState();
let hasSave = false;
if (/[?&]fresh/.test(location.search)) { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} }
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) { state = Object.assign(defaultState(), s); state.justBuilt = -1; hasSave = !state.won && (s.stats.crushed > 0 || s.unlocked > 0); } }
} catch (_) { /* storage unavailable */ }
if (state.won) state = defaultState();
state.levels.speed = Math.min(state.levels.speed, UPG.speed.max);

function save() {
  state.dozer = { x: dozer.x, z: dozer.z, h: dozer.heading };
  for (const p of pads) state.fills[p.k + ':' + p.type] = p.fill;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
}

setLang(state.lang || detectLang());

// ---------- renderer / scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio, isTouch ? 1.75 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
scene.fog = new THREE.Fog(ZONES[0].fog, 62, 150);
scene.background = new THREE.Color(ZONES[0].fog);

const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 300);
const hemi = new THREE.HemisphereLight(0xdfeaff, 0x8a6a4a, 0.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffeccc, 3.4);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1536 : 2048, isTouch ? 1536 : 2048);
const sc = sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 100;
sun.shadow.radius = 3;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

// ---------- systems ----------
const physics = new Physics(8000);
let coins = null; // rigid-body coins, created in boot() once the physics WASM is loaded
const post = new Post(renderer, scene, camera, isTouch);
const world = new World(scene);
const bodies = new Bodies(scene, physics);
const dozer = new Dozer(scene);
const fx = new FX(scene, camera);
const sound = new Sound(); sound.muted = !!state.muted;
const input = new Input(canvas, $('joy'), $('knob'));

const pads = [];
const padsByZone = ZONES.map(() => []);
for (let k = 0; k < ZONES.length; k++) {
  for (const d of PADS) {
    const def = (k === 4 && d.type === 'next') ? { ...d, type: 'statue', color: '#e0a321', size: 5.2 } : d;
    const p = new Pad(scene, def, k);
    p.fill = state.fills[k + ':' + def.type] || 0;
    pads.push(p); padsByZone[k].push(p);
  }
}

function padCost(p) {
  if (UPG[p.type]) return upgradeCost(p.type, state.levels[p.type], p.k);
  return upgradeCost(p.type, 0, p.k);
}
function padVisible(p) {
  if (p.k > state.unlocked + 1) return false;
  if (UPG[p.type]) return state.levels[p.type] < UPG[p.type].max;
  if (p.type === 'conveyor') return !state.conveyors[p.k];
  if (p.type === 'next') return state.unlocked <= p.k;
  return !state.won;
}
function drawPad(p) {
  p.setVisible(padVisible(p));
  p.needsDraw = false;
  if (!p.visible) return;
  const lv = UPG[p.type] ? `${t('lv')} ${state.levels[p.type] + 1}` : '';
  p.draw(t(p.type), padCost(p), lv);
}
function redrawPads() { for (const p of pads) drawPad(p); }

function applyLevels() {
  dozer.setBlade(BLADE_W[state.levels.blade]);
  dozer.maxSpeed = SPEEDS[state.levels.speed];
  world.setMultiplier(MULTS[state.levels.crusher]);
}

function rebuildWorld() {
  const walls = world.rebuild(state);
  physics.setWalls(walls);
  coins.setWalls(walls);
  physics.killZones = ZONES.map((_, k) => ({
    k, x0: LAYOUT.crusher.x0, x1: LAYOUT.crusher.x1,
    z0: zw(k, LAYOUT.crusher.s1 + 0.15), z1: zw(k, LAYOUT.crusher.s0 - 0.15),
  }));
  physics.belts = [];
  ZONES.forEach((_, k) => {
    if (state.conveyors[k]) physics.belts.push({ x0: LAYOUT.belt.x0, x1: LAYOUT.belt.x1, z0: zw(k, LAYOUT.belt.s1), z1: zw(k, LAYOUT.belt.s0), dx: 0, dz: -1, speed: 5 });
  });
  coins.belts = physics.belts;
}

function spawnFields() {
  for (let k = 0; k <= Math.min(ZONES.length - 1, state.unlocked + 1); k++) bodies.spawnField(k);
}

// ---------- UI ----------
const ui = {
  title: $('title'), hud: $('hud'), hint: $('hint'), toast: $('toast'), banner: $('banner'),
  ending: $('ending'), zonePill: $('zonePill'), mute: $('muteBtn'),
};
let mode = 'title';
let confirmNew = false;

function buildLangs() {
  const box = $('langs'); box.innerHTML = '';
  for (const [code, name] of LANGS) {
    const b = document.createElement('button');
    b.textContent = name; b.className = 'lang' + (code === getLang() ? ' on' : '');
    b.onclick = () => { setLang(code); state.lang = code; save(); refreshTexts(); };
    box.appendChild(b);
  }
}

function refreshTexts() {
  $('tagline').textContent = t('tagline');
  $('playBtn').textContent = hasSave ? t('cont') : t('play');
  $('newBtn').textContent = confirmNew ? t('confirmNew') : t('newGame');
  $('newBtn').hidden = !hasSave;
  $('endTitle').textContent = t('endTitle');
  $('endSub').textContent = t('endSub');
  $('lblGems').textContent = t('gems');
  $('lblTime').textContent = t('time');
  $('againBtn').textContent = t('again');
  ui.mute.title = t('mute');
  ui.zonePill.textContent = t('zones')[curZone];
  buildLangs();
  redrawPads();
  updateHint(true);
}

function setMuteIcon() { ui.mute.classList.toggle('muted', sound.muted); }
ui.mute.onclick = (e) => { e.stopPropagation(); sound.init(); sound.setMuted(!sound.muted); state.muted = sound.muted; setMuteIcon(); save(); };

let toastTimer = 0;
function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.remove('show'); void ui.toast.offsetWidth; ui.toast.classList.add('show');
  toastTimer = 2.2;
}
function banner(text) {
  ui.banner.textContent = text;
  ui.banner.classList.remove('show'); void ui.banner.offsetWidth; ui.banner.classList.add('show');
}

let hintKey = '';
function updateHint(force) {
  let key = '';
  if (mode === 'play') {
    if (!state.hints.drive) key = 'drive';
    else if (!state.hints.crush) key = 'hintCrush';
    else if (!state.hints.pads && coins.count > 15) key = 'hintPads';
  }
  if (key === hintKey && !force) return;
  hintKey = key;
  ui.hint.textContent = key === 'drive' ? t((isTouch || !input.usedKeys) && isTouch ? 'hintDrag' : 'hintKeys') : key ? t(key) : '';
  ui.hint.classList.toggle('show', !!key);
}

$('playBtn').onclick = () => startGame();
$('newBtn').onclick = () => {
  if (!confirmNew) { confirmNew = true; refreshTexts(); return; }
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  location.reload();
};
$('againBtn').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} location.reload(); };

let camBlend = 0;
function startGame() {
  sound.init();
  mode = 'play';
  ui.title.classList.add('hide');
  ui.hud.hidden = false;
  input.enabled = true;
  camBlend = 0;
  updateHint(true);
}

// ---------- gameplay ----------
let curZone = -1;
let popAcc = ZONES.map(() => 0), popT = 0;
const stepDt = 1 / 120;
let acc = 0;

function zoneAt(z) { return Math.max(0, Math.min(ZONES.length - 1, Math.floor(-z / ZONE_LEN))); }

// Each crushed gem pours out (multiplier) coins, worth one zone-value unit each.
// They are queued and streamed out of the crusher so big hauls become a coin avalanche.
const spout = [];
const COIN_SOFT_CAP = isTouch ? 260 : 450;
function handleCrushed() {
  const list = physics.crushed;
  if (!list.length) return;
  const mult = MULTS[state.levels.crusher];
  for (const e of list) {
    state.stats.crushed++;
    if (!state.hints.crush) { state.hints.crush = 1; updateHint(); }
    const total = e.value * mult;
    // break the payout into tiered coins: up to ~10 coins per gem (3 when the field is crowded)
    const unit = ZONES[e.k].value, units = Math.round(total / unit);
    const maxPer = coins.count > COIN_SOFT_CAP ? 3 : 10;
    let top = 0;
    while (top < TIERS.length - 1 && Math.ceil(units / TIERS[top].v) > maxPer) top++;
    let rem = units;
    for (let t = top; t >= 0 && rem > 0; t--) {
      const n = Math.floor(rem / TIERS[t].v);
      for (let c = 0; c < n; c++) spout.push({ k: e.k, x: Math.max(-3.4, Math.min(3.4, e.x)), t, v: TIERS[t].v * unit });
      rem -= n * TIERS[t].v;
    }
    fx.shards(e.x, e.y + 0.3, e.z, ZONES[e.zone].gemColor, 3);
    sound.crush();
    popAcc[e.k] += total;
  }
  list.length = 0;
}

function pourCoins(dt) {
  if (!spout.length) return;
  let budget = Math.ceil(dt * Math.min(200, Math.max(90, spout.length * 0.5)));
  let chimed = false;
  while (budget-- > 0 && spout.length) {
    const q = spout.shift();
    const x = q.x + (Math.random() - 0.5) * 1.6, s = 30.3 + Math.random() * 0.5, y = 0.6 + Math.random() * 0.8;
    const vx = (Math.random() - 0.5) * 2.4, vy = 2 + Math.random() * 3.5, vs = 2.4 + Math.random() * 3.6;
    const id = coins.spawn(x, y, zw(q.k, s), vx, vy, -vs, q.v, q.t);
    if (id < 0) { // hard cap: fold the value into an existing coin
      const j = coins.randomAlive();
      if (j >= 0) coins.value[j] += q.v;
    }
    if (!chimed) { sound.coinSpill(); chimed = true; }
  }
}

function absorbCoins() {
  const { maxIndex, alive, px, pz } = coins;
  for (let i = 0; i < maxIndex; i++) {
    if (!alive[i]) continue;
    const x = px[i], z = pz[i];
    const k = zoneAt(z);
    const s = -z - k * ZONE_LEN;
    if (s < LAYOUT.P.s0 || s > LAYOUT.P.s1) continue;
    for (const p of padsByZone[k]) {
      if (!p.contains(x, z)) continue;
      const v = coins.value[i];
      coins.remove(i);
      p.fill += v; p.pulse = 1; p.needsDraw = true;
      sound.chime();
      if (!state.hints.pads) { state.hints.pads = 1; updateHint(); }
      if (p.fill >= padCost(p)) complete(p);
      break;
    }
  }
}

function complete(p) {
  const cost = padCost(p);
  p.fill = Math.max(0, p.fill - cost);
  const k = p.k;
  let msg = '';
  switch (p.type) {
    case 'blade': case 'speed': case 'crusher': case 'bridge':
      state.levels[p.type]++;
      msg = t('upgraded', { name: t(p.type), lv: state.levels[p.type] + 1 });
      applyLevels();
      if (p.type === 'bridge') rebuildWorld();
      if (state.levels[p.type] >= UPG[p.type].max) p.fill = 0;
      break;
    case 'conveyor':
      state.conveyors[k] = 1; p.fill = 0; msg = t('conveyorOn'); rebuildWorld();
      break;
    case 'next':
      state.unlocked = Math.max(state.unlocked, k + 1); state.justBuilt = k; p.fill = 0;
      rebuildWorld(); spawnFields(); sound.build(); msg = t('unlocked');
      break;
    case 'statue':
      p.fill = 0; win(); return;
  }
  p.pop = 1;
  sound.kaching();
  fx.confetti(p.x, 0.6, p.z, 70, 5);
  toast(msg);
  redrawPads();
  save();
}

// ---------- ending ----------
let endT = 0;
function win() {
  state.won = true;
  mode = 'ending'; endT = 0;
  input.enabled = false; input.release();
  ui.hint.classList.remove('show');
  sound.fanfare();
  redrawPads();
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}
function showEnding() {
  $('statGems').textContent = state.stats.crushed.toLocaleString();
  const s = Math.floor(state.stats.time);
  $('statTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  ui.hud.hidden = true;
  ui.ending.hidden = false;
}

// ---------- camera ----------
const camTarget = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camPos = new THREE.Vector3();
let W = innerWidth, H = innerHeight, gameFov = 50;
const CAM_D = 44, CAM_EL = 50 * Math.PI / 180;
function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  const aspect = W / H;
  const visW = aspect < 1 ? 24 : Math.min(46, 24 + (aspect - 1) * 16);
  const fromW = 2 * Math.atan(visW / 2 / CAM_D / aspect) * 180 / Math.PI;
  const fromH = 2 * Math.atan(25 / 2 / CAM_D) * 180 / Math.PI; // keep enough view ahead in landscape
  gameFov = THREE.MathUtils.clamp(Math.max(fromW, fromH), 30, 72);
  camera.updateProjectionMatrix();
  post.setSize(W, H, pixelRatio);
}
addEventListener('resize', resize);

let orbit = 0;
function updateCamera(dt) {
  const tx = dozer.x, tz = dozer.z - 3.5;
  camTarget.x += (tx - camTarget.x) * (1 - Math.exp(-dt * 5));
  camTarget.z += (tz - camTarget.z) * (1 - Math.exp(-dt * 5));
  const gPos = new THREE.Vector3(camTarget.x, Math.sin(CAM_EL) * CAM_D, camTarget.z + Math.cos(CAM_EL) * CAM_D);
  const gLook = camTarget.clone();
  orbit += dt * 0.22;
  let pos, look, fov;
  if (mode === 'title') {
    const r = 8.5;
    pos = new THREE.Vector3(dozer.x + Math.sin(orbit) * r, 4.2, dozer.z + Math.cos(orbit) * r);
    look = new THREE.Vector3(dozer.x, 1.4, dozer.z);
    fov = W / H < 1 ? 62 : 42;
    camPos.copy(pos); camLook.copy(look); camera.fov = fov;
  } else if (mode === 'ending') {
    const st = world.statue.position;
    const r = 15, a = Math.sin(endT * 0.35) * 0.7;
    pos = new THREE.Vector3(st.x + Math.sin(a) * r, 8, st.z + Math.cos(a) * r);
    look = new THREE.Vector3(st.x, 4, st.z);
    const k = 1 - Math.exp(-dt * 1.5);
    camPos.lerp(pos, k); camLook.lerp(look, k);
    camera.fov += ((W / H < 1 ? 64 : 45) - camera.fov) * k;
  } else {
    camBlend = Math.min(1, camBlend + dt / 1.3);
    const e = camBlend < 1 ? 1 - Math.pow(1 - camBlend, 3) : 1;
    camPos.lerp(gPos, camBlend < 1 ? e : 1);
    camLook.lerp(gLook, camBlend < 1 ? e : 1);
    camera.fov += (gameFov - camera.fov) * (camBlend < 1 ? e : 1);
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  camera.updateProjectionMatrix();
  // light follows the action
  sun.position.set(camLook.x + 16, 30, camLook.z + 4);
  sun.target.position.set(camLook.x, 0, camLook.z);
}

// zone ambience blending
const fogA = new THREE.Color(), fogB = new THREE.Color();
function updateAmbience() {
  const s = -dozer.z;
  const zf = s / ZONE_LEN;
  const k = Math.max(0, Math.min(ZONES.length - 1, Math.floor(zf)));
  const frac = zf - k;
  const blend = THREE.MathUtils.smoothstep(frac, 0.8, 1.05);
  fogA.set(ZONES[k].fog);
  fogB.set(ZONES[Math.min(ZONES.length - 1, k + 1)].fog);
  fogA.lerp(fogB, blend);
  scene.fog.color.copy(fogA); scene.background.copy(fogA);
  hemi.groundColor.set(ZONES[k].ground);
  const zz = zoneAt(dozer.z);
  if (zz !== curZone) {
    const first = curZone === -1;
    curZone = zz;
    ui.zonePill.textContent = t('zones')[zz];
    if (!first) banner(t('zones')[zz]);
  }
}

// ---------- loop ----------
let last = performance.now(), time = 0, saveT = 0, trackD = 0, lastX = 0, lastZ = 0;
let fpsT = 0, fpsN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  time += dt;

  if (mode === 'play') {
    acc += dt;
    let steps = 0;
    const inp = input.get();
    while (acc >= stepDt && steps < 4) {
      dozer.step(stepDt, inp, physics, physics.kinContacts, physics.belts);
      physics.step(stepDt);
      handleCrushed();
      pourCoins(stepDt);
      acc -= stepDt; steps++;
    }
    if (steps === 4) acc = 0;
    coins.setKinematic(physics.kin);
    const bl = physics.kin[0];
    coins.manage(dt, [{ x: bl.x, z: bl.z, r: bl.hx + 1.6 }, { x: dozer.x, z: dozer.z, r: 2.3 }]);
    coins.step(dt);
    absorbCoins();
    state.stats.time += dt;
    if (!state.hints.drive && Math.hypot(dozer.x - lastX, dozer.z - lastZ) > 0.01) {
      trackD += Math.hypot(dozer.x - lastX, dozer.z - lastZ);
      if (trackD > 4) { state.hints.drive = 1; updateHint(); }
    }
    saveT += dt;
    if (saveT > 2) { saveT = 0; save(); updateHint(); }
    // adaptive resolution
    fpsT += dt; fpsN++;
    if (fpsT > 2.5) {
      const fps = fpsN / fpsT; fpsT = 0; fpsN = 0;
      if (fps < 42 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); }
      else if (fps < 34 && post.enabled) post.enabled = false; // last resort on weak GPUs
    }
  } else {
    // keep coins/gems settling in the background (e.g. during ending)
    physics.kin = [];
    if (mode === 'ending') {
      physics.step(1 / 60);
      coins.manage(dt, []);
      coins.step(dt);
      endT += dt;
      if (endT < 4 && Math.random() < dt * 6) {
        const st = world.statue.position;
        fx.confetti(st.x + (Math.random() - 0.5) * 6, 8, st.z + (Math.random() - 0.5) * 4, 30, 7);
        sound.chime();
      }
      if (endT < 3.2) { // golden coin fountain from the statue
        const st = world.statue.position;
        for (let c = 0; c < (Math.random() < 0.6 ? 1 : 0); c++) {
          const a = Math.random() * 6.28, sp = 2 + Math.random() * 4;
          coins.spawn(st.x + (Math.random() - 0.5), 5, st.z + 4.6, Math.cos(a) * sp, 4 + Math.random() * 5, Math.abs(Math.sin(a)) * sp + 2, 0, 2 + (c & 1));
        }
      }
      if (endT > 3.5 && ui.ending.hidden) showEnding();
    }
  }

  // tire tracks
  const moved = Math.hypot(dozer.x - lastX, dozer.z - lastZ);
  dozer.trackDist += moved;
  if (dozer.trackDist > 0.32) {
    dozer.trackDist = 0;
    const c = Math.cos(dozer.heading), s = Math.sin(dozer.heading);
    for (const sx of [-0.92, 0.92]) fx.track(dozer.x + sx * c - 1.2 * s, dozer.z - sx * s - 1.2 * c, dozer.heading);
  }
  lastX = dozer.x; lastZ = dozer.z;

  // crusher popups
  popT -= dt;
  if (popT <= 0) {
    popT = 0.28;
    popAcc.forEach((v, k) => {
      if (v > 0) {
        fx.popup('+' + fmt(v), (Math.random() - 0.5) * 3, 5, zw(k, 30), 'gold');
        popAcc[k] = 0;
      }
    });
  }

  // throttled pad redraw
  let budget = 4;
  for (const p of pads) { if (p.needsDraw && budget-- > 0) drawPad(p); p.update(dt); }

  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) ui.toast.classList.remove('show'); }

  const speed01 = Math.min(1, Math.abs(dozer.speed) / 10);
  sound.update(dt, speed01, mode === 'play' && Math.abs(dozer.speed) > 0.3);
  if (mode === 'play') sound.clatter(physics.kinContacts * Math.min(1, Math.abs(dozer.speed) / 3), dt, curZone);

  dozer.updateVisual(dt, time);
  bodies.sync();
  coins.sync();
  world.update(dt);
  fx.update(dt, W, H);
  updateAmbience();
  updateCamera(dt);
  post.render(dt);
}

// ---------- boot ----------
async function boot() {
  try { await Promise.race([document.fonts.load("40px 'Lilita One'"), new Promise(r => setTimeout(r, 2500))]); } catch (_) {}
  coins = await Coins.create(scene, 900);
  rebuildWorld();
  spawnFields();
  applyLevels();
  if (state.dozer) { dozer.x = state.dozer.x; dozer.z = state.dozer.z; dozer.heading = state.dozer.h; }
  else { dozer.x = -14.2; dozer.z = zw(0, 4); dozer.heading = Math.PI - 0.6; }
  lastX = dozer.x; lastZ = dozer.z;
  camTarget.set(dozer.x, 0, dozer.z - 2.5);
  physics.kin = dozer.colliders();
  resize();
  updateAmbience();
  refreshTexts();
  setMuteIcon();
  ui.title.classList.add('ready');
  $('loading').remove();
  requestAnimationFrame(t => { last = t; frame(t); });
  addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') save(); });
  addEventListener('pagehide', () => { if (mode === 'play') save(); });
}
boot().catch(e => console.error("boot failed", e && e.stack || e));

// debug hooks for testing
if (/[?&]dev/.test(location.search)) {
  window.__pd = { state, physics, dozer, pads, complete, bodies, input, post, get coins() { return coins; } };
  import('./dev.js').then(m => m.install(window.__pd));
}
