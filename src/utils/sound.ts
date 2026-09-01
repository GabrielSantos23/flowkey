export function playTimerOverSound() {
  try {
    const audio = new Audio("/sounds/TimerOver.wav");
    audio.play().catch(() => {
      // Synthesize high quality alarm chime using Web Audio API
      playChime();
    });
  } catch {
    playChime();
  }
}

export function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const now = ctx.currentTime;
    const frequencies = [587.33, 880, 1174.66, 1760]; // D5, A5, D6, A6

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.85);
    });
  } catch (e) {
    console.warn("Could not play synthesized audio:", e);
  }
}
