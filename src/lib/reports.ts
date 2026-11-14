import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NTFY_BASE, NTFY_TOPIC, ntfyMessage, parseNtfyEvent } from './ntfy'
import { REPORT_WINDOW_MIN, type CrowdLevel, type Report } from './occupancy'

/**
 * supabase : base partagée configurée par variables d'environnement
 * ntfy     : canal public partagé (par défaut, aucune configuration)
 * local    : repli si le navigateur ne gère pas le temps réel
 */
export type Backend = 'supabase' | 'ntfy' | 'local'
export type StoreMode = 'partage' | 'local'

type Listener = (reports: Report[]) => void

interface Row {
  gym_id: string
  level: CrowdLevel
  created_at: string
}

const LOCAL_KEY = 'affluence.reports'
const COOLDOWN_KEY = 'affluence.lastReport'
/** Un signalement par salle toutes les 10 minutes et par appareil. */
export const COOLDOWN_MIN = 10

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

const backend: Backend = supabase
  ? 'supabase'
  : typeof EventSource !== 'undefined'
    ? 'ntfy'
    : 'local'

export const storeMode: StoreMode = backend === 'local' ? 'local' : 'partage'

let reports: Report[] = []
const listeners = new Set<Listener>()

function emit() {
  const cutoff = Date.now() - REPORT_WINDOW_MIN * 60000
  reports = reports.filter((r) => r.createdAt.getTime() >= cutoff)
  for (const l of listeners) l(reports)
}

function fromRow(row: Row): Report {
  return { gymId: row.gym_id, level: row.level, createdAt: new Date(row.created_at) }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function loadLocal(): Report[] {
  const raw = safeStorage()?.getItem(LOCAL_KEY)
  if (!raw) return []
  try {
    return (JSON.parse(raw) as Row[]).map(fromRow)
  } catch {
    return []
  }
}

function saveLocal() {
  const rows: Row[] = reports.map((r) => ({
    gym_id: r.gymId,
    level: r.level,
    created_at: r.createdAt.toISOString(),
  }))
  safeStorage()?.setItem(LOCAL_KEY, JSON.stringify(rows))
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('affluence') : null

let started = false

async function start() {
  if (started) return
  started = true

  if (backend === 'ntfy') {
    const seen = new Set<string>()
    const url = `${NTFY_BASE}/${encodeURIComponent(NTFY_TOPIC)}/sse?since=${REPORT_WINDOW_MIN}m`
    // EventSource se reconnecte tout seul en cas de coupure réseau
    const source = new EventSource(url)
    source.onmessage = (e: MessageEvent<string>) => {
      const report = parseNtfyEvent(e.data)
      if (!report || seen.has(report.id)) return
      seen.add(report.id)
      reports = [...reports, report]
      emit()
    }
    emit()
    return
  }

  if (!supabase) {
    reports = loadLocal()
    channel?.addEventListener('message', () => {
      reports = loadLocal()
      emit()
    })
    emit()
    return
  }

  const since = new Date(Date.now() - REPORT_WINDOW_MIN * 60000).toISOString()
  const { data } = await supabase
    .from('reports')
    .select('gym_id, level, created_at')
    .gte('created_at', since)
  reports = ((data ?? []) as Row[]).map(fromRow)
  emit()

  supabase
    .channel('reports-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
      reports = [...reports, fromRow(payload.new as Row)]
      emit()
    })
    .subscribe()
}

export function subscribeReports(listener: Listener): () => void {
  listeners.add(listener)
  void start()
  listener(reports)
  // Les signalements vieillissent : on recalcule chaque minute.
  const timer = window.setInterval(emit, 60000)
  return () => {
    listeners.delete(listener)
    window.clearInterval(timer)
  }
}

function cooldowns(): Record<string, number> {
  try {
    return JSON.parse(safeStorage()?.getItem(COOLDOWN_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/** Minutes à attendre avant de pouvoir signaler à nouveau cette salle (0 si possible). */
export function cooldownLeft(gymId: string, now = Date.now()): number {
  const last = cooldowns()[gymId]
  if (!last) return 0
  return Math.max(0, Math.ceil(COOLDOWN_MIN - (now - last) / 60000))
}

export async function addReport(gymId: string, level: CrowdLevel): Promise<void> {
  const createdAt = new Date()
  const startCooldown = () => {
    const map = cooldowns()
    map[gymId] = createdAt.getTime()
    safeStorage()?.setItem(COOLDOWN_KEY, JSON.stringify(map))
  }

  if (supabase) {
    const { error } = await supabase.from('reports').insert({ gym_id: gymId, level })
    if (error) throw new Error(error.message)
    startCooldown()
    return // le flux temps réel ajoutera le signalement
  }

  if (backend === 'ntfy') {
    const res = await fetch(`${NTFY_BASE}/${encodeURIComponent(NTFY_TOPIC)}`, {
      method: 'POST',
      body: ntfyMessage(gymId, level),
    })
    if (!res.ok) throw new Error(`le serveur a répondu ${res.status}`)
    startCooldown()
    return // le flux temps réel renvoie le signalement à tous les appareils, y compris celui-ci
  }

  startCooldown()
  reports = [...reports, { gymId, level, createdAt }]
  saveLocal()
  channel?.postMessage('update')
  emit()
}
