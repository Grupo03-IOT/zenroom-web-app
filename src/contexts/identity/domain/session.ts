export type Role = 'ADMIN' | 'MEMBER'
export interface Session { token: string; email: string; name: string; role: Role; expiresAt: number }

export function sessionFromJwt(token: string, expiresIn: number): Session {
  const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  // Los nombres del JWT pueden incluir tildes y otros caracteres UTF-8.
  const bytes = Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')), char => char.charCodeAt(0))
  const payload = JSON.parse(new TextDecoder().decode(bytes))
  return {
    token,
    email: payload.email || '',
    name: payload.name || payload.email || 'Member',
    role: payload.roles?.includes('ADMIN') ? 'ADMIN' : 'MEMBER',
    expiresAt: Math.min(Date.now() + expiresIn * 1000, typeof payload.exp === 'number' ? payload.exp * 1000 : Infinity),
  }
}
