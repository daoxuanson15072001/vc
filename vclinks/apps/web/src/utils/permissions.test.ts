import { describe, expect, it } from 'vitest';
import type { MePermissions } from '@vclinks/shared';
import { buttonState, canSeeTechnical, hasAnyPermission, rolesWithKey, waitingForRole } from './permissions';

const me = (permissions: MePermissions['permissions'], legacy = false): MePermissions => ({
  userId: 'u1',
  legacy,
  roles: [],
  permissions,
  heldChannels: [],
});

describe('buttonState (D8-02)', () => {
  it('hides a button when no role ever has the key', () => {
    expect(buttonState(me({}), 'msg.delete')).toEqual({ state: 'hide' });
    expect(buttonState(undefined, 'conv.reply')).toEqual({ state: 'hide' });
  });
  it('locks with a reason when the key exists but a condition is missing', () => {
    const m = me({ 'conv.reply': { scopes: ['NICK'], mode: 'full' } });
    expect(buttonState(m, 'conv.reply')).toEqual({ state: 'show' });
    expect(buttonState(m, 'conv.reply', { lockReason: 'Bạn không được gán nick này' })).toEqual({
      state: 'lock',
      reason: 'Bạn không được gán nick này',
    });
    const c = me({ 'cust.edit': { scopes: ['TK'], mode: 'full', conds: ['tag_note_only'] } });
    expect(buttonState(c, 'cust.edit')).toMatchObject({ state: 'lock' });
  });
  it('locks propose / view modes when full power is needed', () => {
    const m = me({ 'bot.edit': { scopes: ['NH'], mode: 'propose' } });
    expect(buttonState(m, 'bot.edit')).toEqual({ state: 'show' });
    expect(buttonState(m, 'bot.edit', { needFull: true })).toMatchObject({ state: 'lock' });
  });
  it('shows everything for legacy tokens', () => {
    expect(buttonState(me({}, true), 'msg.delete')).toEqual({ state: 'show' });
  });
});

describe('menu and technical view', () => {
  it('hasAnyPermission drives the "Quản trị" menu (UAT-PQ-06)', () => {
    expect(hasAnyPermission(me({}), ['org.view', 'user.view', 'role.view'])).toBe(false);
    expect(hasAnyPermission(me({ 'role.view': { scopes: ['ALL'], mode: 'view' } }), ['org.view', 'user.view', 'role.view'])).toBe(true);
  });
  it('a sales rep (sync.view on NICK only) does not see UID / raw content (D17)', () => {
    expect(canSeeTechnical(me({ 'sync.view': { scopes: ['NICK'], mode: 'full' } }))).toBe(false);
    expect(canSeeTechnical(me({ 'sync.view': { scopes: ['DV'], mode: 'full' } }))).toBe(true);
    expect(canSeeTechnical(me({}))).toBe(false);
  });
});

describe('rolesWithKey', () => {
  it('lists the roles of the access-log page as in UAT-UI-38', () => {
    expect(rolesWithKey('audit.view', ['TD', 'DV', 'TO', 'ALL']).join(', ')).toBe(
      'Admin hệ thống, Giám đốc bán hàng, Giám sát bán hàng, Ban giám đốc / Kiểm soát',
    );
  });
});

describe('waitingForRole (PQ-10: first login of a company address)', () => {
  it('waits only for a signed-in user without any role', () => {
    expect(waitingForRole(me({}))).toBe(true);
    expect(waitingForRole({ ...me({}), roles: [{ roleKey: 'nvkd', orgUnitId: 'to-hn1', orgUnitName: 'Tổ HN1', lead: false }] })).toBe(false);
    expect(waitingForRole(me({}, true))).toBe(false);
    expect(waitingForRole({ ...me({}), userId: null })).toBe(false);
    expect(waitingForRole(undefined)).toBe(false);
  });
});
