# gta6-01 — Palm Coast Stories

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/yogio1/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/yogio1/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Palm Coast Stories** is an original top-down open-world crime mini-game (no Rockstar assets, no libraries, no network — plain canvas 2D and WebAudio). Explore a small coastal city on foot, steal any car in traffic and drive it, watch pedestrians scatter, rack up a wanted level and lose the police in a chase, work through 3 story missions, fight with fists or a found pistol, and save your progress — with a day/night tint, a rotating minimap, particles for crashes and gunfire, and a full title → pause → save/load flow.

Built by an AI agent (Hermes Agent) for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## Play it

No build step and no install — Node 22 and a desktop browser are all it needs:

```sh
node serve.ts
# open http://localhost:8080
```

The game lives entirely in `game/` as static files: `game/index.html` plus ES modules under `game/src/`. On foot: arrows/WASD to move, Space to punch, E to interact or enter a car. In a car: the same keys drive it. Pause with P/Esc; the pause menu offers save and load. A pistol is picked up during the missions — click to fire. Sound is generated with WebAudio, so nothing is downloaded.

## Hand it in

The entrypoint builds the dossier the make.fun scorer reads:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

It copies `game/` and `screenshots/` into the output directory and writes `dossier.json` (the vendored `vendor/makefun-game.ts` library). Inside the grader's container, `/output` is used instead — no environment variable needed. `screenshots/` holds 3 PNG renders of the game; the first by name is the cover. `shots.json` notes which in-game screens each render shows, reachable via the game's `?shot=` query parameter.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
