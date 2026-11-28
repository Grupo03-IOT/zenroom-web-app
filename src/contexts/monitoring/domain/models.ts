export interface Site { id: string; code: string; name: string; address: string; timezone: string }
export interface RoomType { id: string; siteId: string; code: string; displayName: string; description: string }
export interface TemperatureForecast { probability: number; horizonMin: number; temperatureLimitC: number; modelVersion?: string | null; generatedAt?: string | null }
export interface SensorMetrics { sampledAt: string; movement: boolean; distanceCm: number | null; potentiometer: number; button1: boolean; button2: boolean; button3: boolean }
export interface Latest { ts: string; laeq: number | null; tempC: number | null; rhPct: number | null; ppd: number | null; thermalVerdict: string | null; occupiedPct: number | null; complete: boolean; forecast?: TemperatureForecast | null; sensors?: SensorMetrics | null }
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
  sensors?: SensorMetrics | null;
}
export type RoomStatus = 'optimal' | 'moderate' | 'bad' | 'no-data'
export function noiseReading(latest: Latest | null | undefined) {
  if (latest?.laeq != null) return { value: latest.laeq, unit: 'dB(A)', label: 'Noise (LAeq)', potentiometer: false }
  if (latest?.sensors) return { value: latest.sensors.potentiometer, unit: 'ADC', label: 'Noise', potentiometer: true }
  return { value: null, unit: 'dB(A)', label: 'Noise (LAeq)', potentiometer: false }
}

export function hasRecentReading(room: Room): boolean {
  const age = room.latest ? Date.now() - Date.parse(room.latest.ts) : NaN
  return Number.isFinite(age) && age >= -60000 && age <= 5 * 60000
}
/** Personas en la sala: capacity (1 si no está fijada) con el último dato vigente ocupado, 0 si libre, null si el dato no es vigente. */
export function occupancyPeople(room: Room): number | null {
  if (!room.latest || !hasRecentReading(room) || room.latest.occupiedPct == null) return null
  return room.latest.occupiedPct > 50 ? (room.capacity ?? 1) : 0
}
type RoomThreshold = { metric: string; warnValue: number; criticalValue: number | null; enabled: boolean }
// Una alerta abierta fija un piso: critical -> bad; info/warning -> moderate.
export type AlertFloor = { severity: string } | null | undefined
const rank: Record<RoomStatus, number> = { 'no-data': 0, optimal: 1, moderate: 2, bad: 3 }
function withAlertFloor(status: RoomStatus, alert: AlertFloor): RoomStatus {
  if (!alert) return status
  const floor: RoomStatus = alert.severity === 'critical' ? 'bad' : 'moderate'
  return rank[floor] > rank[status] ? floor : status
}
// El estado depende de los umbrales configurados en Cloud para el tipo de sala y de la alerta abierta de la sala.
export function roomStatus(room: Room, thresholds: readonly RoomThreshold[], openAlert?: AlertFloor): RoomStatus {
  return withAlertFloor(thresholdStatus(room, thresholds), openAlert)
}
function thresholdStatus(room: Room, thresholds: readonly RoomThreshold[]): RoomStatus {
  if (!room.latest || !hasRecentReading(room)) return 'no-data'
  const values: Record<string, number | null> = { laeq: room.latest.laeq, ppd: room.latest.ppd, temp_c: room.latest.tempC, occupied_pct: room.latest.occupiedPct }
  const applicable = thresholds.filter(level => level.enabled && values[level.metric] != null)
  if (!applicable.length) return 'no-data'
  if (applicable.some(level => level.criticalValue != null && values[level.metric]! >= level.criticalValue)) return 'bad'
  if (applicable.some(level => values[level.metric]! >= level.warnValue)) return 'moderate'
  return 'optimal'
}
