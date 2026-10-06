import type { Role } from '../contexts/identity/domain/session'
import type { Page } from './App'

export type AuthMode = 'login' | 'signup'

const pages = new Set<Page>([
  'overview', 'rooms', 'room-detail', 'devices', 'alerts', 'insights', 'reports',
  'members', 'thresholds', 'edge-credentials', 'room-types', 'diagnostics',
  'member-rooms', 'member-detail', 'member-report', 'profile', 'terms', 'privacy',
])

const adminOnly = new Set<Page>([
  'overview', 'rooms', 'room-detail', 'devices', 'alerts', 'insights', 'reports',
  'members', 'thresholds', 'edge-credentials', 'room-types',
])

const memberOnly = new Set<Page>(['member-rooms', 'member-detail', 'member-report'])

export function defaultPage(role: Role): Page {
  return role === 'MEMBER' ? 'member-rooms' : 'overview'
}

export function canVisit(page: Page, role: Role): boolean {
  return role === 'ADMIN' ? !memberOnly.has(page) : !adminOnly.has(page)
}

export function pathForPage(page: Page, roomId?: string): string {
  if (page === 'room-detail') return roomId ? `/rooms/${encodeURIComponent(roomId)}` : '/rooms'
  if (page === 'member-detail') return roomId ? `/member-rooms/${encodeURIComponent(roomId)}` : '/member-rooms'
  return `/${page}`
}

export function readRoute(pathname = window.location.pathname): { page?: Page; roomId?: string; authMode?: AuthMode } {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/login' || path === '/signup') return { authMode: path.slice(1) as AuthMode }
  const room = path.match(/^\/(rooms|member-rooms)\/([^/]+)$/)
  if (room) {
    try {
      return { page: room[1] === 'rooms' ? 'room-detail' : 'member-detail', roomId: decodeURIComponent(room[2]) }
    } catch {
      return {}
    }
  }
  const name = path.slice(1) as Page
  return pages.has(name) && name !== 'room-detail' && name !== 'member-detail' ? { page: name } : {}
}

export function safeNext(search = window.location.search): { page: Page; roomId?: string } | null {
  const next = new URLSearchParams(search).get('next')
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  const url = new URL(next, window.location.origin)
  if (url.origin !== window.location.origin) return null
  const route = readRoute(url.pathname)
  return route.page ? { page: route.page, roomId: route.roomId } : null
}
