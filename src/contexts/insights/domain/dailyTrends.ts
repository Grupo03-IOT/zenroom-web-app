import type { Reading, Room } from '../../monitoring/domain/models'

export type InsightMetric = 'Noise' | 'Temperature' | 'Presence'

export interface DailyTrend {
  date: string
  noise: number | null
  temperature: number | null
  presence: number | null
  samples: number
}

type Totals = { noise: number; noiseCount: number; temperature: number; temperatureCount: number; presence: number; presenceCount: number; samples: number }

export function dailyTrends(readings: Reading[]): DailyTrend[] {
  const days = new Map<string, Totals>()
  for (const reading of readings) {
    const day = reading.ts.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    const totals = days.get(day) ?? { noise: 0, noiseCount: 0, temperature: 0, temperatureCount: 0, presence: 0, presenceCount: 0, samples: 0 }
    totals.samples += 1
    if (Number.isFinite(reading.acoustic?.laeq)) { totals.noise += reading.acoustic!.laeq!; totals.noiseCount += 1 }
    if (Number.isFinite(reading.climate?.tempC)) { totals.temperature += reading.climate!.tempC!; totals.temperatureCount += 1 }
    if (Number.isFinite(reading.occupancy?.occupiedPct)) { totals.presence += reading.occupancy!.occupiedPct!; totals.presenceCount += 1 }
    days.set(day, totals)
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({
    date,
    noise: value.noiseCount ? value.noise / value.noiseCount : null,
    temperature: value.temperatureCount ? value.temperature / value.temperatureCount : null,
    presence: value.presenceCount ? value.presence / value.presenceCount : null,
    samples: value.samples,
  }))
}

const noiseShape = [49, 50, 51, 53, 52, 54, 55, 54, 56, 57, 56, 58, 57, 59, 60, 59, 60, 61, 62, 61, 61, 62, 62, 63, 64, 63, 63, 64, 64, 65]
const temperatureShape = [23.1, 23.3, 23.7, 24.2, 24.9, 25.5, 26, 26.2, 26, 25.5, 24.8, 24.2, 23.8, 23.6, 23.5, 23.9, 24.4, 25.2, 26, 26.7, 26.9, 26.6, 26, 25.3, 24.7, 24.3, 24, 24.3, 25, 26.7]

export function demoDailyTrends(room: Room, days: number, end: Date, sampleSize: number): DailyTrend[] {
  const noiseOffset = (room.latest?.laeq ?? 48) - 63
  const temperatureOffset = (room.latest?.tempC ?? 23) - 26.8
  const presenceBase = room.latest?.occupiedPct ?? 45
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setUTCDate(date.getUTCDate() - (days - index - 1))
    const shapeIndex = Math.round(index / Math.max(1, days - 1) * (noiseShape.length - 1))
    return {
      date: date.toISOString().slice(0, 10),
      noise: noiseShape[shapeIndex] + noiseOffset,
      temperature: temperatureShape[shapeIndex] + temperatureOffset,
      presence: Math.max(0, Math.min(100, presenceBase + Math.sin(index * 0.72) * 12)),
      samples: Math.floor(sampleSize / days) + (index < sampleSize % days ? 1 : 0),
    }
  })
}

export function metricValue(point: DailyTrend, metric: InsightMetric): number | null {
  return metric === 'Noise' ? point.noise : metric === 'Temperature' ? point.temperature : point.presence
}
