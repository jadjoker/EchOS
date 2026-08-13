/**
 * The machine's noises.
 *
 * Synthesised, never sampled. A wav file would be one fixed sound for every
 * fish on every machine, and this game does not have fixed anything: a fish
 * with its own hue and its own name should have its own voice too. It also
 * keeps the install honest, since a folder of squeaks would outweigh the code.
 *
 * The context is created on the first click and not before. Browsers refuse to
 * start audio without a gesture, and a game that is silent until you touch it
 * is the correct behaviour anyway.
 */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    // No audio device, or the browser will not allow one. Everything else
    // carries on: nothing in this game may depend on a sound being heard.
    return null;
  }
  return ctx;
}

/**
 * A short honk, pitched by whatever number you give it.
 *
 * Pass something stable about the thing making the noise and it will sound the
 * same every time. A fish's hue works: it is already unique to that fish and
 * already reproducible from the seed, so the fish you shared with a friend
 * squeaks at them in the same key.
 */
export function honk(pitchSource: number, options: { dull?: boolean } = {}): void {
  const audio = context();
  if (!audio) return;
  // Autoplay policy can leave a context suspended until a gesture. This runs
  // from a click, so resuming here is allowed.
  void audio.resume().catch(() => {});

  const now = audio.currentTime;
  const dull = options.dull === true;

  // Twelve semitones of a pentatonic-ish spread, so a tank full of fish is a
  // chord rather than a car alarm.
  const steps = [0, 2, 4, 7, 9, 12, 14, 16];
  const step = steps[Math.abs(Math.round(pitchSource)) % steps.length] ?? 0;
  const base = (dull ? 90 : 300) * Math.pow(2, step / 12);

  const osc = audio.createOscillator();
  osc.type = dull ? "sine" : "square";
  osc.frequency.setValueAtTime(base, now);
  // The bend is what makes it read as a squeeze toy rather than a beep.
  osc.frequency.exponentialRampToValueAtTime(base * (dull ? 0.7 : 0.55), now + (dull ? 0.22 : 0.13));

  const gain = audio.createGain();
  // Quiet. This fires on every click and has to stay funny on the hundredth.
  const peak = dull ? 0.05 : 0.09;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (dull ? 0.3 : 0.18));

  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + (dull ? 0.34 : 0.22));
}
