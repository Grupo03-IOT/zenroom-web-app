import { patch, put, request, withQuery } from '../../../shared/api/http'
import type { Alert, AlertFilters, Threshold } from '../domain/models'

export const alertingApi = {
  thresholds: (token: string, roomTypeId: string) => request<Threshold[]>(`/api/v1/room-types/${roomTypeId}/thresholds`, {}, token),
  saveThreshold: (token: string, roomTypeId: string, threshold: Threshold) => put<Threshold>(`/api/v1/room-types/${roomTypeId}/thresholds/${threshold.metric}`, {
    warnValue: threshold.warnValue,
    criticalValue: threshold.criticalValue,
    sustainedMinutes: threshold.sustainedMinutes,
    enabled: threshold.enabled,
  }, token),
  /** Lista de alertas (más recientes primero). Rol ADMIN. */
  alerts: (token: string, filters: AlertFilters = {}, signal?: AbortSignal) => request<Alert[]>(withQuery('/api/v1/alerts', {
    status: filters.status,
    room_id: filters.roomId,
    from: filters.from,
    to: filters.to,
    has_action: filters.hasAction ? true : undefined,
  }), { signal }, token),
  alert: (token: string, id: string) => request<Alert>(`/api/v1/alerts/${encodeURIComponent(id)}`, {}, token),
  /** Solo desde OPEN; Cloud responde 409 ALERTING_ALERT_NOT_OPEN si ya fue reconocida o cerrada. */
  acknowledge: (token: string, id: string, correctiveAction: string) => patch<Alert>(`/api/v1/alerts/${encodeURIComponent(id)}/acknowledge`, { correctiveAction: correctiveAction.trim() }, token),
}

/** La alerta ya fue reconocida o se cerró sola mientras el administrador escribía. */
export function isAlertNotOpen(cause: unknown): boolean {
  const error = cause as { status?: number; code?: string } | null
  return !!error && error.status === 409 && (!error.code || error.code.endsWith('ALERT_NOT_OPEN'))
}
