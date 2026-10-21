/**
 * Where the progress frame starts, in degrees: 180 is the middle of the left edge and the frame
 * fills counter-clockwise (left, bottom, right, top). The tech lead confirmed it. The path below
 * is written for this start; moving it means changing `progressFramePath`.
 */
export const PROGRESS_FRAME_START_ANGLE = 180

/**
 * Closed outline of a rounded rectangle, the middle of the stroke band `inset` px inside the box,
 * starting at the middle of the left edge and running counter-clockwise on the screen. Drawn with
 * `pathLength="1"`, a dash of the share filled shows the progress.
 */
export function progressFramePath(width: number, height: number, inset: number, radius: number): string {
  const left = inset
  const top = inset
  const right = width - inset
  const bottom = height - inset
  const r = Math.max(0, Math.min(radius, (right - left) / 2, (bottom - top) / 2))
  const middle = height / 2

  // Sweep flag 0 = counter-clockwise in SVG's y-down coordinates: left -> bottom -> right -> top.
  return [
    `M${left} ${middle}`,
    `V${bottom - r}`,
    `A${r} ${r} 0 0 0 ${left + r} ${bottom}`,
    `H${right - r}`,
    `A${r} ${r} 0 0 0 ${right} ${bottom - r}`,
    `V${top + r}`,
    `A${r} ${r} 0 0 0 ${right - r} ${top}`,
    `H${left + r}`,
    `A${r} ${r} 0 0 0 ${left} ${top + r}`,
    `V${middle}`,
  ].join('')
}

/** `stroke-dashoffset` for a path of `pathLength="1"` and `stroke-dasharray="1"`: draws the first `percent` %. */
export function progressDashOffset(percent: number): number {
  const share = Math.min(Math.max(percent, 0), 100) / 100
  return 1 - share
}
