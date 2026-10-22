/**
 * Places evenly spaced stamps along a polyline. The leftover distance is
 * carried between calls, so feeding a stroke in chunks (live drawing) gives
 * the same stamps as feeding it at once (replay).
 */
export class StampWalker {
  private lastX = 0
  private lastY = 0
  private carry = 0
  private started = false

  constructor(private readonly spacing: number) {}

  /** Returns stamp centres for the new points, as a flat x, y list. */
  walk(points: readonly number[]): number[] {
    const stamps: number[] = []

    for (let i = 0; i + 1 < points.length; i += 2) {
      const x = points[i]!
      const y = points[i + 1]!

      if (!this.started) {
        this.started = true
        this.lastX = x
        this.lastY = y
        stamps.push(x, y)
        continue
      }

      const dx = x - this.lastX
      const dy = y - this.lastY
      const length = Math.hypot(dx, dy)
      let distance = this.spacing - this.carry

      while (distance <= length) {
        const t = distance / length

        stamps.push(this.lastX + dx * t, this.lastY + dy * t)
        distance += this.spacing
      }
      this.carry = length - (distance - this.spacing)
      this.lastX = x
      this.lastY = y
    }

    return stamps
  }
}
