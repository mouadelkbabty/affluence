import { describe, expect, it } from 'vitest'
import { ntfyMessage, parseNtfyEvent } from './ntfy'

const event = (message: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ id: 'abc123', time: 1794600000, event: 'message', topic: 't', message, ...extra })

describe('signalements ntfy', () => {
  it('lit un signalement valide', () => {
    const report = parseNtfyEvent(event(ntfyMessage('onair-gambetta', 'plein')))
    expect(report).toEqual({
      id: 'abc123',
      gymId: 'onair-gambetta',
      level: 'plein',
      createdAt: new Date(1794600000 * 1000),
    })
  })

  it('ignore les événements de connexion', () => {
    expect(parseNtfyEvent(JSON.stringify({ id: 'x', time: 1, event: 'open' }))).toBeNull()
  })

  it('ignore une salle inconnue ou un niveau inventé', () => {
    expect(parseNtfyEvent(event(ntfyMessage('salle-inconnue', 'calme')))).toBeNull()
    expect(parseNtfyEvent(event(JSON.stringify({ gym: 'onair-gambetta', level: 'vide' })))).toBeNull()
  })

  it('ignore un message qui n’est pas du JSON', () => {
    expect(parseNtfyEvent(event('bonjour'))).toBeNull()
    expect(parseNtfyEvent('pas du json')).toBeNull()
  })
})
