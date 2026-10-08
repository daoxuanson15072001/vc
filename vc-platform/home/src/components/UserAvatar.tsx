import { initials } from '../lib/messages';

const COLORS = [
  ['#DCE8FB', '#0A57D0'],
  ['#DDF3EA', '#0F6B52'],
  ['#FCE9D9', '#9A4700'],
  ['#ECE6FA', '#5B3FA8'],
  ['#FBE3E6', '#A3253A'],
  ['#E3EEF2', '#22566B'],
];

/** Google photo when VC ID has one, otherwise initials on a colour fixed per person. */
export function UserAvatar({ sub, name, email, picture, size = 32 }: { sub: string; name?: string; email?: string; picture?: string; size?: number }) {
  if (picture) return <img className="vh-avatar" src={picture} alt="" width={size} height={size} referrerPolicy="no-referrer" />;
  let h = 0;
  for (const ch of sub) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = COLORS[h % COLORS.length];
  return (
    <span className="vh-avatar" aria-hidden="true" style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.4) }}>
      {initials(name, email)}
    </span>
  );
}
