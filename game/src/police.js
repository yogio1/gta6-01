// police.js — wanted-level driven police pursuit
import { CFG } from './config.js';
import { WORLD } from './world.js';

export class Police {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.spawnT = 0;
  }

  syncToWanted() {
    const want = Math.min(6, this.game.player.wanted);
    // desired number of active cop cars
    const desired = want === 0 ? 0 : Math.min(want + 1, 5);
    if (this.cars.length > desired) this.cars.length = desired;
    this.spawnT = Math.min(this.spawnT, 1.5);
  }

  spawnCar() {
    const p = this.game.player;
    // spawn on a road near the player, off-screen
    const a = Math.random() * Math.PI * 2;
    const dist = 480 + Math.random() * 160;
    let x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
    x = Math.max(40, Math.min(WORLD - 40, x));
    y = Math.max(40, Math.min(WORLD - 40, y));
    this.cars.push({
      x, y, angle: a + Math.PI, vx: 0, vy: 0,
      speed: 200 + this.game.player.wanted * 18,
      color: '#e8e8ec', kind: 'police', ai: true, dead: false,
      shootT: 2 + Math.random() * 2, w: 36, h: 16, ram: 0,
    });
    this.game.hud.toast('Police unit dispatched', '#8ab6ff');
    this.game.sfx.beep('siren');
  }

  update(dt) {
    const want = this.game.player.wanted;
    const desired = want === 0 ? 0 : Math.min(want + 1, 5);
    if (this.cars.length < desired) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnT = 2.5; this.spawnCar(); }
    }
    const p = this.game.player;
    for (const c of this.cars) {
      const dx = p.x - c.x, dy = p.y - c.y;
      const d = Math.hypot(dx, dy);
      const target = Math.atan2(dy, dx);
      let da = ((target - c.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      c.angle += Math.max(-3 * dt, Math.min(3 * dt, da * 4 * dt));
      // slow near player so they don't orbit forever
      const sp = d < 90 ? 90 : c.speed;
      c.vx = Math.cos(c.angle) * sp; c.vy = Math.sin(c.angle) * sp;
      const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
      const cc = this.game.world.collide(nx, ny, 20);
      if (cc.hit) { c.vx *= 0.4; c.vy *= 0.4; }
      c.x = cc.x; c.y = cc.y;
      // ram damage
      if (d < 34) {
        c.ram += dt;
        if (c.ram > 0.5) {
          c.ram = 0;
          if (p.inCar) {
            p.damage(6, 'car');
            this.game.fx.sparks(p.x, p.y, 8, '#ffd27a');
            this.game.sfx.beep('crash');
          } else {
            p.damage(12, 'car');
            this.game.shake = 10;
          }
        }
      } else c.ram = 0;
      // officers shoot at wanted >= 3
      if (want >= 3 && d < 380) {
        c.shootT -= dt;
        if (c.shootT <= 0) {
          c.shootT = 1.6 + Math.random();
          const aim = Math.atan2(p.y - c.y, p.x - c.x) + (Math.random() - 0.5) * 0.22;
          this.game.shots.spawn(c.x, c.y, aim, 'police');
          this.game.sfx.beep('shootFar');
        }
      }
    }
  }

  draw(g, view) {
    for (const c of this.cars) {
      if (c.x < view.x0 - 40 || c.x > view.x1 + 40 || c.y < view.y0 - 40 || c.y > view.y1 + 40) continue;
      g.save(); g.translate(c.x, c.y); g.rotate(c.angle);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 4, 19, 9, 0, 0, 7); g.fill();
      g.fillStyle = '#e8e8ec'; g.fillRect(-18, -8, 36, 16);
      g.fillStyle = '#1b2b4d'; g.fillRect(-6, -6, 12, 12);
      // light bar flashing
      const t = (performance.now() / 150) % 2;
      g.fillStyle = t < 1 ? '#ff4040' : '#4040ff';
      g.fillRect(-3, -8, 6, 3);
      g.restore();
    }
  }
}
