// Browser gestures that CSS alone cannot switch off.
export default defineNuxtPlugin(() => {
  const isEditable = (target: EventTarget | null) =>
    target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]') !== null

  // Long-press and right-click menus break the game feel; text fields keep
  // theirs so paste still works.
  document.addEventListener('contextmenu', (event) => {
    if (!isEditable(event.target)) event.preventDefault()
  })

  // iOS Safari ignores viewport scaling limits and pinch-zooms the page via
  // its proprietary gesture events.
  const preventDefault = (event: Event) => event.preventDefault()

  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, preventDefault, { passive: false })
  }
})
