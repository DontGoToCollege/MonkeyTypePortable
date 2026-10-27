/* Monkeytype Portable - result screen and charts (canvas, no chart library). */
"use strict";

MT.chart = (() => {
  /** draw a monkeytype-style result chart: wpm (main), raw (sub), errors (x markers, right axis) */
  function drawResult(canvas, data, hoverIndex = -1) {
    const c = MT.currentColors;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return null;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const g = canvas.getContext("2d");
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    const n = data.wpm.length;
    if (!n) return null;
    const font = getComputedStyle(document.body).fontFamily;
    const pad = { l: 46, r: 34, t: 10, b: 26 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const speeds = [...data.wpm, ...data.raw].map(MT.fromWpm).filter((v) => isFinite(v));
    let maxV = Math.max(1, ...speeds);
    let minV = MT.config.startGraphsAtZero ? 0 : Math.max(0, Math.min(...speeds));
    const step = niceStep((maxV - minV) / 4);
    maxV = Math.ceil(maxV / step) * step;
    minV = Math.floor(minV / step) * step;
    const maxErr = Math.max(1, ...data.err);
    const x = (i) => pad.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
    const y = (v) => pad.t + ph - ((v - minV) / (maxV - minV || 1)) * ph;
    const ye = (v) => pad.t + ph - (v / maxErr) * ph;

    g.font = `11px ${font}`;
    g.textBaseline = "middle";
    g.lineWidth = 1;
    // grid + left axis
    for (let v = minV; v <= maxV + 1e-9; v += step) {
      g.strokeStyle = c.subAlt; g.beginPath(); g.moveTo(pad.l, y(v)); g.lineTo(W - pad.r, y(v)); g.stroke();
      g.fillStyle = c.sub; g.textAlign = "right"; g.fillText(fmtAxis(v), pad.l - 8, y(v));
    }
    // right axis (errors)
    g.textAlign = "left";
    const errStep = Math.max(1, Math.ceil(maxErr / 4));
    for (let v = 0; v <= maxErr; v += errStep) g.fillText(String(v), W - pad.r + 8, ye(v));
    // x labels
    g.textAlign = "center"; g.textBaseline = "top";
    const every = Math.max(1, Math.ceil(n / 12));
    for (let i = 0; i < n; i++) if (i % every === 0 || i === n - 1) g.fillText(String(i + 1), x(i), H - pad.b + 8);
    // axis titles
    g.save(); g.translate(11, pad.t + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(MT.config.typingSpeedUnit === "wpm" ? "Words per Minute" : MT.speedUnits[MT.config.typingSpeedUnit].full, 0, 0); g.restore();
    g.save(); g.translate(W - 6, pad.t + ph / 2); g.rotate(Math.PI / 2); g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("Errors", 0, 0); g.restore();

    // raw line (sub) with soft fill
    line(g, data.raw.map(MT.fromWpm), x, y, c.sub, 2, true, pad.t + ph);
    // wpm line (main)
    line(g, data.wpm.map(MT.fromWpm), x, y, c.main, 3, false);
    // error markers
    g.strokeStyle = c.error; g.lineWidth = 2;
    data.err.forEach((e, i) => {
      if (!e) return;
      const px = x(i), py = ye(e), s = 3.5;
      g.beginPath(); g.moveTo(px - s, py - s); g.lineTo(px + s, py + s); g.moveTo(px + s, py - s); g.lineTo(px - s, py + s); g.stroke();
    });
    if (hoverIndex >= 0 && hoverIndex < n) {
      g.strokeStyle = c.sub; g.lineWidth = 1; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(x(hoverIndex), pad.t); g.lineTo(x(hoverIndex), pad.t + ph); g.stroke(); g.setLineDash([]);
      for (const [arr, col] of [[data.raw, c.sub], [data.wpm, c.main]]) {
        g.fillStyle = col; g.beginPath(); g.arc(x(hoverIndex), y(MT.fromWpm(arr[hoverIndex] || 0)), 4, 0, Math.PI * 2); g.fill();
      }
    }
    return { indexAt: (px) => Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / (pw || 1)) * (n - 1)))), x };
  }

  function line(g, vals, x, y, color, width, fill, baseY) {
    if (!vals.length) return;
    g.beginPath();
    vals.forEach((v, i) => (i ? g.lineTo(x(i), y(v || 0)) : g.moveTo(x(i), y(v || 0))));
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = "round"; g.stroke();
    if (fill) {
      g.lineTo(x(vals.length - 1), baseY); g.lineTo(x(0), baseY); g.closePath();
      g.globalAlpha = 0.08; g.fillStyle = color; g.fill(); g.globalAlpha = 1;
    }
  }
  function niceStep(raw) {
    const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function fmtAxis(v) { return Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1); }

  /** history chart for the stats page: wpm points + rolling average of 10 */
  function drawHistory(canvas, results) {
    const c = MT.currentColors;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const g = canvas.getContext("2d");
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    const n = results.length;
    const font = getComputedStyle(document.body).fontFamily;
    g.font = `11px ${font}`;
    if (!n) { g.fillStyle = c.sub; g.textAlign = "center"; g.fillText("no results yet", W / 2, H / 2); return; }
    const pad = { l: 44, r: 40, t: 10, b: 20 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const vals = results.map((r) => MT.fromWpm(r.wpm));
    const step = niceStep(Math.max(...vals, 1) / 4);
    const maxV = Math.ceil(Math.max(...vals, 1) / step) * step;
    const x = (i) => pad.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
    const y = (v) => pad.t + ph - (v / maxV) * ph;
    const yAcc = (a) => pad.t + ph - ((a - 50) / 50) * ph;
    g.textBaseline = "middle";
    for (let v = 0; v <= maxV + 1e-9; v += step) {
      g.strokeStyle = c.bg; g.lineWidth = 1; g.beginPath(); g.moveTo(pad.l, y(v)); g.lineTo(W - pad.r, y(v)); g.stroke();
      g.fillStyle = c.sub; g.textAlign = "right"; g.fillText(String(Math.round(v)), pad.l - 8, y(v));
    }
    g.textAlign = "left";
    for (let a = 50; a <= 100; a += 25) g.fillText(a + "%", W - pad.r + 6, yAcc(a));
    // accuracy line
    g.beginPath(); results.forEach((r, i) => (i ? g.lineTo(x(i), yAcc(Math.max(50, r.acc))) : g.moveTo(x(i), yAcc(Math.max(50, r.acc)))));
    g.strokeStyle = c.sub; g.globalAlpha = 0.5; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
    // points
    g.fillStyle = c.main;
    results.forEach((r, i) => { g.beginPath(); g.arc(x(i), y(MT.fromWpm(r.wpm)), n > 200 ? 1.5 : 2.5, 0, Math.PI * 2); g.fill(); });
    // rolling average (10)
    g.beginPath();
    results.forEach((r, i) => {
      const from = Math.max(0, i - 9);
      const avg = MT.mean(vals.slice(from, i + 1));
      i ? g.lineTo(x(i), y(avg)) : g.moveTo(x(i), y(avg));
    });
    g.strokeStyle = c.text; g.lineWidth = 2; g.stroke();
  }

  return { drawResult, drawHistory };
})();

MT.result = (() => {
  const $ = (id) => document.getElementById(id);
  let current = null;
  let chartApi = null;

  function testTypeText(res) {
    const lines = [];
    if (res.mode === "time") lines.push(`time ${res.mode2}`);
    else if (res.mode === "words") lines.push(`words ${res.mode2}`);
    else if (res.mode === "quote") lines.push(`quote ${["short", "medium", "long", "thicc"][res.quoteLength] || ""}`.trim());
    else lines.push(res.mode2 === "practice" ? "practice" : res.mode);
    lines.push(res.mode === "quote" ? "english quotes" : res.language.replace(/_/g, " "));
    if (res.punctuation) lines.push("punctuation");
    if (res.numbers) lines.push("numbers");
    if (res.blindMode) lines.push("blind");
    if (res.difficulty !== "normal") lines.push(res.difficulty);
    return lines.map(MT.escape).join("<br>");
  }

  function show(data, extra) {
    current = data;
    const { res } = data;
    const unit = MT.config.typingSpeedUnit;
    MT.$("#typingTest").classList.add("hidden");
    MT.$("#testConfig").classList.add("hidden");
    $("result").classList.remove("hidden");
    MT.$("#result .stats .wpm .top").textContent = unit;
    $("resWpm").innerHTML = MT.escape(MT.fmtSpeed(res.wpm)) + (extra.isPb ? '<span class="crown fa" title="new personal best">&#xf521;</span>' : "");
    $("resWpm").title = `${MT.fromWpm(res.wpm).toFixed(2)} ${unit}`;
    $("resAcc").textContent = Math.floor(res.acc) + "%";
    $("resAcc").title = `${res.acc.toFixed(2)}%\n${data.res.charStats[0]} correct\n${data.res.charStats[1] + data.res.charStats[2]} incorrect`;
    $("resRaw").textContent = MT.fmtSpeed(res.rawWpm);
    $("resRaw").title = `${MT.fromWpm(res.rawWpm).toFixed(2)} ${unit}`;
    $("resChars").textContent = res.charStats.join("/");
    $("resCons").textContent = Math.round(res.consistency) + "%";
    $("resCons").title = res.consistency.toFixed(2) + "%";
    $("resTime").textContent = Math.round(res.testDuration) + "s";
    $("resTime").title = res.testDuration.toFixed(2) + "s";
    $("resType").innerHTML = testTypeText(res);
    const src = MT.$("#result .source");
    if (data.quote) { src.classList.remove("hidden"); $("resSource").textContent = data.quote.source; }
    else src.classList.add("hidden");

    const info = [];
    if (res.failed) info.push(`<span class="failed">failed (${MT.escape(res.failReason)})</span>`);
    if (extra.invalid) info.push(`<span class="failed">invalid (${MT.escape(extra.invalid)})</span>`);
    if (extra.isPb) info.push(extra.pbBefore ? `new pb! (+${MT.fmtSpeed(res.wpm - extra.pbBefore.wpm, 2)})` : "new pb!");
    else if (extra.pbBefore && !res.failed && !extra.invalid) info.push(`pb: ${MT.fmtSpeed(extra.pbBefore.wpm)} ${unit}`);
    if (res.repeated) info.push("repeated");
    if (res.restartCount) info.push(`${res.restartCount} restart${res.restartCount > 1 ? "s" : ""}`);
    $("resInfo").innerHTML = info.join("<br>") || "-";
    MT.$("#result .info").classList.toggle("hidden", !info.length);

    renderWordsHistory();
    $("resultWordsHistory").classList.toggle("hidden", !MT.config.alwaysShowWordsHistory);
    $("practiseWordsButton").classList.toggle("hidden", !Object.keys(data.missed).length || data.zen);
    requestAnimationFrame(() => drawChart(-1));
  }

  function drawChart(hover) {
    if (!current) return;
    chartApi = MT.chart.drawResult($("resultChart"), current.chart, hover);
  }

  function renderWordsHistory() {
    const box = MT.$("#resultWordsHistory .words");
    const { words, inputs, bursts, zen } = current;
    let html = "";
    const count = zen ? inputs.length : Math.min(words.length, Math.max(inputs.length, 1));
    for (let i = 0; i < count; i++) {
      const target = zen ? (inputs[i] || "") : words[i];
      const input = inputs[i];
      if (input === undefined && !zen) continue;
      let letters = "";
      const len = Math.max(target.length, input.length);
      for (let j = 0; j < len; j++) {
        if (j < input.length) {
          if (j < target.length) letters += `<letter class="${input[j] === target[j] ? "correct" : "incorrect"}">${MT.escape(target[j])}</letter>`;
          else letters += `<letter class="incorrect extra">${MT.escape(input[j])}</letter>`;
        } else letters += `<letter>${MT.escape(target[j])}</letter>`;
      }
      const err = !zen && input !== target;
      const burst = bursts[i] !== undefined ? MT.fmtSpeed(bursts[i]) : "-";
      html += `<div class="word${err ? " error" : ""}" data-burst="${burst}" title="${MT.escape(input)}">${letters}</div>`;
    }
    box.innerHTML = html || '<span style="color:var(--sub-color)">nothing typed</span>';
  }

  function hide() {
    $("result").classList.add("hidden");
    MT.$("#chartTooltip").classList.add("hidden");
  }

  function init() {
    $("nextTestButton").onclick = () => MT.test.restart();
    $("repeatTestButton").onclick = () => MT.test.restart({ repeat: true });
    $("showWordHistoryButton").onclick = () => $("resultWordsHistory").classList.toggle("hidden");
    $("practiseWordsButton").onclick = () => {
      if (!current) return;
      const missed = Object.entries(current.missed).sort((a, b) => b[1] - a[1]).map(([w]) => w);
      const list = [];
      missed.forEach((w, i) => { for (let k = 0; k < Math.max(1, 5 - Math.floor(i / 3)); k++) list.push(w); });
      MT.shuffle(list);
      MT.test.restart({ practice: list.slice(0, 100) });
    };
    const canvas = $("resultChart");
    const tip = $("chartTooltip");
    canvas.addEventListener("mousemove", (e) => {
      if (!current || !chartApi) return;
      const rect = canvas.getBoundingClientRect();
      const i = chartApi.indexAt(e.clientX - rect.left);
      drawChart(i);
      const ch = current.chart;
      const u = MT.config.typingSpeedUnit;
      tip.innerHTML = `<b>${i + 1}</b><br>${u}: ${MT.fmtSpeed(ch.wpm[i] || 0)}<br>raw: ${MT.fmtSpeed(ch.raw[i] || 0)}<br>errors: ${ch.err[i] || 0}`;
      tip.classList.remove("hidden");
      const px = chartApi.x(i);
      tip.style.left = Math.min(px + 12, rect.width - tip.offsetWidth) + "px";
      tip.style.top = "0px";
    });
    canvas.addEventListener("mouseleave", () => { tip.classList.add("hidden"); drawChart(-1); });
    window.addEventListener("resize", () => { if (!$("result").classList.contains("hidden")) drawChart(-1); });
    window.addEventListener("mt-colors", () => { if (current && !$("result").classList.contains("hidden")) drawChart(-1); });
  }

  return { init, show, hide, get current() { return current; } };
})();
