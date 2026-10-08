import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import type { VcsalesHealthView, VcsalesStatusResponse } from '@vclinks/shared';
import { VcsalesStatusService } from './vcsales-status.service';

/** Quản trị → "Kết nối VCsales" (plan C5, C6). Read only: nothing here writes to VCsales or to VClinks data. */
@Controller('admin/vcsales')
export class VcsalesController {
  constructor(private readonly status: VcsalesStatusService) {}

  /** Connection state and salesperson matching; `refresh=1` checks VCsales and reads the staff list again. */
  @Get()
  get(@Query('refresh') refresh?: string): Promise<VcsalesStatusResponse> {
    return this.status.status(refresh === '1');
  }

  @Post('ping')
  @HttpCode(200)
  ping(): Promise<VcsalesHealthView> {
    return this.status.check();
  }
}
