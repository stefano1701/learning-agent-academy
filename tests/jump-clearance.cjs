// Exercise the real movement and collision code without starting the browser UI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const element = () => ({ getContext: () => ({}), classList: { add() {}, remove() {}, toggle() {} }, style: {} });
const sandbox = {
  document: { getElementById: element },
  window: { innerWidth: 1024, innerHeight: 768, localStorage: { getItem: () => null }, setTimeout() {}, clearTimeout() {} },
  performance: { now: () => 0 },
};
let source = fs.readFileSync(path.join(__dirname, '../src/game.js'), 'utf8');
source = source.replace('  init();\n})();', '  globalThis.gameTest = { state, createRun, updateRun };\n})();');
vm.runInNewContext(source, sandbox);
const { state, createRun, updateRun } = sandbox.gameTest;
let scenarios = 0;
for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.04]) {
  for (const speed of [205, 220, 255, 285]) {
    // Allow a generous range of jump timing before reaching the near emitter.
    for (const leadSeconds of [0.15, 0.25, 0.35]) {
      const run = createRun('mission', { subjectId: 'spelling', yearGroup: 'year-3', characterId: 'sarah' });
      state.run = run;
      state.currentScreen = 'playing';
      state.jumpQueued = true;
      state.keyDuckHeld = false;
      state.touchDuckHeld = false;
      run.speed = speed;
      run.maxSpeed = speed;
      run.acceleration = 0;
      run.nextChallengeAt = Infinity;
      run.obstacleTimer = Infinity;
      run.obstacles = [{ type: 'floor-laser', x: run.player.x + 32 + speed * leadSeconds, width: 96, hit: false, phase: 0 }];
      let peak = 0;
      for (let time = 0; time < 1.5; time += dt) {
        updateRun(dt);
        peak = Math.max(peak, run.player.y);
      }
      assert.equal(run.lives, 3, `Jump collision: dt=${dt}, speed=${speed}, lead=${leadSeconds}`);
      assert.equal(run.player.y, 0, 'Agent should land again');
      assert.ok(peak > 220 && peak < 260, 'Jump should have predictable clearance');
      scenarios++;
    }
  }
}
// Ground-level running must still collide, and ducking must still clear high beams.
for (const [type, duck, expectedLives] of [['floor-laser', false, 2], ['head-laser', false, 2], ['head-laser', true, 3]]) {
  const run = createRun('mission', { subjectId: 'spelling', yearGroup: 'year-3', characterId: 'sarah' });
  state.run = run;
  state.currentScreen = 'playing';
  state.jumpQueued = false;
  state.keyDuckHeld = duck;
  run.player.duckBlend = duck ? 1 : 0;
  run.nextChallengeAt = Infinity;
  run.obstacleTimer = Infinity;
  run.obstacles = [{ type, x: run.player.x, width: 96, hit: false, phase: 0 }];
  updateRun(1 / 60);
  assert.equal(run.lives, expectedLives, `${type}, duck=${duck}`);
}
console.log(`Passed ${scenarios} jump scenarios plus ground collision and ducking checks.`);
