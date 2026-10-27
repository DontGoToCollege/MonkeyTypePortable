/* Monkeytype Portable - typing test engine.
 * Scoring follows the captured monkeytype result builder:
 *   wpm  = chars->wpm(correct word chars incl. their spaces)
 *   raw  = chars->wpm(all correct + incorrect + extra chars incl. spaces)
 *   acc  = correct keypresses / all keypresses * 100
 *   consistency = kogasa(stdDev(raw per second) / mean(raw per second)) */
"use strict";

MT.test = (() => {
  const $ = (id) => document.getElementById(id);
  const els = {};
  let st = null;
  let lastResult = null;
  let restartCount = 0;
  let lineHeight = 0;
  let paceRaf = 0;
  let caretIdleTimer = 0;
  let focusWarnTimer = 0;

  const MAX_EXTRA = 20;

  function newState() {
    return {
      active: false, finished: false, failed: false, failReason: "",
      source: null, quote: null,
      words: [], inputs: [], current: "", wordIndex: 0,
      startTime: 0, endTime: 0,
      correctKeys: 0, incorrectKeys: 0,
      secChars: [], secErrors: [], wpmHistory: [], rawHistory: [], errHistory: [],
      bursts: [], wordStart: 0, missed: {},
      timerHandle: 0, nextTick: 0, second: 0,
      repeat: false, pace: null,
    };
  }

  /* ---------------- word buffer & rendering ---------------- */
  function total() { return st.source.total; }
  function fillWords(minAhead) {
    while (st.words.length < total() && st.words.length - st.wordIndex < minAhead) {
      const w = st.source.next(st.words.length);
      if (w === null || w === undefined) break;
      st.words.push(w);
      els.words.appendChild(makeWordEl(st.words.length - 1));
    }
  }

  function makeWordEl(i) {
    const div = document.createElement("div");
    div.className = "word";
    div.dataset.i = i;
    div.innerHTML = renderLetters(st.words[i], "", false);
    return div;
  }

  function renderLetters(target, input, submitted) {
    let html = "";
    const len = Math.max(target.length, input.length);
    for (let j = 0; j < len; j++) {
      if (j < input.length) {
        if (j < target.length) {
          const ok = input[j] === target[j];
          html += `<letter class="${ok ? "correct" : "incorrect"}">${MT.escape(target[j])}</letter>`;
        } else {
          html += `<letter class="incorrect extra">${MT.escape(input[j])}</letter>`;
        }
      } else {
        html += `<letter${submitted ? ' class="missed"' : ""}>${MT.escape(target[j])}</letter>`;
      }
    }
    return html;
  }

  function wordEl(i) { return els.words.querySelector(`.word[data-i="${i}"]`); }

  function updateWord(i) {
    const el = wordEl(i);
    if (!el) return;
    const active = i === st.wordIndex;
    const input = active ? st.current : (st.inputs[i] ?? "");
    const submitted = i < st.wordIndex;
    if (st.zen) el.innerHTML = MT.escape(input).split("").map((c) => `<letter class="correct">${c}</letter>`).join("") || "";
    else el.innerHTML = renderLetters(st.words[i], input, submitted);
    el.classList.toggle("active", active);
    el.classList.toggle("typed", submitted);
    el.classList.toggle("error", submitted && !st.zen && input !== st.words[i]);
  }

  function measureLineHeight() {
    const first = els.words.querySelector(".word:not(.removed)");
    if (!first) return;
    const cs = getComputedStyle(first);
    lineHeight = first.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    els.wrapper.style.height = (lineHeight * 3) + "px";
  }

  /** monkeytype keeps 3 lines visible: when the active word reaches line 3, drop line 1 */
  function lineJump() {
    const active = wordEl(st.wordIndex);
    if (!active || !lineHeight) return;
    const visible = els.words.querySelectorAll(".word:not(.removed)");
    if (!visible.length) return;
    const top0 = visible[0].offsetTop;
    if (active.offsetTop >= top0 + lineHeight * 2 - 2) {
      const cut = active.offsetTop - lineHeight;
      for (const w of visible) {
        if (w.offsetTop < cut - 2 && +w.dataset.i < st.wordIndex) w.classList.add("removed");
        else break;
      }
    }
  }

  /* ---------------- caret ---------------- */
  const caretSpeeds = { off: 0, slow: 150, medium: 100, fast: 85 };
  function caretPos(wordIndex, letterIndex) {
    const w = wordEl(wordIndex);
    if (!w || w.classList.contains("removed")) return null;
    const letters = w.querySelectorAll("letter");
    const fontPx = parseFloat(getComputedStyle(els.caret).fontSize) || 32;
    let left, width;
    if (letters.length === 0) { left = w.offsetLeft; width = fontPx * 0.5; }
    else if (letterIndex < letters.length) { left = w.offsetLeft + letters[letterIndex].offsetLeft; width = letters[letterIndex].offsetWidth; }
    else { const l = letters[letters.length - 1]; left = w.offsetLeft + l.offsetLeft + l.offsetWidth; width = l.offsetWidth; }
    return { left, top: w.offsetTop, width, wordHeight: w.offsetHeight, fontPx };
  }
  function placeCaret(el, style, p, animate) {
    if (!p) { el.classList.add("invisible"); return; }
    el.classList.remove("invisible");
    const caretH = style === "underline" ? p.fontPx * 0.1 : p.fontPx * 1.2;
    let top = p.top + (p.wordHeight - caretH) / 2 - 1;
    if (style === "underline") top = p.top + p.wordHeight - caretH;
    let left = p.left;
    if (style === "default" || style === "off") left -= p.fontPx * 0.05;
    const ms = animate ? caretSpeeds[MT.config.smoothCaret] ?? 100 : 0;
    el.style.transition = ms ? `left ${ms}ms linear, top ${ms}ms linear, width ${ms}ms linear` : "none";
    el.style.left = left + "px";
    el.style.top = top + "px";
    if (style === "block" || style === "outline" || style === "underline") el.style.width = p.width + "px";
    else el.style.width = "";
  }
  function updateCaret(animate = true) {
    placeCaret(els.caret, MT.config.caretStyle, caretPos(st.wordIndex, st.current.length), animate);
  }
  function caretTyping() {
    els.caret.classList.add("typing");
    clearTimeout(caretIdleTimer);
    caretIdleTimer = setTimeout(() => els.caret.classList.remove("typing"), 500);
  }

  /* ---------------- pace caret ---------------- */
  function initPace() {
    st.pace = null;
    els.paceCaret.classList.add("hidden");
    const mode = MT.config.paceCaret;
    if (mode === "off" || st.zen) return;
    const results = MT.getResults().filter((r) => !r.failed);
    let wpm = 0;
    if (mode === "custom") wpm = MT.config.paceCaretCustomSpeed;
    else if (mode === "last") wpm = results.length ? results[results.length - 1].wpm : 0;
    else {
      const probe = describe();
      const same = results.filter((r) => r.mode === probe.mode && String(r.mode2) === String(probe.mode2) &&
        r.punctuation === probe.punctuation && r.numbers === probe.numbers && r.language === probe.language);
      if (mode === "pb") wpm = same.reduce((m, r) => Math.max(m, r.wpm), 0);
      if (mode === "average") wpm = MT.mean(same.slice(-10).map((r) => r.wpm));
    }
    if (!wpm || wpm < 1) return;
    st.pace = { wpm, cps: (wpm * 5) / 60 };
    els.paceCaret.className = MT.config.paceCaretStyle;
  }
  function paceFrame() {
    if (!st || !st.active || !st.pace) return;
    let chars = ((performance.now() - st.startTime) / 1000) * st.pace.cps;
    let wi = 0;
    while (wi < st.words.length && chars > st.words[wi].length) { chars -= st.words[wi].length + 1; wi++; }
    if (wi >= st.words.length) { els.paceCaret.classList.add("hidden"); return; }
    els.paceCaret.classList.remove("hidden");
    placeCaret(els.paceCaret, MT.config.paceCaretStyle, caretPos(wi, Math.max(0, Math.floor(chars))), true);
    paceRaf = requestAnimationFrame(paceFrame);
  }

  /* ---------------- stats ---------------- */
  function countChars() {
    const c = { correctWord: 0, correct: 0, incorrect: 0, extra: 0, missed: 0, spaces: 0, correctSpaces: 0 };
    const last = st.wordIndex;
    for (let i = 0; i <= last && i < st.words.length + (st.zen ? 1 : 0); i++) {
      const isCurrent = i === last;
      const input = isCurrent ? st.current : st.inputs[i];
      if (input === undefined) continue;
      if (st.zen) { c.correctWord += input.length; c.correct += input.length; if (!isCurrent) { c.spaces++; c.correctSpaces++; } continue; }
      const target = st.words[i];
      if (input === target) {
        c.correctWord += target.length; c.correct += target.length;
      } else {
        // a correct prefix of the unfinished last word still counts (monkeytype countChars)
        if (isCurrent && target.startsWith(input)) c.correctWord += input.length;
        for (let j = 0; j < input.length; j++) {
          if (j < target.length) { if (input[j] === target[j]) c.correct++; else c.incorrect++; }
          else c.extra++;
        }
        if (!isCurrent && input.length < target.length) c.missed += target.length - input.length;
      }
      if (!isCurrent) { c.spaces++; if (input === target) c.correctSpaces++; }
    }
    return c;
  }
  function elapsedSec(now = performance.now()) { return st.active || st.finished ? ((st.endTime || now) - st.startTime) / 1000 : 0; }
  function liveWpm() {
    const s = elapsedSec(); if (s <= 0) return 0;
    const c = countChars();
    return MT.charsToWpm(c.correctWord + c.correctSpaces, s);
  }
  function liveAcc() {
    const t = st.correctKeys + st.incorrectKeys;
    return t ? (st.correctKeys / t) * 100 : 100;
  }

  /* ---------------- timer (self-correcting 1s tick) ---------------- */
  function startTimer() {
    st.second = 0;
    st.nextTick = st.startTime + 1000;
    const tick = () => {
      if (!st.active) return;
      st.second++;
      sampleSecond(st.second, 1);
      const s = st.second;
      if (MT.config.mode === "time" && !st.zen && !st.practice && s >= MT.config.time && MT.config.time > 0) { finish(); return; }
      if (MT.config.minWpm === "custom" && s >= 3 && liveWpm() < MT.config.minWpmCustomSpeed) { fail("min wpm"); return; }
      if (MT.config.minAcc === "custom" && s >= 3 && liveAcc() < MT.config.minAccCustom) { fail("min accuracy"); return; }
      updateLiveStats();
      st.nextTick += 1000;
      st.timerHandle = setTimeout(tick, Math.max(0, st.nextTick - performance.now()));
    };
    st.timerHandle = setTimeout(tick, 1000);
  }
  function sampleSecond(sec, fraction) {
    const idx = sec - 1;
    const chars = st.secChars[idx] || 0;
    st.rawHistory[idx] = MT.roundTo2(MT.charsToWpm(chars, fraction));
    st.errHistory[idx] = st.secErrors[idx] || 0;
    st.wpmHistory[idx] = MT.roundTo2(liveWpm());
  }
  function secIndex() { return Math.floor((performance.now() - st.startTime) / 1000); }
  function addChar(isError) {
    const i = secIndex();
    st.secChars[i] = (st.secChars[i] || 0) + 1;
    if (isError) st.secErrors[i] = (st.secErrors[i] || 0) + 1;
  }

  /* ---------------- live stats display ---------------- */
  function updateLiveStats() {
    const cfg = MT.config;
    const showTimer = cfg.timerStyle !== "off" && st.active;
    let timerText = "";
    if (st.active) {
      if (cfg.mode === "time" && !st.zen) timerText = String(Math.max(0, cfg.time - st.second));
      else if (st.zen || total() === Infinity) timerText = String(st.second);
      else timerText = `${st.wordIndex}/${total()}`;
    }
    els.miniTimer.textContent = cfg.timerStyle === "mini" ? timerText : "";
    els.miniSpeed.textContent = cfg.liveSpeedStyle !== "off" && st.active ? MT.fmtSpeed(liveWpm()) : "";
    els.miniAcc.textContent = cfg.liveAccStyle !== "off" && st.active ? Math.floor(liveAcc()) + "%" : "";
    els.miniBurst.textContent = cfg.liveBurstStyle !== "off" && st.active && st.bursts.length ? MT.fmtSpeed(st.bursts[st.bursts.length - 1]) : "";
    els.mini.classList.toggle("visible", st.active && (cfg.timerStyle === "mini" || cfg.liveSpeedStyle !== "off" || cfg.liveAccStyle !== "off" || cfg.liveBurstStyle !== "off"));
    els.timerBar.classList.toggle("visible", showTimer && cfg.timerStyle === "bar");
    if (cfg.timerStyle === "bar" && st.active) {
      let p = 0;
      if (cfg.mode === "time" && !st.zen) p = st.second / cfg.time;
      else if (total() !== Infinity) p = st.wordIndex / total();
      els.timerBar.firstElementChild.style.transform = `scaleX(${Math.max(0, 1 - p)})`;
    }
  }

  /* ---------------- input handling ---------------- */
  function start() {
    st.active = true;
    st.startTime = performance.now();
    st.wordStart = st.startTime;
    MT.bumpLifetime({ started: 1 });
    startTimer();
    if (MT.config.focusMode) document.body.classList.add("focus");
    updateLiveStats();
    if (st.pace) paceRaf = requestAnimationFrame(paceFrame);
  }

  function isLastWord() { return st.wordIndex === total() - 1; }

  function handleChar(ch) {
    if (!st || st.finished) return;
    if (ch === "\n" || ch === "\r") return;
    if (!st.active) start();
    caretTyping();
    if (st.zen) {
      st.current += ch;
      st.correctKeys++;
      addChar(false);
      MT.sound.click();
      ensureZenWord();
      updateWord(st.wordIndex);
      lineJump();
      updateCaret();
      return;
    }
    const target = st.words[st.wordIndex];
    const pos = st.current.length;
    const correct = pos < target.length && target[pos] === ch;
    if (!correct && MT.config.stopOnError === "letter") {
      st.incorrectKeys++;
      addChar(true);
      MT.sound.error();
      return;
    }
    if (pos >= target.length + MAX_EXTRA) return;
    st.current += ch;
    if (correct) { st.correctKeys++; MT.sound.click(); }
    else {
      st.incorrectKeys++;
      st.missed[target] = (st.missed[target] || 0) + 1;
      if (MT.config.playSoundOnError !== "off") MT.sound.error(); else MT.sound.click();
    }
    addChar(!correct);
    if (!correct && MT.config.difficulty === "master") { updateWord(st.wordIndex); fail("master"); return; }
    updateWord(st.wordIndex);
    updateCaret();
    if (isLastWord()) {
      if (st.current === target || (MT.config.quickEnd && st.current.length >= target.length)) {
        st.bursts.push(MT.roundTo2(MT.charsToWpm(st.current.length, (performance.now() - st.wordStart) / 1000)));
        st.inputs[st.wordIndex] = st.current;
        finish();
      }
    }
  }

  function handleSpace() {
    if (!st || st.finished) return;
    if (st.zen) {
      if (!st.active) return;
      caretTyping();
      if (st.current === "") return;
      st.correctKeys++;
      addChar(false);
      submitWord(true);
      return;
    }
    if (!st.active) return;
    if (st.current === "" && !MT.config.strictSpace) return;
    caretTyping();
    const target = st.words[st.wordIndex];
    const correct = st.current === target;
    if (!correct && MT.config.stopOnError === "word") {
      st.incorrectKeys++;
      addChar(true);
      MT.sound.error();
      return;
    }
    if (correct) { st.correctKeys++; MT.sound.click(); }
    else {
      st.incorrectKeys++;
      st.missed[target] = (st.missed[target] || 0) + 1;
      if (MT.config.playSoundOnError !== "off") MT.sound.error(); else MT.sound.click();
    }
    addChar(!correct);
    if (!correct && (MT.config.difficulty === "expert" || MT.config.difficulty === "master")) {
      st.inputs[st.wordIndex] = st.current;
      fail(MT.config.difficulty);
      return;
    }
    submitWord(correct);
  }

  function submitWord() {
    const now = performance.now();
    st.bursts.push(MT.roundTo2(MT.charsToWpm(st.current.length, (now - st.wordStart) / 1000)));
    st.wordStart = now;
    st.inputs[st.wordIndex] = st.current;
    st.current = "";
    const prev = st.wordIndex;
    st.wordIndex++;
    if (st.zen) { ensureZenWord(); }
    else if (st.wordIndex >= total()) { updateWord(prev); finish(); return; }
    fillWords(60);
    updateWord(prev);
    updateWord(st.wordIndex);
    lineJump();
    updateCaret();
    if (MT.config.timerStyle === "mini" && MT.config.mode !== "time") updateLiveStats();
  }

  function ensureZenWord() {
    if (st.words.length <= st.wordIndex) {
      st.words.push("");
      els.words.appendChild(makeWordEl(st.wordIndex));
    }
  }

  function handleBackspace(wholeWord) {
    if (!st || st.finished || !st.active) return;
    if (MT.config.confidenceMode === "max") return;
    caretTyping();
    if (st.current.length > 0) {
      if (wholeWord) {
        // ctrl+backspace: delete back to the previous word boundary
        st.current = "";
      } else {
        st.current = st.current.slice(0, -1);
      }
    } else if (st.wordIndex > 0) {
      if (MT.config.confidenceMode === "on") return;
      const pi = st.wordIndex - 1;
      const prevEl = wordEl(pi);
      if (!prevEl || prevEl.classList.contains("removed")) return;
      const prevInput = st.inputs[pi] ?? "";
      if (!st.zen && prevInput === st.words[pi] && !MT.config.freedomMode) return;
      if (st.zen && !MT.config.freedomMode) return;
      st.wordIndex = pi;
      st.current = wholeWord ? "" : prevInput;
      st.inputs.length = pi;
      st.bursts.pop();
      updateWord(pi + 1);
    }
    updateWord(st.wordIndex);
    updateCaret();
  }

  /* ---------------- finish / fail ---------------- */
  function stopTimers() {
    clearTimeout(st.timerHandle);
    cancelAnimationFrame(paceRaf);
  }

  function describe() {
    const cfg = MT.config;
    let mode = cfg.mode, mode2;
    if (st && st.zen) { mode = "zen"; mode2 = "zen"; }
    else if (st && st.practice) { mode = "custom"; mode2 = "practice"; }
    else if (mode === "time") mode2 = cfg.time;
    else if (mode === "words") mode2 = cfg.words;
    else if (mode === "quote") mode2 = st && st.quote ? st.quote.id : -1;
    else mode2 = "custom";
    return { mode, mode2, punctuation: cfg.punctuation, numbers: cfg.numbers, language: cfg.language, difficulty: cfg.difficulty };
  }

  function buildResult() {
    const now = performance.now();
    st.endTime = st.endTime || now;
    let secs = (st.endTime - st.startTime) / 1000;
    if (MT.config.mode === "time" && !st.zen && !st.practice && !st.failed) secs = Math.min(secs, MT.config.time) || MT.config.time;
    // final partial second for the chart / consistency (monkeytype adds the trailing fraction)
    const full = Math.floor(secs + 1e-9);
    const frac = secs - full;
    for (let s = st.second + 1; s <= full; s++) sampleSecond(s, 1);
    if (frac > 0.1 && st.rawHistory.length === full) sampleSecond(full + 1, frac);
    const c = countChars();
    const wpm = MT.roundTo2(MT.charsToWpm(c.correctWord + c.correctSpaces, secs));
    const raw = MT.roundTo2(MT.charsToWpm(c.correct + c.spaces + c.incorrect + c.extra, secs));
    const acc = MT.roundTo2(liveAcc());
    const rawSeries = st.rawHistory.filter((x) => typeof x === "number");
    let consistency = MT.roundTo2(MT.kogasa(MT.stdDev(rawSeries) / MT.mean(rawSeries)));
    if (!isFinite(consistency) || isNaN(consistency)) consistency = 0;
    const d = describe();
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      wpm, rawWpm: raw, acc, consistency,
      charStats: [c.correctWord + c.correctSpaces, c.incorrect, c.extra, c.missed],
      ...d,
      testDuration: MT.roundTo2(secs),
      quoteLength: st.quote ? st.quote.group : -1,
      quoteSource: st.quote ? st.quote.source : undefined,
      blindMode: MT.config.blindMode, freedom: MT.config.freedomMode,
      restartCount, repeated: st.repeat, failed: st.failed, failReason: st.failReason,
    };
  }

  function finish() {
    if (st.finished) return;
    st.finished = true;
    st.active = false;
    st.endTime = performance.now();
    stopTimers();
    document.body.classList.remove("focus");
    const res = buildResult();
    const chart = { wpm: st.wpmHistory.slice(), raw: st.rawHistory.slice(), err: st.errHistory.slice() };
    MT.bumpLifetime({ timeTyping: res.testDuration });
    let invalid = "";
    if (res.testDuration < 1) invalid = "test too short";
    else if (res.wpm > 350) invalid = "wpm out of range";
    else if (!st.zen && st.words.length && res.charStats[0] === 0 && res.wpm === 0 && res.acc < 1) invalid = "no correct input";
    let pbBefore = null, isPb = false;
    if (!res.failed && !invalid) {
      pbBefore = MT.getPb(res);
      isPb = !pbBefore || res.wpm > pbBefore.wpm;
      res.isPb = isPb;
      const results = MT.getResults();
      results.push(res);
      MT.saveResults(results);
      MT.bumpLifetime({ completed: 1 });
    }
    lastResult = { res, chart, words: st.words.slice(0, Math.max(st.wordIndex + 1, st.inputs.length)), inputs: st.current && st.inputs.length === st.wordIndex ? [...st.inputs, st.current] : st.inputs.slice(), bursts: st.bursts.slice(), missed: Object.assign({}, st.missed), quote: st.quote, zen: st.zen };
    restartCount = 0;
    MT.result.show(lastResult, { isPb, pbBefore, invalid });
    MT.randomizeTheme();
  }

  function fail(reason) {
    st.failed = true;
    st.failReason = reason;
    MT.notify(`test failed - ${reason}`, "error");
    finish();
  }

  /* ---------------- restart ---------------- */
  function applyWordsClasses() {
    const cfg = MT.config;
    const w = els.words;
    w.className = "";
    if (cfg.colorfulMode) w.classList.add("colorfulMode");
    if (cfg.flipTestColors) w.classList.add("flipped");
    if (cfg.blindMode) w.classList.add("blind");
    if (cfg.hideExtraLetters) w.classList.add("hideExtraLetters");
    if (cfg.highlightMode === "word") w.classList.add("highlight-word");
    if (cfg.highlightMode === "off") w.classList.add("highlight-off");
    if (cfg.typedEffect !== "keep") w.classList.add("typed-effect-" + cfg.typedEffect);
    if (st && st.zen) w.classList.add("zen");
    els.caret.className = cfg.caretStyle;
  }

  function restart(opts = {}) {
    if (st) {
      if (st.active && !st.finished) { restartCount++; MT.bumpLifetime({ timeTyping: elapsedSec() }); }
      stopTimers();
    }
    const repeatWords = opts.repeat && lastResult && !lastResult.zen ? lastResult.words : null;
    const practiceWords = opts.practice || null;
    st = newState();
    const cfg = Object.assign({}, MT.config);
    if (repeatWords) cfg.repeatQuote = lastResult.quote;
    st.zen = cfg.mode === "zen" && !repeatWords && !practiceWords;
    st.source = practiceWords ? MT.words.create(cfg, practiceWords) : MT.words.create(cfg, repeatWords);
    st.quote = st.source.quote || null;
    st.repeat = !!repeatWords;
    st.practice = !!practiceWords;
    els.words.innerHTML = "";
    els.words.classList.remove("removed");
    applyWordsClasses();
    if (st.zen) ensureZenWord(); else fillWords(100);
    updateWord(0);
    document.body.classList.remove("focus");
    MT.result.hide();
    els.typingTest.classList.remove("hidden");
    MT.$("#testConfig").classList.remove("hidden");
    measureLineHeight();
    updateCaret(false);
    els.caret.classList.remove("typing");
    updateLiveStats();
    initPace();
    renderNotices();
    MT.$("#languageName").textContent = st.quote ? `english quotes` : cfg.language.replace(/_/g, " ");
    focusInput();
  }

  function renderNotices() {
    const cfg = MT.config;
    const n = [];
    if (st.repeat) n.push(["&#xf01e;", "repeated"]);
    if (cfg.difficulty !== "normal") n.push(["&#xf54c;", cfg.difficulty]);
    if (cfg.blindMode) n.push(["&#xf070;", "blind"]);
    if (cfg.freedomMode) n.push(["&#xf4c4;", "freedom"]);
    if (cfg.stopOnError !== "off") n.push(["&#xf05e;", "stop on " + cfg.stopOnError]);
    if (cfg.confidenceMode !== "off") n.push(["&#xf3ed;", cfg.confidenceMode === "max" ? "max confidence" : "confidence"]);
    if (st.pace) n.push(["&#xf70c;", `pace ${MT.fmtSpeed(st.pace.wpm)} ${cfg.typingSpeedUnit}`]);
    if (cfg.minWpm === "custom") n.push(["&#xf3fd;", `min ${cfg.minWpmCustomSpeed} wpm`]);
    if (cfg.minAcc === "custom") n.push(["&#xf3fd;", `min ${cfg.minAccCustom}% acc`]);
    if (st.zen) n.push(["&#xf6fc;", "shift + enter to finish"]);
    els.notice.innerHTML = n.map(([i, t]) => `<span><span class="fa">${i}</span>${MT.escape(t)}</span>`).join("");
  }

  /* ---------------- focus ---------------- */
  function focusInput() {
    if (MT.currentPage !== "test" || MT.modal.isOpen || MT.commandLine?.isOpen) return;
    els.input.focus({ preventScroll: true });
    setOutOfFocus(false);
  }
  function setOutOfFocus(out) {
    clearTimeout(focusWarnTimer);
    if (!out) { els.words.classList.remove("blurred"); els.ofw.classList.remove("visible"); els.caret.classList.remove("invisible"); return; }
    focusWarnTimer = setTimeout(() => {
      if (document.activeElement === els.input) return;
      if (!MT.config.showOutOfFocusWarning) return;
      if (!els.result.classList.contains("hidden")) return;
      els.words.classList.add("blurred");
      els.ofw.classList.add("visible");
      els.caret.classList.add("invisible");
    }, 300);
  }

  /* ---------------- init ---------------- */
  function init() {
    Object.assign(els, {
      typingTest: $("typingTest"), wrapper: $("wordsWrapper"), words: $("words"), input: $("wordsInput"),
      caret: $("caret"), paceCaret: $("paceCaret"), ofw: $("outOfFocusWarning"), notice: $("testModesNotice"),
      mini: $("liveStatsMini"), miniTimer: $("miniTimer"), miniSpeed: $("miniSpeed"), miniAcc: $("miniAcc"), miniBurst: $("miniBurst"),
      timerBar: $("timerBar"), result: $("result"), caps: $("capsWarning"),
    });

    els.input.addEventListener("beforeinput", (e) => {
      e.preventDefault();
      if (e.inputType === "insertText" && e.data) for (const ch of e.data) ch === " " ? handleSpace() : handleChar(ch);
    });
    els.input.addEventListener("compositionend", (e) => {
      if (e.data) for (const ch of e.data) ch === " " ? handleSpace() : handleChar(ch);
      els.input.value = "";
    });
    els.input.addEventListener("input", (e) => { if (!e.isComposing) els.input.value = ""; });
    els.input.addEventListener("paste", (e) => e.preventDefault());
    els.input.addEventListener("keydown", (e) => {
      if (MT.config.capsLockWarning && e.getModifierState) els.caps.classList.toggle("hidden", !e.getModifierState("CapsLock"));
      if (e.key === "Backspace") { e.preventDefault(); handleBackspace(e.ctrlKey || e.altKey || e.metaKey); return; }
      if (e.key === " " && !e.isComposing) { e.preventDefault(); handleSpace(); return; }
      if (e.key === "Enter" && st && st.zen && e.shiftKey && st.active) { e.preventDefault(); finish(); return; }
      if (e.key === "Enter" && st && st.zen && st.active && !e.shiftKey) { e.preventDefault(); return; }
    });
    els.input.addEventListener("keyup", (e) => {
      if (MT.config.capsLockWarning && e.getModifierState) els.caps.classList.toggle("hidden", !e.getModifierState("CapsLock"));
    });
    els.input.addEventListener("blur", () => setOutOfFocus(true));
    els.input.addEventListener("focus", () => setOutOfFocus(false));
    els.wrapper.addEventListener("mousedown", (e) => { e.preventDefault(); focusInput(); });
    document.addEventListener("mousemove", () => document.body.classList.remove("focus"));
    window.addEventListener("resize", () => {
      if (!st) return;
      MT.$$(".word.removed", els.words).forEach((w) => w.classList.remove("removed"));
      measureLineHeight();
      lineJump();
      updateCaret(false);
    });
  }

  return {
    init, restart, finish, focusInput, updateCaret,
    applyWordsClasses,
    get state() { return st; },
    get lastResult() { return lastResult; },
    isActive: () => !!(st && st.active),
    remeasure() { if (!st) return; measureLineHeight(); lineJump(); updateCaret(false); },
  };
})();
