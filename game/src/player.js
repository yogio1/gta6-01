// player.js — on-foot movement, car jacking/driving, combat, stats
import { CFG } from './config.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.angle = -Math.PI / 2;     // facing
    this.viewAngle = 0;            // camera rotation (north-up-ish feel: 0)
    this.walkPhase = 0;
    this.moving = false;
    this.health = CFG.maxHealth;
    this.money = 0;
    this.wanted = 0;
    this.heat = 0;
    this.inCar = null;
    this.car = null;
    this.aimX = 0; this.aimY = 0;
    this.punchCd = 0; this.shootCd = 0;
    this.punchAnim = 0;
    this.reload = 0;
    this.hurtFlash = 0;
    this.cars = [];                // traffic + police car objects managed by npc/police
  }

  spawnAt(pt) {
    this.x = pt.x; this.y = pt.y;
    this.health = CFG.maxHealth;
    this.wanted = 0; this.heat = 0;
    this.inCar = null; this.car = null;
  }

  addMoney(n) { this.money = Math.max(0, this.money + n); }

  addWanted(n) {
    this.wanted = Math.min(6, this.wanted + n);
    this.heat = CFG.heatWindow + this.wanted * 4;
    this.game.sfx.beep('wanted');
    this.game.hud.toast(`WANTED ${'★'.repeat(this.wanted)}`, '#ff6b6b');
  }

  damage(n, src) {
    if (this.health <= 0) return;
    this.health -= n;
    this.hurtFlash = 0.35;
    this.game.shake = Math.min(14, this.game.shake + n * 0.4);
    if (src === 'car' && this.wanted < 2) this.addWanted(1);
  }

  nearestCar(maxDist = 62) {
    let best = null, bd = maxDist * maxDist;
    for (const c of this.game.npcs.cars) {
      if (c.dead) continue;
      const d = (c.x - this.x) ** 2 + (c.y - this.y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    for (const c of this.game.police.cars) {
      const d = (c.x - this.x) ** 2 + (c.y - this.y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  enterCar(car) {
    if (!car) return false;
    this.inCar = car; this.car = car;
    car.driver = 'player'; car.ai = false;
    car.vx = car.vx || 0; car.vy = car.vy || 0;
    this.game.sfx.beep('steal');
    this.game.hud.toast('Hot-wired! W/S drive, A/D steer, F exit', '#ffe08a');
    if (car.kind === 'police') this.addWanted(1);
    return true;
  }

  exitCar() {
    if (!this.inCar) return;
    const c = this.inCar;
    // step out to the side, avoiding walls
    let ox = c.x + Math.cos(c.angle + Math.PI / 2) * 30;
    let oy = c.y + Math.sin(c.angle + Math.PI / 2) * 30;
    const fixed = this.game.world.collide(ox, oy, CFG.playerR);
    this.x = fixed.x; this.y = fixed.y;
    c.driver = null; c.ai = false; c.vx = 0; c.vy = 0; c.brake = true;
    this.inCar = null; this.car = null;
    this.angle = c.angle + Math.PI / 2;
    this.game.sfx.beep('click');
  }

  // --- per frame ---
  update(dt) {
    const inp = this.game.input;
    this.punchCd = Math.max(0, this.punchCd - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.punchAnim = Math.max(0, this.punchAnim - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    // aim toward mouse world position
    const m = inp.mouseWorld(this.game.cam);
    this.aimX = m.x; this.aimY = m.y;
    const aimAngle = Math.atan2(m.y - this.y, m.x - this.x);

    if (this.inCar) this.updateDriving(dt, inp, aimAngle);
    else this.updateOnFoot(dt, inp, aimAngle);

    if (inp.wasPressed('KeyF')) {
      if (this.inCar) this.exitCar();
      else {
        const c = this.nearestCar(64);
        if (c) this.enterCar(c);
        else this.game.hud.toast('No car nearby', '#aaa');
      }
    }

    // combat
    if (!this.inCar) {
      if (inp.wasPressed('Space') && this.punchCd <= 0) this.punch();
      if (inp.mouseDown(0) && this.shootCd <= 0) this.shoot();
    } else if (inp.wasPressed('Space')) {
      this.game.hud.toast('Exit the car to fight', '#aaa');
    }
  }

  updateOnFoot(dt, inp, aimAngle) {
    let ix = 0, iy = 0;
    if (inp.down('KeyW') || inp.down('ArrowUp')) iy -= 1;
    if (inp.down('KeyS') || inp.down('ArrowDown')) iy += 1;
    if (inp.down('KeyA') || inp.down('ArrowLeft')) ix -= 1;
    if (inp.down('KeyD') || inp.down('ArrowRight')) ix += 1;
    const len = Math.hypot(ix, iy);
    this.moving = len > 0;
    if (len > 0) { ix /= len; iy /= len; }
    const sp = CFG.walkSpeed;
    this.vx = ix * sp; this.vy = iy * sp;
    if (this.moving) this.angle = Math.atan2(iy, ix);
    else if (this.aimX || this.aimY) this.angle = aimAngle;

    let nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    const w = this.game.world;
    const c1 = w.collide(nx, this.y, CFG.playerR);
    nx = c1.x;
    const c2 = w.collide(nx, ny, CFG.playerR);
    nx = c2.x; ny = c2.y;
    const cl = w.clamp(nx, ny, CFG.playerR);
    this.x = cl.x; this.y = cl.y;

    this.walkPhase += dt * (this.moving ? 11 : 0);
  }

  updateDriving(dt, inp, aimAngle) {
    const c = this.inCar;
    let acc = 0;
    if (inp.down('KeyW') || inp.down('ArrowUp')) acc = CFG.carAccel;
    if (inp.down('KeyS') || inp.down('ArrowDown')) acc = -CFG.carBrake;
    let steer = 0;
    if (inp.down('KeyA') || inp.down('ArrowLeft')) steer -= 1;
    if (inp.down('KeyD') || inp.down('ArrowRight')) steer += 1;

    const speed = Math.hypot(c.vx, c.vy);
    const fwdX = Math.cos(c.angle), fwdY = Math.sin(c.angle);
    let fwd = c.vx * fwdX + c.vy * fwdY;
    fwd += acc * dt;
    fwd = Math.max(CFG.carMaxRev, Math.min(CFG.carMaxFwd, fwd));
    if (acc === 0) fwd *= Math.pow(0.35, dt); // rolling friction
    // steering scales with speed, reversed in reverse
    const turn = CFG.carTurn * steer * dt * Math.min(1, Math.abs(fwd) / 90) * (fwd < 0 ? -1 : 1);
    c.angle += turn;
    c.vx = Math.cos(c.angle) * fwd + Math.cos(c.angle + Math.PI / 2) * 0;
    c.vy = Math.sin(c.angle) * fwd;

    const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
    const wx = this.game.world;
    const r = 22;
    const cc = wx.collide(nx, ny, r);
    if (cc.hit) {
      const impact = Math.hypot(c.vx, c.vy);
      c.vx *= -0.25; c.vy *= -0.25;
      if (impact > 120) { this.game.sfx.beep('crash'); this.game.shake = 8; this.damage(Math.min(18, impact / 22)); }
    }
    c.x = cc.x; c.y = cc.y;
    const cl = wx.clamp(c.x, c.y, r); c.x = cl.x; c.y = cl.y;
    this.x = c.x; this.y = c.y;
    this.vx = c.vx; this.vy = c.vy;
    this.angle = c.angle;
    // car hits pedestrians / other cars
    this.game.npcs.carHits(c);
  }

  punch() {
    this.punchCd = 0.38;
    this.punchAnim = 0.22;
    this.game.sfx.beep('punch');
    const reach = 34;
    for (const ped of this.game.npcs.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - this.x, ped.y - this.y);
      if (d < reach) {
        const a = Math.atan2(ped.y - this.y, ped.x - this.x);
        const da = Math.abs(((a - this.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (da < 1.1) {
          ped.knock(this.angle, 240);
          this.game.fx.sparks(ped.x, ped.y, 8, '#ffd27a');
          if (ped.dead) this.addWanted(1);
        }
      }
    }
  }

  shoot() {
    this.shootCd = 0.24;
    const a = Math.atan2(this.aimY - this.y, this.aimX - this.x);
    this.angle = a;
    const mx = this.x + Math.cos(a) * 18, my = this.y + Math.sin(a) * 18;
    this.game.shots.spawn(mx, my, a, 'player');
    this.game.fx.sparks(mx, my, 4, '#fff2a8');
    this.game.sfx.beep('shoot');
    this.game.shake = Math.min(6, this.game.shake + 2);
    this.addWanted(0); // shooting alone doesn't raise; hits do
  }

  draw(g) {
    if (this.inCar) return; // car draws itself
    const swing = Math.sin(this.walkPhase) * (this.moving ? 1 : 0);
    g.save();
    g.translate(this.x, this.y);
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 4, 12, 7, 0, 0, 7); g.fill();
    g.rotate(this.angle + Math.PI / 2);
    // legs
    g.strokeStyle = '#2a2d3a'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-4, 4); g.lineTo(-4 + swing * 5, 13); g.stroke();
    g.beginPath(); g.moveTo(4, 4); g.lineTo(4 - swing * 5, 13); g.stroke();
    // torso
    g.fillStyle = this.hurtFlash > 0 ? '#ff8a8a' : '#3c6ea5';
    g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill();
    g.fillStyle = '#e8c39e'; g.beginPath(); g.arc(0, -3, 6, 0, 7); g.fill();
    // arm / gun
    const pa = this.punchAnim > 0 ? 1 : 0;
    g.strokeStyle = '#e8c39e'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(2, 2); g.lineTo(9 + pa * 8, -2 - pa * 4); g.stroke();
    g.fillStyle = '#20232b'; g.fillRect(6, -6, 4, 9);
    g.restore();
  }

  serialize() {
    return { x: this.x, y: this.y, health: this.health, money: this.money, angle: this.angle };
  }
  deserialize(d) {
    if (!d) return;
    this.x = d.x; this.y = d.y; this.health = d.health; this.money = d.money; this.angle = d.angle;
    this.inCar = null; this.car = null;
  }
}
