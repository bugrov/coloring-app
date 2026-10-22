<script setup lang="ts">
import type { GameDefinition } from '../../../../../shared/types/game'

defineProps<{ game: GameDefinition }>()
</script>

<template>
  <NuxtLink
    class="game-card"
    :to="{ name: game.entry }"
  >
    <div class="game-card__cover">
      <img
        v-if="game.cover"
        class="game-card__image"
        :src="game.cover"
        alt=""
        draggable="false"
      >
    </div>
    <div class="game-card__body">
      <h2 class="game-card__title">
        {{ game.title }}
      </h2>
      <p
        v-if="game.description"
        class="game-card__text"
      >
        {{ game.description }}
      </p>
      <span class="game-card__play">
        Играть
        <IconArrowRight />
      </span>
    </div>
  </NuxtLink>
</template>

<style scoped lang="scss">
// The card of a game on the home screen: the picture on the left, the name and a way in on the right,
// so it stays low enough for a phone held sideways.
.game-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  border: 4px solid var(--color-card-frame);
  border-radius: var(--radius-l);
  background: var(--color-surface);
  transition: transform var(--duration-fast) var(--ease-out);

  &:active {
    transform: scale(0.98);
  }

  &:focus-visible {
    @include focus-ring;
  }

  @media (hover: hover) {
    &:hover {
      transform: translateY(-2px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.game-card__cover {
  background: var(--color-card-frame);
}

.game-card__image {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 140px;
  object-fit: cover;
  object-position: 20% center;
}

.game-card__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-4);
}

.game-card__title {
  margin: 0;
  font-size: var(--font-size-l);
}

.game-card__text {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-s);
}

.game-card__play {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: auto;
  padding: var(--space-2) var(--space-4);
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-text);
  font-weight: 600;
}
</style>
