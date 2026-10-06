import { useMemo, useState } from 'react';
import { useApp } from '../App';
import { tr, useLanguage } from '../../shared/i18n/i18n';
import { Card, Empty, StatusBadge, Unavailable } from '../components/Ui';
import { roomStatus } from '../../contexts/monitoring/domain/models';
import searchIcon from '../../shared/assets/member-icon-search.svg';
import noiseIcon from '../../shared/assets/member-icon-volume-up.svg';
import tempIcon from '../../shared/assets/member-icon-thermostat.svg';
import groupIcon from '../../shared/assets/member-icon-group.svg';
export function MemberRooms() {
    const { rooms, roomTypes, openRoom } = useApp();
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<string[]>([]);
    const filtered = useMemo(() => rooms.filter(room => {
        if (!room.latest || !room.displayName.toLowerCase().includes(search.toLowerCase()))
            return false;
        if (filters.includes('Quiet') && (room.latest.laeq ?? 100) >= 50)
            return false;
        if (filters.includes('Cool') && (room.latest.tempC ?? 100) >= 24)
            return false;
        if (filters.includes('Free now') && (room.latest.occupiedPct ?? 100) > 50)
            return false;
        if (filters.includes('Floor 2') && room.floor !== '2')
            return false;
        return true;
    }), [rooms, search, filters]);
    function toggle(filter: string) { setFilters(old => old.includes(filter) ? old.filter(item => item !== filter) : [...old, filter]); }
    return <><div className="member-filter-row"><label className="search-field">{tr("Search")}<span><img src={searchIcon} alt=""/><input value={search} onChange={event => setSearch(event.target.value)} placeholder={tr("Search a room")}/></span></label><div className="button-group">{['Quiet', 'Cool', 'Free now', 'Floor 2'].map(filter => <button key={filter} className={`button small ${filters.includes(filter) ? 'selected' : 'outline'}`} onClick={() => toggle(filter)}>{tr(filter)}</button>)}</div></div><div className="legend"><StatusBadge status="optimal"/><StatusBadge status="moderate"/><StatusBadge status="bad"/></div>{filtered.length ? <div className="member-room-grid">{filtered.map(room => <button key={room.id} className="card member-room-card" onClick={() => openRoom(room)}><div className="card-heading"><div><strong>{room.displayName}</strong><small>{tr("Floor ")}{room.floor} · {roomTypes.find(type => type.id === room.roomTypeId)?.displayName?.toLowerCase() || tr('room')}</small></div><StatusBadge status={roomStatus(room)}/></div><div className="mini-metrics"><div><span><img src={noiseIcon} alt=""/>{tr("Noise")}</span><strong>{room.latest?.laeq?.toFixed(0) ?? '—'}{tr(" dB")}</strong></div><div><span><img src={tempIcon} alt=""/>{tr("Temp.")}</span><strong>{room.latest?.tempC?.toFixed(1) ?? '—'}{tr(" \u00B0C")}</strong></div><div><span><img src={groupIcon} alt=""/>{tr("Presence")}</span><strong>{(room.latest?.occupiedPct ?? 0) > 50 ? tr('Occupied') : tr('Free')}</strong></div></div></button>)}</div> : <Empty title="No rooms match" detail="Try another search or remove a filter." action={<button className="button outline" onClick={() => { setSearch(''); setFilters([]); }}>{tr("Clear filters")}</button>}/>}</>;
}
export function MemberReport() {
    const { demo, rooms, selectedRoom, notify } = useApp();
    const [roomId, setRoomId] = useState(selectedRoom?.id || rooms[0]?.id || '');
    const [issue, setIssue] = useState('Too noisy');
    const [comment, setComment] = useState('');
    const [reports, setReports] = useState<{
        room: string;
        issue: string;
        comment: string;
    }[]>([]);
    function send(event: React.FormEvent) { event.preventDefault(); if (!demo) {
        notify('The current Cloud API has no endpoint for discomfort reports.');
        return;
    } const room = rooms.find(item => item.id === roomId); setReports(old => [{ room: room?.displayName || '', issue, comment }, ...old]); setComment(''); notify('Report saved in demo mode.'); }
    return <div className="content-with-aside wide"><Card><p className="muted">{tr("We compare your report with the reading of the room at that moment.")}</p><form onSubmit={send}><label>{tr("Room")}<select value={roomId} onChange={event => setRoomId(event.target.value)}>{rooms.map(room => <option key={room.id} value={room.id}>{room.displayName}{tr(" \u00B7 Floor ")}{room.floor}</option>)}</select></label><div className="form-label">{tr("What is the problem?")}</div><div className="button-group">{['Too noisy', 'Too warm', 'Too cold'].map(item => <button type="button" key={item} className={`button ${issue === item ? 'primary' : 'outline'}`} onClick={() => setIssue(item)}>{tr(item)}</button>)}</div><label>{tr("Comment (optional)")}<textarea value={comment} onChange={event => setComment(event.target.value)} placeholder={tr("Add details")} rows={4}/></label><button className="button primary" disabled={!demo}>{tr("Send report")}</button>{!demo && <Unavailable message="Report submission awaits a Cloud API endpoint."/>}</form></Card><Card><h2>{tr("My reports")}</h2>{reports.length ? reports.map((report, i) => <div className="report-item" key={i}><strong>{report.room}</strong><span>{tr(report.issue)}</span><small>{report.comment}</small></div>) : <p className="muted">{tr("No reports sent in this session.")}</p>}</Card></div>;
}
export function MemberProfile() {
    const { session, selectedSite, signOut, navigate } = useApp();
    const { language } = useLanguage();
    return <div className="content-with-aside wide"><Card><div className="profile-head"><div className="profile-avatar">{session.name[0]?.toUpperCase()}</div><div><h2>{session.name}</h2><p>{session.email}</p></div></div><div className="detail-list"><div><span>{tr("Site")}</span><strong>{selectedSite?.name || '—'}</strong></div><div><span>{tr("Role")}</span><strong>{tr(session.role === 'ADMIN' ? 'Administrator' : 'Member')}</strong></div><div><span>{tr("Language")}</span><strong>{language === 'es' ? 'Español' : 'English'}</strong></div></div><button className="button outline" onClick={signOut}>{tr("Sign out")}</button></Card><Card><h2>{tr("Account links")}</h2><button className="profile-link" onClick={() => navigate('terms')}>{tr("Terms of Service \u2192")}</button><button className="profile-link" onClick={() => navigate('privacy')}>{tr("Privacy Policy \u2192")}</button></Card></div>;
}
