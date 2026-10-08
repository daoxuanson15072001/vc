import { Body, Controller, Delete, HttpCode, Param, Post, Put } from '@nestjs/common';
import { customRoleInputSchema } from '@vclinks/shared';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { CustomRolesService } from './custom-roles.service';
import { actorOf } from './people.service';

/** Custom roles (MH-PQ-05). Reading them goes through `GET /api/admin/roles`; writing needs role.edit (Admin). */
@Controller('admin/custom-roles')
export class CustomRolesController {
  constructor(private readonly roles: CustomRolesService) {}

  @Post()
  create(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.roles.create(parseOr400(customRoleInputSchema, body), actorOf(p));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.roles.update(id, parseOr400(customRoleInputSchema, body), actorOf(p));
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.roles.remove(id, actorOf(p));
  }
}
