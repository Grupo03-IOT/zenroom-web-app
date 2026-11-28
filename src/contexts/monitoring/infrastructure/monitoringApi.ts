import { patch, post, request } from '../../../shared/api/http'
import type { Device, Gateway, Reading, Room, RoomType, Site } from '../domain/models'

export const monitoringApi = {
  sites: (token: string) => request<Site[]>('/api/v1/sites', {}, token),
  rooms: (token: string) => request<Room[]>('/api/v1/rooms', {}, token),
  devices: (token: string) => request<Device[]>('/api/v1/devices', {}, token),
  gateways: (token: string) => request<Gateway[]>('/api/v1/edges', {}, token),
  room: (token: string, id: string) => request<Room>(`/api/v1/rooms/${id}`, {}, token),
  roomTypes: (token: string, siteId: string) => request<RoomType[]>(`/api/v1/sites/${siteId}/room-types`, {}, token),
  createSite: (token: string, site: Omit<Site, 'id'>) => post<Site>('/api/v1/sites', site, token),
  createRoomType: (token: string, siteId: string, data: Pick<RoomType, 'code' | 'displayName' | 'description'>) => post<RoomType>(`/api/v1/sites/${siteId}/room-types`, data, token),
  classifyRoom: (token: string, roomId: string, roomTypeId: string) => patch<Room>(`/api/v1/rooms/${roomId}`, { roomTypeId }, token),
  createRoom: (token: string, data: { siteId: string; displayName: string; roomTypeId?: string; capacity?: number }) => post<Room>('/api/v1/rooms', data, token),
  updateRoom: (token: string, roomId: string, data: { roomTypeId?: string; capacity?: number }) => patch<Room>(`/api/v1/rooms/${roomId}`, data, token),
  registerDevice: (token: string, data: { code: string; roomId: string }) => post<Device>('/api/v1/devices', data, token),
  reassignDevice: (token: string, deviceId: string, roomId: string, confirmReassign = false) => patch<Device>(`/api/v1/devices/${deviceId}`, confirmReassign ? { roomId, confirmReassign } : { roomId }, token),
  readings: (token: string, roomId: string, from: string, to: string) => request<Reading[]>(`/api/v1/rooms/${roomId}/readings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, token),
}
