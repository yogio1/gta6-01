// Entry point for the gta6-01 make.fun bounty: stage the game and its screenshots into the
// output directory and write dossier.json, the summary the make.fun scorer reads.
//
// The game itself is game/ — plain static files (game/index.html plus ES modules, canvas 2D,
// no build step, no network). This program copies game/ and screenshots/ from beside this file
// into the output directory, then calls the vendored make.fun library to build the dossier.
//
// Inside the grader's container the output directory is /output; anywhere else,
// MAKEFUN_OUTPUT_DIR stands in for it:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy a directory tree, requiring that it exists and is a directory. */
function stage(source: string, target: string, label: string): void {
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new Error(`${label}: missing at ${source}`);
  }
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

stage(join(here, 'game'), join(out, 'game'), 'game/');
stage(join(here, 'screenshots'), join(out, 'screenshots'), 'screenshots/');

// An entry hands in 3 or 4 PNG/JPEG renders (the first by name the cover): refuse early, with
// this repo's paths in the message, rather than letting buildDossier refuse the staged copy.
const shots = readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.'));
if (shots.length < 3) throw new Error(`screenshots/: ${shots.length} image(s), need 3 or 4 — add PNG/JPEG renders beside main.ts in screenshots/`);

// The scorer's caps (gate.json): only text_max_bytes shapes the dossier's bytes; the rest refuse
// an entry the scorer would refuse (more than 4 screenshots, or one over 256 KiB; more than 993
// game entries or 48 MiB of game files, or a game path over 1000 bytes — game/ counts beside
// /output's own 1000-entry cap alongside screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`dossier.json written to ${out} (${dossier.length} bytes)`);
