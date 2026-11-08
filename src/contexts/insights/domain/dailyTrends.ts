import type { Reading } from '../../monitoring/domain/models'

export type InsightMetric = 'Noise' | 'Temperature' | 'Presence'

export interface DailyTrend {
  date: string
  noise: number | null
  temperature: number | null
  presence: number | null
  samples: number
}

type Totals = { noise: number; noiseCount: number; temperature: number; temperatureCount: number; presence: number; presenceCount: number; samples: number }

// Agrupa por el día del local y promedia el ruido por energía, ponderando la duración.
export function dailyTrends(readings: Reading[], timezone = 'UTC'): DailyTrend[] {
  const days = new Map<string, Totals>()
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
  for (const reading of readings) {
    const timestamp = new Date(reading.ts)
    if (!Number.isFinite(timestamp.getTime())) continue
    const parts = formatter.formatToParts(timestamp)
    const part = (type: string) => parts.find(item => item.type === type)?.value
    const day = `${part('year')}-${part('month')}-${part('day')}`
    const weight = reading.periodS
    if (!Number.isFinite(weight) || weight <= 0) continue
    const totals = days.get(day) ?? { noise: 0, noiseCount: 0, temperature: 0, temperatureCount: 0, presence: 0, presenceCount: 0, samples: 0 }
    totals.samples += 1
    if (Number.isFinite(reading.acoustic?.laeq)) { totals.noise += 10 ** (reading.acoustic!.laeq! / 10) * weight; totals.noiseCount += weight }
    if (Number.isFinite(reading.climate?.tempC)) { totals.temperature += reading.climate!.tempC! * weight; totals.temperatureCount += weight }
    if (Number.isFinite(reading.occupancy?.occupiedPct)) { totals.presence += reading.occupancy!.occupiedPct! * weight; totals.presenceCount += weight }
    days.set(day, totals)
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({
    date,
    noise: value.noiseCount ? 10 * Math.log10(value.noise / value.noiseCount) : null,
    temperature: value.temperatureCount ? value.temperature / value.temperatureCount : null,
    presence: value.presenceCount ? value.presence / value.presenceCount : null,
    samples: value.samples,
  }))
}

export function metricValue(point: DailyTrend, metric: InsightMetric): number | null {
  return metric === 'Noise' ? point.noise : metric === 'Temperature' ? point.temperature : point.presence
}
