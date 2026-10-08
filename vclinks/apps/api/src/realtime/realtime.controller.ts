import { Controller, ForbiddenException, Get, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentPrincipal, type AuthedRequest } from '../auth/auth.guard';
import { TokenService, type Principal } from '../auth/token.service';
import { AuthzService } from '../authz/authz.service';
import { RealtimeService } from './realtime.service';

const HEARTBEAT_MS = 25_000;
/** An open stream re-checks its token this often; a revoked session / token (lock, offboarding) ends it. */
const RECHECK_MS = () => Number(process.env.REALTIME_RECHECK_MS ?? 15_000);

/**
 * Server-sent events for the Dashboard (M1c-07). The browser reads it with fetch + the Bearer header
 * (EventSource cannot send headers and a token in the URL would end up in logs, CLAUDE.md §12.2), so the
 * normal AuthGuard / AuthzGuard run before the stream opens. Events are filtered per user by RealtimeService.
 */
@Controller('realtime')
export class RealtimeController {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly authz: AuthzService,
    private readonly tokens: TokenService,
  ) {}

  @Get('stream')
  stream(@Req() req: AuthedRequest, @Res() res: Response, @CurrentPrincipal() p: Principal): void {
    const legacy = this.authz.legacyAllowed(p);
    if (!p.userId && !legacy) throw new ForbiddenException('Token này không gắn với người dùng nào.');
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 3000\n: ready\n\n');
    const unsubscribe = this.realtime.subscribe({
      tenantId: p.tenantId,
      ...(p.userId ? { userId: p.userId } : {}),
      legacy,
      send: (ev) => res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`),
    });
    const beat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const recheck = setInterval(() => {
      void this.tokens
        .verify(token)
        .then((still) => {
          if (!still) {
            close();
            res.end();
          }
        })
        .catch(() => undefined);
    }, RECHECK_MS());
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(beat);
      clearInterval(recheck);
      unsubscribe();
    };
    req.on('close', close);
    res.on('error', close);
  }
}
