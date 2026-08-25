/**
 * MUNDA game logic tests (Node, no browser needed):
 *   - every level generates solvable boards
 *   - boards are NOT solved at start (rotations actually shuffled)
 *   - restoring all path tiles to their solved rotation lights every target
 *   - optimal move count matches the shuffled rotation offsets
 * Run: node tests/game.test.js
 */
const assert = require('assert');
const { LEVELS, generateLevel, computeLight, rotOpen } = require('../public/js/game.js');

let failures = 0;
function check(cond, msg) {
  if (cond) { console.log('  ok  -', msg); }
  else { failures++; console.error('  FAIL -', msg); }
}

for (let li = 0; li < LEVELS.length; li++) {
  const level = LEVELS[li];
  console.log(`\nLevel ${li + 1}: "${level.name}" (${level.W}x${level.H}, ${level.sources.length} source(s), ${level.targets.length} target(s))`);

  let generated = 0, initialSolved = 0, solveFailures = 0, optimalMismatch = 0;
  const RUNS = 200;

  for (let run = 0; run < RUNS; run++) {
    const board = generateLevel(level);
    if (!board) { solveFailures++; continue; }
    generated++;

    // 1) initial state should not already be solved (noise could rarely connect — allow small tolerance)
    if (computeLight(board).done) initialSolved++;

    // 2) optimal moves = sum of (4 - rot) % 4 over path tiles
    let expected = 0;
    for (const c of board.cells) if (c.fromPath) expected += (4 - c.rot) % 4;
    if (expected !== board.optimal || expected === 0) optimalMismatch++;

    // 3) solve: rotate every path tile back to rot 0, verify all targets lit
    for (const c of board.cells) {
      if (!c.fromPath) continue;
      c.rot = 0;
      c.open = rotOpen(c.solvedOpen, 0);
    }
    const light = computeLight(board);
    if (!light.done) solveFailures++;
    else if (light.litCount !== level.targets.length) solveFailures++;
  }

  check(generated === RUNS, `generated ${generated}/${RUNS} boards`);
  check(initialSolved === 0, `boards start unsolved (${initialSolved}/${RUNS} accidentally solved — noise tolerance)`);
  check(optimalMismatch === 0, 'optimal move count matches shuffle offsets');
  check(solveFailures === 0, `all generated boards solvable (${solveFailures} failures)`);
}

// 4) light actually travels: build a tiny known board manually
console.log('\nManual light-propagation test:');
{
  const W = 3, H = 1;
  const cells = new Array(3).fill(null);
  cells[0] = { kind: 'source', open: ['N', 'E', 'S', 'W'], rot: 0, fixed: true, color: 'amber' };
  cells[1] = { kind: 'path', open: ['E', 'W'], rot: 0, solvedOpen: ['E', 'W'], fromPath: true };
  cells[2] = { kind: 'target', open: ['N', 'E', 'S', 'W'], rot: 0, fixed: true, color: 'amber' };
  const board = { W, H, cells, sources: [{ r: 0, c: 0, color: 'amber' }], targets: [{ r: 0, c: 2, color: 'amber' }], optimal: 0 };
  const light = computeLight(board);
  check(light.done, 'straight 3-cell line lights the target');

  // break the connection: rotate the middle tile to a corner
  cells[1].open = ['N', 'E'];
  const broken = computeLight(board);
  check(!broken.done, 'broken connection (corner vs straight) blocks the light');
}

// 5) colour matching: cyan source must not light an amber target through the same line
console.log('\nColour-matching test:');
{
  const W = 3, H = 1;
  const cells = new Array(3).fill(null);
  cells[0] = { kind: 'source', open: ['N', 'E', 'S', 'W'], rot: 0, fixed: true, color: 'cyan' };
  cells[1] = { kind: 'path', open: ['E', 'W'], rot: 0, solvedOpen: ['E', 'W'], fromPath: true };
  cells[2] = { kind: 'target', open: ['N', 'E', 'S', 'W'], rot: 0, fixed: true, color: 'amber' };
  const board = { W, H, cells, sources: [{ r: 0, c: 0, color: 'cyan' }], targets: [{ r: 0, c: 2, color: 'amber' }], optimal: 0 };
  const light = computeLight(board);
  check(!light.done, 'amber target stays dark under cyan light');
  check(light.targetStatus[0] === false, 'targetStatus reports unlit');
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
