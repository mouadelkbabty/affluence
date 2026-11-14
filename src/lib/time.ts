export const TIME_ZONE = 'Europe/Paris'

export interface LocalTime {
  /** 0 = dimanche … 6 = samedi */
  day: number
  /** Heure décimale, ex. 18.5 pour 18h30 */
  hour: number
}

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Jour et heure à Grenoble, quel que soit le fuseau de l'appareil. */
export function localTime(date: Date): LocalTime {
  const parts = partsFormatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  return {
    day: WEEKDAYS.indexOf(get('weekday')),
    hour: Number(get('hour')) + Number(get('minute')) / 60,
  }
}

export function isWeekend(day: number): boolean {
  return day === 0 || day === 6
}

const clockFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})

export function formatClock(date: Date): string {
  return clockFormatter.format(date)
}

/** 18.5 → « 18h30 », 7 → « 7h » */
export function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24
  const m = Math.round((hour - Math.floor(hour)) * 60)
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  weekday: 'long',
})

export function formatDay(date: Date): string {
  return dayFormatter.format(date)
}

export function minutesAgo(from: Date, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - from.getTime()) / 60000))
}
