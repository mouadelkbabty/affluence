import { useState } from 'react'
import { BRANDS, type Gym } from '../data/gyms'
import {
  STATUS_LABEL,
  bestSlot,
  dayCurve,
  openingLabel,
  type CrowdLevel,
  type Occupancy,
} from '../lib/occupancy'
import { addReport, cooldownLeft, storeMode } from '../lib/reports'
import { formatHour, localTime, minutesAgo } from '../lib/time'
import { DayBars } from './DayBars'
import { Gauge } from './Gauge'

interface ListProps {
  gyms: Gym[]
  occupancy: Record<string, Occupancy | null>
  distances: Record<string, number> | null
  onSelect: (id: string) => void
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`
}

/** Les salles ouvertes d'abord, de la plus calme à la plus pleine. */
export function GymList({ gyms, occupancy, distances, onSelect }: ListProps) {
  const sorted = [...gyms].sort((a, b) => {
    const pa = occupancy[a.id]?.percent ?? 999
    const pb = occupancy[b.id]?.percent ?? 999
    return pa - pb
  })
  const calmest = sorted.find((g) => occupancy[g.id])

  return (
    <div className="list">
      {calmest && (
        <button className="pick" type="button" onClick={() => onSelect(calmest.id)}>
          <span className="pick-label">Le plus calme en ce moment</span>
          <span className="pick-name">{calmest.name}</span>
          <span className={`pick-value status-${occupancy[calmest.id]!.status}`}>
            {occupancy[calmest.id]!.percent} %
          </span>
        </button>
      )}
      <ul className="rows">
        {sorted.map((gym) => {
          const occ = occupancy[gym.id]
          return (
            <li key={gym.id}>
              <button type="button" className="row" onClick={() => onSelect(gym.id)}>
                <span className="row-brand" style={{ background: BRANDS[gym.brand].color }} aria-hidden="true" />
                <span className="row-text">
                  <span className="row-name">{gym.name}</span>
                  <span className="row-meta">
                    {gym.city}
                    {distances?.[gym.id] !== undefined && `, à ${formatDistance(distances[gym.id])}`}
                  </span>
                </span>
                <span className={`row-meter ${occ ? `status-${occ.status}` : 'is-closed'}`}>
                  <span className="row-bar" style={{ ['--fill' as string]: `${occ?.percent ?? 0}%` }} />
                  <span className="row-value">{occ ? `${occ.percent} %` : 'Fermé'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface DetailProps {
  gym: Gym
  occ: Occupancy | null
  now: Date
  onClose: () => void
}

const REPORT_OPTIONS: { level: CrowdLevel; label: string; hint: string }[] = [
  { level: 'calme', label: 'Calme', hint: 'Machines libres' },
  { level: 'normal', label: 'Normal', hint: 'Un peu d’attente' },
  { level: 'plein', label: 'Plein', hint: 'Ça attend partout' },
]

export function GymDetail({ gym, occ, now, onClose }: DetailProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const t = localTime(now)
  const best = bestSlot(gym, now)
  const wait = cooldownLeft(gym.id, now.getTime())
  const destination = `${gym.coords[1]},${gym.coords[0]}`

  async function report(level: CrowdLevel) {
    setSending(true)
    try {
      await addReport(gym.id, level)
      setMessage('Merci ! Ton signalement aide tout le monde.')
    } catch (e) {
      setMessage(`Signalement non envoyé : ${(e as Error).message}. Réessaie dans un instant.`)
    } finally {
      setSending(false)
    }
  }

  return (
    <article className="detail" aria-labelledby="detail-title">
      <header className="detail-head">
        <button className="back" type="button" onClick={onClose} aria-label="Retour à la liste">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <p className="detail-brand" style={{ color: BRANDS[gym.brand].color }}>
            {BRANDS[gym.brand].label}
          </p>
          <h2 id="detail-title">{gym.name}</h2>
          <p className="detail-address">
            {gym.address}, {gym.city}
          </p>
        </div>
      </header>

      <section className="now">
        <Gauge occ={occ} />
        <div className="now-text">
          {occ ? (
            <>
              <p className="now-percent">
                {occ.percent}
                <span>%</span>
              </p>
              <p className={`now-status status-${occ.status}`}>{STATUS_LABEL[occ.status]}</p>
              <p className="now-source">
                {occ.source === 'live' && occ.lastReportAt ? (
                  <>
                    <span className="live-dot" aria-hidden="true" />
                    En direct, {occ.reportCount} signalement{occ.reportCount > 1 ? 's' : ''}, le dernier il y a{' '}
                    {minutesAgo(occ.lastReportAt, now)} min
                  </>
                ) : (
                  'Estimation d’après la fréquentation habituelle'
                )}
              </p>
            </>
          ) : (
            <p className="now-closed">Fermée</p>
          )}
          <p className="now-hours">{openingLabel(gym, now)}</p>
        </div>
      </section>

      {best && occ && best.percent < occ.percent - 5 && (
        <p className="tip">
          Plus calme vers <strong>{formatHour(best.hour)}</strong> : environ {best.percent} %.
        </p>
      )}

      <section className="block">
        <h3>Aujourd’hui</h3>
        <DayBars points={dayCurve(gym, t.day)} nowHour={t.hour} best={best} />
      </section>

      <section className="block">
        <h3>Tu y es ? Dis-nous comment c’est</h3>
        {wait > 0 ? (
          <p className="report-wait">Signalement reçu. Tu pourras en refaire un dans {wait} min.</p>
        ) : (
          <div className="report" role="group" aria-label="Signaler l’affluence">
            {REPORT_OPTIONS.map((o) => (
              <button
                key={o.level}
                type="button"
                className={`report-btn level-${o.level}`}
                disabled={sending || !occ}
                onClick={() => report(o.level)}
              >
                <span>{o.label}</span>
                <small>{o.hint}</small>
              </button>
            ))}
          </div>
        )}
        {message && (
          <p className="report-message" role="status">
            {message}
          </p>
        )}
        {storeMode === 'partage' && !message && wait === 0 && (
          <p className="report-note">Anonyme et visible en direct par tous.</p>
        )}
        {storeMode === 'local' && (
          <p className="report-note">Ton navigateur ne gère pas le temps réel : ton signalement reste sur cet appareil.</p>
        )}
      </section>

      <a
        className="go"
        href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`}
        target="_blank"
        rel="noreferrer"
      >
        Y aller
      </a>
    </article>
  )
}
