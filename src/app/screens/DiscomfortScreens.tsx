import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Send } from 'lucide-react'
import { useApp } from '../App'
import { useLoad } from '../hooks/useLoad'
import { Card, Empty } from '../components/Ui'
import { tr, useLanguage } from '../../shared/i18n/i18n'
import type { Language } from '../../shared/i18n/i18n'
import { ApiError } from '../../shared/api/http'
import { dateTime, daysAgoInput, dateInput, dayEndIso, dayStartIso, decimal } from '../../shared/format/dates'
import { categoryLabel, discomfortCategories, discomfortCommentMax, discrepancyReasonLabel } from '../../contexts/monitoring/domain/discomfort'
import type { DiscomfortCategory, DiscomfortReading, DiscomfortReport } from '../../contexts/monitoring/domain/discomfort'
import { discomfortApi, isTooFrequent } from '../../contexts/monitoring/infrastructure/discomfortApi'
import type { Room } from '../../contexts/monitoring/domain/models'

function roomName(roomId: string, roomCode: string, rooms: Room[]) { return rooms.find(room => room.id === roomId)?.displayName || roomCode }

/** Lectura que Cloud guardó con el reporte: lo que marcaba el sensor cuando el miembro se quejó. */
function ReadingAtMoment({ reading, language }: { reading: DiscomfortReading | null; language: Language }) {
  if (!reading) return <span className="muted">{tr('No recent reading')}</span>
  return <span className="reading-chips">
    <span>{decimal(reading.laeq, language, 0)} dB(A)</span>
    <span>{decimal(reading.tempC, language)} °C</span>
    <span>{decimal(reading.rhPct, language, 0)} % {tr('RH')}</span>
    <span>{tr('Occupied')} {decimal(reading.occupiedPct, language, 0)} %</span>
    <small>{dateTime(reading.ts, language)}</small>
  </span>
}

// ── Miembro: enviar un reporte (US27) ─────────────────────────────────────
export function MemberReport() {
  const { session, rooms, selectedRoom, notify } = useApp()
  const { language } = useLanguage()
  const preferred = selectedRoom && rooms.some(room => room.id === selectedRoom.id) ? selectedRoom.id : rooms[0]?.id ?? ''
  const [chosenRoom, setChosenRoom] = useState('')
  const roomId = rooms.some(room => room.id === chosenRoom) ? chosenRoom : preferred
  const [category, setCategory] = useState<DiscomfortCategory | ''>('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [touched, setTouched] = useState(false)
  const mine = useLoad(signal => discomfortApi.mine(session.token, signal), [session.token])
  const reasonId = useId()
  const commentHint = useId()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    setFormError('')
    if (!roomId || !category) return
    setBusy(true)
    try {
      await discomfortApi.file(session.token, { roomId, category, comment })
      notify('Report sent. The site team will review it.')
      setCategory('')
      setComment('')
      setTouched(false)
      mine.reload()
    }
    catch (cause) {
      if (isTooFrequent(cause)) setFormError('You already reported this reason for this room in the last 10 minutes. Please try again later.')
      else if (cause instanceof ApiError && cause.status === 404) setFormError('This room is no longer available. Choose another room.')
      else setFormError(cause instanceof Error ? cause.message : 'Could not send the report')
    }
    finally { setBusy(false) }
  }

  if (!rooms.length) return <Empty title="No rooms available" detail="Rooms appear when their sensors send the first reading."/>
  const reports = mine.data ?? []

  return <div className="content-with-aside wide">
    <Card className="report-form">
      <h2>{tr('What bothers you?')}</h2>
      <p className="muted">{tr('The site team receives your report together with the room reading of that moment. Your name is not shown to them.')}</p>
      <form onSubmit={submit} noValidate data-testid="discomfort-form">
        <label>{tr('Room')}<select value={roomId} onChange={event => setChosenRoom(event.target.value)} required data-testid="discomfort-room">{rooms.map(room => <option key={room.id} value={room.id}>{room.displayName}</option>)}</select></label>
        <fieldset className="choice-group" aria-describedby={touched && !category ? reasonId : undefined}>
          <legend>{tr('Reason')}</legend>
          <div className="radio-list">{discomfortCategories.map(item => <label key={item.value}><input type="radio" name="discomfort-category" value={item.value} checked={category === item.value} onChange={() => setCategory(item.value)} data-testid={`discomfort-category-${item.value.toLowerCase()}`}/>{tr(item.label)}</label>)}</div>
          {touched && !category && <p id={reasonId} className="field-hint is-error" role="alert">{tr('Choose a reason.')}</p>}
        </fieldset>
        <label>{tr('Comment (optional)')}<textarea value={comment} onChange={event => setComment(event.target.value)} rows={4} maxLength={discomfortCommentMax} aria-describedby={commentHint} placeholder={tr('e.g. It is warm near the window')} data-testid="discomfort-comment"/></label>
        <p id={commentHint} className="field-hint">{tr('Up to 500 characters.')} <span>{comment.length}/{discomfortCommentMax}</span></p>
        {formError && <div className="state-bar error" role="alert" data-testid="discomfort-error">{tr(formError)}</div>}
        <div className="button-row"><button className="button primary" disabled={busy} data-testid="discomfort-submit"><Send />{tr(busy ? 'Sending…' : 'Send report')}</button></div>
      </form>
    </Card>
    <Card data-testid="my-reports">
      <h2>{tr('My reports')}</h2>
      {mine.error ? <div className="state-bar error" role="alert">{tr('Could not load your reports.')} {tr(mine.error)} <button type="button" className="text-link" onClick={mine.reload}>{tr('Try again')}</button></div>
        : mine.loading && !mine.data ? <p className="muted" role="status">{tr('Loading your reports…')}</p>
        : <>
          <p className="muted" aria-live="polite"><strong>{reports.length}</strong> {tr(reports.length === 1 ? 'report sent' : 'reports sent')}</p>
          {reports.length ? <ul className="plain-list report-list">{reports.slice(0, 10).map(report => <li key={report.id}><strong>{roomName(report.roomId, report.roomCode, rooms)} · {tr(categoryLabel(report.category))}</strong><small>{dateTime(report.createdAt, language)}</small>{report.comment && <p>{report.comment}</p>}</li>)}</ul>
            : <p className="muted">{tr('You have not sent any report yet.')}</p>}
        </>}
    </Card>
  </div>
}

// ── Administrador: reportes del local con la lectura del momento (US28) ──
export function DiscomfortReportsPanel() {
  const { session, rooms, refreshMs } = useApp()
  const { language } = useLanguage()
  const [roomId, setRoomId] = useState('')
  const [category, setCategory] = useState<DiscomfortCategory | ''>('')
  const [from, setFrom] = useState(daysAgoInput(30))
  const [to, setTo] = useState(dateInput())
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState(false)
  const invalidRange = !!from && !!to && from > to
  const range = { from: dayStartIso(from), to: dayEndIso(to) }
  const reports = useLoad(signal => invalidRange ? Promise.resolve<DiscomfortReport[]>([])
    : discomfortApi.list(session.token, { roomId: roomId || undefined, category: category || undefined, discrepancyOnly: onlyDiscrepancies, ...range }, signal),
  [session.token, roomId, category, from, to, invalidRange, onlyDiscrepancies], refreshMs)
  const summary = useLoad(signal => invalidRange ? Promise.resolve([]) : discomfortApi.summary(session.token, range, signal),
    [session.token, from, to, invalidRange], refreshMs)
  // Cloud no filtra por local: solo se muestran las salas del local elegido.
  const inSite = (id: string) => rooms.some(room => room.id === id)
  const shownReports = (reports.data ?? []).filter(report => inSite(report.roomId))
  const shownSummary = (summary.data ?? []).filter(item => inSite(item.roomId) && (!roomId || item.roomId === roomId) && item.total > 0).sort((a, b) => b.total - a.total)

  return <div className="discomfort-panel" data-testid="discomfort-panel">
    <div className="toolbar filters-bar" role="search" aria-label={tr('Discomfort report filters')}>
      <label>{tr('Room')}<select value={roomId} onChange={event => setRoomId(event.target.value)} data-testid="discomfort-filter-room"><option value="">{tr('All rooms')}</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.displayName}</option>)}</select></label>
      <label>{tr('Reason')}<select value={category} onChange={event => setCategory(event.target.value as DiscomfortCategory | '')} data-testid="discomfort-filter-category"><option value="">{tr('All reasons')}</option>{discomfortCategories.map(item => <option key={item.value} value={item.value}>{tr(item.label)}</option>)}</select></label>
      <label>{tr('From')}<input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)}/></label>
      <label>{tr('To')}<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)}/></label>
      <label className="checkbox-label"><input type="checkbox" checked={onlyDiscrepancies} onChange={event => setOnlyDiscrepancies(event.target.checked)} data-testid="discomfort-filter-discrepancy"/>{tr('Only discrepancies')}</label>
    </div>
    {invalidRange && <div className="warning-banner" role="alert">{tr('The start date must be before the end date.')}</div>}

    <section aria-labelledby="discomfort-summary-title" className="discomfort-summary-section">
      <h2 id="discomfort-summary-title" className="section-title">{tr('Reports by room')}</h2>
      {summary.error ? <div className="state-bar error" role="alert">{tr('Could not load the summary.')} {tr(summary.error)} <button type="button" className="text-link" onClick={summary.reload}>{tr('Try again')}</button></div>
        : summary.loading && !summary.data ? <div className="state-bar" role="status">{tr('Loading summary…')}</div>
        : shownSummary.length ? <div className="discomfort-summary" data-testid="discomfort-summary">{shownSummary.map(item => <Card key={item.roomId} className="summary-card">
            <div className="summary-head"><strong>{roomName(item.roomId, item.roomCode, rooms)}</strong><span className="summary-total">{item.total} <small>{tr(item.total === 1 ? 'report' : 'reports')}</small></span></div>
            <dl className="summary-counts">
              <div><dt>{tr('Too noisy')}</dt><dd>{item.noise}</dd></div>
              <div><dt>{tr('Too warm')}</dt><dd>{item.warm}</dd></div>
              <div><dt>{tr('Too cold')}</dt><dd>{item.cold}</dd></div>
              <div className="is-discrepancy"><dt>{tr('Discrepancies')}</dt><dd data-testid="summary-discrepancies">{item.discrepancies ?? 0}</dd></div>
            </dl>
          </Card>)}</div>
        : <p className="muted">{tr('No reports in this period.')}</p>}
    </section>

    {reports.error ? <div className="state-bar error" role="alert" data-testid="discomfort-list-error">{tr('Could not load discomfort reports.')} {tr(reports.error)} <button type="button" className="text-link" onClick={reports.reload}>{tr('Try again')}</button></div>
      : reports.loading && !reports.data ? <div className="state-bar" role="status">{tr('Loading discomfort reports…')}</div>
      : shownReports.length ? <Card className="table-card" data-testid="discomfort-table"><div className="table-scroll"><table>
          <caption className="sr-only">{tr('Discomfort reports')}</caption>
          <thead><tr><th scope="col">{tr('Room')}</th><th scope="col">{tr('Reason')}</th><th scope="col">{tr('Comment')}</th><th scope="col">{tr('Sent')}</th><th scope="col">{tr('Reading at that moment')}</th></tr></thead>
          <tbody>{shownReports.map(report => <tr key={report.id} data-testid="discomfort-row">
            <td><strong>{roomName(report.roomId, report.roomCode, rooms)}</strong></td>
            <td><span className={`reason reason-${report.category.toLowerCase()}`}>{tr(categoryLabel(report.category))}</span></td>
            <td className="wrap-cell">{report.comment || <span className="muted">—</span>}</td>
            <td>{dateTime(report.createdAt, language)}</td>
            <td><ReadingAtMoment reading={report.reading} language={language}/>{report.discrepancy && <span className="discrepancy-badge" data-testid="discrepancy-badge"><strong>{tr('Discrepancy')}</strong>{report.discrepancyReason && <small>{tr(discrepancyReasonLabel(report.discrepancyReason))}</small>}</span>}</td>
          </tr>)}</tbody>
        </table></div></Card>
      : <Empty data-testid="discomfort-empty" title="No discomfort reports" detail={roomId || category || onlyDiscrepancies ? 'No reports match these filters.' : 'Members can report noise or temperature problems from their app.'}/>}
  </div>
}
