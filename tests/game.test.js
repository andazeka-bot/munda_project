/**
 * MUNDA "Light Works" adventure game logic tests (Node, no browser needed):
 *   - every zone parses cleanly (map rows equal width, all cells valid)
 *   - every zone is SOLVABLE: a BFS with keys/switches/teleporters can reach
 *     the exit with the mission complete and every pickup collected
 *   - star / lumen scoring is sane
 * Run: node tests/game.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ZONES, parseZone, totalPickups, missionDone, starsFor, lumenForRun } = require('../public/js/game.js');

let failures = 0;
function check(cond, msg) {
  if (cond) { console.log('  ok  -', msg); }
  else { failures++; console.error('  FAIL -', msg); }
}

const COLOR_CHAR = { amber: 1, cyan: 2, green: 4, violet: 8 };

/**
 * BFS over (r, c, colors, switched, orbs, nodesLit). Treats hazards as
 * impassable (a careful player avoids them). Returns true when the exit is
 * reached with the mission done AND every pickup collected.
 */
function zoneSolvable(z) {
  const W = z.W, H = z.H;
  const wallSet = z.wallSet;
  const hazardSet = new Set(z.hazards.map((h) => h.r * W + h.c));
  const orbAt = new Map(z.orbs.map((o) => [o.r * W + o.c, o]));
  const gateAt = new Map(z.gates.map((g) => [g.r * W + g.c, g]));
  const nodeAt = new Map(z.nodes.map((n) => [n.r * W + n.c, n]));
  const doorSet = new Set(z.doors.map((d) => d.r * W + d.c));
  const switchSet = new Set(z.switches.map((s) => s.r * W + s.c));
  const teleTo = z.teleTo;
  const exitIdx = z.exit.r * W + z.exit.c;
  const wantOrbs = z.orbs.length;
  const wantNodes = z.nodes.length;
  const totalPk = totalPickups(z);

  const start = z.start;
  const init = { r: start.r, c: start.c, colors: 0, sw: 0, orbs: 0, nodes: 0, pk: 0 };
  const key = (s) => `${s.r},${s.c},${s.colors},${s.sw},${s.orbs},${s.nodes}`;
  const seen = new Set([key(init)]);
  const queue = [init];

  while (queue.length) {
    const s = queue.shift();
    const atExit = s.r * W + s.c === exitIdx;
    const missionMet = z.mission === 'light' ? s.nodes >= wantNodes : s.pk >= wantOrbs;
    if (atExit && missionMet && s.pk >= totalPk) return true;

    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = s.r + dr, nc = s.c + dc;
      if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
      const ni = nr * W + nc;
      if (wallSet.has(ni) || hazardSet.has(ni)) continue;
      const gate = gateAt.get(ni);
      if (gate && !(s.colors & COLOR_CHAR[gate.color])) continue;
      if (doorSet.has(ni) && s.sw === 0) continue;

      let { colors, sw, orbs, nodes, pk } = s;
      const orb = orbAt.get(ni);
      if (orb) { colors |= COLOR_CHAR[orb.color]; orbs++; pk++; }
      const node = nodeAt.get(ni);
      if (node && orbs > 0) { orbs--; nodes++; pk++; }
      if (switchSet.has(ni)) sw = 1;

      // teleporters apply immediately after entering
      let r = nr, c = nc;
      const tp = teleTo.get(ni);
      if (tp) { r = tp.r; c = tp.c; }

      const ns = { r, c, colors, sw, orbs, nodes, pk };
      const k = key(ns);
      if (!seen.has(k)) { seen.add(k); queue.push(ns); }
    }
  }
  return false;
}

// 0) every element id referenced by the game script must exist in the page
//    (this has caught real "Cannot set properties of null" bugs before)
console.log('\nDOM wiring:');
{
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'game.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'game.html'), 'utf8');
  const refs = [...js.matchAll(/\$\('#([A-Za-z0-9-]+)'\)/g)].map((m) => m[1]);
  const ids = new Set([...html.matchAll(/id="([A-Za-z0-9-]+)"/g)].map((m) => m[1]));
  const missing = [...new Set(refs)].filter((id) => !ids.has(id));
  check(missing.length === 0, `all ${new Set(refs).size} element ids referenced by game.js exist in game.html` + (missing.length ? ` (missing: ${missing.join(', ')})` : ''));
}

// 1) structure
console.log('\nStructure:');
check(ZONES.length === 5, `exactly 5 zones (got ${ZONES.length})`);
{
  const slugs = ZONES.map((z) => z.slug);
  check(new Set(slugs).size === slugs.length, 'unique slugs');
  const names = ['Fibre Fields', 'The Weave Works', 'The Colour Lab', 'The Energy Core', 'The Audi Showroom'];
  check(names.every((n) => ZONES.some((z) => z.name === n)), 'all five zones present');
  check(ZONES.every((z) => z.par > 0 && ['amber', 'cyan', 'green', 'violet'].includes(z.accent)), 'zones have par times and accents');
  check(ZONES.every((z) => z.mission === 'collect' || z.mission === 'light'), 'missions are collect or light');
}

// 2) parse integrity
console.log('\nMap integrity:');
for (const z of ZONES) {
  check(z.W >= 8 && z.H >= 6 && z.W <= 16 && z.H <= 12, `${z.slug}: playable size ${z.W}x${z.H}`);
  check(z.orbs.length >= 3, `${z.slug}: at least 3 orbs (got ${z.orbs.length})`);
  const allInBounds = (cells) => cells.every((c) => c.r >= 0 && c.r < z.H && c.c >= 0 && c.c < z.W && !z.wallSet.has(c.r * z.W + c.c));
  check(allInBounds(z.orbs) && allInBounds(z.gates) && allInBounds(z.nodes) && allInBounds(z.hazards) && allInBounds(z.switches) && allInBounds(z.doors), `${z.slug}: pickups/props on the floor (not walls/out of bounds)`);
  check(!z.wallSet.has(z.start.r * z.W + z.start.c) && !z.wallSet.has(z.exit.r * z.W + z.exit.c), `${z.slug}: start & exit on floor`);
  check(z.exit.r !== z.start.r || z.exit.c !== z.start.c, `${z.slug}: start != exit`);
  if (z.mission === 'collect') check(z.orbs.length >= 3, `${z.slug}: collect mission has orbs`);
  if (z.mission === 'light') check(z.nodes.length >= 3 && z.orbs.length >= z.nodes.length, `${z.slug}: light mission has nodes and enough orbs`);
}

// 3) solvability (the big one)
console.log('\nSolvability (BFS):');
for (const z of ZONES) {
  const solvable = zoneSolvable(z);
  check(solvable, `${z.name}: completable — all pickups + mission + exit reachable`);
}

// 4) scoring
console.log('\nScoring:');
{
  const z = ZONES[0];
  const run = { pickups: totalPickups(z), nodesLit: 0 };
  check(starsFor(z, 1, totalPickups(z)) === 3, 'fast + full pickups = 3 stars');
  check(starsFor(z, 9999, totalPickups(z)) === 2, 'slow + full pickups = 2 stars');
  check(starsFor(z, 1, 1) === 2, 'fast + partial pickups = 2 stars');
  check(starsFor(z, 9999, 1) === 1, 'slow + partial pickups = 1 star');
  check(lumenForRun(z, run, 1) === totalPickups(z) * 10 + 15 + 25, 'lumen counts pickups + time bonus + perfect bonus');
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
