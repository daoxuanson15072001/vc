import type { PermMode, PermissionKey, ScopeCode } from '@vclinks/shared';

/*
 * Permission of every HTTP route (M1b-04, "Không endpoint nào thiếu khai báo quyền").
 * Key = `METHOD /full/express/path` (`ALL` for @All handlers). The AuthzGuard refuses any route missing
 * here (fail closed) and test/e2e/authz-routes.e2e-spec.ts lists every route of the app against this table.
 *
 * Kept in one table (not decorators) so controllers of other sessions are not edited: a new route only
 * needs one line here. Lines for routes that do not exist yet are harmless.
 */

/** Where the guard finds the channel (and thread) of the object, for the object-level check. */
export type TargetSpec =
  | { channel: `param:${string}` | `body:${string}` | `query:${string}`; thread?: `param:${string}` | `body:${string}` }
  /** `${uid}:${threadId}` conversation id in a route param. */
  | { conversation: `param:${string}` }
  /** Admin routes: org unit id / user id in a route param. */
  | { unit: `param:${string}` }
  | { user: `param:${string}` };

export type RouteRule =
  /** No token (webhooks, OAuth callbacks, health, pairing). */
  | { kind: 'public' }
  /** Device / MCP / dev tokens only (@Scopes without dashboard); signed-in users are refused. */
  | { kind: 'token' }
  /** Any authenticated principal (own profile, logout, field mapping for the extension). */
  | { kind: 'signed_in' }
  | {
      kind: 'perm';
      /** One key, or any of several keys. */
      key: PermissionKey | PermissionKey[];
      need?: PermMode;
      /** Only these scopes of the key count (e.g. the event log needs audit.view at TĐ). */
      scopes?: ScopeCode[];
      target?: TargetSpec;
      /** Object check is canSend (send a message) instead of `decide(key)`. */
      send?: boolean;
      /** Key whose scope limits the channel collections read by this request (default conv.view). */
      dataKey?: PermissionKey;
      /** The group approver (security_settings.groupApprover, Q-PQ-17) passes too; the service decides. */
      orGroupApprover?: boolean;
    };

const PUBLIC: RouteRule = { kind: 'public' };
const TOKEN: RouteRule = { kind: 'token' };
const SIGNED_IN: RouteRule = { kind: 'signed_in' };
const perm = (key: PermissionKey | PermissionKey[], more: Omit<Extract<RouteRule, { kind: 'perm' }>, 'kind' | 'key'> = {}): RouteRule => ({
  kind: 'perm',
  key,
  ...more,
});
const CONV_ID = { conversation: 'param:id' } as const;
const CHANNEL_KEYS: PermissionKey[] = ['channel.status', 'conv.view'];

export const ROUTE_PERMISSIONS: Record<string, RouteRule> = {
  // Meta, auth
  'GET /api/health': PUBLIC,
  'GET /api/me': SIGNED_IN,
  'GET /api/me/permissions': SIGNED_IN,
  'GET /api/auth/config': PUBLIC,
  'GET /api/auth/google': PUBLIC,
  'GET /api/auth/google/callback': PUBLIC,
  'POST /api/auth/logout': SIGNED_IN,
  'GET /api/auth/sessions': SIGNED_IN,
  'POST /api/auth/sessions/revoke-others': SIGNED_IN,
  'POST /api/auth/sessions/:id/revoke': SIGNED_IN,
  // Phone reveal (MH-PQ-12): the service checks cust.phone_full on the identity's channel and logs.
  'POST /api/reveal': SIGNED_IN,
  'POST /api/reveal/message': SIGNED_IN,
  // Temporary access request (MH-PQ-11): any role with grant.request; the approval screen is M1b-10.
  'GET /api/access-grants/approver': perm('grant.request'),
  'POST /api/access-grants': perm('grant.request'),
  // MH-PQ-07 (M1b-10): everyone has "Của tôi"; object checks (PQ-30, PQ-31, revoke scope) in GrantsService.
  'GET /api/access-grants': SIGNED_IN,
  'POST /api/access-grants/by-identity': perm('grant.request'),
  'GET /api/access-grants/cover-options': perm('grant.cover'),
  'POST /api/access-grants/covers': perm('grant.cover'),
  'POST /api/access-grants/:id/approve': perm(['grant.approve', 'grant.cover']),
  'POST /api/access-grants/:id/reject': perm(['grant.approve', 'grant.cover']),
  'POST /api/access-grants/:id/cancel': SIGNED_IN,
  'POST /api/access-grants/:id/revoke': perm('grant.revoke'),
  'POST /api/access-grants/:id/end': perm(['grant.cover', 'grant.revoke']),
  'POST /api/access-grants/:id/review-request': perm(['grant.approve', 'grant.cover']),
  'POST /api/leave-requests': perm('grant.leave_request'),
  'GET /api/access-grants/leave-candidates': perm('grant.leave_request'),
  // Compose box vs read-only (D8-02): same object check as opening the conversation.
  'GET /api/conversations/:id/access': perm('conv.view', { target: CONV_ID }),
  // AI reply drafts (M1c-06): no route sends; sending stays POST /api/outbox (conv.reply, canSend).
  'GET /api/conversations/:id/ai-draft': perm('ai.draft', { target: CONV_ID }),
  'POST /api/conversations/:id/ai-draft': perm('ai.draft', { target: CONV_ID }),
  'POST /api/conversations/:id/ai-draft/:draftId/reject': perm('ai.draft', { target: CONV_ID }),
  'POST /api/conversations/:id/ai-draft/:draftId/sent': perm('ai.draft', { target: CONV_ID }),
  'GET /api/ai-drafts/metrics': perm('ai.draft'),

  // Conversations and messages (01 §3.1)
  'GET /api/conversations': perm('conv.view'),
  // M1b-09 inbox: scopes and counters of what the caller already sees (data scope applies)
  'GET /api/conversations/inbox': perm('conv.view'),
  // M1c-02: flags only; the service keeps customers the caller may not see debt of (cust.debt) out.
  'GET /api/conversations/overdue-debt': perm('conv.view'),
  'GET /api/conversations/:id': perm('conv.view', { target: CONV_ID }),
  // Plan B2 "Xong" / "Mở lại": work state of the conversation, checked on the conversation like a reply.
  'POST /api/conversations/:id/done': perm('conv.status', { target: CONV_ID }),
  // Handler, internal notes, VClinks labels (00 MH-UI-10, 01 §3.1; conversation-work.service checks the state).
  'GET /api/conversations/:id/people': perm(['conv.assign', 'conv.transfer', 'conv.note'], { target: CONV_ID }),
  'POST /api/conversations/:id/claim': perm('conv.claim', { target: CONV_ID }),
  'POST /api/conversations/:id/assign': perm('conv.assign', { target: CONV_ID }),
  'POST /api/conversations/:id/transfer': perm('conv.transfer', { target: CONV_ID }),
  'POST /api/conversations/:id/release': perm(['conv.claim', 'conv.assign'], { target: CONV_ID }),
  'GET /api/conversations/:id/notes': perm('conv.view', { target: CONV_ID }),
  'POST /api/conversations/:id/notes': perm('conv.note', { target: CONV_ID }),
  'PATCH /api/conversations/:id/notes/:noteId': perm('conv.note', { target: CONV_ID }),
  'DELETE /api/conversations/:id/notes/:noteId': perm('conv.note', { target: CONV_ID }),
  'PUT /api/conversations/:id/labels': perm('conv.label', { target: CONV_ID }),
  'GET /api/conversation-labels': perm('conv.view'),
  'POST /api/conversation-labels': perm('conv.label'),
  'PATCH /api/conversation-labels/:id': perm('conv.assign'),
  'DELETE /api/conversation-labels/:id': perm('conv.assign'),
  'POST /api/conversations/:id/reopen': perm('conv.status', { target: CONV_ID }),
  'GET /api/conversations/:id/messages': perm('conv.view', { target: CONV_ID }),
  'GET /api/conversations/:id/shared': perm('conv.view', { target: CONV_ID }),
  'GET /api/conversations/:id/participants': perm('conv.view', { target: CONV_ID }),
  'POST /api/conversations/:id/fetch': perm('conv.view', { target: CONV_ID }),
  'GET /api/conversations/:id/fetch': perm('conv.view', { target: CONV_ID }),

  // Outbox (M1a-05 owns the routes; keys are the spec's: conv.reply sends, conv.view lists, outbox.reapprove)
  'POST /api/outbox': perm('conv.reply', { target: { channel: 'body:uid', thread: 'body:threadId' }, send: true }),
  'GET /api/outbox': perm('conv.view'),
  'GET /api/outbox/counts': perm('conv.view'),
  'POST /api/outbox/:id/retry': perm('conv.reply'),
  'POST /api/outbox/:id/cancel': perm('conv.reply'),
  'POST /api/outbox/:id/confirm': perm('conv.reply'),
  'POST /api/outbox/:id/reapprove': perm('outbox.reapprove'),
  'POST /api/outbox/attachments': perm('conv.reply'),
  'GET /api/outbox/pending': TOKEN,
  'POST /api/outbox/:id/claim': TOKEN,
  'POST /api/outbox/:id/result': TOKEN,

  // Contacts (01 §3.2); data scope stays conv.view (narrow: contacts carry chat context)
  'GET /api/contacts': perm('cust.view'),
  'GET /api/contacts/:uid/:userId': perm('cust.view', { target: { channel: 'param:uid' } }),
  'POST /api/contacts/:uid/dom': TOKEN,
  // M1a-04 (friend requests)
  'GET /api/friend-requests': perm('friend.respond'),
  'GET /api/contacts/groups': perm('cust.view'),
  'POST /api/contacts/:uid/friend-requests/dom': TOKEN,

  // Quick replies = personal / company templates (01 §3.4)
  'GET /api/quick-replies': perm('template.use'),
  'POST /api/quick-replies': perm('template.personal'),
  'PATCH /api/quick-replies/:id': perm('template.personal'),
  'DELETE /api/quick-replies/:id': perm('template.personal'),

  // Accounts / channels (01 §3.5)
  'POST /api/accounts': TOKEN,
  'GET /api/accounts': perm(CHANNEL_KEYS, { dataKey: 'channel.status' }),
  'GET /api/accounts/health': perm(CHANNEL_KEYS, { dataKey: 'channel.status' }),
  'GET /api/accounts/:uid/health': perm(CHANNEL_KEYS, { dataKey: 'channel.status', target: { channel: 'param:uid' } }),
  'POST /api/accounts/:uid/notify-admin': perm(CHANNEL_KEYS, { dataKey: 'channel.status', target: { channel: 'param:uid' } }),
  'POST /api/accounts/:uid/session': TOKEN,
  'PATCH /api/accounts/:uid': perm('channel.device', { dataKey: 'channel.status' }),
  'POST /api/devices/pairings': PUBLIC,
  'GET /api/devices/pairings/:id': PUBLIC,
  'POST /api/devices/pairings/approve': perm('device.pair'),
  'POST /api/devices/token/rotate': TOKEN,
  'POST /api/devices/token/commit': TOKEN,
  'GET /api/channels/facebook-page': perm('channel.status', { dataKey: 'channel.status' }),
  'GET /api/channels/facebook-page/connect': perm('channel.connect'),
  'GET /api/channels/facebook-page/callback': PUBLIC,
  'DELETE /api/channels/facebook-page/:uid': perm('channel.connect'),
  'GET /api/channels/zalo-oa': perm('channel.status', { dataKey: 'channel.status' }),
  // Máy Zalo (connect a nick by scanning a QR): connect / disconnect like confirming a new nick; the QR and the
  // rescan of one nick go to its holder or an Admin (checked in ZaloFarmService).
  'GET /api/zalo/farm': perm(CHANNEL_KEYS, { dataKey: 'channel.status' }),
  'GET /api/zalo/slots': perm(CHANNEL_KEYS, { dataKey: 'channel.status' }),
  'POST /api/zalo/slots': perm('channel.confirm', { scopes: ['ALL', 'TD'] }),
  'GET /api/zalo/slots/:id': perm(CHANNEL_KEYS, { dataKey: 'channel.status' }),
  'POST /api/zalo/slots/:id/sync-history': perm(CHANNEL_KEYS, { dataKey: 'channel.status' }),
  // Admin (any nick) or the nick's holder (his own): checked in ZaloFarmService.disconnect (dev002, 07/10/2026).
  'DELETE /api/zalo/slots/:id': perm(CHANNEL_KEYS, { dataKey: 'channel.status' }),
  'PATCH /api/zalo/slots/:id': perm('channel.confirm', { scopes: ['ALL', 'TD'] }),
  'POST /api/zalo/slots/:id/handover': perm('channel.confirm', { scopes: ['ALL', 'TD'] }),
  'POST /api/zalo/slots/:id/rollback': perm('channel.confirm', { scopes: ['ALL', 'TD'] }),
  // Zalo's sticker search for a direct nick (the composer's sticker panel): whoever may reply on that nick.
  'GET /api/zalo/stickers': perm('conv.reply', { target: { channel: 'query:uid' } }),
  'POST /api/zalo/rescan/:uid': perm(CHANNEL_KEYS, { dataKey: 'channel.status', target: { channel: 'param:uid' } }),
  'GET /api/channels/zalo-oa/connect': perm('channel.connect'),
  'GET /api/channels/zalo-oa/callback': PUBLIC,
  'DELETE /api/channels/zalo-oa/:uid': perm('channel.connect'),
  'GET /api/webhooks/facebook': PUBLIC,
  'POST /api/webhooks/facebook': PUBLIC,
  'POST /api/webhooks/zalo-oa': PUBLIC,

  // Sync and field mapping (01 §3.5)
  'GET /api/mapping/active': SIGNED_IN,
  'GET /api/mapping': perm(['sync.view', 'mapping.approve'], { dataKey: 'sync.view' }),
  'GET /api/mapping/drifts': perm(['sync.view', 'mapping.approve'], { dataKey: 'sync.view' }),
  'POST /api/mapping/drifts/:id/resolve': perm('mapping.approve'),
  'POST /api/mapping/:id/approve': perm('mapping.approve'),
  'POST /api/mapping/:id/reject': perm('mapping.approve'),
  'POST /api/mapping/drift': TOKEN,

  // Extension / MCP ingest side
  'POST /api/ingest/message-content': TOKEN,
  'POST /api/ingest/message-status': TOKEN,
  'POST /api/ingest/typing': TOKEN,
  'POST /api/ingest/dom-messages': TOKEN,
  'POST /api/ingest/thread-names': TOKEN,
  'POST /api/ingest/message-media': TOKEN,
  'POST /api/ingest/:stream': TOKEN,
  'GET /api/checkpoints/:uid/:stream': TOKEN,
  'POST /api/sync/report': TOKEN,
  // "Đồng bộ ngay" (M1a-06): read-only sync of one nick; the extension claims with its token.
  'POST /api/sync/requests': perm('sync.view', { target: { channel: 'body:uid' } }),
  'GET /api/sync/requests/:uid': perm('sync.view', { target: { channel: 'param:uid' } }),
  'POST /api/sync/requests/claim': TOKEN,
  'GET /api/fetch-requests/pending': TOKEN,
  'POST /api/fetch-requests/:id/claim': TOKEN,
  'POST /api/fetch-requests/:id/result': TOKEN,
  'GET /api/autosync/plan': TOKEN,
  'POST /api/autosync/result': TOKEN,
  'GET /api/threads/:threadId/pending-content': TOKEN,
  // Media is content-addressed (sha256) and only reachable through scoped messages.
  'GET /api/media/:id': perm('conv.view'),
  // M1c-04 company file store. Dashboard reads go through the scoped `attachments` collection (data scope of
  // the message, like conv.view); upload / download links are signed, expiring and carry their own tenant.
  'POST /api/attachments/upload-url': TOKEN,
  'PUT /api/attachments/upload/:token': PUBLIC,
  'POST /api/attachments/confirm': TOKEN,
  'GET /api/attachments/dl/:token': PUBLIC,
  'GET /api/attachments/:id/file': perm('conv.view'),
  'GET /api/attachments/:id/link': perm('conv.view'),
  'POST /api/attachments/:id/transcribe': perm('conv.view'),
  'POST /api/asr/jobs/claim': TOKEN,
  'GET /api/asr/jobs/:id/audio': TOKEN,
  'POST /api/asr/jobs/:id/result': TOKEN,
  'POST /api/asr/jobs/:id/fail': TOKEN,
  'POST /mcp': TOKEN,
  'ALL /mcp': TOKEN,
  'POST /mcp/dev': TOKEN,
  'ALL /mcp/dev': TOKEN,

  // Event log (M1b-01): whole-tenant read, so TĐ only (narrow)
  'GET /api/events': perm('audit.view', { scopes: ['TD'] }),

  // Administration (01 §3.6, M1b-03)
  'GET /api/admin/meta': perm(['org.view', 'user.view', 'role.view']),
  'GET /api/admin/org-units': perm('org.view'),
  'GET /api/admin/org-units/import/template': perm('org.edit'),
  'GET /api/admin/org-units/import/current': perm('org.edit'),
  'POST /api/admin/org-units/import/preview': perm('org.edit'),
  'POST /api/admin/org-units/import': perm('org.edit'),
  'GET /api/admin/org-units/:id/members': perm('org.view', { target: { unit: 'param:id' } }),
  'POST /api/admin/org-units': perm('org.edit'),
  'PATCH /api/admin/org-units/:id': perm('org.edit'),
  'POST /api/admin/org-units/:id/move': perm('org.edit'),
  'POST /api/admin/org-units/:id/deactivate': perm('org.edit'),
  'POST /api/admin/org-units/:id/reactivate': perm('org.edit'),
  'GET /api/admin/users': perm('user.view'),
  'GET /api/admin/users/import/template': perm('user.import'),
  'GET /api/admin/users/import/current': perm('user.import'),
  'POST /api/admin/users/import/preview': perm('user.import'),
  'POST /api/admin/users/import': perm('user.import'),
  'GET /api/admin/role-requests': perm(['role.approve', 'user.edit'], { orGroupApprover: true }),
  'POST /api/admin/role-requests/:id/approve': perm('role.approve', { orGroupApprover: true }),
  'POST /api/admin/role-requests/:id/reject': perm('role.approve', { orGroupApprover: true }),
  'POST /api/admin/role-requests/:id/cancel': perm('user.edit'),
  'POST /api/admin/users': perm('user.edit'),
  'GET /api/admin/users/:id/effective': perm('permission.explain', { target: { user: 'param:id' } }),
  // PQ-70: files a pending request in the checked person's name (grants nothing; the approver of PQ-30 decides).
  'POST /api/admin/users/:id/grant-request': perm('permission.explain', { target: { user: 'param:id' } }),
  'GET /api/admin/users/:id': perm('user.view', { target: { user: 'param:id' } }),
  'PATCH /api/admin/users/:id': perm('user.edit', { target: { user: 'param:id' } }),
  'POST /api/admin/users/:id/assignments': perm('user.edit', { target: { user: 'param:id' } }),
  'DELETE /api/admin/users/:id/assignments/:assignmentId': perm('user.edit', { target: { user: 'param:id' } }),
  'POST /api/admin/users/:id/pre-leave': perm('user.pre_leave', { target: { user: 'param:id' } }),
  'DELETE /api/admin/users/:id/pre-leave': perm('user.pre_leave', { target: { user: 'param:id' } }),
  'POST /api/admin/users/:id/lock': perm('user.lock', { target: { user: 'param:id' } }),
  'POST /api/admin/users/:id/unlock': perm('user.lock', { target: { user: 'param:id' } }),
  'POST /api/admin/users/:id/offboard': perm('user.offboard', { target: { user: 'param:id' } }),
  // Offboarding steps 2-4 (M1b-11, MH-PQ-04): the person's handover scope; GS may continue after the lock.
  'GET /api/admin/users/:id/offboard-preview': perm('user.handover', { target: { user: 'param:id' } }),
  'GET /api/admin/users/:id/handover/customers': perm('user.handover', { target: { user: 'param:id' } }),
  'GET /api/admin/users/:id/handover/receivers': perm('user.handover', { target: { user: 'param:id' } }),
  'GET /api/admin/users/:id/handovers': perm('user.handover', { target: { user: 'param:id' } }),
  'POST /api/admin/users/:id/handover/preview': perm('user.handover', { target: { user: 'param:id' } }),
  'POST /api/admin/users/:id/handover': perm('user.handover', { target: { user: 'param:id' } }),
  'POST /api/admin/channel-access/:uid/safety-confirm': perm('channel.safety_confirm', { target: { channel: 'param:uid' } }),
  'POST /api/admin/users/:id/change-unit': perm('user.edit', { target: { user: 'param:id' } }),
  // Channel assignment, pending nicks, tokens (M1b-06; MH-PQ-06 / 08 / 09)
  'GET /api/admin/channel-access': perm('channel.access', { dataKey: 'channel.access' }),
  'GET /api/admin/channel-access/pending': perm('channel.confirm', { need: 'view', scopes: ['ALL', 'TD'] }),
  'POST /api/admin/channel-access/:uid/confirm': perm('channel.confirm', { scopes: ['ALL', 'TD'] }),
  'POST /api/admin/channel-access/:uid/reject': perm('channel.confirm', { scopes: ['ALL', 'TD'] }),
  'POST /api/admin/channel-access/:uid': perm('channel.access', { target: { channel: 'param:uid' } }),
  'PATCH /api/admin/channel-access/:uid/:id': perm('channel.access', { target: { channel: 'param:uid' } }),
  'DELETE /api/admin/channel-access/:uid/:id': perm('channel.access', { target: { channel: 'param:uid' } }),
  // Quản trị → "Kết nối VCsales" (plan C5, C6): Admin, observers, sales directors and whoever loads the catalogue.
  'GET /api/admin/vcsales': perm(['user.view', 'cust.import'], { scopes: ['DV', 'TD', 'ALL'] }),
  'POST /api/admin/vcsales/ping': perm(['user.view', 'cust.import'], { scopes: ['DV', 'TD', 'ALL'] }),
  'GET /api/admin/tokens': perm('token.manage'),
  'POST /api/admin/tokens': perm('token.manage'),
  'GET /api/admin/tokens/:id/impact': perm('token.manage'),
  'POST /api/admin/tokens/:id/revoke': perm('token.manage'),
  'POST /api/admin/users/:id/revoke-tokens': perm('token.manage'),
  'GET /api/admin/token-settings': perm('token.manage'),
  'PUT /api/admin/token-settings': perm('token.manage'),
  'GET /api/settings/tokens': perm('token.own'),
  'POST /api/settings/tokens': perm('token.own'),
  'POST /api/settings/tokens/:id/revoke': perm('token.own'),
  // Roles & matrix (MH-PQ-05, screen in M1b-05)
  'GET /api/admin/roles': perm('role.view'),
  'POST /api/admin/custom-roles': perm('role.edit'),
  'PUT /api/admin/custom-roles/:id': perm('role.edit'),
  'DELETE /api/admin/custom-roles/:id': perm('role.edit'),

  // Customers (M1b-12, 01 §3.2). Lists are filtered in MongoDB by AuthzService.customerScope; the merge
  // undo accepts cust.merge or cust.split (owner / SA "Không phải người này"); ERP confirmation is limited
  // to sale admin in the service (DK-16, D8-17: GĐ division reads the matching list only).
  'GET /api/customers': perm('cust.view'),
  'POST /api/customers/import': perm('cust.import', { scopes: ['DV', 'TD', 'ALL'] }),
  'POST /api/customers/sweep': perm('cust.import', { scopes: ['DV', 'TD', 'ALL'] }),
  'GET /api/customers/erp-matching': perm('cust.erp_link'),
  // Việc VCsales (02 MH-DK-12): sale admin processes; owners create for their customers; supervisors, directors read.
  'GET /api/customers/erp-tasks': perm(['cust.erp_link', 'cust.transfer_request', 'cust.transfer_approve']),
  'GET /api/customers/erp-tasks/:id': perm(['cust.erp_link', 'cust.transfer_request', 'cust.transfer_approve']),
  'POST /api/customers/erp-tasks': perm(['cust.erp_link', 'cust.transfer_request', 'cust.transfer_approve', 'erp_task.merge_codes']),
  'PUT /api/customers/erp-tasks/:id/form': perm(['cust.erp_link', 'cust.transfer_request', 'cust.transfer_approve']),
  'POST /api/customers/erp-tasks/:id/claim': perm('cust.erp_link'),
  'POST /api/customers/erp-tasks/:id/check': perm('cust.erp_link'),
  'POST /api/customers/erp-tasks/:id/link': perm('cust.erp_link'),
  'POST /api/customers/erp-tasks/:id/return': perm('cust.erp_link'),
  'POST /api/customers/erp-tasks/:id/done': perm('cust.erp_link'),
  'POST /api/customers/erp-tasks/:id/close': perm('cust.erp_link'),
  // Danh mục VCsales (plan C11, D3-09): whoever loads the catalogue runs it; sale admins also read its state.
  'GET /api/customers/erp-sync': perm(['cust.import', 'cust.erp_link']),
  'POST /api/customers/erp-sync': perm('cust.import', { scopes: ['DV', 'TD', 'ALL'] }),
  'GET /api/customers/erp-search': perm('cust.erp_link'),
  // SLA và giờ làm việc: read with config.sla (view), change a division with config.sla in full on it (GĐ DV).
  'GET /api/admin/sla-settings': perm('config.sla', { need: 'view' }),
  'PUT /api/admin/sla-settings/:divisionId': perm('config.sla', { target: { unit: 'param:divisionId' } }),
  'DELETE /api/admin/sla-settings/:divisionId': perm('config.sla', { target: { unit: 'param:divisionId' } }),
  'GET /api/customers/merge-suggestions': perm('cust.merge'),
  'POST /api/customers/merge-suggestions/:id/merge': perm('cust.merge'),
  'POST /api/customers/merge-suggestions/:id/reject': perm('cust.merge'),
  'POST /api/customers/merge-operations/:id/undo': perm(['cust.merge', 'cust.split']),
  'GET /api/customers/by-identity/:uid/:userId': perm('cust.view', { target: { channel: 'param:uid' } }),
  'GET /api/customers/:id': perm('cust.view'),
  // Customer 360 (M1b-13): the service re-checks the customer (cust.view scope, cust.timeline, cust.phone_full, cust.commerce).
  'GET /api/customers/by-identity/:uid/:userId/360': perm('cust.view', { target: { channel: 'param:uid' } }),
  'GET /api/customers/:id/360': perm('cust.view'),
  // Tra hàng VCsales (M1c-01): the service re-checks conv.view and shows the customer price only with cust.commerce.
  'GET /api/catalog/by-identity/:uid/:userId/search': perm('cust.view', { target: { channel: 'param:uid' } }),
  // Gửi báo giá (M1c-02): the route needs the chat (conv.view / canSend); the service then decides quote.view, quote.send,
  // quote.open_erp and cust.debt on the chat's target (a mapped group takes the owners of its customer).
  'GET /api/quotes/by-identity/:uid/:userId': perm('conv.view', { target: { channel: 'param:uid', thread: 'param:userId' } }),
  'POST /api/quotes/send': perm('quote.send', { target: { channel: 'body:uid', thread: 'body:threadId' }, send: true }),
  // Phiếu CSKH soạn – NVKD duyệt (M1c-03): the service decides on the item (TK assignee, NICK approver, CT owner, TỔ / DV).
  // Only `approve` sends, keyed on workitem.approve (nick holder / "Trực nick"); CSKH has no key reaching it.
  'GET /api/workitems': perm(['ticket.view', 'ticket.create', 'workitem.approve', 'workitem.return', 'workitem.submit']),
  'GET /api/workitems/counts': perm(['ticket.view', 'ticket.create', 'workitem.approve', 'workitem.return', 'workitem.submit']),
  'GET /api/workitems/queues': perm('workitem.queue_config', { need: 'view' }),
  'PUT /api/workitems/queues': perm('workitem.queue_config'),
  'POST /api/workitems': perm('ticket.create', { target: { channel: 'body:uid', thread: 'body:threadId' } }),
  'GET /api/workitems/:id': perm(['ticket.view', 'ticket.create', 'workitem.approve', 'workitem.return', 'workitem.submit']),
  'GET /api/workitems/:id/quotes': perm('quote.view'),
  'PATCH /api/workitems/:id': perm('ticket.resolve'),
  'POST /api/workitems/:id/start': perm('ticket.resolve'),
  'POST /api/workitems/:id/submit': perm('workitem.submit'),
  'POST /api/workitems/:id/return': perm('workitem.return'),
  'POST /api/workitems/:id/self-reply': perm('workitem.return'),
  'POST /api/workitems/:id/approve': perm('workitem.approve'),
  'POST /api/workitems/:id/wait-vendor': perm('ticket.resolve'),
  'POST /api/workitems/:id/vendor-back': perm('ticket.resolve'),
  'POST /api/workitems/:id/close': perm('ticket.resolve'),
  'POST /api/workitems/:id/assign': perm('ticket.assign'),
  'GET /api/customers/:id/timeline': perm('cust.timeline'),
  'POST /api/customers/:id/reveal': perm('cust.view'),
  'GET /api/customers/:id/operations': perm('cust.view'),
  'POST /api/customers/:id/erp-links': perm('cust.erp_link'),
  // Access log and alerts (M1b-07). The log shows the people the caller's audit.view scope covers (service);
  // SELF-only roles read their own lines at /me/activity. QS proposes, Admin saves rules (alert.config).
  'GET /api/admin/audit': perm('audit.view', { scopes: ['TD', 'DV', 'TO', 'ALL'] }),
  'GET /api/admin/audit/export': perm('audit.view', { scopes: ['TD', 'DV', 'TO', 'ALL'] }),
  'GET /api/admin/audit/overview': perm('audit.view', { scopes: ['TD', 'DV', 'ALL'] }),
  'GET /api/me/activity': SIGNED_IN,
  'GET /api/admin/alerts': perm(['alert.handle', 'alert.config']),
  'POST /api/admin/alerts/:id/seen': perm(['alert.handle', 'alert.config']),
  'POST /api/admin/alerts/:id/handle': perm(['alert.handle', 'alert.config']),
  'GET /api/admin/alert-rules': perm(['alert.handle', 'alert.config']),
  'PUT /api/admin/alert-rules/:code': perm('alert.config'),
  'POST /api/admin/alert-rules/:code/propose': perm('alert.config', { need: 'propose' }),

  // App shell (M1b-08): quick search follows the conversation data scope; the rest is the user's own.
  'GET /api/search/quick': perm('search.global'),
  // M1c-05: message search; the data scope is applied by the scoped collections, phones in snippets follow phoneVisibility.
  'GET /api/search/messages': perm('search.global'),
  'GET /api/me/profile': SIGNED_IN,
  'PUT /api/me/status': SIGNED_IN,
  'GET /api/notifications': SIGNED_IN,
  // M1c-07: SSE stream; events are filtered to the user's own data scope in RealtimeService.
  'GET /api/realtime/stream': SIGNED_IN,

  // Security (M1b-14): key status, "ẩn danh = huỷ khoá" (BA §2.2 #9)
  'GET /api/security/status': perm('config.security'),
  'POST /api/security/erase': perm('cust.privacy_execute'),

  // Baseline KPI (M1b-15): numbers are cut to the report.performance scope in the query; CSV also needs report.export.
  'GET /api/metrics/kpi': perm('report.performance', { dataKey: 'report.performance' }),
  'GET /api/metrics/kpi/export': perm('report.export', { dataKey: 'report.performance' }),
  // Basic reports (M1c-09): the service resolves the nicks the caller may see from the engine (own nicks, TO / DV scope).
  'GET /api/reports/performance': perm('report.performance'),
  'GET /api/reports/performance/turns': perm('report.performance'),
  'GET /api/reports/performance/export': perm('report.export'),
};
