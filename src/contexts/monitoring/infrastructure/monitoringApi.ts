import { patch, post, request } from '../../../shared/api/http'
import type { Reading, Room, RoomType, Site } from '../domain/models'

export const monitoringApi = {
  sites: (token: string) => request<Site[]>('/api/v1/sites', {}, token),
  rooms: (token: string) => request<Room[]>('/api/v1/rooms', {}, token),
  room: (token: string, id: string) => request<Room>(`/api/v1/rooms/${id}`, {}, token),
  roomTypes: (token: string, siteId: string) => request<RoomType[]>(`/api/v1/sites/${siteId}/room-types`, {}, token),
  createSite: (token: string, site: Omit<Site, 'id'>) => post<Site>('/api/v1/sites', site, token),
  createRoomType: (token: string, siteId: string, data: Pick<RoomType, 'code' | 'displayName' | 'description'>) => post<RoomType>(`/api/v1/sites/${siteId}/room-types`, data, token),
  classifyRoom: (token: string, roomId: string, roomTypeId: string) => patch<Room>(`/api/v1/rooms/${roomId}`, { roomTypeId }, token),
  readings: (token: string, roomId: string, from: string, to: string) => request<Reading[]>(`/api/v1/rooms/${roomId}/readings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, token),
}
