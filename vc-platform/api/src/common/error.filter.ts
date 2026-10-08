import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { sendError } from './http';
import type { JsonLogger } from './logger';

/** Every error thrown inside Nest goes through the same two shapes as Express-level errors. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  constructor(private readonly log: JsonLogger) {}

  catch(err: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    sendError(http.getRequest<Request>(), http.getResponse<Response>(), err, this.log);
  }
}
