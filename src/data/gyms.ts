export type Brand = 'onair' | 'fitnesspark' | 'basicfit'

/** Plage d'ouverture en heures décimales (ex. 6 → 6h00, 22.5 → 22h30). */
export interface OpeningRange {
  open: number
  close: number
}

export interface OpeningHours {
  weekday: OpeningRange | 'always'
  weekend: OpeningRange | 'always'
}

export interface Gym {
  id: string
  brand: Brand
  name: string
  address: string
  city: string
  /** [longitude, latitude] — positions approximatives, à affiner (voir README). */
  coords: [number, number]
  hours: OpeningHours
  /**
   * Fréquentation relative de la salle par rapport à la moyenne (1 = moyenne).
   * Sert au modèle d'estimation tant qu'il n'y a pas assez de signalements.
   */
  popularity: number
}

export const BRANDS: Record<Brand, { label: string; color: string }> = {
  onair: { label: 'On Air', color: '#7A5CFA' },
  fitnesspark: { label: 'Fitness Park', color: '#1F9E89' },
  basicfit: { label: 'Basic-Fit', color: '#F26B1D' },
}

const ONAIR_HOURS: OpeningHours = {
  weekday: { open: 6, close: 23 },
  weekend: { open: 6, close: 23 },
}

const FITNESSPARK_HOURS: OpeningHours = {
  weekday: { open: 6, close: 23 },
  weekend: { open: 6, close: 23 },
}

const BASICFIT_HOURS: OpeningHours = {
  weekday: { open: 6, close: 22.5 },
  weekend: { open: 9, close: 19 },
}

const ALWAYS_OPEN: OpeningHours = { weekday: 'always', weekend: 'always' }

export const GYMS: Gym[] = [
  {
    id: 'onair-gambetta',
    brand: 'onair',
    name: 'On Air Gambetta',
    address: '48 boulevard Gambetta, Caserne de Bonne',
    city: 'Grenoble',
    coords: [5.7223, 45.1857],
    hours: ONAIR_HOURS,
    popularity: 1.25,
  },
  {
    id: 'onair-smh',
    brand: 'onair',
    name: 'On Air Saint-Martin-d’Hères',
    address: '76 avenue Gabriel Péri',
    city: 'Saint-Martin-d’Hères',
    coords: [5.7561, 45.1748],
    hours: ONAIR_HOURS,
    popularity: 1.05,
  },
  {
    id: 'fp-grenette',
    brand: 'fitnesspark',
    name: 'Fitness Park Grenette',
    address: '3 place Jean Achard',
    city: 'Grenoble',
    coords: [5.7271, 45.1903],
    hours: FITNESSPARK_HOURS,
    popularity: 1.15,
  },
  {
    id: 'fp-meylan',
    brand: 'fitnesspark',
    name: 'Fitness Park Meylan',
    address: '5 boulevard des Alpes',
    city: 'Meylan',
    coords: [5.7795, 45.2093],
    hours: FITNESSPARK_HOURS,
    popularity: 0.85,
  },
  {
    id: 'fp-neyrpic',
    brand: 'fitnesspark',
    name: 'Fitness Park Neyrpic',
    address: 'Centre commercial Neyrpic',
    city: 'Saint-Martin-d’Hères',
    coords: [5.7612, 45.1829],
    hours: FITNESSPARK_HOURS,
    popularity: 1.0,
  },
  {
    id: 'fp-comboire',
    brand: 'fitnesspark',
    name: 'Fitness Park Comboire',
    address: '5 rue du Grand Veymont',
    city: 'Échirolles',
    coords: [5.7048, 45.1519],
    hours: FITNESSPARK_HOURS,
    popularity: 0.9,
  },
  {
    id: 'bf-liberation',
    brand: 'basicfit',
    name: 'Basic-Fit Libération',
    address: '171 cours de la Libération',
    city: 'Grenoble',
    coords: [5.7149, 45.1722],
    hours: BASICFIT_HOURS,
    popularity: 1.1,
  },
  {
    id: 'bf-grand-place',
    brand: 'basicfit',
    name: 'Basic-Fit Grand Place',
    address: '55 Grand Place',
    city: 'Échirolles',
    coords: [5.7302, 45.1578],
    hours: BASICFIT_HOURS,
    popularity: 0.95,
  },
  {
    id: 'bf-grand-veymont',
    brand: 'basicfit',
    name: 'Basic-Fit Grand Veymont 24/7',
    address: '4 rue du Grand Veymont',
    city: 'Échirolles',
    coords: [5.7037, 45.1526],
    hours: ALWAYS_OPEN,
    popularity: 0.8,
  },
  {
    id: 'bf-fontaine',
    brand: 'basicfit',
    name: 'Basic-Fit Fontaine',
    address: '145 boulevard Paul Langevin',
    city: 'Fontaine',
    coords: [5.6858, 45.1931],
    hours: BASICFIT_HOURS,
    popularity: 0.9,
  },
  {
    id: 'bf-saint-egreve',
    brand: 'basicfit',
    name: 'Basic-Fit Saint-Égrève',
    address: '23 rue René Cassin',
    city: 'Saint-Égrève',
    coords: [5.6783, 45.2297],
    hours: BASICFIT_HOURS,
    popularity: 0.75,
  },
]
