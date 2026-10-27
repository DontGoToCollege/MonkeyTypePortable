/* Monkeytype Portable - command line (esc / ctrl+shift+p), single-list search like monkeytype. */
"use strict";

MT.commandLine = (() => {
  let stack = [];      // submenu stack of { title, items }
  let items = [];      // currently displayed entries
  let selected = 0;
  let previewing = false;
  const $ = (id) => document.getElementById(id);

  const sameVal = (a, b) => a === b || String(a) === String(b);
  const configOptions = (key, opts, after) => opts.map(([v, label]) => ({
    display: label, checked: () => sameVal(MT.config[key], v),
    exec: () => { MT.setConfig(key, v); if (after) after(v); },
  }));

  function root() {
    const list = [
      { display: "Punctuation", icon: "&#xf1fa;", checked: () => MT.config.punctuation, exec: () => MT.toggleConfig("punctuation") },
      { display: "Numbers", icon: "&#xf292;", checked: () => MT.config.numbers, exec: () => MT.toggleConfig("numbers") },
      { display: "Mode...", icon: "&#xf0c9;", sub: () => configOptions("mode", [["time", "time"], ["words", "words"], ["quote", "quote"], ["zen", "zen"], ["custom", "custom"]]) },
      { display: "Time...", icon: "&#xf017;", sub: () => [
        ...configOptions("time", [[15, "15"], [30, "30"], [60, "60"], [120, "120"]], () => MT.setConfig("mode", "time")),
        { display: "custom...", exec: () => MT.app.customTime() }] },
      { display: "Words...", icon: "&#xf031;", sub: () => [
        ...configOptions("words", [[10, "10"], [25, "25"], [50, "50"], [100, "100"]], () => MT.setConfig("mode", "words")),
        { display: "custom...", exec: () => MT.app.customWords() }] },
      { display: "Quote length...", icon: "&#xf10d;", sub: () => [["all", [-1]], ["short", [0]], ["medium", [1]], ["long", [2]], ["thicc", [3]]].map(([label, v]) => ({
        display: label, checked: () => JSON.stringify(MT.config.quoteLength) === JSON.stringify(v),
        exec: () => { MT.setConfig("quoteLength", v); MT.setConfig("mode", "quote"); } })) },
      { display: "Custom text...", icon: "&#xf0ad;", exec: () => MT.app.customTextModal() },
      { display: "Theme...", icon: "&#xf53f;", sub: themeItems, isTheme: true },
      { display: "Favorite themes...", icon: "&#xf005;", sub: () => themeItems(MT.config.favThemes.filter(MT.themeExists)), isTheme: true },
      { display: "Custom theme", icon: "&#xf53f;", checked: () => MT.config.customTheme, exec: () => MT.toggleConfig("customTheme") },
    ];
    for (const it of MT.pages.allItems()) {
      if (it.range) {
        list.push({ display: it.title + "...", icon: it.icon, sub: () => configOptions(it.key, [[0.1, "quiet"], [0.25, "low"], [0.5, "medium"], [0.75, "high"], [1, "max"]]) });
        continue;
      }
      const opts = (typeof it.options === "function" ? it.options() : it.options)
        .map(([v, l]) => [v, /^[\w ]/.test(l) ? l : `${v} ${l}`]);  // glyph-only labels (caret styles) get their name
      list.push({
        display: it.title + "...", icon: it.icon,
        sub: () => configOptions(it.key, opts, (v) => { if (it.preview && v !== "off") MT.sound.preview(it.preview, v); }),
      });
    }
    list.push(
      { display: "Randomize theme...", icon: "&#xf074;", sub: () => configOptions("randomTheme", [["off", "off"], ["on", "on"], ["fav", "fav"], ["light", "light"], ["dark", "dark"]]) },
      { display: "Restart test", icon: "&#xf01e;", exec: () => { MT.app.go("test"); MT.test.restart(); } },
      { display: "Repeat test", icon: "&#xf01e;", exec: () => { MT.app.go("test"); MT.test.restart({ repeat: true }); } },
      { display: "View stats & history", icon: "&#xf521;", exec: () => MT.app.go("stats") },
      { display: "View settings", icon: "&#xf013;", exec: () => MT.app.go("settings") },
      { display: "View about", icon: "&#xf129;", exec: () => MT.app.go("about") },
      { display: "Toggle fullscreen", icon: "&#xf065;", exec: () => MT.app.toggleFullscreen() },
    );
    return list;
  }

  function themeItems(names = MT.themeNames) {
    return names.map((n) => ({
      display: n.replace(/_/g, " "), theme: n,
      checked: () => !MT.config.customTheme && MT.config.theme === n,
      exec: () => { MT.setConfig("customTheme", false); MT.setConfig("theme", n); },
    }));
  }

  function open(startWith) {
    if (MT.modal.isOpen) return;
    stack = [];
    $("commandLineWrapper").classList.remove("hidden");
    MT.commandLine.isOpen = true;
    $("commandInput").value = "";
    if (startWith) push(startWith.display, startWith.sub());
    else show(root());
    setTimeout(() => $("commandInput").focus(), 0);
  }

  function close() {
    if (previewing) { MT.applyTheme(); previewing = false; }
    $("commandLineWrapper").classList.add("hidden");
    MT.commandLine.isOpen = false;
    if (MT.currentPage === "test") MT.test.focusInput();
  }

  function push(title, list) {
    stack.push({ title, items: list });
    $("commandInput").value = "";
    $("commandInput").placeholder = title.replace("...", "");
    show(list);
  }

  function back() {
    if (previewing) { MT.applyTheme(); previewing = false; }
    stack.pop();
    $("commandInput").value = "";
    $("commandInput").placeholder = stack.length ? stack[stack.length - 1].title.replace("...", "") : "Search...";
    show(stack.length ? stack[stack.length - 1].items : root());
  }

  function show(list) { items = list; selected = 0; filter(); }

  let view = [];
  function filter() {
    const q = $("commandInput").value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const match = (s) => terms.every((t) => s.toLowerCase().includes(t));
    if (!stack.length && terms.length) {
      // single-list mode: search top-level entries and every submenu entry
      view = [];
      for (const it of root()) {
        if (match(it.display)) view.push(it);
        if (it.sub && !it.isTheme) for (const s of it.sub()) {
          const label = `${it.display.replace("...", "")} > ${s.display}`;
          if (match(label)) view.push(Object.assign({}, s, { display: label, icon: it.icon }));
        }
        if (it.isTheme && it.display === "Theme...") for (const s of themeItems()) {
          const label = `Theme > ${s.display}`;
          if (match(label)) view.push(Object.assign({}, s, { display: label, icon: it.icon }));
        }
      }
    } else {
      view = terms.length ? items.filter((i) => match(i.display)) : items.slice();
    }
    if (selected >= view.length) selected = Math.max(0, view.length - 1);
    render();
  }

  function render() {
    const box = $("commandList");
    if (!view.length) { box.innerHTML = `<div class="empty">Nothing found</div>`; return; }
    box.innerHTML = view.map((it, i) => {
      const t = it.theme ? MT.themeColors(it.theme) : null;
      const bubbles = t ? `<span class="themeBubbles" style="background:${t.bg}"><span style="background:${t.main}"></span><span style="background:${t.sub}"></span><span style="background:${t.text}"></span></span>` : "";
      const check = it.checked && it.checked() ? `<span class="check fa">&#xf00c;</span>` : "";
      return `<div class="entry${i === selected ? " selected" : ""}" data-i="${i}"><span class="icon fa">${it.icon || (it.checked ? "" : "&#xf054;")}</span><span>${MT.escape(it.display)}</span>${bubbles}${check}</div>`;
    }).join("");
    const sel = box.querySelector(".entry.selected");
    if (sel) sel.scrollIntoView({ block: "nearest" });
    previewSelected();
  }

  function previewSelected() {
    const it = view[selected];
    if (it && it.theme) { MT.previewTheme(it.theme); previewing = true; }
    else if (previewing) { MT.applyTheme(); previewing = false; }
  }

  function execute(it) {
    if (!it) return;
    if (it.sub) { push(it.display, it.sub()); return; }
    previewing = false;
    it.exec();
    close();
  }

  function init() {
    $("commandInput").addEventListener("input", () => { selected = 0; filter(); });
    $("commandInput").addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) { e.preventDefault(); selected = (selected + 1) % Math.max(1, view.length); render(); }
      else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) { e.preventDefault(); selected = (selected - 1 + view.length) % Math.max(1, view.length); render(); }
      else if (e.key === "Enter") { e.preventDefault(); execute(view[selected]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (stack.length) back(); else close(); }
      else if (e.key === "Backspace" && !$("commandInput").value && stack.length) { e.preventDefault(); back(); }
    });
    $("commandList").addEventListener("mousemove", (e) => {
      const el = e.target.closest(".entry");
      if (!el || +el.dataset.i === selected) return;
      selected = +el.dataset.i;
      MT.$$(".entry", $("commandList")).forEach((x) => x.classList.toggle("selected", x === el));
      previewSelected();
    });
    $("commandList").addEventListener("click", (e) => {
      const el = e.target.closest(".entry");
      if (el) execute(view[+el.dataset.i]);
    });
    $("commandLineWrapper").addEventListener("mousedown", (e) => { if (e.target.id === "commandLineWrapper") close(); });
  }

  return { init, open, close, isOpen: false, openThemes: () => open({ display: "Theme...", sub: themeItems }) };
})();
