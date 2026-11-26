// Input: keyboard, mouse and touch, folded into the three axes the
// flight model reads — pitch, roll and throttle — plus the one-shot
// edges for action, pause, mute, confirm and restart.
import { CONFIG } from './config.js';

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, active: false, lastMove: 0, down: false };
    this.touch = { active: false, startX: 0, startY: 0, x: 0, y: 0 };
    this.wheelDelta = 0;
    this.edges = { action: false, pause: false, mute: false, confirm: false, restart: false };
    this.canvas = canvas;
    this.attach(canvas);
  }

  attach(canvas) {
    window.addEventListener('keydown', (event) => {
      if (this.isGameKey(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.keys.add(event.code);
      this.setEdge(event.code, true);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) / rect.width;
      this.mouse.y = (event.clientY - rect.top) / rect.height;
      this.mouse.active = true;
      this.mouse.lastMove = performance.now();
    });
    canvas.addEventListener('mousedown', (event) => {
      this.mouse.down = true;
      if (event.button === 0) this.edges.action = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.wheelDelta += -Math.sign(event.deltaY);
      },
      { passive: false },
    );
    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      this.touch.active = true;
      this.touch.startX = touch.clientX;
      this.touch.startY = touch.clientY;
      this.touch.x = touch.clientX;
      this.touch.y = touch.clientY;
    });
    canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      this.touch.x = touch.clientX;
      this.touch.y = touch.clientY;
    });
    canvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      if (this.touch.active && Math.abs(this.touch.x - this.touch.startX) < 12 && Math.abs(this.touch.y - this.touch.startY) < 12) {
        this.edges.action = true;
      }
      this.touch.active = false;
    });
  }

  isGameKey(code) {
    return Object.values(CONFIG.keys).flat().includes(code);
  }

  setEdge(code, value) {
    const k = CONFIG.keys;
    if (k.action.includes(code)) this.edges.action = value;
    if (k.pause.includes(code)) this.edges.pause = value;
    if (k.mute.includes(code)) this.edges.mute = value;
    if (k.confirm.includes(code)) this.edges.confirm = value;
    if (k.restart.includes(code)) this.edges.restart = value;
  }

  consume(edge) {
    const value = this.edges[edge];
    this.edges[edge] = false;
    return value;
  }

  consumeWheel() {
    const value = this.wheelDelta;
    this.wheelDelta = 0;
    return value;
  }

  held(codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // The three axes: keys win over the mouse; the mouse steers only while
  // it has moved recently, so a resting pointer never fights the keys.
  axes(now) {
    const k = CONFIG.keys;
    let pitch = 0;
    let roll = 0;
    if (this.held(k.pitchUp)) pitch += 1;
    if (this.held(k.pitchDown)) pitch -= 1;
    if (this.held(k.rollLeft)) roll -= 1;
    if (this.held(k.rollRight)) roll += 1;
    if (pitch === 0 && roll === 0 && this.touch.active) {
      const dx = (this.touch.x - this.touch.startX) / 90;
      const dy = (this.touch.y - this.touch.startY) / 90;
      roll = Math.max(-1, Math.min(1, dx));
      pitch = Math.max(-1, Math.min(1, -dy));
    }
    if (pitch === 0 && roll === 0 && this.mouse.active && now - this.mouse.lastMove < 1500 && !this.mouse.down) {
      roll = Math.max(-1, Math.min(1, (this.mouse.x - 0.5) * 2.4));
      pitch = Math.max(-1, Math.min(1, (0.5 - this.mouse.y) * 2.0));
      if (Math.abs(roll) < 0.12) roll = 0;
      if (Math.abs(pitch) < 0.12) pitch = 0;
    }
    let throttle = 0;
    if (this.held(k.throttleUp)) throttle += 1;
    if (this.held(k.throttleDown)) throttle -= 1;
    return { pitch, roll, throttle };
  }
}
