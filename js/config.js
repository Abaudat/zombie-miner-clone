// Purrdozer — tuning & layout constants

export const ZONE_LEN = 86; // distance (in "s", north) between zone origins

// Layout of a zone in local coordinates: x (east), s (north, world z = -(k*ZONE_LEN + s))
export const LAYOUT = {
  F: { x0: -18, x1: 18, s0: 0, s1: 44 },      // field island
  field: { cs: 13.5, maxRx: 16.2, maxRs: 11.2 }, // gem blob
  crusher: { x0: -4, x1: 4, s0: 28.3, s1: 29.7, pillarW: 1.2 },
  bridge: { s0: 44, s1: 54 },                  // internal bridge
  P: { x0: -15, x1: 15, s0: 54, s1: 74 },       // pad island
  nz: { s0: 74, s1: 86, w: 6 },                 // bridge to next zone
  belt: { x0: 9, x1: 11, s0: 30, s1: 58 },      // conveyor lane
};

export const ZONES = [
  { id: 'quarry', value: 1, gemR: 0.26, gemCount: 950, gem: 'marble', gemColor: 0x1a7dff, gemEmissive: 0x05306a,
    ground: 0xc9935e, ground2: 0xb7814f, side: 0x7a4f2c, rim: 0x9a6b44, abyss: 0x3a2214, fog: 0xe8c49a,
    pillar: 0x6a4cff, decor: 'quarry' },
  { id: 'lava', value: 10, gemR: 0.31, gemCount: 900, gem: 'crystal', gemColor: 0xc04dff, gemEmissive: 0x3a0a66,
    ground: 0x3e3439, ground2: 0x352c31, side: 0x2c2228, rim: 0x6b5560, abyss: 0xff5a1a, lava: true, fog: 0x7a3a2c,
    pillar: 0xff7a1a, decor: 'lava' },
  { id: 'ice', value: 100, gemR: 0.36, gemCount: 850, gem: 'orb', gemColor: 0xe6ebf2, gemEmissive: 0x000000,
    ground: 0xeef7ff, ground2: 0xd8ecfa, side: 0x8fb8d8, rim: 0xb5dcf5, abyss: 0x1d5a8f, fog: 0xc6e2f5,
    pillar: 0x3fa3ff, decor: 'ice' },
  { id: 'jungle', value: 1000, gemR: 0.42, gemCount: 800, gem: 'emerald', gemColor: 0x16c96f, gemEmissive: 0x02331a,
    ground: 0x8a9a62, ground2: 0x76884f, side: 0x4d5a39, rim: 0x9aa088, abyss: 0x1c4a2b, fog: 0x9cbf86,
    pillar: 0xd6b16a, decor: 'jungle' },
  { id: 'vault', value: 10000, gemR: 0.5, gemCount: 760, gem: 'nugget', gemColor: 0xffc23a, gemEmissive: 0x2a1600,
    ground: 0x6a3a8c, ground2: 0x5a2f78, side: 0x2e1640, rim: 0xe0b043, abyss: 0x1b0c2c, fog: 0x4a2766,
    pillar: 0xe0b043, decor: 'vault' },
];

export const COIN_R = 0.24;

// Upgrade tables (global levels)
export const BLADE_W = [2.6, 3.5, 4.4, 5.3, 6.2, 7.1];
export const SPEEDS = [5.6, 6.8, 8.0, 9.2, 10.4, 11.6];
export const MULTS = [10, 20, 30, 50];
export const BRIDGE_W = [3.2, 4.6, 6.0, 7.4];

export const UPG = {
  blade: { max: 5, base: 120, growth: 1.55 },
  speed: { max: 5, base: 100, growth: 1.55 },
  crusher: { max: 3, base: 450, growth: 2.0 },
  bridge: { max: 3, base: 160, growth: 1.7 },
};

export function upgradeCost(type, level, zone) {
  const v = ZONES[zone].value;
  if (type === 'conveyor') return 500 * v;
  if (type === 'next') return (2500 + 1500 * zone) * v;
  if (type === 'statue') return 14000 * v;
  const u = UPG[type];
  return Math.round(u.base * Math.pow(u.growth, level)) * v;
}

// Pads on the pad island (local coords)
export const PADS = [
  { type: 'blade', x: -10.5, s: 60.5, size: 4.4, color: '#ff8a1e' },
  { type: 'speed', x: -10.5, s: 67.8, size: 4.4, color: '#19b8e6' },
  { type: 'bridge', x: -4.2, s: 69.6, size: 4.4, color: '#c47a3a' },
  { type: 'next', x: 4.6, s: 69.4, size: 5.0, color: '#2fc26a' },
  { type: 'crusher', x: 10.6, s: 68.0, size: 4.4, color: '#9a4dff' },
  { type: 'conveyor', x: 10.4, s: 61.2, size: 4.4, color: '#5b7a99' },
];

export const MASK_GEM = 1, MASK_COIN = 2, MASK_DOZER = 4, MASK_ALL = 7;

export function zw(k, s) { return -(k * ZONE_LEN + s); }

export function fmt(n) {
  n = Math.max(0, Math.ceil(n));
  if (n < 1000) return String(n);
  const units = ['K', 'M', 'B', 'T'];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  return (n >= 100 ? Math.floor(n) : n >= 10 ? Math.floor(n * 10) / 10 : Math.floor(n * 100) / 100) + units[u];
}
