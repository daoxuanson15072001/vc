import { Controller, Get, Query } from '@nestjs/common';
import { EventsService } from './events.service';

/** Read-only API of the event log; writing happens inside the services. */
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(
    @Query('kind') kind?: string,
    @Query('id') id?: string,
    @Query('type') type?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.events.list({ kind, id, type, before, limit: Number(limit) || undefined });
  }
}
