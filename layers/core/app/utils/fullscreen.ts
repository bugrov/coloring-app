/** What decides whether the page should take the whole screen. */
export interface FullscreenSituation {
  /** A touch screen is the main pointer: a phone or a tablet, not a desktop window. */
  coarsePointer: boolean
  /** The browser lets pages go fullscreen (iPhone Safari does not). */
  supported: boolean
  /** The page already has the whole screen. */
  fullscreen: boolean
  /** The game runs from the home screen, without the browser bars. */
  installed: boolean
}

/**
 * On a phone held sideways the address bar and the system bars leave a game about 280px of height,
 * and a page that cannot scroll cannot hide them. The first touch (the browser demands a gesture)
 * therefore asks for the whole screen.
 */
export function shouldGoFullscreen(situation: FullscreenSituation): boolean {
  return situation.coarsePointer && situation.supported && !situation.fullscreen && !situation.installed
}
