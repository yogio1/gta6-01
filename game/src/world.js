// world.js — city generation, tile queries, collision, drawing
import { CFG } from './config.js';

const G = CFG.grid, BS = CFG.blockSize, RW = CFG.roadW, SW = CFG.sidewalk;
// pitch = distance between road centerlines
const PITCH = BS + RW;
export const WORLD = PITCH * G + RW; // +RW so last road exists at far edge

export class World {
  constructor(rng) {
    this.rng = rng;
    this.blocks = [];   // {bx,by,x0,y0, buildings:[{x,y,w,h,color,h}], parks:[], props:[]}
    this.buildings = []; // flat list of solid rects
    this.generate();
  }

  generate() {
    let seedN = 1;
    for (let by = 0; by < G; by++) {
      for (let bx = 0; bx < G; bx++) {
        // block origin (top-left of sidewalk area)
        const x0 = bx * PITCH + RW, y0 = by * PITCH + RW;
        const blk = { bx, by, x0, y0, buildings: [], trees: [] };
        const inner = BS - 2 * SW;
        const r = this.rng;
        const kind = r.pick(['dense', 'offices', 'park', 'low']);
        if (kind === 'park') {
          blk.park = { x: x0 + SW, y: y0 + SW, w: inner, h: inner };
        } else {
          // subdivide inner area into 1-4 buildings with gaps (alleys)
          const cols = r.int(1, 2), rows = r.int(1, 2);
          const gw = Math.floor(inner / cols), gh = Math.floor(inner / rows);
          for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
            if (r.chance(0.12)) continue; // courtyard gap
            const pad = 10;
            const bx0 = x0 + SW + cx * gw + pad, by0 = y0 + SW + cy * gh + pad;
            const bw = gw - 2 * pad, bh = gh - 2 * pad;
            if (bw < 30 || bh < 30) continue;
            const shades = kind === 'offices' ? ['#5d6d84', '#6b7a90', '#4e5d73'] : ['#7a6a58', '#8a7462', '#6e5f50', '#93826e'];
            const b = { x: bx0, y: by0, w: bw, h: bh, color: r.pick(shades), id: seedN++ };
            blk.buildings.push(b);
            this.buildings.push(b);
          }
        }
        // street trees/props on sidewalk corners
        for (let i = 0; i < 4; i++) {
          if (r.chance(0.5)) blk.trees.push({ x: x0 + SW + r.int(0, inner), y: y0 + SW + (i < 2 ? 4 : inner - 4) * (i % 2 ? 1 : 0) });
        }
        this.blocks.push(blk);
      }
    }
    // parked cars along some roads
    this.parked = [];
    for (let i = 0; i < 14; i++) {
      const lane = this.rng.int(0, 3);
      const seg = this.rng.int(1, G - 2);
      if (lane < 2) { // horizontal road y centerline
        const y = seg * PITCH + RW / 2 + (lane === 0 ? -18 : 18);
        const x = this.rng.range(RW + 40, WORLD - RW - 40);
        this.parked.push({ x, y, angle: Math.PI / 2 * (lane === 0 ? 1 : -1), color: '#446', w: 34, h: 16 });
      } else {
        const x = seg * PITCH + RW / 2 + (lane === 2 ? -18 : 18);
        const y = this.rng.range(RW + 40, WORLD - RW - 40);
        this.parked.push({ x, y, angle: lane === 2 ? 0 : Math.PI, color: '#446', w: 34, h: 16 });
      }
    }
  }

  spawnPoint() {
    // sidewalk just north of central block
    const c = Math.floor(G / 2);
    return { x: c * PITCH + RW + BS / 2, y: c * PITCH - SW - 8 };
  }

  // --- queries ---
  isRoad(x, y) {
    const mx = ((x % PITCH) + PITCH) % PITCH, my = ((y % PITCH) + PITCH) % PITCH;
    return mx < RW || my < RW;
  }
  isSidewalk(x, y) {
    if (this.isRoad(x, y)) return false;
    const mx = ((x % PITCH) + PITCH) % PITCH, my = ((y % PITCH) + PITCH) % PITCH;
    return mx < RW + SW || my < RW + SW || mx > PITCH - SW || my > PITCH - SW;
  }

  solids(x0, y0, x1, y1) {
    const out = [];
    for (const b of this.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      out.push(b);
    }
    return out;
  }

  // circle vs building rects; returns corrected position
  collide(px, py, r) {
    const near = this.solids(px - r - 4, py - r - 4, px + r + 4, py + r + 4);
    let x = px, y = py, hit = false;
    for (const b of near) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      let dx = x - cx, dy = y - cy;
      let d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 === 0) { // inside: push out along smallest axis
          const l = x - b.x, rr = b.x + b.w - x, t = y - b.y, bt = b.y + b.h - y;
          const m = Math.min(l, rr, t, bt);
          if (m === l) x = b.x - r; else if (m === rr) x = b.x + b.w + r;
          else if (m === t) y = b.y - r; else y = b.y + b.h + r;
        } else {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r; y = cy + (dy / d) * r;
        }
      }
    }
    return { x, y, hit };
  }

  // world bounds clamp
  clamp(x, y, r) {
    return {
      x: Math.max(r, Math.min(WORLD - r, x)),
      y: Math.max(r, Math.min(WORLD - r, y)),
    };
  }

  // --- traffic lanes: return waypoints along a rectangular loop for traffic cars ---
  laneCenter(i) { return RW / 2 + (i === 0 ? -18 : 18) + i * 0; } // horizontal offsets
  loopFor(rng) {
    const bx = rng.int(0, G - 2), by = rng.int(0, G - 2);
    const w = rng.int(1, 3), h = rng.int(1, 3);
    const x0 = bx * PITCH + RW / 2, y0 = by * PITCH + RW / 2;
    const x1 = (bx + w) * PITCH + RW / 2, y1 = (by + h) * PITCH + RW / 2;
    // clockwise loop using right-hand traffic: go east on top lane? keep simple loop corners
    return [
      { x: x0, y: y0 - 18 }, { x: x1, y: y0 - 18 },
      { x: x1, y: y1 + 18 }, { x: x0, y: y1 + 18 },
    ];
  }

  dayTint(t) {
    // t in [0, dayLength); phases: 0-0.35 day, 0.35-0.5 dusk, 0.5-0.85 night, 0.85-1 dawn
    const f = t / CFG.dayLength;
    let a = 0, col = [10, 12, 40];
    if (f < 0.35) a = 0;
    else if (f < 0.5) { a = (f - 0.35) / 0.15 * 0.45; col = [30, 10, 50]; }
    else if (f < 0.85) a = 0.45;
    else { a = (1 - (f - 0.85) / 0.15) * 0.45; col = [40, 20, 50]; }
    return { r: col[0], g: col[1], b: col[2], a, night: f > 0.5 && f < 0.85 };
  }

  // --- drawing ---
  draw(g, view, time) {
    const tint = this.dayTint(time);
    g.fillStyle = '#2b2d33'; // asphalt base
    g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

    // lane markings on roads
    g.strokeStyle = 'rgba(210,200,120,0.5)';
    g.lineWidth = 3;
    g.setLineDash([22, 26]);
    g.beginPath();
    for (let i = 0; i <= G; i++) {
      const c = i * PITCH + RW / 2;
      g.moveTo(view.x0, c); g.lineTo(view.x1, c);
      g.moveTo(c, view.y0); g.lineTo(c, view.y1);
    }
    g.stroke();
    g.setLineDash([]);

    // blocks: sidewalk ring + interior
    for (const blk of this.blocks) {
      const { x0, y0 } = blk;
      if (x0 > view.x1 || y0 > view.y1 || x0 + BS < view.x0 || y0 + BS < view.y0) continue;
      g.fillStyle = '#9a978f'; // sidewalk
      g.fillRect(x0, y0, BS, BS);
      g.fillStyle = blk.park ? '#3f5a3a' : '#3a3d44'; // ground
      g.fillRect(x0 + SW, y0 + SW, BS - 2 * SW, BS - 2 * SW);
      if (blk.park) {
        g.fillStyle = '#2f462c';
        g.fillRect(x0 + SW + inner0(), y0 + SW + inner0(), 40, 40); // pond-ish
        for (const tr of blk.trees) {
          g.fillStyle = '#1e3320'; g.beginPath(); g.arc(tr.x, tr.y, 14, 0, 7); g.fill();
          g.fillStyle = '#5a4632'; g.fillRect(tr.x - 3, tr.y, 6, 10);
        }
      }
      for (const b of blk.buildings) {
        g.fillStyle = tint.night ? '#20242e' : b.color;
        g.fillRect(b.x, b.y, b.w, b.h);
        // windows
        g.fillStyle = tint.night ? 'rgba(255,220,130,0.85)' : 'rgba(180,200,220,0.35)';
        for (let wy = b.y + 14; wy < b.y + b.h - 10; wy += 26) {
          for (let wx = b.x + 14; wx < b.x + b.w - 10; wx += 30) {
            if ((wx * 7 + wy * 13 + b.id) % 5 < 3) g.fillRect(wx, wy, 12, 9);
          }
        }
        // roof edge
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
        g.strokeRect(b.x, b.y, b.w, b.h);
      }
      if (!blk.park) {
        for (const tr of blk.trees) {
          g.fillStyle = '#2c4a2e'; g.beginPath(); g.arc(tr.x, tr.y, 10, 0, 7); g.fill();
        }
      }
    }

    // parked cars
    for (const p of this.parked) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.angle);
      g.fillStyle = p.color; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.fillStyle = '#223'; g.fillRect(-p.w / 2 + 6, -p.h / 2 + 3, 10, p.h - 6);
      g.restore();
    }
  }

  // minimap: draw simplified map into a small ctx
  drawMinimap(g, cx, cy, scale, viewR) {
    const x0 = cx - viewR, y0 = cy - viewR, s = scale;
    g.fillStyle = '#22262e';
    g.fillRect(x0 * s, y0 * s, viewR * 2 * s, viewR * 2 * s);
    g.fillStyle = '#555b66';
    for (const b of this.buildings) {
      if (b.x + b.w < cx - viewR || b.x > cx + viewR || b.y + b.h < cy - viewR || b.y > cy + viewR) continue;
      g.fillRect(b.x * s, b.y * s, b.w * s, b.h * s);
    }
    g.strokeStyle = '#7f8a99'; g.lineWidth = 2;
    g.strokeRect((cx - viewR) * s, (cy - viewR) * s, viewR * 2 * s, viewR * 2 * s);
  }
}

function inner0() { return 20; }
