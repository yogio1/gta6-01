// audio.js — tiny WebAudio synth for UI/gameplay beeps (no files, no network)
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  unlock() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) { this.enabled = false; }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  tone(freq, dur, type = 'square', vol = 0.08, slide = 0) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const gn = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gn.gain.setValueAtTime(vol, t0);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn).connect(this.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  beep(kind) {
    if (!this.ctx) return;
    switch (kind) {
      case 'shoot': this.tone(320, 0.09, 'square', 0.10, -220); break;
      case 'shootFar': this.tone(180, 0.10, 'sawtooth', 0.05, -80); break;
      case 'punch': this.tone(140, 0.08, 'triangle', 0.09, -60); break;
      case 'hit': this.tone(90, 0.14, 'sawtooth', 0.09, -40); break;
      case 'crash': this.tone(70, 0.22, 'sawtooth', 0.11, -30); this.tone(210, 0.1, 'square', 0.05); break;
      case 'steal': this.tone(160, 0.07, 'square', 0.07); this.tone(240, 0.07, 'square', 0.07); setTimeout(() => this.tone(320, 0.09, 'square', 0.07), 80); break;
      case 'click': this.tone(660, 0.05, 'square', 0.05); break;
      case 'start': this.tone(330, 0.1); setTimeout(() => this.tone(440, 0.1), 100); setTimeout(() => this.tone(660, 0.16), 200); break;
      case 'wanted': this.tone(520, 0.12, 'square', 0.08); setTimeout(() => this.tone(390, 0.16, 'square', 0.08), 130); break;
      case 'siren': this.tone(720, 0.25, 'triangle', 0.06, 260); break;
      case 'checkpoint': this.tone(560, 0.09, 'triangle', 0.08); setTimeout(() => this.tone(840, 0.12, 'triangle', 0.08), 90); break;
      case 'mission': this.tone(440, 0.12, 'triangle', 0.07); setTimeout(() => this.tone(550, 0.12, 'triangle', 0.07), 130); setTimeout(() => this.tone(660, 0.18, 'triangle', 0.07), 260); break;
      case 'reward': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.08), i * 110)); break;
      case 'die': this.tone(220, 0.5, 'sawtooth', 0.09, -160); break;
    }
  }
}
