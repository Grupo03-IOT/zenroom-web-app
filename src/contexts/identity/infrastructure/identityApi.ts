import { post } from '../../../shared/api/http'
import { sessionFromJwt } from '../domain/session'

interface TokenResource { accessToken: string; tokenType: string; expiresIn: number }
interface UserResource { id: string; email: string; displayName: string; roles: string[] }

export async function signIn(email: string, password: string) {
  const result = await post<TokenResource>('/api/v1/auth/login', { email, password })
  return sessionFromJwt(result.accessToken, result.expiresIn)
}

export function signUp(email: string, password: string, displayName: string) {
  return post<UserResource>('/api/v1/users', { email, password, displayName })
}

export function createEdgeCredential(token: string, code: string) {
  return post<{ id: string; code: string; active: boolean; scopes: string[]; apiKey: string }>(
    '/api/v1/credentials', { code, scopes: ['readings:write', 'thresholds:read'] }, token,
  )
}
