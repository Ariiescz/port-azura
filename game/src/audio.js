let audioContext = null;
let masterGain = null;
let sirenOscillator = null;
let muted = false;

export function initAudio() {
  try {
    if (!audioContext) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      const candidate = new Audio();
      const output = candidate.createGain();
      output.gain.value = muted ? 0 : 0.12;
      output.connect(candidate.destination);
      audioContext = candidate;
      masterGain = output;
    }
    if (audioContext.state === 'suspended') {
      const pending = audioContext.resume();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    }
  } catch {
    audioContext = null;
    masterGain = null;
  }
}

function tone(frequency, duration = 0.12, delay = 0, volume = 0.08) {
  if (!audioContext || !masterGain || muted || audioContext.state !== 'running') return;
  try {
    const voice = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    const at = audioContext.currentTime + delay;
    voice.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(volume, at);
    envelope.gain.exponentialRampToValueAtTime(0.001, at + duration);
    voice.connect(envelope);
    envelope.connect(masterGain);
    voice.onended = () => {
      try {
        voice.disconnect();
        envelope.disconnect();
      } catch {
        /* output already released */
      }
    };
    voice.start(at);
    voice.stop(at + duration);
  } catch {
    /* A muted or unavailable audio device must never break the simulation. */
  }
}

export function playPickup() {
  tone(660, 0.1);
  tone(880, 0.12, 0.1);
}

export function playSiren(on) {
  if (!on) {
    const previous = sirenOscillator;
    sirenOscillator = null;
    if (previous) {
      try {
        previous.stop();
      } catch {
        /* already stopped */
      }
      try {
        previous.disconnect();
      } catch {
        /* already detached */
      }
    }
    return;
  }
  if (sirenOscillator || muted || !masterGain || audioContext?.state !== 'running') return;
  try {
    const voice = audioContext.createOscillator();
    const attenuation = audioContext.createGain();
    attenuation.gain.value = 0.025;
    voice.type = 'square';
    voice.frequency.value = 540;
    voice.connect(attenuation);
    attenuation.connect(masterGain);
    voice.onended = () => {
      try {
        attenuation.disconnect();
      } catch {
        /* device closed */
      }
    };
    voice.start();
    sirenOscillator = voice;
  } catch {
    sirenOscillator = null;
  }
}

export function toggleMute() {
  muted = !muted;
  try {
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.12;
  } catch {
    /* device closed */
  }
  return muted;
}

export function playEngine(speed = 0) {
  tone(90 + Math.abs(speed) * 5, 0.1, 0, 0.015);
}

export function playFootstep() {
  tone(180, 0.045);
}

export function playEnter() {
  tone(420, 0.075);
}
