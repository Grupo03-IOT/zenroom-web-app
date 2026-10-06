import { request } from '../../../shared/api/http'

export interface RoomAnalytics {
  roomId: string; from: string; to: string; sampleSize: number;
  noiseVsOccupancy: { coefficient: number | null; strength: string; sampleSize: number; reliable: boolean };
  thermalDrift: { slopePerHour: number | null; rSquared: number | null; sampleSize: number; reliable: boolean };
  indoorVsOutdoor: { coefficient: number | null; strength: string; sampleSize: number; reliable: boolean };
  noiseAnomalies: string[];
}
export function loadAnalytics(token: string, roomId: string, from: string, to: string) {
  return request<RoomAnalytics>(`/api/v1/insights/rooms/${roomId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, token)
}
