import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { BRANDS, type Gym } from '../data/gyms'
import type { Occupancy } from '../lib/occupancy'

// Vite ne copie pas le worker de MapLibre tout seul : on lui donne son URL.
maplibregl.setWorkerUrl(workerUrl)

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

/** Style de secours si le fond de carte ne charge pas (hors ligne, réseau filtré). */
const FALLBACK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [{ id: 'background', type: 'background' as const, paint: { 'background-color': '#EEE4D1' } }],
}

interface Props {
  gyms: Gym[]
  occupancy: Record<string, Occupancy | null>
  selectedId: string | null
  userPosition: [number, number] | null
  onSelect: (id: string) => void
}

/** Teinte légèrement la carte pour qu'elle s'accorde avec l'interface. */
function tuneStyle(map: MlMap) {
  for (const layer of map.getStyle().layers ?? []) {
    try {
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#EEF2F5')
      } else if (layer.type === 'fill' && layer.id.includes('water')) {
        map.setPaintProperty(layer.id, 'fill-color', '#CFE0EE')
      } else if (layer.type === 'fill' && /park|wood|grass|landcover/.test(layer.id)) {
        map.setPaintProperty(layer.id, 'fill-color', '#E1EBE3')
      }
    } catch {
      /* calque non modifiable : on garde le style d'origine */
    }
  }
}

function renderMarker(el: HTMLElement, gym: Gym, occ: Occupancy | null, selected: boolean) {
  const brand = BRANDS[gym.brand]
  el.className = `marker${selected ? ' is-selected' : ''}${occ ? ` status-${occ.status}` : ' is-closed'}`
  el.style.setProperty('--brand', brand.color)
  el.style.setProperty('--fill', occ ? `${occ.percent}%` : '0%')
  el.setAttribute('aria-label', `${gym.name} : ${occ ? `${occ.percent} % de remplissage` : 'fermée'}`)
  el.innerHTML = `
    <span class="marker-pill"><span class="marker-fill"></span></span>
    <span class="marker-value">${occ ? `${occ.percent}<small>%</small>` : 'Fermé'}</span>
    ${occ?.source === 'live' ? '<span class="marker-live" aria-hidden="true"></span>' : ''}
    <span class="marker-name">${gym.name}</span>
  `
}

export function MapView({ gyms, occupancy, selectedId, userPosition, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markersRef = useRef<Map<string, { marker: Marker; el: HTMLButtonElement }>>(new Map())
  const userMarkerRef = useRef<Marker | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [5.735, 45.188],
      zoom: 11.6,
      attributionControl: { compact: true },
    })
    map.on('load', () => tuneStyle(map))
    let fellBack = false
    map.on('error', () => {
      if (!fellBack && !map.isStyleLoaded()) {
        fellBack = true
        map.setStyle(FALLBACK_STYLE)
      }
    })
    // Cadre toutes les salles en laissant la place au panneau
    const frame = () => {
      const bounds = new maplibregl.LngLatBounds()
      for (const g of gyms) bounds.extend(g.coords)
      const mobile = window.matchMedia('(max-width: 820px)').matches
      map.fitBounds(bounds, {
        padding: mobile
          ? { top: 190, bottom: window.innerHeight * 0.42, left: 40, right: 70 }
          : { top: 90, bottom: 60, left: 470, right: 90 },
        animate: false,
      })
    }
    let framed = false
    const observer = new ResizeObserver(() => {
      map.resize()
      if (!framed && containerRef.current!.clientHeight > 0) {
        framed = true
        frame()
      }
    })
    observer.observe(containerRef.current)
    mapRef.current = map
    const markers = markersRef.current
    return () => {
      observer.disconnect()
      markers.clear()
      map.remove()
      mapRef.current = null
    }
    // Le cadrage initial ne dépend que de la liste au premier affichage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Crée ou met à jour les marqueurs
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<string>()
    for (const gym of gyms) {
      seen.add(gym.id)
      let entry = markersRef.current.get(gym.id)
      if (!entry) {
        const el = document.createElement('button')
        el.type = 'button'
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current(gym.id)
        })
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(gym.coords)
          .addTo(map)
        entry = { marker, el }
        markersRef.current.set(gym.id, entry)
      }
      renderMarker(entry.el, gym, occupancy[gym.id] ?? null, gym.id === selectedId)
      entry.el.style.zIndex = gym.id === selectedId ? '10' : ''
    }
    for (const [id, entry] of markersRef.current) {
      if (!seen.has(id)) {
        entry.marker.remove()
        markersRef.current.delete(id)
      }
    }
  }, [gyms, occupancy, selectedId])

  // Centre la carte sur la salle choisie
  useEffect(() => {
    const map = mapRef.current
    const gym = gyms.find((g) => g.id === selectedId)
    if (!map || !gym) return
    const mobile = window.matchMedia('(max-width: 820px)').matches
    map.flyTo({
      center: gym.coords,
      zoom: Math.max(map.getZoom(), 13.4),
      // Place la salle au milieu de la partie de carte encore visible
      offset: mobile ? [0, (140 + window.innerHeight * 0.3) / 2 - window.innerHeight / 2] : [200, 0],
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900,
    })
  }, [selectedId, gyms])

  // Position de l'utilisateur
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userPosition) return
    if (!userMarkerRef.current) {
      const el = document.createElement('span')
      el.className = 'user-dot'
      el.setAttribute('aria-label', 'Votre position')
      userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(userPosition).addTo(map)
      map.flyTo({ center: userPosition, zoom: 13 })
    } else {
      userMarkerRef.current.setLngLat(userPosition)
    }
  }, [userPosition])

  return <div ref={containerRef} className="map" role="region" aria-label="Carte des salles" />
}
