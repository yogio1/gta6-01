// hud.js — HUD, minimap, title, pause and death screens
import { WORLD } from './world.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.toasts = [];
    this.missionTitle = '';
    this.missionText = '';
    this.flashT = 0;
  }

  setMission(title, text) { this.missionTitle = title; this.missionText = text; }

  toast(text, color = '#fff') {
    this.toasts.push({ text, color, t: 3.2 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  update(dt) {
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
  }

  draw(g, game) {
    const p = game.player;

    // top-left: health + money
    g.fillStyle = 'rgba(8,10,16,0.72)';
    g.fillRect(18, 16, 250, 74);
    g.fillStyle = '#20262f'; g.fillRect(30, 30, 200, 16);
    const hp = Math.max(0, p.health) / 100;
    g.fillStyle = hp > 0.35 ? '#63c76a' : '#e05a5a';
    g.fillRect(30, 30, 200 * hp, 16);
    g.strokeStyle = '#0008'; g.strokeRect(30, 30, 200, 16);
    g.font = 'bold 20px monospace'; g.fillStyle = '#8fd98f'; g.textAlign = 'left';
    g.fillText('$' + p.money, 30, 74);

    // wanted stars (top-right)
    g.textAlign = 'right';
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i < p.wanted ? '#ffd23f' : 'rgba(255,255,255,0.15)';
      g.font = '26px monospace';
      g.fillText('★', 1262 - i * 30, 42);
    }
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = '12px monospace';
    g.fillText('WANTED', 1262, 62);

    // mission text (top-center)
    if (game.missions.started) {
      g.textAlign = 'center';
      g.fillStyle = 'rgba(8,10,16,0.66)';
      g.fillRect(390, 14, 500, 44);
      g.fillStyle = '#ffd23f'; g.font = 'bold 15px monospace';
      g.fillText(this.missionTitle || 'MISSION', 640, 34);
      g.fillStyle = '#cfe3ef'; g.font = '13px monospace';
      g.fillText(this.missionText || '', 640, 52);
    }

    // toasts bottom-center
    g.textAlign = 'center';
    let ty = 690;
    for (const t of this.toasts) {
      g.globalAlpha = Math.min(1, t.t / 0.8);
      g.fillStyle = t.color; g.font = 'bold 15px monospace';
      g.fillText(t.text, 640, ty);
      ty -= 22;
    }
    g.globalAlpha = 1;

    // rotating minimap bottom-right
    this.drawMinimap(g, game);
  }

  drawMinimap(g, game) {
    const R = 78, cx = 1172, cy = 616;
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    g.fillStyle = '#141920'; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    // rotate map around player, north-up otherwise
    g.save();
    g.translate(cx, cy);
    g.rotate(-game.cam.angle);
    const scale = R / 620; // show ~620px radius of world
    const wx = game.player.x, wy = game.player.y;
    g.save();
    g.translate(-wx * scale, -wy * scale);
    // roads
    g.strokeStyle = '#3d4552'; g.lineWidth = 10 * scale * 4;
    const PITCHW = WORLD / 15;
    g.beginPath();
    for (let i = 0; i <= 15; i++) {
      const c = i * PITCHW;
      g.moveTo((wx - 700) * scale, c * scale); g.lineTo((wx + 700) * scale, c * scale);
      g.moveTo(c * scale, (wy - 700) * scale); g.lineTo(c * scale, (wy + 700) * scale);
    }
    g.stroke();
    // buildings dots
    g.fillStyle = '#5b6472';
    for (const b of game.world.buildings) {
      const bx = b.x * scale, by = b.y * scale;
      if (Math.abs(bx - wx * scale) > 800 || Math.abs(by - wy * scale) > 800) continue;
      g.fillRect(bx, by, b.w * scale, b.h * scale);
    }
    // mission marker
    const mk = game.missions.currentMarker();
    if (mk) {
      g.fillStyle = '#7fd8ff';
      const dx = (mk.x - wx) * scale, dy = (mk.y - wy) * scale;
      g.beginPath(); g.arc(dx, dy, 5, 0, 7); g.fill();
    }
    // police dots
    g.fillStyle = '#ff5f5f';
    for (const c of game.police.cars) {
      g.beginPath(); g.arc((c.x - wx) * scale, (c.y - wy) * scale, 3, 0, 7); g.fill();
    }
    g.restore();
    g.restore();
    // player arrow at center
    g.fillStyle = '#fff';
    g.save(); g.translate(cx, cy); g.rotate(game.cam.angle);
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
    g.restore();
    g.strokeStyle = '#0e1218'; g.lineWidth = 4;
    g.beginPath(); g.arc(cx, cy, R + 2, 0, 7); g.stroke();
  }

  drawTitle(g, game) {
    g.fillStyle = '#0b0d14'; g.fillRect(0, 0, 1280, 720);
    // animated skyline backdrop
    const t = performance.now() / 1000;
    for (let i = 0; i < 26; i++) {
      const bw = 60 + ((i * 37) % 70), bh = 120 + ((i * 53) % 220);
      const x = ((i * 97) % 1280);
      g.fillStyle = i % 2 ? '#141a24' : '#101620';
      g.fillRect(x, 720 - bh - 40, bw, bh + 40);
      g.fillStyle = 'rgba(255,220,140,' + (0.25 + 0.2 * Math.sin(t + i)) + ')';
      for (let wy = 720 - bh - 30; wy < 660; wy += 24)
        for (let wx = x + 8; wx < x + bw - 10; wx += 20)
          if ((wx * 7 + wy * 11 + i) % 4 < 2) g.fillRect(wx, wy, 8, 10);
    }
    g.fillStyle = 'rgba(10,10,20,0.55)'; g.fillRect(0, 0, 1280, 720);
    g.textAlign = 'center';
    g.fillStyle = '#ffd23f';
    g.font = 'bold 64px monospace';
    g.fillText('PALM COAST STORIES', 640, 220);
    g.fillStyle = '#e8f1f7'; g.font = '18px monospace';
    g.fillText('an original open-world crime playground', 640, 258);
    // controls box
    g.fillStyle = 'rgba(12,16,24,0.85)'; g.fillRect(390, 300, 500, 250);
    g.strokeStyle = '#2c3644'; g.strokeRect(390, 300, 500, 250);
    g.fillStyle = '#cfe3ef'; g.font = '15px monospace'; g.textAlign = 'left';
    const lines = [
      'WASD / arrows ....... walk · drive',
      'F .................. steal or leave a car',
      'MOUSE .............. aim',
      'LEFT CLICK ......... fire pistol',
      'SPACE .............. punch',
      'ESC or P ........... pause / save / load',
    ];
    lines.forEach((l, i) => g.fillText(l, 418, 338 + i * 30));
    g.textAlign = 'center';
    const blink = Math.sin(t * 4) > -0.3;
    if (blink) {
      g.fillStyle = '#ffd23f'; g.font = 'bold 22px monospace';
      g.fillText('PRESS ENTER TO PLAY', 640, 590);
    }
    if (game.hasSave()) {
      g.fillStyle = '#8fa8bd'; g.font = '13px monospace';
      g.fillText('(a saved game exists — press L to load it)', 640, 622);
    }
    g.fillStyle = '#5c6a7a'; g.font = '12px monospace';
    g.fillText('original fan-made mini-game — no Rockstar assets', 640, 690);
    game.titleFlash = t;
    // input handled in main loop via keydown below
  }

  drawPause(g, game) {
    g.fillStyle = 'rgba(4,6,10,0.72)'; g.fillRect(0, 0, 1280, 720);
    g.textAlign = 'center';
    g.fillStyle = '#ffd23f'; g.font = 'bold 42px monospace';
    g.fillText('PAUSED', 640, 250);
    g.fillStyle = '#cfe3ef'; g.font = '16px monospace';
    g.fillText('ESC / P — resume      S — save      L — load      Q — title', 640, 320);
    g.fillStyle = '#8fa8bd'; g.font = '13px monospace';
    g.fillText(`money $${game.player.money} · wanted ${'★'.repeat(game.player.wanted) || '—'}`, 640, 360);
  }

  drawDead(g, game) {
    g.fillStyle = 'rgba(60,4,8,0.6)'; g.fillRect(0, 0, 1280, 720);
    g.textAlign = 'center';
    g.fillStyle = '#ff9a9a'; g.font = 'bold 52px monospace';
    g.fillText('WASTED', 640, 320);
    g.fillStyle = '#e8c9c9'; g.font = '17px monospace';
    g.fillText('ENTER — respawn at the precinct (keep your money)', 640, 380);
  }
}
