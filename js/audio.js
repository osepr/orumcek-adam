// Ses efektleri: hepsi Web Audio API ile anında üretilir, dosya gerekmez.
// Tarayıcılar sesi ancak bir kullanıcı etkileşiminden sonra açtığı için
// ilk tuş/tık/dokunuşta ses motoru başlatılır.
const MUTE_KEY = "spiderman-muted";

const Sound = {
  ctx: null,
  master: null,
  noiseBuf: null,
  muted: false,

  init() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { /* yoksay */ }
    const unlock = () => this.unlock();
    for (const ev of ["keydown", "mousedown", "touchstart"]) {
      window.addEventListener(ev, unlock, { passive: true });
    }
  },

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      // 1 saniyelik beyaz gürültü (ağ "fış" sesleri için)
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    try { localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0"); } catch { /* yoksay */ }
    return this.muted;
  },

  ready() {
    return this.ctx && this.ctx.state === "running" && !this.muted;
  },

  // Temel tonlar: frekans kaydırmalı osilatör
  tone(freq, dur, { type = "square", vol = 0.2, slideTo = 0, delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  // Filtrelenmiş gürültü: ağ, rüzgar, darbe sesleri
  noise(dur, { vol = 0.3, freq = 2000, freqTo = 0, q = 1, filter = "bandpass", delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  },

  // ---------- Oyun sesleri ----------

  web() { // "thwip!"
    if (!this.ready()) return;
    this.noise(0.18, { freq: 3500, freqTo: 700, q: 2, vol: 0.5 });
    this.tone(900, 0.12, { type: "triangle", slideTo: 300, vol: 0.1 });
  },

  release() { // rüzgar "vuuş"
    if (!this.ready()) return;
    this.noise(0.28, { freq: 400, freqTo: 1600, q: 0.8, vol: 0.2 });
  },

  jump() {
    if (!this.ready()) return;
    this.tone(280, 0.15, { type: "square", slideTo: 560, vol: 0.08 });
  },

  land() {
    if (!this.ready()) return;
    this.noise(0.09, { freq: 250, filter: "lowpass", vol: 0.35 });
  },

  shoot() { // kısa, tiz ağ atışı
    if (!this.ready()) return;
    this.noise(0.1, { freq: 4500, freqTo: 1500, q: 3, vol: 0.4 });
    this.tone(1300, 0.08, { type: "triangle", slideTo: 500, vol: 0.08 });
  },

  webHit() { // dron ağa yakalandı
    if (!this.ready()) return;
    this.noise(0.15, { freq: 900, freqTo: 200, filter: "lowpass", vol: 0.5 });
    this.tone(240, 0.3, { type: "sawtooth", slideTo: 70, vol: 0.1 });
  },

  stomp() {
    if (!this.ready()) return;
    this.tone(200, 0.14, { type: "square", slideTo: 60, vol: 0.2 });
    this.noise(0.12, { freq: 350, filter: "lowpass", vol: 0.45 });
  },

  coin() {
    if (!this.ready()) return;
    this.tone(988, 0.08, { type: "square", vol: 0.08 });
    this.tone(1319, 0.2, { type: "square", vol: 0.08, delay: 0.07 });
  },

  start() {
    if (!this.ready()) return;
    [523, 659, 784].forEach((f, i) =>
      this.tone(f, 0.14, { type: "square", vol: 0.08, delay: i * 0.08 }));
  },

  gameOver(isRecord) {
    Music.stop();
    if (!this.ready()) return;
    this.noise(0.35, { freq: 500, freqTo: 80, filter: "lowpass", vol: 0.5 });
    [523, 415, 330, 262].forEach((f, i) =>
      this.tone(f, 0.25, { type: "triangle", vol: 0.18, delay: 0.1 + i * 0.15 }));
    if (isRecord) {
      [523, 659, 784, 1047].forEach((f, i) =>
        this.tone(f, i === 3 ? 0.4 : 0.12, { type: "square", vol: 0.09, delay: 0.9 + i * 0.1 }));
    }
  },
};

// ---------- Arka plan müziği ----------
// 4 ölçülük döngü: Am – F – C – G. Her ölçü 16 adım (16'lık nota).
// Notalar "önden planlama" ile Web Audio zamanlayıcısına verilir,
// böylece setInterval'in kaymaları ritmi bozmaz.
const MUSIC_KEY = "spiderman-music";

const CHORDS = [
  { bass: 110.0, tones: [220.0, 261.63, 329.63] },  // Am
  { bass: 87.31, tones: [174.61, 220.0, 261.63] },  // F
  { bass: 130.81, tones: [261.63, 329.63, 392.0] }, // C
  { bass: 98.0, tones: [196.0, 246.94, 293.66] },   // G
];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2]; // arpej sırası (8'lik notalar)
const BASS = [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 2, 0]; // 1: kök, 2: oktav

const Music = {
  on: true,
  playing: false,
  tempo: 124,
  step: 0,
  nextTime: 0,
  timer: null,
  gain: null,

  init() {
    try { this.on = localStorage.getItem(MUSIC_KEY) !== "0"; } catch { /* yoksay */ }
  },

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem(MUSIC_KEY, this.on ? "1" : "0"); } catch { /* yoksay */ }
    if (!this.on) this.stop(0.3);
    return this.on;
  },

  start() {
    const c = Sound.ctx;
    if (!c || !this.on || this.playing) return;
    this.playing = true;
    this.gain = c.createGain();
    this.gain.gain.setValueAtTime(0, c.currentTime);
    this.gain.gain.linearRampToValueAtTime(0.32, c.currentTime + 1.5);
    this.gain.connect(Sound.master);
    this.step = 0;
    this.nextTime = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  },

  stop(fade = 0.8) {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const g = this.gain, t = Sound.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => g.disconnect(), fade * 1000 + 200);
    this.gain = null;
  },

  schedule() {
    const c = Sound.ctx;
    // Sekme arka plandaysa zamanlayıcı geride kalır: birikmiş notaları çalma
    if (this.nextTime < c.currentTime - 0.2) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.tempo / 4;
      this.step = (this.step + 1) % 64;
    }
  },

  playStep(step, t) {
    const chord = CHORDS[Math.floor(step / 16)];
    const s = step % 16;
    const sixteenth = 60 / this.tempo / 4;

    // Davul
    if (s % 4 === 0) this.kick(t);
    if (s === 4 || s === 12) this.snare(t);
    if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.12 : 0.05);

    // Bas
    if (BASS[s]) {
      const f = BASS[s] === 2 ? chord.bass * 2 : chord.bass;
      this.note(f, t, sixteenth * 1.8, "sawtooth", 0.22, 600);
    }

    // Arpej (8'lik notalar, bir oktav yukarıda)
    if (s % 2 === 0) {
      const f = chord.tones[ARP[s / 2]] * 2;
      this.note(f, t, sixteenth * 1.5, "square", 0.05, 3000);
    }

    // Her ölçü başında yumuşak akor
    if (s === 0) {
      for (const f of chord.tones) this.note(f, t, sixteenth * 14, "triangle", 0.05, 1500);
    }
  },

  // Filtreli tek nota
  note(freq, t, dur, type, vol, cutoff) {
    const c = Sound.ctx;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    f.type = "lowpass";
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  kick(t) {
    const c = Sound.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + 0.2);
  },

  noiseHit(t, dur, vol, filterType, freq) {
    const c = Sound.ctx;
    const src = c.createBufferSource();
    src.buffer = Sound.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.gain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  },

  snare(t) { this.noiseHit(t, 0.14, 0.35, "bandpass", 1800); },
  hat(t, vol) { this.noiseHit(t, 0.04, vol, "highpass", 7000); },
};
