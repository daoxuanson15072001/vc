import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { presenceInputSchema, quickSearchQuerySchema, type MeProfile, type NotificationList, type QuickSearchResponse } from '@vclinks/shared';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { AuthzService } from '../authz/authz.service';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { GrantsService } from '../authz/grants.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ShellService } from './shell.service';

/** Routes of the app shell (M1b-08). Permissions are declared in authz/route-permissions.ts. */
@Controller()
export class ShellController {
  constructor(
    private readonly shell: ShellService,
    private readonly authz: AuthzService,
    private readonly grants: GrantsService,
    private readonly notices: NotificationsService,
  ) {}

  @Get('search/quick')
  search(@Query() query: unknown, @CurrentSubject() u?: Subject): Promise<QuickSearchResponse> {
    const q = parseOr400(quickSearchQuerySchema, query);
    return this.shell.quickSearch(q.q, q.limit, u);
  }

  @Get('me/profile')
  async profile(@CurrentPrincipal() p: Principal): Promise<MeProfile> {
    const profile = await this.shell.profile(p, await this.authz.me(p));
    // "Nghỉ phép" flag from covers (SZ-27, MH-UI-05 #9), M1b-10.
    return { ...profile, leave: p.userId ? await this.grants.leaveOf(p.userId) : null };
  }

  @Put('me/status')
  status(@CurrentPrincipal() p: Principal, @Body() body: unknown) {
    return this.shell.setPresence(p, parseOr400(presenceInputSchema, body));
  }

  @Get('notifications')
  async notifications(@CurrentPrincipal() p: Principal): Promise<NotificationList> {
    return p.userId ? this.notices.list(p.userId) : this.shell.notifications();
  }
}
