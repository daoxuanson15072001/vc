import { Tooltip } from 'antd';
import { CHANNEL_INFO, type Channel } from '@vclinks/shared';
import { nickName } from '../../utils/nick';

/** Chip "Zalo · Minh VCparts" (00 §3.2 variant `withAccount`): the channel plus the name given to the account, never an id. */
export default function ChannelChip({ channel, nickLabel, ownerName, plain }: { channel: Channel; nickLabel?: string | null; ownerName?: string | null; plain?: boolean }) {
  const info = CHANNEL_INFO[channel];
  const name = plain ? null : nickName(nickLabel, ownerName);
  const text = name ? `${info.shortLabel} · ${name.length > 24 ? `${name.slice(0, 24)}…` : name}` : info.shortLabel;
  return (
    <Tooltip title={name ? `${info.label} · ${name}` : info.label}>
      <span className={`channel-badge channel-badge--${channel}`}>{text}</span>
    </Tooltip>
  );
}
