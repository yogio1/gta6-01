// main.js — PALM COAST STORIES
// Game loop, state machine, camera, save/load. Original work, no external assets.
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { NpcManager } from './npc.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { Fx } from './fx.js';
import { Shots } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const STATE = { TITLE: 0, PLAYING: 1, PAUSED: 2, DEAD: 3 };

export class Game {
  constructor() {
    this.state = STATE.TITLE;
    this.input = createInput(canvas);
    this.sfx = new Sfx();
    this.rng = makeRng(CFG.seed);
    this.world = new World(this.rng);
    this.fx = new Fx();
    this.shots = new Shots(this);
    this.player = new Player(this);
    this.npcs = new NpcManager(this);
    this.police = new Police(this);
    this.missions = new Missions(this);
    this.hud = new Hud(this);
    this.cam = { x: this.player.x, y: this.player.y, angle: 0, zoom: 1.55 };
    this.time = 0;            // world clock seconds (drives day/night)
    this.shake = 0;
    this.saveSlot = 'palmcoast-save-1';
    this.titleFlash = 0;
    this.resetWorld();
  }

  resetWorld() {
    const r = makeRng(CFG.seed ^ 0x9e3779b9);
    this.npcs.populate(r);
    this.player.spawnAt(this.world.spawnPoint());
    this.missions.reset();
    this.cam.x = this.player.x; this.cam.y = this.player.y;
  }

  // ---- state transitions ----
  handleGlobalKeys() {
    const inp = this.input;
    if (inp.wasPressed('Enter')) {
      if (this.state === STATE.TITLE) this.startGame();
      else if (this.state === STATE.DEAD) this.respawn();
    }
    if (inp.wasPressed('KeyL') && this.state === STATE.TITLE) { this.sfx.unlock(); if (this.load()) this.hud.toast('Save loaded', '#9df'); }
    if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) {
      if (inp.wasPressed('Escape') || inp.wasPressed('KeyP')) this.pause();
      if (this.state === STATE.PAUSED) {
        if (inp.wasPressed('KeyS')) { this.hud.toast(this.save() ? 'Game saved' : 'Save failed', '#9df'); this.sfx.beep('click'); }
        if (inp.wasPressed('KeyL')) { if (this.load()) this.sfx.beep('start'); else this.hud.toast('No save found', '#f88'); }
        if (inp.wasPressed('KeyQ')) { this.state = STATE.TITLE; this.sfx.beep('click'); }
      }
    }
  }

  respawn() {
    this.player.spawnAt(this.world.spawnPoint());
    this.player.money = Math.max(0, this.player.money - 100);
    this.police.cars.length = 0;
    this.state = STATE.PLAYING;
    this.hud.toast('Patched up. -$100', '#9df');
    this.sfx.beep('click');
  }

  startGame() {
    this.state = STATE.PLAYING;
    this.sfx.unlock();
    this.sfx.beep('start');
    this.missions.beginIntro();
  }

  pause() {
    if (this.state === STATE.PLAYING) { this.state = STATE.PAUSED; this.sfx.beep('click'); }
    else if (this.state === STATE.PAUSED) { this.state = STATE.PLAYING; this.sfx.beep('click'); }
  }

  save() {
    const d = {
      v: 1, t: this.time,
      player: this.player.serialize(),
      missions: this.missions.serialize(),
      wanted: { level: this.player.wanted, heat: this.player.heat },
      money: this.player.money,
    };
    try { localStorage.setItem(this.saveSlot, JSON.stringify(d)); return true; }
    catch (e) { return false; }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.saveSlot);
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.time = d.t ?? CFG.dayLength * 0.3;
      this.player.deserialize(d.player);
      this.missions.deserialize(d.missions);
      this.player.wanted = d.wanted?.level ?? 0;
      this.player.heat = d.wanted?.heat ?? 0;
      this.player.money = d.money ?? 0;
      this.police.syncToWanted();
      this.state = STATE.PLAYING;
      this.hud.toast('Save loaded', '#9df');
      return true;
    } catch (e) { return false; }
  }

  hasSave() { try { return !!localStorage.getItem(this.saveSlot); } catch (e) { return false; } }

  // ---- main update ----
  update(dt) {
    this.handleGlobalKeys();
    this.time = (this.time + dt) % CFG.dayLength;
    this.titleFlash += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    if (this.state !== STATE.PLAYING) return;

    const p = this.player;
    p.update(dt);
    this.npcs.update(dt);
    this.police.update(dt);
    this.shots.update(dt);
    this.missions.update(dt);
    this.fx.update(dt);
    this.hud.update(dt);

    // wanted level heat decay when laying low
    if (p.wanted > 0) {
      p.heat -= dt;
      if (p.heat <= 0) { p.wanted--; p.heat = CFG.heatWindow; if (p.wanted === 0) this.hud.toast('You lost the heat', '#9f9'); }
      this.police.syncToWanted();
    }

    // camera: smooth follow, slight lead toward aim
    const lead = p.inCar ? 0.55 : 0.25;
    const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
    const k = 1 - Math.pow(0.0015, dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.cam.angle = p.viewAngle;
    const zt = p.inCar ? 1.15 : 1.55;
    this.cam.zoom += (zt - this.cam.zoom) * (1 - Math.pow(0.02, dt));
    if (!this.cam.zoom) this.cam.zoom = zt;

    if (p.health <= 0 && this.state === STATE.PLAYING) {
      this.state = STATE.DEAD;
      this.sfx.beep('die');
    }
  }

  // ---- rendering ----
  draw() {
    const g = ctx;
    g.clearRect(0, 0, W, H);
    if (this.state === STATE.TITLE) { this.hud.drawTitle(g, this); return; }

    g.save();
    // camera transform with shake
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    g.translate(W / 2 + sx, H / 2 + sy);
    g.rotate(this.cam.angle);
    g.scale(this.cam.zoom, this.cam.zoom);
    g.translate(-this.cam.x, -this.cam.y);

    const half = Math.hypot(W, H) / 2 / this.cam.zoom + 64;
    const view = { x0: this.cam.x - half, y0: this.cam.y - half, x1: this.cam.x + half, y1: this.cam.y + half };
    this.world.draw(g, view, this.time);
    this.missions.drawMarkers(g);
    this.npcs.draw(g, view);
    this.police.draw(g, view);
    this.fx.draw(g);
    this.player.draw(g);
    this.shots.draw(g);
    g.restore();

    // day/night tint over world
    const tint = this.world.dayTint(this.time);
    if (tint.a > 0.01) { g.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`; g.fillRect(0, 0, W, H); }

    this.hud.draw(g, this);
    if (this.state === STATE.PAUSED) this.hud.drawPause(g, this);
    if (this.state === STATE.DEAD) this.hud.drawDead(g, this);
  }
}

// fixed-timestep loop
const game = new Game();
let acc = 0, last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25; // tab-back spike guard
  acc += dt;
  const step = 1 / 60;
  let guard = 0;
  while (acc >= step && guard < 5) { game.update(step); acc -= step; guard++; }
  if (guard >= 5) acc = 0; // drop backlog rather than death-spiral
  game.draw();
  game.input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = game; // debug hook
