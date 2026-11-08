import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, Role } from '../contexts/identity/domain/session';
import { signIn, signUp } from '../contexts/identity/infrastructure/identityApi';
import { roomStatus } from '../contexts/monitoring/domain/models';
import type { Device, Gateway, Room, RoomStatus, RoomType, Site } from '../contexts/monitoring/domain/models';
import { monitoringApi } from '../contexts/monitoring/infrastructure/monitoringApi';
import type { Threshold } from '../contexts/alerting/domain/models';
import { alertingApi } from '../contexts/alerting/infrastructure/alertingApi';
import { sessionExpiredEvent } from '../shared/api/http';
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
    session: Session;
    page: Page;
    navigate: (page: Page, roomId?: string) => void;
    selectedRoom: Room | undefined;
    openRoom: (room: Room) => void;
    sites: Site[];
    selectedSite: Site | undefined;
    selectSite: (id: string) => void;
    refreshMs: number;
    setRefreshMs: (ms: number) => void;
    rooms: Room[];
    devices: Device[];
    gateways: Gateway[];
    statusFor: (room: Room) => RoomStatus;
    roomTypes: RoomType[];
    loading: boolean;
    error: string;
    notice: string;
    notify: (message: string) => void;
    refresh: () => Promise<void>;
    setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
    setRoomTypes: React.Dispatch<React.SetStateAction<RoomType[]>>;
    setSites: React.Dispatch<React.SetStateAction<Site[]>>;
    signOut: () => void;
}
const Context = createContext<AppState | null>(null);
export function useApp() { const value = useContext(Context); if (!value)
    throw new Error('App context missing'); return value; }
const saved = (() => { try {
    const raw = sessionStorage.getItem('sensework-session');
    if (!raw)
        return null;
    const session = JSON.parse(raw) as Session;
    return session.expiresAt > Date.now() && session.token?.split('.').length === 3 ? session : null;
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
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [allRooms, setRooms] = useState<Room[]>([]);
    const [allDevices, setDevices] = useState<Device[]>([]);
    const [allGateways, setGateways] = useState<Gateway[]>([]);
    const [thresholdsByType, setThresholdsByType] = useState<Record<string, Threshold[]>>({});
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const activeToken = useRef(session?.token);
    activeToken.current = session?.token;
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
    // El selector de local filtra salas, dispositivos y gateways con sus identificadores reales.
    const rooms = allRooms.filter(room => room.siteId === selectedSite?.id);
    const devices = allDevices.filter(device => rooms.some(room => room.id === device.roomId));
    const gateways = allGateways.filter(gateway => gateway.siteId === selectedSite?.id);
    const selectedRoom = allRooms.find(room => room.id === selectedRoomId);
    const statusFor = (room: Room) => roomStatus(room, thresholdsByType[room.roomTypeId || ''] || []);
    const openRoom = (room: Room) => navigate(session?.role === 'MEMBER' ? 'member-detail' : 'room-detail', room.id);
    const signOut = useCallback(() => {
        sessionStorage.removeItem('sensework-session');
        activeToken.current = undefined;
        window.history.pushState(null, '', '/login');
        setAuthMode('login');
        setSession(null);
        setRooms([]);
        setSites([]);
        setRoomTypes([]);
        setDevices([]);
        setGateways([]);
        setThresholdsByType({});
        setSelectedSiteId('');
        setSelectedRoomId(undefined);
        setLoading(false);
        setError('');
        setNotice('');
    }, []);
    useEffect(() => {
        const expire = (event: Event) => {
            if ((event as CustomEvent<string>).detail === activeToken.current) signOut();
        };
        window.addEventListener(sessionExpiredEvent, expire);
        return () => window.removeEventListener(sessionExpiredEvent, expire);
    }, [signOut]);
    useEffect(() => {
        if (selectedRoom?.siteId) setSelectedSiteId(selectedRoom.siteId);
    }, [selectedRoom?.id, selectedRoom?.siteId]);
    const refresh = useCallback(async () => {
        if (!session)
            return;
        setLoading(true);
        setError('');
        try {
            const results = await Promise.allSettled([
                monitoringApi.sites(session.token),
                monitoringApi.rooms(session.token),
                session.role === 'ADMIN' ? monitoringApi.devices(session.token) : Promise.resolve<Device[]>([]),
                session.role === 'ADMIN' ? monitoringApi.gateways(session.token) : Promise.resolve<Gateway[]>([]),
            ]);
            if (activeToken.current !== session.token) return;
            const [nextSites, nextRooms, nextDevices, nextGateways] = results;
            if (nextSites.status === 'fulfilled') {
                setSites(nextSites.value);
                setSelectedSiteId(id => nextSites.value.some(site => site.id === id) ? id : nextSites.value[0]?.id || '');
            }
            if (nextRooms.status === 'fulfilled') setRooms(nextRooms.value);
            if (nextDevices.status === 'fulfilled') setDevices(nextDevices.value);
            if (nextGateways.status === 'fulfilled') setGateways(nextGateways.value);
            const failed = results.find(result => result.status === 'rejected');
            if (failed?.status === 'rejected') throw failed.reason;
        }
        catch (cause) {
            if (activeToken.current === session.token) setError(cause instanceof Error ? cause.message : 'Could not load data');
        }
        finally {
            if (activeToken.current === session.token) setLoading(false);
        }
    }, [session?.token, session?.role]);
    useEffect(() => { if (session)
        void refresh(); }, [session, refresh]);
    useEffect(() => {
        setRoomTypes([]);
        setThresholdsByType({});
    }, [session?.token, selectedSite?.id]);
    useEffect(() => {
        if (!session || !selectedSite) return;
        let cancelled = false;
        void monitoringApi.roomTypes(session.token, selectedSite.id).then(async types => {
            if (cancelled) return;
            setRoomTypes(types);
            const results = await Promise.allSettled(types.map(type => alertingApi.thresholds(session.token, type.id)));
            if (cancelled) return;
            setThresholdsByType(Object.fromEntries(types.map((type, index) => {
                const result = results[index];
                return [type.id, result.status === 'fulfilled' ? result.value : []];
            })));
            const failed = results.find(result => result.status === 'rejected');
            if (failed?.status === 'rejected') setError(failed.reason instanceof Error ? failed.reason.message : 'Could not load thresholds');
        }).catch(cause => {
            if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load room types');
        });
        return () => { cancelled = true; };
    }, [session?.token, selectedSite?.id, allRooms]);
    const [refreshMs, setRefreshMsState] = useState<number>(() => {
        const saved = Number(window.localStorage.getItem('zenroom.refreshMs'));
        return [10000, 30000, 60000, 300000].includes(saved) ? saved : 30000;
    });
    const setRefreshMs = useCallback((ms: number) => { window.localStorage.setItem('zenroom.refreshMs', String(ms)); setRefreshMsState(ms); }, []);
    useEffect(() => {
        if (!session)
            return;
        const timer = window.setInterval(() => { if (session.expiresAt <= Date.now()) {
            signOut();
            return;
        } void refresh(); }, refreshMs);
        return () => window.clearInterval(timer);
    }, [session, refresh, signOut, refreshMs]);
    function enterSession(next: Session) {
        const requested = safeNext();
        sessionStorage.setItem('sensework-session', JSON.stringify(next));
        setSession(next);
        navigate(requested && canVisit(requested.page, next.role) ? requested.page : defaultPage(next.role), requested?.roomId);
    }
    async function login(email: string, password: string) {
        setError('');
        enterSession(await signIn(email, password));
    }
    async function register(email: string, password: string, name: string, role: Role) {

        if (role === 'ADMIN')
            throw new Error('Cloud API currently creates member accounts only. An existing administrator must grant the administrator role.');
        await signUp(email, password, name);
        await login(email, password);
    }
    const context = useMemo<AppState | null>(() => session ? ({
        session, page, navigate, selectedRoom, openRoom, sites, selectedSite, selectSite: setSelectedSiteId, refreshMs, setRefreshMs,
        rooms, devices, gateways, statusFor, roomTypes, loading, error, notice, notify, refresh,
        setRooms, setRoomTypes, setSites, signOut,
    }) : null, [session, page, selectedRoomId, selectedRoom, sites, selectedSite, rooms, devices, gateways, thresholdsByType, roomTypes, loading, error, notice, refresh, refreshMs, setRefreshMs]);
    if (!session)
        return <AuthScreen mode={authMode} onModeChange={navigateAuth} onLogin={login} onRegister={register}/>;
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
