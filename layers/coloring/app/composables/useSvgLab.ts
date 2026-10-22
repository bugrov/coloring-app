import { convertSvg } from '../../shared'
import type { SvgConversion } from '../../shared'

/** Runs the SVG pipeline on samples or user files and keeps the latest result. */
export function useSvgLab() {
  const result = shallowRef<SvgConversion | null>(null)
  const fileName = ref('')
  const durationMs = ref(0)

  function convert(source: string, name: string) {
    const started = performance.now()

    result.value = convertSvg(source)
    durationMs.value = Math.round(performance.now() - started)
    fileName.value = name
  }

  async function convertFile(file: File) {
    convert(await file.text(), file.name)
  }

  const stats = computed(() => {
    const items = result.value?.ok ? result.value.art.items : []

    return {
      areas: items.filter(item => item.type === 'region' && item.kind === 'area').length,
      ink: items.filter(item => item.type === 'ink').length,
    }
  })

  return { samples: BASE_ART_SAMPLES, result, fileName, durationMs, stats, convert, convertFile }
}
