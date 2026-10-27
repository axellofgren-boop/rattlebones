/** How far (px) the thumb travels from where it landed before reaching full speed. */
const STICK_RADIUS = 56;

/**
 * Floating thumb-stick: put a finger down anywhere and drag to walk.
 * WASD / arrow keys also work so the game can be tested on a PC.
 */
export class Input {
  /** Desired movement, length 0..1. x = screen right, y = screen down. */
  readonly move = { x: 0, y: 0 };

  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private stickX = 0;
  private stickY = 0;
  /** Jump button is down. Holding it on the ground slides. */
  jumpHeld = false;
  /** True for the one frame the jump button went down. */
  jumpPressed = false;

  private readonly keys = new Set<string>();
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly jumpButton: HTMLButtonElement;
  private jumpTouch = false;
  private jumpQueued = false;

  constructor(
    private readonly target: HTMLElement,
    uiRoot: HTMLElement,
  ) {
    this.base = document.createElement('div');
    this.base.className = 'stick';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    this.base.appendChild(this.knob);
    uiRoot.appendChild(this.base);

    // Jump / slide button: its own touch, so you can steer and jump at the same time.
    this.jumpButton = document.createElement('button');
    this.jumpButton.className = 'jump-btn';
    this.jumpButton.textContent = 'JUMP';
    this.jumpButton.setAttribute('aria-label', 'Jump, hold to slide');
    this.jumpButton.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.jumpButton.setPointerCapture(e.pointerId);
      this.jumpTouch = true;
      this.jumpQueued = true;
    });
    const letGo = () => (this.jumpTouch = false);
    this.jumpButton.addEventListener('pointerup', letGo);
    this.jumpButton.addEventListener('pointercancel', letGo);
    this.jumpButton.addEventListener('lostpointercapture', letGo);
    uiRoot.appendChild(this.jumpButton);

    target.addEventListener('pointerdown', this.onDown);
    target.addEventListener('pointermove', this.onMove);
    target.addEventListener('pointerup', this.onUp);
    target.addEventListener('pointercancel', this.onUp);
    target.addEventListener('lostpointercapture', this.onUp);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) this.jumpQueued = true;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Recomputes `move`. Call once per frame. */
  update(): void {
    let x = 0;
    let y = 0;
    if (this.pointerId !== null) {
      x = this.stickX / STICK_RADIUS;
      y = this.stickY / STICK_RADIUS;
    } else {
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.move.x = x;
    this.move.y = y;

    this.jumpPressed = this.jumpQueued;
    this.jumpQueued = false;
    this.jumpHeld = this.jumpTouch || this.keys.has('Space');
  }

  /** Shows the jump button only while a run is being played. */
  setJumpVisible(visible: boolean): void {
    this.jumpButton.style.display = visible ? '' : 'none';
  }

  /** Lets go of the stick, e.g. when a menu opens mid-drag. */
  release(): void {
    this.jumpTouch = false;
    this.jumpQueued = false;
    this.pointerId = null;
    this.stickX = 0;
    this.stickY = 0;
    this.base.classList.remove('visible');
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.stickX = 0;
    this.stickY = 0;
    this.target.setPointerCapture(e.pointerId);
    this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.add('visible');
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    let dx = e.clientX - this.originX;
    let dy = e.clientY - this.originY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      // Drag the base along so reversing direction responds instantly.
      const excess = len - STICK_RADIUS;
      this.originX += (dx / len) * excess;
      this.originY += (dy / len) * excess;
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
      this.base.style.transform = `translate(${this.originX}px, ${this.originY}px)`;
    }
    this.stickX = dx;
    this.stickY = dy;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) this.release();
  };
}
