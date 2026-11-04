// The house score: a documentary-style soundtrack composed live in the browser with Web Audio
// (felt piano, a string pad, a low cello drone, embers crackling by the grill). There is no audio
// file to download, it never plays the same way twice, and its mood follows the section in view.
// Browsers only allow sound after a tap, so it waits until the visitor turns it on.
import { $$, store, haptic } from './util.js';

const BEAT = 60 / 66;
const STEP = BEAT / 2;     // the scheduler works in eighth notes
const CHORD_STEPS = 16;    // each chord lasts two bars
const VOLUME = 0.8;

// Chords in D major as [bass, pad voicing], in MIDI note numbers.
const PROGS = {
  // I – vi – IV – V, open and unhurried.
  dawn: [[38, [57, 61, 64, 66]], [35, [57, 62, 64, 66]], [43, [57, 59, 62, 66]], [45, [57, 59, 64, 66]]],
  // vi – IV – I – V, the first two over one held cluster: deeper, by the fire.
  hearth: [[35, [54, 59, 61, 62]], [43, [54, 59, 61, 62]], [38, [57, 62, 64, 66]], [45, [57, 62, 64, 69]]],
  // IV – I – ii – V, lifting toward the table.
  gather: [[43, [59, 62, 66, 69]], [42, [57, 62, 64, 69]], [40, [59, 62, 66, 67]], [45, [57, 61, 64, 69]]],
};

// How each section sounds: its chords, how present each layer is (0-1) and how bright the pad is.
// Keys are section ids.
const MOODS = {
  top:         { prog: 'dawn',   pad: 0.9, keys: 0.5, arp: 0,   pulse: 0,   drone: 0.7, embers: 0,   bright: 0.3 },
  ingredients: { prog: 'dawn',   pad: 0.8, keys: 0.7, arp: 0.4, pulse: 0,   drone: 0.5, embers: 0,   bright: 0.45 },
  about:       { prog: 'hearth', pad: 0.9, keys: 0.6, arp: 0.4, pulse: 0,   drone: 0.8, embers: 0,   bright: 0.35 },
  table:       { prog: 'dawn',   pad: 0.7, keys: 0.6, arp: 0.8, pulse: 0.4, drone: 0.5, embers: 0,   bright: 0.55 },
  fire:        { prog: 'hearth', pad: 1,   keys: 0.4, arp: 0.5, pulse: 0.6, drone: 1,   embers: 1,   bright: 0.4 },
  toss:        { prog: 'hearth', pad: 0.8, keys: 0.5, arp: 0.9, pulse: 1,   drone: 0.8, embers: 0.4, bright: 0.65 },
  menu:        { prog: 'gather', pad: 0.8, keys: 0.7, arp: 0.7, pulse: 0.4, drone: 0.5, embers: 0,   bright: 0.55 },
  reserve:     { prog: 'gather', pad: 1,   keys: 0.6, arp: 0.5, pulse: 0.3, drone: 0.7, embers: 0,   bright: 0.5 },
  visit:       { prog: 'dawn',   pad: 0.8, keys: 0.4, arp: 0,   pulse: 0,   drone: 0.6, embers: 0,   bright: 0.3 },
};
// Each layer's level at full presence.
const MIX = { pad: 0.5, keys: 1.5, arp: 0.55, pulse: 0.7, drone: 0.05, embers: 0.5 };

// Melody notes: D major pentatonic from A4 to D6, which sits sweetly over every chord above.
const SCALE = [69, 71, 74, 76, 78, 81, 83, 86];
// Melody rhythms for one chord, as eighth-note positions (0-15).
const RHYTHMS = [[0, 3, 6, 8], [0, 2, 4, 10], [2, 5, 8, 12], [0, 6, 7, 12], [0, 8, 11], [4, 6, 8, 11, 12]];
// Left hand: a broken chord that rises through the voicing and falls back.
const ARP = [0, 1, 2, 3, 4, 3, 2, 1];
const ACCENT = [0.9, 0.45, 0.6, 0.45, 0.8, 0.45, 0.6, 0.5];

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const chance = (p) => Math.random() < p;

export function createEngine(ctx) {
  const now = () => ctx.currentTime;
  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filter = (type, freq, q = 0.7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
  const osc = (type, freq) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o; };

  // ----- Mixing desk: layers -> warm low-pass -> gentle compressor -> fade -> duck -> speakers -----
  const out = gain(0);
  const duckGain = gain(1);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 2.5; comp.attack.value = 0.05; comp.release.value = 0.6;
  const mix = filter('lowpass', 9000, 0.5);
  mix.connect(comp).connect(out).connect(duckGain).connect(ctx.destination);

  // A long, dark hall. The send skips the lows so the reverb never turns to mud.
  const hall = ctx.createConvolver();
  hall.buffer = impulse(4.6);
  hall.connect(mix);
  const send = filter('highpass', 180);
  send.connect(hall);

  const layers = {};
  const layer = (name, wet) => {
    const g = gain(0);
    g.connect(mix);
    g.connect(gain(wet)).connect(send);
    return (layers[name] = g);
  };

  const padTone = filter('lowpass', 1000, 0.6);
  padTone.connect(layer('pad', 0.75));
  const drift = osc('sine', 0.06);
  drift.connect(gain(160)).connect(padTone.frequency);
  drift.start();

  // The melody echoes softly, a dotted eighth behind.
  layer('keys', 0.6);
  const echo = ctx.createDelay(2);
  echo.delayTime.value = BEAT * 0.75;
  const echoTone = filter('lowpass', 2200);
  layers.keys.connect(echo);
  echo.connect(echoTone).connect(gain(0.3)).connect(echo);
  const echoOut = gain(0.22);
  echoTone.connect(echoOut);
  echoOut.connect(mix);
  echoOut.connect(send);

  layer('arp', 0.5);
  layer('pulse', 0.3);

  const droneTone = filter('lowpass', 260, 0.9);
  droneTone.connect(layer('drone', 0.3));
  const drones = [osc('sawtooth', 73), osc('sawtooth', 73), osc('sine', 73)];
  drones[1].detune.value = 9;
  drones[0].connect(droneTone);
  drones[1].connect(droneTone);
  drones[2].connect(gain(0.8)).connect(layers.drone);
  drones.forEach((o) => o.start());
  const setBass = (m, t) => drones.forEach((o) => o.frequency.setTargetAtTime(mtof(m), t, 0.4));

  const fire = ctx.createBufferSource();
  fire.buffer = embers(11);
  fire.loop = true;
  fire.connect(layer('embers', 0.15));
  fire.start();

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  noise.getChannelData(0).forEach((_, i, d) => { d[i] = Math.random() * 2 - 1; });

  // ----- Generated sounds -----
  function impulse(sec) {
    const rate = ctx.sampleRate, n = Math.floor(sec * rate);
    const buf = ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / rate;
        lp += (0.7 - 0.62 * (i / n)) * (Math.random() * 2 - 1 - lp); // darker as it fades
        d[i] = lp * Math.exp(-t / 0.75) * Math.min(1, t / 0.02);
      }
    }
    return buf;
  }

  // Coals: a faint sizzle with pops, mostly tiny, now and then a snap.
  function embers(sec) {
    const rate = ctx.sampleRate, n = Math.floor(sec * rate);
    const buf = ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) { lp += 0.5 * (Math.random() * 2 - 1 - lp); d[i] = lp * 0.02; }
      for (let p = 0; p < sec * 12; p++) {
        const at = Math.floor(Math.random() * n);
        const amp = 0.04 + 0.3 * Math.random() ** 6;
        const len = Math.floor(rate * rand(0.002, 0.014));
        for (let j = 0; j < len && at + j < n; j++) d[at + j] += amp * (Math.random() * 2 - 1) * Math.exp(-j / (len / 4));
      }
    }
    return buf;
  }

  // ----- Instruments -----
  // Felt piano: slightly stretched partials, the upper ones fading first, and a soft hammer.
  function piano(t, m, vel, dest) {
    const f = mtof(m);
    const ring = Math.min(9, Math.max(1.8, 9 * 2 ** (-(m - 40) / 18)));
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.6, Math.min(0.6, (m - 64) / 36));
    pan.connect(dest);
    const partials = m > 78 ? 4 : 6;
    for (let k = 1; k <= partials; k++) {
      const a = vel * k ** -(2.6 - 1.4 * vel) * 0.3;
      const life = ring / (1 + 0.9 * (k - 1));
      const g = gain(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.006);
      g.gain.setTargetAtTime(a * 0.45, t + 0.006, 0.12);
      g.gain.setTargetAtTime(0, t + 0.35, life / 3.5);
      g.connect(pan);
      // The fundamental gets a twin a hair sharp, like a piano's paired strings.
      for (const cents of k === 1 ? [0, 1.6] : [0]) {
        const o = osc('sine', f * k * Math.sqrt(1 + 0.0004 * k * k));
        o.detune.value = cents;
        o.connect(g);
        o.start(t);
        o.stop(t + life * 1.6 + 0.4);
      }
    }
    const hammer = ctx.createBufferSource();
    hammer.buffer = noise;
    const hg = gain(0);
    hg.gain.setValueAtTime(vel * 0.05, t);
    hg.gain.setTargetAtTime(0, t, 0.012);
    hammer.connect(filter('bandpass', Math.min(4000, f * 4), 0.9)).connect(hg).connect(pan);
    hammer.start(t, Math.random() * 0.8, 0.08);
  }

  // String pad: two detuned saws per note spread across the stereo field, swelling in and out,
  // with a faint sine an octave above the top note.
  function pad(t, notes, len) {
    const end = t + len;
    notes.forEach((m, i) => {
      const g = gain(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1, t + 2.2);
      g.gain.setTargetAtTime(0, end, 1.3);
      g.connect(padTone);
      for (const side of [-1, 1]) {
        const o = osc('sawtooth', mtof(m));
        o.detune.value = side * 7 + rand(-3, 3);
        const p = ctx.createStereoPanner();
        p.pan.value = side * (0.25 + 0.15 * i);
        o.connect(p).connect(g);
        o.start(t);
        o.stop(end + 7);
      }
    });
    const air = osc('sine', mtof(notes[notes.length - 1] + 12));
    const ag = gain(0);
    ag.gain.setValueAtTime(0, t);
    ag.gain.linearRampToValueAtTime(0.025, t + 3);
    ag.gain.setTargetAtTime(0, end, 1.5);
    air.connect(ag).connect(layers.pad);
    air.start(t);
    air.stop(end + 8);
  }

  // Low strings played short: the pulse under the busier sections.
  function pluck(t, m, vel) {
    const o = osc('sawtooth', mtof(m));
    const f = filter('lowpass', 260 + 1500 * vel, 1.5);
    f.frequency.setValueAtTime(260 + 1500 * vel, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 0.25);
    const g = gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.3, t + 0.008);
    g.gain.setTargetAtTime(0, t + 0.02, 0.09);
    o.connect(f).connect(g).connect(layers.pulse);
    o.start(t);
    o.stop(t + 0.7);
  }

  // ----- Composer -----
  let running = false, step = 0, next = 0, boost = 0;
  let mood = MOODS.top, prev = mood, changed = -99;
  let progName = '', chordIx = -1, chord = PROGS.dawn[0], line = new Map(), motif = null, last = 76;

  // A layer that was just faded out keeps playing until its fade is over.
  const heard = (k, t) => mood[k] > 0 || (prev[k] > 0 && t < changed + 4);

  function makeMotif() {
    const rhythm = pick(RHYTHMS);
    return { rhythm, moves: rhythm.map(() => pick([-2, -1, -1, 0, 1, 1, 2])) };
  }

  // One chord's melody: start on a chord tone near the last note, then follow the motif's shape,
  // with small changes so the repeats never sound mechanical.
  function phrase(voicing, cadence) {
    const notes = new Map();
    if (cadence && chance(0.4)) return notes; // let the end of a phrase breathe
    const tones = SCALE.filter((m) => voicing.some((v) => (m - v) % 12 === 0));
    let i = SCALE.indexOf((tones.length ? tones : SCALE).reduce((a, b) => (Math.abs(b - last) < Math.abs(a - last) ? b : a)));
    const drop = 0.12 + Math.max(0, 0.7 - mood.keys) * 0.6;
    motif.rhythm.forEach((pos, k) => {
      if (k) i += motif.moves[k] + (chance(0.2) ? pick([-1, 1]) : 0);
      if (i < 0) i = 1;
      if (i >= SCALE.length) i = SCALE.length - 2;
      last = SCALE[i];
      if (!k || !chance(drop)) notes.set(pos, last);
    });
    return notes;
  }

  function newChord(t) {
    if (progName !== mood.prog) { progName = mood.prog; chordIx = -1; }
    const prog = PROGS[progName];
    chordIx = (chordIx + 1) % prog.length;
    if (chordIx === 0 || !motif) motif = makeMotif();
    chord = prog[chordIx];
    pad(t, chord[1], CHORD_STEPS * STEP);
    setBass(chord[0], t);
    line = heard('keys', t) ? phrase(chord[1], chordIx === prog.length - 1) : new Map();
  }

  function play(s, t) {
    const pos = s % CHORD_STEPS;
    if (pos === 0) newChord(t);
    const [bass, voicing] = chord;
    const human = () => t + rand(0, 0.018);
    if (heard('arp', t)) {
      const dense = mood.arp >= 0.6;
      const low = bass + 12 < voicing[0] ? bass + 12 : bass;
      if (pos === 0) piano(t, bass, 0.42, layers.arp);
      if (dense || pos % 2 === 0) {
        const i = ARP[(dense ? pos : pos / 2) % ARP.length];
        piano(human(), [low, ...voicing][i], (i ? 0.34 : 0.44) + rand(-0.04, 0.04), layers.arp);
      }
    }
    if (heard('pulse', t)) pluck(t, bass + 12, ACCENT[pos % 8]);
    if (line.has(pos)) piano(human(), line.get(pos), pos === 0 ? 0.6 : rand(0.42, 0.56), layers.keys);
  }

  const tone = (t) => padTone.frequency.setTargetAtTime(420 + mood.bright * 1500 + boost * 900, t, 0.6);
  function levels(t, tau) {
    for (const k in layers) layers[k].gain.setTargetAtTime(mood[k] * MIX[k], t, tau);
    tone(t);
  }

  function tick(horizon = now() + 0.45) {
    if (boost > 0.02) { boost *= 0.85; tone(now()); }
    if (!running) return;
    // After a stall (a throttled timer), skip ahead rather than pile up notes.
    if (next < now()) next = now() + 0.05;
    while (next < horizon) { play(step++, next); next += STEP; }
  }

  function start(t = now()) {
    if (running) return;
    running = true;
    step = 0; next = t + 0.08; progName = ''; prev = mood;
    levels(t, 0.3);
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(VOLUME, t + 3.5);
  }

  function stop(t = now()) {
    running = false;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.setTargetAtTime(0, t, 0.35);
  }

  function setMood(name, t = now()) {
    const m = MOODS[name];
    if (!m || m === mood) return;
    prev = mood; mood = m; changed = t;
    levels(t, 1.8);
  }

  return {
    ctx, start, stop, tick, setMood,
    // Scrolling fast opens the pad up a little, so the music breathes with the page.
    nudge: (v) => { boost = Math.max(boost, v); },
    duck: (on) => duckGain.gain.setTargetAtTime(on ? 0.15 : 1, now(), on ? 0.25 : 0.8),
    get running() { return running; },
  };
}

export function initScore() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const buttons = $$('[data-sound]');
  if (!AC) { buttons.forEach((b) => b.remove()); return; }
  let engine = null, on = false, timer = 0, rest = 0, section = 'top';

  const render = () => buttons.forEach((b) => {
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? 'Turn the music off' : 'Turn the music on');
  });
  const hint = (show) => buttons[0]?.classList.toggle('is-hint', show);

  function play() {
    if (on) return;
    on = true;
    // iOS: play through the silent switch, as a video would once the visitor asks for sound.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
    if (!engine) {
      engine = createEngine(new AC({ latencyHint: 'playback' }));
      engine.setMood(section);
    }
    clearTimeout(rest);
    engine.ctx.resume();
    engine.start();
    clearInterval(timer);
    timer = setInterval(() => engine.tick(), 100);
    engine.tick();
    hint(false);
    render();
  }

  function mute() {
    if (!on) return;
    on = false;
    engine.stop();
    rest = setTimeout(() => { clearInterval(timer); engine.ctx.suspend(); }, 2000);
    render();
  }

  buttons.forEach((b) => b.addEventListener('click', () => {
    haptic(8);
    if (on) mute(); else play();
    store('bh.score', on);
  }));

  // The guided tour plays like a documentary, so it starts the score unless the visitor turned it off.
  $$('[data-tour-start]').forEach((b) => b.addEventListener('click', () => { if (store('bh.score') !== false) play(); }));

  // Turned on last visit: carry on at the first tap or key press (browsers need one).
  if (store('bh.score') === true) {
    const events = ['pointerup', 'touchend', 'keydown'];
    const wake = (e) => {
      if (!e.isTrusted) return;
      events.forEach((type) => removeEventListener(type, wake, true));
      if (!e.target.closest?.('[data-sound]')) play();
    };
    events.forEach((type) => addEventListener(type, wake, true));
  }

  // First visit: a small nudge under the nav button once the film has started.
  if (store('bh.score') == null) {
    setTimeout(() => {
      if (on) return;
      hint(true);
      setTimeout(() => hint(false), 6000);
    }, 5000);
  }

  Object.keys(MOODS).forEach((id) => {
    const sec = document.getElementById(id);
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => {
        if (!self.isActive) return;
        section = id;
        engine?.setMood(id);
      },
    });
  });
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { if (on) engine.nudge(Math.min(1, Math.abs(self.getVelocity()) / 4000)); } });

  // Story videos have their own sound: the score dips under it.
  const loud = () => $$('video').some((v) => !v.paused && !v.muted && v.volume > 0);
  ['play', 'pause', 'ended', 'volumechange'].forEach((type) => document.addEventListener(type, () => engine?.duck(loud()), true));

  document.addEventListener('visibilitychange', () => {
    if (!on) return;
    if (document.hidden) {
      engine.stop();
      rest = setTimeout(() => engine.ctx.suspend(), 1000);
    } else {
      clearTimeout(rest);
      engine.ctx.resume();
      engine.start();
    }
  });
}
