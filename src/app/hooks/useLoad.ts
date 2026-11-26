import { useCallback, useEffect, useRef, useState } from 'react'

export interface LoadState<T> {
  data: T | undefined
  error: string
  loading: boolean
  reload: () => void
}

/**
 * Carga datos de Cloud con estados de carga y error, cancela la petición anterior
 * cuando cambian las dependencias y, si se indica, vuelve a consultar cada intervalMs.
 * Las recargas periódicas no borran los datos ya mostrados.
 */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[], intervalMs?: number): LoadState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const loader = useRef(load)
  loader.current = load
  const reload = useCallback(() => setTick(value => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    loader.current(controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load data') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [...deps, tick])

  useEffect(() => {
    if (!intervalMs) return
    const timer = window.setInterval(reload, intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, reload])

  return { data, error, loading, reload }
}
