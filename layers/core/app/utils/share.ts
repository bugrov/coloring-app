export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** The download has started by then; the object URL can be freed. */
const REVOKE_DELAY_MS = 1000

/**
 * Opens the system share sheet with the file (on iOS it also offers "Save
 * Image"), or downloads it where sharing files is not supported.
 *
 * Safari only allows `navigator.share` during a user gesture, so call this
 * directly from a click handler with an already prepared blob.
 */
export async function shareOrDownload(blob: Blob, fileName: string): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Not allowed (e.g. the gesture expired): fall back to a download.
    }
  }
  downloadBlob(blob, fileName)
  return 'downloaded'
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
