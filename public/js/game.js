/**
 * MUNDA — "Light Works" adventure game
 * You are the new lighting engineer of the MUNDA Light Works facility. The light
 * grid has gone dark. Explore five zones, collect light orbs, flip switches,
 * dodge dark zones and light the way to the Audi Showroom.
 *
 * Pure logic (zones, movement rules, scoring) is exported for Node testing;
 * the DOM renderer only boots in a browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MundaAdventure = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= pure logic ================= */

  const COLORS = ['amber', 'cyan', 'green', 'violet'];
  const LIGHT = { amber: '#ffb454', cyan: '#54d6e6', green: '#5ee0a0', violet: '#b98cf5' };
  const COLOR_CHAR = { a: 'amber', c: 'cyan', g: 'green', v: 'violet' };

  /**
   * Zone maps are ASCII grids. Legend:
   *   # wall   . floor   P start   E exit portal
   *   a c g v  light orbs (amber/cyan/green/violet)
   *   A C G V  colour gates — open forever once you collect that colour orb
   *   n        light node — deliver an orb to light it up
   *   s        floor switch — opens every door in the zone
   *   d        door — stays shut until a switch is pressed
   *   H        dark zone — touching it zaps you back to the start
   *   t / T    teleporter pair (t jumps to T)
   */
  const MAPS = [
    {
      slug: 'fibre-fields', name: 'Fibre Fields', tagline: 'First Light',
      desc: 'The soft-lit training grounds of the facility. Collect all four light orbs — then the exit portal powers up.',
      accent: 'amber', par: 40, mission: 'collect',
      map: [
        '###########',
        '#P...a....#',
        '#....#....#',
        '#..a....a.#',
        '#....#....#',
        '#a.......E#',
        '###########',
      ],
    },
    {
      slug: 'weave-works', name: 'The Weave Works', tagline: 'Flip the Switch',
      desc: 'The weaving halls. A sealed door blocks the far side — find the floor switch, then grab every orb and escape.',
      accent: 'amber', par: 70, mission: 'collect',
      map: [
        '#############',
        '#P.a....a...#',
        '#.#......a..#',
        '#s#....H....#',
        '#.#.........#',
        '#.#.........#',
        '#.d......E..#',
        '#############',
      ],
    },
    {
      slug: 'colour-lab', name: 'The Colour Lab', tagline: 'Chromatic Keys',
      desc: 'Colour-coded gates block the lab. Cyan orbs open cyan gates, green orbs open green gates — match the light.',
      accent: 'cyan', par: 90, mission: 'collect',
      map: [
        '#############',
        '#P..a......a#',
        '#....#..C...#',
        '#..c..##....#',
        '#..#....#...#',
        '#..##..g#.H.#',
        '#....#......#',
        '#..G......E.#',
        '#############',
      ],
    },
    {
      slug: 'energy-core', name: 'The Energy Core', tagline: 'Charge the Core',
      desc: 'The heart of the Light Works. Teleporters, dark zones and a locked service door — gather five orbs of charge.',
      accent: 'green', par: 110, mission: 'collect',
      map: [
        '###############',
        '#P..a....a....#',
        '#....#....#...#',
        '#.t..#..H.#...#',
        '#....#....#...#',
        '#.s..#....#...#',
        '#....#..a.d...#',
        '#..T....#..#..#',
        '#..a.....a.#E.#',
        '###############',
      ],
    },
    {
      slug: 'audi-showroom', name: 'The Audi Showroom', tagline: 'Grand Finale',
      desc: 'The crown jewel: a full door panel with four light nodes. Collect every colour orb, light all four nodes, then reach the portal.',
      accent: 'violet', par: 150, mission: 'light',
      map: [
        '###############',
        '#P..a..A......#',
        '#....#..C.....#',
        '#..n..##..n...#',
        '#..#....#.....#',
        '#..##..g#.H...#',
        '#....#......v.#',
        '#..n..G...n...#',
        '#..c..V.....E.#',
        '###############',
      ],
    },
  ];

  function parseZone(spec) {
    const map = spec.map;
    const H = map.length, W = map[0].length;
    const zone = {
      slug: spec.slug, name: spec.name, tagline: spec.tagline, desc: spec.desc,
      accent: spec.accent, par: spec.par, mission: spec.mission,
      W, H, walls: [], orbs: [], gates: [], nodes: [], switches: [], doors: [],
      hazards: [], teleporters: [], start: null, exit: null,
    };
    const teles = [];
    for (let r = 0; r < H; r++) {
      const row = map[r];
      if (row.length !== W) throw new Error(`${spec.slug}: row ${r} has ${row.length} chars, expected ${W}`);
      for (let c = 0; c < W; c++) {
        const ch = row[c];
        const cell = { r, c };
        switch (ch) {
          case '#': zone.walls.push(cell); break;
          case 'P': zone.start = cell; break;
          case 'E': zone.exit = cell; break;
          case 'a': case 'c': case 'g': case 'v':
            zone.orbs.push({ ...cell, color: COLOR_CHAR[ch] }); break;
          case 'A': case 'C': case 'G': case 'V':
            zone.gates.push({ ...cell, color: COLOR_CHAR[ch.toLowerCase()] }); break;
          case 'n': zone.nodes.push(cell); break;
          case 's': zone.switches.push(cell); break;
          case 'd': zone.doors.push(cell); break;
          case 'H': zone.hazards.push(cell); break;
          case 't': case 'T': teles.push({ ...cell, ch }); break;
          case '.': break;
          default: throw new Error(`${spec.slug}: unknown char "${ch}" at ${r},${c}`);
        }
      }
    }
    // pair teleporters in order: t jumps to the next T
    const ins = teles.filter((t) => t.ch === 't');
    const outs = teles.filter((t) => t.ch === 'T');
    for (let i = 0; i < Math.min(ins.length, outs.length); i++) {
      zone.teleporters.push({ from: { r: ins[i].r, c: ins[i].c }, to: { r: outs[i].r, c: outs[i].c } });
    }
    if (!zone.start) throw new Error(`${spec.slug}: missing start P`);
    if (!zone.exit) throw new Error(`${spec.slug}: missing exit E`);
    zone.wallSet = new Set(zone.walls.map((w) => w.r * W + w.c));
    zone.teleTo = new Map(zone.teleporters.map((t) => [t.from.r * W + t.from.c, t.to]));
    return zone;
  }

  const ZONES = MAPS.map(parseZone);

  function idx(z, r, c) { return r * z.W + c; }

  function totalPickups(z) { return z.orbs.length + z.nodes.length; }

  /** Mission check for a zone given a live run state. */
  function missionDone(z, run) {
    return z.mission === 'light' ? run.nodesLit >= z.nodes.length : run.pickups >= z.orbs.length;
  }

  /** 1–3 stars: 1 base, +1 all pickups, +1 within par time. */
  function starsFor(z, elapsedSec, pickupsGot) {
    let stars = 1;
    if (pickupsGot >= totalPickups(z)) stars++;
    if (elapsedSec <= z.par) stars++;
    return stars;
  }

  /** Lumen reward for a completed run (before zone-complete bonus). */
  function lumenForRun(z, run, elapsedSec) {
    let lumen = run.pickups * 10;
    if (elapsedSec <= z.par) lumen += 15;
    if (run.pickups >= totalPickups(z)) lumen += 25;
    return lumen;
  }

  const logic = { ZONES, MAPS, parseZone, totalPickups, missionDone, starsFor, lumenForRun, LIGHT, COLORS };

  /* ================= DOM renderer (browser only) ================= */

  if (typeof document !== 'undefined') {
    const $ = (sel) => document.querySelector(sel);

    const STORE_KEY = 'munda-adventure-progress';
    const defaultProgress = { unlocked: 0, lumen: 0, zones: {}, sound: true, seenIntro: false };

    function loadProgress() {
      try { return Object.assign({}, defaultProgress, JSON.parse(localStorage.getItem(STORE_KEY)) || {}); }
      catch { return Object.assign({}, defaultProgress); }
    }
    function saveProgress() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch { /* ignore */ }
    }
    const progress = loadProgress();

    const state = {
      view: 'hub', zone: 0, pos: { r: 0, c: 0 }, orbs: 0,
      colors: new Set(), switches: 0, nodesLit: 0, pickups: 0,
      collectedOrbs: new Set(), litNodes: new Set(),
      startTime: 0, elapsed: 0, moves: 0, busy: false, timer: null,
      walkQueue: [], walkTimer: null,
    };

    /* ---------- sound (tiny WebAudio synth, no assets) ---------- */

    let audioCtx = null;
    function tone(freq, dur, type, gain, when) {
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const t = audioCtx.currentTime + (when || 0);
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(gain || 0.08, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
        osc.connect(g).connect(audioCtx.destination);
        osc.start(t); osc.stop(t + (dur || 0.2) + 0.02);
      } catch { /* audio unavailable */ }
    }
    const sfx = {
      blip() { if (progress.sound) tone(660, 0.09, 'sine', 0.07); },
      key() { if (progress.sound) { tone(520, 0.08, 'triangle', 0.07); tone(780, 0.1, 'triangle', 0.06, 0.07); } },
      switch() { if (progress.sound) { tone(300, 0.1, 'square', 0.05); tone(560, 0.12, 'square', 0.05, 0.09); } },
      door() { if (progress.sound) tone(220, 0.25, 'sawtooth', 0.04); },
      fizz() { if (progress.sound) { tone(200, 0.25, 'sawtooth', 0.06); tone(120, 0.3, 'sawtooth', 0.05, 0.08); } },
      tele() { if (progress.sound) { tone(880, 0.12, 'sine', 0.06); tone(1320, 0.14, 'sine', 0.05, 0.08); } },
      node() { if (progress.sound) { tone(523, 0.1, 'sine', 0.08); tone(659, 0.1, 'sine', 0.08, 0.09); tone(784, 0.16, 'sine', 0.08, 0.18); } },
      chime() { if (progress.sound) { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'sine', 0.07, i * 0.11)); } },
      blocked() { if (progress.sound) tone(160, 0.08, 'square', 0.04); },
    };

    /* ---------- hub ---------- */

    function zoneIcon(z, done) {
      return `<svg class="zone-icon" viewBox="0 0 60 60" aria-hidden="true">
        <rect x="12" y="10" width="36" height="40" rx="6" fill="#101722" stroke="#2c3b52" stroke-width="2"/>
        <circle class="zi-core ${done ? 'on' : ''}" cx="30" cy="30" r="9"/>
      </svg>`;
    }

    function renderHub() {
      $('#game-hub').hidden = false;
      $('#game-zone').hidden = true;
      $('#game-modal').hidden = true;
      const map = $('#zone-map');
      map.innerHTML = '';
      ZONES.forEach((z, i) => {
        const done = progress.zones[z.slug];
        const unlocked = i <= progress.unlocked;
        const card = document.createElement('button');
        card.className = 'zone-card acc-' + z.accent + (done ? ' done' : '') + (unlocked ? '' : ' locked');
        card.setAttribute('aria-label', `${z.name} — ${done ? 'completed' : unlocked ? 'ready to play' : 'locked'}`);
        card.innerHTML = `
          ${zoneIcon(z, !!done)}
          <span class="zone-card-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="zone-card-name">${z.name}</span>
          <span class="zone-card-tag">${z.tagline}</span>
          <span class="zone-card-stars">${done ? '★'.repeat(done.stars) + '☆'.repeat(3 - done.stars) : unlocked ? '▶' : '🔒'}</span>
          ${done ? `<span class="zone-card-time">best ${done.time}s</span>` : ''}
        `;
        card.addEventListener('click', () => { if (unlocked) enterZone(i); });
        map.appendChild(card);
      });
      const allDone = ZONES.every((z) => progress.zones[z.slug]);
      $('#lumen-total').textContent = progress.lumen;
      $('#hub-status').textContent = allDone
        ? 'The Light Works is fully lit. You are the Lighting Engineer! 🏆'
        : `Zone ${Math.min(progress.unlocked + 1, ZONES.length)} of ${ZONES.length} is waiting for you.`;
      const snd = $('#sound-toggle');
      snd.textContent = progress.sound ? '🔊' : '🔇';
    }

    function showHub() { renderHub(); }

    /* ---------- zone rendering ---------- */

    let cellPx = 44;

    function buildZoneView() {
      const z = ZONES[state.zone];
      const wrap = $('#zone-board');
      const avail = Math.min(wrap.clientWidth || 620, 680);
      cellPx = Math.min(46, Math.max(22, Math.floor(avail / z.W)));
      if (cellPx * z.H > 540) cellPx = Math.max(20, Math.floor(540 / z.H));
      wrap.style.width = cellPx * z.W + 'px';
      wrap.style.height = cellPx * z.H + 'px';

      const grid = $('#zone-grid');
      grid.innerHTML = '';
      grid.style.gridTemplateColumns = `repeat(${z.W}, ${cellPx}px)`;
      for (let r = 0; r < z.H; r++) {
        for (let c = 0; c < z.W; c++) {
          const cell = z.wallSet.has(idx(z, r, c));
          const tile = document.createElement('div');
          tile.className = 'ztile' + (cell ? ' wall' : '');
          tile.dataset.r = r; tile.dataset.c = c;
          grid.appendChild(tile);
        }
      }
      // overlays on top of the floor
      const ov = $('#zone-overlays');
      ov.innerHTML = '';
      const addOverlay = (r, c, cls, extra) => {
        const el = document.createElement('div');
        el.className = 'ztile ov ' + cls;
        el.style.left = c * cellPx + 'px';
        el.style.top = r * cellPx + 'px';
        el.style.width = cellPx + 'px';
        el.style.height = cellPx + 'px';
        if (extra) el.innerHTML = extra;
        ov.appendChild(el);
        return el;
      };
      z.orbs.forEach((o) => addOverlay(o.r, o.c, 'orb orb-' + o.color));
      z.gates.forEach((g) => addOverlay(g.r, g.c, 'gate gate-' + g.color));
      z.nodes.forEach((n) => addOverlay(n.r, n.c, 'node'));
      z.switches.forEach((s) => addOverlay(s.r, s.c, 'switch'));
      z.doors.forEach((d) => addOverlay(d.r, d.c, 'door'));
      z.hazards.forEach((h) => addOverlay(h.r, h.c, 'hazard'));
      z.teleporters.forEach((t) => { addOverlay(t.from.r, t.from.c, 'tele'); addOverlay(t.to.r, t.to.c, 'tele-out'); });
      addOverlay(z.exit.r, z.exit.c, 'exit', 'E');
      // player
      const p = document.createElement('div');
      p.id = 'player';
      p.className = 'player acc-' + z.accent;
      ov.appendChild(p);
      state.playerEl = p;
      placePlayer(true);
      // banner + mission
      $('#zone-title').textContent = z.name;
      $('#zone-tag').textContent = z.tagline;
      $('#zone-desc').textContent = z.desc;
      $('#zone-name').textContent = `Zone ${state.zone + 1} of ${ZONES.length}`;
      const banner = $('#zone-banner');
      banner.classList.remove('acc-amber', 'acc-cyan', 'acc-green', 'acc-violet');
      banner.classList.add('acc-' + z.accent);
      updateMission();
    }

    function placePlayer(instant) {
      const z = ZONES[state.zone];
      const el = state.playerEl;
      if (el) {
        if (instant) el.style.transition = 'none';
        el.style.transform = `translate(${state.pos.c * cellPx}px, ${state.pos.r * cellPx}px)`;
        if (instant) { void el.offsetWidth; el.style.transition = ''; }
      }
      // keep the exit tile visible for aria
      document.querySelectorAll('.ztile.ov.exit').forEach((e) => {
        e.setAttribute('aria-label', state.view === 'zone' ? 'exit portal' : '');
      });
    }

    function updateMission() {
      const z = ZONES[state.zone];
      const portal = missionDone(z, {
        nodesLit: state.litNodes.size, pickups: state.pickups,
      });
      if (z.mission === 'light') {
        $('#mission-text').textContent = `Light the nodes: ${state.litNodes.size}/${z.nodes.length}`;
        $('#goal-text').textContent = `🎯 Goal: light ${z.nodes.length} nodes, then reach the portal`;
      } else {
        $('#mission-text').textContent = `Collect orbs: ${Math.min(state.pickups, z.orbs.length)}/${z.orbs.length}`;
        $('#goal-text').textContent = `🎯 Goal: collect ${z.orbs.length} orbs, then reach the portal`;
      }
      $('#portal-status').textContent = portal ? 'Portal active — reach it!' : 'Portal inactive — complete the mission';
      $('#portal-status').className = 'portal-status ' + (portal ? 'on' : '');
      $('#hud-orbs').textContent = state.orbs;
      $('#hud-moves').textContent = state.moves;
      $('#hud-time').textContent = Math.floor(state.elapsed) + 's';
    }

    /* ---------- movement ---------- */

    const MOVES = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const KEYMAP = { w: 'ArrowUp', W: 'ArrowUp', s: 'ArrowDown', S: 'ArrowDown', a: 'ArrowLeft', A: 'ArrowLeft', d: 'ArrowRight', D: 'ArrowRight' };

    /** BFS route from `from` to `to` over currently-walkable cells (walls,
     *  locked gates/doors, dark zones and teleporters excluded). Returns the
     *  list of cells to step onto (excluding `from`), or null if unreachable. */
    function bfsPath(z, from, to) {
      const W = z.W, H = z.H;
      const start = from.r * W + from.c, goal = to.r * W + to.c;
      if (start === goal) return [];
      const prev = new Map();
      const seen = new Set([start]);
      const q = [from];
      let head = 0;
      while (head < q.length) {
        const cur = q[head++];
        const ci = cur.r * W + cur.c;
        if (ci === goal) break;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = cur.r + dr, nc = cur.c + dc;
          if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
          const ni = nr * W + nc;
          if (seen.has(ni)) continue;
          if (z.wallSet.has(ni)) continue;
          if (z.hazards.some((h) => h.r === nr && h.c === nc)) continue;
          const gate = z.gates.find((g) => g.r === nr && g.c === nc);
          if (gate && !state.colors.has(gate.color)) continue;
          if (z.doors.some((d) => d.r === nr && d.c === nc) && state.switches === 0) continue;
          if (z.teleTo.has(ni)) continue; // don't route through teleporters
          seen.add(ni);
          prev.set(ni, { r: cur.r, c: cur.c });
          q.push({ r: nr, c: nc });
        }
      }
      if (!prev.has(goal)) return null;
      const path = [];
      let cur = { r: Math.floor(goal / W), c: goal % W };
      while (!(cur.r === from.r && cur.c === from.c)) {
        path.push(cur);
        cur = prev.get(cur.r * W + cur.c);
      }
      return path.reverse();
    }

    function stopWalking() {
      if (state.walkTimer) { clearInterval(state.walkTimer); state.walkTimer = null; }
      state.walkQueue = [];
    }

    function walkTo(r, c) {
      const z = ZONES[state.zone];
      if (r === state.pos.r && c === state.pos.c) return;
      const path = bfsPath(z, state.pos, { r, c });
      if (!path) { hint('No path there — blocked!'); sfx.blocked(); return; }
      stopWalking();
      state.walkQueue = path;
      state.walkTimer = setInterval(() => {
        if (!state.walkQueue.length || state.view !== 'zone' || state.busy) {
          if (!state.walkQueue.length || state.view !== 'zone') stopWalking();
          return;
        }
        const next = state.walkQueue.shift();
        const dr = next.r - state.pos.r, dc = next.c - state.pos.c;
        const dir = dr === -1 ? 'ArrowUp' : dr === 1 ? 'ArrowDown' : dc === -1 ? 'ArrowLeft' : 'ArrowRight';
        const before = { r: state.pos.r, c: state.pos.c };
        tryMove(dir);
        if (state.pos.r === before.r && state.pos.c === before.c) stopWalking(); // stuck
      }, 110);
    }

    function tryMove(dir) {
      if (state.busy || state.view !== 'zone') return;
      const z = ZONES[state.zone];
      const [dr, dc] = MOVES[dir];
      const nr = state.pos.r + dr, nc = state.pos.c + dc;
      if (nr < 0 || nr >= z.H || nc < 0 || nc >= z.W) { hint('Edge of the map!'); sfx.blocked(); return; }
      const ni = idx(z, nr, nc);
      if (z.wallSet.has(ni)) { hint('Wall — try another direction!'); sfx.blocked(); return; }
      // gates need their colour orb
      const gate = z.gates.find((g) => g.r === nr && g.c === nc);
      if (gate && !state.colors.has(gate.color)) { hint(`Need a ${gate.color} orb to pass!`); sfx.blocked(); return; }
      // doors need a switch
      if (z.doors.some((d) => d.r === nr && d.c === nc) && state.switches === 0) { hint('Find the floor switch first!'); sfx.blocked(); return; }

      state.pos = { r: nr, c: nc };
      state.moves++;
      placePlayer();
      const el = state.playerEl;

      // hazard: zap back to start
      if (z.hazards.some((h) => h.r === nr && h.c === nc)) {
        sfx.fizz();
        state.busy = true;
        el.classList.add('zapped');
        setTimeout(() => {
          el.classList.remove('zapped');
          state.pos = { r: z.start.r, c: z.start.c };
          placePlayer();
          state.busy = false;
          hint('Dark zone! Back to the start.');
        }, 350);
        return;
      }
      // teleporter
      const tp = z.teleTo.get(ni);
      if (tp) {
        sfx.tele();
        state.busy = true;
        el.classList.add('teleporting');
        setTimeout(() => {
          state.pos = { r: tp.r, c: tp.c };
          placePlayer(true);
          el.classList.remove('teleporting');
          state.busy = false;
        }, 220);
        return;
      }
      // orb pickup (tracked by index — never mutate the shared zone data)
      const oi = z.orbs.findIndex((o) => o.r === nr && o.c === nc);
      if (oi >= 0 && !state.collectedOrbs.has(oi)) {
        const orb = z.orbs[oi];
        state.collectedOrbs.add(oi);
        state.orbs++;
        state.pickups++;
        state.colors.add(orb.color);
        sfx.key();
        spark(nr, nc, orb.color);
        const tile = overlayAt(nr, nc);
        if (tile) { tile.classList.add('taken'); setTimeout(() => tile.remove(), 300); }
      }
      // node delivery
      const nodeIdx = z.nodes.findIndex((n) => n.r === nr && n.c === nc);
      if (nodeIdx >= 0 && !state.litNodes.has(nodeIdx)) {
        if (state.orbs > 0) {
          state.litNodes.add(nodeIdx);
          state.orbs--;
          state.nodesLit++;
          state.pickups++;
          sfx.node();
          burst(nr, nc, z.accent);
          const tile = overlayAt(nr, nc);
          if (tile) tile.classList.add('lit');
        } else {
          hint('Bring a light orb here to light this node!');
        }
      }
      // switch
      if (z.switches.some((s) => s.r === nr && s.c === nc) && state.switches === 0) {
        state.switches = 1;
        sfx.switch();
        document.querySelectorAll('.ztile.ov.door').forEach((d) => {
          d.classList.add('open');
          setTimeout(() => d.classList.add('gone'), 350);
        });
        const st = overlayAt(nr, nc);
        if (st) st.classList.add('fired');
        hint('Switch pressed — the door is open!');
      }
      // exit
      if (z.exit.r === nr && z.exit.c === nc) {
        if (missionDone(z, state)) { completeZone(); return; }
        hint('Portal needs more power!');
        sfx.blocked();
        return;
      }
      updateMission();
    }

    function overlayAt(r, c) {
      return document.querySelector(`.ztile.ov[style*="left: ${c * cellPx}px"][style*="top: ${r * cellPx}px"]`);
    }

    let hintTimer = null;
    function hint(msg) {
      const el = $('#game-hint');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => el.classList.remove('show'), 1600);
    }

    function spark(r, c, color) {
      const wrap = $('#zone-overlays');
      const s = document.createElement('div');
      s.className = 'spark spark-' + color;
      s.style.left = (c * cellPx + cellPx / 2) + 'px';
      s.style.top = (r * cellPx + cellPx / 2) + 'px';
      wrap.appendChild(s);
      setTimeout(() => s.remove(), 600);
    }

    function burst(r, c, color) {
      const wrap = $('#zone-overlays');
      const b = document.createElement('div');
      b.className = 'burst burst-' + (color || 'amber');
      b.style.left = (c * cellPx + cellPx / 2) + 'px';
      b.style.top = (r * cellPx + cellPx / 2) + 'px';
      wrap.appendChild(b);
      setTimeout(() => b.remove(), 700);
    }

    /* ---------- zone lifecycle ---------- */

    function enterZone(i) {
      state.zone = i;
      state.view = 'zone';
      state.pos = { r: ZONES[i].start.r, c: ZONES[i].start.c };
      state.orbs = 0; state.colors = new Set(); state.switches = 0;
      state.nodesLit = 0; state.pickups = 0; state.moves = 0; state.busy = false;
      state.collectedOrbs = new Set(); state.litNodes = new Set();
      stopWalking();
      state.startTime = Date.now();
      $('#game-hub').hidden = true;
      $('#game-zone').hidden = false;
      $('#game-modal').hidden = true;
      buildZoneView();
      updateMission();
      clearInterval(state.timer);
      state.timer = setInterval(() => {
        state.elapsed = (Date.now() - state.startTime) / 1000;
        $('#hud-time').textContent = Math.floor(state.elapsed) + 's';
      }, 250);
      // focus the board so arrow keys / WASD work immediately
      const board = $('#zone-board');
      if (board && board.focus) board.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (i === 0 && !progress.seenIntro) { progress.seenIntro = true; saveProgress(); showIntro(); }
    }

    function showIntro() {
      $('#intro-modal').hidden = false;
    }

    function completeZone() {
      const z = ZONES[state.zone];
      state.elapsed = (Date.now() - state.startTime) / 1000;
      clearInterval(state.timer);
      const stars = starsFor(z, state.elapsed, state.pickups);
      const lumen = lumenForRun(z, state, state.elapsed) + 25; // +25 zone completion
      const prev = progress.zones[z.slug];
      const best = !prev || stars > prev.stars || (stars === prev.stars && state.elapsed < prev.time);
      if (best) progress.zones[z.slug] = { stars, time: Math.round(state.elapsed) };
      progress.lumen += lumen;
      if (state.zone === progress.unlocked && progress.unlocked < ZONES.length - 1) progress.unlocked++;
      saveProgress();

      $('#game-modal-title').textContent = z.slug === 'audi-showroom' ? 'The Light Works is fully lit!' : `${z.name} — lights restored!`;
      $('#game-modal-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      $('#game-modal-stats').textContent = `${Math.floor(state.elapsed)}s · ${state.pickups}/${totalPickups(z)} pickups · +${lumen} Lumen${best ? ' · new best!' : ''}`;
      $('#game-modal').hidden = false;
      $('#game-next').style.display = state.zone < ZONES.length - 1 ? '' : 'none';
      $('#game-next-label').textContent = 'Next zone →';
      if (state.zone >= ZONES.length - 1) {
        $('#game-next-label').textContent = 'Back to the hub';
        $('#game-next').style.display = '';
      }
      sfx.chime();
    }

    /* ---------- boot ---------- */

    function boot() {
      if (!$('#zone-map')) return;
      document.addEventListener('keydown', (e) => {
        const dir = MOVES[e.key] || KEYMAP[e.key];
        if (dir) { e.preventDefault(); tryMove(dir); return; }
        if (e.key === 'Escape' && state.view === 'zone') showHub();
        if ((e.key === 'r' || e.key === 'R') && state.view === 'zone') enterZone(state.zone);
        if (e.key === 'Enter' && !$('#game-modal').hidden && state.view === 'zone') {
          if (state.zone < ZONES.length - 1) enterZone(state.zone + 1); else showHub();
        }
      });
      // on-screen D-pad (touch & mouse)
      $('#dpad-up').addEventListener('click', () => tryMove('ArrowUp'));
      $('#dpad-down').addEventListener('click', () => tryMove('ArrowDown'));
      $('#dpad-left').addEventListener('click', () => tryMove('ArrowLeft'));
      $('#dpad-right').addEventListener('click', () => tryMove('ArrowRight'));
      $('#zone-restart').addEventListener('click', () => enterZone(state.zone));
      $('#zone-exit').addEventListener('click', showHub);
      // click a tile on the board → the player WALKS there on its own
      // (mouse-only movement; browsers/webviews often grab the arrow keys)
      const board = $('#zone-board');
      if (board) {
        board.addEventListener('click', (e) => {
          board.focus();
          if (state.view !== 'zone') return;
          const rect = board.getBoundingClientRect();
          const c = Math.floor((e.clientX - rect.left) / cellPx);
          const r = Math.floor((e.clientY - rect.top) / cellPx);
          walkTo(r, c);
        });
      }
      $('#game-next').addEventListener('click', () => {
        if (state.zone < ZONES.length - 1) enterZone(state.zone + 1); else showHub();
      });
      $('#game-replay').addEventListener('click', () => enterZone(state.zone));
      $('#intro-start').addEventListener('click', () => { $('#intro-modal').hidden = true; });
      $('#sound-toggle').addEventListener('click', () => {
        progress.sound = !progress.sound; saveProgress(); renderHub();
        if (progress.sound) sfx.blip();
      });
      $('#reset-progress').addEventListener('click', () => {
        if (confirm('Reset all game progress?')) {
          Object.assign(progress, JSON.parse(JSON.stringify(defaultProgress)));
          saveProgress(); renderHub();
        }
      });
      showHub();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  return logic;
});
