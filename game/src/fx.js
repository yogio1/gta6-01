// fx.js — particle sparks and simple effects
export class Fx {
  constructor() {
    this.parts = [];
  }

  sparks(x, y, n, color = '#ffd27a') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 180;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.4, t: 0, color, r: 1 + Math.random() * 2,
      });
    }
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }

  update(dt) {
    for (const p of this.parts) {
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt);
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
  }

  draw(g) {
    for (const p of this.parts) {
      const a = 1 - p.t / p.life;
      g.globalAlpha = a;
      g.fillStyle = p.color;
      g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    g.globalAlpha = 1;
  }
}
