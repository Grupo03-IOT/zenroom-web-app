import { useEffect, useState } from 'react';
import { Activity, Bell, CircleCheck, CloudOff, Copy, DoorOpen, Info, Plus, Radio, Settings2, Thermometer, TriangleAlert, Users, Volume2 } from 'lucide-react';
import { useApp } from '../App';
import { tr } from '../../shared/i18n/i18n';
import { Card, Empty, Kpi, StatusBadge, Unavailable } from '../components/Ui';
import { roomStatus } from '../../contexts/monitoring/domain/models';
import type { Room, RoomType, Reading } from '../../contexts/monitoring/domain/models';
import { monitoringApi } from '../../contexts/monitoring/infrastructure/monitoringApi';
import { alertingApi } from '../../contexts/alerting/infrastructure/alertingApi';
import type { EdgeAlert, Threshold } from '../../contexts/alerting/domain/models';
import { createEdgeCredential } from '../../contexts/identity/infrastructure/identityApi';
import { demoReadings, demoThresholds } from '../../shared/demo/data';
import roomKpiIcon from '../../shared/assets/icon-meeting-room1.svg';
import okKpiIcon from '../../shared/assets/icon-check-circle.svg';
import alertKpiIcon from '../../shared/assets/icon-notifications2.svg';
import occupiedKpiIcon from '../../shared/assets/icon-group1.svg';
const metricLabels: Record<string, [
    string,
    string
]> = { laeq: ['Noise (LAeq)', 'dB(A)'], l10: ['Peaks (L10)', 'dB(A)'], ppd: ['Discomfort (PPD)', '%'], temp_c: ['Temperature', '°C'], occupied_pct: ['Occupied time', '%'] };
function roomTypeName(room: Room, types: RoomType[]) { return types.find(type => type.id === room.roomTypeId)?.displayName || (room.classified ? tr('Room') : '—'); }
function fmt(value: number | null | undefined, suffix = '') { return value == null ? '—' : `${Number(value.toFixed(1))}${suffix}`; }
function duration(date: string) { return `${Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000))} min`; }
function download(name: string, content: string, mime = 'text/csv') { const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
export function Overview() {
    const { rooms, alerts, demo, openRoom, navigate } = useApp();
    const [floor, setFloor] = useState('2');
    const shown = rooms.filter(room => room.floor === floor);
    const optimal = rooms.filter(room => roomStatus(room) === 'optimal').length;
    const occupied = rooms.filter(room => (room.latest?.occupiedPct ?? 0) > 50).length;
    return <>
    <div className="kpi-grid four"><Kpi icon={<img src={roomKpiIcon} alt=""/>} label="Rooms monitored" value={rooms.length} suffix="rooms"/><Kpi icon={<img src={okKpiIcon} alt=""/>} label="Optimal rooms" value={optimal} suffix={`${tr('of')} ${rooms.length}`} status="optimal"/><Kpi icon={<img src={alertKpiIcon} alt=""/>} label="Active alerts" value={demo ? alerts.length : '—'} suffix={demo ? 'alerts' : 'pending Cloud API'} status={demo ? (alerts.length ? 'bad' : 'optimal') : undefined}/><Kpi icon={<img src={occupiedKpiIcon} alt=""/>} label="Rooms occupied" value={occupied} suffix={`${tr("of")} ${rooms.length}`}/></div>
    <div className="overview-grid"><Card className="heatmap"><div className="card-header"><h2>{tr("Heat map \u00B7 Floor ")}{floor}</h2><div className="button-group">{[...new Set(rooms.map(room => room.floor))].sort().map(item => <button className={`button small ${floor === item ? 'primary' : 'outline'}`} key={item} onClick={() => setFloor(item)}>{tr("Floor ")}{item}</button>)}</div></div><div className="heatmap-tiles">{shown.map(room => <button className={`room-tile tile-${roomStatus(room)}`} key={room.id} onClick={() => openRoom(room)}><strong>{room.displayName}</strong><span>{room.latest ? `${fmt(room.latest.laeq)} dB · ${fmt(room.latest.tempC)} °C · ${tr((room.latest.occupiedPct ?? 0) > 50 ? 'Occupied' : 'Free')}` : tr('No recent reading')}</span><StatusBadge status={roomStatus(room)}/></button>)}</div><div className="legend"><StatusBadge status="optimal"/><StatusBadge status="moderate"/><StatusBadge status="bad"/><StatusBadge status="no-data"/></div></Card>
      <div className="overview-side"><Card><h2>{tr("Rooms needing attention")}</h2>{!demo ? <p className="muted">{tr("Cloud API does not yet expose the Edge alert feed.")}</p> : alerts.length ? alerts.slice(0, 4).map((alert, index) => { const room = rooms.find(item => item.code === alert.room_id); return <button className="attention-row" key={index} onClick={() => navigate('alerts')}><span><strong>{room?.displayName || alert.room_id}</strong><small>{tr(alert.message)}</small></span><StatusBadge status={alert.severity.toLowerCase() === 'critical' ? 'bad' : 'moderate'}/></button>; }) : <p className="muted">{tr("No active alerts.")}</p>}<button className="button outline full" onClick={() => navigate('alerts')}><Bell />{tr(" View all alerts")}</button></Card><Card><h2>{tr("Occupied time \u00B7 last hour")}</h2>{rooms.filter(room => room.latest).slice(0, 4).map(room => <div className="progress-row" key={room.id}><div><span>{room.displayName}</span><strong>{tr("Occupancy ")}{Math.round(room.latest?.occupiedPct ?? 0)} %</strong></div><div className="progress"><i style={{ width: `${room.latest?.occupiedPct ?? 0}%` }}/></div></div>)}</Card></div>
    </div>
  </>;
}
export function AdminRooms() {
    const { demo, session, rooms, roomTypes, sites, selectedSite, selectSite, setRooms, setSites, navigate, notify } = useApp();
    const [classifyId, setClassifyId] = useState<string>('');
    const [typeId, setTypeId] = useState('');
    const [addingSite, setAddingSite] = useState(false);
    const [addingRoom, setAddingRoom] = useState(false);
    const [newSite, setNewSite] = useState({ code: '', name: '', address: '', timezone: 'America/Lima' });
    const [newRoom, setNewRoom] = useState({ code: '', displayName: '', floor: '2', capacity: 4, areaM2: 12, roomTypeId: '' });
    const unclassified = rooms.filter(room => !room.classified);
    const chosen = rooms.find(room => room.id === classifyId) || unclassified[0];
    async function classify() {
        if (!chosen || !typeId) {
            notify('Choose a room type first.');
            return;
        }
        try {
            const updated = demo ? { ...chosen, classified: true, roomTypeId: typeId } : { ...await monitoringApi.classifyRoom(session.token, chosen.id, typeId), roomTypeId: typeId };
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
            const created = demo ? { ...newSite, id: `site-${Date.now()}` } : await monitoringApi.createSite(session.token, newSite);
            setSites(items => [...items, created]);
            setAddingSite(false);
            setNewSite({ code: '', name: '', address: '', timezone: 'America/Lima' });
            notify('Site created.');
        }
        catch (cause) {
            notify(cause instanceof Error ? cause.message : 'Could not create site');
        }
    }
    function addRoom(event: React.FormEvent) { event.preventDefault(); if (rooms.some(room => room.code === newRoom.code)) {
        notify('This room code is already used.');
        return;
    } const room: Room = { id: `room-${Date.now()}`, code: newRoom.code, displayName: newRoom.displayName, floor: newRoom.floor, capacity: newRoom.capacity, areaM2: newRoom.areaM2, active: true, classified: !!newRoom.roomTypeId, roomTypeId: newRoom.roomTypeId || undefined, latest: null }; setRooms(items => [...items, room]); setAddingRoom(false); setNewRoom({ code: '', displayName: '', floor: '2', capacity: 4, areaM2: 12, roomTypeId: '' }); notify('Room added in demo mode.'); }
    return <><div className="toolbar"><div className="button-group">{sites.map(site => <button key={site.id} className={`button small ${selectedSite?.id === site.id ? 'primary' : 'outline'}`} onClick={() => selectSite(site.id)} disabled={selectedSite?.id === site.id}>{site.name}</button>)}</div><div className="toolbar-spacer"/><button className="button outline" onClick={() => navigate('room-types')}><Settings2 />{tr("Room types")}</button><button className="button outline" onClick={() => setAddingSite(true)}><Plus />{tr("Add site")}</button><button className="button primary" onClick={() => demo ? setAddingRoom(true) : notify('Rooms are registered automatically when the Edge sends their first reading. Start the device or simulator, then classify it here.')}><Plus />{tr("Add room")}</button></div>
    {unclassified.length > 0 && <div className="warning-banner"><TriangleAlert />{unclassified.length}{tr(" rooms have no type yet, so no thresholds apply to them.")}<button className="button outline small" onClick={() => { setClassifyId(unclassified[0].id); document.getElementById('classify-card')?.scrollIntoView({ behavior: 'smooth' }); }}>{tr("Classify now")}</button></div>}
    <div className="content-with-aside"><Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr("Room")}</th><th>{tr("Code")}</th><th>{tr("Floor")}</th><th>{tr("Type")}</th><th>{tr("Capacity")}</th><th>{tr("Classification")}</th></tr></thead><tbody>{rooms.map(room => <tr key={room.id} onClick={() => { setClassifyId(room.id); setTypeId(room.roomTypeId || ''); }} className="clickable"><td>{room.displayName}</td><td>{room.code}</td><td>{room.floor}</td><td>{roomTypeName(room, roomTypes)}</td><td>{room.capacity ?? '—'}</td><td><span className={`status ${room.classified ? 'status-optimal' : 'status-moderate'}`}><i />{tr(room.classified ? 'Classified' : 'Unclassified')}</span></td></tr>)}</tbody></table></div></Card><Card id="classify-card"><h2>{tr("Classify room")}</h2><p className="muted">{tr("The room type defines which comfort thresholds the room uses.")}</p><label>{tr("Room")}<select value={chosen?.id || ''} onChange={e => { setClassifyId(e.target.value); setTypeId(''); }}>{unclassified.map(room => <option key={room.id} value={room.id}>{room.code} · {room.displayName}</option>)}{unclassified.length === 0 && <option>{tr("No unclassified rooms")}</option>}</select></label><div className="radio-list">{roomTypes.map(type => <label key={type.id}><input type="radio" name="roomtype" checked={typeId === type.id} onChange={() => setTypeId(type.id)}/>{type.displayName}</label>)}</div><div className="button-row"><button className="button outline" onClick={() => setTypeId('')}>{tr("Cancel")}</button><button className="button primary" onClick={classify} disabled={!chosen}>{tr("Save type")}</button></div></Card></div>
    {addingSite && <div className="modal-backdrop"><form className="card modal" onSubmit={addSite}><h2>{tr("Add site")}</h2><label>{tr("Name")}<input value={newSite.name} onChange={e => setNewSite({ ...newSite, name: e.target.value })} required/></label><label>{tr("Code")}<input value={newSite.code} onChange={e => setNewSite({ ...newSite, code: e.target.value })} required/></label><label>{tr("Address")}<input value={newSite.address} onChange={e => setNewSite({ ...newSite, address: e.target.value })}/></label><div className="button-row"><button type="button" className="button outline" onClick={() => setAddingSite(false)}>{tr("Cancel")}</button><button className="button primary">{tr("Add site")}</button></div></form></div>}
    {addingRoom && <div className="modal-backdrop"><form className="card modal" onSubmit={addRoom}><h2>{tr("Add room")}</h2><p className="muted">{selectedSite?.name}{tr(" \u00B7 the code must match device firmware")}</p><label>{tr("Room code")}<input value={newRoom.code} onChange={e => setNewRoom({ ...newRoom, code: e.target.value })} placeholder={tr("sala-09")} required/></label><label>{tr("Room name")}<input value={newRoom.displayName} onChange={e => setNewRoom({ ...newRoom, displayName: e.target.value })} placeholder={tr("e.g. Room 3-09")} required/></label><div className="form-grid two"><label>{tr("Floor")}<input value={newRoom.floor} onChange={e => setNewRoom({ ...newRoom, floor: e.target.value })} required/></label><label>{tr("Capacity")}<input type="number" min="1" value={newRoom.capacity} onChange={e => setNewRoom({ ...newRoom, capacity: Number(e.target.value) })} required/></label></div><label>{tr("Area (m\u00B2)")}<input type="number" min="1" value={newRoom.areaM2} onChange={e => setNewRoom({ ...newRoom, areaM2: Number(e.target.value) })} required/></label><label>{tr("Room type")}<select value={newRoom.roomTypeId} onChange={e => setNewRoom({ ...newRoom, roomTypeId: e.target.value })}><option value="">{tr("Select a type")}</option>{roomTypes.map(type => <option key={type.id} value={type.id}>{type.displayName}</option>)}</select></label><div className="button-row"><button type="button" className="button outline" onClick={() => setAddingRoom(false)}>{tr("Cancel")}</button><button className="button primary">{tr("Save room")}</button></div><Unavailable message="Demo only. In live mode, rooms are discovered from device readings."/></form></div>}
  </>;
}
export function RoomDetail({ member }: {
    member: boolean;
}) {
    const { selectedRoom: room, demo, session, navigate, alerts } = useApp();
    const [readings, setReadings] = useState<Reading[]>([]);
    const [metric, setMetric] = useState<'noise' | 'temperature' | 'humidity' | 'occupancy'>('noise');
    useEffect(() => { if (!room)
        return; if (demo) {
        setReadings(demoReadings(room));
        return;
    } const to = new Date(); const from = new Date(to.getTime() - 3600000); monitoringApi.readings(session.token, room.id, from.toISOString(), to.toISOString()).then(setReadings).catch(() => setReadings([])); }, [room?.id, demo, session.token]);
    if (!room)
        return <Empty title="Select a room" detail="Open a room from the directory." action={<button className="button primary" onClick={() => navigate(member ? 'member-rooms' : 'rooms')}>{tr("View rooms")}</button>}/>;
    const status = roomStatus(room);
    const values = readings.map(item => metric === 'noise' ? item.acoustic?.laeq : metric === 'temperature' ? item.climate?.tempC : metric === 'humidity' ? item.climate?.rhPct : item.occupancy?.occupiedPct).filter((item): item is number => typeof item === 'number');
    const high = Math.max(...values, 1);
    const low = Math.min(...values, 0);
    const spread = Math.max(1, high - low);
    const points = values.map((value, i) => `${(i / Math.max(1, values.length - 1)) * 100},${90 - ((value - low) / spread) * 65}`).join(' ');
    return <><div className="detail-heading"><div><button className="text-link" onClick={() => navigate(member ? 'member-rooms' : 'rooms')}>{tr("\u2190 Rooms")}</button><h2>{room.displayName}</h2><p>{tr("Rooms / Floor ")}{room.floor} / {room.displayName}{tr(" \u00B7 capacity ")}{room.capacity ?? '—'}</p></div>{member ? <button className="button primary" onClick={() => navigate('member-report')}>{tr("Report discomfort")}</button> : <div className="button-group"><button className="button outline" onClick={() => navigate('thresholds')}>{tr("Edit thresholds")}</button><button className="button primary" onClick={() => navigate('reports')}>{tr("Report")}</button></div>}</div>
    <div className="status-line"><StatusBadge status={status}/><span>{tr("Last reading ")}{room.latest ? new Date(room.latest.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : tr('unavailable')}</span></div>
    <div className="kpi-grid detail-kpis"><Kpi icon={<Volume2 />} label="Noise (LAeq)" value={fmt(room.latest?.laeq)} suffix="dB(A)" status={status}/><Kpi icon={<Thermometer />} label="Temperature" value={fmt(room.latest?.tempC)} suffix="°C"/><Kpi icon={<Activity />} label="Humidity" value={fmt(room.latest?.rhPct)} suffix="%"/><Kpi icon={<Users />} label="Presence" value={tr((room.latest?.occupiedPct ?? 0) > 50 ? 'Occupied' : 'Free')} suffix={`${Math.round(room.latest?.occupiedPct ?? 0)} % ${tr('of last hour')}`}/></div>
    <div className="content-with-aside wide"><Card><div className="card-header"><h2>{member ? tr('Usual noise by hour') : `${tr(metric)} ${tr('per minute · last 60 min')}`}</h2><div className="button-group">{!member && (['noise', 'temperature', 'humidity', 'occupancy'] as const).map(item => <button key={item} className={`button small ${metric === item ? 'primary' : 'outline'}`} onClick={() => setMetric(item)}>{tr(item)}</button>)}</div></div>{values.length ? <div className="chart"><div className="chart-grid"><span>{high.toFixed(0)}</span><span>{((high + low) / 2).toFixed(0)}</span><span>{low.toFixed(0)}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${tr(metric)} ${tr('trend')}`}><polyline points={points} fill="none" stroke="#2e86c1" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg></div> : <Empty title="No recent data" detail="The room has not reported readings in this period."/>}</Card><div className="aside-stack"><Card><h2>{tr("Door indicator")}</h2><p className="muted">{tr("The light at the door shows the room status.")}</p><div className="inline-note">{tr("Auto \u00B7 follows comfort status")}</div>{!member && <Unavailable message="Indicator commands are not exposed by Cloud API."/>}</Card>{!member && <Card><h2>{tr("Device connectivity")}</h2>{demo ? <><p className="muted">{tr("Device ")}{`esp32-${room.code}`}</p><p>{alerts.some(alert => alert.room_id === room.code) ? tr('Open alert · review in Alerts') : tr('No open alert')}</p></> : <Unavailable message="Cloud API does not yet expose device connectivity or local Edge alerts."/>}</Card>}</div></div>
  </>;
}
export function Devices() {
    const { edgeRooms, rooms, navigate, demo } = useApp();
    if (!demo)
        return <Empty title="Device status is awaiting Cloud API" detail="The cloud registers devices when readings arrive, but its current room and reading responses do not expose device connectivity or lost batches. The Edge remains responsible for collecting and uploading sensor data." action={<button className="button outline" onClick={() => navigate('edge-credentials')}>{tr("Manage Edge credentials")}</button>}/>;
    const online = edgeRooms.filter(device => device.last_seen && Date.now() - new Date(device.last_seen).getTime() < 5 * 60000).length;
    return <><div className="kpi-grid four"><Kpi icon={<Radio />} label="Registered" value={edgeRooms.length} suffix="devices"/><Kpi icon={<CircleCheck />} label="Online" value={online} suffix="devices" status="optimal"/><Kpi icon={<CloudOff />} label="Offline" value={edgeRooms.length - online} suffix="devices" status={edgeRooms.length - online ? 'bad' : undefined}/><Kpi icon={<DoorOpen />} label="Unassigned" value={edgeRooms.filter(device => !rooms.some(room => room.code === device.room_id)).length} suffix="devices"/></div><div className="toolbar end"><button className="button outline" onClick={() => navigate('diagnostics')}><Activity />{tr("Diagnostics")}</button><button className="button outline" onClick={() => navigate('edge-credentials')}><ShieldIcon />{tr("Edge credentials")}</button></div><Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr("Device")}</th><th>{tr("Room")}</th><th>{tr("Status")}</th><th>{tr("Last seen")}</th><th>{tr("Lost batches")}</th></tr></thead><tbody>{edgeRooms.map(device => { const isOnline = !!device.last_seen && Date.now() - new Date(device.last_seen).getTime() < 5 * 60000; return <tr key={device.device_id}><td>{device.device_id}</td><td>{rooms.find(room => room.code === device.room_id)?.displayName || device.room_id}</td><td><span className={`status ${isOnline ? 'status-optimal' : 'status-no-data'}`}><i />{tr(isOnline ? 'Online' : 'Offline')}</span></td><td>{device.last_seen ? new Date(device.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td><td>{device.lost_batches}</td></tr>; })}</tbody></table></div></Card><div className="bottom-note"><Unavailable message="These device records are sample data for the demo."/></div></>;
}
function ShieldIcon() { return <Settings2 />; }
export function Thresholds() {
    const { demo, session, roomTypes, notify } = useApp();
    const [typeId, setTypeId] = useState('');
    const [items, setItems] = useState<Threshold[]>(demoThresholds);
    const [original, setOriginal] = useState<Threshold[]>(demoThresholds);
    const [busy, setBusy] = useState(false);
    const current = typeId || roomTypes[0]?.id || '';
    useEffect(() => { if (!current)
        return; if (demo) {
        setItems(demoThresholds.map(item => ({ ...item })));
        setOriginal(demoThresholds.map(item => ({ ...item })));
        return;
    } alertingApi.thresholds(session.token, current).then(data => { const merged = demoThresholds.map(defaults => data.find(item => item.metric === defaults.metric) || { ...defaults }); setItems(merged); setOriginal(merged.map(item => ({ ...item }))); }).catch(() => { setItems([]); setOriginal([]); }); }, [current, demo, session.token]);
    function update(index: number, field: 'warnValue' | 'criticalValue' | 'sustainedMinutes', value: number) { setItems(old => old.map((item, i) => i === index ? { ...item, [field]: value } : item)); }
    const invalid = items.some(item => item.criticalValue != null && item.warnValue >= item.criticalValue || item.sustainedMinutes <= 0);
    async function save() { if (invalid) {
        notify('Warning must be lower than critical and sustained minutes must be positive.');
        return;
    } setBusy(true); try {
        if (!demo)
            await Promise.all(items.map(item => alertingApi.saveThreshold(session.token, current, item)));
        setOriginal(items.map(item => ({ ...item })));
        notify('Thresholds saved.');
    }
    catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Could not save thresholds');
    }
    finally {
        setBusy(false);
    } }
    return <><div className="toolbar"><div className="button-group">{roomTypes.map(type => <button key={type.id} className={`button ${current === type.id ? 'primary' : 'outline'}`} onClick={() => setTypeId(type.id)}>{type.displayName}</button>)}</div><div className="toolbar-spacer"/><button className="button outline" onClick={() => setItems(original.map(item => ({ ...item })))}>{tr("Discard")}</button><button className="button primary" disabled={!items.length || busy || invalid} onClick={save}>{tr("Save thresholds")}</button></div>{invalid && <div className="warning-banner"><TriangleAlert />{tr("Warning must be below critical. Sustained minutes must be greater than zero.")}</div>}{items.length ? <Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr("Metric")}</th><th>{tr("Unit")}</th><th>{tr("Warning")}</th><th>{tr("Critical")}</th><th>{tr("Sustained (min)")}</th></tr></thead><tbody>{items.map((item, i) => <tr key={item.metric}><td><strong>{tr(metricLabels[item.metric]?.[0] || item.metric)}</strong></td><td>{metricLabels[item.metric]?.[1] || '—'}</td><td><input className="table-input" type="number" value={item.warnValue} onChange={event => update(i, 'warnValue', Number(event.target.value))}/></td><td><input className="table-input" type="number" value={item.criticalValue ?? ''} onChange={event => update(i, 'criticalValue', Number(event.target.value))}/></td><td><input className="table-input" type="number" min="1" value={item.sustainedMinutes} onChange={event => update(i, 'sustainedMinutes', Number(event.target.value))}/></td></tr>)}</tbody></table></div></Card> : <Empty title="No thresholds configured" detail="The selected room type has no thresholds yet. The Cloud API can save a new metric once you configure it."/>}<Card className="help-card"><h2><Info />{tr(" How alerts work")}</h2><p>{tr("An alert opens when a value stays above its threshold for the sustained minutes, and closes when the room returns to normal. Edge devices download the new values, so alerts keep working without internet.")}</p></Card></>;
}
export function Alerts() {
    const { demo, alerts, rooms, setAlerts, notify } = useApp();
    const [tab, setTab] = useState<'active' | 'acknowledged' | 'closed'>('active');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(0);
    const [action, setAction] = useState('');
    const [acknowledged, setAcknowledged] = useState<EdgeAlert[]>([]);
    if (!demo)
        return <Empty title="Alerts are awaiting Cloud API" detail="Edge evaluates alerts locally, but Cloud API does not currently expose an alert list or actions to acknowledge and close them. The web app therefore cannot show a reliable live alert count yet."/>;
    const visible = (tab === 'active' ? alerts : tab === 'acknowledged' ? acknowledged : []).filter(alert => `${alert.room_id} ${alert.rule} ${alert.message}`.toLowerCase().includes(search.toLowerCase()));
    const active = visible[selected] || visible[0];
    function acknowledge() { if (!action.trim()) {
        notify('Describe the corrective action first.');
        return;
    } if (!active)
        return; setAcknowledged(old => [...old, active]); setAlerts(old => old.filter(item => item !== active)); setAction(''); setSelected(0); notify('Corrective action saved in demo mode.'); }
    return <><div className="toolbar"><div className="button-group"><button className={`button ${tab === 'active' ? 'primary' : 'outline'}`} onClick={() => setTab('active')}>{tr("Active (")}{alerts.length})</button><button className={`button ${tab === 'acknowledged' ? 'primary' : 'outline'}`} onClick={() => setTab('acknowledged')}>{tr("Acknowledged")}</button><button className={`button ${tab === 'closed' ? 'primary' : 'outline'}`} onClick={() => setTab('closed')}>{tr("Closed")}</button></div><div className="toolbar-spacer"/><label className="search-field">{tr("Search")}<input value={search} onChange={event => { setSearch(event.target.value); setSelected(0); }} placeholder={tr("Room or metric")}/></label></div><div className="content-with-aside wide"><Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr("Room")}</th><th>{tr("Metric")}</th><th>{tr("Level")}</th><th>{tr("Started")}</th><th>{tr("Duration")}</th><th>{tr("Action")}</th></tr></thead><tbody>{visible.map((alert, index) => <tr key={`${alert.room_id}-${alert.opened_at}`} onClick={() => setSelected(index)} className="clickable"><td>{rooms.find(room => room.code === alert.room_id)?.displayName || alert.room_id}</td><td>{tr(metricLabels[alert.rule]?.[0] || alert.rule)}</td><td><span className={`status ${alert.severity.toLowerCase() === 'critical' ? 'status-bad' : 'status-moderate'}`}><i />{tr(alert.severity)}</span></td><td>{new Date(alert.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td>{duration(alert.opened_at)}</td><td><button className="text-link">{tr("Open \u203A")}</button></td></tr>)}</tbody></table></div>{!visible.length && <div className="table-empty">{tr(tab === 'active' ? 'All calm. No active alerts.' : 'No alerts in this view.')}</div>}</Card><div className="aside-stack">{active ? <Card><h2>{rooms.find(room => room.code === active.room_id)?.displayName || active.room_id}</h2><span className={`status ${active.severity.toLowerCase() === 'critical' ? 'status-bad' : 'status-moderate'}`}><i />{tr(active.severity)} · {tr(active.message)}</span><div className="detail-list"><div><span>{tr("Opened")}</span><strong>{new Date(active.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div><div><span>{tr("Acknowledged")}</span><strong>{tr(tab === 'acknowledged' ? 'Demo' : 'Not yet')}</strong></div><div><span>{tr("Closed")}</span><strong>{tr("Open")}</strong></div></div>{tab === 'active' && <><label>{tr("Corrective action")}<input value={action} onChange={event => setAction(event.target.value)} placeholder={tr("Describe what was done in the room")}/></label><button className="button primary full" onClick={acknowledge}>{tr("Acknowledge and save action")}</button></>}</Card> : <Empty title="All calm" detail="No alerts in this view."/>}<Card><h2>{tr("Recent corrective actions")}</h2>{acknowledged.map((alert, i) => <p key={i} className="muted">{alert.room_id}{tr(" \u00B7 acknowledged in demo")}</p>)}{!acknowledged.length && <p className="muted">{tr("No recent actions.")}</p>}</Card></div></div></>;
}
export function Reports() {
    const { demo, session, rooms, notify } = useApp();
    const [tab, setTab] = useState<'discomfort' | 'historical'>('discomfort');
    const [roomId, setRoomId] = useState('all');
    const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    async function generate() {
        const chosen = roomId === 'all' ? rooms : rooms.filter(room => room.id === roomId);
        try {
            const series = await Promise.all(chosen.map(async (room) => ({ room, readings: demo ? demoReadings(room, 60) : await monitoringApi.readings(session.token, room.id, new Date(`${from}T00:00:00Z`).toISOString(), new Date(`${to}T23:59:59Z`).toISOString()) })));
            const lines = ['room,room_code,timestamp,noise_dba,temperature_c,humidity_pct,occupied_pct', ...series.flatMap(({ room, readings }) => readings.map(reading => [room.displayName, room.code, reading.ts, reading.acoustic?.laeq ?? '', reading.climate?.tempC ?? '', reading.climate?.rhPct ?? '', reading.occupancy?.occupiedPct ?? ''].join(',')))];
            download('sensework-historical-report.csv', lines.join('\n'));
            notify('Historical CSV generated.');
        }
        catch (cause) {
            notify(cause instanceof Error ? cause.message : 'Could not generate report');
        }
    }
    return <><div className="toolbar"><div className="button-group"><button className={`button ${tab === 'discomfort' ? 'primary' : 'outline'}`} onClick={() => setTab('discomfort')}>{tr("Discomfort reports")}</button><button className={`button ${tab === 'historical' ? 'primary' : 'outline'}`} onClick={() => setTab('historical')}>{tr("Historical reports")}</button></div></div>{tab === 'discomfort' ? demo ? <Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr("Room")}</th><th>{tr("Complaint")}</th><th>{tr("Sent")}</th><th>{tr("Measured then")}</th><th>{tr("Condition")}</th><th>{tr("Status")}</th></tr></thead><tbody><tr><td>{tr("Meeting Room A")}</td><td>{tr("Noise")}</td><td>10:28</td><td>{tr("63 dB(A)")}</td><td><StatusBadge status="bad"/></td><td>{tr("New")}</td></tr><tr><td>{tr("Call Booth 2")}</td><td>{tr("Too warm")}</td><td>09:55</td><td>{tr("25.4 \u00B0C")}</td><td><StatusBadge status="moderate"/></td><td>{tr("New")}</td></tr><tr><td>{tr("Open Area South")}</td><td>{tr("Noise")}</td><td>{tr("Yesterday")}</td><td>{tr("49 dB(A)")}</td><td><StatusBadge status="optimal"/></td><td>{tr("Reviewed")}</td></tr></tbody></table></div></Card> : <Empty title="No discomfort reports available" detail="The current Cloud and Edge APIs have no endpoint for member reports. The design is ready for that backend feature."/> : <Card className="report-form"><h2>{tr("Generate historical report")}</h2><div className="form-grid"><label>{tr("Room")}<select value={roomId} onChange={event => setRoomId(event.target.value)}><option value="all">{tr("All rooms")}</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.displayName}</option>)}</select></label><label>{tr("From")}<input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label><label>{tr("To")}<input type="date" value={to} onChange={event => setTo(event.target.value)}/></label><label>{tr("Format")}<select value="CSV" disabled><option>{tr("CSV")}</option></select></label></div><p className="muted">{tr("Historical data is exported from the Cloud API as CSV.")}</p><button className="button primary" disabled={from > to} onClick={generate}>{tr("Generate report")}</button></Card>}</>;
}
export function Members() {
    const { demo, notify } = useApp();
    const [search, setSearch] = useState('');
    const [email, setEmail] = useState('');
    const [inviteOpen, setInviteOpen] = useState(false);
    const [members, setMembers] = useState([
        { id: '1', name: 'Camila Rivas', email: 'camila.rivas@mail.com', role: 'Member', active: true },
        { id: '2', name: 'Martín Salazar', email: 'm.salazar@mail.com', role: 'Member', active: true },
        { id: '3', name: 'Lucía Paredes', email: 'lucia.p@mail.com', role: 'Member', active: false },
        { id: '4', name: 'Andrea Quispe', email: 'andrea.q@mirafloreshub.pe', role: 'Admin', active: true },
    ]);
    function invite(event: React.FormEvent) { event.preventDefault(); if (members.some(member => member.email === email)) {
        notify('That email is already in the demo directory.');
        return;
    } setMembers(old => [...old, { id: String(Date.now()), name: email.split('@')[0], email, role: 'Member', active: true }]); setEmail(''); setInviteOpen(false); notify('Member added in demo mode. No email was sent.'); }
    if (!demo)
        return <><div className="toolbar"><label className="search-field">{tr("Search")}<input placeholder={tr("Name or email")} disabled/></label><div className="toolbar-spacer"/><button className="button primary" disabled><Plus />{tr("Invite member")}</button></div><Empty title="Member management is awaiting an API" detail="Cloud API currently supports creating a member account, but does not expose member listing, invitations, activation or deactivation. These controls will become available when those endpoints are added."/></>;
    return <><div className="toolbar"><label className="search-field">{tr("Search")}<input placeholder={tr("Name or email")} value={search} onChange={event => setSearch(event.target.value)}/></label><div className="toolbar-spacer"/><button className="button primary" onClick={() => setInviteOpen(true)}><Plus />{tr("Invite member")}</button></div><div className="content-with-aside wide"><Card className="table-card"><div className="table-scroll"><table><thead><tr><th>{tr("Name")}</th><th>{tr("Email")}</th><th>{tr("Role")}</th><th>{tr("Status")}</th><th>{tr("Action")}</th></tr></thead><tbody>{members.filter(member => `${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase())).map(member => <tr key={member.id}><td>{member.name}</td><td>{member.email}</td><td>{tr(member.role)}</td><td><span className={`status ${member.active ? 'status-optimal' : 'status-no-data'}`}><i />{tr(member.active ? 'Active' : 'Deactivated')}</span></td><td><button className="text-link" onClick={() => setMembers(old => old.map(item => item.id === member.id ? { ...item, active: !item.active } : item))}>{tr(member.active ? 'Deactivate' : 'Reactivate')}</button></td></tr>)}</tbody></table></div></Card><Card><h2>{tr("Invite member")}</h2><p className="muted">{tr("The member receives an email to create a password and choose the web or mobile app.")}</p><Unavailable message="Demo only. Invitations are not sent from this preview."/><button className="button outline full" onClick={() => setInviteOpen(true)}>{tr("Add a demo member")}</button></Card></div>{inviteOpen && <div className="modal-backdrop"><form className="card modal" onSubmit={invite}><h2>{tr("Invite member")}</h2><label>{tr("Email")}<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={tr("name@mail.com")} required/></label><div className="button-row"><button type="button" className="button outline" onClick={() => setInviteOpen(false)}>{tr("Cancel")}</button><button className="button primary">{tr("Add demo member")}</button></div></form></div>}</>;
}
export function EdgeCredentials() {
    const { demo, session, selectedSite, notify } = useApp();
    const [code, setCode] = useState('');
    const [key, setKey] = useState('');
    const [busy, setBusy] = useState(false);
    const [credentials, setCredentials] = useState([{ code: 'edge-miraflores-01', active: true }, { code: 'edge-miraflores-test', active: false }]);
    async function create(event: React.FormEvent) { event.preventDefault(); setBusy(true); try {
        const created = demo ? { apiKey: `demo-${crypto.randomUUID()}` } : await createEdgeCredential(session.token, code);
        setKey(created.apiKey);
        if (demo)
            setCredentials(old => [...old, { code, active: true }]);
        notify('Credential created. Copy the key now; the API returns it only once.');
    }
    catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Could not create credential');
    }
    finally {
        setBusy(false);
    } }
    return <div className="content-with-aside wide"><Card className="table-card">{demo ? <div className="table-scroll"><table><thead><tr><th>{tr("Node")}</th><th>{tr("Site")}</th><th>{tr("Status")}</th><th>{tr("Action")}</th></tr></thead><tbody>{credentials.map(item => <tr key={item.code}><td>{item.code}</td><td>{selectedSite?.name}</td><td><span className={`status ${item.active ? 'status-optimal' : 'status-no-data'}`}><i />{tr(item.active ? 'Active' : 'Revoked')}</span></td><td>{item.active && <button className="text-link" onClick={() => { setCredentials(old => old.map(entry => entry.code === item.code ? { ...entry, active: false } : entry)); notify('Credential revoked in demo mode.'); }}>{tr("Revoke")}</button>}</td></tr>)}</tbody></table></div> : <div className="table-empty">{tr("The Cloud API supports creation only. It does not yet expose listing or revocation.")}</div>}</Card><Card><h2>{tr("New credential")}</h2><p className="muted">{tr("Create one key per edge node. It can send readings and download thresholds.")}</p><form onSubmit={create}><label>{tr("Node name")}<input value={code} onChange={event => setCode(event.target.value)} placeholder={tr("e.g. edge-miraflores-02")} required/></label><label>{tr("Site")}<input value={selectedSite?.name || ''} readOnly/></label><button className="button primary full" disabled={busy}>{tr("Generate key")}</button></form>{key && <div className="generated-key"><strong>{tr("Copy this key now")}</strong><code>{key}</code><button className="button outline" onClick={() => { void navigator.clipboard.writeText(key); notify('Key copied.'); }}><Copy />{tr("Copy key")}</button></div>}</Card></div>;
}
export function RoomTypes() {
    const { demo, session, selectedSite, roomTypes, setRoomTypes, navigate, notify } = useApp();
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    async function add(event: React.FormEvent) { event.preventDefault(); if (!selectedSite)
        return; try {
        const created = demo ? { id: `type-${Date.now()}`, siteId: selectedSite.id, code, displayName: name, description: '' } : await monitoringApi.createRoomType(session.token, selectedSite.id, { code, displayName: name, description: '' });
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
export function Diagnostics() {
    const { demo, edgeRooms } = useApp();
    if (!demo)
        return <Empty title="Diagnostics are awaiting Cloud API" detail="The Edge keeps its local health and upload queue. Cloud API does not currently expose those diagnostics for the web app, so this screen needs a Cloud endpoint before it can show live values."/>;
    return <div className="kpi-grid four"><Kpi icon={<CircleCheck />} label="Edge status" value="ok" suffix="demo" status="optimal"/><Kpi icon={<Radio />} label="Devices" value={edgeRooms.length} suffix="sample devices"/><Kpi icon={<Activity />} label="Pending upload" value={0} suffix="sample minutes"/><Kpi icon={<Bell />} label="Open alerts" value={3} suffix="sample alerts"/></div>;
}
