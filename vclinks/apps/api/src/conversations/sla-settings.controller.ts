import { Body, Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import { slaSettingsInputSchema, type SlaSettingsList } from '@vclinks/shared';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { SlaSettingsService } from './sla-settings.service';

/** Quản trị → "SLA và giờ làm việc" (config.sla; edits need it in full on the division, see route-permissions). */
@Controller('admin/sla-settings')
export class SlaSettingsController {
  constructor(private readonly sla: SlaSettingsService) {}

  @Get()
  list(@CurrentSubject() u: Subject | undefined): Promise<SlaSettingsList> {
    return this.sla.list(u);
  }

  @Put(':divisionId')
  @HttpCode(200)
  async save(@Param('divisionId') divisionId: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u: Subject | undefined): Promise<SlaSettingsList> {
    await this.sla.save(divisionId, parseOr400(slaSettingsInputSchema, body), p.userId ?? p.name);
    return this.sla.list(u);
  }

  @Delete(':divisionId')
  @HttpCode(200)
  async reset(@Param('divisionId') divisionId: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u: Subject | undefined): Promise<SlaSettingsList> {
    await this.sla.reset(divisionId, p.userId ?? p.name);
    return this.sla.list(u);
  }
}
