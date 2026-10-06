export type Role = 'ADMIN' | 'MEMBER'
export interface Session { token: string; email: string; name: string; role: Role; expiresAt: number }

export function sessionFromJwt(token: string, expiresIn: number): Session {
  const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')))
  return {
    token,
    email: payload.email || '',
    name: payload.name || payload.email || 'Member',
    role: payload.roles?.includes('ADMIN') ? 'ADMIN' : 'MEMBER',
    expiresAt: Date.now() + expiresIn * 1000,
  }
}
