// playtest.mjs — boot the game headless and exercise core features
import { CDP, sleep } from './cdp.mjs';

const errors = [];
const cdp = await CDP.launch();
cdp.onConsole = (msg) => {
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    errors.push('EXC: ' + (d.exception?.description ?? d.text));
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push('ERR: ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
};
await cdp.init();
await cdp.goto('http://localhost:8080/');
await sleep(1500);

const report = {};
report.title = await cdp.eval('document.title');
report.state = await cdp.eval('window.__game && window.__game.state');

// start game
await cdp.key('Enter');
await sleep(600);
report.stateAfterEnter = await cdp.eval('window.__game.state');
report.mission = await cdp.eval('JSON.stringify({t:__game.missions.missionTitle, s:__game.missions.started})');

// walk north for 1.2s
await cdp.holdKey('KeyW'); await sleep(1200); await cdp.releaseKey('KeyW');
report.playerAfterWalk = await cdp.eval('JSON.stringify({x:Math.round(__game.player.x),y:Math.round(__game.player.y),walked:__game.player.walkPhase>0})');

// walk toward the nearest traffic car and press F
report.steal = await cdp.eval(`(function(){
  const g = window.__game, p = g.player;
  let best=null, bd=1e9;
  for (const c of g.npcs.cars){ const d=(c.x-p.x)**2+(c.y-p.y)**2; if(d<bd){bd=d;best=c;} }
  if(!best) return 'no cars';
  // teleport next to it (test shortcut), then steal
  p.x = best.x + 40; p.y = best.y;
  return JSON.stringify({dist: Math.round(Math.sqrt(bd)), angle: Math.round(best.angle*57)});})()`);
await sleep(100);
await cdp.key('KeyF');
await sleep(400);
report.inCar = await cdp.eval('!!window.__game.player.inCar');

// drive: hold W + steer D for 1.5s
await cdp.holdKey('KeyW'); await cdp.holdKey('KeyD'); await sleep(1500); await cdp.releaseKey('KeyD'); await sleep(800); await cdp.releaseKey('KeyW');
report.drive = await cdp.eval('JSON.stringify({speed:Math.round(Math.hypot(__game.player.car?__game.player.car.vx:0,__game.player.car?__game.player.car.vy:0))})');

// shoot while driving? exit first, then aim+fire
await cdp.key('KeyF'); await sleep(400);
await cdp.mouseMove(900, 300);
await cdp.mouseDown(900, 300); await sleep(80); await cdp.mouseUp(900, 300);
await sleep(300);
await cdp.mouseDown(900, 300); await sleep(80); await cdp.mouseUp(900, 300);
await sleep(500);
report.shots = await cdp.eval('JSON.stringify({bullets:__game.shots.bullets.length, wanted:__game.player.wanted, toasts:__game.hud.toasts.length})');

// force police: raise wanted, wait for spawn
await cdp.eval('__game.player.addWanted(3)');
await sleep(3500);
report.police = await cdp.eval('JSON.stringify({cops:__game.police.cars.length, wanted:__game.player.wanted})');

// pause + save + load
await cdp.key('Escape'); await sleep(300);
report.paused = await cdp.eval('window.__game.state');
await cdp.key('KeyS'); await sleep(300);
report.saved = await cdp.eval('!!localStorage.getItem("palmcoast-save-1")');
await cdp.key('KeyL'); await sleep(400);
report.loaded = await cdp.eval('JSON.stringify({state:__game.state, money:__game.player.money})');
await cdp.key('Escape'); await sleep(200);

// screenshot for sanity (not final deliverable)
await cdp.shot('/tmp/playtest.png');
report.errors = errors;
console.log(JSON.stringify(report, null, 2));
cdp.close();
process.exit(0);
