/** Quản trị nhân sự VH-MH-11 (kế hoạch GĐ B mục 5.2): list, detail, add, edit, photo, "Không nhận việc". */
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Can } from '../auth/decorators';
import { Req } from '../common/request-context';
import type { Requester } from './changes/change.service';
import { PeopleService, type PeopleListQuery } from './people.service';

@Controller('v1/admin')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  /** `?q=&legal_entity=&unit=&include_sub_units=&status=&employee_type=&warning=&limit=&after=` */
  @Get('people')
  @Can('nhan_su.xem')
  list(@Query() q: PeopleListQuery, @Req() req: Requester) {
    return this.people.list(q, req);
  }

  @Get('people.xlsx')
  @Can('nhan_su.xem')
  async export(@Query() q: PeopleListQuery, @Req() req: Requester, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="nhan-su.xlsx"');
    return new StreamableFile(await this.people.exportXlsx(q, req));
  }

  @Post('people')
  @Can('nhan_su.sua')
  create(@Body() body: unknown, @Req() req: Requester) {
    return this.people.create(body, req);
  }

  @Get('people/:code')
  @Can('nhan_su.xem')
  get(@Param('code') code: string, @Req() req: Requester) {
    return this.people.get(code, req);
  }

  @Patch('people/:code')
  @Can('nhan_su.sua')
  update(@Param('code') code: string, @Body() body: unknown, @Req() req: Requester) {
    return this.people.update(code, body, req);
  }

  /** multipart field `file`; the 2 MB limit is checked by the service so the message is the 04 sentence. */
  @Put('people/:code/photo')
  @Can('nhan_su.sua')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  photo(@Param('code') code: string, @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined, @Req() req: Requester) {
    return this.people.setPhoto(code, file, req);
  }

  @Post('people/:code/status/no-show')
  @HttpCode(200)
  @Can('nhan_su.sua')
  noShow(@Param('code') code: string, @Body() body: unknown, @Req() req: Requester) {
    return this.people.noShow(code, body, req);
  }
}
