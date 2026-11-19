// shots.js — bullets, hit resolution, wanted escalation
export class Shots {
  constructor(game) {
    this.game = game;
    this.bullets = [];
  }

  spawn(x, y, angle, owner) {
    this.bullets.push({
      x, y, dx: Math.cos(angle), dy: Math.sin(angle),
      speed: 900, owner, life: 0.6, t: 0,
    });
    this.game.npcs.panicNear(x, y, 240);
    if (owner === 'player') this.game.player.addWanted(0); // no-op hook, kept for clarity
  }

  update(dt) {
    const g = this.game;
    for (const b of this.bullets) {
      b.t += dt;
      const px = b.x, py = b.y;
      b.x += b.dx * b.speed * dt;
      b.y += b.dy * b.speed * dt;
      // walls
      const c = g.world.collide(b.x, b.y, 2);
      if (c.hit) {
        g.fx.sparks(b.x, b.y, 5, '#cfd6dd');
        b.life = 0; continue;
      }
      if (b.owner === 'player') {
        // hit peds
        for (const p of g.npcs.peds) {
          if (p.dead) continue;
          if (Math.hypot(p.x - b.x, p.y - b.y) < 12) {
            p.dead = true; p.deadT = 0;
            g.fx.sparks(p.x, p.y, 12, '#ff9a7a');
            g.sfx.beep('hit');
            g.player.addWanted(2);
            b.life = 0; break;
          }
        }
        // hit police cars
        for (const pc of g.police.cars) {
          if (Math.hypot(pc.x - b.x, pc.y - b.y) < 24) {
            g.fx.sparks(b.x, b.y, 8, '#ffe08a');
            g.sfx.beep('hit');
            g.player.addWanted(1);
            b.life = 0; break;
          }
        }
      } else if (b.owner === 'police') {
        const p = g.player;
        if (Math.hypot(p.x - b.x, p.y - b.y) < (p.inCar ? 24 : 13)) {
          p.damage(9, 'police');
          g.fx.sparks(b.x, b.y, 8, '#ffb0a0');
          b.life = 0;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.t < b.life);
  }

  draw(g) {
    for (const b of this.bullets) {
      g.strokeStyle = b.owner === 'player' ? '#fff0b0' : '#ff9090';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(b.x, b.y);
      g.lineTo(b.x - b.dx * 16, b.y - b.dy * 16);
      g.stroke();
    }
  }
}
