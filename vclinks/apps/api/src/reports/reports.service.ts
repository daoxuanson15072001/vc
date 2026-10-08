import { BadRequestException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  NO_ACCESS_TEXT,
  REPORT_DEFINITIONS,
  REPORT_MAX_DAYS,
  REPORT_TURN_LIMIT,
  maskDigits,
  summarize,
  type KpiDay,
  type ReportExportQuery,
  type ReportMode,
  type ReportOverview,
  type ReportQuery,
  type ReportRow,
  type ReportTeamAverage,
  type ReportTurn,
  type ReportTurnList,
  type ReportTurnsQuery,
} from '@vclinks/shared';
import { AuthzService } from '../authz/authz.service';
import { decide, hasKey, type Subject } from '../authz/engine';
import { C, DbService } from '../db/db.service';
import { runUnscoped } from '../db/tenant-context';
import { KPI_DAILY, MetricsService, dayStartMs, vnDay } from '../metrics/metrics.service';

/*
 * Basic reports (M1c-09, docs 07 MH-BC-02, 03, 06). Numbers are read from `kpi_daily` (job of M1b-15).
 *
 * Who sees what is decided HERE, once, from the permission engine, and the query then names the nicks explicitly:
 *  - nicks of the data scope of `report.performance` (TO / DV / TD / ALL), exactly as the rest of the API;
 *  - plus the nicks the caller himself holds ("Của tôi", scope CT of the salesperson);
 *  - a person gets a named row only through scope TO or DV, or for himself (BC-12). Management (TD) sees teams.
 * The only figure that reaches beyond the caller's nicks is the team average of a salesperson, without names (UAT-BC-07).
 * Nothing here reads message text; customer names in the turn list are display names with phone-like digits masked (BC-18).
 */

const DAY_MS = 86_400_000;
const NAMED_VIA = new Set(['TO', 'DV']);
const TURN_LIST_MAX_DAYS = 31;
const NONE_TEAM = 'none';

interface NickInfo {
  uid: string;
  label: string;
  channel: string;
  official: boolean;
  holderId: string | null;
  teamId: string | null;
  named: boolean;
}

interface Ctx {
  from: string;
  to: string;
  prevFrom: string | null;
  prevTo: string | null;
  mode: ReportMode;
  nicks: NickInfo[];
  teams: { id: string; name: string }[];
  appliedTeam: string | null;
  teamNames: Map<string, string>;
  names: Map<string, string>;
  self: string;
}

const addDays = (day: string, n: number) => vnDay(dayStartMs(day) + n * DAY_MS + 12 * 3600_000);
const daysBetween = (from: string, to: string) => Math.round((dayStartMs(to) - dayStartMs(from)) / DAY_MS) + 1;

/** A spreadsheet cell: a text starting with = + - @ is neutralised so it never runs as a formula. */
const safe = (v: string | number | null | undefined): string | number => {
  if (v === null || v === undefined) return '';
  return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    private readonly metrics: MetricsService,
  ) {}

  private period(q: ReportQuery, compare: boolean) {
    const to = q.to ?? addDays(vnDay(Date.now()), -1);
    const from = q.from ?? addDays(to, -6);
    const n = daysBetween(from, to);
    if (n < 1 || n > REPORT_MAX_DAYS) throw new BadRequestException(`Khoảng ngày không hợp lệ (1 đến ${REPORT_MAX_DAYS} ngày)`);
    const prevTo = addDays(from, -1);
    return { from, to, prevFrom: compare ? addDays(prevTo, -(n - 1)) : null, prevTo: compare ? prevTo : null };
  }

  private async context(u: Subject, q: ReportQuery): Promise<Ctx> {
    if (!hasKey(u, 'report.performance')) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('report.performance'));
    const p = this.period(q, q.compare !== '0');
    const facts = await this.authz.reportFacts();
    const scope = await this.authz.dataScope(u, 'report.performance');
    const inScope = new Set(scope ? scope.channels : facts.channels.map((c) => c.uid));
    const teamOf = (units: string[]): string | null => {
      const t = units.find((x) => facts.units.get(x)?.type === 'to_ban_hang') ?? units[0];
      return t ?? null;
    };
    const nicks: NickInfo[] = [];
    for (const c of facts.channels) {
      const mine = c.kind === 'personal' && c.holderId === u.userId;
      if (!inScope.has(c.uid) && !mine) continue;
      let named = mine;
      if (!named && inScope.has(c.uid)) {
        const d = decide(u, 'report.performance', await this.authz.channelTarget(c.uid));
        named = d.allowed && NAMED_VIA.has(d.via);
      }
      nicks.push({ uid: c.uid, label: '', channel: '', official: c.kind === 'official', holderId: c.holderId, teamId: teamOf(c.holderUnits), named });
    }
    const accounts = await runUnscoped(() =>
      this.db.col<{ _id: string; label?: string; channel?: string }>(C.accounts).find({ _id: { $in: nicks.map((n) => n.uid) } }, { projection: { label: 1, channel: 1 } }).toArray(),
    );
    const acc = new Map(accounts.map((a) => [a._id, a]));
    for (const n of nicks) {
      n.label = acc.get(n.uid)?.label ?? n.uid;
      n.channel = acc.get(n.uid)?.channel ?? '';
    }
    const others = nicks.some((n) => !(n.holderId === u.userId && !n.official));
    const mode: ReportMode = nicks.some((n) => n.named && n.holderId !== u.userId) || (others && nicks.some((n) => n.named)) ? 'nvkd' : others ? 'team' : 'self';
    const teamNames = new Map<string, string>([[NONE_TEAM, 'Kênh chính thức / chưa xếp tổ']]);
    for (const [id, x] of facts.units) teamNames.set(id, x.name);
    const teamIds = [...new Set(nicks.map((n) => n.teamId).filter((x): x is string => !!x))];
    const teams = mode === 'self' ? [] : teamIds.map((id) => ({ id, name: teamNames.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const appliedTeam = q.team && teams.some((t) => t.id === q.team) ? q.team : null;
    const kept = appliedTeam ? nicks.filter((n) => n.teamId === appliedTeam) : nicks;
    const holderIds = kept.map((n) => n.holderId);
    const names = await this.authz.userNames(holderIds);
    return { ...p, mode, nicks: kept, teams, appliedTeam, teamNames, names, self: u.userId };
  }

  /** Row identity of a nick: a named salesperson, a named official channel, or its team (no person shown). */
  private rowOf(c: Ctx, n: NickInfo): Pick<ReportRow, 'key' | 'kind' | 'label' | 'teamName' | 'self'> {
    const teamName = n.teamId ? c.teamNames.get(n.teamId) ?? null : null;
    if (n.named && n.holderId && !n.official) {
      return { key: `user:${n.holderId}`, kind: 'nvkd', label: c.mode === 'self' ? 'Của tôi' : c.names.get(n.holderId) ?? n.holderId, teamName, self: n.holderId === c.self };
    }
    if (n.named) return { key: `channel:${n.uid}`, kind: 'channel', label: n.label, teamName };
    const id = n.teamId ?? NONE_TEAM;
    return { key: `team:${id}`, kind: 'team', label: c.teamNames.get(id) ?? id };
  }

  private async docs(uids: string[], from: string, to: string): Promise<KpiDay[]> {
    if (!uids.length) return [];
    return runUnscoped(() => this.db.col<KpiDay>(KPI_DAILY).find({ uid: { $in: uids }, day: { $gte: from, $lte: to } }).toArray());
  }

  private group(docs: KpiDay[], keyOf: (uid: string) => string | undefined): Map<string, KpiDay[]> {
    const m = new Map<string, KpiDay[]>();
    for (const d of docs) {
      const k = keyOf(d.uid);
      if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(d);
    }
    return m;
  }

  async overview(u: Subject, q: ReportQuery): Promise<ReportOverview> {
    const c = await this.context(u, q);
    const uids = c.nicks.map((n) => n.uid);
    const [cur, prev] = await Promise.all([this.docs(uids, c.from, c.to), c.prevFrom && c.prevTo ? this.docs(uids, c.prevFrom, c.prevTo) : Promise.resolve([] as KpiDay[])]);
    const info = new Map(c.nicks.map((n) => [n.uid, { n, row: this.rowOf(c, n) }]));
    const curBy = this.group(cur, (uid) => info.get(uid)?.row.key);
    const prevBy = this.group(prev, (uid) => info.get(uid)?.row.key);
    const rows = new Map<string, ReportRow>();
    for (const { n, row } of info.values()) {
      const r = rows.get(row.key);
      if (r) r.accounts++;
      else {
        const docsOf = curBy.get(row.key) ?? [];
        rows.set(row.key, { ...row, ...summarize(docsOf), accounts: 1, ...(c.prevFrom ? { prev: prevBy.has(row.key) && summarize(prevBy.get(row.key)!).turns > 0 ? summarize(prevBy.get(row.key)!) : null } : {}) });
      }
      void n;
    }
    let list = [...rows.values()];
    // Self mode shows only "Của tôi": one row over every nick he holds (UAT-BC-07).
    if (c.mode === 'self') list = list.filter((r) => r.kind === 'nvkd');
    list.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    const shown = new Set(list.map((r) => r.key));
    const shownDocs = cur.filter((d) => shown.has(info.get(d.uid)?.row.key ?? ''));
    const shownPrev = prev.filter((d) => shown.has(info.get(d.uid)?.row.key ?? ''));
    return {
      from: c.from,
      to: c.to,
      prevFrom: c.prevFrom,
      prevTo: c.prevTo,
      mode: c.mode,
      totals: summarize(shownDocs),
      prevTotals: c.prevFrom ? (shownPrev.length ? summarize(shownPrev) : null) : null,
      rows: list,
      team: c.mode === 'self' ? await this.teamAverage(c) : null,
      teams: c.teams,
      appliedTeam: c.appliedTeam,
      canExport: hasKey(u, 'report.export'),
      accountsCounted: c.nicks.length,
      computedAt: cur.length ? new Date(Math.max(...cur.map((d) => new Date(d.computedAt).getTime()))).toISOString() : null,
    };
  }

  /**
   * Team figures for a salesperson, without names and without rank (BC-12): every personal nick whose holder shares
   * the team of one of his own nicks. This is the one read that goes beyond the caller's nicks.
   */
  private async teamAverage(c: Ctx): Promise<ReportTeamAverage | null> {
    const facts = await this.authz.reportFacts();
    const myTeam = c.nicks.find((n) => n.holderId === c.self && n.teamId)?.teamId;
    if (!myTeam) return null;
    const mates = facts.channels.filter((x) => x.kind === 'personal' && x.holderId && x.holderUnits.includes(myTeam));
    const members = new Set(mates.map((x) => x.holderId));
    const docs = await this.docs(mates.map((x) => x.uid), c.from, c.to);
    const summary = summarize(docs);
    return {
      teamName: facts.units.get(myTeam)?.name ?? null,
      members: members.size,
      turnsPerMember: members.size ? Math.round((summary.turns / members.size) * 10) / 10 : null,
      summary,
    };
  }

  /** Reply turns of the caller's reachable nicks (Drawer "Lượt chờ" / "Lượt quá SLA"). */
  async turns(u: Subject, q: ReportTurnsQuery): Promise<ReportTurnList> {
    const c = await this.context(u, { ...q, compare: '0' });
    // Management sees teams, never a person or a customer line (BC-12, BC-17).
    if (c.mode === 'team') throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('report.performance'));
    if (daysBetween(c.from, c.to) > TURN_LIST_MAX_DAYS) throw new BadRequestException(`Danh sách lượt chờ chỉ xem tối đa ${TURN_LIST_MAX_DAYS} ngày một lần`);
    // Turn lines only for nicks the caller may see by name (his own, TO / DV): a TD viewer holding a nick of his own
    // must not reach the customer lines of the teams he only sees as totals (BC-12, BC-17).
    let nicks = c.nicks.filter((n) => n.named);
    if (q.row) {
      const want = q.row;
      nicks = nicks.filter((n) => this.rowOf(c, n).key === want);
      if (!nicks.length) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    }
    return this.collectTurns(c, nicks, q.breachedOnly === '1');
  }

  private async collectTurns(c: Ctx, nicks: NickInfo[], breachedOnly: boolean): Promise<ReportTurnList> {
    const out: ReportTurn[] = [];
    const nowMs = Date.now();
    await runUnscoped(async () => {
      for (const n of nicks) {
        const found: Awaited<ReturnType<MetricsService['turnDetails']>> = [];
        for (let d = c.from; d <= c.to; d = addDays(d, 1)) found.push(...(await this.metrics.turnDetails(n.uid, d, nowMs)));
        const keep = found.filter((t) => !breachedOnly || t.breached);
        const ids = [...new Set(keep.map((t) => `${n.uid}:${t.threadId}`))];
        const contacts = ids.length
          ? await this.db.col<{ _id: string; displayName?: string; zaloName?: string }>(C.contacts).find({ _id: { $in: ids } }, { projection: { displayName: 1, zaloName: 1 } }).toArray()
          : [];
        const nameOf = new Map(contacts.map((x) => [x._id, x.displayName || x.zaloName || '']));
        const holderName = n.holderId ? c.names.get(n.holderId) ?? null : null;
        for (const t of keep) {
          out.push({
            uid: n.uid,
            accountLabel: n.label,
            channel: n.channel,
            threadId: t.threadId,
            customerName: maskDigits(nameOf.get(`${n.uid}:${t.threadId}`) || 'Khách chưa có tên'),
            holderName: c.mode === 'self' ? null : holderName,
            startAt: new Date(t.startAt).toISOString(),
            endAt: t.endAt === null ? null : new Date(t.endAt).toISOString(),
            waitMin: t.waitMin,
            slaMin: t.slaMin,
            breached: t.breached,
            result: t.endAt === null ? 'open' : 'answered',
            source: t.source,
          });
        }
      }
    });
    out.sort((a, b) => b.startAt.localeCompare(a.startAt));
    return { rows: out.slice(0, REPORT_TURN_LIMIT), truncated: out.length > REPORT_TURN_LIMIT };
  }

  /**
   * Excel (BC-19). Aggregate sheets only by default; `detail` adds the turn sheet (customer display name, no text, no
   * phone) up to REPORT_TURN_LIMIT rows. More rows need the approval flow of PQ-48, which is not built: refuse.
   */
  async exportXlsx(u: Subject, q: ReportExportQuery) {
    if (!hasKey(u, 'report.export')) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('report.export'));
    const email = (await runUnscoped(() => this.db.col<{ _id: string; email?: string }>(C.users).findOne({ _id: u.userId }, { projection: { email: 1 } })))?.email ?? u.userId;
    const o = await this.overview(u, q);
    if (o.mode === 'self') throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('report.export'));
    let turns: ReportTurnList | null = null;
    if (q.detail === '1') {
      const c = await this.context(u, { ...q, compare: '0' });
      if (c.mode === 'team') throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('report.performance'));
      if (daysBetween(c.from, c.to) > TURN_LIST_MAX_DAYS) throw new BadRequestException(`File kèm danh sách chi tiết chỉ xuất tối đa ${TURN_LIST_MAX_DAYS} ngày một lần`);
      turns = await this.collectTurns(c, c.nicks.filter((n) => n.named), false);
      if (turns.truncated) throw new UnprocessableEntityException(`File có hơn ${REPORT_TURN_LIMIT} dòng theo khách, vượt ${REPORT_TURN_LIMIT} dòng. Cần người duyệt (chức năng yêu cầu xuất chưa có).`);
    }
    const at = new Date();
    const stamp = new Date(at.getTime() + 7 * 3600_000);
    const hhmm = stamp.toISOString().slice(11, 16);
    const pad = (x: string) => x.slice(8, 10) + '/' + x.slice(5, 7) + '/' + x.slice(0, 4);
    const foot = `Xuất bởi ${email} lúc ${hhmm} ${pad(stamp.toISOString().slice(0, 10))}`;
    const scopeText = o.appliedTeam ? o.teams.find((t) => t.id === o.appliedTeam)?.name ?? '' : o.mode === 'team' ? 'Các tổ trong phạm vi' : 'Tất cả trong phạm vi';
    const wb = new ExcelJS.Workbook();
    const sum = wb.addWorksheet('Tóm tắt');
    sum.addRow([`Kỳ ${pad(o.from)}–${pad(o.to)} · Phạm vi ${scopeText} · Số hiện tại lúc ${o.computedAt ? new Date(new Date(o.computedAt).getTime() + 7 * 3600_000).toISOString().slice(11, 16) : '-'}`]).font = { bold: true };
    sum.addRow([]);
    sum.addRow(['Chỉ số', 'Giá trị']).font = { bold: true };
    const t = o.totals;
    for (const [k, v] of [
      ['Lượt chờ', t.turns], ['Đã trả lời', t.answered], ['Đang chờ', t.open], ['FRT trung vị (phút làm việc)', t.frtMedian], ['FRT P90 (phút làm việc)', t.frtP90],
      ['Quá SLA', t.breached], ['% quá SLA', t.pctBreached], ['% trả lời qua VClinks', t.pctViaVclinks],
    ] as [string, number | null][]) sum.addRow([k, v ?? '']);
    sum.addRow([]);
    sum.addRow([foot]);
    sum.getColumn(1).width = 44;
    sum.getColumn(2).width = 18;

    const head = ['Dòng', 'Loại', 'Tổ', 'Số nick', 'Lượt chờ', 'Đã trả lời', 'Đang chờ', 'FRT trung vị (phút)', 'FRT P90 (phút)', 'Quá SLA', '% quá SLA', 'Qua VClinks', 'Từ điện thoại', '% qua VClinks'];
    const byRow = wb.addWorksheet(o.mode === 'nvkd' ? 'Theo NVKD' : 'Theo tổ');
    byRow.addRow(['Kỳ ' + pad(o.from) + '–' + pad(o.to)]);
    byRow.addRow(head).font = { bold: true };
    const kind = { nvkd: 'Nhân viên', team: 'Tổ', channel: 'Kênh' } as const;
    for (const r of o.rows) {
      byRow.addRow([safe(r.label), kind[r.kind], safe(r.teamName ?? ''), r.accounts, r.turns, r.answered, r.open, r.frtMedian ?? '', r.frtP90 ?? '', r.breached, r.pctBreached ?? '', r.viaVclinks, r.fromPhone, r.pctViaVclinks ?? '']);
    }
    byRow.addRow(['Tổng', '', '', o.accountsCounted, t.turns, t.answered, t.open, t.frtMedian ?? '', t.frtP90 ?? '', t.breached, t.pctBreached ?? '', t.viaVclinks, t.fromPhone, t.pctViaVclinks ?? '']).font = { bold: true };
    byRow.addRow([]);
    byRow.addRow([foot]);
    head.forEach((_, i) => (byRow.getColumn(i + 1).width = 18));
    byRow.getColumn(1).width = 30;

    if (turns) {
      const ws = wb.addWorksheet('Lượt chờ');
      const h = ['Bắt đầu', 'Kết thúc', 'Tài khoản kênh', 'Kênh', 'Người giữ nick', 'Khách (tên hiển thị)', 'Thời gian chờ (phút)', 'Hạn SLA (phút)', 'Kết quả', 'Nguồn trả lời'];
      ws.addRow(h).font = { bold: true };
      for (const x of turns.rows) {
        ws.addRow([
          pad(x.startAt.slice(0, 10)) + ' ' + new Date(new Date(x.startAt).getTime() + 7 * 3600_000).toISOString().slice(11, 16),
          x.endAt ? new Date(new Date(x.endAt).getTime() + 7 * 3600_000).toISOString().slice(11, 16) : '',
          safe(x.accountLabel), x.channel, safe(x.holderName ?? ''), safe(x.customerName), x.waitMin, x.slaMin,
          x.result === 'open' ? (x.breached ? 'Quá hạn, chưa trả lời' : 'Đang chờ') : x.breached ? 'Quá hạn' : 'Trong hạn',
          x.source === 'vclinks' ? 'Qua VClinks' : x.source === 'phone' ? 'Gửi từ điện thoại' : '',
        ]);
      }
      ws.addRow([]);
      ws.addRow([foot]);
      h.forEach((_, i) => (ws.getColumn(i + 1).width = 22));
    }

    const defs = wb.addWorksheet('Định nghĩa');
    defs.addRow(['Mã', 'Chỉ số', 'Cách tính']).font = { bold: true };
    for (const d of REPORT_DEFINITIONS) defs.addRow([d.code, d.label, d.text]);
    defs.getColumn(1).width = 10;
    defs.getColumn(2).width = 30;
    defs.getColumn(3).width = 110;

    // The log keeps who exported what kind of file and how many rows, never the figures or any name.
    await this.db.audit(`user:${u.userId}`, 'export.report', 'bao-cao-hieu-suat', { detail: q.detail === '1' ? 'chi_tiet' : 'tong_hop', from: o.from, to: o.to, rows: turns?.rows.length ?? o.rows.length });
    const compact = stamp.toISOString().slice(0, 10).replace(/-/g, '') + '_' + hhmm.replace(':', '');
    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), fileName: `vclinks_bao-cao-hieu-suat_${compact}.xlsx` };
  }
}
