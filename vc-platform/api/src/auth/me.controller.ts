import { Controller, Get, Inject } from '@nestjs/common';
import { permissionsOf } from '@vc/contracts';
import { CLOCK, todayOn, type Clock } from '../common/clock';
import { ENV, type Env } from '../config/env';
import { CurrentViewer } from './decorators';
import type { Viewer } from './viewer';

/** GET /api/v1/me: who I am for the SPA (menus by role, today's date in Vietnam). Profile and account linking: B-08. */
@Controller('v1/me')
export class MeController {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  me(@CurrentViewer() v: Viewer) {
    return {
      sub: v.sub,
      email: v.email,
      person_id: v.personId,
      employee_code: v.employeeCode,
      account_linked: v.personId !== null,
      home_roles: v.assigned,
      hcns_scope: v.hcnsScope,
      roles: [...v.roles],
      permissions: permissionsOf(v.roles),
      role_conflicts: v.conflicts,
      today_on: todayOn(this.clock),
      features: { home_b: this.env.FEATURE_HOME_B },
    };
  }
}
