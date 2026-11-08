import { useMemo, useState } from 'react';
import { useApp } from '../App';
import { tr, useLanguage } from '../../shared/i18n/i18n';
import { Card, Empty, StatusBadge } from '../components/Ui';
import { hasRecentReading } from '../../contexts/monitoring/domain/models';
import searchIcon from '../../shared/assets/member-icon-search.svg';
import noiseIcon from '../../shared/assets/member-icon-volume-up.svg';
import tempIcon from '../../shared/assets/member-icon-thermostat.svg';
import groupIcon from '../../shared/assets/member-icon-group.svg';
export function MemberRooms() {
    const { rooms, roomTypes, statusFor, openRoom } = useApp();
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<string[]>([]);
    const filtered = useMemo(() => rooms.filter(room => {
        if (!room.displayName.toLowerCase().includes(search.toLowerCase()))
            return false;
        if (filters.includes('Quiet') && (room.latest?.laeq ?? 100) >= 50)
            return false;
        if (filters.includes('Cool') && (room.latest?.tempC ?? 100) >= 24)
            return false;
        if (filters.includes('Free now') && (!hasRecentReading(room) || (room.latest?.occupiedPct ?? 100) > 50))
            return false;
        if (filters.includes('Floor 2') && room.floor !== '2')
            return false;
        return true;
    }), [rooms, search, filters]);
    function toggle(filter: string) { setFilters(old => old.includes(filter) ? old.filter(item => item !== filter) : [...old, filter]); }
    return <><div className="member-filter-row"><label className="search-field">{tr("Search")}<span><img src={searchIcon} alt=""/><input value={search} onChange={event => setSearch(event.target.value)} placeholder={tr("Search a room")}/></span></label><div className="button-group">{['Quiet', 'Cool', 'Free now', ...(rooms.some(room => room.floor === '2') ? ['Floor 2'] : [])].map(filter => <button key={filter} className={`button small ${filters.includes(filter) ? 'selected' : 'outline'}`} onClick={() => toggle(filter)}>{tr(filter)}</button>)}</div></div><div className="legend"><StatusBadge status="optimal"/><StatusBadge status="moderate"/><StatusBadge status="bad"/></div>{filtered.length ? <div className="member-room-grid">{filtered.map(room => <button key={room.id} className="card member-room-card" onClick={() => openRoom(room)}><div className="card-heading"><div><strong>{room.displayName}</strong><small>{tr("Floor ")}{room.floor || '—'} · {(room.roomType?.displayName || roomTypes.find(type => type.id === room.roomTypeId)?.displayName)?.toLowerCase() || tr('room')}</small></div><StatusBadge status={statusFor(room)}/></div><div className="mini-metrics"><div><span><img src={noiseIcon} alt=""/>{tr("Noise")}</span><strong>{room.latest?.laeq?.toFixed(0) ?? '—'}{tr(" dB")}</strong></div><div><span><img src={tempIcon} alt=""/>{tr("Temp.")}</span><strong>{room.latest?.tempC?.toFixed(1) ?? '—'}{tr(" \u00B0C")}</strong></div><div><span><img src={groupIcon} alt=""/>{tr("Presence")}</span><strong>{!hasRecentReading(room) ? '—' : (room.latest?.occupiedPct ?? 0) > 50 ? tr('Occupied') : tr('Free')}</strong></div></div>{room.latest?.forecast && room.latest.forecast.probability >= 0.85 && <div className="forecast-warning" role="status">{tr('Early temperature warning')}: {Math.round(room.latest.forecast.probability * 100)}% · {room.latest.forecast.horizonMin} {tr('min forecast')}</div>}<small>{tr('Last reading')} {room.latest ? new Date(room.latest.ts).toLocaleString() : '—'}</small></button>)}</div> : <Empty title="No rooms match" detail="Try another search or remove a filter." action=<button className="button outline" onClick={() => { setSearch(''); setFilters([]); }}>{tr("Clear filters")}</button>/>}</>;
}
export function MemberReport() {
    return <Empty title="No discomfort reports available" detail="Discomfort reports are not available yet."/>;
}
export function MemberProfile() {
    const { session, selectedSite, signOut, navigate } = useApp();
    const { language } = useLanguage();
    return <div className="content-with-aside wide"><Card><div className="profile-head"><div className="profile-avatar">{session.name[0]?.toUpperCase()}</div><div><h2>{session.name}</h2><p>{session.email}</p></div></div><div className="detail-list"><div><span>{tr("Site")}</span><strong>{selectedSite?.name || '—'}</strong></div><div><span>{tr("Role")}</span><strong>{tr(session.role === 'ADMIN' ? 'Administrator' : 'Member')}</strong></div><div><span>{tr("Language")}</span><strong>{language === 'es' ? 'Español' : 'English'}</strong></div></div><button className="button outline" onClick={signOut}>{tr("Sign out")}</button></Card><Card><h2>{tr("Account links")}</h2><button className="profile-link" onClick={() => navigate('terms')}>{tr("Terms of Service \u2192")}</button><button className="profile-link" onClick={() => navigate('privacy')}>{tr("Privacy Policy \u2192")}</button></Card></div>;
}
