import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timeline, type PaintHost } from '../../../layers/coloring/app/engine/timeline'
import { MemoryOutbox } from '../../../layers/coloring/app/sync/outbox'
import { HistorySync, SyncConflict, SyncRejected, type SyncApi, type SyncStatus } from '../../../layers/coloring/app/sync/history-sync'
import { MAX_CONFLICTS_IN_A_ROW, RETRY_BASE_MS, SAVE_AT_STEPS, SAVE_DELAY_MS, SAVE_MAX_WAIT_MS } from '../../../layers/coloring/app/sync/constants'
import type { HistoryState, HistoryStep, SaveHistoryRequest } from '../../../layers/coloring/shared'

const step = (region: number): HistoryStep => [{ type: 'fill', region, color: '#e53935' }]

const blankHost: PaintHost<number, never> = {
  clear: () => undefined,
  apply: () => undefined,
  settle: () => undefined,
  snapshot: () => 0,
  restore: () => undefined,
  release: () => undefined,
  capture: () => null,
  swap: () => undefined,
  discard: () => undefined,
  cost: () => 0,
}

/** A server that keeps one history and applies saves the way the real one does. */
interface FakeServer {
  state: HistoryState
  saves: SaveHistoryRequest[]
  failures: Error[]
  /** Errors to throw for the next reads of the history, in order. */
  loadFailures: Error[]
  api: SyncApi
}

function fakeServer() {
  const server: FakeServer = {
    state: { attempt: 1, rev: 1, cursor: 0, steps: [] as HistoryStep[] } as HistoryState,
    saves: [] as SaveHistoryRequest[],
    /** Errors to throw for the next saves, in order. */
    failures: [] as Error[],
    loadFailures: [] as Error[],
    api: {
      async save(request: SaveHistoryRequest) {
        server.saves.push(request)
        const failure = server.failures.shift()

        if (failure) throw failure
        if (request.rev !== server.state.rev) throw new SyncConflict()
        server.state = {
          attempt: server.state.attempt,
          rev: server.state.rev + 1,
          cursor: request.cursor,
          steps: [...server.state.steps.slice(0, request.keep), ...request.steps],
        }

        return { attempt: server.state.attempt, rev: server.state.rev }
      },
      async load() {
        const failure = server.loadFailures.shift()

        if (failure) throw failure

        return structuredClone(server.state)
      },
    },
  }

  return server
}

function setup() {
  const server = fakeServer()
  const outbox = new MemoryOutbox()
  const timeline = new Timeline(blankHost)
  const statuses: SyncStatus[] = []
  const reconciled: unknown[] = []

  timeline.log.load(structuredClone(server.state))
  const sync = new HistorySync({
    timeline,
    api: server.api,
    outbox,
    key: 'user:art',
    percent: () => 10,
    onStatus: status => statuses.push(status),
    onReconciled: result => reconciled.push(result),
    onRebuilding: () => undefined,
  })
  const draw = (region: number) => {
    timeline.record(step(region))
    sync.changed()
  }

  return { server, outbox, timeline, sync, statuses, reconciled, draw }
}

describe('HistorySync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('collects a burst of steps into one save after the pause', async () => {
    const { server, draw, statuses } = setup()

    draw(1)
    await vi.advanceTimersByTimeAsync(500)
    draw(2)
    await vi.advanceTimersByTimeAsync(500)
    draw(3)
    expect(server.saves).toHaveLength(0)
    expect(statuses).toEqual(['saving'])

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)

    expect(server.saves).toHaveLength(1)
    expect(server.saves[0]).toMatchObject({ keep: 0, cursor: 3, percent: 10 })
    expect(server.saves[0]!.steps).toHaveLength(3)
    expect(statuses).toEqual(['saving', 'saved'])
  })

  it('does not wait forever while the player keeps drawing', async () => {
    const { server, draw } = setup()

    for (let i = 1; i <= 8; i++) {
      draw(i)
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 500)
    }

    expect(server.saves.length).toBeGreaterThanOrEqual(1)
    expect(SAVE_MAX_WAIT_MS).toBeGreaterThan(SAVE_DELAY_MS)
  })

  it('saves at once when many steps wait', async () => {
    const { server, draw } = setup()

    for (let i = 1; i <= SAVE_AT_STEPS; i++) draw(i)
    await vi.advanceTimersByTimeAsync(0)

    expect(server.saves).toHaveLength(1)
  })

  it('sends an undo as a cursor move, many undos as one request', async () => {
    const { server, draw, timeline, sync } = setup()

    draw(1)
    draw(2)
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)

    timeline.undo()
    sync.changed()
    timeline.undo()
    sync.changed()
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)

    expect(server.saves).toHaveLength(2)
    expect(server.saves[1]).toMatchObject({ keep: 2, steps: [], cursor: 0 })
  })

  it('keeps the work and retries with growing pauses while the network is down', async () => {
    const { server, draw, statuses, outbox } = setup()

    server.failures.push(new Error('offline'), new Error('offline'))
    draw(1)

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(statuses.at(-1)).toBe('offline')
    expect(await outbox.read('user:art')).toMatchObject({ steps: [step(1)] })

    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS)
    expect(server.saves).toHaveLength(2)
    expect(statuses.at(-1)).toBe('offline')

    // The second pause is twice as long.
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS)
    expect(server.saves).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS)
    expect(server.saves).toHaveLength(3)
    expect(statuses.at(-1)).toBe('saved')
    expect(server.state.steps).toEqual([step(1)])
    expect(await outbox.read('user:art')).toBeNull()
  })

  it('retries at once when the network comes back', async () => {
    const { server, draw, sync } = setup()

    server.failures.push(new Error('offline'))
    draw(1)
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)

    sync.retryNow()
    await vi.advanceTimersByTimeAsync(0)

    expect(server.state.steps).toEqual([step(1)])
  })

  it('stops retrying when the server refuses the save', async () => {
    const { server, draw, statuses } = setup()

    server.failures.push(new SyncRejected())
    draw(1)

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 60_000)

    expect(server.saves).toHaveLength(1)
    expect(statuses.at(-1)).toBe('failed')
  })

  it('puts the player\'s steps on top after a conflict and saves them', async () => {
    const { server, draw, timeline, reconciled } = setup()

    // Another device saved meanwhile.
    server.state = { attempt: 1, rev: 2, cursor: 2, steps: [step(7), step(8)] }
    draw(1)

    // The picture is rebuilt in chunks with a pause between them.
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 100)

    expect(reconciled).toEqual([{ rebuild: true, merged: true }])
    expect(server.state.steps).toEqual([step(7), step(8), step(1)])
    expect(timeline.log.dirty).toBe(false)
  })

  it('retries later, instead of giving up, when the connection drops between a conflict and reading the server', async () => {
    const { server, draw, statuses } = setup()

    server.state = { attempt: 1, rev: 2, cursor: 1, steps: [step(7)] }
    server.loadFailures.push(new Error('offline'))
    draw(1)

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(statuses.at(-1)).toBe('offline')

    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS + 200)
    expect(statuses.at(-1)).toBe('saved')
    expect(server.state.steps).toEqual([step(7), step(1)])
  })

  it('gives up after conflicts that never settle', async () => {
    const { server, draw, statuses } = setup()

    server.failures.push(...Array.from({ length: MAX_CONFLICTS_IN_A_ROW + 2 }, () => new SyncConflict()))
    draw(1)

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 5000)

    expect(statuses.at(-1)).toBe('failed')
  })

  it('writes unsent work to the outbox soon, and clears it once saved', async () => {
    const { draw, outbox } = setup()

    draw(1)
    await vi.advanceTimersByTimeAsync(400)
    expect(await outbox.read('user:art')).toMatchObject({ attempt: 1, rev: 1, keep: 0, steps: [step(1)] })

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(await outbox.read('user:art')).toBeNull()
  })

  it('persists on demand when the page is going away', async () => {
    const { draw, sync, outbox } = setup()

    draw(1)

    await sync.persist()

    expect(await outbox.read('user:art')).toMatchObject({ steps: [step(1)] })
  })
})
