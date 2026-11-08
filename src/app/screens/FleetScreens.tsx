import { useCallback, useEffect, useState } from 'react'
import { Activity, CircleCheck, CloudOff, DoorOpen, Radio } from 'lucide-react'
import { useApp } from '../App'
import { tr } from '../../shared/i18n/i18n'
import { Card, Empty, Kpi, Unavailable } from '../components/Ui'
import { fleetApi } from '../../contexts/monitoring/infrastructure/fleetApi'

function useLoad<T>(load: (token: string) => Promise<T>, deps: unknown[] = []) {
  const { session } = useApp()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    setError('')
    load(session.token).then(value => { if (!cancelled) setData(value) }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load data') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, tick, ...deps])
  return { data, error, reload: useCallback(() => setTick(value => value + 1), []) }
}

const when = (value: string | null) => value ? new Date(value).toLocaleString() : tr('Never reported')

export function DevicesLive() {
  const { rooms, navigate } = useApp()
  const { data, error } = useLoad(fleetApi.devices)
  if (error) return <Empty title="Could not load devices" detail={error} />
  if (!data) return <div className="insights-loading" role="status">{tr('Loading current data…')}</div>
  const online = data.filter(device => !device.silent).length
  const unassigned = data.filter(device => !rooms.some(room => room.id === device.roomId)).length
  return <>
    <div className="kpi-grid four">
      <Kpi icon={<Radio />} label="Registered" value={data.length} suffix="devices" />
      <Kpi icon={<CircleCheck />} label="Online" value={online} suffix="devices" status="optimal" />
      <Kpi icon={<CloudOff />} label="Offline" value={data.length - online} suffix="devices" status={data.length - online ? 'bad' : undefined} />
      <Kpi icon={<DoorOpen />} label="Unassigned" value={unassigned} suffix="devices" />
    </div>
    <div className="toolbar end">
      <button className="button outline" onClick={() => navigate('diagnostics')}><Activity />{tr('Diagnostics')}</button>
      <button className="button outline" onClick={() => navigate('edge-credentials')}>{tr('Edge credentials')}</button>
    </div>
    <Card className="table-card"><div className="table-scroll"><table>
      <thead><tr><th>{tr('Device')}</th><th>{tr('Room')}</th><th>{tr('Status')}</th><th>{tr('Last seen')}</th><th>{tr('Lost batches')}</th></tr></thead>
      <tbody>{data.map(device => <tr key={device.id}>
        <td>{device.code}</td>
        <td>{rooms.find(room => room.id === device.roomId)?.displayName ?? '—'}</td>
        <td><span className={`status ${device.silent ? 'status-no-data' : 'status-optimal'}`}><i />{tr(device.silent ? 'Offline' : 'Online')}</span></td>
        <td>{when(device.lastSeen)}</td>
        <td>{device.lostBatches}</td>
      </tr>)}</tbody>
    </table></div>{!data.length && <div className="table-empty">{tr('No device has reported yet. Devices appear when their first reading arrives.')}</div>}</Card>
  </>
}

export function DiagnosticsLive() {
  const { data: edges, error } = useLoad(fleetApi.edges)
  const { data: devices } = useLoad(fleetApi.devices)
  if (error) return <Empty title="Could not load diagnostics" detail={error} />
  if (!edges) return <div className="insights-loading" role="status">{tr('Loading current data…')}</div>
  const online = edges.filter(edge => edge.status === 'online').length
  const pending = edges.reduce((sum, edge) => sum + edge.pendingUpload, 0)
  return <>
    <div className="kpi-grid four">
      <Kpi icon={<CircleCheck />} label="Edge status" value={`${online}/${edges.length}`} suffix="online" status={edges.length && online === edges.length ? 'optimal' : 'bad'} />
      <Kpi icon={<Radio />} label="Devices" value={devices ? devices.filter(device => !device.silent).length : '—'} suffix="reporting" />
      <Kpi icon={<Activity />} label="Pending upload" value={pending} suffix="minutes" />
      <Kpi icon={<DoorOpen />} label="Rooms reported" value={edges.reduce((sum, edge) => sum + edge.roomsReported, 0)} suffix="rooms" />
    </div>
    <Card className="table-card"><div className="table-scroll"><table>
      <thead><tr><th>{tr('Edge node')}</th><th>{tr('Status')}</th><th>{tr('Version')}</th><th>{tr('Last seen')}</th><th>{tr('Pending upload')}</th><th>{tr('Rooms reported')}</th></tr></thead>
      <tbody>{edges.map(edge => <tr key={edge.id}>
        <td>{edge.code}</td>
        <td><span className={`status ${edge.status === 'online' ? 'status-optimal' : 'status-no-data'}`}><i />{tr(edge.status === 'online' ? 'Online' : 'Offline')}</span></td>
        <td>{edge.version ?? '—'}</td><td>{when(edge.lastSeen)}</td><td>{edge.pendingUpload}</td><td>{edge.roomsReported}</td>
      </tr>)}</tbody>
    </table></div>{!edges.length && <div className="table-empty">{tr('No Edge node has sent a heartbeat yet.')}</div>}</Card>
  </>
}

export function MembersLive() {
  const { session, notify } = useApp()
  const { data, error, reload } = useLoad(fleetApi.users)
  const [search, setSearch] = useState('')
  async function toggle(id: string, active: boolean) {
    try { await fleetApi.setUserActive(session.token, id, active); notify(active ? 'Account reactivated.' : 'Account deactivated.'); reload() }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'Could not update the account') }
  }
  if (error) return <Empty title="Could not load members" detail={error} />
  if (!data) return <div className="insights-loading" role="status">{tr('Loading current data…')}</div>
  const shown = data.filter(user => `${user.displayName} ${user.email}`.toLowerCase().includes(search.toLowerCase()))
  return <>
    <div className="toolbar">
      <label className="search-field">{tr('Search')}<input placeholder={tr('Name or email')} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="toolbar-spacer" />
    </div>
    <Card className="table-card"><div className="table-scroll"><table>
      <thead><tr><th>{tr('Name')}</th><th>{tr('Email')}</th><th>{tr('Role')}</th><th>{tr('Status')}</th><th>{tr('Action')}</th></tr></thead>
      <tbody>{shown.map(user => {
        const admin = user.roles.includes('ADMIN')
        return <tr key={user.id}>
          <td>{user.displayName}</td><td>{user.email}</td><td>{tr(admin ? 'Admin' : 'Member')}</td>
          <td><span className={`status ${user.active ? 'status-optimal' : 'status-no-data'}`}><i />{tr(user.active ? 'Active' : 'Deactivated')}</span></td>
          <td>{admin ? '—' : <button className="text-link" onClick={() => toggle(user.id, !user.active)}>{tr(user.active ? 'Deactivate' : 'Reactivate')}</button>}</td>
        </tr>
      })}</tbody>
    </table></div></Card>
    <Unavailable message="Invitations by email are not available yet: accounts are created with a password from the sign-up form." />
  </>
}

export function CredentialsTable({ refreshKey }: { refreshKey: string }) {
  const { session, notify } = useApp()
  const { data, error, reload } = useLoad(fleetApi.credentials, [refreshKey])
  async function revoke(id: string) {
    try { await fleetApi.revokeCredential(session.token, id); notify('Credential revoked.'); reload() }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'Could not revoke the credential') }
  }
  if (error) return <div className="table-empty">{error}</div>
  if (!data) return <div className="table-empty">{tr('Loading current data…')}</div>
  return <div className="table-scroll"><table>
    <thead><tr><th>{tr('Node')}</th><th>{tr('Permissions')}</th><th>{tr('Status')}</th><th>{tr('Action')}</th></tr></thead>
    <tbody>{data.map(item => <tr key={item.id}>
      <td>{item.code}</td><td>{item.scopes.join(', ')}</td>
      <td><span className={`status ${item.active ? 'status-optimal' : 'status-no-data'}`}><i />{tr(item.active ? 'Active' : 'Revoked')}</span></td>
      <td>{item.active && <button className="text-link" onClick={() => revoke(item.id)}>{tr('Revoke')}</button>}</td>
    </tr>)}</tbody>
  </table>{!data.length && <div className="table-empty">{tr('No credentials yet.')}</div>}</div>
}
