/** Météo du jour et qualité de l'air à Grenoble, via Open-Meteo (gratuit, sans clé). */

const LAT = 45.188
const LNG = 5.724

export interface Conditions {
  temperature: number
  max: number
  min: number
  rainChance: number | null
  label: string
  icon: WeatherIcon
  isDay: boolean
  aqi: number | null
  airLabel: string | null
  airLevel: AirLevel | null
}

export type WeatherIcon = 'soleil' | 'nuage' | 'brouillard' | 'pluie' | 'neige' | 'orage'
export type AirLevel = 'bon' | 'correct' | 'moyen' | 'mauvais'

/** Codes météo WMO → libellé court et icône. */
export function describeWeather(code: number): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: 'Ciel dégagé', icon: 'soleil' }
  if (code <= 2) return { label: 'Éclaircies', icon: 'soleil' }
  if (code === 3) return { label: 'Couvert', icon: 'nuage' }
  if (code === 45 || code === 48) return { label: 'Brouillard', icon: 'brouillard' }
  if (code >= 51 && code <= 57) return { label: 'Bruine', icon: 'pluie' }
  if (code >= 61 && code <= 67) return { label: 'Pluie', icon: 'pluie' }
  if (code >= 71 && code <= 77) return { label: 'Neige', icon: 'neige' }
  if (code >= 80 && code <= 82) return { label: 'Averses', icon: 'pluie' }
  if (code === 85 || code === 86) return { label: 'Averses de neige', icon: 'neige' }
  if (code >= 95) return { label: 'Orage', icon: 'orage' }
  return { label: 'Variable', icon: 'nuage' }
}

/** Indice européen de qualité de l'air → libellé simple. */
export function describeAir(aqi: number): { label: string; level: AirLevel } {
  if (aqi <= 20) return { label: 'Air bon', level: 'bon' }
  if (aqi <= 40) return { label: 'Air correct', level: 'correct' }
  if (aqi <= 60) return { label: 'Air moyen', level: 'moyen' }
  if (aqi <= 80) return { label: 'Air médiocre', level: 'mauvais' }
  return { label: 'Air mauvais', level: 'mauvais' }
}

interface ForecastResponse {
  current: { temperature_2m: number; weather_code: number; is_day: number }
  daily: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max?: (number | null)[]
  }
}

interface AirResponse {
  current: { european_aqi: number | null }
}

export async function fetchConditions(signal?: AbortSignal): Promise<Conditions> {
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}` +
    '&current=temperature_2m,weather_code,is_day' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=Europe%2FParis&forecast_days=1'
  const airUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LNG}` +
    '&current=european_aqi&timezone=Europe%2FParis'

  const [forecastRes, airRes] = await Promise.all([
    fetch(forecastUrl, { signal }),
    fetch(airUrl, { signal }).catch(() => null),
  ])
  if (!forecastRes.ok) throw new Error(`météo indisponible (${forecastRes.status})`)
  const forecast = (await forecastRes.json()) as ForecastResponse
  const air = airRes?.ok ? ((await airRes.json()) as AirResponse) : null

  const { label, icon } = describeWeather(forecast.current.weather_code)
  const aqi = air?.current.european_aqi ?? null
  const airInfo = aqi === null ? null : describeAir(aqi)

  return {
    temperature: Math.round(forecast.current.temperature_2m),
    max: Math.round(forecast.daily.temperature_2m_max[0]),
    min: Math.round(forecast.daily.temperature_2m_min[0]),
    rainChance: forecast.daily.precipitation_probability_max?.[0] ?? null,
    label,
    icon,
    isDay: forecast.current.is_day === 1,
    aqi: aqi === null ? null : Math.round(aqi),
    airLabel: airInfo?.label ?? null,
    airLevel: airInfo?.level ?? null,
  }
}
