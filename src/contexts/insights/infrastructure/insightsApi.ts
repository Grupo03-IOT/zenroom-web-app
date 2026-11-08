import { request } from '../../../shared/api/http'

export interface Measure {
  verdict: 'conclusive' | 'not_enough_evidence' | 'no_data'
  code?: string
  value?: number
  unit?: string
  direction?: string
  confidence: { sampleSize: number; rSquared?: number }
}

// Cloud devuelve conclusiones por período y la evidencia de cada cálculo.
export interface RoomAnalytics {
  roomId: string
  period: string
  from: string
  to: string
  timezone: string
  dataQuality: { expectedMinutes: number; receivedMinutes: number; coveragePct: number }
  findings: { code: string; value: number; unit: string; direction?: string }[]
  measures: { noiseVsOccupancy: Measure; thermalDrift: Measure; indoorVsOutdoor: Measure }
  noiseEpisodes: { total: number; worst: { from: string; to: string; minutes: number; peakLaeq: number; peakAt: string }[] }
  noiseDistribution?: { p50: number; p90: number; p95: number; sampleSize: number; threshold?: number; minutesOver?: number; pctOver?: number }
  comparison?: { previousPeriod: string; pctOverDelta?: number; p90Delta: number }
}

export function loadAnalytics(token: string, roomId: string, period: string) {
  return request<RoomAnalytics>(`/api/v1/insights/rooms/${roomId}?period=${encodeURIComponent(period)}`, {}, token)
}
