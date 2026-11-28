import { useEffect, useId, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { CircleCheck } from 'lucide-react'
import { useApp } from '../App'
import { useLoad } from '../hooks/useLoad'
import { Card, Empty } from '../components/Ui'
import { tr, useLanguage } from '../../shared/i18n/i18n'
import { dateTime, dayEndIso, dayStartIso, decimal } from '../../shared/format/dates'
import { alertingApi, isAlertNotOpen } from '../../contexts/alerting/infrastructure/alertingApi'
import { alertRules, alertSeverities, correctiveActionLength, correctiveActionProblem } from '../../contexts/alerting/domain/models'
import type { Alert, AlertStatus } from '../../contexts/alerting/domain/models'
import type { Room } from '../../contexts/monitoring/domain/models'

const tabs: { status: AlertStatus; label: string }[] = [
  { status: 'OPEN', label: 'Active' },
  { status: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { status: 'CLOSED', label: 'Closed (history)' },
]

const statusClass: Record<AlertStatus, string> = { OPEN: 'status-bad', ACKNOWLEDGED: 'status-moderate', CLOSED: 'status-optimal' }
const statusLabel: Record<AlertStatus, string> = { OPEN: 'Open', ACKNOWLEDGED: 'Acknowledged', CLOSED: 'Closed' }

export function ruleLabel(rule: string) { return tr(alertRules[rule]?.label ?? 'Comfort alert') }
export function alertRoomName(alert: Alert, rooms: Room[]) { return rooms.find(room => room.id === alert.roomId)?.displayName || alert.roomCode }

function alertValue(alert: Alert, language: 'es' | 'en') {
  if (alert.value == null) return '—'
  return `${decimal(alert.value, language)} ${alertRules[alert.rule]?.unit ?? ''}`.trim()
}

export function Alerts() {
  const { session, rooms, openAlerts, refreshAlerts, notify, refreshMs } = useApp()
  const { language } = useLanguage()
  const [status, setStatus] = useState<AlertStatus>('OPEN')
  const [roomId, setRoomId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [onlyWithAction, setOnlyWithAction] = useState(false)
  const [acknowledging, setAcknowledging] = useState<Alert | null>(null)
  const invalidRange = !!from && !!to && from > to
  const { data, error, loading, reload } = useLoad(signal => invalidRange
    ? Promise.resolve<Alert[]>([])
    : alertingApi.alerts(session.token, { status, roomId: roomId || undefined, from: dayStartIso(from), to: dayEndIso(to), hasAction: onlyWithAction }, signal),
  [session.token, status, roomId, from, to, onlyWithAction, invalidRange], refreshMs)
  // Cloud no filtra por local: se muestran las alertas de las salas del local elegido.
  const shown = (data ?? []).filter(alert => rooms.some(room => room.id === alert.roomId))
  const panelId = 'alerts-panel'

  function changeTab(next: AlertStatus) {
    setStatus(next)
    if (next === 'OPEN') setOnlyWithAction(false)
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    changeTab(next.status)
    document.getElementById(`alerts-tab-${next.status}`)?.focus()
  }

  function clearFilters() { setRoomId(''); setFrom(''); setTo(''); setOnlyWithAction(false) }

  function acknowledged(result: 'done' | 'stale') {
    setAcknowledging(null)
    notify(result === 'done' ? 'Alert acknowledged. The corrective action was saved.' : 'This alert is no longer open. The list has been updated.')
    reload()
    void refreshAlerts()
  }

  const hasFilters = !!roomId || !!from || !!to || onlyWithAction

  return <>
    <div className="toolbar">
      <div className="button-group alert-tabs" role="tablist" aria-label={tr('Alert status')}>
        {tabs.map((tab, index) => <button key={tab.status} id={`alerts-tab-${tab.status}`} type="button" role="tab" aria-selected={status === tab.status} aria-controls={panelId} tabIndex={status === tab.status ? 0 : -1}
          className={`button ${status === tab.status ? 'primary' : 'outline'}`} onClick={() => changeTab(tab.status)} onKeyDown={event => onTabKey(event, index)} data-testid={`alerts-tab-${tab.status.toLowerCase()}`}>
          {tr(tab.label)}{tab.status === 'OPEN' && openAlerts && <span className="tab-count" aria-label={`${openAlerts.length} ${tr('open alerts')}`}>{openAlerts.length}</span>}
        </button>)}
      </div>
    </div>
    <div className="toolbar filters-bar" role="search" aria-label={tr('Alert filters')}>
      <label>{tr('Room')}<select value={roomId} onChange={event => setRoomId(event.target.value)} data-testid="alerts-filter-room"><option value="">{tr('All rooms')}</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.displayName}</option>)}</select></label>
      <label>{tr('From')}<input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} data-testid="alerts-filter-from"/></label>
      <label>{tr('To')}<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} data-testid="alerts-filter-to"/></label>
      {status !== 'OPEN' && <label className="checkbox-label"><input type="checkbox" checked={onlyWithAction} onChange={event => setOnlyWithAction(event.target.checked)} data-testid="alerts-filter-has-action"/>{tr('Only with corrective action')}</label>}
      {hasFilters && <button type="button" className="button outline small" onClick={clearFilters}>{tr('Clear filters')}</button>}
    </div>
    {invalidRange && <div className="warning-banner" role="alert">{tr('The start date must be before the end date.')}</div>}
    <div id={panelId} role="tabpanel" aria-labelledby={`alerts-tab-${status}`} aria-busy={loading}>
      {error ? <div className="state-bar error" role="alert" data-testid="alerts-error">{tr('Could not load alerts.')} {tr(error)} <button type="button" className="text-link" onClick={reload}>{tr('Try again')}</button></div>
        : loading && !data ? <div className="state-bar" role="status" data-testid="alerts-loading">{tr('Loading alerts…')}</div>
        : !shown.length ? <Empty data-testid="alerts-empty" title={status === 'OPEN' ? 'No open alerts' : status === 'ACKNOWLEDGED' ? 'No acknowledged alerts' : 'No closed alerts'} detail={hasFilters ? 'No alerts match these filters.' : status === 'OPEN' ? 'An alert opens when a value stays above its threshold for the sustained time.' : 'Alerts appear here when they change state.'}/>
        : <Card className="table-card" data-testid="alerts-table"><div className="table-scroll"><table>
          <caption className="sr-only">{tr(tabs.find(tab => tab.status === status)!.label)}</caption>
          <thead><tr><th scope="col">{tr('Room')}</th><th scope="col">{tr('Rule')}</th><th scope="col">{tr('Severity')}</th><th scope="col">{tr('Value')}</th><th scope="col">{tr('Opened')}</th><th scope="col">{tr('Status')}</th><th scope="col">{tr('Corrective action')}</th><th scope="col">{tr('Acknowledged by')}</th><th scope="col">{tr('Action')}</th></tr></thead>
          <tbody>{shown.map(alert => <tr key={alert.id} data-testid="alert-row">
            <td><strong>{alertRoomName(alert, rooms)}</strong></td>
            <td>{ruleLabel(alert.rule)}</td>
            <td><span className={`severity severity-${alert.severity}`}>{tr(alertSeverities[alert.severity] ?? 'Warning')}</span></td>
            <td>{alertValue(alert, language)}</td>
            <td>{dateTime(alert.openedAt, language)}</td>
            <td><span className={`status ${statusClass[alert.status]}`}><i />{tr(statusLabel[alert.status])}</span>
              {alert.status === 'ACKNOWLEDGED' && <small className="cell-note">{dateTime(alert.acknowledgedAt, language)}</small>}
              {alert.status === 'CLOSED' && <small className="cell-note">{dateTime(alert.closedAt, language)} · {tr(alert.closedBy === 'MANUAL' ? 'closed manually' : 'closed automatically')}</small>}</td>
            <td className="wrap-cell">{alert.correctiveAction || <span className="muted">—</span>}</td>
            <td data-testid="alert-acknowledged-by">{alert.acknowledgedByName || <span className="muted">—</span>}</td>
            <td>{alert.status === 'OPEN' ? <button type="button" className="button primary small" onClick={() => setAcknowledging(alert)} aria-label={`${tr('Acknowledge')} · ${alertRoomName(alert, rooms)} · ${ruleLabel(alert.rule)}`} data-testid="alert-acknowledge">{tr('Acknowledge')}</button> : <span className="muted">—</span>}</td>
          </tr>)}</tbody>
        </table></div></Card>}
    </div>
    {acknowledging && <AcknowledgeDialog alert={acknowledging} roomName={alertRoomName(acknowledging, rooms)} onCancel={() => setAcknowledging(null)} onDone={acknowledged}/>}
  </>
}

function AcknowledgeDialog({ alert, roomName, onCancel, onDone }: { alert: Alert; roomName: string; onCancel: () => void; onDone: (result: 'done' | 'stale') => void }) {
  const { session } = useApp()
  const { language } = useLanguage()
  const [action, setAction] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const titleId = useId()
  const hintId = useId()
  const problem = correctiveActionProblem(action)
  const length = action.trim().length

  useEffect(() => {
    const close = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [busy, onCancel])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (problem) return
    setBusy(true)
    setFailure('')
    try {
      await alertingApi.acknowledge(session.token, alert.id, action)
      onDone('done')
    }
    catch (cause) {
      if (isAlertNotOpen(cause)) { onDone('stale'); return }
      setFailure(cause instanceof Error ? cause.message : 'Could not acknowledge the alert')
      setBusy(false)
    }
  }

  const problemText = problem === 'required' ? 'Write the corrective action that was taken.' : problem === 'too-short' ? 'The corrective action needs at least 3 characters.' : problem === 'too-long' ? 'The corrective action can have up to 500 characters.' : ''

  return <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <form className="card modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit} noValidate data-testid="acknowledge-dialog">
      <h2 id={titleId}><CircleCheck />{tr('Acknowledge alert')}</h2>
      <div className="detail-list compact">
        <div><span>{tr('Room')}</span><strong>{roomName}</strong></div>
        <div><span>{tr('Rule')}</span><strong>{ruleLabel(alert.rule)}</strong></div>
        <div><span>{tr('Opened')}</span><strong>{dateTime(alert.openedAt, language)}</strong></div>
      </div>
      <label>{tr('Corrective action')}
        <textarea value={action} onChange={event => setAction(event.target.value)} onBlur={() => setTouched(true)} rows={4} maxLength={correctiveActionLength.max} required autoFocus
          aria-invalid={touched && !!problem} aria-describedby={hintId} placeholder={tr('e.g. Asked the people in the room to lower their voices')} data-testid="acknowledge-action"/>
      </label>
      <p id={hintId} className={`field-hint ${touched && problem ? 'is-error' : ''}`} aria-live="polite">{touched && problem ? tr(problemText) : tr('Between 3 and 500 characters.')} <span>{length}/{correctiveActionLength.max}</span></p>
      {failure && <div className="state-bar error" role="alert">{tr(failure)}</div>}
      <div className="button-row">
        <button type="button" className="button outline" onClick={onCancel} disabled={busy}>{tr('Cancel')}</button>
        <button className="button primary" disabled={busy} data-testid="acknowledge-submit">{tr(busy ? 'Saving…' : 'Acknowledge')}</button>
      </div>
    </form>
  </div>
}
