import type { Language } from '../i18n/i18n'

// El contrato usa UTC; los filtros por día se interpretan en la zona horaria del navegador.
function pad(value: number) { return String(value).padStart(2, '0') }

/** Fecha local en el formato de <input type="date">. */
export function dateInput(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function daysAgoInput(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return dateInput(date)
}

export function dayStartIso(day: string): string | undefined {
  return day ? new Date(`${day}T00:00:00`).toISOString() : undefined
}

export function dayEndIso(day: string): string | undefined {
  return day ? new Date(`${day}T23:59:59.999`).toISOString() : undefined
}

export function dateTime(iso: string | null | undefined, language: Language): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(language === 'es' ? 'es-PE' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function decimal(value: number | null | undefined, language: Language, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(language === 'es' ? 'es-PE' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)
}
