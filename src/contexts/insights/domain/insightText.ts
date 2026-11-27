// Textos de las claves estables que devuelve Insights (ComfortAnalyticsService en cloud-api).
// Cada texto es la clave en inglés del diccionario de traducciones; {value} se reemplaza al mostrarlo.
// Una clave nueva que Cloud añada sin texto aquí se muestra con un texto genérico, nunca en crudo.

export const findingTexts: Record<string, string> = {
  noise_follows_occupancy: 'Noise rises when the room is occupied (r = {value}).',
  noise_without_occupancy: 'Noise rises when the room is empty, so it comes from outside the room or from equipment (r = {value}).',
  noise_independent_of_occupancy: 'Noise does not depend on whether the room is occupied (r = {value}).',
  follows_outdoor_temperature: 'Indoor temperature follows the weather outside (r = {value}).',
  opposes_outdoor_temperature: 'Indoor temperature moves against the weather outside (r = {value}).',
  holds_own_temperature: 'The room keeps its own temperature, regardless of the weather outside (r = {value}).',
  stable_temperature: 'Temperature stayed stable during the period ({value} °C per hour).',
  warming_over_period: 'The room warmed up during the period ({value} °C per hour).',
  cooling_over_period: 'The room cooled down during the period ({value} °C per hour).',
  often_above_threshold: 'Noise was above the warning threshold {value} % of the time.',
}

export const unknownFindingText = 'Additional result: {value}'

export const verdictTexts: Record<string, string> = {
  conclusive: 'Conclusive',
  not_enough_evidence: 'Not enough evidence',
  no_data: 'No data',
}

export const directionTexts: Record<string, string> = {
  positive: 'Positive',
  negative: 'Negative',
  rising: 'Rising',
  falling: 'Falling',
}

export const unitTexts: Record<string, string> = {
  pearson_r: 'r',
  degc_per_hour: '°C/h',
  pct_of_time: '% of time',
}

/** Unidad legible, o vacía si Cloud envía una que aún no tiene texto. */
export function unitText(unit: string | null | undefined): string {
  return unit ? unitTexts[unit] ?? '' : ''
}

export function findingTemplate(code: string | null | undefined): string {
  return (code && findingTexts[code]) || unknownFindingText
}

export function verdictText(verdict: string | null | undefined): string {
  return (verdict && verdictTexts[verdict]) || 'No data'
}

export function directionText(direction: string | null | undefined): string {
  return (direction && directionTexts[direction]) || ''
}
