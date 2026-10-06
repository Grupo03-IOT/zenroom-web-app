export interface Threshold { id?: string; roomTypeId?: string; metric: string; warnValue: number; criticalValue: number | null; sustainedMinutes: number; enabled: boolean }
// Shapes retained for local demo fixtures. Cloud API does not expose these live views yet.
export interface EdgeAlert { room_id: string; rule: string; severity: string; message: string; value: number; opened_at: string }
export interface EdgeRoom { room_id: string; device_id: string; last_seen: string | null; lost_batches: number; latest: unknown }
