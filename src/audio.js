// ============================================================
// Audio — procedural synthesis via Web Audio API
// No game-state dependencies; all functions are pure.
// ============================================================

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

export function playShootSound() {
  const bufferSize = audioContext.sampleRate * 0.08;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;
  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 1.5;
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(3.0, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  noise.start(audioContext.currentTime);
  noise.stop(audioContext.currentTime + 0.08);
}

export function playHitSound() {
  const impactBufferSize = audioContext.sampleRate * 0.05;
  const impactBuffer = audioContext.createBuffer(1, impactBufferSize, audioContext.sampleRate);
  const impactData = impactBuffer.getChannelData(0);
  for (let i = 0; i < impactBufferSize; i++) {
    const envelope = Math.exp(-i / (impactBufferSize * 0.15));
    impactData[i] = (Math.random() * 2 - 1) * envelope;
  }
  const impact = audioContext.createBufferSource();
  impact.buffer = impactBuffer;
  const impactFilter = audioContext.createBiquadFilter();
  impactFilter.type = "bandpass";
  impactFilter.frequency.value = 600;
  impactFilter.Q.value = 2;
  const impactGain = audioContext.createGain();
  impactGain.gain.setValueAtTime(0.7, audioContext.currentTime);
  impactGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
  impact.connect(impactFilter);
  impactFilter.connect(impactGain);
  impactGain.connect(audioContext.destination);
  impact.start(audioContext.currentTime);

  // Delayed grunt
  setTimeout(() => {
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    osc.frequency.setValueAtTime(170, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.18);
    osc.type = "sawtooth";
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 2.5;
    gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.18);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.18);
  }, 30);
}

export function playPainSound() {
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  osc.frequency.setValueAtTime(220, audioContext.currentTime);
  osc.frequency.linearRampToValueAtTime(250, audioContext.currentTime + 0.08);
  osc.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.25);
  osc.type = "triangle";
  filter.type = "lowpass";
  filter.frequency.value = 1000;
  filter.Q.value = 1.5;
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.6, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.25);
}

export function playEmptyClickSound() {
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  osc.frequency.setValueAtTime(1200, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.05);
  osc.type = "square";
  filter.type = "highpass";
  filter.frequency.value = 600;
  filter.Q.value = 2;
  gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.05);
}

export function playSMGSpawnSound() {
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  osc.frequency.setValueAtTime(200, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
  osc.type = "sine";
  filter.type = "bandpass";
  filter.frequency.value = 500;
  filter.Q.value = 1.5;
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.3);
}

// Mechanical click-clack reload start
export function playReloadSound() {
  for (let i = 0; i < 2; i++) {
    setTimeout(() => {
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioContext.destination);
      osc.frequency.setValueAtTime(800 - i * 200, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400 - i * 100, audioContext.currentTime + 0.06);
      osc.type = "square";
      gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.06);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.06);
    }, i * 120);
  }
}

// Satisfying "clack" when reload completes
export function playReloadCompleteSound() {
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  osc.frequency.setValueAtTime(600, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.04);
  osc.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
  osc.type = "sawtooth";
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 3;
  gainNode.gain.setValueAtTime(0.35, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.12);
}
