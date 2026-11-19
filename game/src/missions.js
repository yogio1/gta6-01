// missions.js — three story missions with waypoints and rewards
import { CFG } from './config.js';
import { WORLD } from './world.js';

const MK = (label, x, y) => ({ label, x, y, done: false });

export class Missions {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.index = -1;
    this.stage = 0;
    this.objective = '';
    this.timer = 0;
    this.markers = [];
    this.reward = 0;
    this.started = false;
    this.completed = 0;
    this.lastResult = '';
  }

  beginIntro() {
    this.index = 0; this.stage = 0; this.started = true;
    this.loadMission(0);
  }

  // mission definitions — coordinates expressed as fractions of world so they scatter
  defs() {
    const s = WORLD / 15; // pitch-ish
    return [
      {
        name: 'Meet the Broker',
        blurb: 'Drive to the marina drop and collect the payment.',
        reward: 450,
        build: (m) => {
          m.markers = [
            MK('Marina drop', 4 * s + 55, 11 * s + 55),
            MK('Courier pickup', 11 * s + 55, 3 * s + 55),
          ];
        },
      },
      {
        name: 'Repo Run',
        blurb: 'Steal a car, then lose the cops before delivering it.',
        reward: 900,
        needsCar: true,
        build: (m) => {
          m.markers = [
            MK('Repo bay', 12 * s + 55, 12 * s + 55),
          ];
        },
      },
      {
        name: 'Last Call',
        blurb: 'Take out the rival crew at the docks. Watch your back.',
        reward: 1800,
        needsGun: true,
        build: (m) => {
          m.markers = [
            MK('Docks crew', 7 * s + 55, 2 * s + 55),
          ];
        },
      },
    ];
  }

  loadMission(i) {
    const def = this.defs()[i];
    if (!def) { this.finishAll(); return; }
    this.index = i; this.stage = 0;
    this.mission = def;
    def.build(this);
    this.objective = def.blurb;
    this.reward = def.reward;
    this.timer = 0;
    this.game.hud.setMission(`MISSION ${i + 1}: ${def.name}`, def.blurb);
    this.game.hud.toast(`New mission: ${def.name}`, '#ffe08a');
    this.game.sfx.beep('mission');
    this.game.save();
  }

  currentMarker() {
    return this.markers.find((mk) => !mk.done) || null;
  }

  update(dt) {
    if (!this.started) return;
    const p = this.game.player;
    const mk = this.currentMarker();
    if (this.timer > 0) { this.timer -= dt; if (this.timer <= 0) this.fail('Out of time'); }
    if (!mk) return;
    const d = Math.hypot(p.x - mk.x, p.y - mk.y);
    if (d < 46) {
      const def = this.mission;
      // gating checks
      if (this.index === 1 && this.stage === 0 && !p.inCar) {
        // marker requires a car; just inform once
        if (!this._toldCar) { this.game.hud.toast('Bring a car here', '#ffb'); this._toldCar = true; }
        return;
      }
      if (this.index === 2 && this.stage === 0 && p.inCar) {
        if (!this._toldGun) { this.game.hud.toast('Get out and draw your pistol', '#ffb'); this._toldGun = true; }
        return;
      }
      mk.done = true;
      this.stage++;
      this.game.sfx.beep('checkpoint');
      this.game.fx.sparks(mk.x, mk.y, 18, '#9df');
      if (!this.currentMarker()) this.complete();
      else this.game.hud.setMission(this.game.hud.missionTitle, this.mission.blurb + ' (' + (this.stage + 1) + '/' + this.markers.length + ')');
    }
  }

  complete() {
    const p = this.game.player;
    p.addMoney(this.reward);
    this.completed++;
    this.lastResult = `${this.mission.name} complete  +$${this.reward}`;
    this.game.hud.toast(this.lastResult, '#8f8');
    this.game.sfx.beep('reward');
    if (this.index + 1 < this.defs().length) {
      const next = this.index + 1;
      setTimeout(() => { if (this.started && this.index === next - 1) this.loadMission(next); }, 2200);
    } else {
      this.game.hud.setMission('ALL MISSIONS DONE', 'The coast is yours. Keep causing trouble.');
      this.game.hud.toast('Story complete!', '#ffe08a');
    }
  }

  fail(why) {
    this.game.hud.toast(`Mission failed: ${why}`, '#f88');
    this.loadMission(this.index);
  }

  finishAll() { this.started = false; }

  drawMarkers(g) {
    if (!this.started) return;
    const t = performance.now() / 1000;
    for (const mk of this.markers) {
      if (mk.done) continue;
      const pulse = 1 + Math.sin(t * 3) * 0.12;
      g.save();
      g.translate(mk.x, mk.y);
      g.fillStyle = 'rgba(120,220,255,0.18)';
      g.beginPath(); g.arc(0, 0, 46 * pulse, 0, 7); g.fill();
      g.strokeStyle = 'rgba(150,235,255,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 30 * pulse, 0, 7); g.stroke();
      g.fillStyle = '#bfe9ff';
      g.beginPath(); g.moveTo(0, -52 - Math.sin(t * 3) * 5); g.lineTo(-10, -34); g.lineTo(10, -34); g.closePath(); g.fill();
      g.fillStyle = '#0a1a22'; g.font = 'bold 13px monospace'; g.textAlign = 'center';
      g.fillText(mk.label.split(' ')[0].toUpperCase(), 0, 44);
      g.restore();
    }
  }

  serialize() {
    return { index: this.index, stage: this.stage, done: this.markers.map((m) => m.done), completed: this.completed, started: this.started };
  }

  deserialize(d) {
    if (!d || d.index < 0) return;
    this.started = d.started;
    if (d.index >= this.defs().length) { this.finishAll(); return; }
    this.index = d.index; this.stage = d.stage; this.completed = d.completed ?? 0;
    this.mission = this.defs()[d.index];
    this.mission.build(this);
    this.markers.forEach((m, i) => { m.done = !!d.done?.[i]; });
    this.objective = this.mission.blurb;
    this.reward = this.mission.reward;
    this.game.hud.setMission(`MISSION ${d.index + 1}: ${this.mission.name}`, this.mission.blurb);
  }
}
