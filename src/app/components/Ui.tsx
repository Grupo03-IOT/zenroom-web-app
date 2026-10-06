import type { ReactNode } from 'react';
import type { RoomStatus } from '../../contexts/monitoring/domain/models';
import { tr } from '../../shared/i18n/i18n';
import okShape from '../../shared/assets/status-shape-ok.svg';
import warnShape from '../../shared/assets/status-shape-warn.svg';
import offShape from '../../shared/assets/status-shape-off.svg';
export function Card({ children, className = '', id }: {
    children: ReactNode;
    className?: string;
    id?: string;
}) { return <section id={id} className={`card ${className}`}>{children}</section>; }
export function StatusBadge({ status }: {
    status: RoomStatus;
}) {
    const label = { optimal: 'Optimal', moderate: 'Moderate', bad: 'Not recommended', 'no-data': 'No data' }[status];
    return <span className={`status status-${status}`}>{status === 'bad' ? <i /> : <img src={status === 'optimal' ? okShape : status === 'moderate' ? warnShape : offShape} alt=""/>}{tr(label)}</span>;
}
export function Kpi({ icon, label, value, suffix, status }: {
    icon: ReactNode;
    label: string;
    value: string | number;
    suffix: string;
    status?: RoomStatus;
}) {
    return <Card className="kpi"><div className="kpi-label">{icon}<span>{tr(label)}</span></div><div className="kpi-value"><strong>{value}</strong><span>{tr(suffix)}</span></div>{status && <StatusBadge status={status}/>}</Card>;
}
export function Empty({ title, detail, action }: {
    title: string;
    detail: string;
    action?: ReactNode;
}) { return <Card className="empty"><div className="empty-icon">○</div><h3>{tr(title)}</h3><p>{tr(detail)}</p>{action}</Card>; }
export function Unavailable({ message }: {
    message: string;
}) { return <div className="inline-note">{tr(message)}</div>; }
