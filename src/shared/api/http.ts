export class ApiError extends Error {
  // code es el identificador estable del catálogo de errores de Cloud (p. ej. ALERTING_ALERT_NOT_OPEN).
  // details conserva el cuerpo del error (en camelCase) para los casos que traen datos, como DEVICE_ALREADY_LINKED.
  constructor(public status: number, message: string, public code?: string, public details?: Record<string, unknown>) { super(message) }
}

/** Añade a la ruta los parámetros con valor; los nombres se envían tal cual (snake_case del contrato). */
export function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return query ? `${path}?${query}` : path
}

const cloudBase = (import.meta.env.VITE_CLOUD_API_URL || '/cloud').replace(/\/+$/, '')
export const sessionExpiredEvent = 'sensework-session-expired'
export interface SessionExpiredDetail { token: string; code?: string }
export const accountDisabledCode = 'IAM_ACCOUNT_DISABLED'
export const invalidCredentialsCode = 'IAM_INVALID_CREDENTIALS'

/** Mensaje de acceso para un error del login (400/401 de credenciales, cuenta desactivada). */
export function loginErrorMessage(cause: unknown): string | undefined {
  if (!(cause instanceof ApiError)) return undefined
  if (cause.code === accountDisabledCode) return 'This account is deactivated. Contact an administrator.'
  if (cause.code === invalidCredentialsCode || cause.status === 400 || cause.status === 401) return 'Invalid email or password.'
  return undefined
}

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
      let message = `${response.status} ${response.statusText}`
      let code: string | undefined
      let details: Record<string, unknown> | undefined
      try {
        const body = await response.json()
        message = body.message || body.error || body.detail || message
        code = typeof body.code === 'string' ? body.code : undefined
        if (body && typeof body === 'object') details = toCamel(body) as Record<string, unknown>
      } catch { /* La respuesta de error puede no contener JSON. */ }
      // Una sesión rechazada vuelve al acceso; el login no envía token, así que su 401 nunca llega aquí.
      if (response.status === 401 && token) window.dispatchEvent(new CustomEvent<SessionExpiredDetail>(sessionExpiredEvent, { detail: { token, code } }))
      throw new ApiError(response.status, message, code, details)
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
