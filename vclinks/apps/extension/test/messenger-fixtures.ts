/**
 * Fixture HTML shaped like Messenger's rendered DOM as far as the (unverified)
 * selectors assume: role="main" > role="grid" > role="row" rows, visually
 * hidden sender headings, dir="auto" text containers, time separator rows,
 * sidebar links to /t/<id>. Replace with a real survey sample once verified
 * (docs/04-ky-thuat/kenh/facebook-personal.md §6).
 */

export const OWNER_ID = '100001111111111';
export const PARTNER_ID = '100002222222222';
export const GROUP_ID = '7777777777777777';

export const sep = (label: string) =>
  `<div role="row"><div data-scope="date_break"><span>${label}</span></div></div>`;

/** Separator without data-scope (fallback: whole row text is a date/time). */
export const sepPlain = (label: string) => `<div role="row"><div><span>${label}</span></div></div>`;

export const out = (text: string, heading = true) =>
  `<div role="row">${heading ? '<h5><span>Bạn đã gửi</span></h5>' : ''}<div><div dir="auto">${text}</div></div></div>`;

export function inc(
  name: string,
  text: string,
  opts: { heading?: boolean; avatarId?: string; image?: string; file?: { name: string; url: string }; link?: string } = {},
) {
  const heading = opts.heading ?? true;
  const avatar = opts.avatarId
    ? `<a href="https://www.facebook.com/profile.php?id=${opts.avatarId}" aria-label="${name}"><img src="https://scontent.xx.fbcdn.net/v/t39/p40x40/av_${opts.avatarId}.jpg?stp=abc&oh=1" width="28" height="28"></a>`
    : '';
  const image = opts.image ? `<div><img src="${opts.image}" width="300" height="200" alt=""></div>` : '';
  const file = opts.file ? `<a href="${opts.file.url}"><span>${opts.file.name}</span></a>` : '';
  const link = opts.link ? ` <a href="${opts.link}">liên kết</a>` : '';
  const body = text ? `<div dir="auto">${text}${link}</div>` : link;
  return `<div role="row">${heading ? `<h5><span>${name}</span></h5>` : ''}${avatar}<div>${body}${image}${file}</div></div>`;
}

export const seen = () =>
  `<div role="row"><div dir="auto">Đã xem</div><img src="https://scontent.xx.fbcdn.net/v/t39/p16x16/seen.jpg" width="14" height="14"></div>`;

export interface SidebarEntry {
  id: string;
  name: string;
  unread?: boolean;
  group?: boolean;
  e2ee?: boolean;
}

export function sidebar(entries: SidebarEntry[], base = '') {
  const items = entries
    .map((e) => {
      const imgs = e.group
        ? `<img src="https://scontent.xx.fbcdn.net/v/g1_${e.id}.jpg"><img src="https://scontent.xx.fbcdn.net/v/g2_${e.id}.jpg">`
        : `<img src="https://scontent.xx.fbcdn.net/v/a_${e.id}.jpg">`;
      const unread = e.unread ? '<span>Tin nhắn chưa đọc:</span>' : '';
      return `<div role="row"><a href="${base}/${e.e2ee ? 'e2ee/' : ''}t/${e.id}/" role="link">${imgs}<span dir="auto"><span>${e.name}</span></span>${unread}<span dir="auto">tin cuối cùng chưa đọc</span></a></div>`;
    })
    .join('');
  return `<div role="navigation" aria-label="Đoạn chat"><div role="grid" aria-label="Đoạn chat">${items}</div></div>`;
}

export function page(opts: { rows: string; sidebar?: string; composer?: boolean; banner?: string }) {
  return `
    <div role="banner">${opts.banner ?? ''}</div>
    ${opts.sidebar ?? ''}
    <div role="main">
      <div role="grid" aria-label="Tin nhắn trong cuộc trò chuyện với Khách">${opts.rows}</div>
      ${opts.composer === false ? '' : '<div role="textbox" contenteditable="true" aria-label="Nhắn tin"><p><br></p></div>'}
    </div>`;
}
