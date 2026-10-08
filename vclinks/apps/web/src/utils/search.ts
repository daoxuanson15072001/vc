import type { SearchHit } from '@vclinks/shared';

/** Link of a search hit: the chat opens on the page holding the message and flashes it (`?msg=`). */
export function hitLink(h: Pick<SearchHit, 'conversationId' | 'msgId'>): string {
  return `/conversations/${encodeURIComponent(h.conversationId)}?msg=${encodeURIComponent(h.msgId)}`;
}

/** Cuts a snippet into plain / bold parts by the API's `marks` (ranges relative to the snippet). */
export function splitMarks(snippet: string, marks: [number, number][]): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  let at = 0;
  for (const [s, e] of [...marks].sort((a, b) => a[0] - b[0])) {
    const from = Math.max(s, at);
    if (e <= from) continue;
    if (from > at) out.push({ text: snippet.slice(at, from), bold: false });
    out.push({ text: snippet.slice(from, e), bold: true });
    at = e;
  }
  if (at < snippet.length) out.push({ text: snippet.slice(at), bold: false });
  return out;
}

/** Query string of the /search page (empty values dropped), so a search can be shared and survives a reload. */
export function searchUrl(p: { q: string; uid?: string[]; from?: string; to?: string }): string {
  const qs = new URLSearchParams();
  qs.set('q', p.q);
  if (p.uid?.length) qs.set('uid', p.uid.join(','));
  if (p.from) qs.set('from', p.from);
  if (p.to) qs.set('to', p.to);
  return `/search?${qs.toString()}`;
}
