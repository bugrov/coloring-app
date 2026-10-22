import { describe, expect, it } from 'vitest'
import { shouldGoFullscreen } from '../../../layers/core/app/utils/fullscreen'

const phone = { coarsePointer: true, supported: true, fullscreen: false, installed: false }

describe('going fullscreen', () => {
  it('asks for it on a touch screen that is allowed to', () => {
    expect(shouldGoFullscreen(phone)).toBe(true)
  })

  it('leaves a desktop window alone', () => {
    expect(shouldGoFullscreen({ ...phone, coarsePointer: false })).toBe(false)
  })

  it('does nothing where the browser has no such thing (iPhone Safari)', () => {
    expect(shouldGoFullscreen({ ...phone, supported: false })).toBe(false)
  })

  it('does not ask twice, nor when the game runs from the home screen', () => {
    expect(shouldGoFullscreen({ ...phone, fullscreen: true })).toBe(false)
    expect(shouldGoFullscreen({ ...phone, installed: true })).toBe(false)
  })
})
