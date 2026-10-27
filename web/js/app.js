/* Monkeytype Portable - app shell: navigation, test config bar, keyboard shortcuts, dialogs. */
"use strict";

MT.app = (() => {
  const pages = { test: "pageTest", stats: "pageStats", settings: "pageSettings", about: "pageAbout" };
  const restartKeys = new Set(["mode", "time", "words", "quoteLength", "punctuation", "numbers", "language", "customText",
    "customTextMode", "customTextLimit", "customTextPipeDelimiter", "difficulty", "stopOnError", "confidenceMode", "paceCaret",
    "paceCaretCustomSpeed", "minWpm", "minWpmCustomSpeed", "minAcc", "minAccCustom", "freedomMode", "blindMode"]);
  const visualKeys = new Set(["colorfulMode", "flipTestColors", "blindMode", "highlightMode", "typedEffect", "hideExtraLetters", "caretStyle", "paceCaretStyle"]);

  function go(page) {
    if (!pages[page]) page = "test";
    if (MT.currentPage === "test" && page !== "test" && MT.test.isActive()) MT.test.restart();
    MT.currentPage = page;
    for (const [k, id] of Object.entries(pages)) document.getElementById(id).classList.toggle("active", k === page);
    MT.$$("#menu .navIcon").forEach((b) => b.classList.toggle("current", b.dataset.nav === page && page !== "test"));
    document.body.classList.remove("focus");
    if (page === "settings") MT.pages.renderSettings();
    if (page === "stats") MT.pages.renderStats();
    if (page === "about") MT.pages.renderAbout();
    if (page === "test") {
      if (!MT.test.state || MT.$("#result").classList.contains("hidden")) MT.test.restart();
      requestAnimationFrame(() => MT.test.remeasure());
    }
    window.scrollTo(0, 0);
  }

  function updateConfigBar() {
    const c = MT.config;
    const setActive = (attr, val) => MT.$$(`#testConfig [data-${attr}]`).forEach((b) => b.classList.toggle("active", String(b.dataset[attr]) === String(val)));
    MT.$('#testConfig [data-config="punctuation"]').classList.toggle("active", c.punctuation);
    MT.$('#testConfig [data-config="numbers"]').classList.toggle("active", c.numbers);
    setActive("mode", c.mode);
    setActive("time", [15, 30, 60, 120].includes(c.time) ? c.time : "custom");
    setActive("words", [10, 25, 50, 100].includes(c.words) ? c.words : "custom");
    const q = c.quoteLength.includes(-1) ? "all" : c.quoteLength.join(",");
    setActive("quote", q);
    const show = (id, on) => MT.$(id).classList.toggle("hidden", !on);
    show("#timeGroup", c.mode === "time");
    show("#wordsGroup", c.mode === "words");
    show("#quoteGroup", c.mode === "quote");
    show("#customGroup", c.mode === "custom");
    const hasPunc = c.mode === "time" || c.mode === "words" || c.mode === "custom";
    show("#puncNumGroup", hasPunc);
    show("#leftSpacer", hasPunc);
    show("#rightSpacer", c.mode !== "zen");
    MT.$("#modeGroup").style.borderRadius = c.mode === "zen" ? (hasPunc ? "0 var(--roundness) var(--roundness) 0" : "var(--roundness)")
      : (hasPunc ? "0" : "var(--roundness) 0 0 var(--roundness)");
    MT.$("#bottom .keyTips").classList.toggle("hidden", !c.showKeyTips);
    const qr = c.quickRestart;
    MT.$("#bottom .keyTips").innerHTML = (qr === "off" ? "<kbd>tab</kbd> + <kbd>enter</kbd>" : `<kbd>${qr}</kbd>`) + " - restart test<br>" +
      (qr === "esc" ? "" : "<kbd>esc</kbd> or ") + "<kbd>ctrl</kbd> + <kbd>shift</kbd> + <kbd>p</kbd> - command line";
  }

  function onConfigChange(key) {
    if (["theme", "customTheme", "customThemeColors"].includes(key)) MT.applyTheme();
    if (key === "fontFamily") { MT.applyFont(); setTimeout(() => MT.test.remeasure(), 50); }
    if (key === "fontSize") { MT.applyFontSize(); requestAnimationFrame(() => MT.test.remeasure()); }
    updateConfigBar();
    if (visualKeys.has(key)) { MT.test.applyWordsClasses(); MT.test.updateCaret(false); }
    if (restartKeys.has(key) && MT.currentPage === "test") MT.test.restart();
  }

  /* ---------------- dialogs ---------------- */
  function parseDuration(str) {
    // same parser as the captured custom-time dialog (Qj): "90", "1m30s", "1h 2m"
    const parts = [...String(str).toLowerCase().matchAll(/((-\s*)?\d+(\.\d+)?\s*[hms]?)/g)].map((m) => {
      const t = m[0], n = parseFloat(t.replace(/\s+/g, ""));
      return t.includes("h") ? 3600 * n : t.includes("m") ? 60 * n : n;
    });
    return Math.floor(parts.reduce((a, b) => a + b, 0));
  }
  async function customTime() {
    const v = await MT.promptModal("Test duration", String(MT.config.time), { hint: "You can use units, e.g. 90, 1m30s or 1h. 0 means infinite (end with tab)." });
    if (v === null) return;
    const secs = parseDuration(v);
    if (!(secs >= 0)) { MT.notify("invalid duration", "error"); return; }
    MT.setConfig("time", secs);
    MT.setConfig("mode", "time");
  }
  async function customWords() {
    const v = await MT.promptModal("Word amount", String(MT.config.words), { type: "number", hint: "0 means infinite (end the test with tab)." });
    if (v === null) return;
    const n = Math.floor(+v);
    if (!(n >= 0)) { MT.notify("invalid word amount", "error"); return; }
    MT.setConfig("words", n);
    MT.setConfig("mode", "words");
  }
  function customTextModal() {
    const c = MT.config;
    MT.modal.open(`
      <div class="title">Custom text</div>
      <textarea id="ctText" spellcheck="false">${MT.escape(c.customText)}</textarea>
      <div class="row">
        <span class="hint" style="margin-right:.5rem">mode</span>
        <button class="button${c.customTextMode === "repeat" ? " active" : ""}" data-ctmode="repeat" title="type the text in order">simple</button>
        <button class="button${c.customTextMode === "shuffle" ? " active" : ""}" data-ctmode="shuffle" title="shuffle the words">shuffle</button>
        <button class="button${c.customTextMode === "random" ? " active" : ""}" data-ctmode="random" title="random words from the text">random</button>
        <span class="hint" style="margin-left:1rem">word limit</span>
        <input type="number" id="ctLimit" min="0" value="${c.customTextLimit}" style="width:6rem">
        <label class="hint" style="display:flex;gap:.4rem;align-items:center;margin-left:1rem"><input type="checkbox" id="ctPipe"${c.customTextPipeDelimiter ? " checked" : ""}>pipe delimiter</label>
      </div>
      <div class="hint">Word limit 0 = the whole text (or 100 words in random mode). With pipe delimiter, "|" separates the entries instead of spaces. Smart quotes and dashes are normalized.</div>
      <div class="row">
        <button class="button" id="ctOpenFile">load .txt file</button>
        <button class="button" id="ctClean">remove line breaks &amp; extra spaces</button>
      </div>
      <div class="actions"><button class="button" id="ctCancel">cancel</button><button class="button active" id="ctOk">ok</button></div>`,
    (m) => {
      let mode = c.customTextMode;
      m.querySelectorAll("[data-ctmode]").forEach((b) => b.onclick = () => {
        mode = b.dataset.ctmode;
        m.querySelectorAll("[data-ctmode]").forEach((x) => x.classList.toggle("active", x === b));
      });
      m.querySelector("#ctCancel").onclick = () => MT.modal.close();
      m.querySelector("#ctClean").onclick = () => { const t = m.querySelector("#ctText"); t.value = t.value.replace(/\s+/g, " ").trim(); };
      m.querySelector("#ctOpenFile").onclick = async () => {
        const text = await MT.pickFile(".txt,text/plain");
        if (text !== null) m.querySelector("#ctText").value = text;
      };
      m.querySelector("#ctOk").onclick = () => {
        const text = m.querySelector("#ctText").value.trim();
        if (!text) { MT.notify("custom text can't be empty", "error"); return; }
        MT.setConfig("customText", text, { nosave: false });
        MT.setConfig("customTextMode", mode);
        MT.setConfig("customTextLimit", Math.max(0, Math.floor(+m.querySelector("#ctLimit").value || 0)));
        MT.setConfig("customTextPipeDelimiter", m.querySelector("#ctPipe").checked);
        MT.modal.close();
        MT.setConfig("mode", "custom");
        if (MT.currentPage !== "test") go("test");
        MT.test.restart();
      };
    });
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => MT.notify("fullscreen not available", "error"));
  }

  /* ---------------- keyboard ---------------- */
  function quickRestart() {
    if (MT.currentPage !== "test") go("test");
    MT.test.restart();
  }
  function onKeyDown(e) {
    if (MT.commandLine.isOpen) return;
    if (MT.modal.isOpen) { if (e.key === "Escape") { e.preventDefault(); MT.modal.close(); } return; }
    const inField = e.target.matches && e.target.matches("input:not(#wordsInput), textarea, select");
    const qr = MT.config.quickRestart;

    if (e.key === "P" && e.ctrlKey && e.shiftKey || (e.key === "p" && e.ctrlKey && e.shiftKey)) { e.preventDefault(); MT.commandLine.open(); return; }
    if (e.key === "F11") { e.preventDefault(); toggleFullscreen(); return; }
    if (e.key === "Escape") {
      e.preventDefault();
      if (qr === "esc") quickRestart(); else MT.commandLine.open();
      return;
    }
    if (inField) return;
    if (e.key === "Tab") {
      if (qr === "tab") { e.preventDefault(); quickRestart(); return; }
      if (MT.currentPage === "test") {
        e.preventDefault();
        const onResult = !MT.$("#result").classList.contains("hidden");
        (onResult ? MT.$("#nextTestButton") : MT.$("#restartTestButton")).focus();
        // infinite tests (time 0 / words 0) are finished with tab, like monkeytype
        const st = MT.test.state;
        if (st && st.active && !onResult && ((MT.config.mode === "time" && MT.config.time === 0) || (MT.config.mode === "words" && MT.config.words === 0))) MT.test.finish();
      }
      return;
    }
    if (e.key === "Enter" && qr === "enter" && !e.shiftKey) {
      const st = MT.test.state;
      if (!(st && st.zen && st.active)) { e.preventDefault(); quickRestart(); return; }
    }
    // any printable key focuses the words while on the test page
    if (MT.currentPage === "test" && MT.$("#result").classList.contains("hidden") && document.activeElement !== MT.$("#wordsInput")) {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) MT.test.focusInput();
    }
  }

  /* ---------------- init ---------------- */
  function init() {
    MT.applyTheme();
    MT.applyFont();
    MT.applyFontSize();
    document.getElementById("appVersion").textContent = MT.version;
    MT.test.init();
    MT.result.init();
    MT.commandLine.init();
    MT.onConfig(onConfigChange);
    // portable shell (WebView2): keep the native title bar in the theme's colors
    if (window.chrome && window.chrome.webview) {
      const post = () => window.chrome.webview.postMessage({ type: "theme", bg: MT.currentColors.bg, text: MT.currentColors.text, sub: MT.currentColors.sub });
      window.addEventListener("mt-colors", post);
      post();
    }

    document.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-nav]");
      if (nav) { go(nav.dataset.nav); return; }
      const b = e.target.closest("#testConfig button");
      if (!b) return;
      if (b.dataset.config) MT.toggleConfig(b.dataset.config);
      else if (b.dataset.mode) MT.setConfig("mode", b.dataset.mode);
      else if (b.dataset.time) b.dataset.time === "custom" ? customTime() : MT.setConfig("time", +b.dataset.time);
      else if (b.dataset.words) b.dataset.words === "custom" ? customWords() : MT.setConfig("words", +b.dataset.words);
      else if (b.dataset.quote) MT.setConfig("quoteLength", b.dataset.quote === "all" ? [-1] : [+b.dataset.quote]);
      else if (b.id === "customTextButton") customTextModal();
      b.blur();
      MT.test.focusInput();
    });
    MT.$("#restartTestButton").addEventListener("click", () => MT.test.restart());
    MT.$("#languageButton").addEventListener("click", () => {
      if (MT.config.mode === "quote") { MT.notify("quote mode uses the bundled english quotes"); return; }
      const it = MT.pages.allItems().find((i) => i.key === "language");
      MT.commandLine.open({ display: "Language...", sub: () => it.options().map(([v, label]) => ({
        display: label, checked: () => MT.config.language === v, exec: () => MT.setConfig("language", v) })) });
    });
    MT.$("#footerThemeButton").addEventListener("click", () => MT.commandLine.openThemes());
    document.addEventListener("keydown", onKeyDown);

    updateConfigBar();
    go("test");
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => MT.test.remeasure());
  }

  return { init, go, customTime, customWords, customTextModal, toggleFullscreen, updateConfigBar };
})();

document.addEventListener("DOMContentLoaded", MT.app.init);
