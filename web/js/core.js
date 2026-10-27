/* Monkeytype Portable - core: math helpers, config, storage, themes, notifications, modal.
 * Math helpers and config defaults are ported from the captured monkeytype bundles
 * (see docs/REVERSE-ENGINEERING.md). */
"use strict";

const MT = window.MT = {};
MT.version = "1.0.0";

/* ---------------- math (monkeytype-packages: r, i, a, o, s) ---------------- */
MT.roundTo1 = (x) => Math.round((x + 2 ** -52) * 10) / 10;
MT.roundTo2 = (x) => Math.round((x + 2 ** -52) * 100) / 100;
MT.mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
MT.stdDev = (arr) => {
  if (!arr.length) return 0;
  const m = MT.mean(arr);
  return Math.sqrt(arr.map((x) => (x - m) ** 2).reduce((a, b) => a + b, 0) / arr.length);
};
/** monkeytype "kogasa" consistency curve: 100 * (1 - tanh(cov + cov^3/3 + cov^5/5)) */
MT.kogasa = (cov) => 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5));
MT.randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
MT.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
MT.shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
/** chars typed in `seconds` -> words per minute (5 chars = 1 word) */
MT.charsToWpm = (chars, seconds) => (seconds > 0 ? (chars / 5) * (60 / seconds) : 0);
MT.escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
MT.$ = (sel, root = document) => root.querySelector(sel);
MT.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* typing speed units (captured class jr: unit, convertFactor) */
MT.speedUnits = {
  wpm: { factor: 1, full: "words per minute" },
  cpm: { factor: 5, full: "characters per minute" },
  wps: { factor: 1 / 60, full: "words per second" },
  cps: { factor: 5 / 60, full: "characters per second" },
  wph: { factor: 60, full: "words per hour" },
};
MT.fromWpm = (wpm) => wpm * MT.speedUnits[MT.config.typingSpeedUnit].factor;
MT.fmtSpeed = (wpm, decimals) => {
  const v = MT.fromWpm(wpm);
  const d = decimals ?? (MT.config.alwaysShowDecimalPlaces ? 2 : 0);
  return d ? v.toFixed(d) : String(Math.round(v));
};

/* ---------------- config (defaults = captured monkeytype defaults, offline subset) ---------------- */
MT.defaultConfig = {
  theme: "serika_dark", favThemes: [], customTheme: false,
  customThemeColors: ["#323437", "#e2b714", "#e2b714", "#646669", "#2c2e31", "#d1d0c5", "#ca4754", "#7e2a33", "#ca4754", "#7e2a33"],
  randomTheme: "off",
  smoothCaret: "medium", quickRestart: "off", punctuation: false, numbers: false,
  words: 50, time: 30, mode: "time", quoteLength: [-1], language: "english",
  fontSize: 2, freedomMode: false, difficulty: "normal", blindMode: false, quickEnd: false,
  caretStyle: "default", paceCaretStyle: "default", paceCaret: "off", paceCaretCustomSpeed: 100,
  flipTestColors: false, confidenceMode: "off", timerStyle: "mini",
  liveSpeedStyle: "off", liveAccStyle: "off", liveBurstStyle: "off",
  colorfulMode: false, stopOnError: "off", fontFamily: "Roboto_Mono",
  alwaysShowDecimalPlaces: false, alwaysShowWordsHistory: false, capsLockWarning: true,
  playSoundOnError: "off", playSoundOnClick: "off", soundVolume: 0.5,
  startGraphsAtZero: true, showOutOfFocusWarning: true,
  minWpm: "off", minWpmCustomSpeed: 100, minAcc: "off", minAccCustom: 90,
  highlightMode: "letter", typedEffect: "keep", typingSpeedUnit: "wpm",
  hideExtraLetters: false, strictSpace: false, repeatQuotes: "off", showAverage: "off",
  showKeyTips: true, focusMode: true, maxLineWidth: 0,
  customText: "The quick brown fox jumps over the lazy dog", customTextMode: "repeat", customTextLimit: 0,
  customTextPipeDelimiter: false,
};

const LS = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { MT.notify("Could not save data: " + e.message, "error"); return false; }
  },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};
MT.LS = LS;
MT.keys = { config: "mtp_config", results: "mtp_results", stats: "mtp_stats", recentQuotes: "mtp_recent_quotes" };

MT.config = Object.assign({}, MT.defaultConfig, LS.get(MT.keys.config, {}));
for (const k of Object.keys(MT.config)) if (!(k in MT.defaultConfig)) delete MT.config[k];
if (!window.MT_THEMES[MT.config.theme]) MT.config.theme = "serika_dark";
if (!window.MT_LANGUAGES[MT.config.language]) MT.config.language = "english";

const configListeners = [];
MT.onConfig = (fn) => configListeners.push(fn);
MT.setConfig = (key, value, opts = {}) => {
  if (!(key in MT.defaultConfig)) return;
  MT.config[key] = value;
  if (!opts.nosave) LS.set(MT.keys.config, MT.config);
  for (const fn of configListeners) fn(key, value, opts);
};
MT.toggleConfig = (key) => MT.setConfig(key, !MT.config[key]);
MT.resetConfig = () => {
  MT.config = Object.assign({}, MT.defaultConfig);
  LS.set(MT.keys.config, MT.config);
  for (const k of Object.keys(MT.config)) for (const fn of configListeners) fn(k, MT.config[k], {});
};

/* ---------------- results / lifetime stats storage ---------------- */
MT.getResults = () => LS.get(MT.keys.results, []);
MT.saveResults = (arr) => LS.set(MT.keys.results, arr);
MT.getLifetime = () => Object.assign({ started: 0, completed: 0, timeTyping: 0 }, LS.get(MT.keys.stats, {}));
MT.bumpLifetime = (patch) => {
  const s = MT.getLifetime();
  for (const [k, v] of Object.entries(patch)) s[k] = (s[k] || 0) + v;
  LS.set(MT.keys.stats, s);
};
/** personal best for an exact test configuration (same matching fields monkeytype uses) */
MT.getPb = (r) => {
  let best = null;
  for (const x of MT.getResults()) {
    if (x.mode === r.mode && String(x.mode2) === String(r.mode2) && x.punctuation === r.punctuation &&
        x.numbers === r.numbers && x.language === r.language && x.difficulty === r.difficulty && !x.failed) {
      if (!best || x.wpm > best.wpm) best = x;
    }
  }
  return best;
};

/* ---------------- themes ---------------- */
MT.themeNames = Object.keys(window.MT_THEMES);
MT.themeExists = (n) => !!window.MT_THEMES[n];
MT.themeColors = (name) => {
  const t = window.MT_THEMES[name] || window.MT_THEMES.serika_dark;
  return { bg: t[0], main: t[1], caret: t[2], sub: t[3], subAlt: t[4], text: t[5], error: t[6], errorExtra: t[7], colorfulError: t[8], colorfulErrorExtra: t[9] };
};
MT.colorsFromArray = (a) => ({ bg: a[0], main: a[1], caret: a[2], sub: a[3], subAlt: a[4], text: a[5], error: a[6], errorExtra: a[7], colorfulError: a[8], colorfulErrorExtra: a[9] });
MT.applyColors = (c) => {
  const s = document.documentElement.style;
  s.setProperty("--bg-color", c.bg);
  s.setProperty("--main-color", c.main);
  s.setProperty("--caret-color", c.caret);
  s.setProperty("--sub-color", c.sub);
  s.setProperty("--sub-alt-color", c.subAlt);
  s.setProperty("--text-color", c.text);
  s.setProperty("--error-color", c.error);
  s.setProperty("--error-extra-color", c.errorExtra);
  s.setProperty("--colorful-error-color", c.colorfulError);
  s.setProperty("--colorful-error-extra-color", c.colorfulErrorExtra);
  MT.currentColors = c;
  window.dispatchEvent(new CustomEvent("mt-colors"));
};
MT.applyTheme = (name = MT.config.theme) => {
  if (MT.config.customTheme) MT.applyColors(MT.colorsFromArray(MT.config.customThemeColors));
  else MT.applyColors(MT.themeColors(name));
  const label = MT.config.customTheme ? "custom" : name.replace(/_/g, " ");
  const el = document.getElementById("footerThemeName");
  if (el) el.textContent = label;
};
MT.previewTheme = (name) => MT.applyColors(MT.themeColors(name));
/** perceived lightness of a hex color, 0..1 (used for random light/dark themes) */
MT.lightness = (hex) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
MT.randomizeTheme = () => {
  const mode = MT.config.randomTheme;
  if (mode === "off") return;
  let pool = MT.themeNames;
  if (mode === "fav") pool = MT.config.favThemes.filter(MT.themeExists);
  if (mode === "light") pool = MT.themeNames.filter((n) => MT.lightness(MT.themeColors(n).bg) > 0.5);
  if (mode === "dark") pool = MT.themeNames.filter((n) => MT.lightness(MT.themeColors(n).bg) <= 0.5);
  if (!pool.length) return;
  const name = MT.pick(pool);
  MT.setConfig("customTheme", false, { nosave: true });
  MT.setConfig("theme", name, { nosave: true });
  MT.notify("theme: " + name.replace(/_/g, " "));
};

/* ---------------- fonts ---------------- */
MT.fonts = ["Roboto_Mono", "Consolas", "Cascadia_Mono", "Courier_New", "Lucida_Console", "Segoe_UI", "Arial", "Georgia", "Verdana", "Comic_Sans_MS"];
MT.applyFont = () => {
  const name = MT.config.fontFamily.replace(/_/g, " ");
  document.documentElement.style.setProperty("--font", `"${name}", "Roboto Mono", monospace`);
};
MT.applyFontSize = () => {
  document.documentElement.style.setProperty("--test-font-size", MT.config.fontSize + "rem");
};

/* ---------------- notifications ---------------- */
MT.notify = (text, kind = "info", ms = 3000) => {
  const box = document.getElementById("notifications");
  if (!box) return;
  const n = document.createElement("div");
  n.className = "notification " + kind;
  n.textContent = text;
  n.onclick = () => n.remove();
  box.appendChild(n);
  setTimeout(() => n.remove(), ms);
};

/* ---------------- modal ---------------- */
MT.modal = {
  open(html, onMount) {
    const wrap = document.getElementById("modalWrapper");
    const m = document.getElementById("modal");
    m.innerHTML = html;
    wrap.classList.remove("hidden");
    MT.modal.isOpen = true;
    if (onMount) onMount(m);
    const first = m.querySelector("textarea, input, select, button");
    if (first) setTimeout(() => first.focus(), 0);
  },
  close() {
    document.getElementById("modalWrapper").classList.add("hidden");
    MT.modal.isOpen = false;
    if (MT.test && MT.currentPage === "test") MT.test.focusInput();
  },
  isOpen: false,
};
document.addEventListener("mousedown", (e) => {
  if (e.target.id === "modalWrapper") MT.modal.close();
});

/** prompt-style modal with a single input; resolves to the value or null */
MT.promptModal = (title, value, opts = {}) => new Promise((resolve) => {
  MT.modal.open(`
    <div class="title">${MT.escape(title)}</div>
    <input type="${opts.type || "text"}" id="promptInput" value="${MT.escape(value)}">
    ${opts.hint ? `<div class="hint">${MT.escape(opts.hint)}</div>` : ""}
    <div class="actions"><button class="button" id="promptCancel">cancel</button><button class="button active" id="promptOk">ok</button></div>`,
  (m) => {
    const input = m.querySelector("#promptInput");
    const done = (v) => { MT.modal.close(); resolve(v); };
    m.querySelector("#promptOk").onclick = () => done(input.value);
    m.querySelector("#promptCancel").onclick = () => done(null);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); done(input.value); }
      if (e.key === "Escape") { e.preventDefault(); done(null); }
    });
    setTimeout(() => input.select(), 0);
  });
});

MT.confirmModal = (title, text, okLabel = "ok") => new Promise((resolve) => {
  MT.modal.open(`
    <div class="title">${MT.escape(title)}</div>
    <div>${MT.escape(text)}</div>
    <div class="actions"><button class="button" id="cCancel">cancel</button><button class="button danger" id="cOk">${MT.escape(okLabel)}</button></div>`,
  (m) => {
    m.querySelector("#cOk").onclick = () => { MT.modal.close(); resolve(true); };
    m.querySelector("#cCancel").onclick = () => { MT.modal.close(); resolve(false); };
  });
});

/** save a text blob to disk via a download link (works in browser and in the WebView2 shell) */
MT.downloadFile = (filename, text, type = "application/json") => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
MT.pickFile = (accept) => new Promise((resolve) => {
  const input = document.createElement("input");
  input.type = "file"; input.accept = accept;
  input.onchange = () => {
    const f = input.files[0];
    if (!f) return resolve(null);
    f.text().then(resolve, () => resolve(null));
  };
  input.click();
});

MT.formatDuration = (sec) => {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
};
MT.formatDate = (ts) => {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) + " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};
