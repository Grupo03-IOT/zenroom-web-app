import type { Room, RoomType, Site, Reading } from '../../contexts/monitoring/domain/models'
import type { EdgeAlert, EdgeRoom, Threshold } from '../../contexts/alerting/domain/models'

export const demoSites: Site[] = [
  { id: 'site-miraflores', code: 'miraflores-hub', name: 'Miraflores Hub', address: 'Miraflores, Lima', timezone: 'America/Lima' },
  { id: 'site-san-isidro', code: 'san-isidro-center', name: 'San Isidro Center', address: 'San Isidro, Lima', timezone: 'America/Lima' },
]
export const demoRoomTypes: RoomType[] = [
  { id: 'type-booth', siteId: 'site-miraflores', code: 'call-booth', displayName: 'Call booth', description: '' },
  { id: 'type-meeting', siteId: 'site-miraflores', code: 'meeting-room', displayName: 'Meeting room', description: '' },
  { id: 'type-open', siteId: 'site-miraflores', code: 'open-area', displayName: 'Open area', description: '' },
]
const latest = (laeq: number, tempC: number, occupiedPct: number, ppd = 8): Room['latest'] => ({
  ts: new Date(Date.now() - 60000).toISOString(), laeq, tempC, rhPct: 55, ppd, thermalVerdict: 'neutral', occupiedPct, complete: true,
})
export const demoRooms: Room[] = [
  { id: 'room-1', code: 'sala-01', displayName: 'Call Booth 1', floor: '2', capacity: 1, areaM2: 5, active: true, classified: true, roomTypeId: 'type-booth', latest: latest(42, 23.1, 0) },
  { id: 'room-2', code: 'sala-02', displayName: 'Call Booth 2', floor: '2', capacity: 1, areaM2: 5, active: true, classified: true, roomTypeId: 'type-booth', latest: latest(51, 25.4, 100) },
  { id: 'room-3', code: 'sala-03', displayName: 'Meeting Room A', floor: '2', capacity: 8, areaM2: 20, active: true, classified: true, roomTypeId: 'type-meeting', latest: latest(63, 26.8, 90, 14) },
  { id: 'room-4', code: 'sala-04', displayName: 'Meeting Room B', floor: '2', capacity: 6, areaM2: 18, active: true, classified: true, roomTypeId: 'type-meeting', latest: latest(45, 23.9, 0) },
  { id: 'room-5', code: 'sala-05', displayName: 'Open Area North', floor: '2', capacity: 20, areaM2: 65, active: true, classified: true, roomTypeId: 'type-open', latest: latest(58, 24.2, 70) },
  { id: 'room-6', code: 'sala-06', displayName: 'Focus Room', floor: '3', capacity: 4, areaM2: 12, active: true, classified: true, roomTypeId: 'type-open', latest: latest(38, 22.8, 0) },
  { id: 'room-7', code: 'sala-07', displayName: 'Room 3-07', floor: '3', capacity: null, areaM2: null, active: true, classified: false, latest: latest(43, 23, 80) },
  { id: 'room-8', code: 'sala-08', displayName: 'Room 3-08', floor: '3', capacity: null, areaM2: null, active: true, classified: false, latest: latest(44, 23, 75) },
  { id: 'room-9', code: 'sala-09', displayName: 'Open Area South', floor: '2', capacity: 18, areaM2: 55, active: true, classified: true, roomTypeId: 'type-open', latest: latest(49, 23.5, 65) },
  { id: 'room-10', code: 'sala-10', displayName: 'Lounge', floor: '2', capacity: 10, areaM2: 30, active: true, classified: true, roomTypeId: 'type-open', latest: null },
  { id: 'room-11', code: 'sala-11', displayName: 'Call Booth 3', floor: '1', capacity: 1, areaM2: 5, active: true, classified: true, roomTypeId: 'type-booth', latest: latest(40, 22.9, 80) },
  { id: 'room-12', code: 'sala-12', displayName: 'Meeting Room C', floor: '3', capacity: 6, areaM2: 19, active: true, classified: true, roomTypeId: 'type-meeting', latest: latest(46, 23.4, 0) },
]
export const demoAlerts: EdgeAlert[] = [
  { room_id: 'sala-03', rule: 'laeq', severity: 'critical', message: 'Noise above 60 dB(A)', value: 63, opened_at: new Date(Date.now() - 7 * 60000).toISOString() },
  { room_id: 'sala-02', rule: 'temp_c', severity: 'warning', message: 'Temperature above 25 °C', value: 25.4, opened_at: new Date(Date.now() - 29 * 60000).toISOString() },
  { room_id: 'sala-05', rule: 'laeq', severity: 'warning', message: 'Noise rising', value: 58, opened_at: new Date(Date.now() - 21 * 60000).toISOString() },
]
export const demoEdgeRooms: EdgeRoom[] = demoRooms.slice(0, 6).map((room, i) => ({ room_id: room.code, device_id: `esp32-${room.code}`, last_seen: new Date(Date.now() - (i === 5 ? 12 : 1) * 60000).toISOString(), lost_batches: i === 5 ? 2 : 0, latest: room.latest }))
export const demoThresholds: Threshold[] = [
  { metric: 'laeq', warnValue: 50, criticalValue: 60, sustainedMinutes: 5, enabled: true },
  { metric: 'l10', warnValue: 55, criticalValue: 65, sustainedMinutes: 5, enabled: true },
  { metric: 'ppd', warnValue: 10, criticalValue: 20, sustainedMinutes: 5, enabled: true },
  { metric: 'temp_c', warnValue: 25, criticalValue: 27, sustainedMinutes: 5, enabled: true },
  { metric: 'occupied_pct', warnValue: 85, criticalValue: 100, sustainedMinutes: 15, enabled: true },
]
export function demoReadings(room: Room, count = 60): Reading[] {
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(Date.now() - (count - i) * 60000)
    return {
      roomId: room.code, ts: t.toISOString(), periodS: 60,
      acoustic: { laeq: (room.latest?.laeq ?? 45) + Math.sin(i / 4) * 4 + Math.cos(i / 11) * 2, l10: (room.latest?.laeq ?? 45) + 5 },
      climate: { tempC: (room.latest?.tempC ?? 23) + Math.sin(i / 8) * 0.6, rhPct: room.latest?.rhPct ?? 55 },
      comfort: { ppd: room.latest?.ppd ?? 8 },
      occupancy: { occupiedPct: room.latest?.occupiedPct ?? 0 },
    }
  })
}
