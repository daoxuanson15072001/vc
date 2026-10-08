import { Controller, Get, Query, Res } from '@nestjs/common';
import { NO_ACCESS_TEXT, kpiQuerySchema, type KpiReport } from '@vclinks/shared';
import type { Response } from 'express';
import { ForbiddenException } from '@nestjs/common';
import { CurrentSubject } from '../authz/authz.guard';
import { hasKey, type Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { MetricsService } from './metrics.service';

/*
 * Baseline KPI (M1b-15). Who may call what: authz/route-permissions.ts. The numbers are limited in the query to
 * the caller's channels (data scope of report.performance); login share is shown to the whole-company scope only.
 */
const need = (u: Subject | undefined): Subject => {
  if (!u) throw new ForbiddenException(NO_ACCESS_TEXT.api);
  return u;
};

/** A CSV cell: quotes doubled, and a leading = + - @ neutralised so a spreadsheet never runs it as a formula. */
const cell = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_HEADER = [
  'Ngày', 'Tài khoản kênh', 'Kênh', 'Lượt chờ', 'Đã trả lời', 'Đang chờ', 'FRT trung vị (phút làm việc)', 'FRT P90 (phút làm việc)',
  'Quá SLA', '% quá SLA', 'Quá 15 phút', '% quá 15 phút', 'Quá 2 giờ', '% quá 2 giờ', 'Trả lời qua VClinks', 'Trả lời từ điện thoại', '% qua VClinks',
  'Người đăng nhập', 'Người hoạt động', '% đăng nhập',
];

export function toCsv(r: KpiReport): string {
  const login = new Map((r.login?.days ?? []).map((d) => [d.day, d]));
  const line = (x: KpiReport['rows'][number], l?: { loggedIn: number; active: number }) =>
    [
      x.day ?? `${r.from}..${r.to}`, x.label ?? (x.uid ? '' : 'Tất cả'), x.channel, x.turns, x.answered, x.open, x.frtMedian, x.frtP90,
      x.breached, x.pctBreached, x.over15, x.pctOver15, x.over120, x.pctOver120, x.viaVclinks, x.fromPhone, x.pctViaVclinks,
      l?.loggedIn, l?.active, l && l.active ? Math.round((l.loggedIn / l.active) * 1000) / 10 : '',
    ].map(cell).join(',');
  const rows = r.rows.map((x) => line(x, x.day && !x.uid ? login.get(x.day) : undefined));
  rows.push(line({ ...r.totals }, r.login ? { loggedIn: r.login.days.reduce((n, d) => n + d.loggedIn, 0), active: r.login.days.reduce((n, d) => n + d.active, 0) } : undefined));
  return `﻿${CSV_HEADER.map(cell).join(',')}\r\n${rows.join('\r\n')}\r\n`;
}

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('kpi')
  kpi(@Query() q: unknown, @CurrentSubject() u: Subject | undefined) {
    return this.metrics.report(parseOr400(kpiQuerySchema, q), { includeLogin: hasKey(need(u), 'report.performance', { scopes: ['TD', 'ALL'] }) });
  }

  @Get('kpi/export')
  async export(@Query() q: unknown, @CurrentSubject() u: Subject | undefined, @Res() res: Response) {
    const s = need(u);
    const query = parseOr400(kpiQuerySchema, { by: 'day_account', ...(q as object) });
    const r = await this.metrics.report(query, { includeLogin: hasKey(s, 'report.performance', { scopes: ['TD', 'ALL'] }) });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kpi-baseline-${r.from}_${r.to}.csv"`);
    res.send(toCsv(r));
  }
}
