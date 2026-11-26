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
}

export interface DiscomfortSummary { roomId: string; roomCode: string; noise: number; warm: number; cold: number; total: number }

export interface NewDiscomfortReport { roomId: string; category: DiscomfortCategory; comment?: string }

export interface DiscomfortFilters { roomId?: string; category?: DiscomfortCategory; from?: string; to?: string }

export function categoryLabel(category: string): string {
  return discomfortCategories.find(item => item.value === category)?.label ?? 'Other discomfort'
}
