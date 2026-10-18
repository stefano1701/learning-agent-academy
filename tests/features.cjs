const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function load(storage = new Map()) {
  const timers = new Map(), nodes = new Map(), audios = [];
  const gradient = { addColorStop() {} };
  const canvas = new Proxy({}, { get: (_, key) => key.startsWith('create') ? () => gradient : () => {} });
  const node = () => ({ width: 220, height: 240, getContext: () => canvas, classList: { add() {}, remove() {}, toggle() {} }, style: {} });
  const sandbox = {
    document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); } },
    window: {
      innerWidth: 1024, innerHeight: 768,
      localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
      setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    Audio: class { constructor(url) { this.url = url; audios.push(this); } play() { this.played = true; return Promise.resolve(); } pause() { this.paused = true; } },
    performance: { now: () => 0 },
    console,
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/question-expansion.js'), 'utf8'), sandbox);
  let source = fs.readFileSync(path.join(root, 'src/game.js'), 'utf8');
  source = source.replace('  init();\n})();', '  globalThis.gameTest = { state, progress, LESSON_BANKS, MISSION_WORLDS, createRun, chooseChallenge, getChallengeKey, getLessonPool, buildChoiceOptions, startGuideBreakupSequence, clearGuideBreakupSequence };\n})();');
  vm.runInNewContext(source, sandbox);
  return { ...sandbox.gameTest, nodes, audios, timers, storage };
}
let game = load();
let total = 0;
const unique = new Set();
for (const [subject, years] of Object.entries(game.LESSON_BANKS)) for (const [year, pool] of Object.entries(years)) {
  const ids = new Set();
  for (const q of pool) {
    assert.ok(q.prompt && q.answer && q.voiceText, `${subject}/${year}: missing content`);
    assert.ok(q.acceptedAnswers.length > 0);
    assert.ok(!ids.has(q.id), `Duplicate ID: ${q.id}`);
    ids.add(q.id);
    total++;
    unique.add(`${q.prompt}|${q.voiceText}|${q.answer}`);
    if (subject !== 'spelling') {
      const choices = game.buildChoiceOptions(q);
      assert.equal(choices.filter(c => c.correct).length, 1);
      assert.equal(new Set(choices.map(c => c.value)).size, choices.length);
    }
  }
}
for (const subject of ['spelling', 'maths', 'grammar', 'punctuation', 'spanish', 'french']) {
  for (let year = 1; year <= 6; year++) assert.ok(game.getLessonPool(subject, `year-${year}`).length > 100, `${subject}/${year} needs over 100 questions`);
}
// A complete lesson cycle must have no repeats, even across game/browser reloads.
for (const subject of Object.keys(game.LESSON_BANKS)) {
  const storage = new Map();
  game = load(storage);
  let run = game.createRun('mission', { subjectId: subject, yearGroup: 'year-3', characterId: 'sarah' });
  const count = game.getLessonPool(subject, 'year-3').length;
  const seen = new Set();
  let last;
  for (let i = 0; i < count; i++) {
    if (i === Math.floor(count / 2)) {
      game = load(storage);
      run = game.createRun('mission', { subjectId: subject, yearGroup: 'year-3', characterId: 'sarah' });
    }
    last = game.getChallengeKey(game.chooseChallenge(run));
    assert.ok(!seen.has(last), `${subject}: repeated before pool exhausted`);
    seen.add(last);
  }
  game = load(storage); // Boundary between cycles must also avoid immediate repetition.
  run = game.createRun('practice', { subjectId: subject, yearGroup: 'year-3' });
  assert.notEqual(game.getChallengeKey(game.chooseChallenge(run)), last);
}
game = load();
for (const world of game.MISSION_WORLDS) {
  game.progress.selectedWorldId = world.id;
  assert.equal(game.createRun('mission', {}).world.id, world.id);
}
game.startGuideBreakupSequence();
assert.equal(game.nodes.get('guide-text').textContent, "We're breaking up with you.");
assert.ok(game.audios[0].played);
assert.equal(game.audios[0].url, './src/audio/handler-breakup.wav');
game.clearGuideBreakupSequence();
assert.ok(game.audios[0].paused);
assert.equal(game.timers.size, 0);
game.state.voiceEnabled = false;
game.startGuideBreakupSequence();
assert.equal(game.audios.length, 1, 'Muted handler must not start another clip');
const audio = fs.readFileSync(path.join(root, 'src/audio/handler-breakup.wav'));
assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
assert.ok(audio.length > 44000, 'Recorded voice should contain a complete spoken line');
console.log(`Passed content, choices, saved no-repeat cycles, 4 map selections and handler audio checks. ${total} lesson entries; ${unique.size} distinct prompt/answer combinations.`);
