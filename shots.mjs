// shots.mjs — capture the 3 deliverable screenshots from the real running game
import { CDP, sleep } from './cdp.mjs';

const cdp = await CDP.launch();
const errors = [];
cdp.onConsole = (msg) => {
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? '');
};
await cdp.init();
await cdp.fixViewport();
await cdp.goto('http://localhost:8080/');
await cdp.fixViewport();
await sleep(1200);

// 1 — title/cover
await cdp.shot('/home/agentuser/makefun/gta6-01/screenshots/1-cover.png');
await sleep(200);

await cdp.key('Enter'); await sleep(600);

// 2 — driving: put a car on a real road centerline, snap the camera, drive, add heat for police
await cdp.eval(`(function(){
  const g=__game, p=g.player;
  const PITCH = 450;                 // blockSize 340 + roadW 110
  const y = 7 * PITCH + 55;          // road centerline
  const x = 5 * PITCH + 55;
  const c = {x, y, angle: 0, vx: 0, vy: 0,
    loop: [{x: x+1400, y}, {x: x+1400, y: y+400}, {x, y: y+400}],
    wp: 0, ai:false, driver:null, color:'#c94f4f', w:34, h:16, kind:'civ', dead:false, speed:100, honk:0};
  g.npcs.cars.push(c);
  p.enterCar(c);
  p.wanted = 3; p.heat = 999; g.police.syncToWanted();
  g.cam.x = p.x; g.cam.y = p.y;
})()`);
await sleep(200);
await cdp.holdKey('KeyW'); await sleep(1500); await cdp.releaseKey('KeyW');
await sleep(450);
await cdp.shot('/home/agentuser/makefun/gta6-01/screenshots/2-driving.png');
await sleep(200);

// 3 — mission view: on foot beside the mission waypoint, camera snapped
await cdp.eval(`(function(){
  const g=__game, p=g.player;
  if (p.inCar) p.exitCar();
  const mk = g.missions.currentMarker();
  if (mk) { p.x = mk.x - 150; p.y = mk.y + 110; }
  g.cam.x = p.x; g.cam.y = p.y;
  g.player.wanted = 1; g.player.heat = 60; g.police.syncToWanted();
  g.hud.toast('Waypoint: Marina drop', '#9df');
})()`);
await sleep(900);
await cdp.shot('/home/agentuser/makefun/gta6-01/screenshots/3-mission.png');

console.log('errors:', JSON.stringify(errors));
cdp.close();
process.exit(0);
