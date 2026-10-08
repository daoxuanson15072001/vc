import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { actorOf, ipPrefix } from '../audit/audit.service';
import type { Requester } from '../people/changes/change.service';

/** Who and where for services that write the audit log (actor, request id, IP prefix, source "màn hình"). */
export function requesterOf(req: Request): Requester {
  if (!req.viewer) throw new Error('requesterOf: route has no viewer');
  return { actor: actorOf(req.viewer), viewer: req.viewer, correlationId: req.correlationId, ipPrefix: ipPrefix(req.ip), via: 'man_hinh' };
}

export const Req = createParamDecorator((_: unknown, ctx: ExecutionContext): Requester => requesterOf(ctx.switchToHttp().getRequest<Request>()));
