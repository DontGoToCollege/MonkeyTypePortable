/* Monkeytype Portable - settings, stats (local "account") and about pages. */
"use strict";

MT.pages = (() => {
  const onOff = [[false, "off"], [true, "on"]];
  const caretGlyphs = [["off", "off"], ["default", "|"], ["block", "▮"], ["outline", "▯"], ["underline", "_"]];

  /** settings registry: monkeytype config keys with their option sets */
  const sections = [
    { id: "behavior", title: "behavior", icon: "&#xf085;", items: [
      { key: "difficulty", title: "test difficulty", icon: "&#xf54c;", desc: "Normal is the classic typing test experience. Expert fails the test if you submit (press space) an incorrect word. Master fails if you press a single incorrect key (meaning you have to achieve 100% accuracy).", options: [["normal", "normal"], ["expert", "expert"], ["master", "master"]] },
      { key: "quickRestart", title: "quick restart", icon: "&#xf01e;", desc: "Press tab, esc or enter to quickly restart the test, or to quickly jump to the test page. These keys work on the result screen too. With 'off', use tab then enter.", options: [["off", "off"], ["tab", "tab"], ["esc", "esc"], ["enter", "enter"]] },
      { key: "blindMode", title: "blind mode", icon: "&#xf070;", desc: "No errors or incorrect words are highlighted. Helps you to focus on raw speed. If enabled, quick end is recommended.", options: onOff },
      { key: "alwaysShowWordsHistory", title: "always show words history", icon: "&#xf03a;", desc: "This option will automatically show the words history at the end of the test.", options: onOff },
      { key: "language", title: "language", icon: "&#xf0ac;", desc: "Change in which language (word set) you want to type. The bundled sets are the monkeytype English lists: 200 most common words, 1k, 5k and 10k.", options: () => Object.keys(window.MT_LANGUAGES).map((l) => [l, l.replace(/_/g, " ")]) },
      { key: "typingSpeedUnit", title: "typing speed unit", icon: "&#xf3fd;", desc: "Display typing speed in the specified unit.", options: [["wpm", "wpm"], ["cpm", "cpm"], ["wps", "wps"], ["cps", "cps"], ["wph", "wph"]] },
      { key: "minWpm", title: "min speed", icon: "&#xf3fd;", desc: "Automatically fails a test if your speed falls below a threshold.", options: [["off", "off"], ["custom", "custom"]], number: { key: "minWpmCustomSpeed", min: 1, max: 999 } },
      { key: "minAcc", title: "min accuracy", icon: "&#xf140;", desc: "Automatically fails a test if your accuracy falls below a threshold.", options: [["off", "off"], ["custom", "custom"]], number: { key: "minAccCustom", min: 1, max: 100 } },
    ] },
    { id: "input", title: "input", icon: "&#xf11c;", items: [
      { key: "freedomMode", title: "freedom mode", icon: "&#xf4c4;", desc: "Allows you to delete any word, even if it was typed correctly.", options: onOff },
      { key: "strictSpace", title: "strict space", icon: "&#xf121;", desc: "Pressing space at the beginning of a word will insert a space character instead of being ignored.", options: onOff },
      { key: "stopOnError", title: "stop on error", icon: "&#xf05e;", desc: "Letter mode will stop input when pressing any incorrect letters. Word mode will not allow you to continue to the next word until you correct all mistakes.", options: [["off", "off"], ["word", "word"], ["letter", "letter"]] },
      { key: "confidenceMode", title: "confidence mode", icon: "&#xf3ed;", desc: "When enabled, you will not be able to go back to previous words to fix mistakes. When turned up to the max, you won't be able to backspace at all.", options: [["off", "off"], ["on", "on"], ["max", "max"]] },
      { key: "quickEnd", title: "quick end", icon: "&#xf11e;", desc: "This only applies to the words, quote and custom modes. If enabled, the test will end as soon as the last word has been typed, even if it's incorrect.", options: onOff },
      { key: "capsLockWarning", title: "caps lock warning", icon: "&#xf023;", desc: "Displays a warning when caps lock is on.", options: [[false, "hide"], [true, "show"]] },
    ] },
    { id: "sound", title: "sound", icon: "&#xf028;", items: [
      { key: "soundVolume", title: "sound volume", icon: "&#xf028;", desc: "Change the volume of the sound effects.", range: { min: 0.05, max: 1, step: 0.05 } },
      { key: "playSoundOnClick", title: "play sound on click", icon: "&#xf001;", desc: "Plays a short (synthesized) sound when you press a key.", options: () => [["off", "off"], ...MT.sound.clickTypes.map((t) => [t, t])], preview: "click" },
      { key: "playSoundOnError", title: "play sound on error", icon: "&#xf071;", desc: "Plays a short sound if you press an incorrect key or press space too early.", options: () => [["off", "off"], ...MT.sound.errorTypes.map((t) => [t, t])], preview: "error" },
    ] },
    { id: "caret", title: "caret", icon: "&#xf246;", items: [
      { key: "smoothCaret", title: "smooth caret", icon: "&#xf246;", desc: "The caret will move smoothly between letters and words.", options: [["off", "off"], ["slow", "slow"], ["medium", "medium"], ["fast", "fast"]] },
      { key: "caretStyle", title: "caret style", icon: "&#xf246;", desc: "Change the style of the caret during the test.", options: caretGlyphs },
      { key: "paceCaret", title: "pace caret", icon: "&#xf70c;", desc: "Displays a second caret that moves at constant speed. The 'average' option averages your last 10 matching results. 'pb' uses your best matching result. 'last' uses your most recent result.", options: [["off", "off"], ["average", "avg"], ["pb", "pb"], ["last", "last"], ["custom", "custom"]], number: { key: "paceCaretCustomSpeed", min: 1, max: 999 } },
      { key: "paceCaretStyle", title: "pace caret style", icon: "&#xf246;", desc: "Change the style of the pace caret during the test.", options: caretGlyphs.slice(1) },
    ] },
    { id: "appearance", title: "appearance", icon: "&#xf1fc;", items: [
      { key: "timerStyle", title: "timer/progress style", icon: "&#xf2f2;", desc: "Change the style of the timer/progress during a timed test.", options: [["off", "off"], ["bar", "bar"], ["mini", "mini"]] },
      { key: "liveSpeedStyle", title: "live speed", icon: "&#xf3fd;", desc: "Displays a live speed during the test. Updates once every second.", options: [["off", "hide"], ["mini", "mini"]] },
      { key: "liveAccStyle", title: "live accuracy", icon: "&#xf140;", desc: "Displays live accuracy during the test.", options: [["off", "hide"], ["mini", "mini"]] },
      { key: "liveBurstStyle", title: "live burst", icon: "&#xf7e4;", desc: "Displays live burst during the test of the last word you typed.", options: [["off", "hide"], ["mini", "mini"]] },
      { key: "fontSize", title: "font size", icon: "&#xf034;", desc: "Change the font size of the test words.", options: [[1, "1"], [1.25, "1.25"], [1.5, "1.5"], [2, "2"], [2.5, "2.5"], [3, "3"], [4, "4"]] },
      { key: "fontFamily", title: "font family", icon: "&#xf031;", desc: "Roboto Mono is bundled with the app. The other fonts are used if installed on this computer (all of them ship with Windows except Cascadia Mono on older versions).", options: () => MT.fonts.map((f) => [f, f.replace(/_/g, " ")]), fontPreview: true },
      { key: "highlightMode", title: "highlight mode", icon: "&#xf591;", desc: "Change what is highlighted during the test.", options: [["off", "off"], ["letter", "letter"], ["word", "word"]] },
      { key: "typedEffect", title: "typed effect", icon: "&#xf06e;", desc: "Change how typed words behave.", options: [["keep", "keep"], ["hide", "hide"], ["fade", "fade"]] },
      { key: "hideExtraLetters", title: "hide extra letters", icon: "&#xf070;", desc: "Hides extra letters. This will completely avoid words jumping lines (due to changing width), but might bother some people.", options: onOff },
      { key: "flipTestColors", title: "flip test colors", icon: "&#xf042;", desc: "By default, typed text is brighter than the future text. When enabled, the colors will be flipped and the future text will be brighter than the already typed text.", options: onOff },
      { key: "colorfulMode", title: "colorful mode", icon: "&#xf53f;", desc: "When enabled, the test words will use the main color, instead of the text color, making the website more colorful.", options: onOff },
      { key: "focusMode", title: "focus mode", icon: "&#xf06e;", desc: "Hide the header, test settings and footer while you are typing (moving the mouse brings them back).", options: onOff },
      { key: "showOutOfFocusWarning", title: "out of focus warning", icon: "&#xf245;", desc: "Shows an out of focus reminder after 1 second of being 'out of focus' (not being able to type).", options: [[false, "hide"], [true, "show"]] },
      { key: "alwaysShowDecimalPlaces", title: "always show decimal places", icon: "&#xf1ec;", desc: "Always shows decimal places for values on the result page, without the need to hover over the stats.", options: onOff },
      { key: "startGraphsAtZero", title: "start graphs at zero", icon: "&#xf201;", desc: "Force graph axis to always start at zero, no matter what the data is. Turning this off may exaggerate the value changes.", options: onOff },
      { key: "showKeyTips", title: "key tips", icon: "&#xf11c;", desc: "Shows the keybind tips at the bottom of the page.", options: [[false, "hide"], [true, "show"]] },
    ] },
  ];

  const allItems = () => sections.flatMap((s) => s.items);
  const sameVal = (a, b) => a === b || String(a) === String(b);

  /* ---------------- settings page ---------------- */
  function renderSettings() {
    const page = MT.$("#pageSettings");
    let html = `<div class="settingsNav">`;
    for (const s of sections) html += `<button class="button" data-jump="${s.id}"><span class="fa">${s.icon}</span>${s.title}</button>`;
    html += `<button class="button" data-jump="theme"><span class="fa">&#xf53f;</span>theme</button>`;
    html += `<button class="button" data-jump="data"><span class="fa">&#xf1c0;</span>data</button>`;
    html += `<input type="text" class="settingsSearch" id="settingsSearch" placeholder="search settings..."></div>`;

    for (const s of sections) {
      html += `<div class="sectionHeading" id="sec-${s.id}"><span class="fa">${s.icon}</span>${s.title}</div>`;
      for (const it of s.items) html += settingHtml(it);
    }
    html += themeSectionHtml();
    html += dataSectionHtml();
    page.innerHTML = html;
    bindSettings(page);
  }

  function settingHtml(it) {
    const opts = typeof it.options === "function" ? it.options() : it.options;
    let body = "";
    if (it.range) {
      body = `<div class="options inputRow"><input type="range" data-range="${it.key}" min="${it.range.min}" max="${it.range.max}" step="${it.range.step}" value="${MT.config[it.key]}"><span class="rangeVal">${Math.round(MT.config[it.key] * 100)}%</span></div>`;
    } else {
      body = `<div class="options">`;
      for (const [v, label] of opts) {
        const style = it.fontPreview ? ` style="font-family:'${String(v).replace(/_/g, " ")}'"` : "";
        body += `<button class="button${sameVal(MT.config[it.key], v) ? " active" : ""}" data-key="${it.key}" data-value="${MT.escape(JSON.stringify(v))}"${style}>${MT.escape(label)}</button>`;
      }
      if (it.number) body += `<input type="number" data-number="${it.number.key}" min="${it.number.min}" max="${it.number.max}" value="${MT.config[it.number.key]}" title="custom value">`;
      body += `</div>`;
    }
    return `<div class="setting" data-search="${MT.escape((it.title + " " + it.desc).toLowerCase())}">
      <div class="title"><span class="fa">${it.icon}</span>${MT.escape(it.title)}</div>
      <div class="desc">${MT.escape(it.desc)}</div>${body}</div>`;
  }

  function themeSectionHtml() {
    const cfg = MT.config;
    let html = `<div class="sectionHeading" id="sec-theme"><span class="fa">&#xf53f;</span>theme</div>`;
    html += settingHtml({ key: "randomTheme", title: "randomize theme", icon: "&#xf074;", desc: "After completing a test, the theme will be set to a random one. 'fav' only picks from favorite themes, 'light' and 'dark' only from light or dark themes.", options: [["off", "off"], ["on", "on"], ["fav", "fav"], ["light", "light"], ["dark", "dark"]] });
    html += `<div class="setting fullWidth" data-search="theme themes custom colors favorite">
      <div class="title"><span class="fa">&#xf53f;</span>theme</div>
      <div class="desc">Click to apply, right click (or the star) to add to favorites. All ${MT.themeNames.length} themes were extracted from the installed monkeytype.</div>
      <div class="options" style="display:block">
        <div class="themeTabs">
          <button class="button${cfg.customTheme ? "" : " active"}" id="presetTab">preset</button>
          <button class="button${cfg.customTheme ? " active" : ""}" id="customTab">custom</button>
          <input type="text" id="themeSearch" placeholder="search themes..." style="margin-left:auto;font-size:.8rem;width:14rem">
        </div>
        <div id="themeGridBox"></div>
      </div></div>`;
    return html;
  }

  function themeGridHtml(filter = "") {
    const cfg = MT.config;
    if (cfg.customTheme) {
      const labels = ["background", "main", "caret", "sub", "sub alt", "text", "error", "error extra", "colorful error", "colorful error extra"];
      let h = `<div class="customThemeGrid">`;
      labels.forEach((l, i) => { h += `<label>${l}<input type="color" data-ci="${i}" value="${cfg.customThemeColors[i]}"></label>`; });
      h += `</div><div class="row" style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
        <button class="button" id="loadCurrentIntoCustom">load current preset</button>
        <button class="button" id="resetCustom">reset to serika dark</button></div>`;
      return h;
    }
    const f = filter.trim().toLowerCase().replace(/ /g, "_");
    const favs = cfg.favThemes.filter(MT.themeExists);
    const names = [...favs, ...MT.themeNames.filter((n) => !favs.includes(n))].filter((n) => !f || n.includes(f));
    let h = `<div class="themeGrid">`;
    for (const n of names) {
      const t = MT.themeColors(n);
      h += `<button class="themeButton${n === cfg.theme ? " active" : ""}${favs.includes(n) ? " isFav" : ""}" data-theme="${n}" style="background:${t.bg};color:${t.main}">
        <span class="fav fa" title="favorite">&#xf005;</span><span class="name">${n.replace(/_/g, " ")}</span>
        <span class="bubbles"><span style="background:${t.main}"></span><span style="background:${t.sub}"></span><span style="background:${t.text}"></span></span></button>`;
    }
    return h + (names.length ? "" : `<div class="emptyState">no themes match</div>`) + `</div>`;
  }

  function dataSectionHtml() {
    return `<div class="sectionHeading" id="sec-data"><span class="fa">&#xf1c0;</span>data</div>
      <div class="setting" data-search="export import data backup">
        <div class="title"><span class="fa">&#xf019;</span>export / import</div>
        <div class="desc">Your settings and results live inside the portable data folder next to the app. Export them to a JSON file as a backup, or import a previous export (results are merged).</div>
        <div class="options"><button class="button" id="exportData">export data</button><button class="button" id="importData">import data</button><button class="button" id="exportCsv">export results csv</button></div>
      </div>
      <div class="setting" data-search="reset settings">
        <div class="title"><span class="fa">&#xf2ea;</span>reset settings</div>
        <div class="desc">Resets settings to the default (but doesn't touch your results).</div>
        <div class="options"><button class="button danger" id="resetSettings">reset settings</button></div>
      </div>
      <div class="setting" data-search="clear history results delete">
        <div class="title"><span class="fa">&#xf1f8;</span>clear history</div>
        <div class="desc">Permanently deletes all saved results and personal bests on this device.</div>
        <div class="options"><button class="button danger" id="clearHistory">clear history</button></div>
      </div>`;
  }

  function bindSettings(page) {
    page.onclick = async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.jump) { MT.$("#sec-" + b.dataset.jump).scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      if (b.dataset.key) {
        const v = JSON.parse(b.dataset.value);
        MT.setConfig(b.dataset.key, v);
        MT.$$(`button[data-key="${b.dataset.key}"]`, page).forEach((x) => x.classList.toggle("active", x === b));
        const it = allItems().find((i) => i.key === b.dataset.key);
        if (it && it.preview && v !== "off") MT.sound.preview(it.preview, v);
        if (b.dataset.key === "randomTheme") MT.$$(`button[data-key="randomTheme"]`, page).forEach((x) => x.classList.toggle("active", x === b));
        return;
      }
      if (b.dataset.theme) {
        const fav = e.target.closest(".fav");
        if (fav) { toggleFav(b.dataset.theme); return; }
        MT.setConfig("theme", b.dataset.theme);
        MT.$$(".themeButton", page).forEach((x) => x.classList.toggle("active", x === b));
        return;
      }
      switch (b.id) {
        case "presetTab": MT.setConfig("customTheme", false); refreshThemeTabs(); break;
        case "customTab": MT.setConfig("customTheme", true); refreshThemeTabs(); break;
        case "loadCurrentIntoCustom": {
          const t = MT.themeColors(MT.config.theme);
          MT.setConfig("customThemeColors", [t.bg, t.main, t.caret, t.sub, t.subAlt, t.text, t.error, t.errorExtra, t.colorfulError, t.colorfulErrorExtra]);
          refreshThemeTabs(); break;
        }
        case "resetCustom": MT.setConfig("customThemeColors", MT.defaultConfig.customThemeColors.slice()); refreshThemeTabs(); break;
        case "exportData": exportData(); break;
        case "importData": importData(); break;
        case "exportCsv": exportCsv(); break;
        case "resetSettings":
          if (await MT.confirmModal("reset settings", "Reset all settings to their defaults?", "reset")) { MT.resetConfig(); renderSettings(); MT.notify("settings reset"); }
          break;
        case "clearHistory":
          if (await MT.confirmModal("clear history", "Delete all results and personal bests? This cannot be undone.", "delete")) {
            MT.saveResults([]); MT.LS.remove(MT.keys.stats); MT.notify("history cleared");
          }
          break;
      }
    };
    page.oncontextmenu = (e) => {
      const b = e.target.closest(".themeButton");
      if (!b) return;
      e.preventDefault();
      toggleFav(b.dataset.theme);
    };
    page.oninput = (e) => {
      const t = e.target;
      if (t.id === "themeSearch") { MT.$("#themeGridBox").innerHTML = themeGridHtml(t.value); return; }
      if (t.id === "settingsSearch") {
        const q = t.value.trim().toLowerCase();
        MT.$$(".setting", page).forEach((s) => s.classList.toggle("hidden", !!q && !s.dataset.search.includes(q)));
        MT.$$(".sectionHeading", page).forEach((h) => h.classList.toggle("hidden", !!q));
        return;
      }
      if (t.dataset.range) {
        MT.setConfig(t.dataset.range, parseFloat(t.value));
        t.nextElementSibling.textContent = Math.round(parseFloat(t.value) * 100) + "%";
      }
      if (t.dataset.ci !== undefined) {
        const arr = MT.config.customThemeColors.slice();
        arr[+t.dataset.ci] = t.value;
        MT.setConfig("customThemeColors", arr);
      }
    };
    page.onchange = (e) => {
      const t = e.target;
      if (t.dataset.range && MT.config.playSoundOnClick !== "off") MT.sound.preview("click", MT.config.playSoundOnClick);
      if (t.dataset.number) {
        let v = parseFloat(t.value);
        if (!isFinite(v)) v = MT.defaultConfig[t.dataset.number];
        v = Math.max(+t.min, Math.min(+t.max, v));
        t.value = v;
        MT.setConfig(t.dataset.number, v);
      }
    };
    MT.$("#themeGridBox").innerHTML = themeGridHtml();
  }

  function refreshThemeTabs() {
    MT.$("#presetTab").classList.toggle("active", !MT.config.customTheme);
    MT.$("#customTab").classList.toggle("active", MT.config.customTheme);
    MT.$("#themeGridBox").innerHTML = themeGridHtml(MT.$("#themeSearch").value);
  }

  function toggleFav(name) {
    const favs = MT.config.favThemes.slice();
    const i = favs.indexOf(name);
    if (i >= 0) favs.splice(i, 1); else favs.push(name);
    MT.setConfig("favThemes", favs);
    const box = MT.$("#themeGridBox");
    if (box) box.innerHTML = themeGridHtml(MT.$("#themeSearch")?.value || "");
  }

  function exportData() {
    const payload = { app: "monkeytype-portable", version: MT.version, exported: new Date().toISOString(), config: MT.config, results: MT.getResults(), lifetime: MT.getLifetime() };
    MT.downloadFile(`monkeytype-portable-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 1));
  }
  async function importData() {
    const text = await MT.pickFile(".json,application/json");
    if (!text) return;
    try {
      const d = JSON.parse(text);
      if (d.config) { for (const [k, v] of Object.entries(d.config)) if (k in MT.defaultConfig) MT.setConfig(k, v); }
      if (Array.isArray(d.results)) {
        const have = new Set(MT.getResults().map((r) => r.id));
        const merged = MT.getResults().concat(d.results.filter((r) => r && r.id && !have.has(r.id)));
        merged.sort((a, b) => a.timestamp - b.timestamp);
        MT.saveResults(merged);
      }
      if (d.lifetime) MT.LS.set(MT.keys.stats, d.lifetime);
      renderSettings();
      MT.notify("data imported");
    } catch (e) { MT.notify("import failed: " + e.message, "error"); }
  }
  function exportCsv() {
    // same columns as the captured monkeytype results.csv export (In)
    const cols = ["_id", "isPb", "wpm", "acc", "rawWpm", "consistency", "charStats", "mode", "mode2", "quoteLength", "restartCount", "testDuration", "afkDuration", "incompleteTestSeconds", "punctuation", "numbers", "language", "funbox", "difficulty", "lazyMode", "blindMode", "bailedOut", "tags", "timestamp"];
    const rows = MT.getResults().map((r) => [r.id, !!r.isPb, r.wpm, r.acc, r.rawWpm, r.consistency, (r.charStats || []).join(";"), r.mode, r.mode2, r.quoteLength ?? -1, r.restartCount || 0, r.testDuration, 0, 0, r.punctuation, r.numbers, r.language, "", r.difficulty, false, !!r.blindMode, false, "", r.timestamp]);
    MT.downloadFile("results.csv", [cols, ...rows].map((r) => r.join(",")).join("\n"), "text/csv");
  }

  /* ---------------- stats page ---------------- */
  let histFilter = "all";
  let histShown = 50;

  function renderStats() {
    const page = MT.$("#pageStats");
    const results = MT.getResults();
    const life = MT.getLifetime();
    if (!results.length && !life.started) {
      page.innerHTML = `<div class="emptyState"><span class="fa" style="font-size:3rem">&#xf521;</span><br><br>no results yet - finish a test and your stats, personal bests and history will show up here.<br>everything is stored locally in the portable data folder.</div>`;
      return;
    }
    const wpms = results.map((r) => r.wpm);
    const last10 = results.slice(-10);
    const best = results.reduce((m, r) => (!m || r.wpm > m.wpm ? r : m), null);
    const box = (t, v, small) => `<div class="statBox"><div class="title">${t}</div><div class="val${small ? " small" : ""}">${v}</div></div>`;
    let html = `<div class="statsTop">`;
    html += box("tests started", life.started);
    html += box("tests completed", life.completed || results.length);
    html += box("time typing", MT.formatDuration(life.timeTyping || 0));
    html += box(`highest ${MT.config.typingSpeedUnit}`, best ? MT.fmtSpeed(best.wpm) : "-");
    html += box(`average ${MT.config.typingSpeedUnit}`, wpms.length ? MT.fmtSpeed(MT.mean(wpms)) : "-");
    html += box(`average ${MT.config.typingSpeedUnit} (last 10)`, last10.length ? MT.fmtSpeed(MT.mean(last10.map((r) => r.wpm))) : "-");
    html += box("average accuracy", results.length ? Math.floor(MT.mean(results.map((r) => r.acc))) + "%" : "-");
    html += box("average consistency", results.length ? Math.round(MT.mean(results.map((r) => r.consistency))) + "%" : "-");
    html += `</div>`;

    html += `<div class="pbTables">${pbTable("time", [15, 30, 60, 120], results)}${pbTable("words", [10, 25, 50, 100], results)}</div>`;
    html += `<div class="historyChartBox"><canvas id="historyChart"></canvas></div>`;
    html += `<div class="historyFilters">`;
    for (const f of ["all", "time", "words", "quote", "zen", "custom"]) html += `<button class="button${histFilter === f ? " active" : ""}" data-hf="${f}">${f}</button>`;
    html += `<span style="margin-left:auto;color:var(--sub-color);font-size:.75rem">${results.length} results</span></div>`;
    html += `<div id="historyTableBox"></div>`;
    page.innerHTML = html;
    renderHistoryTable();
    requestAnimationFrame(() => {
      const c = MT.$("#historyChart");
      if (c) MT.chart.drawHistory(c, filtered().slice(-500));
    });
    page.onclick = async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.hf) { histFilter = b.dataset.hf; histShown = 50; renderStats(); }
      if (b.id === "loadMore") { histShown += 50; renderHistoryTable(); }
      if (b.dataset.del) {
        if (!(await MT.confirmModal("delete result", "Delete this result?", "delete"))) return;
        MT.saveResults(MT.getResults().filter((r) => r.id !== b.dataset.del));
        renderStats();
      }
    };
  }

  function filtered() {
    const r = MT.getResults();
    return histFilter === "all" ? r : r.filter((x) => x.mode === histFilter);
  }

  function pbTable(mode, values, results) {
    let h = `<div class="pbTable">`;
    for (const v of values) {
      const pb = results.filter((r) => r.mode === mode && String(r.mode2) === String(v) && !r.failed)
        .reduce((m, r) => (!m || r.wpm > m.wpm ? r : m), null);
      h += `<div class="pb"><div class="mode">${v} ${mode === "time" ? "seconds" : "words"}</div>
        <div class="wpm">${pb ? MT.fmtSpeed(pb.wpm) : "-"}</div><div class="acc">${pb ? Math.floor(pb.acc) + "%" : "-"}</div>
        ${pb ? `<div class="tip">${MT.fmtSpeed(pb.wpm, 2)} ${MT.config.typingSpeedUnit}<br>${MT.fmtSpeed(pb.rawWpm, 2)} raw<br>${pb.acc.toFixed(2)}% acc<br>${pb.consistency.toFixed(2)}% con<br>${pb.language}${pb.punctuation ? " +punc" : ""}${pb.numbers ? " +num" : ""}<br>${MT.formatDate(pb.timestamp)}</div>` : ""}</div>`;
    }
    return h + `</div>`;
  }

  function renderHistoryTable() {
    const list = filtered().slice().reverse();
    const shown = list.slice(0, histShown);
    const u = MT.config.typingSpeedUnit;
    let h = `<table class="history"><thead><tr><th></th><th>${u}</th><th>raw</th><th>accuracy</th><th>consistency</th><th>chars</th><th>mode</th><th>info</th><th>date</th><th></th></tr></thead><tbody>`;
    for (const r of shown) {
      let mode = r.mode;
      if (r.mode === "time" || r.mode === "words") mode += " " + r.mode2;
      if (r.mode === "quote") mode += " " + (["short", "medium", "long", "thicc"][r.quoteLength] || "");
      const info = [r.mode === "quote" ? "" : r.language.replace(/_/g, " "), r.punctuation ? "punc" : "", r.numbers ? "num" : "", r.difficulty !== "normal" ? r.difficulty : "", r.blindMode ? "blind" : ""].filter(Boolean).join(", ");
      h += `<tr><td>${r.isPb ? '<span class="fa crown" title="personal best at the time">&#xf521;</span>' : ""}</td>
        <td>${MT.fmtSpeed(r.wpm, 2)}</td><td>${MT.fmtSpeed(r.rawWpm, 2)}</td><td>${r.acc.toFixed(2)}%</td><td>${r.consistency.toFixed(2)}%</td>
        <td>${(r.charStats || []).join("/")}</td><td>${MT.escape(mode)}</td><td>${MT.escape(info)}</td><td>${MT.formatDate(r.timestamp)}</td>
        <td><button class="textButton" data-del="${r.id}" title="delete result"><span class="fa">&#xf1f8;</span></button></td></tr>`;
    }
    h += `</tbody></table>`;
    if (list.length > histShown) h += `<div class="loadMore"><button class="button" id="loadMore">load more</button></div>`;
    if (!list.length) h = `<div class="emptyState">no results for this filter</div>`;
    MT.$("#historyTableBox").innerHTML = h;
  }

  /* ---------------- about page ---------------- */
  function renderAbout() {
    const q = window.MT_QUOTES.quotes.length;
    MT.$("#pageAbout").innerHTML = `
      <h2><span class="fa">&#xf129;</span>about</h2>
      <p>Monkeytype Portable is an offline, portable recreation of <b>monkeytype</b> - the minimalistic, customizable typing test - built from the
      copy installed on this computer. It needs no internet connection, no account and no installation: everything runs locally and your data
      stays in the app's own folder, so you can carry it between computers on a USB stick.</p>
      <h2><span class="fa">&#xf11c;</span>how to use</h2>
      <p>Pick a mode in the bar above the words (time, words, quote, zen or custom), then just start typing - the test starts on your first key press.
      Your speed is measured in words per minute (wpm): correctly typed characters (including spaces) divided by five, per minute. Raw speed counts
      every character you typed, correct or not. Accuracy is the share of correct key presses and consistency measures how steady your speed was
      across the test.</p>
      <ul>
        <li><kbd>tab</kbd> + <kbd>enter</kbd> - restart the test (or set a quick restart key in settings)</li>
        <li><kbd>esc</kbd> / <kbd>ctrl</kbd> + <kbd>shift</kbd> + <kbd>p</kbd> - command line: change any setting or theme from the keyboard</li>
        <li><kbd>ctrl</kbd> + <kbd>backspace</kbd> - delete the whole word</li>
        <li><kbd>shift</kbd> + <kbd>enter</kbd> - finish a zen mode test</li>
      </ul>
      <h2><span class="fa">&#xf1c0;</span>what's included</h2>
      <ul>
        <li>${MT.themeNames.length} themes, the English word lists (200, 1k, 5k, 10k) and ${q.toLocaleString()} English quotes, extracted from the installed monkeytype</li>
        <li>the same scoring formulas as monkeytype (wpm, raw, accuracy, consistency), personal bests, result chart and words history</li>
        <li>local stats &amp; history page in place of the online account, with JSON backup and CSV export</li>
      </ul>
      <p>Online-only features (accounts, leaderboards, friends, ads) are intentionally left out.</p>
      <h2><span class="fa">&#xf1f9;</span>credits</h2>
      <p>monkeytype is created by Miodec and contributors and is open source under the GNU GPL v3. The themes, word lists and quotes in this
      recreation come from monkeytype, and the quote texts belong to their respective authors. Roboto Mono (Apache 2.0) and Lexend Deca (SIL OFL)
      fonts, Font Awesome Free icons (SIL OFL). This portable recreation is a personal, non-commercial project and is not affiliated with monkeytype.</p>
      <p style="color:var(--sub-color)">version ${MT.version}</p>`;
  }

  return { renderSettings, renderStats, renderAbout, sections, allItems };
})();
