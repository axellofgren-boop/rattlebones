/**
 * Buckets items into square cells so "who is near this point?" only checks a few
 * cells instead of every enemy. Rebuilt from scratch each frame; allocation-free.
 */
export class SpatialGrid {
  private readonly cols: number;
  private readonly head: Int32Array;
  private readonly next: Int32Array;

  /**
   * @param halfSize grid covers -halfSize..halfSize on both axes
   * @param cellSize side of one cell; about the size of the biggest query radius works well
   * @param capacity highest item id + 1
   */
  constructor(
    private readonly halfSize: number,
    private readonly cellSize: number,
    capacity: number,
  ) {
    this.cols = Math.ceil((halfSize * 2) / cellSize);
    this.head = new Int32Array(this.cols * this.cols).fill(-1);
    this.next = new Int32Array(capacity);
  }

  clear(): void {
    this.head.fill(-1);
  }

  insert(id: number, x: number, z: number): void {
    const cell = this.cellIndex(this.col(x), this.col(z));
    this.next[id] = this.head[cell];
    this.head[cell] = id;
  }

  /**
   * Writes the ids of items in cells touching the circle into `out` and returns how many.
   * Callers still check the exact distance; this only narrows the search.
   */
  query(x: number, z: number, radius: number, out: Int32Array): number {
    const c0 = this.col(x - radius);
    const c1 = this.col(x + radius);
    const r0 = this.col(z - radius);
    const r1 = this.col(z + radius);
    let n = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        for (let id = this.head[this.cellIndex(c, r)]; id !== -1; id = this.next[id]) {
          if (n >= out.length) return n;
          out[n++] = id;
        }
      }
    }
    return n;
  }

  private col(v: number): number {
    const c = Math.floor((v + this.halfSize) / this.cellSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private cellIndex(col: number, row: number): number {
    return row * this.cols + col;
  }
}
