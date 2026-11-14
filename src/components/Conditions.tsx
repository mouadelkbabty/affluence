import { useEffect, useState } from 'react'
import { fetchConditions, type Conditions as Data, type WeatherIcon } from '../lib/weather'

const REFRESH_MS = 30 * 60 * 1000

function Icon({ name, isDay }: { name: WeatherIcon; isDay: boolean }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const }
  switch (name) {
    case 'soleil':
      return isDay ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />
        </svg>
      )
    case 'pluie':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <path d="M7 15a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.5 9 3.5 3.5 0 0 1 17 15.7" />
          <path d="M9 17.5l-1 2.5M13 17.5l-1 2.5M17 17.5l-1 2.5" />
        </svg>
      )
    case 'neige':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <path d="M7 14a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.5 8 3.5 3.5 0 0 1 17 14.7" />
          <path d="M9 18h.01M13 18h.01M17 18h.01M11 21h.01M15 21h.01" strokeWidth="2.6" />
        </svg>
      )
    case 'orage':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <path d="M7 14a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.5 8 3.5 3.5 0 0 1 17 14.7" />
          <path d="M12.5 13l-2 4h3l-2 4" />
        </svg>
      )
    case 'brouillard':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <path d="M4 9h16M3 13h18M5 17h14" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <path d="M7 17a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.5 11 3.5 3.5 0 0 1 17.5 17z" />
        </svg>
      )
  }
}

/** La météo du jour et la qualité de l'air, sous l'heure de Grenoble. */
export function Conditions() {
  const [data, setData] = useState<Data | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let controller = new AbortController()
    const load = () => {
      controller.abort()
      controller = new AbortController()
      fetchConditions(controller.signal)
        .then((d) => {
          setData(d)
          setFailed(false)
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== 'AbortError') setFailed(true)
        })
    }
    load()
    const id = window.setInterval(load, REFRESH_MS)
    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [])

  if (failed && !data) return <p className="conditions conditions-empty">Météo indisponible</p>
  if (!data) return <p className="conditions conditions-empty">Météo…</p>

  return (
    <p className="conditions">
      <span className="cond-weather" title={data.label}>
        <Icon name={data.icon} isDay={data.isDay} />
        <strong>{data.temperature}°</strong>
        <span className="cond-range">
          {data.min}° / {data.max}°
        </span>
        {data.rainChance !== null && data.rainChance >= 30 && (
          <span className="cond-rain">pluie {data.rainChance} %</span>
        )}
      </span>
      {data.airLabel && data.airLevel && (
        <span className={`cond-air air-${data.airLevel}`} title={`Indice européen : ${data.aqi}`}>
          <span className="cond-air-dot" aria-hidden="true" />
          {data.airLabel}
        </span>
      )}
    </p>
  )
}
