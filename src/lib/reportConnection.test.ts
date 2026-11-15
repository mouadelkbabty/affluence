import { describe, expect, it, vi } from 'vitest'
import { createReportConnection } from './reportConnection'

describe('report connection status', () => {
  it('distinguishes a working stream, polling fallback, and full connection loss', () => {
    const connection = createReportConnection(false, true)
    const listener = vi.fn()
    connection.subscribe(listener)
    expect(listener).toHaveBeenLastCalledWith('connecting')
    connection.setStream(true)
    connection.setPolling(false)
    expect(listener).toHaveBeenLastCalledWith('connected')
    connection.setPolling(true)
    connection.setStream(false)
    expect(listener).toHaveBeenLastCalledWith('polling')
    connection.setPolling(false)
    expect(listener).toHaveBeenLastCalledWith('reconnecting')
    connection.setStream(true)
    expect(listener).toHaveBeenLastCalledWith('connected')
  })

  it('stays offline despite late network callbacks and requires recovery after coming online', () => {
    const connection = createReportConnection(false, true)
    const listener = vi.fn()
    connection.subscribe(listener)
    connection.setStream(true)
    connection.setOnline(false)
    connection.setPolling(true)
    expect(listener).toHaveBeenLastCalledWith('offline')
    connection.setOnline(true)
    expect(listener).toHaveBeenLastCalledWith('reconnecting')
    connection.setPolling(true)
    expect(listener).toHaveBeenLastCalledWith('polling')
  })

  it('identifies local-only mode and stops notifying unsubscribed listeners', () => {
    const connection = createReportConnection(true, true)
    const listener = vi.fn()
    const unsubscribe = connection.subscribe(listener)
    expect(listener).toHaveBeenLastCalledWith('local')
    unsubscribe()
    connection.setOnline(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
