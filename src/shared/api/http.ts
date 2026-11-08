export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

const cloudBase = (import.meta.env.VITE_CLOUD_API_URL || '/cloud').replace(/\/+$/, '')
export const sessionExpiredEvent = 'sensework-session-expired'

function mapKeys(value: unknown, change: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map(item => mapKeys(item, change))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [change(key), mapKeys(item, change)]))
  }
  return value
}
const toCamel = (value: unknown) => mapKeys(value, key => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()))
const toSnake = (value: unknown) => mapKeys(value, key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`))

export async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30000)
  const abort = () => controller.abort()
  init.signal?.addEventListener('abort', abort, { once: true })
  if (init.signal?.aborted) controller.abort()
  try {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body != null) headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(`${cloudBase}${path}`, { ...init, headers, signal: controller.signal })
    if (!response.ok) {
      // Una sesión rechazada vuelve al acceso; los errores de permisos conservan la sesión.
      if (response.status === 401 && token) window.dispatchEvent(new CustomEvent(sessionExpiredEvent, { detail: token }))
      let message = `${response.status} ${response.statusText}`
      try {
        const body = await response.json()
        message = body.message || body.error || body.detail || message
      } catch { /* La respuesta de error puede no contener JSON. */ }
      throw new ApiError(response.status, message)
    }
    // La revocación de credenciales devuelve 204 y no incluye JSON.
    const text = await response.text()
    return (text ? toCamel(JSON.parse(text)) : undefined) as T
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    if (controller.signal.aborted) throw new ApiError(0, 'The request timed out. Please try again.')
    throw new ApiError(0, 'Could not connect to Cloud API. Please try again.')
  } finally {
    window.clearTimeout(timeout)
    init.signal?.removeEventListener('abort', abort)
  }
}

export function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(toSnake(body)) }, token)
}

export function put<T>(path: string, body: unknown, token: string): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(toSnake(body)) }, token)
}

export function patch<T>(path: string, body: unknown, token: string): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(toSnake(body)) }, token)
}
