/**
 * Tells a long press apart from a stroke: the press must stay within the
 * tolerance until the timer fires. Timing is driven by the caller so the
 * logic stays testable.
 */
export class HoldDetector {
  private originX = 0
  private originY = 0
  private active = false

  constructor(private readonly tolerance: number) {}

  start(x: number, y: number) {
    this.originX = x
    this.originY = y
    this.active = true
  }

  /** Returns false once the pointer has moved too far: it is a stroke, not a hold. */
  move(x: number, y: number): boolean {
    if (this.active && Math.hypot(x - this.originX, y - this.originY) > this.tolerance) {
      this.active = false
    }

    return this.active
  }

  cancel() {
    this.active = false
  }

  /** Whether the hold is still possible; consumed by the caller when the timer fires. */
  get pending(): boolean {
    return this.active
  }
}
