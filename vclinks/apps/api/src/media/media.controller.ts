import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Scopes } from '../auth/auth.guard';
import { MediaService } from './media.service';

@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Extension: one photo of a message, as base64 (Zalo Web only has it as a blob: URL). */
  @Post('ingest/message-media')
  @HttpCode(200)
  @Scopes('ingest')
  upload(@Body() body: unknown) {
    return this.media.upload(body);
  }

  /** Dashboard: a file for an outbox command (photo or document), as base64. */
  @Post('outbox/attachments')
  @HttpCode(200)
  @Scopes('dashboard')
  attachment(@Body() body: unknown) {
    return this.media.uploadAttachment(body);
  }

  /**
   * Media bytes: the Dashboard shows photos from an object URL; the extension
   * downloads the files of outbox commands to hand them to Zalo Web.
   */
  @Get('media/:id')
  @Scopes('dashboard', 'ingest')
  async get(@Param('id') id: string, @Res() res: Response) {
    const { stream, mime, length, fileName } = await this.media.open(id);
    res.setHeader('Content-Type', mime);
    // Only raster images may render inline; anything else is a download.
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) {
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName ?? id)}`);
    }
    res.setHeader('Content-Length', String(length));
    // Content-addressed (sha256): the bytes behind an id never change.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    stream.on('error', () => res.destroy()).pipe(res);
  }
}
