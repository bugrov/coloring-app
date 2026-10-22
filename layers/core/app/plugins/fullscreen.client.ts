// A phone's browser bars take a third of a landscape screen: the first touch asks for fullscreen (once per page load,
// so that someone who leaves it is not pulled back in by every tap).
export default defineNuxtPlugin(() => {
  document.addEventListener('pointerup', () => {
    const situation = {
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      supported: document.fullscreenEnabled,
      fullscreen: document.fullscreenElement !== null,
      installed: matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches,
    }

    if (shouldGoFullscreen(situation)) void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined)
  }, { once: true })
})
