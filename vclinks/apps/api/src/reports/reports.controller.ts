import { Controller, ForbiddenException, Get, Query, Res } from '@nestjs/common';
import { NO_ACCESS_TEXT, reportExportQuerySchema, reportQuerySchema, reportTurnsQuerySchema } from '@vclinks/shared';
import type { Response } from 'express';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { ReportsService } from './reports.service';

const need = (u: Subject | undefined): Subject => {
  if (!u) throw new ForbiddenException(NO_ACCESS_TEXT.api);
  return u;
};

/** Basic reports (M1c-09). Who may call what: authz/route-permissions.ts; what each caller sees: ReportsService. */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('performance')
  overview(@Query() q: unknown, @CurrentSubject() u: Subject | undefined) {
    return this.reports.overview(need(u), parseOr400(reportQuerySchema, q));
  }

  @Get('performance/turns')
  turns(@Query() q: unknown, @CurrentSubject() u: Subject | undefined) {
    return this.reports.turns(need(u), parseOr400(reportTurnsQuerySchema, q));
  }

  @Get('performance/export')
  async export(@Query() q: unknown, @CurrentSubject() u: Subject | undefined, @Res() res: Response) {
    const s = need(u);
    const out = await this.reports.exportXlsx(s, parseOr400(reportExportQuerySchema, q));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.send(out.buffer);
  }
}
