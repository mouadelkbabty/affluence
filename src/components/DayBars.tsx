import { statusOf, type CurvePoint } from '../lib/occupancy'
import { formatHour } from '../lib/time'

interface Props {
  points: CurvePoint[]
  nowHour: number
  best: { hour: number; percent: number } | null
}

const LABELS = [6, 9, 12, 15, 18, 21]

/** Fréquentation typique de la journée, demi-heure par demi-heure. */
export function DayBars({ points, nowHour, best }: Props) {
  const visible = points.filter((p) => p.hour >= 6)
  return (
    <figure className="daybars">
      <div className="daybars-plot" role="img" aria-label="Fréquentation habituelle aujourd’hui">
        {visible.map((p) => {
          const isNow = nowHour >= p.hour && nowHour < p.hour + 0.5
          const isPast = p.hour + 0.5 <= nowHour
          const isBest = best?.hour === p.hour
          return (
            <span
              key={p.hour}
              className={[
                'bar',
                p.percent === null ? 'is-closed' : `status-${statusOf(p.percent)}`,
                isPast ? 'is-past' : '',
                isNow ? 'is-now' : '',
                isBest ? 'is-best' : '',
              ].join(' ')}
              style={{ ['--h' as string]: `${p.percent ?? 4}%` }}
              title={`${formatHour(p.hour)} : ${p.percent === null ? 'fermé' : `${p.percent} %`}`}
            />
          )
        })}
      </div>
      <div className="daybars-axis" aria-hidden="true">
        {LABELS.map((h) => (
          <span key={h} style={{ ['--x' as string]: `${((h - 6) / 18) * 100}%` }}>
            {h}h
          </span>
        ))}
      </div>
    </figure>
  )
}
