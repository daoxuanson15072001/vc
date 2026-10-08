'use strict';
/**
 * Reads the permission matrix of docs/02-yeu-cau/dac-ta/01-phan-quyen.md §3 (3.1–3.7) and turns
 * every cell into a normalized PermCell. Single source for:
 *   - tools/authz/gen-permissions.js (writes ROLE_MATRIX into packages/shared/src/permissions.ts)
 *   - apps/api/src/authz/matrix.spec.ts (checks ROLE_MATRIX and the engine against the spec, one case per cell)
 *
 * Cells written as free text in the spec are read through NARROW_CELLS: the narrower (safer) reading,
 * listed for the project owner to confirm. A free-text cell missing from NARROW_CELLS throws, so a spec
 * change can never be silently widened.
 */
const fs = require('node:fs');
const path = require('node:path');

const SPEC_PATH = path.resolve(__dirname, '../../docs/02-yeu-cau/dac-ta/01-phan-quyen.md');

/** Matrix columns, in spec order (§3 header). */
const COLUMNS = ['admin', 'giam_doc_bh', 'giam_sat_bh', 'nvkd', 'cskh', 'marketing', 'sale_admin', 'ke_toan', 'nv_thi_truong', 'quan_sat'];

/** Spec symbol → scope code (packages/shared SCOPE_CODES). */
const SYMBOLS = {
  'TĐ': 'TD',
  DV: 'DV',
  'TỔ': 'TO',
  NH: 'NH',
  CT: 'CT',
  NICK: 'NICK',
  'KÊNH': 'KENH',
  TK: 'TK',
  LEAD: 'LEAD',
  'TUYẾN': 'TUYEN',
  YC: 'YC',
};

/**
 * Free-text cells, key|column → narrow reading. `cond` = a condition the engine cannot check yet: the
 * cell only applies when the caller asserts it (nothing asserts it in M1b-04, so these act as ✖).
 * `mode`: view = read only, propose = may propose / draft, request = may only send a request.
 */
const NARROW_CELLS = {
  'conv.transfer|nvkd': { s: ['CT', 'NICK'], mode: 'request' },
  'outbox.reapprove|cskh': { s: ['CT'] },
  'msg.recall|giam_doc_bh': { s: ['SELF', 'NICK'] },
  'msg.recall|giam_sat_bh': { s: ['SELF', 'NICK'] },
  'msg.recall|cskh': { s: ['SELF'] },
  'msg.recall|nv_thi_truong': { s: ['SELF', 'NICK'] },
  'cust.timeline|sale_admin': { s: ['DV'], cond: 'no_messages' },
  'cust.commerce|cskh': { s: ['TK', 'KENH'], cond: 'orders_only' },
  'cust.edit|cskh': { s: ['TK'], cond: 'tag_note_only' },
  'cust.edit|nv_thi_truong': { s: ['TUYEN'], cond: 'note_only' },
  'cust.import|marketing': { s: ['DV'], cond: 'lead_only' },
  'cust.transfer_request|giam_sat_bh': { s: ['TO'], cond: 'to_own_team' },
  'cust.phone_full|giam_doc_bh': { s: ['CT', 'NICK'], reveal: ['DV'], log: true },
  'cust.phone_full|giam_sat_bh': { s: ['CT', 'NICK'], reveal: ['TO'], log: true },
  'cust.phone_full|nvkd': { s: ['CT', 'NICK'] },
  'cust.phone_full|cskh': { s: ['TK'], reveal: ['KENH'], log: true, cond: 'ticket_open' },
  'cust.phone_full|marketing': { s: [], reveal: ['LEAD'], log: true },
  'cust.phone_full|sale_admin': { s: [], reveal: ['DV'], log: true },
  'cust.phone_full|ke_toan': { s: [], reveal: ['DV'], log: true, cond: 'invoice_request' },
  'cust.phone_full|nv_thi_truong': { s: ['TUYEN', 'NICK'] },
  'cust.phone_full|quan_sat': { s: [], reveal: ['TD'], log: true },
  'cust.export|marketing': { s: ['DV'], log: true, cond: 'unassigned_leads' },
  'cust.export_phone|giam_doc_bh': { s: ['DV'], log: true, mode: 'request' },
  'export.approve|giam_doc_bh': { s: [], cond: 'q_pq_19' },
  'export.approve|quan_sat': { s: ['TD'] },
  'cust.privacy_request|admin': { s: ['ALL'], cond: 'no_content' },
  'cust.privacy_request|quan_sat': { s: ['TD'], mode: 'view' },
  'workitem.approve|giam_doc_bh': { s: ['DV'], cond: 'on_behalf' },
  'workitem.approve|giam_sat_bh': { s: ['TO'], cond: 'on_behalf' },
  'workitem.queue_config|giam_doc_bh': { s: ['DV'] },
  'workitem.queue_config|cskh': { s: ['NH'], mode: 'propose' },
  'payment_reply.process|giam_doc_bh': { s: ['DV'], mode: 'view' },
  'debt.hold|giam_doc_bh': { s: ['DV'] },
  'debt.hold|giam_sat_bh': { s: ['TO'], mode: 'propose' },
  'debt.hold|nvkd': { s: ['CT'], mode: 'propose' },
  'debt.hold|ke_toan': { s: ['DV'] },
  'debt.notice.respond|giam_sat_bh': { s: ['TO'], cond: 'owner_absent' },
  'debt.note|sale_admin': { s: ['DV'], mode: 'view' },
  'debt.note|quan_sat': { s: ['TD'], mode: 'view' },
  'invoice_settings.edit|admin': { s: ['ALL'], cond: 'integration_only' },
  'ticket.view|nvkd': { s: ['CT'] },
  'ticket.view|cskh': { s: ['TK'] },
  'media.delete|marketing': { s: ['SELF'] },
  'zns.send_single|sale_admin': { s: ['DV'], cond: 'order_templates' },
  'zns.send_single|ke_toan': { s: ['DV'], cond: 'invoice_payment_templates' },
  'campaign.create|marketing': { s: ['DV'], cond: 'purpose_nurture_lead' },
  'campaign.create|sale_admin': { s: ['DV'], cond: 'purpose_order_confirm' },
  'campaign.create|ke_toan': { s: ['DV'], cond: 'purpose_payment' },
  'campaign.run|cskh': { s: ['SELF'] },
  'campaign.run|marketing': { s: ['SELF'], cond: 'purpose_nurture_lead' },
  'campaign.run|sale_admin': { s: ['SELF'] },
  'campaign.run|ke_toan': { s: ['SELF'] },
  'campaign.report|giam_sat_bh': { s: ['TO'] },
  'campaign.report|marketing': { s: ['DV'], cond: 'purpose_nurture_lead' },
  'campaign.report|sale_admin': { s: ['SELF'] },
  'campaign.report|ke_toan': { s: ['DV'], cond: 'purpose_payment' },
  'cost.view|admin': { s: ['TD'], mode: 'view' },
  'cost.view|cskh': { s: ['NH'], mode: 'view' },
  'ads.spend_lock|marketing': { s: ['NH'] },
  'lead.dispute|giam_doc_bh': { s: ['DV'] },
  'lead.dispute|giam_sat_bh': { s: ['TO'] },
  'bot.edit|cskh': { s: ['NH'], mode: 'propose' },
  'bot.kill|marketing': { s: ['DV'] },
  'automation.edit|giam_doc_bh': { s: ['DV'], cond: 'toggle_only' },
  'automation.edit|cskh': { s: ['NH'], cond: 'no_activate' },
  'channel.confirm|giam_doc_bh': { s: ['DV'], mode: 'view' },
  'channel.safety_confirm|giam_sat_bh': { s: ['NICK'] },
  'channel.safety_confirm|nvkd': { s: ['NICK'] },
  'channel.safety_confirm|nv_thi_truong': { s: ['NICK'] },
  'user.edit|admin': { s: ['ALL'], notSelf: true },
  'role.approve|quan_sat': { s: ['ALL'] },
  'user.lock|giam_sat_bh': { s: ['TO'], cond: 'emergency_lock_only' },
  'access.review|admin': { s: ['TD'], mode: 'propose' },
  'access.review|giam_doc_bh': { s: ['DV'] },
  'access.review|quan_sat': { s: ['TD'], mode: 'view' },
  'grant.revoke|giam_sat_bh': { s: ['TO'], cond: 'own_approved' },
  'token.manage|admin': { s: ['ALL'] },
  'audit.view|nvkd': { s: ['SELF'] },
  'audit.view|cskh': { s: ['SELF'] },
  'audit.view|marketing': { s: ['SELF'] },
  'audit.view|sale_admin': { s: ['SELF'] },
  'audit.view|ke_toan': { s: ['SELF'] },
  'audit.view|nv_thi_truong': { s: ['SELF'] },
  'alert.handle|admin': { s: ['TD'], cond: 'technical_alerts' },
  'alert.handle|giam_sat_bh': { s: ['TO'] },
  'alert.config|giam_doc_bh': { s: ['ALL'], mode: 'view' },
  'alert.config|quan_sat': { s: ['ALL'], mode: 'propose' },
  'config.sla|admin': { s: ['ALL'], mode: 'view' },
  'config.sla|giam_sat_bh': { s: ['TO'], mode: 'view' },
  'config.sla|quan_sat': { s: ['ALL'], mode: 'view' },
  'config.report_target|quan_sat': { s: ['TD'], mode: 'propose' },
  'config.retention|admin': { s: ['ALL'], mode: 'propose' },
  'config.retention|quan_sat': { s: ['ALL'] },
  'config.security|quan_sat': { s: ['ALL'], mode: 'view' },
};

/** Rows whose cells say "follow another key" for every role ("theo `conv.view`"). */
const FOLLOWS = {
  'msg.attachment': 'conv.view',
  'msg.react': 'conv.reply',
  'search.global': 'conv.view',
};

const SCOPE_LIST = /^(?:(?:TĐ|DV|TỔ|NH|CT|NICK|KÊNH|TK|LEAD|TUYẾN|YC)(?:, ?(?:TĐ|DV|TỔ|NH|CT|NICK|KÊNH|TK|LEAD|TUYẾN|YC))*)$/;

/** Removes markup and footnote / version markers: "✅ (29)" → "✅", "TỔ +NK (v1.3)" → "TỔ +NK". */
function clean(raw) {
  return raw
    .replace(/~~[^~]*~~/g, '')
    .replace(/\*\*\([^)]*\)\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s*\((?:\d+[a-z]?|v[0-9.][^)]*|Q-PQ-\d+[^)]*|PQ-\d+[^)]*|\d+, ?\d+)\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Regular cell → PermCell, or null when it is free text. */
function parseRegular(text) {
  if (text === '✖' || text === '') return {};
  let t = text;
  let log = false;
  if (t.endsWith(' +NK')) {
    log = true;
    t = t.slice(0, -4).trim();
  }
  let s;
  if (t === '✅') s = ['ALL'];
  else if (SCOPE_LIST.test(t)) s = t.split(',').map((x) => SYMBOLS[x.trim()]);
  else return null;
  return log ? { s, log: true } : { s };
}

/** Function label: first column without markers and trailing notes. */
function cleanLabel(raw) {
  return clean(raw).replace(/`/g, '').replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
}

/**
 * Parses §3.1–3.7. Returns { keys: [{ key, label, section }], cells: { [key]: { [role]: { raw, cell } } } }.
 * Throws on an unknown free-text cell or a malformed row.
 */
function parseMatrix(text = fs.readFileSync(SPEC_PATH, 'utf8')) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## 3. Ma trận quyền'));
  const end = lines.findIndex((l) => l.startsWith('### 3.8'));
  if (start < 0 || end < 0) throw new Error('Không tìm thấy §3 trong đặc tả phân quyền');
  const keys = [];
  const cells = {};
  let section = '';
  for (let i = start; i < end; i++) {
    const line = lines[i];
    if (line.startsWith('### ')) section = line.slice(4).trim();
    const m = line.match(/^\| (.+?) \| `([a-z_.]+)` \|(.*)\|\s*$/);
    if (!m) continue;
    const [, label, key, rest] = m;
    const raws = rest.split('|').map((c) => c.trim());
    if (raws.length !== COLUMNS.length) throw new Error(`Dòng ${i + 1} (${key}): cần ${COLUMNS.length} cột vai trò, có ${raws.length}`);
    if (cells[key]) throw new Error(`Khóa ${key} xuất hiện hai lần (dòng ${i + 1})`);
    keys.push({ key, label: cleanLabel(label), section });
    cells[key] = {};
    COLUMNS.forEach((role, j) => {
      const raw = raws[j];
      if (FOLLOWS[key]) return; // filled below
      const narrow = NARROW_CELLS[`${key}|${role}`];
      const regular = parseRegular(clean(raw));
      if (narrow && regular) throw new Error(`${key}|${role}: ô đã theo mẫu chuẩn, bỏ khỏi NARROW_CELLS`);
      const cell = narrow ?? regular;
      if (!cell) throw new Error(`Ô chưa dịch: ${key} / ${role} = "${raw}" (dòng ${i + 1}). Thêm vào NARROW_CELLS (cách hiểu hẹp).`);
      cells[key][role] = { raw, cell: { ...cell } };
    });
  }
  for (const [key, from] of Object.entries(FOLLOWS)) {
    if (!cells[key] || !cells[from]) throw new Error(`FOLLOWS ${key} → ${from}: thiếu dòng`);
    for (const role of COLUMNS) cells[key][role] = { raw: `theo ${from}`, cell: { ...cells[from][role].cell } };
  }
  for (const k of Object.keys(NARROW_CELLS)) {
    const [key, role] = k.split('|');
    if (!cells[key] || !cells[key][role]) throw new Error(`NARROW_CELLS ${k}: không còn trong đặc tả`);
  }
  return { keys, cells };
}

module.exports = { SPEC_PATH, COLUMNS, NARROW_CELLS, FOLLOWS, parseMatrix, clean };
