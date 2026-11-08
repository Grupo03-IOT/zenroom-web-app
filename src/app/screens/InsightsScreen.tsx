import { useEffect, useState } from 'react'
import { useApp } from '../App'
import { Card, Empty, StatusBadge } from '../components/Ui'
import { tr, useLanguage } from '../../shared/i18n/i18n'
import type { Room, RoomStatus } from '../../contexts/monitoring/domain/models'
import { monitoringApi } from '../../contexts/monitoring/infrastructure/monitoringApi'
import { alertingApi } from '../../contexts/alerting/infrastructure/alertingApi'
import { loadAnalytics } from '../../contexts/insights/infrastructure/insightsApi'
import type { RoomAnalytics } from '../../contexts/insights/infrastructure/insightsApi'
import { dailyTrends, metricValue } from '../../contexts/insights/domain/dailyTrends'
import type { DailyTrend, InsightMetric } from '../../contexts/insights/domain/dailyTrends'
import downloadIcon from '../../shared/assets/icon-download.svg'
import analyticsIcon from '../../shared/assets/icon-analytics.svg'
import './InsightsScreen.css'

const metrics: InsightMetric[] = ['Noise', 'Temperature', 'Presence']

function dateLabel(date: string, language: 'es' | 'en') {
  return new Intl.DateTimeFormat(language === 'es' ? 'es-PE' : 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

function number(value: number | null | undefined, language: 'es' | 'en', digits = 2) {
  return value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat(language === 'es' ? 'es-PE' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

function exportCsv(filename: string, lines: string[][]) {
  const csv = lines.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}

function LineAreaChart({ points, metric, threshold, height }: { points: DailyTrend[]; metric: InsightMetric | 'Indoor'; threshold: number | null; height: number }) {
  const values = points.map(point => metric === 'Indoor' ? point.temperature : metricValue(point, metric))
  const valid = values.flatMap(value => value == null ? [] : [value])
  if (!valid.length) return <div className="insight-plot-empty">{tr('No readings available for this period.')}</div>

  const low = Math.min(...valid, ...(threshold == null ? [] : [threshold]))
  const high = Math.max(...valid, ...(threshold == null ? [] : [threshold]))
  const span = Math.max(1, high - low)
  const floor = metric === 'Presence' ? 0 : low - span * 0.25
  const ceiling = metric === 'Presence' ? 100 : high + span * 0.45
  const y = (value: number) => 180 - (value - floor) / Math.max(1, ceiling - floor) * 180
  const positions = values.map((value, index) => value == null ? null : { x: index / Math.max(1, values.length - 1) * 1000, y: y(value) }).filter((value): value is { x: number; y: number } => value !== null)
  const path = positions.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const first = positions[0]
  const last = positions[positions.length - 1]
  const area = `${path} L ${last.x.toFixed(2)} 180 L ${first.x.toFixed(2)} 180 Z`
  const thresholdY = threshold == null ? null : y(threshold)

  return <svg className="insight-plot" style={{ height }} viewBox="0 0 1000 180" preserveAspectRatio="none" role="img" aria-label={tr(metric === 'Indoor' ? 'Indoor temperature trend' : `${metric} trend`)}>
    <path d={area} fill="#dcecf6" opacity=".9" />
    {[0, 60, 120, 180].map(gridY => <line key={gridY} x1="0" x2="1000" y1={gridY} y2={gridY} stroke="#d9e1e8" strokeWidth="1" />)}
    {thresholdY != null && <line x1="0" x2="1000" y1={thresholdY} y2={thresholdY} stroke="#b3261e" strokeDasharray="8 6" strokeWidth="1.5" />}
    <path d={path} fill="none" stroke="#2e86c1" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
}

function ChartAxis({ points, language }: { points: DailyTrend[]; language: 'es' | 'en' }) {
  if (!points.length) return null
  return <div className="insight-axis"><span>{dateLabel(points[0].date, language)}</span><span>{dateLabel(points[Math.floor((points.length - 1) / 2)].date, language)}</span><span>{dateLabel(points[points.length - 1].date, language)}</span></div>
}

function comparisonRooms(rooms: Room[], statusFor: (room: Room) => RoomStatus) {
  const ranked = rooms.filter(room => room.latest).sort((a, b) => {
    const severity = { bad: 0, moderate: 1, optimal: 2, 'no-data': 3 }
    return severity[statusFor(a)] - severity[statusFor(b)] || (b.latest?.laeq ?? 0) - (a.latest?.laeq ?? 0)
  })
  const best = [...ranked].reverse().find(room => statusFor(room) === 'optimal')
  const worst = ranked.filter(room => room !== best).slice(0, 3)
  return best ? [...worst, best] : ranked.slice(0, 4)
}

export function Insights() {
  const { session, rooms, selectedSite, statusFor, notify } = useApp()
  const { language } = useLanguage()
  const [roomId, setRoomId] = useState('')
  const [month, setMonth] = useState('')
  const [metric, setMetric] = useState<InsightMetric>('Noise')
  const [analytics, setAnalytics] = useState<RoomAnalytics | null>(null)
  const [trends, setTrends] = useState<DailyTrend[]>([])
  const [noiseThreshold, setNoiseThreshold] = useState<number | null>(null)
  const [temperatureThreshold, setTemperatureThreshold] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const room = rooms.find(item => item.id === roomId) || rooms[0]
  // Abre el mes de la última lectura disponible en la zona horaria del local.
  const monthParts = new Intl.DateTimeFormat('en-CA', { timeZone: selectedSite?.timezone || 'UTC', year: 'numeric', month: '2-digit' }).formatToParts(new Date(room?.latest?.ts || Date.now()))
  const selectedMonth = month || monthParts.find(part => part.type === 'year')?.value + '-' + monthParts.find(part => part.type === 'month')?.value

  useEffect(() => {
    if (!room) { setAnalytics(null); setTrends([]); return }

    let cancelled = false
    setLoading(true)
    setAnalytics(null)
    setTrends([])
    setNoiseThreshold(null)
    setTemperatureThreshold(null)
    setError('')
    const thresholds = room.roomTypeId ? alertingApi.thresholds(session.token, room.roomTypeId) : Promise.resolve([])
    // El historial comparte los límites y la zona horaria del período calculado por Cloud.
    const analysis = loadAnalytics(session.token, room.id, selectedMonth)
    void Promise.allSettled([
      analysis,
      analysis.then(summary => monitoringApi.readings(session.token, room.id, summary.from, summary.to).then(readings => dailyTrends(readings, summary.timezone))),
      thresholds,
    ]).then(([summary, readings, levels]) => {
      if (cancelled) return
      if (summary.status === 'fulfilled') setAnalytics(summary.value)
      if (readings.status === 'fulfilled') setTrends(readings.value)
      if (levels.status === 'fulfilled') {
        setNoiseThreshold(levels.value.find(item => item.metric === 'laeq' && item.enabled)?.warnValue ?? null)
        setTemperatureThreshold(levels.value.find(item => item.metric === 'temp_c' && item.enabled)?.warnValue ?? null)
      }
      const failed = [summary, readings, levels].find(result => result.status === 'rejected')
      if (failed?.status === 'rejected') setError(failed.reason instanceof Error ? failed.reason.message : 'Could not load analysis')
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [room?.id, room?.roomTypeId, selectedMonth, session.token])

  function handleExport() {
    if (!trends.length && !analytics) { notify('No analysis available to export.'); return }
    exportCsv('sensework-insights.csv', [
      ['room', 'date', 'noise_dba', 'temperature_c', 'occupied_pct', 'samples', 'indoor_outdoor_correlation', 'noise_occupancy_correlation'],
      ...trends.map(point => [room?.displayName ?? '', point.date, point.noise?.toFixed(2) ?? '', point.temperature?.toFixed(2) ?? '', point.presence?.toFixed(2) ?? '', String(point.samples), String(analytics?.measures.indoorVsOutdoor.value ?? ''), String(analytics?.measures.noiseVsOccupancy.value ?? '')]),
      ...(!trends.length && analytics ? [[room?.displayName ?? '', '', '', '', '', String(analytics.dataQuality.receivedMinutes), String(analytics.measures.indoorVsOutdoor.value ?? ''), String(analytics.measures.noiseVsOccupancy.value ?? '')]] : []),
    ])
  }

  if (!room) return <Empty title="No rooms available" detail="Create a room or wait for sensor readings before viewing insights." />

  const mainValues = trends.map(point => metricValue(point, metric)).filter((value): value is number => value != null)
  const delta = mainValues.length > 1 ? mainValues[mainValues.length - 1] - mainValues[0] : null
  const hottest = trends.filter(point => point.temperature != null).reduce<DailyTrend | null>((best, point) => !best || (point.temperature ?? -Infinity) > (best.temperature ?? -Infinity) ? point : best, null)
  const mainThreshold = metric === 'Noise' ? noiseThreshold : metric === 'Temperature' ? temperatureThreshold : null
  const caption = metric === 'Noise' ? 'Noise · daily average dB(A)' : metric === 'Temperature' ? 'Temperature · daily average °C' : 'Presence · daily average %'
  const days = analytics ? Math.round((new Date(analytics.to).getTime() - new Date(analytics.from).getTime()) / 86400000) : 0
  const summary = delta == null ? '' : metric === 'Noise' ? `${tr(delta >= 0 ? 'Rising' : 'Falling')} ${number(Math.abs(delta), language, 0)} dB(A) ${tr('in')} ${days} ${tr('days')}` : `${tr('Change')} ${delta > 0 ? '+' : ''}${number(delta, language, 1)} ${metric === 'Temperature' ? '°C' : '%'} ${tr('in')} ${days} ${tr('days')}`
  const outdoorCorrelation = analytics?.measures.indoorVsOutdoor.value

  return <div className="insights-screen">
    <div className="insights-toolbar">
      <label>{tr('Room')}<select value={room.id} onChange={event => setRoomId(event.target.value)}>{rooms.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
      <label>{tr('Period')}<input type="month" value={selectedMonth} onChange={event => setMonth(event.target.value)} /></label>
      <button className="button outline insights-export" onClick={handleExport}><img src={downloadIcon} alt="" />{tr('Export CSV')}</button>
    </div>

    <div className="insights-layout">
      <div className="insights-primary">
        <Card className="insights-card">
          <div className="insights-card-header"><h2>{`${tr('Daily average')} · ${selectedMonth}`}</h2><div className="insights-tabs" role="group" aria-label={tr('Metric')}>{metrics.map(item => <button key={item} type="button" className={`button ${metric === item ? 'primary' : 'outline'}`} aria-pressed={metric === item} onClick={() => setMetric(item)}>{tr(item)}</button>)}</div></div>
          <div className="insight-caption"><span>{tr(caption)}</span>{mainThreshold != null && <><i className="insight-threshold-mark" /> <span>{tr('Threshold')} {number(mainThreshold, language, 0)}</span></>}<strong>{summary}</strong></div>
          <LineAreaChart points={trends} metric={metric} threshold={mainThreshold} height={180} />
          <ChartAxis points={trends} language={language} />
        </Card>

        <Card className="insights-card">
          <div className="insights-card-header"><h2>{tr('Indoor vs outdoor temperature')}</h2></div>
          <div className="insight-caption"><span>{tr('Indoor °C · outdoor correlation')} {outdoorCorrelation == null ? '' : `(r ${number(outdoorCorrelation, language)})`}</span>{temperatureThreshold != null && <><i className="insight-threshold-mark" /><span>{tr('Threshold')} {number(temperatureThreshold, language, 0)}</span></>}<strong>{hottest ? `${tr('Max')} ${number(hottest.temperature, language, 1)} °C ${tr('on')} ${dateLabel(hottest.date, language)}` : ''}</strong></div>
          <LineAreaChart points={trends} metric="Indoor" threshold={temperatureThreshold} height={170} />
          <ChartAxis points={trends} language={language} />
        </Card>
      </div>

      <div className="insights-secondary">
        <Card className="insights-card insights-correlation">
          <div className="insights-card-header"><h2>{tr('Correlation')}</h2><img className="insights-analytics-icon" src={analyticsIcon} alt="" /></div>
          <div className="insight-stat"><span>{tr('Indoor vs outdoor (r)')}</span><strong>{number(analytics?.measures.indoorVsOutdoor.value, language)}</strong></div>
          <div className="insight-stat"><span>{tr('Noise vs occupied time (r)')}</span><strong>{number(analytics?.measures.noiseVsOccupancy.value, language)}</strong></div>
          <div className="insight-stat"><span>{tr('Samples')}</span><strong>{analytics ? new Intl.NumberFormat(language === 'es' ? 'es-PE' : 'en-US').format(analytics.dataQuality.receivedMinutes) : '—'} {tr('min')}</strong></div>
          {analytics && <><span className={`insight-reliability ${analytics.measures.noiseVsOccupancy.verdict === 'conclusive' ? 'reliable' : 'insufficient'}`}><i />{tr(analytics.measures.noiseVsOccupancy.verdict === 'conclusive' ? 'Enough data to be reliable' : 'Insufficient data for a reliable result.')}</span><p>{tr('Coverage')} {number(analytics.dataQuality.coveragePct, language, 1)} %</p></>}
          <p>{tr('Cloud evaluates the evidence of each result. Missing values indicate insufficient evidence.')}</p>
        </Card>

        <Card className="insights-card insights-comparison">
          <h2>{tr('Room comparison')}</h2>
          {comparisonRooms(rooms, statusFor).map(item => <div className="insight-room-row" key={item.id}><span>{item.displayName}</span><StatusBadge status={statusFor(item)} /></div>)}
        </Card>
      </div>
    </div>
    {error && <div className="state-bar error" role="alert">{tr(error)}</div>}
    {loading && <div className="insights-loading" role="status">{tr('Loading current data…')}</div>}
  </div>
}
