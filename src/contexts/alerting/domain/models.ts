export interface Threshold { id?: string; roomTypeId?: string; metric: string; warnValue: number; criticalValue: number | null; sustainedMinutes: number; enabled: boolean }
