// npc.js — traffic cars on lane loops + wandering pedestrians
import { CFG } from './config.js';
import { WORLD } from './world.js';

const CAR_COLORS = ['#c94f4f', '#4f7fc9', '#c9b34f', '#5aa05a', '#8a5ac9', '#c97f4f', '#7f8a99'];
const PED_COLORS = ['#d9c08a', '#a4b3c9', '#c98aa4', '#8ac9a4', '#c9a48a'];

export class NpcManager {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.peds = [];
  }

  populate(rng) {
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < CFG.carCount; i++) this.spawnCar(rng);
    for (let i = 0; i < CFG.pedCount; i++) this.spawnPed(rng);
  }

  spawnCar(rng) {
    const w = this.game.world;
    const loop = w.loopFor(rng);
    // pick a random point along the loop perimeter
    const seg = rng.int(0, loop.length - 1);
    const a = loop[seg], b = loop[(seg + 1) % loop.length];
    const t = rng();
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    this.cars.push({
      x, y, angle, vx: Math.cos(angle) * 90, vy: Math.sin(angle) * 90,
      loop, wp: (seg + 1) % loop.length, ai: true, driver: null,
      color: rng.pick(CAR_COLORS), w: 34, h: 16, kind: 'civ', dead: false, speed: rng.range(80, 120),
      honk: 0,
    });
  }

  spawnPed(rng) {
    const w = this.game.world;
    // random sidewalk spot: on a road edge but not on asphalt
    for (let tries = 0; tries < 30; tries++) {
      const x = rng.range(0, WORLD), y = rng.range(0, WORLD);
      if (w.isSidewalk(x, y)) {
        this.peds.push({
          x, y, angle: rng.range(0, Math.PI * 2),
          speed: rng.range(28, 48), turnT: rng.range(1, 4),
          color: rng.pick(PED_COLORS), phase: rng.range(0, 9),
          dead: false, panic: 0, vx: 0, vy: 0,
        });
        return;
      }
    }
  }

  update(dt) {
    const player = this.game.player;
    const w = this.game.world;
    for (const c of this.cars) {
      if (c.driver === 'player') continue; // handled by player physics
      if (c.dead) continue;
      this.driveLoop(c, dt, w);
    }
    for (const p of this.peds) {
      if (p.dead) { p.deadT = (p.deadT ?? 0) + dt; continue; }
      if (p.panic > 0) {
        p.panic -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.pow(0.5, dt); p.vy *= Math.pow(0.5, dt);
      } else {
        p.turnT -= dt;
        if (p.turnT <= 0) { p.turnT = 2 + Math.random() * 4; p.angle += (Math.random() - 0.5) * 1.6; }
        const nx = p.x + Math.cos(p.angle) * p.speed * dt;
        const ny = p.y + Math.sin(p.angle) * p.speed * dt;
        // stay on sidewalk: if next step leaves it, turn around
        if (w.isSidewalk(nx, ny)) { p.x = nx; p.y = ny; }
        else p.angle += Math.PI * (0.7 + Math.random() * 0.6);
      }
      p.x = Math.max(4, Math.min(WORLD - 4, p.x));
      p.y = Math.max(4, Math.min(WORLD - 4, p.y));
      p.phase += dt * 9;
    }
    // panic when player shoots nearby
    // (triggered from shots system)
  }

  panicNear(x, y, r = 220) {
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < r) {
        const a = Math.atan2(p.y - y, p.x - x) + (Math.random() - 0.5);
        p.panic = 2.2;
        p.vx = Math.cos(a) * 160; p.vy = Math.sin(a) * 160;
        p.x += Math.cos(a) * 3; p.y += Math.sin(a) * 3;
      }
    }
  }

  driveLoop(c, dt, w) {
    // steer toward current waypoint
    const wp = c.loop[c.wp];
    const dx = wp.x - c.x, dy = wp.y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30) { c.wp = (c.wp + 1) % c.loop.length; }
    const target = Math.atan2(dy, dx);
    let da = ((target - c.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da * 3 * dt));
    // simple speed control; brake if a car is close ahead
    let sp = c.speed;
    const fx = Math.cos(c.angle), fy = Math.sin(c.angle);
    for (const o of this.cars) {
      if (o === c || o.dead) continue;
      const ox = o.x - c.x, oy = o.y - c.y;
      const ahead = ox * fx + oy * fy;
      const side = Math.abs(-ox * fy + oy * fx);
      if (ahead > 0 && ahead < 70 && side < 22) { sp = 0; break; }
    }
    if (sp === 0 && c.honk <= 0) c.honk = 1.5;
    c.honk -= dt;
    c.vx = Math.cos(c.angle) * sp; c.vy = Math.sin(c.angle) * sp;
    c.x += c.vx * dt; c.y += c.vy * dt;
    // keep to world
    c.x = Math.max(10, Math.min(WORLD - 10, c.x));
    c.y = Math.max(10, Math.min(WORLD - 10, c.y));
  }

  // player car collision effects
  carHits(c) {
    const player = this.game.player;
    // pedestrians
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < 26 && Math.hypot(c.vx, c.vy) > 60) {
        p.dead = true; p.deadT = 0;
        const sp = Math.hypot(c.vx, c.vy);
        p.x += Math.cos(c.angle) * 14; p.y += Math.sin(c.angle) * 14;
        this.game.fx.sparks(p.x, p.y, 10, '#ff9a7a');
        this.game.sfx.beep('hit');
        this.game.shake = 8;
        player.addWanted(2);
      }
    }
    // traffic cars: bounce + wanted if hard hit
    for (const o of this.cars) {
      if (o === c || o.dead || o.driver === 'player') continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 40) {
        const sp = Math.hypot(c.vx, c.vy);
        const nx = dx / (d || 1), ny = dy / (d || 1);
        o.x += nx * (40 - d) * 0.6; o.y += ny * (40 - d) * 0.6;
        c.x -= nx * (40 - d) * 0.4; c.y -= ny * (40 - d) * 0.4;
        c.vx *= 0.7; c.vy *= 0.7;
        if (sp > 140) {
          this.game.fx.sparks((c.x + o.x) / 2, (c.y + o.y) / 2, 12, '#ffd27a');
          this.game.sfx.beep('crash');
          player.damage(Math.min(10, sp / 30));
          if (player.wanted < 1) player.addWanted(1);
        }
      }
    }
  }

  draw(g, view) {
    // peds first (under cars)
    for (const p of this.peds) {
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      g.save(); g.translate(p.x, p.y);
      if (p.dead) {
        g.rotate(p.angle);
        g.fillStyle = '#7a6a5a'; g.fillRect(-12, -5, 24, 10);
        g.restore(); continue;
      }
      const swing = Math.sin(p.phase) * 4;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 3, 9, 5, 0, 0, 7); g.fill();
      g.rotate(p.angle + Math.PI / 2);
      g.strokeStyle = '#2a2d3a'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-3, 3); g.lineTo(-3 + swing * 0.6, 10); g.stroke();
      g.beginPath(); g.moveTo(3, 3); g.lineTo(3 - swing * 0.6, 10); g.stroke();
      g.fillStyle = p.panic > 0 ? '#e0b0b0' : p.color;
      g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
      g.fillStyle = '#e8c39e'; g.beginPath(); g.arc(0, -2, 4.5, 0, 7); g.fill();
      g.restore();
    }
    // cars
    for (const c of this.cars) {
      if (c.x < view.x0 - 40 || c.x > view.x1 + 40 || c.y < view.y0 - 40 || c.y > view.y1 + 40) continue;
      this.drawCar(g, c, c.x, c.y, c.angle, c.color);
    }
  }

  drawCar(g, c, x, y, angle, color) {
    g.save(); g.translate(x, y); g.rotate(angle);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 4, 18, 9, 0, 0, 7); g.fill();
    g.fillStyle = color; g.fillRect(-17, -8, 34, 16);
    g.fillStyle = 'rgba(20,26,38,0.9)'; g.fillRect(-6, -6, 12, 12); // cabin
    g.fillStyle = '#ffe9a8'; g.fillRect(13, -7, 3, 4); g.fillRect(13, 3, 3, 4); // headlights
    g.fillStyle = '#c03434'; g.fillRect(-16, -7, 2, 4); g.fillRect(-16, 3, 2, 4);
    g.restore();
  }
}
