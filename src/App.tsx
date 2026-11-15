import { useEffect, useMemo, useState } from 'react'
import { BRANDS, GYMS, type Brand } from './data/gyms'
import { occupancyNow, type Occupancy, type Report } from './lib/occupancy'
import { storeMode, subscribeReports } from './lib/reports'
import { formatClock, formatDay } from './lib/time'
import { Conditions } from './components/Conditions'
import { MapView } from './components/MapView'
import { GymDetail, GymList } from './components/Panel'
import { Sheet } from './components/Sheet'
import { locateWithRefresh } from './lib/location'

type Filter = Brand | 'all'

/** En développement, ?heure=2026-11-17T18:30%2B01:00 simule un autre moment. Ignoré en production. */
const simulatedStart = (() => {
  if (!import.meta.env.DEV) return null
  const raw = new URLSearchParams(window.location.search).get('heure')
  const date = raw ? new Date(raw) : null
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : null
})()
const startedAt = Date.now()

function currentTime(): Date {
  return simulatedStart === null ? new Date() : new Date(simulatedStart + Date.now() - startedAt)
}

function useNow(intervalMs = 15000): Date {
  const [now, setNow] = useState(currentTime)
  useEffect(() => {
    const id = window.setInterval(() => setNow(currentTime()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLng = (b[0] - a[0]) * rad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

export default function App() {
  const now = useNow()
  const [reports, setReports] = useState<Report[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const id = new URLSearchParams(window.location.search).get('salle')
    return GYMS.some((g) => g.id === id) ? id : null
  })
  const [expanded, setExpanded] = useState(() => selectedId !== null)
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null)
  const [locationTarget, setLocationTarget] = useState<[number, number] | null>(null)
  const [locError, setLocError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [refreshingLocation, setRefreshingLocation] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  useEffect(() => subscribeReports(setReports), [])

  // Lien partageable vers une salle : ?salle=onair-gambetta
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (selectedId) url.searchParams.set('salle', selectedId)
      else url.searchParams.delete('salle')
      window.history.replaceState(null, '', url)
    } catch {
      /* navigation bloquée (aperçu intégré) : le lien partageable est simplement ignoré */
    }
  }, [selectedId])

  const gyms = useMemo(
    () => (filter === 'all' ? GYMS : GYMS.filter((g) => g.brand === filter)),
    [filter],
  )

  const occupancy = useMemo(() => {
    const map: Record<string, Occupancy | null> = {}
    for (const g of GYMS) map[g.id] = occupancyNow(g, reports, now)
    return map
  }, [reports, now])

  const distances = useMemo(() => {
    if (!userPosition) return null
    const map: Record<string, number> = {}
    for (const g of GYMS) map[g.id] = distanceKm(userPosition, g.coords)
    return map
  }, [userPosition])

  const selected = GYMS.find((g) => g.id === selectedId) ?? null

  function select(id: string) {
    setSelectedId(id)
    setExpanded(true)
  }

  function locate() {
    if (locating) return
    if (!navigator.geolocation) {
      setLocError('Ton navigateur ne permet pas la localisation.')
      return
    }
    setLocError(null)
    setLocating(true)
    setRefreshingLocation(false)
    let shownPosition: [number, number] | null = null
    locateWithRefresh(
      navigator.geolocation,
      (pos, fresh) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude]
        if (!shownPosition || distanceKm(shownPosition, coords) >= 0.1) {
          setExpanded(false)
          setLocationTarget(coords)
        }
        shownPosition = coords
        setUserPosition(coords)
        setLocating(!fresh)
        setRefreshingLocation(!fresh)
        setLocError(null)
      },
      (error) => {
        setLocating(false)
        setRefreshingLocation(false)
        setLocError(shownPosition
          ? 'Position récente affichée. Actualisation impossible, réessaie dans un instant.'
          : error.code === 1
            ? 'Localisation refusée. Autorise-la dans les réglages pour voir les distances.'
            : 'Position indisponible pour le moment. Réessaie dans un instant.')
      },
    )
  }

  return (
    <div className="app">
      <MapView
        gyms={gyms}
        occupancy={occupancy}
        selectedId={selectedId}
        userPosition={userPosition}
        locationTarget={locationTarget}
        onSelect={select}
      />

      <header className="topbar">
        <div className="brandmark">
          <div className="brand-row">
            <h1>Affluence</h1>
            <p className="clock" aria-live="off">
              <span className="clock-dot" aria-hidden="true" />
              Grenoble, {formatDay(now)} {formatClock(now)}
            </p>
          </div>
          <Conditions />
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={locate}
            disabled={locating}
            aria-busy={locating}
            aria-label={locating ? (refreshingLocation ? 'Actualisation de la position' : 'Localisation en cours') : 'Me localiser'}
          >
            <svg className={locating ? 'location-spinner' : undefined} viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3.5" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
          <button type="button" className="icon-btn" onClick={() => setAboutOpen(true)} aria-label="Comment ça marche">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6M12 7.5v.01" />
            </svg>
          </button>
        </div>
        {locating && <p className="loc-status" role="status">{refreshingLocation ? 'Actualisation de la position…' : 'Localisation en cours…'}</p>}
        <nav className="filters" aria-label="Filtrer par enseigne">
          {(['all', 'onair', 'fitnesspark', 'basicfit'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className="chip"
              aria-pressed={filter === f}
              style={f === 'all' ? undefined : { ['--brand' as string]: BRANDS[f].color }}
              onClick={() => {
                setFilter(f)
                if (selected && f !== 'all' && selected.brand !== f) setSelectedId(null)
              }}
            >
              {f !== 'all' && <span className="chip-dot" aria-hidden="true" />}
              {f === 'all' ? 'Toutes' : BRANDS[f].label}
            </button>
          ))}
        </nav>
        {locError && <p className="loc-error" role="alert">{locError}</p>}
      </header>

      <Sheet expanded={expanded} onExpandedChange={setExpanded}>
        {selected ? (
          <GymDetail
            key={selected.id}
            gym={selected}
            occ={occupancy[selected.id]}
            now={now}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <>
            <h2 className="sheet-title">Où s’entraîner maintenant ?</h2>
            <GymList gyms={gyms} occupancy={occupancy} distances={distances} onSelect={select} />
          </>
        )}
      </Sheet>

      {aboutOpen && (
        <div className="about-backdrop" onClick={() => setAboutOpen(false)}>
          <div
            className="about"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="about-title">Comment ça marche</h2>
            <p>
              Chaque salle affiche un taux de remplissage. Sans signalement récent, c’est une{' '}
              <strong>estimation</strong> basée sur la fréquentation habituelle selon le jour et l’heure.
            </p>
            <p>
              Dès que des membres signalent l’affluence sur place, le taux passe <strong>en direct</strong>. Un
              signalement compte pendant une heure, et de moins en moins à mesure qu’il vieillit.
            </p>
            <p>Plus on est nombreux à signaler, plus la carte est juste. Pense à le faire en arrivant.</p>
            {storeMode === 'local' ? (
              <p className="about-note">
                Ton navigateur ne gère pas le temps réel : tes signalements restent sur cet appareil.
              </p>
            ) : (
              <p className="about-note">
                Les signalements sont anonymes et partagés en direct avec tous les utilisateurs.
              </p>
            )}
            <button type="button" className="go" onClick={() => setAboutOpen(false)}>
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
