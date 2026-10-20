<script setup lang="ts">
import type { ArtItem, ColoringArt } from '../../shared'

const props = defineProps<{
  art: ColoringArt
  /** Paint every area its own colour to show how the drawing was split. */
  highlightRegions?: boolean
}>()

/** Golden-angle hues keep neighbouring region ids visually distinct. */
const GOLDEN_ANGLE = 137.508

const regionFill = (item: ArtItem) =>
  props.highlightRegions && item.type === 'region' && item.kind === 'area'
    ? `hsl(${(item.id * GOLDEN_ANGLE) % 360} 70% 75%)`
    : '#fff'
</script>

<template>
  <!-- Renders the normalized art only: path data is validated by the art schema. -->
  <svg :viewBox="art.viewBox.join(' ')">
    <template
      v-for="(item, index) in art.items"
      :key="index"
    >
      <path
        v-if="item.type === 'region'"
        :d="item.d"
        :fill="regionFill(item)"
        :fill-rule="item.fillRule"
      />
      <path
        v-else
        :d="item.d"
        :fill="item.fill ?? 'none'"
        :fill-rule="item.fillRule"
        :stroke="item.stroke ?? 'none'"
        :stroke-width="item.strokeWidth"
        :stroke-linecap="item.lineCap"
        :stroke-linejoin="item.lineJoin"
        :stroke-miterlimit="item.miterLimit"
      />
    </template>
  </svg>
</template>
