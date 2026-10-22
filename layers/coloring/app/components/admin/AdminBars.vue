<script setup lang="ts">
export interface BarItem {
  label: string
  value: number
}

const props = defineProps<{
  /** What the bars show, as the chart title and for screen readers. */
  title: string
  items: BarItem[]
  /** What a value counts, for the tooltip ("открытий"). */
  unit: string
}>()

const max = computed(() => Math.max(1, ...props.items.map(item => item.value)))
const share = (item: BarItem) => `${(item.value / max.value) * 100}%`
</script>

<template>
  <figure class="bars">
    <figcaption class="bars__title">
      {{ title }}
    </figcaption>
    <p
      v-if="items.length === 0"
      class="bars__empty"
    >
      За этот период данных нет.
    </p>
    <ul
      v-else
      class="bars__list"
    >
      <li
        v-for="item in items"
        :key="item.label"
        class="bars__row"
        :title="`${item.label}: ${item.value} ${unit}`"
      >
        <span class="bars__label">{{ item.label }}</span>
        <span class="bars__track">
          <span
            class="bars__fill"
            :style="{ width: share(item) }"
          />
        </span>
        <span class="bars__value">{{ item.value }}</span>
      </li>
    </ul>
  </figure>
</template>

<style scoped lang="scss">
// One series, one colour (the first categorical slot): bars are thin, rounded at the data end,
// and carry their own number, so nothing relies on colour alone.
.bars {
  --bars-fill: #2a78d6;
  --bars-hover: #1c5fb0;

  margin: 0;
}

@media (prefers-color-scheme: dark) {
  .bars {
    --bars-fill: #3987e5;
    --bars-hover: #6aa6ee;
  }
}

.bars__title {
  margin-bottom: var(--space-2);
  font-weight: 600;
}

.bars__empty {
  margin: 0;
  color: var(--color-text-muted);
}

.bars__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars__row {
  display: grid;
  grid-template-columns: minmax(80px, 28%) 1fr 3.5ch;
  align-items: center;
  gap: var(--space-3);
}

.bars__label {
  overflow: hidden;
  font-size: var(--font-size-s);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bars__track {
  display: block;
  height: 14px;
}

.bars__fill {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: 0 4px 4px 0;
  background: var(--bars-fill);
}

.bars__row:hover .bars__fill {
  background: var(--bars-hover);
}

.bars__value {
  color: var(--color-text-muted);
  font-size: var(--font-size-s);
  font-variant-numeric: tabular-nums;
  text-align: end;
}
</style>
