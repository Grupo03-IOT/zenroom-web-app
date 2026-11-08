import { request } from '../../../shared/api/http'

/** Modelo que usa la pantalla de Análisis. Cloud lo entrega como `measures`; `loadAnalytics` lo adapta. */
export interface RoomAnalytics {
  roomId: string; from: string; to: string; sampleSize: number;
  noiseVsOccupancy: { coefficient: number | null; strength: string; sampleSize: number; reliable: boolean };
  thermalDrift: { slopePerHour: number | null; rSquared: number | null; sampleSize: number; reliable: boolean };
  indoorVsOutdoor: { coefficient: number | null; strength: string; sampleSize: number; reliable: boolean };
  noiseAnomalies: string[];
}

interface CloudMeasure { verdict: string; value?: number | null; confidence?: { sampleSize: number; rSquared?: number | null } }
interface CloudAnalytics {
  roomId: string; period: string; from: string; to: string;
  dataQuality: { receivedMinutes: number };
  measures: { noiseVsOccupancy: CloudMeasure; thermalDrift: CloudMeasure; indoorVsOutdoor: CloudMeasure };
  noiseEpisodes?: { worst?: { from: string }[] };
}

/** Cloud acepta un día (YYYY-MM-DD), una semana ISO (YYYY-Www) o un mes (YYYY-MM). */
export function cloudPeriod(reference: Date, days: number): string {
  if (days > 7) return `${reference.getUTCFullYear()}-${String(reference.getUTCMonth() + 1).padStart(2, '0')}`
  const thursday = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()))
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7))
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((thursday.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function measure(item: CloudMeasure) {
  const conclusive = item.verdict === 'conclusive' && item.value != null
  return { coefficient: conclusive ? item.value ?? null : null, strength: item.verdict, sampleSize: item.confidence?.sampleSize ?? 0, reliable: conclusive }
}

export async function loadAnalytics(token: string, roomId: string, reference: Date, days: number): Promise<RoomAnalytics> {
  const period = cloudPeriod(reference, days)
  const body = await request<CloudAnalytics>(`/api/v1/insights/rooms/${roomId}?period=${encodeURIComponent(period)}`, {}, token)
  const drift = body.measures.thermalDrift
  return {
    roomId: body.roomId, from: body.from, to: body.to,
    sampleSize: body.dataQuality.receivedMinutes,
    noiseVsOccupancy: measure(body.measures.noiseVsOccupancy),
    thermalDrift: { slopePerHour: drift.verdict === 'conclusive' ? drift.value ?? null : null, rSquared: drift.confidence?.rSquared ?? null, sampleSize: drift.confidence?.sampleSize ?? 0, reliable: drift.verdict === 'conclusive' },
    indoorVsOutdoor: measure(body.measures.indoorVsOutdoor),
    noiseAnomalies: (body.noiseEpisodes?.worst ?? []).map(episode => episode.from),
  }
}

export interface SiteRoomRanking { roomId: string; code: string; dataQuality: { receivedMinutes: number }; noiseDistribution?: { p50: number; p90: number; p95: number; sampleSize: number } }

/** Comparación entre salas del local (US38): ruido P50/P90/P95 y cobertura del periodo. */
export async function loadSiteRanking(token: string, siteId: string, reference: Date, days: number) {
  const period = cloudPeriod(reference, days)
  const body = await request<{ rooms: SiteRoomRanking[] }>(`/api/v1/insights/sites/${siteId}/rooms?period=${encodeURIComponent(period)}`, {}, token)
  return body.rooms
}
