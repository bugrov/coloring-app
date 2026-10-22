import type { UnsentHistory } from '../../shared/history'

/** Where work that is not on the server yet waits, so a reload or a closed tab does not lose it. */
export interface Outbox {
  read: (key: string) => Promise<UnsentHistory | null>
  write: (key: string, work: UnsentHistory) => Promise<void>
  remove: (key: string) => Promise<void>
}

const DATABASE = 'coloring-outbox'
const STORE = 'unsent'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE, 1)

  request.onupgradeneeded = () => request.result.createObjectStore(STORE)

  return requestResult(request)
}

/** Keeps the work in memory only: for tests, and where IndexedDB is not available. */
export class MemoryOutbox implements Outbox {
  private readonly items = new Map<string, UnsentHistory>()

  async read(key: string) {
    return this.items.get(key) ?? null
  }

  async write(key: string, work: UnsentHistory) {
    this.items.set(key, structuredClone(work))
  }

  async remove(key: string) {
    this.items.delete(key)
  }
}

/**
 * IndexedDB: unlike localStorage it takes megabytes and does not block the page. It can be missing
 * or refuse to open (private windows, blocked site data); then the work stays in memory only and
 * the editor still saves to the server, just without the safety net of a crash.
 */
export class IndexedDbOutbox implements Outbox {
  private database: Promise<IDBDatabase | null> | null = null
  private readonly fallback = new MemoryOutbox()

  private open(): Promise<IDBDatabase | null> {
    this.database ??= typeof indexedDB === 'undefined' ? Promise.resolve(null) : openDatabase().catch(() => null)

    return this.database
  }

  private async run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
    const database = await this.open()

    if (!database) return undefined

    try {
      return await requestResult(action(database.transaction(STORE, mode).objectStore(STORE)))
    } catch {
      return undefined
    }
  }

  async read(key: string) {
    const stored = await this.run<UnsentHistory | undefined>('readonly', store => store.get(key))

    return stored ?? this.fallback.read(key)
  }

  async write(key: string, work: UnsentHistory) {
    if (await this.run('readwrite', store => store.put(work, key)) === undefined) await this.fallback.write(key, work)
  }

  async remove(key: string) {
    await this.run('readwrite', store => store.delete(key))
    await this.fallback.remove(key)
  }
}
