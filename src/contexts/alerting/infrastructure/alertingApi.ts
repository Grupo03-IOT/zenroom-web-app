import { put, request } from '../../../shared/api/http'
import type { Threshold } from '../domain/models'

export const alertingApi = {
  thresholds: (token: string, roomTypeId: string) => request<Threshold[]>(`/api/v1/room-types/${roomTypeId}/thresholds`, {}, token),
  saveThreshold: (token: string, roomTypeId: string, threshold: Threshold) => put<Threshold>(`/api/v1/room-types/${roomTypeId}/thresholds/${threshold.metric}`, {
    warnValue: threshold.warnValue,
    criticalValue: threshold.criticalValue,
    sustainedMinutes: threshold.sustainedMinutes,
    enabled: threshold.enabled,
  }, token),
}
