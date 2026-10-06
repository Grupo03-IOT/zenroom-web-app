export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

const cloudBase = import.meta.env.VITE_CLOUD_API_URL || '/cloud'

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
  const response = await fetch(`${cloudBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      message = body.message || body.error || body.detail || message
    } catch { /* The response does not contain JSON. */ }
    throw new ApiError(response.status, message)
  }
  const body: unknown = await response.json()
  return toCamel(body) as T
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
