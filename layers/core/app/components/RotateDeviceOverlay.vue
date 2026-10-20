<template>
  <div class="rotate-device">
    <svg
      class="rotate-device__icon"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <rect
        x="20"
        y="8"
        width="24"
        height="40"
        rx="4"
      />
      <path d="M12 44a20 20 0 0 0 20 12m0 0-4-4m4 4-4 4" />
    </svg>
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

.rotate-device__icon {
  width: 96px;
  height: 96px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
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
