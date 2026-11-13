// Floating virtual joystick (touch / mouse drag) + keyboard. Vector: x right, y up (screen).

export class Input {
  constructor(target, joy, knob) {
    this.keys = new Set();
    this.joy = joy; this.knob = knob;
    this.pid = null; this.ox = 0; this.oy = 0; this.jx = 0; this.jy = 0;
    this.enabled = false;
    this.usedKeys = false;
    const R = 58;
    addEventListener('keydown', e => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        this.keys.add(e.code); this.usedKeys = true; e.preventDefault();
      }
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.release(); });
    target.addEventListener('pointerdown', e => {
      if (!this.enabled || this.pid !== null) return;
      this.pid = e.pointerId; this.ox = e.clientX; this.oy = e.clientY; this.jx = this.jy = 0;
      try { target.setPointerCapture(e.pointerId); } catch (_) {}
      joy.style.left = this.ox + 'px'; joy.style.top = this.oy + 'px';
      joy.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
      e.preventDefault();
    });
    target.addEventListener('pointermove', e => {
      if (e.pointerId !== this.pid) return;
      let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { // drag the base along so the stick keeps responding
        this.ox += dx / d * (d - R); this.oy += dy / d * (d - R);
        dx = e.clientX - this.ox; dy = e.clientY - this.oy;
        joy.style.left = this.ox + 'px'; joy.style.top = this.oy + 'px';
      }
      this.jx = dx / R; this.jy = -dy / R;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    const up = e => { if (e.pointerId === this.pid) this.release(); };
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  release() { this.pid = null; this.jx = this.jy = 0; this.joy.classList.remove('on'); }

  get() {
    // keyboard = tank controls: W/S throttle forward/back, A/D turn
    let turn = 0, throttle = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) turn += 1;
    if (k.has('KeyD') || k.has('ArrowRight')) turn -= 1;
    if (k.has('KeyW') || k.has('ArrowUp')) throttle += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) throttle -= 1;
    if (turn || throttle) return { tank: true, turn, throttle, x: 0, y: 0, mag: 1 };
    const m = Math.hypot(this.jx, this.jy);
    if (m < 0.15) return { x: 0, y: 0, mag: 0 };
    return { x: this.jx / m, y: this.jy / m, mag: Math.min(1, (m - 0.15) / 0.75) };
  }
}
