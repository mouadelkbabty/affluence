import type { Occupancy } from '../lib/occupancy'

/** La jauge « liquide » : le niveau monte avec le remplissage de la salle. */
export function Gauge({ occ }: { occ: Occupancy | null }) {
  const percent = occ?.percent ?? 0
  return (
    <div
      className={`gauge ${occ ? `status-${occ.status}` : 'is-closed'}`}
      style={{ ['--fill' as string]: `${percent}%` }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Remplissage de la salle"
    >
      <div className="gauge-liquid">
        <svg className="gauge-wave" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 6 Q 15 0 30 6 T 60 6 T 90 6 T 120 6 V12 H0 Z" />
        </svg>
      </div>
      <div className="gauge-ticks" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
