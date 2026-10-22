import { del, get, put } from '@vercel/blob'
import type { ThumbnailStore } from '../services/thumbnails'

/**
 * Private Vercel Blob store: the files are never reachable by their own URL; our route checks the
 * owner and streams them. The store is connected to the project in the Vercel dashboard, which
 * provides `BLOB_STORE_ID` (the server authenticates with the OIDC token of the deployment).
 */
function vercelStore(storeId: string): ThumbnailStore {
  return {
    async put(pathname, body, contentType) {
      await put(pathname, Buffer.from(body), { access: 'private', contentType, allowOverwrite: true, addRandomSuffix: false, storeId })
    },
    async get(pathname) {
      const result = await get(pathname, { access: 'private', useCache: false, storeId })
      return result?.statusCode === 200 ? { stream: result.stream, contentType: result.blob.contentType } : null
    },
    async remove(pathnames) {
      if (pathnames.length > 0) await del(pathnames, { storeId })
    },
  }
}

/** For development and the e2e server without a Blob store: files live as long as the server process. */
function memoryStore(): ThumbnailStore {
  const files = new Map<string, { body: Uint8Array, contentType: string }>()
  return {
    async put(pathname, body, contentType) {
      files.set(pathname, { body: new Uint8Array(body), contentType })
    },
    async get(pathname) {
      const file = files.get(pathname)
      return file ? { stream: new Blob([file.body.slice().buffer]).stream(), contentType: file.contentType } : null
    },
    async remove(pathnames) {
      for (const pathname of pathnames) files.delete(pathname)
    },
  }
}

let store: ThumbnailStore | undefined

/**
 * The thumbnail store, created on first use from the runtime config. Without a Blob store the
 * in-memory one is used only when `memoryThumbnails` is switched on; otherwise it is an error
 * (503), not a silent fallback that would lose files at the next cold start.
 */
export function useThumbnailStore(): ThumbnailStore {
  if (!store) {
    const { blobStoreId, memoryThumbnails } = useRuntimeConfig()
    if (blobStoreId) store = vercelStore(blobStoreId)
    else if (memoryThumbnails === true) store = memoryStore()
    else throw createError({ statusCode: 503, statusMessage: 'storage_unavailable' })
  }
  return store
}
