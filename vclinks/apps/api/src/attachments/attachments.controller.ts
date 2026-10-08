import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentPrincipal, Public, Scopes } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { AsrService } from './asr.service';
import { AttachmentsService } from './attachments.service';
import { contentDisposition } from './mime';

type Range = { start: number; end: number };

/** Parses a single `Range: bytes=a-b` header; null = whole file (multi-range is not supported). */
export function parseRange(h: string | undefined, length: number): Range | null | 'bad' {
  if (!h) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(h.trim());
  if (!m || (!m[1] && !m[2])) return 'bad';
  let start = m[1] ? Number(m[1]) : length - Number(m[2]);
  let end = m[1] && m[2] ? Number(m[2]) : length - 1;
  if (start < 0) start = 0;
  if (end >= length) end = length - 1;
  return start > end || start >= length ? 'bad' : { start, end };
}

interface OpenFile {
  stream: NodeJS.ReadableStream & { destroy(): unknown };
  mime: string;
  length: number;
  fileName?: string;
}

function send(res: Response, f: OpenFile, range: Range | null) {
  res.setHeader('Content-Type', f.mime);
  // Only types a browser can show safely render inline (PDF in its own viewer); anything else is a download.
  res.setHeader('Content-Disposition', contentDisposition(f.mime, f.fileName));
  res.setHeader('Accept-Ranges', 'bytes');
  // Personal data: never cached by shared caches, never sniffed.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${f.length}`);
    res.setHeader('Content-Length', String(range.end - range.start + 1));
  } else {
    res.setHeader('Content-Length', String(f.length));
  }
  f.stream.on('error', () => res.destroy());
  f.stream.pipe(res);
}

/** Company file store routes (M1c-04). Permission lines: route-permissions.ts. */
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /** Device / MCP token: asks for a 15-minute upload URL for a file of an existing message. */
  @Post('upload-url')
  @HttpCode(200)
  @Scopes('ingest', 'mcp')
  uploadUrl(@Body() body: unknown) {
    return this.attachments.createUploadUrl(body);
  }

  /** Raw bytes (not JSON) to the signed URL; the signature is the credential. */
  @Put('upload/:token')
  @Public()
  upload(@Param('token') token: string, @Req() req: Request) {
    return this.attachments.receiveUpload(token, req);
  }

  @Post('confirm')
  @HttpCode(200)
  @Scopes('ingest', 'mcp')
  confirm(@Body() body: unknown) {
    return this.attachments.confirmUpload(body);
  }

  /** Signed-in user: bytes of an attachment, only inside his data scope. */
  @Get(':id/file')
  @Scopes('dashboard')
  async file(@Param('id') id: string, @Headers('range') rangeHeader: string | undefined, @Res() res: Response) {
    await this.serve(res, rangeHeader, (r) => this.attachments.open(id, r));
  }

  /** Signed-in user: short-lived link for `<audio>` / `<video>`. */
  @Get(':id/link')
  @Scopes('dashboard')
  link(@Param('id') id: string) {
    return this.attachments.link(id);
  }

  @Post(':id/transcribe')
  @HttpCode(200)
  @Scopes('dashboard')
  retry(@Param('id') id: string) {
    return this.attachments.retryTranscript(id);
  }

  /** Download through a signed link (no token, expires in 10 minutes). */
  @Get('dl/:token')
  @Public()
  async download(@Param('token') token: string, @Headers('range') rangeHeader: string | undefined, @Res() res: Response) {
    await this.serve(res, rangeHeader, (r) => this.attachments.openByLink(token, r));
  }

  private async serve(res: Response, rangeHeader: string | undefined, open: (r?: Range) => Promise<OpenFile>) {
    // The length is needed to resolve the range; the stream is lazy, so open whole first, then the slice.
    const whole = await open();
    const range = parseRange(rangeHeader, whole.length);
    if (range === 'bad') {
      whole.stream.destroy();
      res.status(416).setHeader('Content-Range', `bytes */${whole.length}`).end();
      return;
    }
    if (range) {
      whole.stream.destroy();
      send(res, await open(range), range);
    } else send(res, whole, null);
  }
}

/** The ASR worker (token scope ingest) polls these. */
@Controller('asr/jobs')
export class AsrController {
  constructor(private readonly asr: AsrService) {}

  @Post('claim')
  @HttpCode(200)
  @Scopes('ingest')
  async claim(@CurrentPrincipal() p: Principal) {
    return (await this.asr.claim(p?.uids)) ?? { jobId: null };
  }

  @Get(':id/audio')
  @Scopes('ingest')
  async audio(@Param('id') id: string, @Res() res: Response) {
    const a = await this.asr.audio(id);
    res.setHeader('Content-Type', a.mime);
    res.setHeader('Content-Length', String(a.length));
    res.setHeader('Cache-Control', 'private, no-store');
    a.stream.on('error', () => res.destroy()).pipe(res);
  }

  @Post(':id/result')
  @HttpCode(200)
  @Scopes('ingest')
  result(@Param('id') id: string, @Body() body: unknown) {
    return this.asr.complete(id, body);
  }

  @Post(':id/fail')
  @HttpCode(200)
  @Scopes('ingest')
  fail(@Param('id') id: string, @Body() body: unknown) {
    return this.asr.fail(id, body);
  }
}
