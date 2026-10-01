/**
 * LogoBlur — daily logo-guessing game
 * Deterministic puzzle from America/Chicago date key.
 */

const ROUNDS = 5;
const MAX_POINTS_PER_ROUND = 200;
const MAX_SHARPENS = 5;
/** Blur radius (px) at each sharpen level: index = sharpens used */
const BLUR_LEVELS = [42, 28, 18, 11, 6, 0];
const SITE_URL = "https://logoblur.game"; // placeholder
const STORAGE_KEY = "logoblur_v1";

const main = document.getElementById("main");
const dateLabel = document.getElementById("date-label");
const streakLabel = document.getElementById("streak-label");
const toastEl = document.getElementById("toast");

/** @type {object} */
let state = null;

// ——— Date / Chicago calendar day ————————————————————————————————

function chicagoDateKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatDisplayDate(dateKey) {
  const [, m, day] = dateKey.split("-");
  return `${m}/${day}`;
}

// ——— Deterministic RNG ———————————————————————————————————————————

function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickDailyLogos(logos, dateKey, count = ROUNDS) {
  const rng = mulberry32(hashString(`logoblur:${dateKey}`));
  const pool = logos.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// ——— Fuzzy match —————————————————————————————————————————————————

function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

function matchesBrand(guess, brand) {
  const g = normalize(guess);
  if (!g) return false;
  const candidates = [brand.name, ...(brand.aliases || [])].map(normalize);
  for (const c of candidates) {
    if (!c) continue;
    // Exact match always (supports single-letter brands like "X")
    if (g === c) return true;
    // Typo tolerance only for longer guesses/names (avoid false positives)
    if (g.length < 2 || c.length <= 4) continue;
    const maxDist = c.length <= 7 ? 1 : 2;
    if (levenshtein(g, c) <= maxDist) return true;
  }
  return false;
}

// ——— Scoring ——————————————————————————————————————————————————————
// Correct: points = max(0, 200 - sharpens * 40)
// Miss / skip: 0
// Emoji (Wordle-ish “how early”):
//   🟩 0–1 sharpens + correct
//   🟨 2–3 sharpens + correct
//   🟥 miss, or correct with 4+ sharpens

function scoreResult(correct, sharpens) {
  if (!correct) {
    return { points: 0, emoji: "🟥", correct: false, sharpens };
  }
  const points = Math.max(0, MAX_POINTS_PER_ROUND - sharpens * 40);
  let emoji;
  if (sharpens <= 1) emoji = "🟩";
  else if (sharpens <= 3) emoji = "🟨";
  else emoji = "🟥";
  return { points, emoji, correct: true, sharpens };
}

// ——— Persistence ——————————————————————————————————————————————————

function loadStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getStreak(store) {
  return store.streak || 0;
}

function updateStreakOnFinish(store, dateKey, total) {
  const yesterday = (() => {
    const [y, m, d] = dateKey.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    utc.setUTCDate(utc.getUTCDate() - 1);
    return utc.toISOString().slice(0, 10);
  })();

  let streak = store.streak || 0;
  if (store.lastPlayed === dateKey) {
    // already counted
  } else if (store.lastPlayed === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }

  store.streak = streak;
  store.lastPlayed = dateKey;
  store.results = store.results || {};
  store.results[dateKey] = {
    total,
    correctCount: state.guesses.filter((g) => g.correct).length,
    totalReveals: state.guesses.reduce((s, g) => s + g.sharpens, 0),
    emojis: state.guesses.map((g) => g.emoji).join(""),
    guesses: state.guesses.map((g) => ({
      name: g.name,
      correct: g.correct,
      sharpens: g.sharpens,
      points: g.points,
      emoji: g.emoji,
    })),
  };
  saveStorage(store);
  return streak;
}

// ——— Share ————————————————————————————————————————————————————————

function buildShareText(dateKey, guesses, streak) {
  const emojis = guesses.map((g) => g.emoji).join("");
  const correct = guesses.filter((g) => g.correct).length;
  const reveals = guesses.reduce((s, g) => s + g.sharpens, 0);
  const dateStr = formatDisplayDate(dateKey);
  let text = `LogoBlur ${dateStr}  ${emojis}  ${correct}/${ROUNDS} · ${reveals} reveals`;
  if (streak > 0) text += `\n🔥 Streak: ${streak}`;
  text += `\n${SITE_URL}`;
  return text;
}

async function copyShare(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Copied to clipboard!");
    } catch {
      showToast("Copy failed — select the text manually");
    }
    document.body.removeChild(ta);
  }
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.hidden = true;
  }, 2000);
}

// ——— Color helpers ————————————————————————————————————————————————

function isLightColor(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // relative luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65;
}

function initialsFor(brand) {
  const name = brand.name.replace(/['']/g, "");
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  // Single word: first 1–2 letters (McDonald's → Mc via aliases handled elsewhere)
  if (name.length <= 3) return name.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function currentBlurPx() {
  const idx = Math.min(state.sharpens, BLUR_LEVELS.length - 1);
  return BLUR_LEVELS[idx];
}

// ——— UI ————————————————————————————————————————————————————————————

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRoundDots() {
  const dots = [];
  for (let i = 0; i < ROUNDS; i++) {
    let cls = "dot";
    if (i < state.guesses.length) {
      const e = state.guesses[i].emoji;
      if (e === "🟩") cls += " done-green";
      else if (e === "🟨") cls += " done-yellow";
      else cls += " done-red";
    } else if (i === state.round && !state.finished && !state.revealing) {
      cls += " current";
    }
    dots.push(`<span class="${cls}"></span>`);
  }
  return `<div class="round-dots">${dots.join("")}</div>`;
}

function logoMarkup(brand, blurPx, fullyClear) {
  const light = isLightColor(brand.color);
  const tileClass = light ? "light-tile" : "dark-tile";
  const blurStyle = fullyClear ? "filter: none" : `filter: blur(${blurPx}px)`;
  let inner;
  if (brand.svg) {
    inner = `<img src="${escapeHtml(brand.svg)}" alt="" draggable="false" />`;
  } else {
    inner = `<span class="logo-initials">${escapeHtml(initialsFor(brand))}</span>`;
  }
  return `
    <div class="logo-stage ${tileClass}${fullyClear ? " revealed" : ""}" style="background:${escapeHtml(brand.color)}">
      <div class="logo-blur-wrap" style="${blurStyle}">
        ${inner}
      </div>
    </div>
  `;
}

function blurPips() {
  const pips = [];
  for (let i = 0; i < MAX_SHARPENS; i++) {
    pips.push(`<span class="blur-pip${i < state.sharpens ? " on" : ""}"></span>`);
  }
  return pips.join("");
}

function renderPlay() {
  const brand = state.puzzle[state.round];
  const blur = currentBlurPx();
  const canSharpen = state.sharpens < MAX_SHARPENS;

  main.innerHTML = `
    <div class="card">
      <div class="round-bar">
        <span>Logo ${state.round + 1} of ${ROUNDS}</span>
        ${renderRoundDots()}
        <span>${state.total} pts</span>
      </div>
      ${logoMarkup(brand, blur, false)}
      <div class="blur-meter">
        <span>Sharpens: ${state.sharpens}/${MAX_SHARPENS}</span>
        <div class="blur-pips">${blurPips()}</div>
      </div>
      <form id="guess-form" class="guess-row" autocomplete="off">
        <input
          type="text"
          id="guess-input"
          placeholder="Brand name…"
          enterkeyhint="done"
          autocapitalize="words"
          autocomplete="off"
          spellcheck="false"
          aria-label="Guess brand name"
        />
        <button type="submit" class="btn btn-primary btn-guess-inline">Guess</button>
      </form>
      <div class="action-row">
        <button type="button" class="btn btn-secondary" id="btn-sharpen" ${canSharpen ? "" : "disabled"}>
          Sharpen (−40 pts)
        </button>
        <button type="button" class="btn btn-danger" id="btn-skip">Skip</button>
      </div>
      <p class="hint-wrong" id="hint-wrong"></p>
      <p class="demo-note">Demo logos · Simple Icons (CC0) + initial tiles</p>
    </div>
  `;

  const input = document.getElementById("guess-input");
  const hint = document.getElementById("hint-wrong");
  input.focus();

  document.getElementById("guess-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    if (matchesBrand(val, brand)) {
      submitRound(true);
    } else {
      hint.textContent = "Not quite — try again or sharpen";
      input.select();
    }
  });

  document.getElementById("btn-sharpen").addEventListener("click", () => {
    if (state.sharpens >= MAX_SHARPENS) return;
    state.sharpens += 1;
    state.totalReveals += 1;
    renderPlay();
  });

  document.getElementById("btn-skip").addEventListener("click", () => {
    submitRound(false);
  });
}

function submitRound(correct) {
  const brand = state.puzzle[state.round];
  const result = scoreResult(correct, state.sharpens);
  result.name = brand.name;
  state.guesses.push(result);
  state.total += result.points;
  renderReveal(result, brand);
}

function renderReveal(result, brand) {
  state.revealing = true;
  const sharpenLabel =
    result.sharpens === 0
      ? "No sharpens"
      : result.sharpens === 1
        ? "1 sharpen"
        : `${result.sharpens} sharpens`;

  main.innerHTML = `
    <div class="card">
      <div class="round-bar">
        <span>Logo ${state.round + 1} of ${ROUNDS}</span>
        ${renderRoundDots()}
        <span>${state.total} pts</span>
      </div>
      ${logoMarkup(brand, 0, true)}
      <div class="reveal">
        <div class="reveal-emoji">${result.emoji}</div>
        <p class="reveal-name">${escapeHtml(brand.name)}</p>
        <p class="reveal-delta">${
          result.correct
            ? `Got it · ${sharpenLabel}`
            : `Skipped · ${sharpenLabel}`
        }</p>
        <p class="reveal-points${result.correct ? "" : " miss"}">${
          result.correct ? `+${result.points} points` : "0 points"
        }</p>
        <button class="btn btn-primary" id="btn-next">
          ${state.round + 1 >= ROUNDS ? "See results" : "Next logo"}
        </button>
      </div>
    </div>
  `;

  document.getElementById("btn-next").addEventListener("click", () => {
    state.revealing = false;
    state.round += 1;
    state.sharpens = 0;
    if (state.round >= ROUNDS) {
      finishGame();
    } else {
      renderPlay();
    }
  });
}

function finishGame() {
  state.finished = true;
  const store = loadStorage();
  const streak = updateStreakOnFinish(store, state.dateKey, state.total);
  streakLabel.textContent = `🔥 ${streak}`;
  renderEnd(streak);
}

function renderEnd(streak) {
  const correct = state.guesses.filter((g) => g.correct).length;
  const reveals = state.guesses.reduce((s, g) => s + g.sharpens, 0);
  const share = buildShareText(state.dateKey, state.guesses, streak);
  const summary = state.guesses
    .map(
      (g) => `
      <li>
        <span class="emoji">${g.emoji}</span>
        <span class="detail">
          <strong>${escapeHtml(g.name)}</strong> · ${
            g.correct ? "correct" : "miss"
          } · ${g.sharpens} sharpen${g.sharpens === 1 ? "" : "s"} · +${g.points}
        </span>
      </li>`
    )
    .join("");

  main.innerHTML = `
    <div class="card end-screen">
      <h2>Today's LogoBlur</h2>
      <p class="already-played">${formatDisplayDate(state.dateKey)} · America/Chicago</p>
      <div class="emojis">${state.guesses.map((g) => g.emoji).join("")}</div>
      <div class="score-big">${state.total}<span>/1000</span></div>
      <p class="stats-line">${correct}/${ROUNDS} correct · ${reveals} reveals</p>
      <p class="stats-line">🔥 Streak: ${streak}</p>
      <pre class="share-preview" id="share-preview">${escapeHtml(share)}</pre>
      <button class="btn btn-primary" id="btn-share">Copy share card</button>
      <ul class="round-summary">${summary}</ul>
    </div>
  `;

  document.getElementById("btn-share").addEventListener("click", () => copyShare(share));
}

// ——— Boot ——————————————————————————————————————————————————————————

async function boot() {
  const dateKey = chicagoDateKey();
  dateLabel.textContent = formatDisplayDate(dateKey);

  const store = loadStorage();
  streakLabel.textContent = store.streak ? `🔥 ${store.streak}` : "🔥 0";

  let logos;
  try {
    const res = await fetch("logos.json");
    if (!res.ok) throw new Error("Failed to load logos");
    logos = await res.json();
  } catch (err) {
    main.innerHTML = `<div class="card error-box"><p>Could not load logos.json.</p><p style="font-size:0.85rem">${escapeHtml(err.message)}</p><p style="font-size:0.85rem;margin-top:1rem">Serve this folder over HTTP (e.g. <code>python -m http.server</code>) — file:// may block fetch.</p></div>`;
    return;
  }

  const puzzle = pickDailyLogos(logos, dateKey, ROUNDS);

  if (store.results && store.results[dateKey]) {
    const saved = store.results[dateKey];
    state = {
      logos,
      dateKey,
      puzzle,
      round: ROUNDS,
      guesses: saved.guesses,
      total: saved.total,
      totalReveals: saved.totalReveals || 0,
      sharpens: 0,
      finished: true,
      revealing: false,
    };
    renderEnd(getStreak(store));
    return;
  }

  state = {
    logos,
    dateKey,
    puzzle,
    round: 0,
    guesses: [],
    total: 0,
    totalReveals: 0,
    sharpens: 0,
    finished: false,
    revealing: false,
  };

  renderPlay();
}

boot();
