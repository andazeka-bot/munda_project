/**
 * MUNDA — "Weave the Light" game
 * Route light from the LED module(s) through the woven textile light guide
 * (rotatable fibre tiles) to the light-output points.
 *
 * Pure logic is exported for Node testing; the DOM renderer only boots in a browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MundaGame = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= pure logic ================= */

  const DIRS = ['N', 'E', 'S', 'W'];
  const OPP = { N: 'S', E: 'W', S: 'N', W: 'E' };
  const DV = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
  const ROT_IDX = { N: 0, E: 1, S: 2, W: 3 };
  const ALL = ['N', 'E', 'S', 'W'];

  function rotOpen(open, k) {
    return open.map((d) => DIRS[(ROT_IDX[d] + k) % 4]).sort((a, b) => ROT_IDX[a] - ROT_IDX[b]);
  }

  const LIGHT_COLORS = { amber: '#ffb454', cyan: '#54d6e6', green: '#5ee0a0' };

  const LEVELS = [
    {
      name: 'First Light',
      W: 4, H: 4,
      sources: [{ r: 3, c: 0, color: 'amber' }],
      targets: [{ r: 0, c: 3, color: 'amber' }],
    },
    {
      name: 'Two Outputs',
      W: 5, H: 5,
      sources: [{ r: 4, c: 0, color: 'amber' }],
      targets: [{ r: 0, c: 2, color: 'amber' }, { r: 2, c: 4, color: 'amber' }],
    },
    {
      name: 'Dual Modules',
      W: 6, H: 6,
      sources: [{ r: 4, c: 0, color: 'amber' }, { r: 0, c: 5, color: 'amber' }],
      targets: [{ r: 4, c: 5, color: 'amber' }, { r: 0, c: 0, color: 'amber' }],
    },
    {
      name: 'RGB Mode',
      W: 6, H: 6,
      sources: [{ r: 5, c: 0, color: 'amber' }, { r: 0, c: 5, color: 'cyan' }],
      targets: [
        { r: 0, c: 0, color: 'amber' },
        { r: 5, c: 5, color: 'cyan' },
        { r: 2, c: 3, color: 'amber' },
      ],
    },
    {
      name: 'Full Spectrum',
      W: 7, H: 7,
      sources: [
        { r: 5, c: 0, color: 'amber' },
        { r: 0, c: 3, color: 'cyan' },
        { r: 5, c: 6, color: 'green' },
      ],
      targets: [
        { r: 0, c: 0, color: 'amber' },
        { r: 5, c: 3, color: 'cyan' },
        { r: 0, c: 6, color: 'green' },
      ],
    },
  ];

  function rng() { return Math.random(); }

  function shuffle(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function neighbors(cell, W, H) {
    const out = [];
    for (const d of DIRS) {
      const [dr, dc] = DV[d];
      const nr = cell.r + dr, nc = cell.c + dc;
      if (nr >= 0 && nr < H && nc >= 0 && nc < W) out.push({ r: nr, c: nc });
    }
    return out;
  }

  function dist(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }

  function dirBetween(a, b) {
    if (b.r < a.r) return 'N';
    if (b.r > a.r) return 'S';
    if (b.c > a.c) return 'E';
    return 'W';
  }

  /**
   * Shortest-path carving (BFS with random tie-breaking for variety).
   * `occupied` = cells that must not be entered (other sources, other targets, used path tiles).
   * Returns an ordered list of path tiles with exact in/out directions, or null
   * when the target is unreachable (caller retries the whole level).
   */
  function carvePath(W, H, occupied, start, target, r) {
    const occ = new Set(occupied.map((c) => c.r * W + c.c));
    const key = (cell) => cell.r * W + cell.c;
    const startKey = key(start), targetKey = key(target);
    if (startKey === targetKey) return null;

    const prev = new Map(); // key -> { cell, fromKey }
    const seen = new Set([startKey]);
    const queue = [start];
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      if (key(cur) === targetKey) break;
      const cands = neighbors(cur, W, H)
        .filter((n) => !occ.has(key(n)) && !seen.has(key(n)))
        .map((n) => ({ n, j: r() }))
        .sort((a, b) => a.j - b.j)
        .map((x) => x.n);
      for (const n of cands) {
        seen.add(key(n));
        prev.set(key(n), { cell: cur, fromKey: key(cur) });
        queue.push(n);
      }
    }
    if (!prev.has(targetKey)) return null;

    // rebuild the full chain (target → start) from the prev pointers, then flip it
    const fullRev = [{ r: target.r, c: target.c }];
    let k = targetKey;
    while (k !== startKey) {
      const entry = prev.get(k);
      fullRev.push(entry.cell);
      k = entry.fromKey;
    }
    const full = fullRev.reverse(); // [start, succ(start), …, pred(target), target]
    if (full.length < 3) return null; // adjacent — too trivial
    const tiles = [];
    for (let i = 1; i < full.length - 1; i++) {
      const p = full[i - 1], cell = full[i], n = full[i + 1];
      tiles.push({
        r: cell.r, c: cell.c,
        inDir: OPP[dirBetween(p, cell)],
        outDir: dirBetween(cell, n),
      });
    }
    return tiles;
  }

  function tileFromOpen(open) {
    const sorted = open.slice().sort((a, b) => ROT_IDX[a] - ROT_IDX[b]);
    if (sorted.length === 2 && sorted[1] === OPP[sorted[0]]) return 'straight';
    if (sorted.length === 2) return 'corner';
    if (sorted.length === 3) return 'tee';
    return 'cross';
  }

  /** Generate a level board. Returns null if carving failed (caller retries). */
  function generateLevel(level, r) {
    r = r || rng;
    const { W, H } = level;
    const cells = new Array(W * H).fill(null);

    // fixed tiles
    for (const s of level.sources) cells[s.r * W + s.c] = { kind: 'source', open: ALL, rot: 0, fixed: true, color: s.color };
    for (const t of level.targets) cells[t.r * W + t.c] = { kind: 'target', open: ALL, rot: 0, fixed: true, color: t.color };

    const used = []; // path tile coords
    const occupied = level.sources.slice(); // never step onto other modules

    // carve one path per target, from its nearest source
    for (const t of level.targets) {
      const src = level.sources
        .filter((s) => s.color === t.color)
        .sort((a, b) => dist(a, t) - dist(b, t))[0];
      if (!src) return null;
      const occ = occupied.concat(level.targets.filter((x) => x !== t));
      const segs = carvePath(W, H, occ, src, t, r);
      if (!segs) return null;
      for (const s of segs) {
        const open = [s.inDir, s.outDir];
        const rot = 1 + Math.floor(r() * 3); // always start mis-rotated
        cells[s.r * W + s.c] = {
          kind: 'path', open: rotOpen(open, rot), rot,
          solvedOpen: open.slice(), fromPath: true,
        };
        used.push({ r: s.r, c: s.c });
        occupied.push({ r: s.r, c: s.c });
      }
    }

    // noise tiles
    const baseTypes = [
      { t: 'straight', o: ['N', 'S'] },
      { t: 'straight', o: ['E', 'W'] },
      { t: 'corner', o: ['N', 'E'] },
      { t: 'corner', o: ['S', 'W'] },
      { t: 'tee', o: ['N', 'E', 'S'] },
      { t: 'cross', o: ALL },
    ];
    for (let i = 0; i < cells.length; i++) {
      if (cells[i]) continue;
      const row = Math.floor(i / W), col = i % W;
      // noise next to a module/output must not face it — light may only enter
      // outputs through the proper path tile (no instant-win boards)
      const forbidden = new Set();
      for (const s of level.sources) if (dist({ r: row, c: col }, s) === 1) forbidden.add(dirBetween({ r: row, c: col }, s));
      for (const t of level.targets) if (dist({ r: row, c: col }, t) === 1) forbidden.add(dirBetween({ r: row, c: col }, t));
      let placed = null;
      for (let attempt = 0; attempt < 14 && !placed; attempt++) {
        const b = baseTypes[Math.floor(r() * baseTypes.length)];
        const rot = Math.floor(r() * 4);
        const open = rotOpen(b.o, rot);
        if (forbidden.size && open.some((d) => forbidden.has(d))) continue;
        placed = { kind: b.t, open, rot, solvedOpen: b.o.slice(), fromPath: false };
      }
      if (!placed) {
        const b = baseTypes[Math.floor(r() * baseTypes.length)];
        const rot = Math.floor(r() * 4);
        placed = { kind: b.t, open: rotOpen(b.o, rot), rot, solvedOpen: b.o.slice(), fromPath: false };
      }
      cells[i] = placed;
    }

    // optimal moves = sum of rotations needed to restore path tiles
    let optimal = 0;
    for (const c of cells) if (c.fromPath) optimal += (4 - c.rot) % 4;
    if (optimal === 0) return null;

    return { W, H, cells, sources: level.sources, targets: level.targets, name: level.name, optimal };
  }

  /** BFS light propagation from every source. */
  function computeLight(board) {
    const { W, H, cells, sources, targets } = board;
    const reached = new Map(); // idx -> Set of colors
    const order = []; // {idx, color, dist} — for the light-surge animation
    const seen = new Set();

    for (const s of sources) {
      const startIdx = s.r * W + s.c;
      const queue = [{ idx: startIdx, color: s.color, dist: 0 }];
      const localSeen = new Set([startIdx]);
      while (queue.length) {
        const { idx, color, dist } = queue.shift();
        if (!reached.has(idx)) reached.set(idx, new Set());
        if (!reached.get(idx).has(color)) {
          reached.get(idx).add(color);
          order.push({ idx, color, dist });
        }
        const cell = cells[idx];
        const r = Math.floor(idx / W), c = idx % W;
        for (const d of cell.open) {
          const [dr, dc] = DV[d];
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
          const nIdx = nr * W + nc;
          if (localSeen.has(nIdx)) continue;
          if (!cells[nIdx].open.includes(OPP[d])) continue;
          localSeen.add(nIdx);
          queue.push({ idx: nIdx, color, dist: dist + 1 });
        }
      }
      for (const i of localSeen) seen.add(i);
    }

    let litCount = 0;
    const targetStatus = targets.map((t) => {
      const colors = reached.get(t.r * W + t.c);
      const lit = !!colors && colors.has(t.color);
      if (lit) litCount++;
      return lit;
    });

    return { reached, order, targetStatus, litCount, done: litCount === targets.length };
  }

  const logic = { LEVELS, generateLevel, computeLight, rotOpen, LIGHT_COLORS, tileFromOpen, dirBetween, carvePath };

  /* ================= DOM renderer (browser only) ================= */

  if (typeof document !== 'undefined') {
    const $ = (sel) => document.querySelector(sel);

    const state = { level: 0, board: null, moves: 0, busy: false };

    function renderGrid() {
      const grid = $('#game-grid');
      const b = state.board;
      grid.style.gridTemplateColumns = `repeat(${b.W}, 1fr)`;
      grid.innerHTML = '';
      for (let i = 0; i < b.cells.length; i++) {
        const r = Math.floor(i / b.W), c = i % b.W;
        const cell = b.cells[i];
        const btn = document.createElement('button');
        btn.className = 'tile' + (cell.fixed ? ' fixed' : '');
        btn.setAttribute('data-i', i);
        btn.setAttribute('aria-label', `Tile row ${r} col ${c}, rotation ${cell.rot}`);
        btn.title = cell.kind === 'source' ? 'LED module' : cell.kind === 'target' ? `Light output (${cell.color})` : 'Rotate';
        btn.innerHTML = tileSVG(cell);
        if (!cell.fixed) {
          btn.addEventListener('click', () => {
            if (state.busy) return;
            cell.rot = (cell.rot + 1) % 4;
            cell.open = logic.rotOpen(cell.solvedOpen || baseOpen(cell), cell.rot);
            state.moves++;
            refresh();
          });
        }
        grid.appendChild(btn);
      }
    }

    function baseOpen(cell) {
      // for noise tiles solvedOpen is their base
      return cell.solvedOpen || cell.open;
    }

    function tileSVG(cell) {
      const open = cell.open;
      let segs = '';
      for (const d of open) {
        const [dr, dc] = DV[d];
        const x1 = 30 + dc * 0, y1 = 30 + dr * 0;
        segs += `<line class="seg" x1="${30 + dc * -22}" y1="${30 + dr * -22}" x2="${30 + dc * 22}" y2="${30 + dr * 22}"/>`;
      }
      if (cell.kind === 'source') {
        return `<svg viewBox="0 0 60 60">${segs}<rect class="led led-${cell.color}" x="20" y="24" width="20" height="12" rx="3"/></svg>`;
      }
      if (cell.kind === 'target') {
        return `<svg viewBox="0 0 60 60">${segs}<circle class="dot dot-${cell.color}" cx="30" cy="30" r="7"/></svg>`;
      }
      return `<svg viewBox="0 0 60 60">${segs}</svg>`;
    }

    function refresh() {
      const b = state.board;
      const light = logic.computeLight(b);
      $('#game-moves').textContent = state.moves;

      // clear lighting
      document.querySelectorAll('.tile.lit').forEach((el) => {
        el.classList.remove('lit', 'lit-amber', 'lit-cyan', 'lit-green');
      });

      // light surge: reveal in BFS order
      const byColor = {};
      for (const e of light.order) {
        (byColor[e.idx] = byColor[e.idx] || []).push(e);
      }
      const ordered = [...light.order].sort((a, b) => a.dist - b.dist || a.idx - b.idx);
      const tiles = document.querySelectorAll('.tile');
      state.busy = true;
      ordered.forEach((e, k) => {
        setTimeout(() => {
          const el = tiles[e.idx];
          if (el) {
            el.classList.add('lit', 'lit-' + e.color);
            // multiple colors on one tile: add the others too
            (byColor[e.idx] || []).forEach((o) => el.classList.add('lit-' + o.color));
          }
        }, 60 + k * 45);
      });
      const maxDist = ordered.length ? ordered[ordered.length - 1].dist : 0;
      setTimeout(() => {
        state.busy = false;
        if (light.done) complete(light);
      }, 120 + ordered.length * 45 + 250);
    }

    function complete(light) {
      const b = state.board;
      const stars = state.moves <= b.optimal + 2 ? 3 : state.moves <= b.optimal + 5 ? 2 : 1;
      $('#game-modal-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      $('#game-modal-moves').textContent = `${state.moves} moves · optimal ${b.optimal}`;
      $('#game-modal-title').textContent = `Level ${state.level + 1} complete — the ${b.name === 'Full Spectrum' ? 'Audi A3 door panel is fully illuminated' : 'textile light guide is lit'}!`;
      const door = $('#game-door');
      door.classList.remove('lit');
      void door.offsetWidth;
      door.classList.add('lit');
      $('#game-modal').hidden = false;
      $('#game-next').style.display = state.level < logic.LEVELS.length - 1 ? '' : 'none';
    }

    function initLevel(idx) {
      state.level = idx;
      state.moves = 0;
      state.busy = false;
      const level = logic.LEVELS[idx];
      $('#game-level-name').textContent = `Level ${idx + 1} · ${level.name}`;
      $('#game-modal').hidden = true;
      let board = null;
      for (let attempt = 0; attempt < 400 && !board; attempt++) board = logic.generateLevel(level);
      if (!board) { $('#game-grid').innerHTML = '<p style="color:var(--text-faint)">Could not generate this level. Reload the page to retry.</p>'; return; }
      state.board = board;
      $('#game-optimal').textContent = `optimal ${board.optimal}`;
      renderGrid();
      refresh();
    }

    function boot() {
      if (!$('#game-grid')) return;
      $('#game-reset').addEventListener('click', () => initLevel(state.level));
      $('#game-next').addEventListener('click', () => initLevel(state.level + 1));
      $('#game-restart').addEventListener('click', () => initLevel(state.level));
      initLevel(0);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  return logic;
});
