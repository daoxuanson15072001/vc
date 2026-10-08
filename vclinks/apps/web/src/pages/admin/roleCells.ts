import { SCOPE_LABELS, type PermCell } from '@vclinks/shared';

const MODE_TEXT = { view: 'chỉ xem', propose: 'chỉ đề xuất', request: 'chỉ gửi yêu cầu' } as const;

/** Text of one matrix cell: scopes, `+NK` when each use is logged; ✖ when the role never has it. */
export function cellText(c: PermCell | undefined, scopes: Record<string, string> = SCOPE_LABELS): string {
  if (!c || (!c.s.length && !c.reveal?.length)) return '✖';
  const base = c.s.length ? c.s.map((s) => scopes[s] ?? s).join(', ') : 'Hiện: ' + (c.reveal ?? []).map((s) => scopes[s] ?? s).join(', ');
  return c.log ? `${base} +NK` : base;
}

export function cellHint(c: PermCell | undefined): string {
  if (!c || (!c.s.length && !c.reveal?.length)) return 'Vai trò này không có quyền.';
  const parts: string[] = [];
  if (c.mode) parts.push(`Mức: ${MODE_TEXT[c.mode]}.`);
  if (c.cond) parts.push('Cần đủ điều kiện riêng; hiện chưa được cấp tự động.');
  if (c.log) parts.push('Mỗi lần dùng đều ghi nhật ký (+NK).');
  if (c.notSelf) parts.push('Không áp dụng cho chính mình.');
  if (c.reveal?.length && c.s.length) parts.push(`Số điện thoại: bấm "Hiện" ở ${c.reveal.map((s) => SCOPE_LABELS[s]).join(', ')}.`);
  return parts.join(' ') || 'Được phép trong phạm vi đã ghi.';
}
