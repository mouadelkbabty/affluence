/** Probe the browser cache without waiting, while always requesting a fresh fix. */
export function locateWithRefresh(
  geolocation: Pick<Geolocation, 'getCurrentPosition'>,
  onPosition: (position: GeolocationPosition, fresh: boolean) => void,
  onError: (error: GeolocationPositionError) => void,
) {
  let finished = false
  geolocation.getCurrentPosition(
    (position) => {
      if (!finished && Date.now() - position.timestamp <= 15000) onPosition(position, false)
    },
    () => { /* A missing cached fix is normal; the fresh request is still running. */ },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 0 },
  )
  geolocation.getCurrentPosition(
    (position) => {
      finished = true
      onPosition(position, true)
    },
    (error) => {
      finished = true
      onError(error)
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
  )
}
