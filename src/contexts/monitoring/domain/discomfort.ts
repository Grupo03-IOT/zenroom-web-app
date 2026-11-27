export type DiscomfortCategory = 'NOISE' | 'WARM' | 'COLD'

export const discomfortCategories: { value: DiscomfortCategory; label: string }[] = [
  { value: 'NOISE', label: 'Too noisy' },
  { value: 'WARM', label: 'Too warm' },
  { value: 'COLD', label: 'Too cold' },
]

export const discomfortCommentMax = 500

/** Lectura de la sala guardada en el momento del reporte; null si no había una reciente. */
export interface DiscomfortReading { ts: string; laeq: number | null; tempC: number | null; rhPct: number | null; occupiedPct: number | null }

export interface DiscomfortReport {
  id: string
  roomId: string
  roomCode: string
  userId?: string
  category: DiscomfortCategory
  comment: string | null
  createdAt: string
  reading: DiscomfortReading | null
  /** La medición del momento está dentro del umbral aunque el miembro reporte molestia. */
  discrepancy?: boolean
  discrepancyReason?: DiscrepancyReason | null
}

export type DiscrepancyReason = 'NOISE_WITHIN_RANGE' | 'TEMPERATURE_WITHIN_RANGE'

export interface DiscomfortSummary { roomId: string; roomCode: string; noise: number; warm: number; cold: number; total: number; discrepancies?: number }

export interface NewDiscomfortReport { roomId: string; category: DiscomfortCategory; comment?: string }

export interface DiscomfortFilters { roomId?: string; category?: DiscomfortCategory; from?: string; to?: string; discrepancyOnly?: boolean }

export function categoryLabel(category: string): string {
  return discomfortCategories.find(item => item.value === category)?.label ?? 'Other discomfort'
}

export function discrepancyReasonLabel(reason: string): string {
  if (reason === 'NOISE_WITHIN_RANGE') return 'The measured noise was within the threshold'
  if (reason === 'TEMPERATURE_WITHIN_RANGE') return 'The measured temperature was within the comfort range'
  return 'The measurement was within the threshold'
}
