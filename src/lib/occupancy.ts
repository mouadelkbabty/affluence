import type { Gym, OpeningRange } from '../data/gyms'
import { isWeekend, localTime } from './time'

export type CrowdLevel = 'calme' | 'normal' | 'plein'

export interface Report {
  gymId: string
  level: CrowdLevel
  createdAt: Date
}

export type Status = 'calme' | 'modere' | 'bonde'

export interface Occupancy {
  percent: number
  status: Status
  /** 'live' dès qu'au moins un signalement récent pèse dans le calcul */
  source: 'live' | 'estimation'
  reportCount: number
  lastReportAt: Date | null
}

/** Taux de remplissage typique, heure par heure (0 → 23), pour une salle moyenne. */
const WEEKDAY_CURVE = [
  0.04, 0.03, 0.03, 0.03, 0.04, 0.08, 0.18, 0.3, 0.28, 0.22, 0.2, 0.26, 0.52, 0.48, 0.28, 0.26,
  0.34, 0.54, 0.72, 0.76, 0.62, 0.44, 0.24, 0.12,
]
const WEEKEND_CURVE = [
  0.03, 0.02, 0.02, 0.02, 0.02, 0.03, 0.06, 0.1, 0.18, 0.32, 0.55, 0.68, 0.62, 0.45, 0.38, 0.42,
  0.46, 0.48, 0.44, 0.36, 0.26, 0.16, 0.1, 0.06,
]

export const LEVEL_PERCENT: Record<CrowdLevel, number> = {
  calme: 20,
  normal: 55,
  plein: 88,
}

/** Au-delà, un signalement ne compte plus. */
export const REPORT_WINDOW_MIN = 60
/** Demi-vie d'un signalement : son poids est divisé par deux toutes les 20 minutes. */
const REPORT_HALF_LIFE_MIN = 20
/** Poids du modèle face aux signalements (un signalement tout frais pèse 1). */
const MODEL_WEIGHT = 0.6

function rangeFor(gym: Gym, day: number): OpeningRange | 'always' {
  return isWeekend(day) ? gym.hours.weekend : gym.hours.weekday
}

export function isOpenAt(gym: Gym, day: number, hour: number): boolean {
  const range = rangeFor(gym, day)
  if (range === 'always') return true
  return hour >= range.open && hour < range.close
}

export function isOpen(gym: Gym, now: Date): boolean {
  const t = localTime(now)
  return isOpenAt(gym, t.day, t.hour)
}

export function openingLabel(gym: Gym, now: Date): string {
  const t = localTime(now)
  const range = rangeFor(gym, t.day)
  if (range === 'always') return 'Ouvert 24h/24'
  const fmt = (h: number) => {
    const m = Math.round((h % 1) * 60)
    return `${Math.floor(h)}h${m ? String(m).padStart(2, '0') : ''}`
  }
  if (t.hour < range.open) return `Ouvre à ${fmt(range.open)}`
  if (t.hour >= range.close) return 'Fermé pour aujourd’hui'
  return `Ouvert jusqu’à ${fmt(range.close)}`
}

function dayFactor(day: number, hour: number): number {
  if (day === 1) return 1.1 // le lundi, tout le monde reprend
  if (day === 5 && hour >= 17) return 0.82 // vendredi soir plus calme
  return 1
}

/** Estimation du modèle pour un jour et une heure donnés (null si la salle est fermée). */
export function modelPercentAt(gym: Gym, day: number, hour: number): number | null {
  if (!isOpenAt(gym, day, hour)) return null
  const curve = isWeekend(day) ? WEEKEND_CURVE : WEEKDAY_CURVE
  const h0 = Math.floor(hour) % 24
  const h1 = (h0 + 1) % 24
  const frac = hour - Math.floor(hour)
  const base = curve[h0] * (1 - frac) + curve[h1] * frac
  const value = base * gym.popularity * dayFactor(day, hour) * 100
  return Math.min(98, Math.max(3, Math.round(value)))
}

export function statusOf(percent: number): Status {
  if (percent < 40) return 'calme'
  if (percent < 70) return 'modere'
  return 'bonde'
}

export const STATUS_LABEL: Record<Status, string> = {
  calme: 'Calme',
  modere: 'Ça se remplit',
  bonde: 'Bondé',
}

/** Mélange l'estimation du modèle et les signalements récents, pondérés par leur fraîcheur. */
export function occupancyNow(gym: Gym, reports: Report[], now: Date): Occupancy | null {
  const t = localTime(now)
  const model = modelPercentAt(gym, t.day, t.hour)
  if (model === null) return null

  let weightSum = 0
  let valueSum = 0
  let count = 0
  let last: Date | null = null
  for (const r of reports) {
    if (r.gymId !== gym.id) continue
    const age = (now.getTime() - r.createdAt.getTime()) / 60000
    if (age < 0 || age > REPORT_WINDOW_MIN) continue
    const w = Math.pow(0.5, age / REPORT_HALF_LIFE_MIN)
    weightSum += w
    valueSum += w * LEVEL_PERCENT[r.level]
    count += 1
    if (!last || r.createdAt > last) last = r.createdAt
  }

  const percent =
    count === 0
      ? model
      : Math.round((model * MODEL_WEIGHT + valueSum) / (MODEL_WEIGHT + weightSum))

  return {
    percent,
    status: statusOf(percent),
    source: count > 0 ? 'live' : 'estimation',
    reportCount: count,
    lastReportAt: last,
  }
}

export interface CurvePoint {
  hour: number
  percent: number | null
}

/** Courbe de la journée par pas de 30 minutes, de 5h à 23h30. */
export function dayCurve(gym: Gym, day: number): CurvePoint[] {
  const points: CurvePoint[] = []
  for (let h = 5; h <= 23.5; h += 0.5) {
    points.push({ hour: h, percent: modelPercentAt(gym, day, h) })
  }
  return points
}

/** Créneau le plus calme dans les prochaines heures, quand la salle est ouverte. */
export function bestSlot(
  gym: Gym,
  now: Date,
  horizonHours = 6,
): { hour: number; percent: number } | null {
  const t = localTime(now)
  let best: { hour: number; percent: number } | null = null
  const start = Math.ceil(t.hour * 2) / 2
  for (let h = start; h <= Math.min(start + horizonHours, 23.5); h += 0.5) {
    const p = modelPercentAt(gym, t.day, h)
    if (p === null) continue
    if (!best || p < best.percent) best = { hour: h, percent: p }
  }
  return best
}
