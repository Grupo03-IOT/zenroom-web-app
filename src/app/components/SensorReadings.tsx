import type { SensorMetrics } from '../../contexts/monitoring/domain/models';
import { tr } from '../../shared/i18n/i18n';
import { Card } from './Ui';

export function SensorReadings({ sensors }: { sensors: SensorMetrics | null | undefined }) {
    if (!sensors) return null;
    const age = Date.now() - Date.parse(sensors.sampledAt);
    const recent = Number.isFinite(age) && age >= -60000 && age <= 5 * 60000;
    return <Card className="physical-sensors">
        <div className="card-header"><h2>{tr('ESP32 sensors')}</h2><span className="muted">{tr(recent ? 'Last sensor sample' : 'Historical sensor sample')}: {new Date(sensors.sampledAt).toLocaleString()}</span></div>
        <p className="muted">{tr('Climate and occupancy summarize the minute. These sensors show its last sample. Updates can take up to two minutes.')}</p>
        <dl className="sensor-values">
            <div><dt>{tr('PIR movement')}</dt><dd>{tr(sensors.movement ? 'Detected' : 'Not detected')}</dd></div>
            <div><dt>{tr('Distance')}</dt><dd>{sensors.distanceCm == null ? tr('No echo') : `${sensors.distanceCm.toFixed(2)} cm`}</dd></div>
            <div><dt>{tr('Potentiometer')}</dt><dd>{sensors.potentiometer} <small>/ 4095 ADC</small></dd></div>
            {[sensors.button1, sensors.button2, sensors.button3].map((pressed, index) => <div key={index}><dt>{tr('Button')} {index + 1}</dt><dd>{tr(pressed ? 'Pressed' : 'Released')}</dd></div>)}
        </dl>
        <p className="muted">{tr('Button states are sampled every two seconds. Brief presses between samples may not appear.')}</p>
    </Card>;
}
