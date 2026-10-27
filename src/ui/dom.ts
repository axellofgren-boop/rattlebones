/** Creates an element with a class and optional text: h('div', 'pill', 'Hello'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** A button that reacts on tap and plays the click sound via `onTap`. */
export function button(className: string, text: string, onTap: () => void): HTMLButtonElement {
  const el = h('button', className, text);
  el.addEventListener('click', onTap);
  return el;
}

/** Updates text only when it changed, avoiding needless layout work every frame. */
export class TextSlot {
  private value = '';
  constructor(readonly el: HTMLElement) {}

  set(text: string): void {
    if (text === this.value) return;
    this.value = text;
    this.el.textContent = text;
  }
}
