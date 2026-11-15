import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BRANDS, type Gym } from '../data/gyms'
import type { Occupancy } from '../lib/occupancy'

interface Props {
  gyms: Gym[]
  occupancy: Record<string, Occupancy | null>
  selectedId: string | null
  userPosition: [number, number] | null
  locationTarget: [number, number] | null
  onSelect: (id: string) => void
}

/** Leaflet attend [latitude, longitude] ; nos données sont en [longitude, latitude]. */
const toLatLng = ([lng, lat]: [number, number]): L.LatLngTuple => [lat, lng]

const isMobile = () => window.matchMedia('(max-width: 820px)').matches
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function markerIcon(gym: Gym, occ: Occupancy | null, selected: boolean): L.DivIcon {
  const classes = ['marker', selected ? 'is-selected' : '', occ ? `status-${occ.status}` : 'is-closed']
  const label = `${gym.name} : ${occ ? `${occ.percent} % de remplissage` : 'fermée'}`
  return L.divIcon({
    className: 'marker-host',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `
      <span class="${classes.join(' ')}" aria-label="${escapeHtml(label)}"
        style="--brand:${BRANDS[gym.brand].color};--fill:${occ ? occ.percent : 0}%">
        <span class="marker-pill"><span class="marker-fill"></span></span>
        <span class="marker-value">${occ ? `${occ.percent}<small>%</small>` : 'Fermé'}</span>
        ${occ?.source === 'live' ? '<span class="marker-live" aria-hidden="true"></span>' : ''}
        <span class="marker-name">${escapeHtml(gym.name)}</span>
      </span>`,
  })
}

/** Marges qui laissent la place au panneau (à gauche sur ordinateur, en bas sur mobile). */
function framePadding(): { topLeft: L.PointTuple; bottomRight: L.PointTuple } {
  if (isMobile()) return { topLeft: [40, 200], bottomRight: [70, Math.round(window.innerHeight * 0.42)] }
  return { topLeft: [470, 90], bottomRight: [90, 60] }
}

export function MapView({ gyms, occupancy, selectedId, userPosition, locationTarget, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const userMarkerRef = useRef<L.Marker | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Création de la carte (une seule fois)
  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { zoomControl: false })
    const locationPane = map.createPane('user-location')
    locationPane.style.zIndex = '625'
    locationPane.style.pointerEvents = 'none'
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    map.attributionControl.setPrefix(false)

    const bounds = L.latLngBounds(gyms.map((g) => toLatLng(g.coords)))
    const { topLeft, bottomRight } = framePadding()
    map.fitBounds(bounds, { paddingTopLeft: topLeft, paddingBottomRight: bottomRight })

    // Le conteneur peut changer de taille (rotation, barre d'adresse mobile)
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)

    mapRef.current = map
    const markers = markersRef.current
    return () => {
      observer.disconnect()
      markers.clear()
      userMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // Le cadrage initial ne dépend que de la liste au premier affichage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Marqueurs : création, mise à jour du taux, suppression selon le filtre
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<string>()
    for (const gym of gyms) {
      seen.add(gym.id)
      const icon = markerIcon(gym, occupancy[gym.id] ?? null, gym.id === selectedId)
      let marker = markersRef.current.get(gym.id)
      if (!marker) {
        marker = L.marker(toLatLng(gym.coords), { icon, keyboard: true, title: gym.name })
        marker.on('click', () => onSelectRef.current(gym.id))
        marker.on('keypress', (e) => {
          const key = (e.originalEvent as KeyboardEvent).key
          if (key === 'Enter' || key === ' ') onSelectRef.current(gym.id)
        })
        marker.addTo(map)
        markersRef.current.set(gym.id, marker)
      } else {
        marker.setIcon(icon)
      }
      marker.setZIndexOffset(gym.id === selectedId ? 1000 : 0)
    }
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }
  }, [gyms, occupancy, selectedId])

  // Centre la carte sur la salle choisie, dans la partie encore visible
  useEffect(() => {
    const map = mapRef.current
    const gym = gyms.find((g) => g.id === selectedId)
    if (!map || !gym) return
    const zoom = Math.max(map.getZoom(), 14)
    const h = window.innerHeight
    const offset: L.PointTuple = isMobile() ? [0, (140 + h * 0.3) / 2 - h / 2] : [200, 0]
    // On vise un point décalé pour que la salle apparaisse là où l'œil regarde
    const target = map.unproject(map.project(toLatLng(gym.coords), zoom).subtract(offset), zoom)
    if (prefersReducedMotion()) map.setView(target, zoom)
    else map.flyTo(target, zoom, { duration: 0.8 })
  }, [selectedId, gyms])

  // Position de l'utilisateur
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userPosition) return
    const latLng = toLatLng(userPosition)
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(latLng, {
        pane: 'user-location',
        icon: L.divIcon({ className: 'user-host', html: '<span class="user-dot"></span>', iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
      }).addTo(map)
    } else {
      userMarkerRef.current.setLatLng(latLng)
    }
  }, [userPosition])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !locationTarget) return
    // Keep the user at the centre of the unobstructed map, with nearby gyms
    // in view. Mirroring the bounds around the user preserves that centre.
    const user = L.latLng(toLatLng(locationTarget))
    const nearest = gyms
      .map((gym) => L.latLng(toLatLng(gym.coords)))
      .sort((a, b) => user.distanceTo(a) - user.distanceTo(b))
      .slice(0, 3)
    const bounds = L.latLngBounds([user])
    for (const gym of nearest) {
      bounds.extend(gym)
      bounds.extend([2 * user.lat - gym.lat, 2 * user.lng - gym.lng])
    }
    const { topLeft, bottomRight } = framePadding()
    map.stop()
    map.fitBounds(bounds, {
      paddingTopLeft: topLeft,
      paddingBottomRight: bottomRight,
      maxZoom: 14,
      animate: !prefersReducedMotion(),
      duration: 0.35,
    })
  }, [locationTarget, gyms])

  return <div ref={containerRef} className="map" role="region" aria-label="Carte des salles" />
}
