/* Monkeytype Portable - synthesized typing sounds (WebAudio, no audio files needed). */
"use strict";

MT.sound = (() => {
  let ctx = null;
  const ac = () => {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  function envGain(c, t, peak, decay) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(c.destination);
    return g;
  }

  function noiseBurst(c, t, vol, decay, freq, q) {
    const len = Math.ceil(c.sampleRate * decay);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
    src.connect(f); f.connect(envGain(c, t, vol, decay));
    src.start(t);
  }

  function tone(c, t, type, f0, f1, vol, decay) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    o.connect(envGain(c, t, vol, decay));
    o.start(t); o.stop(t + decay + 0.02);
  }

  const clickTypes = {
    click: (c, t, v) => { noiseBurst(c, t, v * 0.9, 0.035, 3200 + Math.random() * 600, 1.2); },
    beep: (c, t, v) => { tone(c, t, "sine", 880 + Math.random() * 40, 860, v * 0.35, 0.06); },
    pop: (c, t, v) => { tone(c, t, "sine", 520 + Math.random() * 80, 180, v * 0.6, 0.07); },
    typewriter: (c, t, v) => { noiseBurst(c, t, v, 0.05, 1800 + Math.random() * 400, 0.8); tone(c, t, "square", 140, 90, v * 0.08, 0.04); },
    thock: (c, t, v) => { noiseBurst(c, t, v * 0.7, 0.06, 700 + Math.random() * 150, 1.5); tone(c, t, "triangle", 160, 90, v * 0.3, 0.05); },
  };
  const errorTypes = {
    damage: (c, t, v) => { tone(c, t, "square", 180, 90, v * 0.18, 0.12); },
    triangle: (c, t, v) => { tone(c, t, "triangle", 300, 150, v * 0.4, 0.15); },
    buzz: (c, t, v) => { tone(c, t, "sawtooth", 110, 100, v * 0.15, 0.1); },
  };

  return {
    clickTypes: Object.keys(clickTypes),
    errorTypes: Object.keys(errorTypes),
    click() {
      const type = MT.config.playSoundOnClick;
      if (type === "off" || !clickTypes[type]) return;
      const c = ac(); if (!c) return;
      clickTypes[type](c, c.currentTime, MT.config.soundVolume);
    },
    error() {
      const type = MT.config.playSoundOnError;
      if (type === "off" || !errorTypes[type]) return;
      const c = ac(); if (!c) return;
      errorTypes[type](c, c.currentTime, MT.config.soundVolume);
    },
    preview(kind, type) {
      const c = ac(); if (!c) return;
      const table = kind === "error" ? errorTypes : clickTypes;
      if (table[type]) table[type](c, c.currentTime, MT.config.soundVolume);
    },
  };
})();
