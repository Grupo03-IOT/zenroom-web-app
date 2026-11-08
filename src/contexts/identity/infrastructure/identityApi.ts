import { patch, post, request } from '../../../shared/api/http'
import { sessionFromJwt } from '../domain/session'

interface TokenResource { accessToken: string; tokenType: string; expiresIn: number }
export interface UserResource { id: string; email: string; displayName: string; active: boolean; roles: string[] }
export interface EdgeCredential { id: string; code: string; active: boolean; scopes: string[]; apiKey?: string }

export async function signIn(email: string, password: string) {
  const result = await post<TokenResource>('/api/v1/auth/login', { email, password })
  return sessionFromJwt(result.accessToken, result.expiresIn)
}

export function signUp(email: string, password: string, displayName: string) {
  return post<UserResource>('/api/v1/users', { email, password, displayName })
}

// El latido permite que Cloud publique la salud y la cola de subida del Edge.
export function createEdgeCredential(token: string, code: string) {
  return post<EdgeCredential & { apiKey: string }>(
    '/api/v1/credentials', { code, scopes: ['readings:write', 'thresholds:read', 'edges:heartbeat'] }, token,
  )
}

export const listUsers = (token: string) => request<UserResource[]>('/api/v1/users', {}, token)
export const listEdgeCredentials = (token: string) => request<EdgeCredential[]>('/api/v1/credentials', {}, token)
export const revokeEdgeCredential = (token: string, id: string) => request<void>(`/api/v1/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' }, token)

export const setUserActive = (token: string, id: string, active: boolean) => patch<UserResource>(`/api/v1/users/${encodeURIComponent(id)}`, { active }, token)
