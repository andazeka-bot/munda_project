/**
 * MUNDA — "Weave the Light" game
 * Route light from the LED module(s) through the woven textile light guide
 * (rotatable fibre tiles) to the light-output points.
 *
 * The game is a house of rooms: every room is its own lighting puzzle with its
 * own name, description and accent colour. Light up a room's door to complete
 * it; light every room to illuminate the whole MUNDA Light House.
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

  const LIGHT_COLORS = { amber: '#ffb454', cyan: '#54d6e6', green: '#5ee0a0', violet: '#b98cf5' };

  /**
   * The MUNDA Light House — every room is its own puzzle.
   * `accent` themes the room (banner, door, hub card); sources/targets use the
   * four light colours. Rooms are ordered easy → hard.
   */
  const ROOMS = [
    {
      slug: 'lobby', name: 'The Lobby', tagline: 'First Light',
      desc: 'The entrance hall of the MUNDA Light House. Route the first glow from the LED module to the light-output point.',
      accent: 'amber', W: 4, H: 4,
      sources: [{ r: 3, c: 0, color: 'amber' }],
      targets: [{ r: 0, c: 3, color: 'amber' }],
    },
    {
      slug: 'weaving-studio', name: 'The Weaving Studio', tagline: 'Two Outputs',
      desc: 'Where the fibres are woven. Split the beam so both light-output points in the textile glow.',
      accent: 'amber', W: 5, H: 5,
      sources: [{ r: 4, c: 0, color: 'amber' }],
      targets: [{ r: 0, c: 2, color: 'amber' }, { r: 2, c: 4, color: 'amber' }],
    },
    {
      slug: 'design-lab', name: 'The Design Lab', tagline: 'Dual Modules',
      desc: 'Two LED modules, two output points. Every module feeds exactly one output — keep the paths apart.',
      accent: 'amber', W: 6, H: 6,
      sources: [{ r: 4, c: 0, color: 'amber' }, { r: 0, c: 5, color: 'amber' }],
      targets: [{ r: 4, c: 5, color: 'amber' }, { r: 0, c: 0, color: 'amber' }],
    },
    {
      slug: 'colour-lab', name: 'The Colour Lab', tagline: 'RGB Mode',
      desc: 'Coloured light arrives. Cyan and amber share the guide — each output only lights from its own colour.',
      accent: 'cyan', W: 6, H: 6,
      sources: [{ r: 5, c: 0, color: 'amber' }, { r: 0, c: 5, color: 'cyan' }],
      targets: [
        { r: 0, c: 0, color: 'amber' },
        { r: 5, c: 5, color: 'cyan' },
        { r: 2, c: 3, color: 'amber' },
      ],
    },
    {
      slug: 'fibre-atelier', name: 'The Fibre Atelier', tagline: 'Full Spectrum',
      desc: 'Three light colours, three outputs — the workshop where the full MUNDA spectrum comes together.',
      accent: 'green', W: 7, H: 7,
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
    {
      slug: 'service-room', name: 'The Service Room', tagline: 'Four Outputs',
      desc: 'The technical heart of the house. Two modules feed four outputs along the service wall.',
      accent: 'amber', W: 7, H: 7,
      sources: [{ r: 6, c: 0, color: 'amber' }, { r: 0, c: 6, color: 'cyan' }],
      targets: [
        { r: 0, c: 0, color: 'amber' },
        { r: 6, c: 4, color: 'amber' },
        { r: 0, c: 3, color: 'cyan' },
        { r: 5, c: 6, color: 'cyan' },
      ],
    },
    {
      slug: 'greenhouse', name: 'The Greenhouse', tagline: 'Grown Green',
      desc: 'Green light grows here. One module feeds two outputs across the glasshouse floor.',
      accent: 'green', W: 7, H: 7,
      sources: [{ r: 0, c: 0, color: 'green' }, { r: 6, c: 6, color: 'cyan' }],
      targets: [
        { r: 6, c: 0, color: 'green' },
        { r: 3, c: 3, color: 'green' },
        { r: 0, c: 6, color: 'cyan' },
      ],
    },
    {
      slug: 'showroom', name: 'The Showroom', tagline: 'Violet Hour',
      desc: 'The new violet module makes its debut. Three sources, four outputs — a full wall of light.',
      accent: 'violet', W: 8, H: 8,
      sources: [
        { r: 7, c: 0, color: 'violet' },
        { r: 0, c: 7, color: 'amber' },
        { r: 7, c: 7, color: 'cyan' },
      ],
      targets: [
        { r: 0, c: 0, color: 'violet' },
        { r: 7, c: 3, color: 'amber' },
        { r: 0, c: 3, color: 'amber' },
        { r: 3, c: 7, color: 'cyan' },
      ],
    },
    {
      slug: 'loft', name: 'The Loft', tagline: 'Split Spectrum',
      desc: 'Top floor, open plan. Two modules feed four outputs along the long walls of the house.',
      accent: 'cyan', W: 8, H: 8,
      sources: [{ r: 7, c: 0, color: 'amber' }, { r: 0, c: 7, color: 'cyan' }],
      targets: [
        { r: 0, c: 0, color: 'amber' },
        { r: 7, c: 5, color: 'amber' },
        { r: 0, c: 4, color: 'cyan' },
        { r: 5, c: 7, color: 'cyan' },
      ],
    },
    {
      slug: 'audi-studio', name: 'The Audi Studio', tagline: 'Grand Finale',
      desc: 'The star of the house: a full Audi A3 door panel with all four light colours. Light every output and the door comes alive.',
      accent: 'violet', W: 8, H: 8,
      sources: [
        { r: 7, c: 0, color: 'amber' },
        { r: 0, c: 3, color: 'cyan' },
        { r: 7, c: 6, color: 'green' },
        { r: 0, c: 7, color: 'violet' },
      ],
      targets: [
        { r: 0, c: 2, color: 'amber' },
        { r: 7, c: 1, color: 'cyan' },
        { r: 0, c: 6, color: 'green' },
        { r: 7, c: 7, color: 'violet' },
      ],
    },
  ];

  // back-compat alias
  const LEVELS = ROOMS;

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

    // carve one path per target, from its nearest source. A single carve can
    // accidentally wall the grid (making a later target unreachable), and the
    // ORDER of carving decides which paths wall which areas — so each attempt
    // shuffles the target order and a fresh random roll almost always works.
    let segsList = null;
    for (let attempt = 0; attempt < 30 && !segsList; attempt++) {
      const occupied = level.sources.slice(); // never step onto other modules
      const paths = [];
      let ok = true;
      for (const t of shuffle(level.targets, r)) {
        const src = level.sources
          .filter((s) => s.color === t.color)
          .sort((a, b) => dist(a, t) - dist(b, t))[0];
        if (!src) { ok = false; break; }
        const occ = occupied.concat(level.targets.filter((x) => x !== t));
        const segs = carvePath(W, H, occ, src, t, r);
        if (!segs) { ok = false; break; }
        paths.push(segs);
        for (const s of segs) occupied.push({ r: s.r, c: s.c });
      }
      if (ok) segsList = paths;
    }
    if (!segsList) return null;

    for (const segs of segsList) {
      for (const s of segs) {
        const open = [s.inDir, s.outDir];
        const rot = 1 + Math.floor(r() * 3); // always start mis-rotated
        cells[s.r * W + s.c] = {
          kind: 'path', open: rotOpen(open, rot), rot,
          solvedOpen: open.slice(), fromPath: true,
        };
        used.push({ r: s.r, c: s.c });
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

    return { W, H, cells, sources: level.sources, targets: level.targets, name: level.name, slug: level.slug, accent: level.accent, optimal };
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

  const logic = { LEVELS, ROOMS, generateLevel, computeLight, rotOpen, LIGHT_COLORS, tileFromOpen, dirBetween, carvePath };

  /* ================= DOM renderer (browser only) ================= */

  if (typeof document !== 'undefined') {
    const $ = (sel) => document.querySelector(sel);

    const state = { room: 0, board: null, moves: 0, busy: false };

    const STORE_KEY = 'munda-light-house-progress';

    function loadProgress() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
    }
    function saveProgress(p) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch { /* private mode — ignore */ }
    }
    const progress = loadProgress();

    function roomsLit() {
      return ROOMS.filter((rm) => progress[rm.slug]).length;
    }

    /* ---------- hub (room map) ---------- */

    function doorSVG(accent, lit) {
      return `<svg class="card-door" viewBox="0 0 60 60" aria-hidden="true">
        <path d="M10 6 C16 4 44 4 50 6 L53 14 C53 40 51 50 50 54 C44 56 16 56 10 54 C9 50 7 40 7 14 Z" fill="#101722" stroke="#2c3b52" stroke-width="2"/>
        <path class="card-strip ${lit ? 'on' : ''}" d="M14 14 C24 11 36 11 46 14"/>
      </svg>`;
    }

    function renderHub() {
      $('#game-hub').hidden = false;
      $('#game-room').hidden = true;
      const map = $('#room-map');
      map.innerHTML = '';
      ROOMS.forEach((rm, i) => {
        const done = progress[rm.slug];
        const card = document.createElement('button');
        card.className = 'room-card acc-' + rm.accent + (done ? ' done' : '');
        card.setAttribute('aria-label', `${rm.name} — ${done ? 'lit' : 'not lit yet'}`);
        card.innerHTML = `
          ${doorSVG(rm.accent, !!done)}
          <span class="room-card-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="room-card-name">${rm.name}</span>
          <span class="room-card-tag">${rm.tagline}</span>
          <span class="room-card-stars">${done ? '★'.repeat(progress[rm.slug].stars) + '☆'.repeat(3 - progress[rm.slug].stars) : '···'}</span>
        `;
        card.addEventListener('click', () => enterRoom(i));
        map.appendChild(card);
      });
      const lit = roomsLit();
      $('#hub-progress-fill').style.width = `${(lit / ROOMS.length) * 100}%`;
      $('#hub-progress-text').textContent = lit === ROOMS.length
        ? 'Every room is lit! 🎉'
        : `${lit} / ${ROOMS.length} rooms lit`;
      $('#hub-status').textContent = lit === ROOMS.length
        ? 'The whole MUNDA Light House is glowing. Well done, lighting engineer!'
        : 'Each door is one lighting puzzle. Light every door to illuminate the house.';
    }

    function showHub() {
      renderHub();
    }

    /* ---------- room view ---------- */

    function enterRoom(idx) {
      state.room = idx;
      $('#game-hub').hidden = true;
      $('#game-room').hidden = false;
      const rm = ROOMS[idx];
      $('#room-title').textContent = rm.name;
      $('#room-tag').textContent = rm.tagline;
      $('#room-desc').textContent = rm.desc;
      $('#room-index').textContent = `Room ${idx + 1} of ${ROOMS.length}`;
      const banner = $('#room-banner');
      banner.classList.remove('acc-amber', 'acc-cyan', 'acc-green', 'acc-violet');
      banner.classList.add('acc-' + rm.accent);
      initLevel(idx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderGrid() {
      const grid = $('#game-grid');
      const b = state.board;
      grid.classList.remove('acc-amber', 'acc-cyan', 'acc-green', 'acc-violet');
      grid.classList.add('acc-' + (b.accent || 'amber'));
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
        el.classList.remove('lit', 'lit-amber', 'lit-cyan', 'lit-green', 'lit-violet');
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
      const rm = ROOMS[state.room];
      const stars = state.moves <= b.optimal + 2 ? 3 : state.moves <= b.optimal + 5 ? 2 : 1;
      // keep the best score for this room
      const prev = progress[rm.slug];
      if (!prev || stars > prev.stars || (stars === prev.stars && state.moves < prev.moves)) {
        progress[rm.slug] = { stars, moves: state.moves, optimal: b.optimal };
        saveProgress(progress);
      }
      $('#game-modal-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      $('#game-modal-moves').textContent = `${state.moves} moves · optimal ${b.optimal}`;
      $('#game-modal-title').textContent = rm.slug === 'audi-studio'
        ? 'The Audi A3 door panel is fully illuminated!'
        : `${rm.name} is lit!`;
      $('#game-modal-sub').textContent = roomsLit() === ROOMS.length
        ? 'Every room in the MUNDA Light House is glowing. Great work, lighting engineer!'
        : `${roomsLit()} of ${ROOMS.length} rooms lit so far.`;
      const door = $('#game-door');
      door.classList.remove('acc-amber', 'acc-cyan', 'acc-green', 'acc-violet');
      door.classList.add('acc-' + (rm.accent || 'amber'));
      door.classList.remove('lit');
      void door.offsetWidth;
      door.classList.add('lit');
      $('#game-modal').hidden = false;
      const isLast = state.room >= ROOMS.length - 1;
      $('#game-next').style.display = isLast ? 'none' : '';
      $('#game-next-label').textContent = 'Next room →';
      if (isLast) {
        $('#game-next-label').textContent = 'See all rooms';
        $('#game-next').style.display = '';
      }
    }

    function initLevel(idx) {
      state.room = idx;
      state.moves = 0;
      state.busy = false;
      const rm = ROOMS[idx];
      $('#game-level-name').textContent = `Room ${idx + 1} · ${rm.tagline}`;
      $('#game-optimal').textContent = '';
      $('#game-modal').hidden = true;
      let board = null;
      for (let attempt = 0; attempt < 400 && !board; attempt++) board = logic.generateLevel(rm);
      if (!board) { $('#game-grid').innerHTML = '<p style="color:var(--text-faint)">Could not generate this room. Reload the page to retry.</p>'; return; }
      state.board = board;
      $('#game-optimal').textContent = `optimal ${board.optimal}`;
      renderGrid();
      refresh();
    }

    function boot() {
      if (!$('#game-grid')) return;
      $('#room-back').addEventListener('click', showHub);
      $('#game-reset').addEventListener('click', () => initLevel(state.room));
      $('#game-next').addEventListener('click', () => {
        if (state.room >= ROOMS.length - 1) showHub();
        else enterRoom(state.room + 1);
      });
      $('#game-restart').addEventListener('click', () => initLevel(state.room));
      showHub();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  return logic;
});
