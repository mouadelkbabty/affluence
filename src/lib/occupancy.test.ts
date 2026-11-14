import { describe, expect, it } from 'vitest'
import { GYMS } from '../data/gyms'
import {
  bestSlot,
  dayCurve,
  isOpenAt,
  modelPercentAt,
  occupancyNow,
  statusOf,
  type Report,
} from './occupancy'
import { localTime } from './time'

const onair = GYMS.find((g) => g.id === 'onair-gambetta')!
const basicfit = GYMS.find((g) => g.id === 'bf-liberation')!
const allNight = GYMS.find((g) => g.id === 'bf-grand-veymont')!

// Mardi 17 novembre 2026, 18h30 à Paris (UTC+1)
const tuesdayEvening = new Date('2026-11-17T17:30:00Z')

describe('heure locale', () => {
  it('donne le jour et l’heure de Paris', () => {
    expect(localTime(tuesdayEvening)).toEqual({ day: 2, hour: 18.5 })
  })
})

describe('horaires', () => {
  it('ferme Basic-Fit le dimanche soir', () => {
    expect(isOpenAt(basicfit, 0, 20)).toBe(false)
    expect(isOpenAt(basicfit, 0, 10)).toBe(true)
  })
  it('garde la salle 24/7 ouverte la nuit', () => {
    expect(isOpenAt(allNight, 3, 3)).toBe(true)
  })
})

describe('modèle', () => {
  it('est plus chargé à 19h qu’à 10h en semaine', () => {
    expect(modelPercentAt(onair, 2, 19)!).toBeGreaterThan(modelPercentAt(onair, 2, 10)!)
  })
  it('renvoie null quand la salle est fermée', () => {
    expect(modelPercentAt(onair, 2, 3)).toBeNull()
  })
  it('reste entre 3 et 98 %', () => {
    for (const p of dayCurve(onair, 1)) {
      if (p.percent !== null) {
        expect(p.percent).toBeGreaterThanOrEqual(3)
        expect(p.percent).toBeLessThanOrEqual(98)
      }
    }
  })
})

describe('signalements', () => {
  it('sans signalement, affiche une estimation', () => {
    const occ = occupancyNow(onair, [], tuesdayEvening)!
    expect(occ.source).toBe('estimation')
  })

  it('un signalement « calme » récent fait baisser le taux', () => {
    const model = occupancyNow(onair, [], tuesdayEvening)!.percent
    const reports: Report[] = [
      { gymId: onair.id, level: 'calme', createdAt: new Date(tuesdayEvening.getTime() - 2 * 60000) },
    ]
    const occ = occupancyNow(onair, reports, tuesdayEvening)!
    expect(occ.source).toBe('live')
    expect(occ.percent).toBeLessThan(model)
  })

  it('ignore les signalements de plus d’une heure', () => {
    const reports: Report[] = [
      { gymId: onair.id, level: 'calme', createdAt: new Date(tuesdayEvening.getTime() - 90 * 60000) },
    ]
    expect(occupancyNow(onair, reports, tuesdayEvening)!.source).toBe('estimation')
  })
})

describe('meilleur créneau', () => {
  it('propose un créneau plus calme que maintenant', () => {
    const now = occupancyNow(onair, [], tuesdayEvening)!.percent
    const best = bestSlot(onair, tuesdayEvening)!
    expect(best.percent).toBeLessThanOrEqual(now)
    expect(best.hour).toBeGreaterThan(18.5)
  })
})

describe('statut', () => {
  it('classe les taux', () => {
    expect(statusOf(25)).toBe('calme')
    expect(statusOf(55)).toBe('modere')
    expect(statusOf(85)).toBe('bonde')
  })
})
