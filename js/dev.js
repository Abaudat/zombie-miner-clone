// Dev helpers, loaded only with ?dev in the URL. Used for exploratory testing.
const wait = ms => new Promise(r => setTimeout(r, ms));

export function install(pd) {
  const { dozer, input } = pd;
  const drive = async (pts, tol = 1.2, timeout = 15000) => {
    for (const [x, s] of pts) {
      const z = -s; const t0 = performance.now();
      input.get = () => {
        const dx = x - dozer.x, dz = z - dozer.z, d = Math.hypot(dx, dz);
        return d < tol ? { x: 0, y: 0, mag: 0 } : { x: dx / d, y: -dz / d, mag: 1 };
      };
      while (Math.hypot(x - dozer.x, z - dozer.z) > tol && performance.now() - t0 < timeout) await wait(30);
    }
    input.get = () => ({ x: 0, y: 0, mag: 0 });
  };
  const play = async () => {
    while (!document.getElementById('title').classList.contains('ready')) await wait(100);
    document.getElementById('playBtn').click();
    await wait(1500);
  };
  // Recreates the ad framing: a loaded blade arriving at the crusher
  const adScene = async (stopS = 21, bladeLv = 1) => {
    await play();
    for (let i = 0; i < bladeLv; i++) pd.complete(pd.pads.find(p => p.k === 0 && p.type === 'blade'));
    await drive([[-8, 1.5], [-1, 2], [-1, stopS]]);
    await wait(700);
  };
  Object.assign(window, { __drive: drive, __play: play, __adScene: adScene });
}
