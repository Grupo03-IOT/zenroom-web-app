import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, Role } from '../contexts/identity/domain/session';
import { signIn, signUp } from '../contexts/identity/infrastructure/identityApi';
import type { Room, RoomType, Site } from '../contexts/monitoring/domain/models';
import { monitoringApi } from '../contexts/monitoring/infrastructure/monitoringApi';
import type { EdgeAlert, EdgeRoom } from '../contexts/alerting/domain/models';
import { demoAlerts, demoEdgeRooms, demoRooms, demoRoomTypes, demoSites } from '../shared/demo/data';
import { AuthScreen } from './screens/AuthScreen';
import { Shell } from './components/Shell';
import { Overview, AdminRooms, RoomDetail, Devices, Thresholds, Alerts, Reports, Members, EdgeCredentials, RoomTypes, Diagnostics } from './screens/AdminScreens';
import { Insights } from './screens/InsightsScreen';
import { MemberRooms, MemberReport, MemberProfile } from './screens/MemberScreens';
import { useLanguage, tr } from '../shared/i18n/i18n';
import { canVisit, defaultPage, pathForPage, readRoute, safeNext } from './routing';
import type { AuthMode } from './routing';
export type Page = 'overview' | 'rooms' | 'room-detail' | 'devices' | 'alerts' | 'insights' | 'reports' | 'members' | 'thresholds' | 'edge-credentials' | 'room-types' | 'diagnostics' | 'member-rooms' | 'member-detail' | 'member-report' | 'profile' | 'terms' | 'privacy';
interface AppState {
    demo: boolean;
    session: Session;
    page: Page;
    navigate: (page: Page, roomId?: string) => void;
    selectedRoom: Room | undefined;
    openRoom: (room: Room) => void;
    sites: Site[];
    selectedSite: Site | undefined;
    selectSite: (id: string) => void;
    rooms: Room[];
    roomTypes: RoomType[];
    alerts: EdgeAlert[];
    edgeRooms: EdgeRoom[];
    loading: boolean;
    error: string;
    notice: string;
    notify: (message: string) => void;
    refresh: () => Promise<void>;
    setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
    setRoomTypes: React.Dispatch<React.SetStateAction<RoomType[]>>;
    setSites: React.Dispatch<React.SetStateAction<Site[]>>;
    setAlerts: React.Dispatch<React.SetStateAction<EdgeAlert[]>>;
    signOut: () => void;
}
const Context = createContext<AppState | null>(null);
export function useApp() { const value = useContext(Context); if (!value)
    throw new Error('App context missing'); return value; }
const demo = import.meta.env.VITE_DEMO_MODE !== 'false';
const saved = (() => { try {
    const raw = sessionStorage.getItem('sensework-session');
    if (!raw)
        return null;
    const session = JSON.parse(raw) as Session;
    return session.expiresAt > Date.now() && (session.token === 'demo') === demo ? session : null;
}
catch {
    return null;
} })();
export default function App() {
    useLanguage();
    const [session, setSession] = useState<Session | null>(saved);
    const [page, setPage] = useState<Page>(() => {
        const route = readRoute();
        return saved && route.page && canVisit(route.page, saved.role) ? route.page : defaultPage(saved?.role ?? 'ADMIN');
    });
    const [authMode, setAuthMode] = useState<AuthMode>(() => readRoute().authMode ?? 'login');
    const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(() => readRoute().roomId);
    const [sites, setSites] = useState<Site[]>(demo ? demoSites : []);
    const [selectedSiteId, setSelectedSiteId] = useState<string>(demo ? demoSites[0].id : '');
    const [rooms, setRooms] = useState<Room[]>(demo ? demoRooms : []);
    const [roomTypes, setRoomTypes] = useState<RoomType[]>(demo ? demoRoomTypes : []);
    const [alerts, setAlerts] = useState<EdgeAlert[]>(demo ? demoAlerts : []);
    const edgeRooms: EdgeRoom[] = demo ? demoEdgeRooms : [];
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 5500); };
    const navigate = (next: Page, roomId?: string) => {
        const destination = pathForPage(next, roomId ?? selectedRoomId);
        if (`${window.location.pathname}${window.location.search}` !== destination)
            window.history.pushState(null, '', destination);
        if (roomId) setSelectedRoomId(roomId);
        setPage(next);
        window.scrollTo(0, 0);
    };
    const navigateAuth = (next: AuthMode) => {
        const requested = safeNext();
        const destination = `/${next}${requested ? `?next=${encodeURIComponent(pathForPage(requested.page, requested.roomId))}` : ''}`;
        window.history.pushState(null, '', destination);
        setAuthMode(next);
        window.scrollTo(0, 0);
    };
    useEffect(() => {
        const syncRoute = () => {
            const route = readRoute();
            if (!session) {
                if (route.authMode) { setAuthMode(route.authMode); return; }
                const next = route.page ? `?next=${encodeURIComponent(pathForPage(route.page, route.roomId))}` : '';
                window.history.replaceState(null, '', `/login${next}`);
                setAuthMode('login');
                return;
            }
            const destination = route.page && canVisit(route.page, session.role) ? route.page : defaultPage(session.role);
            if (destination !== route.page)
                window.history.replaceState(null, '', pathForPage(destination));
            setPage(destination);
            setSelectedRoomId(route.roomId);
        };
        syncRoute();
        window.addEventListener('popstate', syncRoute);
        return () => window.removeEventListener('popstate', syncRoute);
    }, [session?.role]);
    const selectedSite = sites.find(site => site.id === selectedSiteId) || sites[0];
    const selectedRoom = rooms.find(room => room.id === selectedRoomId);
    const openRoom = (room: Room) => navigate(session?.role === 'MEMBER' ? 'member-detail' : 'room-detail', room.id);
    const signOut = () => {
        sessionStorage.removeItem('sensework-session');
        window.history.pushState(null, '', '/login');
        setAuthMode('login');
        setSession(null);
    };
    const refresh = useCallback(async () => {
        if (!session || demo)
            return;
        setLoading(true);
        setError('');
        try {
            const [nextSites, nextRooms] = await Promise.all([monitoringApi.sites(session.token), monitoringApi.rooms(session.token)]);
            setSites(nextSites);
            setRooms(nextRooms);
            setSelectedSiteId(id => id || nextSites[0]?.id || '');
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not load data');
        }
        finally {
            setLoading(false);
        }
    }, [session]);
    useEffect(() => { if (session)
        void refresh(); }, [session, refresh]);
    useEffect(() => {
        if (!session || demo || !selectedSite)
            return;
        monitoringApi.roomTypes(session.token, selectedSite.id).then(setRoomTypes).catch(() => setRoomTypes([]));
    }, [session, selectedSiteId, selectedSite?.id]);
    useEffect(() => {
        if (!session || demo)
            return;
        const timer = window.setInterval(() => { if (session.expiresAt <= Date.now()) {
            signOut();
            return;
        } void refresh(); }, 60000);
        return () => window.clearInterval(timer);
    }, [session, refresh]);
    async function login(email: string, password: string, role: Role, demoName?: string) {
        setError('');
        const requested = safeNext();
        const next = demo ? { token: 'demo', email, name: demoName || email.split('@')[0] || 'Demo user', role, expiresAt: Date.now() + 86400000 } : await signIn(email, password);
        sessionStorage.setItem('sensework-session', JSON.stringify(next));
        setSession(next);
        navigate(requested && canVisit(requested.page, next.role) ? requested.page : defaultPage(next.role), requested?.roomId);
    }
    async function register(email: string, password: string, name: string, role: Role) {
        if (demo) {
            await login(email, password, role, name);
            return;
        }
        if (role === 'ADMIN')
            throw new Error('Cloud API currently creates member accounts only. An existing administrator must grant the administrator role.');
        await signUp(email, password, name);
        await login(email, password, 'MEMBER');
    }
    const context = useMemo<AppState | null>(() => session ? ({
        demo, session, page, navigate, selectedRoom, openRoom, sites, selectedSite, selectSite: setSelectedSiteId,
        rooms, roomTypes, alerts, edgeRooms, loading, error, notice, notify, refresh,
        setRooms, setRoomTypes, setSites, setAlerts, signOut,
    }) : null, [session, page, selectedRoomId, selectedRoom, sites, selectedSite, rooms, roomTypes, alerts, edgeRooms, loading, error, notice, refresh]);
    if (!session)
        return <AuthScreen demo={demo} mode={authMode} onModeChange={navigateAuth} onLogin={login} onRegister={register}/>;
    return <Context.Provider value={context}><Shell>{renderPage(page)}</Shell></Context.Provider>;
}
function renderPage(page: Page): ReactNode {
    switch (page) {
        case 'overview': return <Overview />;
        case 'rooms': return <AdminRooms />;
        case 'room-detail': return <RoomDetail member={false}/>;
        case 'devices': return <Devices />;
        case 'alerts': return <Alerts />;
        case 'insights': return <Insights />;
        case 'reports': return <Reports />;
        case 'members': return <Members />;
        case 'thresholds': return <Thresholds />;
        case 'edge-credentials': return <EdgeCredentials />;
        case 'room-types': return <RoomTypes />;
        case 'diagnostics': return <Diagnostics />;
        case 'member-rooms': return <MemberRooms />;
        case 'member-detail': return <RoomDetail member/>;
        case 'member-report': return <MemberReport />;
        case 'profile': return <MemberProfile />;
        case 'terms': return <Legal title="Terms of Service"/>;
        case 'privacy': return <Legal title="Privacy Policy"/>;
    }
}
function Legal({ title }: {
    title: string;
}) { return <section className="card legal"><h1>{tr(title)}</h1><p>{tr('The complete')} {tr(title).toLowerCase()} {tr('must be supplied by the SenseWork team before publication.')}</p></section>; }
