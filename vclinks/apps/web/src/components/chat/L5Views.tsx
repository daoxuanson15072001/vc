import { CalendarOutlined, EnvironmentOutlined, PhoneOutlined, VideoCameraOutlined } from '@ant-design/icons';
import type { CallMedia, LocationMedia, ReminderMedia } from '../../types';
import { callText, coordsText, mapUrl } from '../../utils/l5';

/** Location bubble (msgType 17): title, address, coordinates and a map link. No map image is loaded from a third party. */
export function LocationView({ location }: { location: LocationMedia }) {
  const url = mapUrl(location);
  const coords = coordsText(location);
  const body = (
    <div className="file-card" data-l5="location">
      <span className="file-card__icon" style={{ color: '#d92d20' }}>
        <EnvironmentOutlined />
      </span>
      <div className="file-card__body">
        <div className="file-card__name">{location.title || 'Vị trí được chia sẻ'}</div>
        <div className="file-card__size">{[location.address, coords].filter(Boolean).join(' · ') || 'Vị trí'}</div>
        {url && <div className="file-card__size">Mở bản đồ ↗</div>}
      </div>
    </div>
  );
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" style={{ display: 'block', color: 'inherit' }}>
      {body}
    </a>
  ) : (
    body
  );
}

/** Call line: "Cuộc gọi nhỡ" is flagged in red so it is not missed in a long thread. */
export function CallView({ call }: { call: CallMedia }) {
  const Icon = call.video ? VideoCameraOutlined : PhoneOutlined;
  const missed = call.outcome === 'missed' || call.outcome === 'declined';
  return (
    <div data-l5="call" style={{ display: 'flex', gap: 8, alignItems: 'center', color: missed ? '#d92d20' : undefined }}>
      <Icon />
      <span>{callText(call)}</span>
    </div>
  );
}

/** Appointment reminder shown as a Zalo "Nhắc hẹn" card. */
export function ReminderView({ reminder }: { reminder: ReminderMedia }) {
  return (
    <div className="file-card" data-l5="reminder">
      <span className="file-card__icon" style={{ color: '#e8590c' }}>
        <CalendarOutlined />
      </span>
      <div className="file-card__body">
        <div className="file-card__name">{reminder.title || 'Nhắc hẹn'}</div>
        <div className="file-card__size">{['Nhắc hẹn', reminder.when].filter(Boolean).join(' · ')}</div>
      </div>
    </div>
  );
}
