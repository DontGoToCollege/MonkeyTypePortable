/* Monkeytype Portable - word generation.
 * Ported from the captured monkeytype bundle: the word-pick retry rules, the punctuation
 * routine (uw) and the English contraction table (rw). Only the English branches are kept,
 * since the bundled languages are all English word sets. */
"use strict";

MT.words = (() => {
  const capitalize = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  const lastChar = (w) => (w === undefined || w === "" ? undefined : w.charAt(w.length - 1));

  // captured contraction table (rw)
  const contractions = [
    ["are", ["aren't"]], ["can", ["can't"]], ["could", ["couldn't"]], ["did", ["didn't"]],
    ["does", ["doesn't"]], ["do", ["don't"]], ["had", ["hadn't"]], ["has", ["hasn't"]],
    ["have", ["haven't"]], ["is", ["isn't"]], ["it", ["it's", "it'll"]], ["i", ["i'm", "i'll", "i've", "i'd"]],
    ["you", ["you'll", "you're", "you've", "you'd"]], ["that", ["that's", "that'll", "that'd"]],
    ["must", ["mustn't", "must've"]], ["there", ["there's", "there'll", "there'd"]],
    ["he", ["he's", "he'll", "he'd"]], ["she", ["she's", "she'll", "she'd"]], ["we", ["we're", "we'll", "we'd"]],
    ["they", ["they're", "they'll", "they'd"]], ["should", ["shouldn't", "should've"]], ["was", ["wasn't"]],
    ["were", ["weren't"]], ["will", ["won't"]], ["would", ["wouldn't", "would've"]], ["going", ["goin'"]],
  ];
  const findContraction = (w) => contractions.find((c) => new RegExp(`^([\\W]*${c[0]}[\\W]*)$`, "i").test(w));
  function contract(w) {
    const c = findContraction(w);
    if (!c) return w;
    const pick = MT.pick(c[1]);
    return w.replace(new RegExp(`^(?:([\\W]*)(${c[0]})([\\W]*))$`, "i"), (_, pre, base, post) => {
      const upperFirst = base.charAt(0) === base.charAt(0).toUpperCase();
      const allUpper = base !== "I" && base === base.toUpperCase();
      return pre + (upperFirst ? (allUpper ? pick.toUpperCase() : capitalize(pick)) : pick) + post;
    });
  }

  /** port of captured uw(previousWord, word, index, maxIndex), English branch */
  function punctuateWord(prev, word, index, maxIndex) {
    let w = word;
    const last = lastChar(prev);
    if (index === 0 || (last !== undefined && /[?!.]/.test(last))) {
      w = capitalize(w);
    } else if ((Math.random() < 0.1 && last !== "." && last !== "," && index !== maxIndex - 2) || index === maxIndex - 1) {
      const r = Math.random();
      if (r <= 0.8) w += ".";
      else if (r < 0.9) w += "?";
      else w += "!";
    } else if (Math.random() < 0.01 && last !== "," && last !== ".") {
      w = `"${w}"`;
    } else if (Math.random() < 0.011 && last !== "," && last !== ".") {
      w = `'${w}'`;
    } else if (Math.random() < 0.012 && last !== "," && last !== ".") {
      w = `(${w})`;
    } else if (Math.random() < 0.013 && last !== "," && last !== "." && last !== ";" && last !== ":") {
      w += ":";
    } else if (Math.random() < 0.014 && last !== "," && last !== "." && prev !== "-") {
      w = "-";
    } else if (Math.random() < 0.015 && last !== "," && last !== "." && last !== ";" && last !== ":") {
      w += ";";
    } else if (Math.random() < 0.2 && last !== ",") {
      w += ",";
    } else if (Math.random() < 0.5 && findContraction(w)) {
      w = contract(w);
    }
    return w;
  }

  /** captured getNumbers(len): random digit string of length 1..len */
  function getNumbers(len) {
    const n = MT.randInt(1, len);
    let s = "";
    for (let i = 0; i < n; i++) {
      let d = MT.randInt(0, 9);
      if (i === 0 && d === 0 && n > 1) d = MT.randInt(1, 9);
      s += d;
    }
    return s;
  }

  const PUNCT_RX = /[-=_+[\]{};'\\:"|,./<>?]/i;

  /** random word source with monkeytype's retry rules */
  function languageSource(cfg) {
    const list = (window.MT_LANGUAGES[cfg.language] || window.MT_LANGUAGES.english).words;
    const total = cfg.mode === "words" && cfg.words > 0 ? cfg.words : Infinity;
    const history = [];
    return {
      total,
      next(index) {
        if (index >= total) return null;
        const p1 = history[history.length - 1];
        const p2 = history[history.length - 2];
        let w = MT.pick(list);
        let tries = 0;
        while (tries < 100 && (w === p1 || w === p2 ||
          (!cfg.punctuation && w === "I") ||
          (!cfg.punctuation && PUNCT_RX.test(w)) ||
          (!cfg.numbers && /[0-9]/.test(w)))) {
          tries++;
          w = MT.pick(list);
        }
        history.push(w);
        if (/[A-Z]/.test(w) && !cfg.punctuation) w = w.toLowerCase();
        w = w.replace(/ +/g, " ").trim();
        // multi-word entries are split into separate words, like monkeytype does
        const parts = w.split(" ");
        let out = parts[0];
        if (parts.length > 1) this.pending = parts.slice(1);
        if (cfg.punctuation) out = punctuateWord(this.prevOut, out, index, total);
        if (cfg.numbers && Math.random() < 0.1) out = getNumbers(4);
        this.prevOut = out;
        return out;
      },
    };
  }

  function quoteSource(cfg) {
    const { groups, quotes } = window.MT_QUOTES;
    const sel = cfg.quoteLength.includes(-1) || !cfg.quoteLength.length ? [0, 1, 2, 3] : cfg.quoteLength;
    let pool = quotes.filter((q) => {
      const len = q[1].length;
      return sel.some((g) => len >= groups[g][0] && len <= groups[g][1]);
    });
    if (!pool.length) pool = quotes;
    const recent = MT.LS.get(MT.keys.recentQuotes, []);
    let fresh = pool.filter((q) => !recent.includes(q[0]));
    if (!fresh.length) fresh = pool;
    const q = cfg.forcedQuote || MT.pick(fresh);
    MT.LS.set(MT.keys.recentQuotes, [q[0], ...recent.filter((id) => id !== q[0])].slice(0, 50));
    const lengthGroup = groups.findIndex((g) => q[1].length >= g[0] && q[1].length <= g[1]);
    const list = q[1].replace(/\s+/g, " ").trim().split(" ");
    return {
      total: list.length,
      quote: { id: q[0], text: q[1], source: q[2], group: lengthGroup },
      next: (i) => (i < list.length ? list[i] : null),
    };
  }

  function customSource(cfg) {
    let text = cfg.customText || "";
    text = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2013|\u2014/g, "-");
    const list = (cfg.customTextPipeDelimiter ? text.split("|") : text.split(/\s+/))
      .map((w) => w.trim()).filter(Boolean)
      .map((w) => (cfg.customTextPipeDelimiter ? w.replace(/\s+/g, " ") : w));
    if (!list.length) list.push("empty");
    const mode = cfg.customTextMode;
    const limit = cfg.customTextLimit > 0 ? cfg.customTextLimit : (mode === "random" ? 100 : list.length);
    let order = list.slice();
    if (mode === "shuffle") MT.shuffle(order);
    const words = [];
    let last = null, last2 = null;
    for (let i = 0; i < limit; i++) {
      let w;
      if (mode === "random") {
        w = MT.pick(list);
        let t = 0;
        while (list.length > 2 && t < 100 && (w === last || w === last2)) { w = MT.pick(list); t++; }
      } else {
        if (mode === "shuffle" && i > 0 && i % order.length === 0) MT.shuffle(order);
        w = order[i % order.length];
      }
      last2 = last; last = w;
      words.push(...w.split(" "));
    }
    return { total: words.length, next: (i) => (i < words.length ? words[i] : null) };
  }

  return {
    punctuateWord, getNumbers, contract,
    /** create a word source for the current config (or a frozen word list for repeat tests) */
    create(cfg, repeatWords) {
      if (repeatWords) return { total: repeatWords.length, next: (i) => (i < repeatWords.length ? repeatWords[i] : null), quote: cfg.repeatQuote };
      if (cfg.mode === "quote") return quoteSource(cfg);
      if (cfg.mode === "custom") return customSource(cfg);
      if (cfg.mode === "zen") return { total: Infinity, next: () => null };
      const src = languageSource(cfg);
      return {
        total: src.total,
        next(i) {
          if (src.pending && src.pending.length) return src.pending.shift();
          return src.next(i);
        },
      };
    },
  };
})();
