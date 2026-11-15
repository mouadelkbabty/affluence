import { describe, expect, it, vi } from 'vitest'
import { locateWithRefresh } from './location'

function setup() {
  const requests: { success: PositionCallback; error: PositionErrorCallback | null | undefined; options: PositionOptions | undefined }[] = []
  const geolocation = {
    getCurrentPosition: vi.fn((success: PositionCallback, error?: PositionErrorCallback | null, options?: PositionOptions) => {
      requests.push({ success, error, options })
    }),
  }
  const onPosition = vi.fn()
  const onError = vi.fn()
  locateWithRefresh(geolocation, onPosition, onError)
  return { requests, onPosition, onError }
}

const position = (age: number) => ({ timestamp: Date.now() - age } as GeolocationPosition)
const timeout = { code: 3 } as GeolocationPositionError

describe('locateWithRefresh', () => {
  it('shows a recent cached fix and always requests a fresh fix', () => {
    const { requests, onPosition } = setup()
    expect(requests[0].options).toEqual({ enableHighAccuracy: true, maximumAge: 15000, timeout: 0 })
    expect(requests[1].options).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 })
    const cached = position(10000)
    const fresh = position(0)
    requests[0].success(cached)
    requests[1].success(fresh)
    expect(onPosition.mock.calls).toEqual([[cached, false], [fresh, true]])
  })

  it('ignores cache misses and waits for the fresh result', () => {
    const { requests, onPosition, onError } = setup()
    requests[0].error?.(timeout)
    expect(onError).not.toHaveBeenCalled()
    requests[1].success(position(0))
    expect(onPosition).toHaveBeenCalledTimes(1)
    expect(onPosition.mock.calls[0][1]).toBe(true)
  })

  it('rejects stale cached positions and late cache callbacks', () => {
    const { requests, onPosition } = setup()
    requests[0].success(position(16000))
    expect(onPosition).not.toHaveBeenCalled()
    const fresh = position(0)
    requests[1].success(fresh)
    requests[0].success(position(5000))
    expect(onPosition.mock.calls).toEqual([[fresh, true]])
  })

  it('reports refresh failure without discarding the cached result', () => {
    const { requests, onPosition, onError } = setup()
    const cached = position(5000)
    requests[0].success(cached)
    requests[1].error?.(timeout)
    requests[0].success(position(1000))
    expect(onPosition.mock.calls).toEqual([[cached, false]])
    expect(onError).toHaveBeenCalledWith(timeout)
  })
})
