/** Calls `onResize` with the border-box size of the element whenever it changes (client only). */
export function useResizeObserver(
  target: Ref<Element | undefined | null>,
  onResize: (size: { width: number, height: number }) => void,
): void {
  let observer: ResizeObserver | undefined

  onMounted(() => {
    const element = target.value
    if (!element) return

    observer = new ResizeObserver(([entry]) => {
      const box = entry?.borderBoxSize?.[0]
      if (box) onResize({ width: box.inlineSize, height: box.blockSize })
      else if (entry) onResize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
  })
  onBeforeUnmount(() => observer?.disconnect())
}
