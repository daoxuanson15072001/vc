import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Put, Query, Res } from '@nestjs/common';
import { NO_ACCESS_TEXT, alertHandleSchema, alertRulePatchSchema, alertRuleProposalSchema, auditQuerySchema } from '@vclinks/shared';
import type { Response } from 'express';
import { parseOr400 } from '../common/zod';
import { CurrentSubject } from '../authz/authz.guard';
import { hasKey, type Subject } from '../authz/engine';
import { toXlsx } from '../org/tabular';
import { vnDate } from './vn-time';
import { AlertsService } from './alerts.service';
import { AuditService } from './audit.service';

/*
 * Access log and alerts (M1b-07). Who may call what: authz/route-permissions.ts. A signed-in user is required:
 * a token without a user has no scope to read the log (the guard lets only `audit.view` holders through).
 */
const need = (u: Subject | undefined): Subject => {
  if (!u) throw new ForbiddenException(NO_ACCESS_TEXT.api);
  return u;
};

@Controller()
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
  ) {}

  @Get('admin/audit')
  list(@Query() q: unknown, @CurrentSubject() u: Subject | undefined) {
    return this.audit.list(need(u), parseOr400(auditQuerySchema, q));
  }

  @Get('admin/audit/export')
  async export(@Query() q: unknown, @CurrentSubject() u: Subject | undefined, @Res() res: Response) {
    const s = need(u);
    // MH-PQ-10: "Xuất" needs report.export and audit.view.
    if (!hasKey(s, 'report.export')) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('report.export'));
    const out = await this.audit.exportRows(s, parseOr400(auditQuerySchema, q));
    const name = `nhat-ky-${vnDate(new Date()).replace(/\//g, '')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('X-Exported-Rows', String(out.count));
    res.send(await toXlsx(out.header, out.rows));
  }

  @Get('admin/audit/overview')
  overview(@Query('period') period: string | undefined, @CurrentSubject() u: Subject | undefined) {
    return this.audit.overview(need(u), period === 'week' || period === 'month' ? period : 'quarter');
  }

  /** "Hoạt động của tôi" (MH-PQ-10, locked to the caller). */
  @Get('me/activity')
  activity(@Query('days') days: string | undefined, @CurrentSubject() u: Subject | undefined) {
    return this.audit.activity(need(u).userId, Number(days) || 30);
  }

  @Get('admin/alerts')
  alertList(@Query() q: Record<string, string>, @CurrentSubject() u: Subject | undefined) {
    return this.alerts.list(need(u), { status: q.status, rule: q.rule, page: Number(q.page) || 1, pageSize: Number(q.pageSize) || 50 });
  }

  @Post('admin/alerts/:id/seen')
  @HttpCode(200)
  seen(@Param('id') id: string, @CurrentSubject() u: Subject | undefined) {
    return this.alerts.markSeen(need(u), id);
  }

  @Post('admin/alerts/:id/handle')
  @HttpCode(200)
  handle(@Param('id') id: string, @Body() body: unknown, @CurrentSubject() u: Subject | undefined) {
    return this.alerts.handle(need(u), id, parseOr400(alertHandleSchema, body).note);
  }

  @Get('admin/alert-rules')
  rules() {
    return this.alerts.rules();
  }

  @Put('admin/alert-rules/:code')
  saveRule(@Param('code') code: string, @Body() body: unknown, @CurrentSubject() u: Subject | undefined) {
    return this.alerts.saveRule(code, parseOr400(alertRulePatchSchema, body), need(u).userId);
  }

  @Post('admin/alert-rules/:code/propose')
  @HttpCode(200)
  async propose(@Param('code') code: string, @Body() body: unknown, @CurrentSubject() u: Subject | undefined) {
    const b = parseOr400(alertRuleProposalSchema, body);
    await this.alerts.proposeRule(code, need(u).userId, b.proposal);
    return { ok: true, message: 'Đã gửi đề xuất tới quản trị viên.' };
  }
}
