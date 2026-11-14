import { describe, expect, it } from 'vitest'
import { describeAir, describeWeather } from './weather'

describe('météo', () => {
  it('traduit les codes WMO', () => {
    expect(describeWeather(0).label).toBe('Ciel dégagé')
    expect(describeWeather(63).icon).toBe('pluie')
    expect(describeWeather(73).icon).toBe('neige')
    expect(describeWeather(95).label).toBe('Orage')
  })
  it('classe la qualité de l’air (indice européen)', () => {
    expect(describeAir(15).level).toBe('bon')
    expect(describeAir(35).level).toBe('correct')
    expect(describeAir(55).level).toBe('moyen')
    expect(describeAir(90).label).toBe('Air mauvais')
  })
})
