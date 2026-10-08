/** Scheduled changes for admins (kế hoạch GĐ B mục 5.2): cancel a scheduled change, confirm or reject a bulk one. */
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Can } from '../../auth/decorators';
import { Req } from '../../common/request-context';
import { ZodPipe } from '../../common/zod.pipe';
import { ChangeService, type Requester } from './change.service';

const Reason = z.object({ reason: z.string().trim().max(300).default('') });

@Controller('v1/admin/scheduled-changes')
export class ChangesController {
  constructor(private readonly changes: ChangeService) {}

  /** Bulk changes waiting for a second admin (VH-BR-25). */
  @Get('waiting-confirmation')
  @Can('nhap.xac_nhan')
  waiting() {
    return this.changes.waitingConfirmation();
  }

  /** "Huỷ hẹn": the service checks nhan_su.sua or co_cau.sua by the kinds in the group. */
  @Post(':groupId/cancel')
  @HttpCode(200)
  cancel(@Param('groupId') id: string, @Body(new ZodPipe(Reason)) body: z.infer<typeof Reason>, @Req() req: Requester) {
    return this.changes.cancel(id, body.reason, req);
  }

  @Post(':groupId/confirm')
  @HttpCode(200)
  @Can('nhap.xac_nhan')
  confirm(@Param('groupId') id: string, @Req() req: Requester) {
    return this.changes.confirm(id, req);
  }

  @Post(':groupId/reject')
  @HttpCode(200)
  @Can('nhap.xac_nhan')
  reject(@Param('groupId') id: string, @Body(new ZodPipe(Reason)) body: z.infer<typeof Reason>, @Req() req: Requester) {
    return this.changes.reject(id, body.reason, req);
  }
}
