<script setup lang="ts">
import '@fontsource/rubik-bubbles/latin-400.css'

defineProps<{
  /** The picture is finished: the card pops up and wobbles. */
  open: boolean
}>()
</script>

<template>
  <div
    class="congrats"
    role="status"
  >
    <Transition name="congrats">
      <div
        v-if="open"
        class="congrats__card"
      >
        <p class="congrats__title">
          Поздравляем!
        </p>
        <p class="congrats__text">
          Рисунок готов
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
// Over everything but never in the way: the player can keep drawing or tap the buttons below.
.congrats {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.congrats__card {
  padding: var(--space-4) var(--space-6);
  border: var(--border-card) solid var(--color-progress);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 8px 32px rgb(35 38 47 / 25%);
  text-align: center;

  // The wobble starts once the pop-in is over.
  animation: congrats-wobble 1.2s ease-in-out 300ms 3;
}

.congrats__title,
.congrats__text {
  margin: 0;
  font-family: "Rubik Bubbles", var(--font-family);
}

.congrats__title {
  color: var(--color-progress);
  font-size: 40px;
  line-height: 1.1;
}

.congrats__text {
  font-size: 28px;
  line-height: 1.2;
}

.congrats-enter-active {
  transition:
    transform 300ms var(--ease-out),
    opacity 300ms var(--ease-out);
}

.congrats-leave-active {
  transition: opacity var(--duration-base);
}

.congrats-enter-from {
  transform: scale(0.5);
  opacity: 0;
}

.congrats-leave-to {
  opacity: 0;
}

@keyframes congrats-wobble {
  0%,
  100% {
    transform: rotate(0);
  }

  25% {
    transform: rotate(-3deg) scale(1.03);
  }

  75% {
    transform: rotate(3deg) scale(1.03);
  }
}

@media (prefers-reduced-motion: reduce) {
  .congrats__card {
    animation: none;
  }

  .congrats-enter-from {
    transform: none;
  }
}
</style>
