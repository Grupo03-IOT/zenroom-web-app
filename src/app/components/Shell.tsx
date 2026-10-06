import { useState } from 'react';
import type { ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import type { Page } from '../App';
import { useApp } from '../App';
import { tr } from '../../shared/i18n/i18n';
import { LanguageToggle } from './LanguageToggle';
import logo from '../../shared/assets/logo-isotype.svg';
import dashboardIcon from '../../shared/assets/icon-dashboard.svg';
import roomsIcon from '../../shared/assets/icon-meeting-room.svg';
import devicesIcon from '../../shared/assets/icon-sensors.svg';
import alertsIcon from '../../shared/assets/icon-notifications.svg';
import insightsIcon from '../../shared/assets/icon-monitoring.svg';
import reportsIcon from '../../shared/assets/icon-description.svg';
import membersIcon from '../../shared/assets/icon-group.svg';
import thresholdsIcon from '../../shared/assets/icon-tune.svg';
import helpIcon from '../../shared/assets/icon-help.svg';
import termsIcon from '../../shared/assets/icon-gavel.svg';
import privacyIcon from '../../shared/assets/icon-shield.svg';
import locationIcon from '../../shared/assets/icon-location-on.svg';
import alertPillIcon from '../../shared/assets/icon-notifications1.svg';
import memberRoomsIcon from '../../shared/assets/member-icon-meeting-room.svg';
import reportIcon from '../../shared/assets/member-icon-campaign.svg';
import profileIcon from '../../shared/assets/member-icon-person.svg';
const asset = (src: string) => <img src={src} alt=""/>;
const adminNav: {
    page: Page;
    label: string;
    icon: ReactNode;
}[] = [
    { page: 'overview', label: 'Overview', icon: asset(dashboardIcon) },
    { page: 'rooms', label: 'Rooms', icon: asset(roomsIcon) },
    { page: 'devices', label: 'Devices', icon: asset(devicesIcon) },
    { page: 'alerts', label: 'Alerts', icon: asset(alertsIcon) },
    { page: 'insights', label: 'Insights', icon: asset(insightsIcon) },
    { page: 'reports', label: 'Reports', icon: asset(reportsIcon) },
    { page: 'members', label: 'Members', icon: asset(membersIcon) },
    { page: 'thresholds', label: 'Thresholds', icon: asset(thresholdsIcon) },
];
const memberNav: {
    page: Page;
    label: string;
    icon: ReactNode;
}[] = [
    { page: 'member-rooms', label: 'Rooms', icon: asset(memberRoomsIcon) },
    { page: 'member-report', label: 'Report discomfort', icon: asset(reportIcon) },
    { page: 'profile', label: 'Profile', icon: asset(profileIcon) },
];
const titles: Partial<Record<Page, [
    string,
    string
]>> = {
    overview: ['Site overview', 'Current comfort of every room · updated every minute'],
    rooms: ['Sites and rooms', 'Register your sites and rooms and classify each room by its use'],
    devices: ['Devices', 'IoT devices of the site and their connection status'],
    alerts: ['Alerts', 'Follow up each alert until the room is back to normal'],
    insights: ['Insights', 'Trends by room and their relation with the weather outside'],
    reports: ['Reports', 'Historical reports by room and discomfort reports sent by members'],
    members: ['Members', 'People of your coworking who can check rooms'],
    thresholds: ['Comfort thresholds', 'An alert opens when a value stays above its level for the sustained time'],
    'edge-credentials': ['Edge credentials', 'Keys that let the local edge node send room readings to the cloud'],
    'room-types': ['Room types', 'Each type groups rooms with the same use and comfort thresholds'],
    diagnostics: ['Diagnostics', 'Edge node health and delivery status'],
    'member-rooms': ['Rooms', 'Find a room with the right noise and temperature before you book it'],
    'member-report': ['Report discomfort', 'Tell the site team what bothers you'],
    profile: ['Profile', 'Your account, preferences and legal documents'],
};
export function Logo() { return <span className="brand"><img className="brand-mark" src={logo} alt=""/><span><strong>{tr("Sense")}</strong><em>{tr("Work")}</em></span></span>; }
export function Shell({ children }: {
    children: ReactNode;
}) {
    const { session, page, navigate, selectedSite, sites, selectSite, alerts, loading, error, notice, demo } = useApp();
    const [menuOpen, setMenuOpen] = useState(false);
    const isAdmin = session.role === 'ADMIN';
    const nav = isAdmin ? adminNav : memberNav;
    const title = titles[page];
    const currentNav = page === 'room-detail' ? 'rooms' : page === 'member-detail' ? 'member-rooms' : page;
    return <div className="app-layout">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="side-top"><Logo /><button className="icon-button mobile-only" onClick={() => setMenuOpen(false)} aria-label={tr("Close menu")}><X /></button></div>
      <nav aria-label={tr('Main navigation')}>{nav.map(item => <button key={item.page} className={`nav-link ${currentNav === item.page ? 'active' : ''}`} onClick={() => { navigate(item.page); setMenuOpen(false); }}>{item.icon}<span>{tr(item.label)}</span></button>)}</nav>
      <div className="side-footer">
        <button onClick={() => navigate('diagnostics')}><img src={helpIcon} alt=""/>{tr("Help")}</button>
        <button onClick={() => navigate('terms')}><img src={termsIcon} alt=""/>{tr("Terms of Service")}</button>
        <button onClick={() => navigate('privacy')}><img src={privacyIcon} alt=""/>{tr("Privacy Policy")}</button>
      </div>
    </aside>
    {menuOpen && <button className="drawer-backdrop" onClick={() => setMenuOpen(false)} aria-label={tr("Close menu")}/>}
    <div className="main-column">
      <header className="topbar">
        <button className="icon-button mobile-only" onClick={() => setMenuOpen(true)} aria-label={tr("Open menu")}><Menu /></button>
        <div className="topbar-title">{title ? <><h1>{tr(title[0])}</h1><p>{tr(title[1])}</p></> : null}</div>
        <div className="topbar-actions">
          <LanguageToggle />
          {sites.length > 0 && <label className="site-select"><img src={locationIcon} alt=""/><select value={selectedSite?.id || ''} onChange={event => selectSite(event.target.value)} aria-label={tr("Select site")}>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>}
          {isAdmin && <button className="alert-pill" onClick={() => navigate('alerts')}><img src={alertPillIcon} alt=""/>{demo ? `${alerts.length} ${tr('active alerts')}` : tr('Alerts pending API')}</button>}
          <button className="avatar" onClick={() => navigate('profile')} aria-label={tr("Open profile")}>{session.name[0]?.toUpperCase() || 'S'}</button>
        </div>
      </header>
      {demo && <div className="demo-bar">{tr("Demo mode \u00B7 sample data. Set ")}<code>{tr("VITE_DEMO_MODE=false")}</code>{tr(" to use Cloud API.")}</div>}
      {loading && <div className="state-bar">{tr("Loading current data\u2026")}</div>}
      {error && <div className="state-bar error">{tr(error)}</div>}
      {notice && <div className="toast" role="status">{tr(notice)}</div>}
      <main>{children}</main>
    </div>
  </div>;
}
