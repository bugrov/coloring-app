<script setup lang="ts">
import type { AdminStats } from '../../../shared'

type Day = AdminStats['daily'][number]

const props = defineProps<{
  days: Day[]
}>()

const SERIES = [
  { key: 'opens', label: 'Открытия', color: 'var(--series-1)' },
  { key: 'starts', label: 'Начали', color: 'var(--series-2)' },
  { key: 'completes', label: 'Закончили', color: 'var(--series-3)' },
] as const

const WIDTH = 640
const HEIGHT = 240
const MARGIN = { top: 12, right: 12, bottom: 28, left: 36 }
const MAX_TICKS = 4

const innerWidth = WIDTH - MARGIN.left - MARGIN.right
const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

/** The top of the scale: the highest value rounded up to a tidy number, so the ticks read round. */
const top = computed(() => {
  const highest = Math.max(1, ...props.days.flatMap(day => SERIES.map(series => day[series.key])))
  const magnitude = 10 ** Math.floor(Math.log10(highest))
  return Math.ceil(highest / magnitude) * magnitude
})

const x = (index: number) => MARGIN.left + (props.days.length <= 1 ? innerWidth / 2 : (index / (props.days.length - 1)) * innerWidth)
const y = (value: number) => MARGIN.top + innerHeight - (value / top.value) * innerHeight

const paths = computed(() => SERIES.map(series => ({
  ...series,
  d: props.days.map((day, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(day[series.key]).toFixed(1)}`).join(''),
  last: props.days.at(-1)?.[series.key] ?? 0,
})))

/** Whole numbers only: a count of two has ticks 0, 1, 2, never 0.5 rounded twice. */
const ticks = computed(() => {
  const count = Math.min(MAX_TICKS, top.value)
  return Array.from({ length: count + 1 }, (_, i) => (top.value / count) * i)
})

/** First, middle and last day on the axis: enough to place the eye, not a label per day. */
const axisDays = computed(() => {
  const last = props.days.length - 1
  return [...new Set([0, Math.floor(last / 2), last])]
    .filter(index => index >= 0)
    // The outer labels lean inwards so the first and the last day are not cut off at the edges.
    .map(index => ({ index, label: shortDay(props.days[index]!.day), anchor: index === 0 ? 'start' : index === last ? 'end' : 'middle' }))
})

function shortDay(day: string): string {
  const [, month, date] = day.split('-')
  return `${date}.${month}`
}

// Hover: a crosshair on the day nearest to the pointer and a tooltip with its numbers.
const hovered = ref<number | null>(null)
const svg = useTemplateRef<SVGSVGElement>('svg')

function onMove(event: PointerEvent) {
  const box = svg.value?.getBoundingClientRect()
  if (!box || props.days.length === 0) return
  const position = ((event.clientX - box.left) / box.width) * WIDTH
  const index = Math.round(((position - MARGIN.left) / innerWidth) * (props.days.length - 1))
  hovered.value = Math.min(props.days.length - 1, Math.max(0, index))
}

const hoveredDay = computed(() => (hovered.value === null ? null : props.days[hovered.value] ?? null))
const tooltipStyle = computed(() => (hovered.value === null ? {} : { left: `${(x(hovered.value) / WIDTH) * 100}%` }))
</script>

<template>
  <figure class="line">
    <figcaption class="line__title">
      Активность по дням
    </figcaption>
    <ul
      class="line__legend"
      aria-label="Линии"
    >
      <li
        v-for="series in SERIES"
        :key="series.key"
        class="line__legend-item"
      >
        <span
          class="line__swatch"
          :style="{ background: series.color }"
          aria-hidden="true"
        />
        {{ series.label }}
      </li>
    </ul>
    <div class="line__plot">
      <svg
        ref="svg"
        class="line__svg"
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        role="img"
        aria-label="Открытия, начатые и законченные рисунки по дням"
        @pointermove="onMove"
        @pointerleave="hovered = null"
      >
        <g class="line__grid">
          <template
            v-for="tick in ticks"
            :key="tick"
          >
            <line
              :x1="MARGIN.left"
              :x2="WIDTH - MARGIN.right"
              :y1="y(tick)"
              :y2="y(tick)"
            />
            <text
              :x="MARGIN.left - 6"
              :y="y(tick) + 4"
              text-anchor="end"
            >{{ Math.round(tick) }}</text>
          </template>
          <text
            v-for="day in axisDays"
            :key="day.index"
            :x="x(day.index)"
            :y="HEIGHT - 8"
            :text-anchor="day.anchor"
          >{{ day.label }}</text>
        </g>
        <path
          v-for="line in paths"
          :key="line.key"
          class="line__path"
          :d="line.d"
          :stroke="line.color"
        />
        <g v-if="hoveredDay && hovered !== null">
          <line
            class="line__cross"
            :x1="x(hovered)"
            :x2="x(hovered)"
            :y1="MARGIN.top"
            :y2="MARGIN.top + innerHeight"
          />
          <circle
            v-for="series in SERIES"
            :key="series.key"
            class="line__dot"
            :cx="x(hovered)"
            :cy="y(hoveredDay[series.key])"
            r="4"
            :fill="series.color"
          />
        </g>
      </svg>
      <div
        v-if="hoveredDay"
        class="line__tooltip"
        :style="tooltipStyle"
      >
        <strong>{{ hoveredDay.day }}</strong>
        <span
          v-for="series in SERIES"
          :key="series.key"
        >{{ series.label }}: {{ hoveredDay[series.key] }}</span>
      </div>
    </div>
    <details class="line__table">
      <summary>Таблица значений</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">
              День
            </th>
            <th
              v-for="series in SERIES"
              :key="series.key"
              scope="col"
            >
              {{ series.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="day in days"
            :key="day.day"
          >
            <th scope="row">
              {{ day.day }}
            </th>
            <td
              v-for="series in SERIES"
              :key="series.key"
            >
              {{ day[series.key] }}
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>

<style scoped lang="scss">
// The first three categorical slots (blue, orange, aqua), validated for colour-blind separation; the
// aqua line is below 3:1 against the surface, so every line also has a legend, a hover read-out and a table.
.line {
  --series-1: #2a78d6;
  --series-2: #eb6834;
  --series-3: #1baf7a;

  margin: 0;
}

@media (prefers-color-scheme: dark) {
  .line {
    --series-1: #3987e5;
    --series-2: #d95926;
    --series-3: #199e70;
  }
}

.line__title {
  font-weight: 600;
}

.line__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin: var(--space-2) 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-s);
}

.line__legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.line__swatch {
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

// The tooltip is placed by a share of this box, so the box must be as wide as the drawing.
.line__plot {
  position: relative;
  max-width: 760px;
}

.line__svg {
  display: block;
  width: 100%;
  height: auto;
  touch-action: pan-y;
}

.line__grid line {
  stroke: var(--color-text-muted);
  stroke-opacity: 0.25;
}

.line__grid text {
  fill: var(--color-text-muted);
  font-size: 11px;
}

.line__path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

// Where two lines run on top of each other (starts equal completes) the third stays visible as a dashed one.
.line__path:nth-of-type(3) {
  stroke-dasharray: 6 4;
}

.line__cross {
  stroke: var(--color-text-muted);
  stroke-dasharray: 3 3;
}

.line__dot {
  stroke: var(--color-surface);
  stroke-width: 2;
}

.line__tooltip {
  position: absolute;
  top: 0;
  display: grid;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-m);
  background: var(--color-overlay);
  color: var(--color-on-overlay);
  font-size: var(--font-size-s);
  pointer-events: none;
  transform: translateX(-50%);
  white-space: nowrap;
}

.line__table {
  margin-top: var(--space-2);
  font-size: var(--font-size-s);
}

.line__table summary {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-m);
  background: var(--color-bg);
  font-weight: 600;
}

.line__table summary:focus-visible {
  @include focus-ring;
}

.line__table table {
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.line__table th,
.line__table td {
  padding: 2px var(--space-3);
  text-align: end;
}

.line__table th:first-child {
  text-align: start;
}
</style>
