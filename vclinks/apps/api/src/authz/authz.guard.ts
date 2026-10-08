import { CanActivate, ExecutionContext, ForbiddenException, Injectable, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NO_ACCESS_TEXT, SELF_EDIT_MESSAGE, TOKEN_TEXT, type PermissionKey } from '@vclinks/shared';
import { SCOPES_KEY, type AuthedRequest } from '../auth/auth.guard';
import type { Principal, Scope } from '../auth/token.service';
import { C, DbService } from '../db/db.service';
import { runUnscoped as runUnscopedRead, setRequestScope } from '../db/tenant-context';
import { AuthzService } from './authz.service';
import { hasKey, type Decision, type Subject, type Target } from './engine';
import { ROUTE_PERMISSIONS, type RouteRule, type TargetSpec } from './route-permissions';

export type AuthzRequest = AuthedRequest & { subject?: Subject };

/** Engine subject of the signed-in user (undefined for tokens without a user). */
export const CurrentSubject = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthzRequest>().subject,
);

/** Rule of a matched route: `METHOD /path`, then `ALL /path` (@All handlers). */
export function ruleOf(method: string, path: string): RouteRule | undefined {
  return ROUTE_PERMISSIONS[`${method.toUpperCase()} ${path}`] ?? ROUTE_PERMISSIONS[`ALL ${path}`];
}

const forbidden = (message: string) => new ForbiddenException(message);

/**
 * Second global guard, after AuthGuard (token, scope, tenant). For every route:
 * 1. the route must be declared in ROUTE_PERMISSIONS (fail closed);
 * 2. signed-in users: data scope of the request (channel collections filtered in MongoDB), role-level key
 *    check, then the object check (conversation / channel / unit / user) with the same engine;
 * 3. tokens without a user: device / MCP tokens on their own routes; dashboard tokens only with
 *    AUTHZ_LEGACY_TOKENS=1 (owner decision 04/10/2026).
 */
@Injectable()
export class AuthzGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthzService,
    private readonly db: DbService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest<AuthzRequest>();
    const path = (req.route as { path?: string } | undefined)?.path ?? req.path;
    const rule = ruleOf(req.method, path);
    if (!rule) throw forbidden(`Route chưa khai báo quyền: ${req.method} ${path}`);
    if (rule.kind === 'public') return true;
    const p = req.principal;
    if (!p) throw forbidden('Thiếu người dùng');

    // Personal MCP token (M1b-06): the owner's own data scope, only on /mcp; never on the Dashboard API.
    if (p.tokenKind === 'mcp_user') {
      if (!(req.path === '/mcp' || req.path === '/api/mcp') || rule.kind !== 'token') throw forbidden('Token MCP cá nhân chỉ dùng được ở địa chỉ MCP.');
      const owner = await this.authz.subject(p.userId!);
      if (!owner.active) throw forbidden('Tài khoản không còn hoạt động.');
      req.subject = owner;
      const ownScope = await this.authz.dataScope(owner, 'conv.view');
      if (ownScope) setRequestScope(ownScope);
      return true;
    }

    if (!p.userId) {
      // Device / sync / agent tokens bound to nicks never reach another nick (UAT-PQ-51, PQ-US-14).
      if (p.uids?.length) await this.assertBound(req, p);
      if (rule.kind === 'token' || rule.kind === 'signed_in') return true;
      const required = this.reflector.getAllAndOverride<Scope[] | undefined>(SCOPES_KEY, [ctx.getHandler(), ctx.getClass()]) ?? ['dashboard'];
      // A device / MCP token on a route shared with the Dashboard (e.g. media): its own scope decides.
      if (required.some((s) => s !== 'dashboard' && p.scopes.includes(s))) return true;
      if (this.authz.legacyAllowed(p)) return true;
      throw forbidden('Token này không gắn với người dùng nào. Hãy đăng nhập bằng tài khoản Google công ty.');
    }

    if (rule.kind === 'token') throw forbidden('Đường này chỉ dành cho thiết bị / tác tử.');
    const u = await this.authz.subject(p.userId);
    req.subject = u;
    const scope = await this.authz.dataScope(u, rule.kind === 'perm' ? (rule.dataKey ?? 'conv.view') : 'conv.view');
    if (scope) setRequestScope(scope);
    if (rule.kind === 'signed_in') return true;

    const keys = Array.isArray(rule.key) ? rule.key : [rule.key];
    const held = keys.filter((k) => hasKey(u, k, { need: rule.need, scopes: rule.scopes }));
    if (!held.length) {
      if (rule.orGroupApprover && (await this.authz.isGroupApprover(u.userId))) return true;
      throw forbidden(NO_ACCESS_TEXT.noPermission(keys.join(' | ')));
    }
    if (rule.target) await this.checkTarget(u, held, rule, req);
    // Org / role changes apply to the next request, not after the cache delay.
    if (req.method !== 'GET' && path.startsWith('/api/admin')) this.authz.invalidate();
    return true;
  }

  /** The nick(s) a request names, from route params, body or query; the object of claim / result by id. */
  private async requestedUids(req: AuthzRequest): Promise<string[]> {
    const out = new Set<string>();
    const add = (v: unknown) => typeof v === 'string' && v && out.add(v);
    add(req.params?.uid);
    add((req.body as Record<string, unknown> | undefined)?.uid);
    add((req.query as Record<string, unknown> | undefined)?.uid);
    const uploadId = req.path === '/api/attachments/confirm' ? (req.body as Record<string, unknown> | undefined)?.uploadId : undefined;
    const id = req.params?.id ?? uploadId;
    if (typeof id === 'string' && !out.size) {
      const col = req.path.startsWith('/api/outbox/')
        ? C.suggestions
        : req.path.startsWith('/api/fetch-requests/')
          ? C.fetchRequests
          : req.path.startsWith('/api/asr/jobs/')
            ? C.asrJobs
            : uploadId !== undefined
              ? C.attachments
              : null;
      if (col) {
        const doc = await runUnscopedRead(() => this.db.col<{ _id: string; uid?: string }>(col).findOne({ _id: id as never }, { projection: { uid: 1 } }));
        add(doc?.uid);
      }
    }
    return [...out];
  }

  private async assertBound(req: AuthzRequest, p: Principal): Promise<void> {
    const allowed = new Set(p.uids);
    // Pending nicks (registered by this device, awaiting an Admin) were added to the token on registration.
    const wanted = await this.requestedUids(req);
    if (!wanted.length && req.method === 'GET' && (req.path === '/api/outbox/pending' || req.path === '/api/fetch-requests/pending')) {
      if (p.uids!.length === 1) {
        (req.query as Record<string, unknown>).uid = p.uids![0];
        return;
      }
      throw forbidden(TOKEN_TEXT.deviceNotAssigned);
    }
    // A device may announce a nick it was not paired with; the account is created as pending, never shared.
    if (req.method === 'POST' && req.path === '/api/accounts' && p.tokenKind === 'device') return;
    if (wanted.some((u) => !allowed.has(u))) throw forbidden(TOKEN_TEXT.deviceNotAssigned);
  }

  private pick(req: AuthzRequest, ref: string): string | undefined {
    const [from, name] = ref.split(':') as ['param' | 'body' | 'query', string];
    const src = from === 'param' ? req.params : from === 'body' ? (req.body as Record<string, unknown>) : (req.query as Record<string, unknown>);
    const v = src?.[name];
    return typeof v === 'string' && v ? v : undefined;
  }

  private async checkTarget(
    u: Subject,
    keys: PermissionKey[],
    rule: Extract<RouteRule, { kind: 'perm' }>,
    req: AuthzRequest,
  ): Promise<void> {
    const spec = rule.target as TargetSpec;
    let target: Target;
    let label: string;
    if ('conversation' in spec || 'channel' in spec) {
      let uid: string | undefined;
      let thread: string | undefined;
      if ('conversation' in spec) {
        const id = this.pick(req, spec.conversation) ?? '';
        const i = id.indexOf(':');
        uid = i > 0 ? id.slice(0, i) : undefined;
        thread = i > 0 ? id.slice(i + 1) : undefined;
        label = id;
      } else {
        uid = this.pick(req, spec.channel);
        thread = spec.thread ? this.pick(req, spec.thread) : undefined;
        label = thread ? `${uid}:${thread}` : (uid ?? '');
      }
      // Malformed ids fall through to the handler (400 / 404 from its own validation).
      if (!uid) return;
      if (rule.send) {
        const d = await this.authz.canSend(u, uid, thread);
        if (!d.allowed) throw forbidden(NO_ACCESS_TEXT.api);
        await this.logIfNeeded(u, 'conversation.reply', label, d);
        return;
      }
      target = thread ? await this.authz.conversationTarget(uid, thread) : await this.authz.channelTarget(uid);
    } else if ('unit' in spec) {
      const id = this.pick(req, spec.unit);
      if (!id) return;
      const f = await this.authz.unitFacts(id);
      if (!f) return; // 404 from the handler
      target = { divisionId: f.divisionId, unitIds: [id] };
      label = id;
    } else {
      const id = this.pick(req, spec.user);
      if (!id) return;
      const units = await this.authz.unitsOf(id);
      const facts = await Promise.all(units.map((x) => this.authz.unitFacts(x)));
      target = { unitIds: units, divisionId: facts.find((f) => f?.divisionId)?.divisionId ?? null, userId: id, selfIds: [id] };
      label = id;
    }
    let self = false;
    for (const key of keys) {
      const d = this.authz.decide(u, key, target, { need: rule.need });
      if (d.allowed) {
        await this.logIfNeeded(u, key === 'conv.view' ? 'conversation.view' : key, label, d);
        return;
      }
      if (d.via === 'khong_ap_dung_cho_chinh_minh') self = true;
    }
    throw forbidden(self ? SELF_EDIT_MESSAGE : NO_ACCESS_TEXT.api);
  }

  /** `+NK` cells and temporary grants write one audit line per use (PQ-36, PQ-38); never content. */
  private async logIfNeeded(u: Subject, action: string, target: string, d: Decision) {
    if (!d.log) return;
    await this.db.audit(`user:${u.userId}`, action, target, { via: d.via });
  }
}
