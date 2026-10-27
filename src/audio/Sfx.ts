/**
 * Tiny synthesized sound effects – no audio files to download.
 * iOS keeps audio locked until a tap, so `unlock()` must run inside a tap handler.
 */
export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Last play time per throttled sound, so 30 hits in one frame don't make 30 sounds. */
  private readonly lastPlayed = new Map<string, number>();

  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  throwBone(): void {
    if (this.throttle('throw', 90)) this.tone(520, 0.06, 'triangle', 0.08, 0, 300);
  }

  hit(): void {
    if (this.throttle('hit', 50)) this.tone(180 + Math.random() * 80, 0.06, 'square', 0.07, 0, 90);
  }

  kill(): void {
    if (this.throttle('kill', 60)) this.tone(300 + Math.random() * 200, 0.09, 'triangle', 0.1, 0, 900);
  }

  gem(): void {
    if (this.throttle('gem', 40)) this.tone(880 + Math.random() * 300, 0.05, 'sine', 0.08, 0, 1400);
  }

  boom(): void {
    if (this.throttle('boom', 120)) this.tone(110, 0.25, 'sawtooth', 0.12, 0, 40);
  }

  zap(): void {
    if (this.throttle('zap', 100)) this.tone(1400, 0.12, 'sawtooth', 0.05, 0, 300);
  }

  hurt(): void {
    if (this.throttle('hurt', 200)) this.tone(140, 0.2, 'square', 0.18, 0, 70);
  }

  heal(): void {
    [660, 880].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.15, i * 0.08));
  }

  levelUp(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.22, i * 0.07));
  }

  bossAlarm(): void {
    [196, 185, 196, 185].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.14, i * 0.25));
  }

  win(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.28, i * 0.12));
  }

  lose(): void {
    [392, 311, 233, 175].forEach((f, i) => this.tone(f, 0.34, 'sawtooth', 0.12, i * 0.2));
  }

  click(): void {
    this.tone(700, 0.04, 'triangle', 0.12);
  }

  private throttle(key: string, ms: number): boolean {
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? 0) < ms) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  private tone(freq: number, duration: number, type: OscillatorType, volume: number, delay = 0, slideTo?: number): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }
}
