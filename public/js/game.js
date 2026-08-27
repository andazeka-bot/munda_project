/* ==========================================================================
   MUNDA — "Spot the Difference" mini-game
   --------------------------------------------------------------------------
   All game content lives in the LEVELS array below: each level just needs
   an original/modified image pair, a natural width/height (the pixel space
   the `x`/`y` coordinates below are authored in), a click-tolerance radius,
   and 5 difference points. To add, remove, resize, or re-place a
   difference — or swap in new images entirely — this is the only place
   that needs to change; nothing else in the file knows or cares where the
   data comes from.
   ========================================================================== */

const LEVELS = [
  {
    id: 1,
    title: 'Dashboard Overview',
    difficulty: 'Easy',
    original: '/img/game/level1-original.jpg',
    modified: '/img/game/level1-modified.jpg',
    width: 700,
    height: 364,
    hitRadius: 50,
    differences: [
      { id: 'l1-1', x: 215, y: 75,  label: 'Steering wheel emblem' },
      { id: 'l1-2', x: 395, y: 115, label: 'Upper display icon' },
      { id: 'l1-3', x: 390, y: 195, label: 'Lower display button row' },
      { id: 'l1-4', x: 330, y: 290, label: 'Gear selector knob' },
      { id: 'l1-5', x: 520, y: 300, label: 'Ambient light glow' },
    ],
  },
  {
    id: 2,
    title: 'Infotainment & Console',
    difficulty: 'Medium',
    original: '/img/game/level2-original.jpg',
    modified: '/img/game/level2-modified.jpg',
    width: 700,
    height: 607,
    hitRadius: 40,
    differences: [
      { id: 'l2-1', x: 150, y: 90,  label: 'Navigation icon' },
      { id: 'l2-2', x: 150, y: 300, label: 'Climate icon' },
      { id: 'l2-3', x: 100, y: 360, label: 'Button row icon' },
      { id: 'l2-4', x: 100, y: 430, label: 'Console dial' },
      { id: 'l2-5', x: 480, y: 120, label: 'Trim light line' },
    ],
  },
  {
    id: 3,
    title: 'Steering Wheel & Cluster',
    difficulty: 'Hard',
    original: '/img/game/level3-original.jpg',
    modified: '/img/game/level3-modified.jpg',
    width: 700,
    height: 665,
    hitRadius: 32,
    differences: [
      { id: 'l3-1', x: 260, y: 200, label: 'Wheel emblem detail' },
      { id: 'l3-2', x: 490, y: 160, label: 'Cluster readout' },
      { id: 'l3-3', x: 50,  y: 220, label: 'Wheel-side button' },
      { id: 'l3-4', x: 630, y: 330, label: 'Screen corner icon' },
      { id: 'l3-5', x: 250, y: 480, label: 'Footwell glow' },
    ],
  },
  {
    id: 4,
    title: 'Console & Footwell',
    difficulty: 'Expert',
    original: '/img/game/level4-original.jpg',
    modified: '/img/game/level4-modified.jpg',
    width: 700,
    height: 426,
    hitRadius: 24,
    differences: [
      { id: 'l4-1', x: 60,  y: 40,  label: 'Screen corner button' },
      { id: 'l4-2', x: 290, y: 70,  label: 'Console dial ring' },
      { id: 'l4-3', x: 350, y: 160, label: 'Ambient line midpoint' },
      { id: 'l4-4', x: 520, y: 330, label: 'Floor light dot' },
      { id: 'l4-5', x: 600, y: 250, label: 'Carpet shading' },
    ],
  },
  {
    id: 5,
    title: 'Dash Edge & Window',
    difficulty: 'Master',
    original: '/img/game/level5-original.jpg',
    modified: '/img/game/level5-modified.jpg',
    width: 700,
    height: 513,
    hitRadius: 20,
    differences: [
      { id: 'l5-1', x: 45,  y: 15,  label: 'Mirror corner' },
      { id: 'l5-2', x: 560, y: 90,  label: 'Window reflection' },
      { id: 'l5-3', x: 250, y: 265, label: 'Ambient line point' },
      { id: 'l5-4', x: 45,  y: 245, label: 'Vent dot' },
      { id: 'l5-5', x: 210, y: 400, label: 'Screen edge vent' },
    ],
  },
];

const DIFFS_PER_LEVEL = 5;
const STORAGE_KEY = 'munda_spot_diff_progress_v1';

/* ---------------------------------------------------------------------- */
/* Progress persistence (per-level completion, best time, misses)         */
/* ---------------------------------------------------------------------- */

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt/blocked storage */ }
  return { unlockedLevel: 1, levels: {} };
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) { /* storage unavailable — game still works, just doesn't persist */ }
}

/* ---------------------------------------------------------------------- */
/* Game state machine                                                     */
/* ---------------------------------------------------------------------- */

class SpotDifferenceGame {
  constructor(root) {
    this.root = root;
    this.progress = loadProgress();
    this.level = null;
    this.found = new Set();
    this.misses = 0;
    this.startedAt = 0;
    this.timerHandle = null;
    this.locked = false; // true once a level is won, to ignore further clicks

    this.els = {
      levelGrid: root.querySelector('#level-grid'),
      levelSelectSub: root.querySelector('#level-select-sub'),
      levelSelectView: root.querySelector('#level-select-view'),
      playView: root.querySelector('#play-view'),
      backBtn: root.querySelector('#back-to-levels'),
      resetBtn: root.querySelector('#reset-level'),
      playTitle: root.querySelector('#play-level-title'),
      playDifficulty: root.querySelector('#play-level-difficulty'),
      timer: root.querySelector('#play-timer'),
      missCount: root.querySelector('#play-misses'),
      foundCount: root.querySelector('#found-count'),
      progressDots: root.querySelector('#progress-dots'),
      imgOriginal: root.querySelector('#img-original'),
      imgModified: root.querySelector('#img-modified'),
      paneOriginal: root.querySelector('#pane-original'),
      paneModified: root.querySelector('#pane-modified'),
      markersOriginal: root.querySelector('#markers-original'),
      markersModified: root.querySelector('#markers-modified'),
      winModal: root.querySelector('#level-win-modal'),
      winTitle: root.querySelector('#win-title'),
      winStats: root.querySelector('#win-stats'),
      winNextBtn: root.querySelector('#win-next-btn'),
      winLevelsBtn: root.querySelector('#win-levels-btn'),
      finalModal: root.querySelector('#final-win-modal'),
      finalStats: root.querySelector('#final-stats'),
      finalResetBtn: root.querySelector('#final-reset-btn'),
      resetProgressLink: root.querySelector('#reset-progress-link'),
    };

    this.bindStaticEvents();
    this.renderLevelSelect();
  }

  bindStaticEvents() {
    this.els.backBtn.addEventListener('click', () => this.showLevelSelect());
    this.els.resetBtn.addEventListener('click', () => this.startLevel(this.level.id));
    this.els.winLevelsBtn.addEventListener('click', () => {
      this.hideModal(this.els.winModal);
      this.showLevelSelect();
    });
    this.els.winNextBtn.addEventListener('click', () => {
      this.hideModal(this.els.winModal);
      const nextId = this.level.id + 1;
      if (nextId <= LEVELS.length) this.startLevel(nextId);
      else this.showLevelSelect();
    });
    this.els.finalResetBtn.addEventListener('click', () => {
      this.progress = { unlockedLevel: 1, levels: {} };
      saveProgress(this.progress);
      this.hideModal(this.els.finalModal);
      this.showLevelSelect();
    });
    if (this.els.resetProgressLink) {
      this.els.resetProgressLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (!confirm('Reset all Spot the Difference progress?')) return;
        this.progress = { unlockedLevel: 1, levels: {} };
        saveProgress(this.progress);
        this.renderLevelSelect();
      });
    }

    this.els.paneOriginal.addEventListener('click', (e) => this.handleClick(e, this.els.imgOriginal, this.els.markersOriginal, this.els.paneOriginal));
    this.els.paneModified.addEventListener('click', (e) => this.handleClick(e, this.els.imgModified, this.els.markersModified, this.els.paneModified));
  }

  /* ---------------- level select screen ---------------- */

  renderLevelSelect() {
    const unlocked = this.progress.unlockedLevel || 1;
    const nextLevel = LEVELS.find((l) => l.id === Math.min(unlocked, LEVELS.length));
    if (nextLevel && unlocked <= LEVELS.length) {
      this.els.levelSelectSub.textContent = `Level ${unlocked} of ${LEVELS.length} is waiting for you.`;
    } else {
      this.els.levelSelectSub.textContent = `All ${LEVELS.length} levels cleared — nice eye!`;
    }

    this.els.levelGrid.innerHTML = '';
    LEVELS.forEach((lvl) => {
      const stat = this.progress.levels[lvl.id];
      const isLocked = lvl.id > unlocked;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card' + (isLocked ? ' locked' : '') + (lvl.id === unlocked ? ' current' : '');
      card.disabled = isLocked;

      const stars = stat ? starString(stat.misses) : '';
      card.innerHTML = `
        <div class="lv-icon">${isLocked ? '🔒' : '💡'}</div>
        <div class="lv-num">0${lvl.id}</div>
        <h3>${escapeHtml(lvl.title)}</h3>
        <div class="lv-diff">${escapeHtml(lvl.difficulty)}</div>
        ${stat ? `<div class="lv-stars">${stars}</div><div class="lv-best">best ${(stat.bestTimeMs / 1000).toFixed(1)}s</div>` : `<div class="lv-play">${isLocked ? '' : '▶'}</div>`}
      `;
      if (!isLocked) card.addEventListener('click', () => this.startLevel(lvl.id));
      this.els.levelGrid.appendChild(card);
    });
  }

  showLevelSelect() {
    this.stopTimer();
    this.els.playView.hidden = true;
    this.els.levelSelectView.hidden = false;
    this.renderLevelSelect();
  }

  /* ---------------- playing a level ---------------- */

  startLevel(levelId) {
    const lvl = LEVELS.find((l) => l.id === levelId);
    if (!lvl) return;
    this.level = lvl;
    this.found = new Set();
    this.misses = 0;
    this.locked = false;

    this.els.levelSelectView.hidden = true;
    this.els.playView.hidden = false;
    this.els.playTitle.textContent = `Level ${lvl.id} — ${lvl.title}`;
    this.els.playDifficulty.textContent = lvl.difficulty;
    this.els.playDifficulty.className = 'tag tag-' + lvl.difficulty.toLowerCase();
    this.els.missCount.textContent = '0';
    this.els.foundCount.textContent = '0';

    this.els.imgOriginal.src = lvl.original;
    this.els.imgModified.src = lvl.modified;
    this.els.imgOriginal.alt = `Original Audi interior — level ${lvl.id}`;
    this.els.imgModified.alt = `Modified Audi interior — find the ${DIFFS_PER_LEVEL} differences`;

    [this.els.paneOriginal, this.els.paneModified].forEach((pane) => {
      pane.style.aspectRatio = `${lvl.width} / ${lvl.height}`;
    });

    this.els.markersOriginal.innerHTML = '';
    this.els.markersModified.innerHTML = '';

    this.els.progressDots.innerHTML = '';
    lvl.differences.forEach(() => {
      const dot = document.createElement('span');
      dot.className = 'progress-dot';
      this.els.progressDots.appendChild(dot);
    });

    this.startedAt = performance.now();
    this.startTimer();
  }

  startTimer() {
    this.stopTimer();
    this.timerHandle = setInterval(() => {
      const elapsed = (performance.now() - this.startedAt) / 1000;
      this.els.timer.textContent = `${elapsed.toFixed(1)}s`;
    }, 100);
  }

  stopTimer() {
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.timerHandle = null;
  }

  /* ---------------- click handling ---------------- */

  handleClick(evt, imgEl, markerLayerEl, paneEl) {
    if (!this.level || this.locked) return;
    const rect = imgEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const clickXPct = (evt.clientX - rect.left) / rect.width;
    const clickYPct = (evt.clientY - rect.top) / rect.height;
    const natX = clickXPct * this.level.width;
    const natY = clickYPct * this.level.height;

    const hit = this.findHit(natX, natY);
    if (hit) {
      this.markFound(hit);
    } else {
      this.registerMiss(clickXPct, clickYPct, paneEl, markerLayerEl);
    }
  }

  findHit(natX, natY) {
    const r = this.level.hitRadius;
    for (const diff of this.level.differences) {
      if (this.found.has(diff.id)) continue;
      const dx = natX - diff.x;
      const dy = natY - diff.y;
      if (dx * dx + dy * dy <= r * r) return diff;
    }
    return null;
  }

  markFound(diff) {
    this.found.add(diff.id);
    this.els.foundCount.textContent = String(this.found.size);

    const dots = this.els.progressDots.children;
    const idx = this.level.differences.findIndex((d) => d.id === diff.id);
    if (dots[idx]) dots[idx].classList.add('found');

    const leftPct = (diff.x / this.level.width) * 100;
    const topPct = (diff.y / this.level.height) * 100;
    [this.els.markersOriginal, this.els.markersModified].forEach((layer) => {
      const marker = document.createElement('div');
      marker.className = 'marker marker-found';
      marker.style.left = `${leftPct}%`;
      marker.style.top = `${topPct}%`;
      marker.title = diff.label;
      layer.appendChild(marker);
    });

    this.flashPaneState(this.els.paneModified, 'hit');
    this.flashPaneState(this.els.paneOriginal, 'hit');

    if (this.found.size === this.level.differences.length) {
      this.completeLevel();
    }
  }

  registerMiss(xPct, yPct, paneEl, markerLayerEl) {
    this.misses += 1;
    this.els.missCount.textContent = String(this.misses);

    const marker = document.createElement('div');
    marker.className = 'marker marker-miss';
    marker.style.left = `${xPct * 100}%`;
    marker.style.top = `${yPct * 100}%`;
    markerLayerEl.appendChild(marker);
    setTimeout(() => marker.remove(), 650);

    this.flashPaneState(paneEl, 'miss');
  }

  flashPaneState(paneEl, kind) {
    const cls = kind === 'hit' ? 'flash-hit' : 'flash-miss';
    paneEl.classList.remove(cls);
    // force reflow so the animation can restart if triggered again quickly
    void paneEl.offsetWidth;
    paneEl.classList.add(cls);
    setTimeout(() => paneEl.classList.remove(cls), 420);
  }

  /* ---------------- win handling ---------------- */

  completeLevel() {
    this.locked = true;
    this.stopTimer();
    const timeMs = performance.now() - this.startedAt;

    const prevStat = this.progress.levels[this.level.id];
    const isBest = !prevStat || timeMs < prevStat.bestTimeMs;
    this.progress.levels[this.level.id] = {
      completed: true,
      bestTimeMs: isBest ? timeMs : prevStat.bestTimeMs,
      misses: prevStat ? Math.min(prevStat.misses, this.misses) : this.misses,
    };
    this.progress.unlockedLevel = Math.max(this.progress.unlockedLevel || 1, this.level.id + 1);
    saveProgress(this.progress);

    const stars = starString(this.misses);
    this.els.winTitle.textContent = `Level ${this.level.id} complete!`;
    this.els.winStats.textContent = `Time: ${(timeMs / 1000).toFixed(1)}s · Misses: ${this.misses} · ${stars}`;
    this.els.winNextBtn.hidden = this.level.id >= LEVELS.length;
    this.els.winNextBtn.textContent = this.level.id >= LEVELS.length ? '' : 'Next Level →';

    if (this.level.id >= LEVELS.length) {
      this.showFinalWin();
    } else {
      this.showModal(this.els.winModal);
    }
  }

  showFinalWin() {
    const totalTime = Object.values(this.progress.levels).reduce((sum, s) => sum + s.bestTimeMs, 0);
    const totalMisses = Object.values(this.progress.levels).reduce((sum, s) => sum + s.misses, 0);
    this.els.finalStats.textContent = `All ${LEVELS.length} levels cleared · total best time ${(totalTime / 1000).toFixed(1)}s · ${totalMisses} total misses.`;
    this.showModal(this.els.finalModal);
  }

  showModal(modalEl) { modalEl.hidden = false; }
  hideModal(modalEl) { modalEl.hidden = true; }
}

function starString(misses) {
  const count = misses === 0 ? 3 : misses <= 2 ? 2 : 1;
  return '★★★'.slice(0, count) + '☆☆☆'.slice(0, 3 - count);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('game-root');
  if (root) new SpotDifferenceGame(root);
});
