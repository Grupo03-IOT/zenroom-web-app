import { del, patch, request } from '../../../shared/api/http'

export interface DeviceStatus { id: string; code: string; roomId: string | null; fwVersion?: string | null; lastSeen: string | null; lastSeq: number | null; lostBatches: number; silent: boolean }
export interface EdgeNode { id: string; code: string; siteId: string; version: string | null; lastSeen: string | null; pendingUpload: number; roomsReported: number; status: string }
export interface UserAccount { id: string; email: string; displayName: string; active: boolean; roles: string[] }
export interface CredentialInfo { id: string; code: string; active: boolean; scopes: string[] }

/** Estado de la flota (US34, US35, TS24), cuentas (US10) y credenciales de máquina. Todo sale de Cloud. */
export const fleetApi = {
  devices: (token: string) => request<DeviceStatus[]>('/api/v1/devices', {}, token),
  edges: (token: string) => request<EdgeNode[]>('/api/v1/edges', {}, token),
  users: (token: string) => request<UserAccount[]>('/api/v1/users', {}, token),
  setUserActive: (token: string, id: string, active: boolean) => patch<UserAccount>(`/api/v1/users/${id}`, { active }, token),
  credentials: (token: string) => request<CredentialInfo[]>('/api/v1/credentials', {}, token),
  revokeCredential: (token: string, id: string) => del(`/api/v1/credentials/${id}`, token),
}
