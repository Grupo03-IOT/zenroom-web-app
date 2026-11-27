export interface Threshold { id?: string; roomTypeId?: string; metric: string; warnValue: number; criticalValue: number | null; sustainedMinutes: number; enabled: boolean }

/** OPEN → ACKNOWLEDGED → CLOSED, u OPEN → CLOSED. Una alerta cerrada no se reabre. */
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED'

export interface Alert {
  id: string
  roomId: string
  roomCode: string
  rule: string
  severity: string
  message: string
  value: number | null
  status: AlertStatus
  openedAt: string
  closedAt: string | null
  closedBy: 'AUTO' | 'MANUAL' | null
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  correctiveAction: string | null
}

export interface AlertFilters {
  status?: AlertStatus
  roomId?: string
  from?: string
  to?: string
  hasAction?: boolean
}

export const correctiveActionLength = { min: 3, max: 500 } as const

/** Devuelve el motivo por el que la acción no es válida, o null si se puede enviar. */
export function correctiveActionProblem(text: string): 'required' | 'too-short' | 'too-long' | null {
  const value = text.trim()
  if (!value) return 'required'
  if (value.length < correctiveActionLength.min) return 'too-short'
  if (value.length > correctiveActionLength.max) return 'too-long'
  return null
}

/** Reglas que hoy genera el Edge; la unidad acompaña al valor que disparó la alerta. */
export const alertRules: Record<string, { label: string; unit: string }> = {
  sustained_noise: { label: 'Sustained noise', unit: 'dB(A)' },
  thermal_discomfort: { label: 'Thermal discomfort', unit: '% PPD' },
}

export const alertSeverities: Record<string, string> = { info: 'Information', warning: 'Warning', critical: 'Critical' }
