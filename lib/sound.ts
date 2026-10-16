let context: AudioContext | null = null;
export function prepareSound() {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
  } catch {
    /* Sound is optional. */
  }
}
export function quack() {
  if (!context || context.state !== 'running') return;
  try {
    const t = context.currentTime;
    for (let i = 0; i < 2; i++) {
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        filter = context.createBiquadFilter();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(420, t + i * 0.19);
      oscillator.frequency.exponentialRampToValueAtTime(
        160,
        t + i * 0.19 + 0.16,
      );
      filter.type = 'bandpass';
      filter.frequency.value = 850;
      filter.Q.value = 1.2;
      gain.gain.setValueAtTime(0, t + i * 0.19);
      gain.gain.linearRampToValueAtTime(0.16, t + i * 0.19 + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.19 + 0.18);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      oscillator.start(t + i * 0.19);
      oscillator.stop(t + i * 0.19 + 0.19);
      oscillator.onended = () => {
        oscillator.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    }
  } catch {
    /* A blocked audio context must never block a race. */
  }
}

let lastPinballSound = -1;
export function pinballHit(returned = false) {
  if (
    !context ||
    context.state !== 'running' ||
    context.currentTime - lastPinballSound < 0.075
  )
    return;
  try {
    const t = context.currentTime;
    lastPinballSound = t;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(returned ? 720 : 520, t);
    oscillator.frequency.exponentialRampToValueAtTime(
      returned ? 1200 : 190,
      t + 0.09,
    );
    gain.gain.setValueAtTime(0.045, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(t);
    oscillator.stop(t + 0.13);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  } catch {
    /* Optional sound must never interrupt a round. */
  }
}
