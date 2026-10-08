import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ORG_UNIT_TYPES,
  ORG_UNIT_TYPE_LABELS,
  ORG_PARENT_TYPES,
  ROLE_KEYS,
  ROLE_LABELS,
  ROLE_UNIT_TYPE,
  SENSITIVE_ROLES,
  assignmentInputSchema,
  changeUnitSchema,
  importFileSchema,
  offboardInputSchema,
  lockInputSchema,
  preLeaveInputSchema,
  orgUnitInputSchema,
  orgUnitMoveSchema,
  orgUnitPatchSchema,
  userInputSchema,
  userPatchSchema,
} from '@vclinks/shared';
import { CurrentPrincipal } from '../auth/auth.guard';
import { CurrentSubject } from '../authz/authz.guard';
import { AuthzService } from '../authz/authz.service';
import type { Subject } from '../authz/engine';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { CustomRolesService } from './custom-roles.service';
import { OrgImportService } from './org-import.service';
import { OrgService } from './org.service';
import { PeopleService, actorOf } from './people.service';
import { UserImportService } from './user-import.service';

/*
 * Administration routes of M1b-03. Who may call what: apps/api/src/authz/route-permissions.ts (M1b-04);
 * lists are narrowed here to the caller's org.view / user.view scope (UAT-PQ-02, 04).
 */

const fileFormat = (f?: string): 'csv' | 'xlsx' => (f === 'xlsx' ? 'xlsx' : 'csv');

function send(res: Response, f: { name: string; buffer: Buffer }) {
  res.setHeader('Content-Type', f.name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${f.name}"`);
  res.send(f.buffer);
}

@Controller('admin')
export class OrgController {
  constructor(
    private readonly org: OrgService,
    private readonly orgImport: OrgImportService,
    private readonly authz: AuthzService,
    private readonly customRoles: CustomRolesService,
  ) {}

  /**
   * Lists the screens need: unit types, roles and which unit type each role sits in. Custom roles
   * (MH-PQ-05) sit where their base role sits and are sensitive when it is (PQ-42).
   */
  @Get('meta')
  async meta() {
    return {
      unitTypes: ORG_UNIT_TYPES.map((t) => ({ value: t, label: ORG_UNIT_TYPE_LABELS[t], parentTypes: ORG_PARENT_TYPES[t] })),
      roles: ROLE_KEYS.map((r) => ({ value: r, label: ROLE_LABELS[r], unitType: ROLE_UNIT_TYPE[r], sensitive: SENSITIVE_ROLES.includes(r) })),
      customRoles: (await this.customRoles.options()).map((c) => ({
        ...c,
        unitType: ROLE_UNIT_TYPE[c.baseRole],
        sensitive: SENSITIVE_ROLES.includes(c.baseRole),
      })),
    };
  }

  @Get('org-units')
  async list(@CurrentSubject() u: Subject | undefined) {
    const units = await this.org.list();
    const visible = u ? await this.authz.visibleUnits(u, 'org.view') : null;
    return visible ? units.filter((x) => visible.has(x.id)) : units;
  }

  @Get('org-units/import/template')
  async template(@Query('format') format: string | undefined, @Res() res: Response) {
    send(res, await this.orgImport.templateFile(fileFormat(format)));
  }

  @Get('org-units/import/current')
  async current(@Query('format') format: string | undefined, @Res() res: Response) {
    send(res, await this.orgImport.currentFile(fileFormat(format)));
  }

  @Post('org-units/import/preview')
  @HttpCode(200)
  importPreview(@Body() body: unknown) {
    const f = parseOr400(importFileSchema, body);
    return this.orgImport.preview(f.fileName, f.contentBase64);
  }

  @Post('org-units/import')
  @HttpCode(200)
  importCommit(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const f = parseOr400(importFileSchema, body);
    return this.orgImport.commit(f.fileName, f.contentBase64, actorOf(p).id);
  }

  @Get('org-units/:id/members')
  members(@Param('id') id: string) {
    return this.org.members(id);
  }

  @Post('org-units')
  create(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.org.create(parseOr400(orgUnitInputSchema, body), actorOf(p).id);
  }

  @Patch('org-units/:id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.org.update(id, parseOr400(orgUnitPatchSchema, body), actorOf(p).id);
  }

  @Post('org-units/:id/move')
  @HttpCode(200)
  move(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.org.move(id, parseOr400(orgUnitMoveSchema, body).parentId, actorOf(p).id);
  }

  @Post('org-units/:id/deactivate')
  @HttpCode(200)
  deactivate(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.org.deactivate(id, actorOf(p).id);
  }

  @Post('org-units/:id/reactivate')
  @HttpCode(200)
  reactivate(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.org.reactivate(id, actorOf(p).id);
  }
}

@Controller('admin')
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly userImport: UserImportService,
    private readonly authz: AuthzService,
  ) {}

  @Get('users')
  async list(
    @Query() q: { q?: string; orgUnitId?: string; role?: string; status?: string; page?: string; pageSize?: string },
    @CurrentPrincipal() p: Principal,
    @CurrentSubject() u: Subject | undefined,
  ) {
    const visible = u ? (uid: string) => this.authz.canOnUser(u, 'user.view', uid) : undefined;
    return this.people.list(
      { ...q, page: q.page ? Number(q.page) : undefined, pageSize: q.pageSize ? Number(q.pageSize) : undefined },
      actorOf(p),
      visible,
    );
  }

  // Fixed-path routes before `users/:id`.
  @Get('users/import/template')
  async template(@Query('format') format: string | undefined, @Res() res: Response) {
    send(res, await this.userImport.templateFile(fileFormat(format)));
  }

  @Get('users/import/current')
  async current(@Query('format') format: string | undefined, @Res() res: Response) {
    send(res, await this.userImport.currentFile(fileFormat(format)));
  }

  @Post('users/import/preview')
  @HttpCode(200)
  importPreview(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const f = parseOr400(importFileSchema, body);
    return this.userImport.preview(f.fileName, f.contentBase64, actorOf(p));
  }

  @Post('users/import')
  @HttpCode(200)
  importCommit(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const f = parseOr400(importFileSchema, body);
    return this.userImport.commit(f.fileName, f.contentBase64, actorOf(p));
  }

  @Get('role-requests')
  requests(@Query('status') status?: string) {
    return this.people.listRequests(status);
  }

  @Post('role-requests/:id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.people.approve(id, actorOf(p));
  }

  @Post('role-requests/:id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.people.reject(id, actorOf(p));
  }

  @Post('role-requests/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.people.cancel(id, actorOf(p));
  }

  @Post('users')
  create(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.people.create(parseOr400(userInputSchema, body), actorOf(p));
  }

  @Get('users/:id')
  get(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.people.get(id, actorOf(p));
  }

  @Patch('users/:id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.people.update(id, parseOr400(userPatchSchema, body), actorOf(p));
  }

  @Post('users/:id/assignments')
  async addAssignment(
    @Param('id') id: string,
    @Body() body: unknown,
    @Query('replaceManager') replace: string | undefined,
    @CurrentPrincipal() p: Principal,
  ) {
    return this.people.addAssignment(id, parseOr400(assignmentInputSchema, body), actorOf(p), { replaceManager: replace === '1' });
  }

  @Delete('users/:id/assignments/:assignmentId')
  @HttpCode(200)
  async removeAssignment(@Param('id') id: string, @Param('assignmentId') aid: string, @CurrentPrincipal() p: Principal) {
    await this.people.removeAssignment(id, decodeURIComponent(aid), actorOf(p));
    return { ok: true };
  }

  @Post('users/:id/lock')
  @HttpCode(200)
  lock(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.people.lock(id, parseOr400(lockInputSchema, body).reason, actorOf(p));
  }

  @Post('users/:id/pre-leave')
  @HttpCode(200)
  setPreLeave(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.people.setPreLeave(id, parseOr400(preLeaveInputSchema, body), actorOf(p));
  }

  @Delete('users/:id/pre-leave')
  clearPreLeave(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.people.clearPreLeave(id, actorOf(p));
  }

  @Post('users/:id/unlock')
  @HttpCode(200)
  unlock(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.people.unlock(id, actorOf(p));
  }

  @Post('users/:id/offboard')
  @HttpCode(200)
  offboard(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() s?: Subject) {
    const input = parseOr400(offboardInputSchema, body);
    // MH-PQ-04 #4a: only an Admin may keep a device ("máy công ty dùng chung").
    if (input.keepDeviceTokenIds.length && s && !s.roles.some((r) => r.roleKey === 'admin')) {
      throw new ForbiddenException('Chỉ Admin được giữ lại thiết bị dùng chung của công ty.');
    }
    return this.people.offboard(id, input.reason, actorOf(p), input.keepDeviceTokenIds);
  }

  @Post('users/:id/change-unit')
  @HttpCode(200)
  changeUnit(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.people.changeUnit(id, parseOr400(changeUnitSchema, body), actorOf(p));
  }
}
