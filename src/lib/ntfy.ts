import { GYMS } from '../data/gyms'
import type { CrowdLevel, Report } from './occupancy'

/**
 * Canal partagé sur ntfy.sh : un service public et gratuit de messages en temps réel,
 * sans compte ni clé. Chaque signalement est un petit message JSON publié sur un « topic ».
 */
export const NTFY_BASE = (import.meta.env.VITE_NTFY_URL as string | undefined) ?? 'https://ntfy.sh'
export const NTFY_TOPIC =
  (import.meta.env.VITE_NTFY_TOPIC as string | undefined) ?? 'affluence-grenoble-signalements-v1'

const LEVELS: CrowdLevel[] = ['calme', 'normal', 'plein']
const GYM_IDS = new Set(GYMS.map((g) => g.id))

export interface NtfyReport extends Report {
  id: string
}

/** Transforme un événement ntfy en signalement, ou null s'il n'est pas valide. */
export function parseNtfyEvent(raw: string): NtfyReport | null {
  try {
    const event = JSON.parse(raw) as { id?: string; time?: number; event?: string; message?: string }
    if (event.event !== 'message' || !event.id || !event.time || !event.message) return null
    const body = JSON.parse(event.message) as { gym?: string; level?: string }
    if (!body.gym || !GYM_IDS.has(body.gym)) return null
    if (!LEVELS.includes(body.level as CrowdLevel)) return null
    return {
      id: event.id,
      gymId: body.gym,
      level: body.level as CrowdLevel,
      createdAt: new Date(event.time * 1000),
    }
  } catch {
    return null
  }
}

export function ntfyMessage(gymId: string, level: CrowdLevel): string {
  return JSON.stringify({ gym: gymId, level })
}
