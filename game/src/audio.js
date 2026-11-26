// Procedural sound: no audio files, everything is synthesised in the
// browser with WebAudio — the engine's drone, the wind, the ring chime,
// the touchdown thud and the crash. Starts only after a first gesture.
export class GameAudio {
  constructor() {
    this.context = null;
    this.muted = false;
    this.engineGain = null;
    this.windGain = null;
    this.engineOsc = null;
  }

  // Call from a key press or a click: browsers need a gesture first.
  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      this.context = new AC();
      const ctx = this.context;
      // Engine: a low sawtooth through a lowpass, its pitch following rpm.
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 62;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(ctx.destination);
      this.engineOsc.start();
      // Wind: looped noise through a bandpass, louder with speed.
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 480;
      windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      noise.connect(windFilter).connect(this.windGain).connect(ctx.destination);
      noise.start();
    } catch {
      this.context = null;
    }
  }

  // Called every frame: throttle sets the drone, speed sets the wind.
  update(throttle, speed, flying) {
    if (!this.context || this.muted) return;
    const t = this.context.currentTime;
    const on = flying ? 1 : 0;
    this.engineGain.gain.setTargetAtTime(0.05 + throttle * 0.075 * on, t, 0.12);
    this.engineOsc.frequency.setTargetAtTime(52 + throttle * 58, t, 0.12);
    this.windGain.gain.setTargetAtTime(Math.min(0.09, Math.max(0, (speed - 30) * 0.0016)) * on, t, 0.2);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.context) {
      const t = this.context.currentTime;
      const master = this.muted ? 0 : 1;
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0.05 * master, t, 0.05);
      if (this.windGain) this.windGain.gain.setTargetAtTime(0, t, 0.05);
    }
    return this.muted;
  }

  // A short chime: the ring's reward, two notes a fifth apart.
  chime() {
    this.tone(880, 0.16, 0.12, 'sine');
    setTimeout(() => this.tone(1318, 0.2, 0.1, 'sine'), 90);
  }

  // A low thud for a touchdown.
  thud() {
    this.tone(70, 0.22, 0.22, 'sine');
  }

  // A burst of noise for a crash.
  crash() {
    if (!this.context || this.muted) return;
    try {
      const ctx = this.context;
      const length = ctx.sampleRate * 0.6;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      src.connect(gain).connect(ctx.destination);
      src.start();
    } catch {
      /* silent when audio is unavailable */
    }
  }

  tone(freq, duration, volume, type) {
    if (!this.context || this.muted) return;
    try {
      const ctx = this.context;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* silent when audio is unavailable */
    }
  }
}
