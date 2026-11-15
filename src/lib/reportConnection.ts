export type ReportConnection = 'connecting' | 'connected' | 'polling' | 'reconnecting' | 'offline' | 'local'

export function createReportConnection(local: boolean, initiallyOnline: boolean) {
  let online = initiallyOnline
  let stream = false
  let polling = false
  let attempted = false
  const listeners = new Set<(status: ReportConnection) => void>()
  const status = (): ReportConnection => !online ? 'offline' : local ? 'local'
    : stream ? 'connected' : polling ? 'polling' : attempted ? 'reconnecting' : 'connecting'
  function emit() {
    for (const listener of listeners) listener(status())
  }
  return {
    subscribe(listener: (status: ReportConnection) => void) {
      listeners.add(listener)
      listener(status())
      return () => { listeners.delete(listener) }
    },
    setOnline(value: boolean) {
      online = value
      stream = false
      polling = false
      attempted = value
      emit()
    },
    setStream(value: boolean) {
      stream = value
      attempted = true
      emit()
    },
    setPolling(value: boolean) {
      polling = value
      attempted = true
      emit()
    },
  }
}
