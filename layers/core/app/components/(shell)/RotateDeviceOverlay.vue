<template>
  <div class="rotate-device">
    <IconRotateDevice />
    <p class="rotate-device__text">
      Поверните устройство
    </p>
  </div>
</template>

<style scoped lang="scss">
// The game is designed for landscape. Touch devices held in portrait get a
// prompt instead of a cramped layout; desktop windows are never blocked.
.rotate-device {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
  background: var(--color-overlay);
  color: var(--color-on-overlay);
}

.rotate-device__text {
  margin: 0;
  font-size: var(--font-size-l);
}

@media (orientation: portrait) and (pointer: coarse) {
  .rotate-device {
    display: flex;
  }
}
</style>
