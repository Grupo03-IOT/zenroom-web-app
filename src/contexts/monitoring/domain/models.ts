export interface Site { id: string; code: string; name: string; address: string; timezone: string }
export interface RoomType { id: string; siteId: string; code: string; displayName: string; description: string }
export interface Latest { ts: string; laeq: number | null; tempC: number | null; rhPct: number | null; ppd: number | null; thermalVerdict: string | null; occupiedPct: number | null; complete: boolean }
export interface Room { id: string; code: string; displayName: string; floor: string | null; capacity: number | null; areaM2: number | null; active: boolean; classified: boolean; latest: Latest | null; siteId: string; roomTypeId?: string; roomType?: { code: string; displayName: string } }
// El cloud publica conectividad de módulos y gateways en recursos separados.
export interface Device { id: string; code: string; roomId: string; fwVersion?: string; lastSeen?: string; lastSeq?: number; lostBatches: number; silent: boolean }
export interface Gateway { id: string; code: string; siteId: string; version?: string; lastSeen?: string; pendingUpload: number; roomsReported: number; status: 'online' | 'stale' | 'offline' }
export interface Reading {
  roomId: string; ts: string; periodS: number;
  acoustic?: { laeq?: number; l10?: number; l50?: number; l90?: number; lmax?: number; lmin?: number };
  climate?: { tempC?: number; rhPct?: number };
  comfort?: { pmv?: number; ppd?: number; verdict?: string };
  occupancy?: { occupiedPct?: number; transitions?: number };
  device?: { code?: string; fwVersion?: string; lastSeen?: string; lostBatches?: number };
}
export type RoomStatus = 'optimal' | 'moderate' | 'bad' | 'no-data'
export function hasRecentReading(room: Room): boolean {
  const age = room.latest ? Date.now() - Date.parse(room.latest.ts) : NaN
  return Number.isFinite(age) && age >= -60000 && age <= 5 * 60000
}
type RoomThreshold = { metric: string; warnValue: number; criticalValue: number | null; enabled: boolean }
// El estado depende de los umbrales configurados en Cloud para el tipo de sala.
export function roomStatus(room: Room, thresholds: readonly RoomThreshold[]): RoomStatus {
  if (!room.latest || !hasRecentReading(room)) return 'no-data'
  const values: Record<string, number | null> = { laeq: room.latest.laeq, ppd: room.latest.ppd, temp_c: room.latest.tempC, occupied_pct: room.latest.occupiedPct }
  const applicable = thresholds.filter(level => level.enabled && values[level.metric] != null)
  if (!applicable.length) return 'no-data'
  if (applicable.some(level => level.criticalValue != null && values[level.metric]! >= level.criticalValue)) return 'bad'
  if (applicable.some(level => values[level.metric]! >= level.warnValue)) return 'moderate'
  return 'optimal'
}
