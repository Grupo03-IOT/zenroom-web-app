import { post, request, withQuery } from '../../../shared/api/http'
import type { DiscomfortFilters, DiscomfortReport, DiscomfortSummary, NewDiscomfortReport } from '../domain/discomfort'

export const discomfortApi = {
  /** MEMBER o ADMIN. El usuario sale del token; Cloud responde 409 DISCOMFORT_TOO_FREQUENT ante un reporte repetido. */
  file: (token: string, report: NewDiscomfortReport) => post<DiscomfortReport>('/api/v1/discomfort-reports', {
    roomId: report.roomId,
    category: report.category,
    comment: report.comment?.trim() || undefined,
  }, token),
  /** ADMIN, más recientes primero. */
  list: (token: string, filters: DiscomfortFilters = {}, signal?: AbortSignal) => request<DiscomfortReport[]>(withQuery('/api/v1/discomfort-reports', {
    room_id: filters.roomId,
    category: filters.category,
    from: filters.from,
    to: filters.to,
  }), { signal }, token),
  mine: (token: string, signal?: AbortSignal) => request<DiscomfortReport[]>('/api/v1/discomfort-reports/mine', { signal }, token),
  /** ADMIN: cuántos reportes de cada motivo tiene cada sala en el rango. */
  summary: (token: string, range: { from?: string; to?: string } = {}, signal?: AbortSignal) => request<DiscomfortSummary[]>(withQuery('/api/v1/discomfort-reports/summary', {
    from: range.from,
    to: range.to,
  }), { signal }, token),
}

/** El límite anti-abuso se reconoce por su código, sin depender del texto del mensaje. */
export function isTooFrequent(cause: unknown): boolean {
  const error = cause as { status?: number; code?: string } | null
  return !!error && error.status === 409 && (!error.code || error.code.endsWith('DISCOMFORT_TOO_FREQUENT'))
}
