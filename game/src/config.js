// config.js — all tuning constants in one place
export const CFG = {
  seed: 1337,

  // city grid: BLOCK x BLOCK tiles, ROAD tile width, world size
  grid: 15,            // blocks per side
  blockSize: 340,      // px per block (buildings + sidewalks)
  roadW: 110,          // road width between blocks
  sidewalk: 26,        // sidewalk width around each block

  // world size helper computed lazily in world.js
  // player
  walkSpeed: 165,
  runSpeed: 165,       // no sprint key; keep one speed
  playerR: 12,
  maxHealth: 100,

  // car physics
  carAccel: 340,
  carBrake: 520,
  carMaxFwd: 340,
  carMaxRev: -130,
  carTurn: 2.6,        // rad/s at speed
  carFriction: 0.6,

  // wanted system
  heatWindow: 26,      // seconds without incident to lose a star
  starHitSeconds: 14,  // stars added instantly per offense

  // traffic / peds
  carCount: 26,
  pedCount: 44,

  // day/night
  dayLength: 240,      // seconds per full cycle
};
