import { PERMISSION_INFO, SCOPE_LABELS, channelOfUid, type EffectiveCheck, type EffectiveTargetResult, type PermissionKey, type ScopeCode } from '@vclinks/shared';
import { C, DbService } from '../db/db.service';
import { runUnscoped } from '../db/tenant-context';
import type { UserDoc } from '../users/users.service';
import { decide, hasKey, phoneVisibility, type Subject } from './engine';
import type { AuthzService } from './authz.service';

/** What the "Quyền hiệu lực" tab asks about one conversation (PQ-09: view, reply, a sales action, phone). */
const CHECKED: PermissionKey[] = ['conv.view', 'conv.reply', 'cust.view', 'cust.phone_full', 'quote.send'];

const REFUSED: Record<string, string> = {
  khong_co_quyen: 'vai trò của người này không có quyền này',
  ngoai_pham_vi: 'đối tượng nằm ngoài phạm vi của người này',
  tai_khoan_khong_hoat_dong: 'tài khoản không hoạt động',
  quan_sat: 'vai trò Ban giám đốc chỉ xem, không gửi',
  nick_chua_an_toan: 'nick chưa an toàn (chưa xác nhận đăng xuất thiết bị cũ)',
  chua_duoc_gan_nick: 'không phải người giữ nick và không được trả lời thay',
  kenh_chua_gan_muc_gui: 'kênh chưa gán mức "gửi" cho người này',
  khong_ap_dung_cho_chinh_minh: 'không áp dụng cho chính mình',
};

function why(allowed: boolean, via: string): string {
  if (allowed) {
    const scope = via.startsWith('tra_loi_thay:') ? 'trả lời thay' : via === 'NICK' ? 'người giữ nick' : via === 'YC' ? 'quyền tạm thời đang hiệu lực' : (SCOPE_LABELS[via as ScopeCode] ?? via);
    return `phạm vi ${scope}`;
  }
  if (via.startsWith('chi_duoc_')) return 'vai trò chỉ có quyền ở mức thấp hơn';
  if (via.startsWith('thieu_dieu_kien:')) return 'thiếu điều kiện của quyền';
  return REFUSED[via] ?? via;
}

/** `H*** L***` style: first letter of each word, so the Admin can tell customers apart without reading a name. */
const abbreviate = (name: string) => name.trim().split(/\s+/).map((w) => `${w.slice(0, 1)}***`).join(' ');

/** Conversation ids the text points at: a conversation id, a phone number or a name fragment (at most 5). */
async function resolve(db: DbService, text: string): Promise<{ id: string; name: string }[]> {
  const q = text.trim();
  return runUnscoped(async () => {
    if (q.includes(':')) {
      const c = await db.col<{ _id: string; threadId: string }>(C.conversations).findOne({ _id: q as never }, { projection: { threadId: 1 } });
      if (!c) return [];
      const uid = q.slice(0, q.indexOf(':'));
      const ct = await db.col<{ displayName?: string; zaloName?: string }>(C.contacts).findOne({ _id: `${uid}:${c.threadId}` as never }, { projection: { displayName: 1, zaloName: 1 } });
      return [{ id: q, name: ct?.displayName ?? ct?.zaloName ?? '' }];
    }
    const digits = q.replace(/\D/g, '');
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = digits.length >= 6 ? { phone: { $regex: `${esc(digits.replace(/^84/, '0').slice(-9))}$` } } : { $or: [{ displayName: { $regex: esc(q), $options: 'i' } }, { zaloName: { $regex: esc(q), $options: 'i' } }] };
    const found = await db.col<{ _id: string; uid: string; userId: string; displayName?: string; zaloName?: string }>(C.contacts).find(filter as never, { projection: { uid: 1, userId: 1, displayName: 1, zaloName: 1 } }).limit(20).toArray();
    const out: { id: string; name: string }[] = [];
    for (const c of found) {
      const id = `${c.uid}:${c.userId}`;
      if (await db.col(C.conversations).countDocuments({ _id: id as never }, { limit: 1 })) out.push({ id, name: c.displayName ?? c.zaloName ?? '' });
      if (out.length >= 5) break;
    }
    return out;
  });
}

/** Explains, for one user and the conversations a text points at, which actions are allowed and why. No content, no phone. */
export async function explainRights(authz: AuthzService, db: DbService, subject: Subject, text: string, asker?: Subject): Promise<{ results: EffectiveTargetResult[]; note: string | null }> {
  if (text.trim().length < 3) return { results: [], note: 'Nhập mã hội thoại (dạng uid:mã), tên hoặc SĐT của khách (ít nhất 3 ký tự).' };
  const targets = await resolve(db, text);
  const notFound = { results: [], note: 'Không tìm thấy khách hoặc hội thoại nào khớp.' };
  if (!targets.length) return notFound;
  // A supervisor / director (permission.explain on TO / DV) only learns about conversations they may open
  // themselves; otherwise a phone or name lookup would reveal customers outside their own scope.
  const askerLimited = !!asker && !hasKey(asker, 'permission.explain', { scopes: ['TD', 'ALL'] });
  const results: EffectiveTargetResult[] = [];
  for (const t of targets) {
    const sep = t.id.indexOf(':');
    const uid = t.id.slice(0, sep);
    const threadId = t.id.slice(sep + 1);
    const target = await authz.conversationTarget(uid, threadId);
    if (askerLimited && !decide(asker!, 'conv.view', target).allowed) continue;
    const checks: EffectiveCheck[] = [];
    for (const key of CHECKED) {
      let allowed: boolean;
      let via: string;
      if (key === 'conv.reply') {
        const d = await authz.canSend(subject, uid, threadId);
        ({ allowed, via } = d);
      } else if (key === 'cust.phone_full') {
        const v = phoneVisibility(subject, target);
        allowed = v !== 'masked';
        via = v === 'full' ? 'phạm vi được xem đủ' : v === 'reveal' ? 'chỉ xem sau khi bấm "Hiện" (có ghi nhật ký)' : 'ngoai_pham_vi';
        checks.push({ key, label: PERMISSION_INFO[key].label, allowed, reason: allowed ? via : why(false, via) });
        continue;
      } else {
        ({ allowed, via } = decide(subject, key, target));
      }
      checks.push({ key, label: PERMISSION_INFO[key].label, allowed, reason: why(allowed, via) });
    }
    let howToSee: string | null = null;
    let canRequestGrant = false;
    let approverName: string | null = null;
    if (!checks[0]!.allowed) {
      const owners = target.responsibleIds?.length ? [...(await authz.userNames(target.responsibleIds)).values()] : [];
      const approver = await authz.grantApprover(subject.userId, uid);
      // The asker never files a request he would approve himself (PQ-70).
      canRequestGrant = !!approver && approver.userId !== asker?.userId;
      approverName = approver?.fullName ?? null;
      howToSee = `${owners.length ? `Người phụ trách khách: ${owners.join(', ')}. ` : ''}Cách thấy: người phụ trách chuyển khách, hoặc xin quyền tạm thời${approver ? ` (người duyệt: ${approver.fullName})` : ''}.`;
    }
    const acc = await runUnscoped(() => db.col<{ _id: string; label?: string }>(C.accounts).findOne({ _id: uid as never }, { projection: { label: 1 } }));
    results.push({ conversationId: t.id, label: t.name ? abbreviate(t.name) : t.id, channelLabel: acc ? `${acc.label ?? uid} (${channelOfUid(uid)})` : null, checks, howToSee, canRequestGrant, approverName });
  }
  return results.length ? { results, note: null } : notFound;
}

export async function userFullName(db: DbService, id: string): Promise<string | null> {
  const u = await runUnscoped(() => db.col<UserDoc>(C.users).findOne({ _id: id as never }, { projection: { fullName: 1 } }));
  return u?.fullName ?? null;
}
