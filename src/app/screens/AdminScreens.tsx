import { useEffect, useState } from 'react';
import { Activity, Bell, CircleCheck, CloudOff, Copy, DoorOpen, Info, Plus, Radio, Settings2, Thermometer, TriangleAlert, Users, Volume2 } from 'lucide-react';
import { useApp } from '../App';
import { tr } from '../../shared/i18n/i18n';
import { Card, Empty, Kpi, StatusBadge, Unavailable } from '../components/Ui';
import { SensorReadings } from '../components/SensorReadings';
import { hasRecentReading, noiseReading } from '../../contexts/monitoring/domain/models';
import type { Device, Room, RoomType, Reading } from '../../contexts/monitoring/domain/models';
import { monitoringApi } from '../../contexts/monitoring/infrastructure/monitoringApi';
import { alertingApi } from '../../contexts/alerting/infrastructure/alertingApi';
import type { Threshold } from '../../contexts/alerting/domain/models';
import { createEdgeCredential, listEdgeCredentials, listUsers, revokeEdgeCredential, setUserActive } from '../../contexts/identity/infrastructure/identityApi';
import type { EdgeCredential, UserResource } from '../../contexts/identity/infrastructure/identityApi';
import roomKpiIcon from '../../shared/assets/icon-meeting-room1.svg';
import okKpiIcon from '../../shared/assets/icon-check-circle.svg';
import alertKpiIcon from '../../shared/assets/icon-notifications2.svg';
import occupiedKpiIcon from '../../shared/assets/icon-group1.svg';
const metricLabels: Record<string, [
    string,
    string
]> = { laeq: ['Noise (LAeq)', 'dB(A)'], l10: ['Peaks (L10)', 'dB(A)'], ppd: ['Discomfort (PPD)', '%'], temp_c: ['Temperature', '°C'], occupied_pct: ['Occupied time', '%'] };
function roomTypeName(room: Room, types: RoomType[]) { return room.roomType?.displayName || types.find(type => type.id === room.roomTypeId)?.displayName || (room.classified ? tr('Room') : '—'); }
function fmt(value: number | null | undefined, suffix = '') { return value == null ? '—' : `${Number(value.toFixed(1))}${suffix}`; }
function download(name: string, content: string, mime = 'text/csv') { const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
export function Overview() {
    const { rooms, statusFor, openRoom, navigate } = useApp();
    const [floor, setFloor] = useState('all');
    const shown = rooms.filter(room => floor === 'all' || (room.floor || '') === floor);
    const optimal = rooms.filter(room => statusFor(room) === 'optimal').length;
    const occupied = rooms.filter(room => hasRecentReading(room) && (room.latest?.occupiedPct ?? 0) > 50).length;
    return <>
    <div className="kpi-grid four"><Kpi icon=<img src={roomKpiIcon} alt=""/> label="Rooms monitored" value={rooms.length} suffix="rooms"/><Kpi icon=<img src={okKpiIcon} alt=""/> label="Optimal rooms" value={optimal} suffix={`${tr('of')} ${rooms.length}`} status="optimal"/><Kpi icon=<img src={alertKpiIcon} alt=""/> label="Active alerts" value="—" suffix="unavailable"/><Kpi icon=<img src={occupiedKpiIcon} alt=""/> label="Rooms occupied" value={rooms.some(hasRecentReading) ? occupied : '—'} suffix={`${tr("of")} ${rooms.length}`}/></div>
    <div className="overview-grid"><Card className="heatmap"><div className="card-header"><h2>{tr("Heat map")}</h2><div className="button-group"><button className={`button small ${floor === 'all' ? 'primary' : 'outline'}`} onClick={() => setFloor('all')}>{tr("All floors")}</button>{[...new Set(rooms.map(room => room.floor || ''))].sort().map(item => <button className={`button small ${floor === item ? 'primary' : 'outline'}`} key={item} onClick={() => setFloor(item)}>{item ? <>{tr("Floor ")}{item}</> : tr("No floor assigned")}</button>)}</div></div><div className="heatmap-tiles">{shown.map(room => <button className={`room-tile tile-${statusFor(room)}`} key={room.id} onClick={() => openRoom(room)}><strong>{room.displayName}</strong><span>{room.latest ? `${fmt(noiseReading(room.latest).value)} ${noiseReading(room.latest).unit} · ${fmt(room.latest.tempC)} °C · ${hasRecentReading(room) ? tr((room.latest.occupiedPct ?? 0) > 50 ? 'Occupied' : 'Free') : tr('No recent data')}` : tr('No recent reading')}</span><small>{room.latest ? new Date(room.latest.ts).toLocaleString() : '—'}</small><StatusBadge status={statusFor(room)}/></button>)}</div><div className="legend"><StatusBadge status="optimal"/><StatusBadge status="moderate"/><StatusBadge status="bad"/><StatusBadge status="no-data"/></div></Card>
      <div className="overview-side"><Card><h2>{tr("Rooms needing attention")}</h2><p className="muted">{tr("Alert history and corrective actions are not available yet.")}</p><button className="button outline full" onClick={() => navigate('alerts')}><Bell />{tr(" View all alerts")}</button></Card><Card><h2>{tr("Presence · latest reading")}</h2>{rooms.filter(room => room.latest).slice(0, 4).map(room => <div className="progress-row" key={room.id}><div><span>{room.displayName}</span><strong>{tr("Occupancy ")}{Math.round(room.latest?.occupiedPct ?? 0)} %</strong></div><div className="progress"><i style={{ width: `${room.latest?.occupiedPct ?? 0}%` }}/></div></div>)}</Card></div>
    </div>
  </>;
}
export function AdminRooms() {
    const { session, rooms, roomTypes, sites, selectedSite, selectSite, setRooms, setSites, navigate, notify } = useApp();
    const [classifyId, setClassifyId] = useState<string>('');
    const [typeId, setTypeId] = useState('');
    const [addingSite, setAddingSite] = useState(false);
    const [newSite, setNewSite] = useState({ code: '', name: '', address: '', timezone: 'America/Lima' });
    const unclassified = rooms.filter(room => !room.classified);
    const chosen = rooms.find(room => room.id === classifyId) || unclassified[0];
    async function classify() {
        if (!chosen || !typeId) {
            notify('Choose a room type first.');
            return;
        }
        try {
            const updated = await monitoringApi.classifyRoom(session.token, chosen.id, typeId);
            setRooms(items => items.map(room => room.id === chosen.id ? updated : room));
            notify(`${chosen.displayName} ${tr('classified.')}`);
            setClassifyId('');
            setTypeId('');
        }
        catch (cause) {
            notify(cause instanceof Error ? cause.message : 'Could not classify room');
        }
    }
    async function addSite(event: React.FormEvent) {
        event.preventDefault();
        try {
            const created = await monitoringApi.createSite(session.token, newSite);
            setSites(items => [...items, created]);
            setAddingSite(false);
            setNewSite({ code: '', name: '', address: '', timezone: 'America/Lima' });
            notify('Site created.');
        }
        catch (cause) {
            notify(cause instanceof Error ? cause.message : 'Could not create site');
        }
    }
    return <><div className="toolbar"><div className="button-group">{sites.map(site => <button key={site.id} className={`button small ${selectedSite?.id === site.id ? 'primary' : 'outline'}`} onClick={() => selectSite(site.id)} disabled={selectedSite?.id === site.id}>{site.name}</button>)}</div><div className="toolbar-spacer"/><button className="button outline" onClick={() => navigate('room-types')}><Settings2 />{tr("Room types")}</button><button className="button outline" onClick={() => setAddingSite(true)}><Plus />{tr("Add site")}</button><button className="button primary" onClick={() => notify('Rooms are registered automatically when the Edge sends their first reading. Start the device or simulator, then classify it here.')}><Plus />{tr("Add room")}</button></div>
    {unclassified.length > 0 && <div className="warning-banner"><TriangleAlert />{unclassified.length}{tr(" rooms have no type yet, so no thresholds apply to them.")}<button className="button outline small" onClick={() => { setClassifyId(unclassified[0].id); document.getElementById('classify-card')?.scrollIntoView({ behavior: 'smooth' }); }}>{tr("Classify now")}</button></div>}
    <div className="content-with-aside"><Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr("Room")}</th><th>{tr("Code")}</th><th>{tr("Floor")}</th><th>{tr("Type")}</th><th>{tr("Capacity")}</th><th>{tr("Classification")}</th></tr></thead><tbody>{rooms.map(room => <tr key={room.id} onClick={() => { setClassifyId(room.id); setTypeId(room.roomTypeId || ''); }} className="clickable"><td>{room.displayName}</td><td>{room.code}</td><td>{room.floor || '—'}</td><td>{roomTypeName(room, roomTypes)}</td><td>{room.capacity ?? '—'}</td><td><span className={`status ${room.classified ? 'status-optimal' : 'status-moderate'}`}><i />{tr(room.classified ? 'Classified' : 'Unclassified')}</span></td></tr>)}</tbody></table></div></Card><Card id="classify-card"><h2>{tr("Classify room")}</h2><p className="muted">{tr("The room type defines which comfort thresholds the room uses.")}</p><label>{tr("Room")}<select value={chosen?.id || ''} onChange={e => { setClassifyId(e.target.value); setTypeId(''); }}>{rooms.map(room => <option key={room.id} value={room.id}>{room.code} · {room.displayName}</option>)}{rooms.length === 0 && <option>{tr("No unclassified rooms")}</option>}</select></label><div className="radio-list">{roomTypes.map(type => <label key={type.id}><input type="radio" name="roomtype" checked={typeId === type.id} onChange={() => setTypeId(type.id)}/>{type.displayName}</label>)}</div><div className="button-row"><button className="button outline" onClick={() => setTypeId('')}>{tr("Cancel")}</button><button className="button primary" onClick={classify} disabled={!chosen}>{tr("Save type")}</button></div></Card></div>
    {addingSite && <div className="modal-backdrop"><form className="card modal" onSubmit={addSite}><h2>{tr("Add site")}</h2><label>{tr("Name")}<input value={newSite.name} onChange={e => setNewSite({ ...newSite, name: e.target.value })} required/></label><label>{tr("Code")}<input value={newSite.code} onChange={e => setNewSite({ ...newSite, code: e.target.value })} required/></label><label>{tr("Address")}<input value={newSite.address} onChange={e => setNewSite({ ...newSite, address: e.target.value })}/></label><div className="button-row"><button type="button" className="button outline" onClick={() => setAddingSite(false)}>{tr("Cancel")}</button><button className="button primary">{tr("Add site")}</button></div></form></div>}
  </>;
}
export function RoomDetail({ member }: {
    member: boolean;
}) {
    const { selectedRoom: room, devices, session, statusFor, navigate, notify } = useApp();
    const [readings, setReadings] = useState<Reading[]>([]);
    const [metric, setMetric] = useState<'noise' | 'temperature' | 'humidity' | 'occupancy'>('noise');
    useEffect(() => {
        setReadings([]);
        if (!room) return;

        let cancelled = false;
        // Conserva visible la última hora registrada cuando el dispositivo está desconectado.
        const to = new Date(new Date(room.latest?.ts || Date.now()).getTime() + 60000);
        const from = new Date(to.getTime() - 3600000);
        void monitoringApi.readings(session.token, room.id, from.toISOString(), to.toISOString()).then(data => {
            if (!cancelled) setReadings(data);
        }).catch(cause => { if (!cancelled) notify(cause instanceof Error ? cause.message : 'Could not load readings'); });
        return () => { cancelled = true; };
    }, [room?.id, room?.latest?.ts, session.token]);
    if (!room)
        return <Empty title="Select a room" detail="Open a room from the directory." action=<button className="button primary" onClick={() => navigate(member ? 'member-rooms' : 'rooms')}>{tr("View rooms")}</button>/>;
    const status = statusFor(room);
    const noise = noiseReading(room.latest);
    const values = readings.map(item => metric === 'noise' ? (noise.potentiometer ? item.sensors?.potentiometer : item.acoustic?.laeq) : metric === 'temperature' ? item.climate?.tempC : metric === 'humidity' ? item.climate?.rhPct : item.occupancy?.occupiedPct).filter((item): item is number => typeof item === 'number');
    const high = Math.max(...values, 1);
    const low = Math.min(...values, 0);
    const spread = Math.max(1, high - low);
    const points = values.map((value, i) => `${(i / Math.max(1, values.length - 1)) * 100},${90 - ((value - low) / spread) * 65}`).join(' ');
    return <><div className="detail-heading"><div><button className="text-link" onClick={() => navigate(member ? 'member-rooms' : 'rooms')}>{tr("\u2190 Rooms")}</button><h2>{room.displayName}</h2><p>{tr("Rooms / Floor ")}{room.floor || '—'} / {room.displayName}{tr(" \u00B7 capacity ")}{room.capacity ?? '—'}</p></div>{member ? <button className="button primary" onClick={() => navigate('member-report')}>{tr("Report discomfort")}</button> : <div className="button-group"><button className="button outline" onClick={() => navigate('thresholds')}>{tr("Edit thresholds")}</button><button className="button primary" onClick={() => navigate('reports')}>{tr("Report")}</button></div>}</div>
    <div className="status-line"><StatusBadge status={status}/><span>{tr("Last reading ")}{room.latest ? new Date(room.latest.ts).toLocaleString() : tr('unavailable')}</span></div>
    {room.latest && !hasRecentReading(room) && <Unavailable message="These are historical readings. The room has not reported in the last five minutes."/>}
    <div className="kpi-grid detail-kpis"><Kpi icon=<Volume2 /> label={noise.label} value={fmt(noise.value)} suffix={noise.unit} status={noise.potentiometer ? undefined : status}/><Kpi icon=<Thermometer /> label="Temperature" value={fmt(room.latest?.tempC)} suffix="°C"/><Kpi icon=<Activity /> label="Humidity" value={fmt(room.latest?.rhPct)} suffix="%"/><Kpi icon=<Users /> label="Presence" value={hasRecentReading(room) && room.latest?.occupiedPct != null ? tr(room.latest.occupiedPct > 50 ? 'Occupied' : 'Free') : '—'} suffix={room.latest?.occupiedPct == null ? '%' : `${Math.round(room.latest.occupiedPct)} %`}/></div>
    <SensorReadings sensors={room.latest?.sensors}/>
    <div className="content-with-aside wide"><Card><div className="card-header"><h2>{metric === 'noise' ? `${tr(noise.label)} (${noise.unit})` : tr(metric)} · {tr('Last available hour')}</h2><div className="button-group">{!member && (['noise', 'temperature', 'humidity', 'occupancy'] as const).map(item => <button key={item} className={`button small ${metric === item ? 'primary' : 'outline'}`} onClick={() => setMetric(item)}>{tr(item)}</button>)}</div></div>{values.length ? <div className="chart"><div className="chart-grid"><span>{high.toFixed(0)}</span><span>{((high + low) / 2).toFixed(0)}</span><span>{low.toFixed(0)}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${tr(metric)} ${tr('trend')}`}><polyline points={points} fill="none" stroke="#2e86c1" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg></div> : <Empty title="No recent data" detail="The room has not reported readings in this period."/>}</Card><div className="aside-stack">{!member && room.latest?.forecast && room.latest.forecast.probability >= 0.85 && <Card><div className="forecast-warning" role="status">{tr('Early temperature warning')}: {Math.round(room.latest.forecast.probability * 100)}% · {room.latest.forecast.horizonMin} {tr('min forecast')}</div></Card>}<Card><h2>{tr("Door indicator")}</h2><p className="muted">{tr("The light at the door shows the room status.")}</p><div className="inline-note">{tr("Auto \u00B7 follows comfort status")}</div>{!member && <Unavailable message="Indicator commands are not exposed by Cloud API."/>}</Card>{!member && <Card><h2>{tr("Device connectivity")}</h2><>{devices.filter(device => device.roomId === room.id).map(device => <p key={device.id}>{device.code} · {tr(device.silent ? 'Offline' : 'Online')} · {tr('Lost batches')}: {device.lostBatches}</p>)}{!devices.some(device => device.roomId === room.id) && <p className="muted">{tr('No devices registered for this room.')}</p>}</></Card>}</div></div>
  </>;
}
// El estado silent llega calculado por Cloud a partir del último lote del ESP32.
export function Devices() {
    const { devices, rooms, navigate } = useApp();
    const shown: Device[] = devices;
    const online = shown.filter(device => !device.silent).length;
    return <><div className="kpi-grid four"><Kpi icon=<Radio /> label="Registered" value={shown.length} suffix="devices"/><Kpi icon=<CircleCheck /> label="Online" value={online} suffix="devices" status="optimal"/><Kpi icon=<CloudOff /> label="Offline" value={shown.length - online} suffix="devices"/><Kpi icon=<DoorOpen /> label="Unassigned" value={shown.filter(device => !rooms.some(room => room.id === device.roomId)).length} suffix="devices"/></div>
    <div className="toolbar end"><button className="button outline" onClick={() => navigate('diagnostics')}><Activity />{tr('Diagnostics')}</button><button className="button outline" onClick={() => navigate('edge-credentials')}><ShieldIcon />{tr('Edge credentials')}</button></div>
    {shown.length ? <Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr('Device')}</th><th>{tr('Room')}</th><th>{tr('Status')}</th><th>{tr('Last seen')}</th><th>{tr('Firmware')}</th><th>{tr('Lost batches')}</th></tr></thead><tbody>{shown.map(device => <tr key={device.id}><td>{device.code}</td><td>{rooms.find(room => room.id === device.roomId)?.displayName || device.roomId}</td><td><span className={'status ' + (device.silent ? 'status-no-data' : 'status-optimal')}><i />{tr(device.silent ? 'Offline' : 'Online')}</span></td><td>{device.lastSeen ? new Date(device.lastSeen).toLocaleString() : '—'}</td><td>{device.fwVersion || '—'}</td><td>{device.lostBatches}</td></tr>)}</tbody></table></div></Card> : <Empty title="No devices registered" detail="Devices appear after the Edge sends their readings."/>}
    </>;
}
function ShieldIcon() { return <Settings2 />; }
export function Thresholds() {
    const { session, roomTypes, notify, refresh } = useApp();
    const [typeId, setTypeId] = useState('');
    const [items, setItems] = useState<Threshold[]>([]);
    const [original, setOriginal] = useState<Threshold[]>([]);
    const [newMetric, setNewMetric] = useState('');
    const [busy, setBusy] = useState(false);
    const current = roomTypes.some(type => type.id === typeId) ? typeId : roomTypes[0]?.id || '';
    useEffect(() => {
        setItems([]);
        setOriginal([]);
        setNewMetric('');
        if (!current) return;

        let cancelled = false;
        // Los umbrales ausentes se configuran explícitamente, sin completar con ejemplos.
        void alertingApi.thresholds(session.token, current).then(data => {
            if (!cancelled) { setItems(data); setOriginal(data.map(item => ({ ...item }))); }
        }).catch(cause => { if (!cancelled) notify(cause instanceof Error ? cause.message : 'Could not load thresholds'); });
        return () => { cancelled = true; };
    }, [current, session.token]);
    function update(index: number, field: 'warnValue' | 'criticalValue' | 'sustainedMinutes', value: number | null) { setItems(old => old.map((item, i) => i === index ? { ...item, [field]: value } : item)); }
    const invalid = items.some(item => !Number.isFinite(item.warnValue) || item.criticalValue != null && (!Number.isFinite(item.criticalValue) || item.warnValue >= item.criticalValue) || !Number.isInteger(item.sustainedMinutes) || item.sustainedMinutes < 0);
    async function save() { if (invalid) {
        notify('Warning must be below critical. Sustained minutes must be a non-negative integer.');
        return;
    } if (!current) {
        notify('Create a room type before saving thresholds.');
        return;
    } setBusy(true); try {
        const saved = await Promise.all(items.map(item => alertingApi.saveThreshold(session.token, current, item)));
        setItems(saved);
        setOriginal(saved.map(item => ({ ...item })));
        await refresh();
        notify('Thresholds saved.');
    }
    catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Could not save thresholds');
    }
    finally {
        setBusy(false);
    } }
    return <><div className="toolbar"><div className="button-group">{roomTypes.map(type => <button key={type.id} className={`button ${current === type.id ? 'primary' : 'outline'}`} onClick={() => setTypeId(type.id)}>{type.displayName}</button>)}</div><label>{tr("Metric")}<select value={newMetric} onChange={event => setNewMetric(event.target.value)} disabled={!current}><option value="">{tr("Select a metric")}</option>{Object.entries(metricLabels).filter(([metric]) => !items.some(item => item.metric === metric)).map(([metric, labels]) => <option key={metric} value={metric}>{tr(labels[0])}</option>)}</select></label><button className="button outline" disabled={!current || !newMetric} onClick={() => { setItems(old => [...old, { metric: newMetric, warnValue: 0, criticalValue: null, sustainedMinutes: 1, enabled: true }]); setNewMetric(''); }}>{tr("Add metric")}</button><div className="toolbar-spacer"/><button className="button outline" onClick={() => setItems(original.map(item => ({ ...item })))}>{tr("Discard")}</button><button className="button primary" disabled={!items.length || busy || invalid} onClick={save}>{tr("Save thresholds")}</button></div>{invalid && <div className="warning-banner"><TriangleAlert />{tr("Warning must be below critical. Sustained minutes must be a non-negative integer.")}</div>}{items.length ? <Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr("Metric")}</th><th>{tr("Unit")}</th><th>{tr("Warning")}</th><th>{tr("Critical")}</th><th>{tr("Sustained (min)")}</th></tr></thead><tbody>{items.map((item, i) => <tr key={item.metric}><td><strong>{tr(metricLabels[item.metric]?.[0] || item.metric)}</strong></td><td>{metricLabels[item.metric]?.[1] || '—'}</td><td><input className="table-input" type="number" value={item.warnValue} onChange={event => update(i, 'warnValue', Number(event.target.value))}/></td><td><input className="table-input" type="number" value={item.criticalValue ?? ''} onChange={event => update(i, 'criticalValue', event.target.value === '' ? null : Number(event.target.value))}/></td><td><input className="table-input" type="number" min="0" step="1" value={item.sustainedMinutes} onChange={event => update(i, 'sustainedMinutes', Number(event.target.value))}/></td></tr>)}</tbody></table></div></Card> : <Empty title="No thresholds configured" detail="The selected room type has no thresholds yet. The Cloud API can save a new metric once you configure it."/>}<Card className="help-card"><h2><Info />{tr(" How alerts work")}</h2><p>{tr("An alert opens when a value stays above its threshold for the sustained minutes, and closes when the room returns to normal. Edge devices download the new values, so alerts keep working without internet.")}</p></Card></>;
}
export function Alerts() {
    return <Empty title="Alerts unavailable" detail="Alert history and corrective actions are not available yet."/>;
}
export function Reports() {
    const { session, rooms, notify } = useApp();
    const [tab, setTab] = useState<'discomfort' | 'historical'>('historical');
    const [roomId, setRoomId] = useState('all');
    const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    async function generate() {
        const chosen = roomId === 'all' ? rooms : rooms.filter(room => room.id === roomId);
        try {
            const series = await Promise.all(chosen.map(async (room) => ({ room, readings: await monitoringApi.readings(session.token, room.id, new Date(`${from}T00:00:00Z`).toISOString(), new Date(`${to}T23:59:59Z`).toISOString()) })));
            const lines = ['room,room_code,timestamp,noise_dba,potentiometer_adc,temperature_c,humidity_pct,occupied_pct', ...series.flatMap(({ room, readings }) => readings.map(reading => [room.displayName, room.code, reading.ts, reading.acoustic?.laeq ?? '', reading.sensors?.potentiometer ?? '', reading.climate?.tempC ?? '', reading.climate?.rhPct ?? '', reading.occupancy?.occupiedPct ?? ''].join(',')))];
            download('sensework-historical-report.csv', lines.join('\n'));
            notify('Historical CSV generated.');
        }
        catch (cause) {
            notify(cause instanceof Error ? cause.message : 'Could not generate report');
        }
    }
    return <><div className="toolbar"><div className="button-group"><button className={`button ${tab === 'discomfort' ? 'primary' : 'outline'}`} onClick={() => setTab('discomfort')}>{tr("Discomfort reports")}</button><button className={`button ${tab === 'historical' ? 'primary' : 'outline'}`} onClick={() => setTab('historical')}>{tr("Historical reports")}</button></div></div>{tab === 'discomfort' ? <Empty title="No discomfort reports available" detail="Discomfort reports are not available yet."/> : <Card className="report-form"><h2>{tr("Generate historical report")}</h2><div className="form-grid"><label>{tr("Room")}<select value={roomId} onChange={event => setRoomId(event.target.value)}><option value="all">{tr("All rooms")}</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.displayName}</option>)}</select></label><label>{tr("From")}<input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label><label>{tr("To")}<input type="date" value={to} onChange={event => setTo(event.target.value)}/></label><label>{tr("Format")}<select value="CSV" disabled><option>{tr("CSV")}</option></select></label></div><p className="muted">{tr("Historical data is exported from the Cloud API as CSV.")}</p><button className="button primary" disabled={from > to} onClick={generate}>{tr("Generate report")}</button></Card>}</>;
}
export function Members() {
    const { session, notify } = useApp();
    const [search, setSearch] = useState('');
    const [members, setMembers] = useState<UserResource[]>([]);
    const [tick, setTick] = useState(0);
    async function toggle(member: UserResource) { try {
        await setUserActive(session.token, member.id, !member.active);
        notify(member.active ? 'Account deactivated.' : 'Account reactivated.');
        setTick(value => value + 1);
    }
    catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Could not update the account');
    } }
    useEffect(() => {
        let cancelled = false;
        // El directorio muestra exclusivamente las cuentas registradas en Cloud.
        void listUsers(session.token).then(users => {
            if (!cancelled) setMembers(users);
        }).catch(cause => { if (!cancelled) notify(cause instanceof Error ? cause.message : 'Could not load members'); });
        return () => { cancelled = true; };
    }, [session.token, tick]);
    const filtered = members.filter(member => (member.displayName + ' ' + member.email).toLowerCase().includes(search.toLowerCase()));
    return <><div className="toolbar"><label className="search-field">{tr('Search')}<input placeholder={tr('Name or email')} value={search} onChange={event => setSearch(event.target.value)}/></label><div className="toolbar-spacer"/><button className="button primary" disabled><Plus />{tr('Invite member')}</button></div>
    <div className="content-with-aside wide"><Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr('Name')}</th><th>{tr('Email')}</th><th>{tr('Role')}</th><th>{tr('Status')}</th><th>{tr('Action')}</th></tr></thead><tbody>{filtered.map(member => <tr key={member.id}><td>{member.displayName}</td><td>{member.email}</td><td>{tr(member.roles.includes('ADMIN') ? 'Admin' : 'Member')}</td><td><span className={'status ' + (member.active ? 'status-optimal' : 'status-no-data')}><i />{tr(member.active ? 'Active' : 'Deactivated')}</span></td><td>{member.roles.includes('ADMIN') ? '—' : <button className="text-link" onClick={() => toggle(member)}>{tr(member.active ? 'Deactivate' : 'Reactivate')}</button>}</td></tr>)}</tbody></table></div>{!filtered.length && <p className="table-empty">{tr('No members match your search.')}</p>}</Card><Card><h2>{tr('Invite member')}</h2><Unavailable message="Invitations by email are not available yet: accounts are created with a password from the sign-up form."/></Card></div></>;
}
// Las claves solo aparecen al crearlas; la lista nunca solicita ni conserva claves antiguas.
export function EdgeCredentials() {
    const { session, notify } = useApp();
    const [code, setCode] = useState('');
    const [key, setKey] = useState('');
    const [keyId, setKeyId] = useState('');
    const [busy, setBusy] = useState(false);
    const [credentials, setCredentials] = useState<EdgeCredential[]>([]);
    useEffect(() => {

        let cancelled = false;
        void listEdgeCredentials(session.token).then(data => { if (!cancelled) setCredentials(data); }).catch(cause => { if (!cancelled) notify(cause instanceof Error ? cause.message : 'Could not load credentials'); });
        return () => { cancelled = true; };
    }, [session.token]);
    async function create(event: React.FormEvent) {
        event.preventDefault();
        if (!code.trim()) return;
        setBusy(true);
        setKey('');
        try {
            const created = await createEdgeCredential(session.token, code.trim());
            setKey(created.apiKey);
            setKeyId(created.id);
            setCredentials(old => [...old, { id: created.id, code: created.code, active: created.active, scopes: created.scopes }]);
            setCode('');
            notify('Credential created. Copy the key now; the API returns it only once.');
        } catch (cause) { notify(cause instanceof Error ? cause.message : 'Could not create credential'); }
        finally { setBusy(false); }
    }
    async function revoke(credential: EdgeCredential) {
        setBusy(true);
        try {
            await revokeEdgeCredential(session.token, credential.id);
            setCredentials(old => old.map(item => item.id === credential.id ? { ...item, active: false } : item));
            if (keyId === credential.id) setKey('');
            notify('Credential revoked.');
        } catch (cause) { notify(cause instanceof Error ? cause.message : 'Could not revoke credential'); }
        finally { setBusy(false); }
    }
    return <div className="content-with-aside wide"><Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr('Node')}</th><th>{tr('Permissions')}</th><th>{tr('Status')}</th><th>{tr('Action')}</th></tr></thead><tbody>{credentials.map(item => <tr key={item.id}><td>{item.code}</td><td>{item.scopes.join(', ')}</td><td>{tr(item.active ? 'Active' : 'Revoked')}</td><td>{item.active && <button className="text-link" disabled={busy} onClick={() => void revoke(item)}>{tr('Revoke')}</button>}</td></tr>)}</tbody></table>{!credentials.length && <p className="table-empty">{tr('No credentials registered.')}</p>}</div></Card>
    <Card><h2>{tr('New credential')}</h2><p className="muted">{tr('Create one key per edge node. It can send readings, download thresholds and report its heartbeat.')}</p><form onSubmit={create}><label>{tr('Node name')}<input value={code} onChange={event => setCode(event.target.value)} required/></label><button className="button primary full" disabled={busy || !code.trim()}>{tr('Generate key')}</button></form>{key && <div className="generated-key"><strong>{tr('Copy this key now')}</strong><code>{key}</code><button className="button outline" onClick={() => { void navigator.clipboard.writeText(key).then(() => notify('Key copied.')).catch(() => notify('Could not copy the key. Select and copy it manually.')); }}><Copy />{tr('Copy key')}</button></div>}</Card></div>;
}
export function RoomTypes() {
    const { session, selectedSite, roomTypes, setRoomTypes, navigate, notify } = useApp();
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    async function add(event: React.FormEvent) { event.preventDefault(); if (!selectedSite)
        return; try {
        const created = await monitoringApi.createRoomType(session.token, selectedSite.id, { code, displayName: name, description: '' });
        setRoomTypes(items => [...items, created]);
        setCode('');
        setName('');
        notify('Room type created.');
    }
    catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Could not create room type');
    } }
    return <><button className="text-link back-link" onClick={() => navigate('rooms')}>{tr("\u2190 Sites and rooms")}</button><div className="content-with-aside wide"><Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr("Type")}</th><th>{tr("Code")}</th><th>{tr("Action")}</th></tr></thead><tbody>{roomTypes.map(type => <tr key={type.id}><td>{type.displayName}</td><td>{type.code}</td><td><button className="text-link" onClick={() => navigate('thresholds')}>{tr("Edit thresholds")}</button></td></tr>)}</tbody></table></div></Card><Card><h2>{tr("Add room type")}</h2><p className="muted">{tr("Configure its comfort thresholds after creating it.")}</p><form onSubmit={add}><label>{tr("Code")}<input value={code} onChange={event => setCode(event.target.value)} placeholder={tr("e.g. phone-booth")} required/></label><label>{tr("Display name")}<input value={name} onChange={event => setName(event.target.value)} placeholder={tr("e.g. Phone booth")} required/></label><div className="button-row"><button type="button" className="button outline" onClick={() => navigate('rooms')}>{tr("Cancel")}</button><button className="button primary">{tr("Add type")}</button></div></form></Card></div></>;
}
// Cloud determina online/stale/offline con el latido recibido de cada gateway.
export function Diagnostics() {
    const { gateways, devices, session } = useApp();

    if (session.role !== 'ADMIN') return <Empty title="Administrator access required" detail="Only administrators can view Edge diagnostics."/>;
    return <><div className="kpi-grid four"><Kpi icon=<Radio /> label="Edge nodes" value={gateways.length} suffix="nodes"/><Kpi icon=<CircleCheck /> label="Online" value={gateways.filter(gateway => gateway.status === 'online').length} suffix="nodes"/><Kpi icon=<Activity /> label="Pending upload" value={gateways.reduce((total, gateway) => total + gateway.pendingUpload, 0)} suffix="minutes"/><Kpi icon=<Radio /> label="Devices" value={devices.length} suffix="devices"/></div>
    {gateways.length ? <Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr('Node')}</th><th>{tr('Status')}</th><th>{tr('Last seen')}</th><th>{tr('Version')}</th><th>{tr('Pending upload')}</th><th>{tr('Rooms')}</th></tr></thead><tbody>{gateways.map(gateway => <tr key={gateway.id}><td>{gateway.code}</td><td>{tr(gateway.status === 'online' ? 'Online' : gateway.status === 'stale' ? 'Delayed heartbeat' : 'Offline')}</td><td>{gateway.lastSeen ? new Date(gateway.lastSeen).toLocaleString() : '—'}</td><td>{gateway.version || '—'}</td><td>{gateway.pendingUpload}</td><td>{gateway.roomsReported}</td></tr>)}</tbody></table></div></Card> : <Empty title="No Edge nodes registered" detail="Edge nodes appear after their first heartbeat."/>}</>;
}
