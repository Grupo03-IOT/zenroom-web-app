export interface Site { id: string; code: string; name: string; address: string; timezone: string }
export interface RoomType { id: string; siteId: string; code: string; displayName: string; description: string }
export interface Latest { ts: string; laeq: number | null; tempC: number | null; rhPct: number | null; ppd: number | null; thermalVerdict: string | null; occupiedPct: number | null; complete: boolean }
export interface Room { id: string; code: string; displayName: string; floor: string; capacity: number | null; areaM2: number | null; active: boolean; classified: boolean; latest: Latest | null; roomTypeId?: string }
export interface Reading {
  roomId: string; ts: string; periodS: number;
  acoustic?: { laeq?: number; l10?: number; l50?: number; l90?: number; lmax?: number; lmin?: number };
  climate?: { tempC?: number; rhPct?: number };
  comfort?: { pmv?: number; ppd?: number; verdict?: string };
  occupancy?: { occupiedPct?: number; transitions?: number };
  device?: { code?: string; fwVersion?: string; lastSeen?: string; lostBatches?: number };
}
export type RoomStatus = 'optimal' | 'moderate' | 'bad' | 'no-data'
export function roomStatus(room: Room): RoomStatus {
  if (!room.latest) return 'no-data'
  if ((room.latest.laeq ?? 0) >= 60 || (room.latest.ppd ?? 0) >= 20) return 'bad'
  if ((room.latest.laeq ?? 0) >= 50 || (room.latest.tempC ?? 0) >= 25) return 'moderate'
  return 'optimal'
}
