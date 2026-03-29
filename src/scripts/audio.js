// ============================================================
// Audio — procedural synthesis via Web Audio API
// No game-state dependencies; all functions are pure.
// ============================================================

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// ── Helpers ──────────────────────────────────────────────────

function makeNoise(durationSeconds) {
  const size = Math.ceil(audioContext.sampleRate * durationSeconds);
  const buffer = audioContext.createBuffer(1, size, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeWaveshaper(amount) {
  const curve = new Float32Array(256);
  const k = amount * 100;
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = ((1 + k / 10) * x) / (1 + k * Math.abs(x));
  }
  const ws = audioContext.createWaveShaper();
  ws.curve = curve;
  return ws;
}

function makeMasterCompressor() {
  const comp = audioContext.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.knee.value = 8;
  comp.ratio.value = 4;
  comp.attack.value = 0.002;
  comp.release.value = 0.05;
  return comp;
}

// ── Sound functions ───────────────────────────────────────────

export function playShootSound() {
  if (audioContext.state === "suspended") audioContext.resume();

  const t = audioContext.currentTime;
  const comp = makeMasterCompressor();
  const master = audioContext.createGain();
  master.gain.value = 0.9;
  comp.connect(master);
  master.connect(audioContext.destination);

  // Layer 1 — Transient click (0–6 ms)
  const click = audioContext.createBufferSource();
  click.buffer = makeNoise(0.006);
  const clickHp = audioContext.createBiquadFilter();
  clickHp.type = "highpass";
  clickHp.frequency.value = 4000;
  clickHp.Q.value = 0.5;
  const clickGain = audioContext.createGain();
  clickGain.gain.setValueAtTime(1.8, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.006);
  click.connect(clickHp);
  clickHp.connect(clickGain);
  clickGain.connect(comp);
  click.start(t);
  click.stop(t + 0.007);

  // Layer 2 — Gas crack / main body (0–70 ms)
  const crack = audioContext.createBufferSource();
  crack.buffer = makeNoise(0.07);
  const crackLp = audioContext.createBiquadFilter();
  crackLp.type = "lowpass";
  crackLp.frequency.value = 2200;
  crackLp.Q.value = 1.2;
  const crackHp = audioContext.createBiquadFilter();
  crackHp.type = "highpass";
  crackHp.frequency.value = 200;
  const crackGain = audioContext.createGain();
  crackGain.gain.setValueAtTime(0.001, t);
  crackGain.gain.linearRampToValueAtTime(2.5, t + 0.003);
  crackGain.gain.exponentialRampToValueAtTime(0.4, t + 0.025);
  crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  crack.connect(crackLp);
  crackLp.connect(crackHp);
  crackHp.connect(crackGain);
  crackGain.connect(comp);
  crack.start(t);
  crack.stop(t + 0.071);

  // Layer 3 — Low-frequency body thump (0–120 ms)
  const osc = audioContext.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const thumpLp = audioContext.createBiquadFilter();
  thumpLp.type = "lowpass";
  thumpLp.frequency.value = 120;
  thumpLp.Q.value = 0.7;
  const thumpGain = audioContext.createGain();
  thumpGain.gain.setValueAtTime(0.001, t);
  thumpGain.gain.linearRampToValueAtTime(1.2, t + 0.005);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(thumpLp);
  thumpLp.connect(thumpGain);
  thumpGain.connect(comp);
  osc.start(t);
  osc.stop(t + 0.121);
}

export function playHitSound() {
  const t = audioContext.currentTime;

  // Path A — Surface impact thud (immediate, 0–80 ms)
  const impactNoise = audioContext.createBufferSource();
  impactNoise.buffer = makeNoise(0.08);
  const ws = makeWaveshaper(0.4);
  const impactLp = audioContext.createBiquadFilter();
  impactLp.type = "lowpass";
  impactLp.frequency.value = 800;
  impactLp.Q.value = 1.8;
  const impactHp = audioContext.createBiquadFilter();
  impactHp.type = "highpass";
  impactHp.frequency.value = 80;
  const impactGain = audioContext.createGain();
  impactGain.gain.setValueAtTime(0.001, t);
  impactGain.gain.linearRampToValueAtTime(1.2, t + 0.002);
  impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  impactNoise.connect(ws);
  ws.connect(impactLp);
  impactLp.connect(impactHp);
  impactHp.connect(impactGain);
  impactGain.connect(audioContext.destination);
  impactNoise.start(t);
  impactNoise.stop(t + 0.081);

  // Path B — Organic body resonance (15 ms delay, 200 ms)
  const bodySize = Math.ceil(audioContext.sampleRate * 0.2);
  const bodyBuffer = audioContext.createBuffer(1, bodySize, audioContext.sampleRate);
  const bodyData = bodyBuffer.getChannelData(0);
  for (let i = 0; i < bodySize; i++) {
    bodyData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioContext.sampleRate * 0.06));
  }
  const bodyNoise = audioContext.createBufferSource();
  bodyNoise.buffer = bodyBuffer;
  const bodyBp = audioContext.createBiquadFilter();
  bodyBp.type = "bandpass";
  bodyBp.frequency.value = 320;
  bodyBp.Q.value = 3.5;
  const bodyPeak = audioContext.createBiquadFilter();
  bodyPeak.type = "peaking";
  bodyPeak.frequency.value = 180;
  bodyPeak.gain.value = 8;
  const bodyGain = audioContext.createGain();
  bodyGain.gain.value = 0.55;
  bodyNoise.connect(bodyBp);
  bodyBp.connect(bodyPeak);
  bodyPeak.connect(bodyGain);
  bodyGain.connect(audioContext.destination);
  bodyNoise.start(t + 0.015);
  bodyNoise.stop(t + 0.215);
}

export function playPainSound() {
  const t = audioContext.currentTime;

  // Path A — Breath noise / inhale (0–80 ms)
  const breath = audioContext.createBufferSource();
  breath.buffer = makeNoise(0.08);
  const breathBp = audioContext.createBiquadFilter();
  breathBp.type = "bandpass";
  breathBp.frequency.value = 2800;
  breathBp.Q.value = 4.0;
  const breathGain = audioContext.createGain();
  breathGain.gain.setValueAtTime(0.0001, t);
  breathGain.gain.linearRampToValueAtTime(0.35, t + 0.01);
  breathGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  breath.connect(breathBp);
  breathBp.connect(breathGain);
  breathGain.connect(audioContext.destination);
  breath.start(t);
  breath.stop(t + 0.081);

  // Path B — Voiced grunt with two formants (20 ms delay, 280 ms)
  const osc = audioContext.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(210, t + 0.02);
  osc.frequency.linearRampToValueAtTime(240, t + 0.06);
  osc.frequency.exponentialRampToValueAtTime(130, t + 0.3);

  const ws = makeWaveshaper(0.3);

  // F1 — first formant ~900 Hz
  const f1 = audioContext.createBiquadFilter();
  f1.type = "bandpass";
  f1.frequency.value = 900;
  f1.Q.value = 5;

  // F2 — second formant ~2200 Hz
  const f2 = audioContext.createBiquadFilter();
  f2.type = "bandpass";
  f2.frequency.value = 2200;
  f2.Q.value = 3;

  const f1Gain = audioContext.createGain();
  f1Gain.gain.value = 0.6;
  const f2Gain = audioContext.createGain();
  f2Gain.gain.value = 0.35;

  const gruntGain = audioContext.createGain();
  gruntGain.gain.setValueAtTime(0.0001, t + 0.02);
  gruntGain.gain.linearRampToValueAtTime(0.5, t + 0.04);
  gruntGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

  osc.connect(ws);
  ws.connect(f1);
  ws.connect(f2);
  f1.connect(f1Gain);
  f2.connect(f2Gain);
  f1Gain.connect(gruntGain);
  f2Gain.connect(gruntGain);
  gruntGain.connect(audioContext.destination);
  osc.start(t + 0.02);
  osc.stop(t + 0.301);
}

export function playEmptyClickSound() {
  const t = audioContext.currentTime;

  // Click 1 — Main trigger drop (immediate, 20 ms)
  const osc1 = audioContext.createOscillator();
  osc1.type = "square";
  osc1.frequency.setValueAtTime(1800, t);
  osc1.frequency.exponentialRampToValueAtTime(600, t + 0.02);
  const hp1 = audioContext.createBiquadFilter();
  hp1.type = "highpass";
  hp1.frequency.value = 900;
  hp1.Q.value = 1;
  const g1 = audioContext.createGain();
  g1.gain.setValueAtTime(0.22, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  osc1.connect(hp1);
  hp1.connect(g1);
  g1.connect(audioContext.destination);
  osc1.start(t);
  osc1.stop(t + 0.021);

  // Click 1 texture — broadband metallic tick
  const tick1 = audioContext.createBufferSource();
  tick1.buffer = makeNoise(0.015);
  const tickHp = audioContext.createBiquadFilter();
  tickHp.type = "highpass";
  tickHp.frequency.value = 3000;
  const tickGain = audioContext.createGain();
  tickGain.gain.setValueAtTime(0.08, t);
  tickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
  tick1.connect(tickHp);
  tickHp.connect(tickGain);
  tickGain.connect(audioContext.destination);
  tick1.start(t);
  tick1.stop(t + 0.016);

  // Click 2 — Striker reset (80 ms delay, quieter, lower pitch)
  const t2 = t + 0.08;
  const osc2 = audioContext.createOscillator();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(1100, t2);
  osc2.frequency.exponentialRampToValueAtTime(400, t2 + 0.018);
  const hp2 = audioContext.createBiquadFilter();
  hp2.type = "highpass";
  hp2.frequency.value = 700;
  const g2 = audioContext.createGain();
  g2.gain.setValueAtTime(0.1, t2);
  g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.018);
  osc2.connect(hp2);
  hp2.connect(g2);
  g2.connect(audioContext.destination);
  osc2.start(t2);
  osc2.stop(t2 + 0.019);

  const tick2 = audioContext.createBufferSource();
  tick2.buffer = makeNoise(0.012);
  const tick2Hp = audioContext.createBiquadFilter();
  tick2Hp.type = "highpass";
  tick2Hp.frequency.value = 3000;
  const tick2Gain = audioContext.createGain();
  tick2Gain.gain.setValueAtTime(0.035, t2);
  tick2Gain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.012);
  tick2.connect(tick2Hp);
  tick2Hp.connect(tick2Gain);
  tick2Gain.connect(audioContext.destination);
  tick2.start(t2);
  tick2.stop(t2 + 0.013);
}

export function playSMGSpawnSound() {
  const t = audioContext.currentTime;

  // Three harmonically related oscillators (root, fifth, octave)
  const freqs = [220, 330, 440];
  const types = ["sine", "sine", "triangle"];
  const gains = [0.15, 0.1, 0.07];
  const merge = audioContext.createGain();
  merge.gain.setValueAtTime(0.0001, t);
  merge.gain.linearRampToValueAtTime(0.4, t + 0.05);
  merge.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

  const bp = audioContext.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1100;
  bp.Q.value = 0.4;
  merge.connect(bp);
  bp.connect(audioContext.destination);

  freqs.forEach((freq, i) => {
    const osc = audioContext.createOscillator();
    osc.type = types[i];
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 4, t + 0.35);
    const g = audioContext.createGain();
    g.gain.value = gains[i];
    osc.connect(g);
    g.connect(merge);
    osc.start(t);
    osc.stop(t + 0.401);
  });

  // Metallic shimmer on pickup
  const shimmer = audioContext.createBufferSource();
  shimmer.buffer = makeNoise(0.06);
  const shimmerHp = audioContext.createBiquadFilter();
  shimmerHp.type = "highpass";
  shimmerHp.frequency.value = 5000;
  const shimmerGain = audioContext.createGain();
  shimmerGain.gain.setValueAtTime(0.0001, t);
  shimmerGain.gain.linearRampToValueAtTime(0.25, t + 0.01);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  shimmer.connect(shimmerHp);
  shimmerHp.connect(shimmerGain);
  shimmerGain.connect(audioContext.destination);
  shimmer.start(t);
  shimmer.stop(t + 0.061);
}

export function playReloadSound() {
  const t = audioContext.currentTime;

  // Event 1 — Magazine release latch (t + 0, 25 ms)
  const latch = audioContext.createBufferSource();
  latch.buffer = makeNoise(0.025);
  const latchBp = audioContext.createBiquadFilter();
  latchBp.type = "bandpass";
  latchBp.frequency.value = 2500;
  latchBp.Q.value = 4;
  const latchGain = audioContext.createGain();
  latchGain.gain.setValueAtTime(0.3, t);
  latchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
  latch.connect(latchBp);
  latchBp.connect(latchGain);
  latchGain.connect(audioContext.destination);
  latch.start(t);
  latch.stop(t + 0.026);

  // Event 2 — Magazine sliding out (t + 80 ms, 120 ms)
  const slideSize = Math.ceil(audioContext.sampleRate * 0.12);
  const slideBuffer = audioContext.createBuffer(1, slideSize, audioContext.sampleRate);
  const slideData = slideBuffer.getChannelData(0);
  for (let i = 0; i < slideSize; i++) {
    slideData[i] = (Math.random() * 2 - 1) * (1 - i / slideSize);
  }
  const slide = audioContext.createBufferSource();
  slide.buffer = slideBuffer;
  const slideLp = audioContext.createBiquadFilter();
  slideLp.type = "lowpass";
  slideLp.frequency.value = 1200;
  slideLp.Q.value = 0.8;
  const slideGain = audioContext.createGain();
  slideGain.gain.value = 0.25;
  slide.connect(slideLp);
  slideLp.connect(slideGain);
  slideGain.connect(audioContext.destination);
  slide.start(t + 0.08);
  slide.stop(t + 0.201);

  // Event 3 — New magazine seating (t + 280 ms, 30 ms)
  const t3 = t + 0.28;
  const seatOsc = audioContext.createOscillator();
  seatOsc.type = "sawtooth";
  seatOsc.frequency.setValueAtTime(600, t3);
  seatOsc.frequency.exponentialRampToValueAtTime(300, t3 + 0.03);
  const seatGain = audioContext.createGain();
  seatGain.gain.setValueAtTime(0.2, t3);
  seatGain.gain.exponentialRampToValueAtTime(0.001, t3 + 0.03);
  seatOsc.connect(seatGain);
  seatGain.connect(audioContext.destination);
  seatOsc.start(t3);
  seatOsc.stop(t3 + 0.031);

  const seatNoise = audioContext.createBufferSource();
  seatNoise.buffer = makeNoise(0.02);
  const seatHp = audioContext.createBiquadFilter();
  seatHp.type = "highpass";
  seatHp.frequency.value = 1800;
  const seatNoiseGain = audioContext.createGain();
  seatNoiseGain.gain.setValueAtTime(0.18, t3);
  seatNoiseGain.gain.exponentialRampToValueAtTime(0.001, t3 + 0.02);
  seatNoise.connect(seatHp);
  seatHp.connect(seatNoiseGain);
  seatNoiseGain.connect(audioContext.destination);
  seatNoise.start(t3);
  seatNoise.stop(t3 + 0.021);
}

export function playReloadCompleteSound() {
  const t = audioContext.currentTime;
  const comp = audioContext.createDynamicsCompressor();
  comp.threshold.value = -3;
  comp.knee.value = 4;
  comp.ratio.value = 6;
  comp.attack.value = 0.0003;
  comp.release.value = 0.08;
  comp.connect(audioContext.destination);

  // Layer 1 — High-frequency impact transient (0–35 ms)
  const impact = audioContext.createBufferSource();
  impact.buffer = makeNoise(0.035);
  const impactHp = audioContext.createBiquadFilter();
  impactHp.type = "highpass";
  impactHp.frequency.value = 1500;
  impactHp.Q.value = 0.7;
  const impactBp = audioContext.createBiquadFilter();
  impactBp.type = "bandpass";
  impactBp.frequency.value = 3000;
  impactBp.Q.value = 2;
  const impactGain = audioContext.createGain();
  impactGain.gain.setValueAtTime(0.001, t);
  impactGain.gain.linearRampToValueAtTime(0.85, t + 0.002);
  impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  impact.connect(impactHp);
  impactHp.connect(impactBp);
  impactBp.connect(impactGain);
  impactGain.connect(comp);
  impact.start(t);
  impact.stop(t + 0.036);

  // Layer 2 — Metal ring-down resonance (0–90 ms)
  const ring = audioContext.createOscillator();
  ring.type = "triangle";
  ring.frequency.setValueAtTime(520, t);
  ring.frequency.exponentialRampToValueAtTime(280, t + 0.09);
  const ringBp = audioContext.createBiquadFilter();
  ringBp.type = "bandpass";
  ringBp.frequency.value = 480;
  ringBp.Q.value = 8;
  const ringGain = audioContext.createGain();
  ringGain.gain.setValueAtTime(0.0001, t);
  ringGain.gain.linearRampToValueAtTime(0.4, t + 0.002);
  ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  ring.connect(ringBp);
  ringBp.connect(ringGain);
  ringGain.connect(comp);
  ring.start(t);
  ring.stop(t + 0.091);
}
