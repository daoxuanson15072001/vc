import { useState } from 'react';
import { Avatar } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { avatarColors, initials, safeUrl } from '../../utils/chat';

interface Props {
  name?: string | null;
  src?: string | null;
  /** Stable key for the fallback color (userId / threadId). */
  colorKey?: string | null;
  size?: number;
  group?: boolean;
}

/** Round avatar with an initials + color fallback when there is no (loadable) image. */
export default function ChatAvatar({ name, src, colorKey, size = 48, group }: Props) {
  const [broken, setBroken] = useState(false);
  const url = broken ? undefined : safeUrl(src);
  const { bg, fg } = avatarColors(colorKey ?? name);
  if (url) {
    return (
      <Avatar
        size={size}
        src={url}
        alt={name ?? ''}
        style={{ flexShrink: 0 }}
        onError={() => {
          setBroken(true);
          return false;
        }}
      />
    );
  }
  const hasName = !!name?.trim();
  return (
    <Avatar
      size={size}
      style={{ background: bg, color: fg, flexShrink: 0, fontSize: Math.round(size * 0.34), fontWeight: 600 }}
      icon={!hasName && group ? <TeamOutlined /> : undefined}
    >
      {hasName || !group ? initials(name) : null}
    </Avatar>
  );
}
