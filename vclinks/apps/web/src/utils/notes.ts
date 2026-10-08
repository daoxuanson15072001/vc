/**
 * Places internal notes and event lines between the messages of the thread by time (00 MH-UI-08: a note shows
 * where it was written). Notes older than the first loaded message wait until older messages are loaded (or show
 * at the top once everything is loaded); notes newer than the last message come after it.
 */
export function placeNotes<N extends { createdAt: string }>(
  messages: { id: string; sentAt: string }[],
  notes: N[],
  allLoaded: boolean,
): { before: Map<string, N[]>; after: N[] } {
  const before = new Map<string, N[]>();
  const after: N[] = [];
  const sorted = [...notes].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (!messages.length) return { before, after: sorted };
  const firstAt = Date.parse(messages[0]!.sentAt);
  let i = 0;
  for (const n of sorted) {
    const at = Date.parse(n.createdAt);
    if (at < firstAt && !allLoaded) continue;
    while (i < messages.length && Date.parse(messages[i]!.sentAt) <= at) i++;
    if (i >= messages.length) after.push(n);
    else {
      const id = messages[i]!.id;
      before.set(id, [...(before.get(id) ?? []), n]);
    }
  }
  return { before, after };
}

/** Text split around `@Name` mentions so they can be highlighted. */
export function mentionParts(text: string, names: string[]): { text: string; mention: boolean }[] {
  const wanted = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!wanted.length) return [{ text, mention: false }];
  const re = new RegExp(`@(${wanted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const out: { text: string; mention: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), mention: false });
    out.push({ text: m[0], mention: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out;
}

/** Staff names written as `@Name` in a message to the customer (00 MH-UI-08: probably meant as a note). */
export function staffMentioned(text: string, staff: string[], picked: string[] = []): string[] {
  const skip = new Set(picked);
  return [...new Set(staff)].filter((n) => n && !skip.has(n) && text.includes(`@${n}`));
}
