/** Shown instead of a raw uid or the auto-generated "Zalo 4762…" label (03 MH-SZ-12a: nick labels never show the uid). */
export const UNNAMED_NICK = 'Nick chưa đặt tên';

/** Display name of an account: its label, unless that is empty or just "Zalo <uid>". */
export function nickName(label: string | undefined | null, ownerName?: string | null): string {
  const l = (label ?? '').trim();
  if (l && !/^Zalo\s+\d{5,}/.test(l) && !/^\d{8,}$/.test(l)) return l;
  return ownerName?.trim() || UNNAMED_NICK;
}
