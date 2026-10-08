import { CHANNEL_INFO, type Channel } from '@vclinks/shared';

/** Two-letter marks for tight spots (avatar overlay, filter chips); the full name stays in the tooltip. */
const CHANNEL_MARK: Record<Channel, string> = { zalo: 'Za', zalo_oa: 'OA', fb_page: 'FP', fb_personal: 'FB' };

/** Small colored tag naming the channel of a conversation or account. */
export default function ChannelBadge({ channel, compact }: { channel: Channel; compact?: boolean }) {
  const info = CHANNEL_INFO[channel];
  return (
    <span
      className={`channel-badge channel-badge--${channel}${compact ? ' channel-badge--compact' : ''}`}
      title={info.label}
      {...(compact ? { role: 'img', 'aria-label': info.label } : {})}
    >
      {compact ? CHANNEL_MARK[channel] : info.shortLabel}
    </span>
  );
}
