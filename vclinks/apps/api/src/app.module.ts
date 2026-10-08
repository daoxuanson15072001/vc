import { Controller, Get, Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import type { WhoAmI } from '@vclinks/shared';
import { AccountsController } from './accounts/accounts.controller';
import { AlertsService } from './audit/alerts.service';
import { AuditController } from './audit/audit.controller';
import { MetricsController } from './metrics/metrics.controller';
import { MetricsService } from './metrics/metrics.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { AuditService } from './audit/audit.service';
import { AuthzController } from './authz/authz.controller';
import { GrantsController } from './authz/grants.controller';
import { GrantsService } from './authz/grants.service';
import { NotificationsService } from './notifications/notifications.service';
import { RealtimeController } from './realtime/realtime.controller';
import { RealtimeService } from './realtime/realtime.service';
import { SlaMonitorService } from './realtime/sla-monitor.service';
import { ShellController } from './shell/shell.controller';
import { SearchController } from './search/search.controller';
import { SearchService } from './search/search.service';
import { ShellService } from './shell/shell.service';
import { AuthzGuard } from './authz/authz.guard';
import { AuthzService } from './authz/authz.service';
import { PhoneMaskInterceptor } from './authz/phone-mask.interceptor';
import { AccountsService } from './accounts/accounts.service';
import { DevicesController } from './accounts/devices.controller';
import { DevicesService } from './accounts/devices.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { GoogleClient } from './auth/google.client';
import { SessionService } from './auth/session.service';
import { UsersService } from './users/users.service';
import { AnyScope, AuthGuard, CurrentPrincipal, Public } from './auth/auth.guard';
import { ChannelSenderRegistry } from './channels/channel-sender';
import { CredentialsService } from './channels/credentials.service';
import { FacebookPageModule } from './channels/facebook-page/facebook-page.module';
import { ZaloOaModule } from './channels/zalo-oa/zalo-oa.module';
import { TokenService, type Principal } from './auth/token.service';
import { ContactsController } from './contacts/contacts.controller';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { CustomersController } from './customers/customers.controller';
import { ErpTasksController } from './customers/erp-tasks.controller';
import { ErpTasksService } from './customers/erp-tasks.service';
import { ErpSyncService } from './customers/erp-sync.service';
import { CustomersService, VCSALE_CLIENT } from './customers/customers.service';
import { createVcsaleClient } from '@vclinks/vcsale-client';
import { ContactsService } from './contacts/contacts.service';
import { FriendRequestsController } from './contacts/friend-requests.controller';
import { FriendRequestsService } from './contacts/friend-requests.service';
import { ConversationsController } from './conversations/conversations.controller';
import { ConversationLabelsController, ConversationWorkController } from './conversations/conversation-work.controller';
import { ConversationWorkService } from './conversations/conversation-work.service';
import { CUSTOMER_OWNERSHIP, ConversationsService } from './conversations/conversations.service';
import { CustomerLinksService } from './customers/customer-links.service';
import { CustomerPrivacyService } from './customers/customer-privacy';
import { Customer360Service } from './customers/customer-360.service';
import { SUBJECT_RESOLVER } from './security/subject-resolver';
import { DbService } from './db/db.service';
import { IngestController } from './ingest/ingest.controller';
import { IngestService } from './ingest/ingest.service';
import { MappingController } from './mapping/mapping.controller';
import { AsrController, AttachmentsController } from './attachments/attachments.controller';
import { AsrService } from './attachments/asr.service';
import { AttachmentsService } from './attachments/attachments.service';
import { UrlFetcher } from './attachments/url-fetcher';
import { MediaStore } from './media/media-store';
import { MediaController } from './media/media.controller';
import { MediaService } from './media/media.service';
import { QuoteGate, QUOTE_GATE } from './quotes/quote-gate';
import { QuotesController } from './quotes/quotes.controller';
import { WorkitemsController } from './workitems/workitems.controller';
import { WorkitemsService } from './workitems/workitems.service';
import { QuotesService } from './quotes/quotes.service';
import { DebtFlagsService } from './quotes/debt-flags.service';
import { MappingService } from './mapping/mapping.service';
import { DevMcpController } from './devreq/dev-mcp.controller';
import { DevMcpToolsFactory } from './devreq/dev-mcp.tools';
import { DevRequestsService } from './devreq/devreq.service';
import { SpecDocsService } from './devreq/spec-docs.service';
import { McpController } from './mcp/mcp.controller';
import { McpToolsFactory } from './mcp/mcp.tools';
import { ChannelAccessController } from './channel-access/channel-access.controller';
import { ChannelAccessService } from './channel-access/channel-access.service';
import { FarmClient } from './zalo-farm/farm-client';
import { ZaloFarmController } from './zalo-farm/zalo-farm.controller';
import { ZaloFarmService } from './zalo-farm/zalo-farm.service';
import { OwnTokensController, TokensAdminController } from './tokens/tokens.controller';
import { TokensService } from './tokens/tokens.service';
import { OutboxController } from './outbox/outbox.controller';
import { OutboxDispatcher } from './outbox/outbox.dispatcher';
import { OutboxService } from './outbox/outbox.service';
import { ConversationFetchController, FetchRequestsController } from './threads/fetch-requests.controller';
import { FetchRequestsService } from './threads/fetch-requests.service';
import { PendingContentController } from './threads/pending-content.controller';
import { AutoSyncController } from './threads/autosync.controller';
import { AutoSyncService } from './threads/autosync.service';
import { QuickRepliesController } from './quick-replies/quick-replies.controller';
import { SlaSettingsController } from './conversations/sla-settings.controller';
import { SlaSettingsService } from './conversations/sla-settings.service';
import { QuickRepliesService } from './quick-replies/quick-replies.service';
import { ParticipantsController } from './threads/participants.controller';
import { EventsController } from './events/events.controller';
import { EventsService } from './events/events.service';
import { OrgController, PeopleController } from './org/org.controller';
import { OrgImportService } from './org/org-import.service';
import { OrgService } from './org/org.service';
import { CustomRolesController } from './org/custom-roles.controller';
import { VcsalesController } from './vcsales/vcsales.controller';
import { VcsalesStatusService } from './vcsales/vcsales-status.service';
import { CustomRolesService } from './org/custom-roles.service';
import { PeopleService } from './org/people.service';
import { UserImportService } from './org/user-import.service';
import { AiGateway } from './security/ai-gateway';
import { externalAiClientProvider } from './security/ai-client';
import { AiDraftMetricsController, SuggestController } from './suggest/suggest.controller';
import { SuggestService } from './suggest/suggest.service';
import { SuggestWorker } from './suggest/suggest.worker';
import { PART_LOOKUP, VCWIKI_CLIENT, createPartLookup, createVcwikiClient } from './suggest/knowledge';
import { CustomerKeysService } from './security/customer-keys.service';
import { MessageVault } from './security/message-vault';
import { SecurityController } from './security/security.controller';
import { HandoverController } from './handover/handover.controller';
import { HandoverService } from './handover/handover.service';
import { SyncRequestsController } from './sync/sync-requests.controller';
import { SyncRequestsService } from './sync/sync-requests.service';

/** Services shared by the app and the channel modules (channels/*). */
const CORE_PROVIDERS = [
  DbService,
  TokenService,
  SessionService,
  EventsService,
  AccountsService,
  IngestService,
  OutboxService,
  CredentialsService,
  ChannelSenderRegistry,
  // Core: the outbox reads attachment metadata from it.
  MediaService,
  // M1c-04: byte store, company file store of attachments, voice-to-text queue (ASR_MODE=mock|live).
  MediaStore,
  UrlFetcher,
  AsrService,
  AttachmentsService,
  AuthzService,
  NotificationsService,
  // M1c-07: realtime bus (SSE) and the SLA watch.
  RealtimeService,
  SlaMonitorService,
  // M1b-14: per-customer keys, message sealing (ingest hook), the C3 gate in front of external AI.
  CustomerKeysService,
  MessageVault,
  // M1c-05: message search; IngestService keeps `searchKeys` in step with `text`.
  SearchService,
  // Customer links (M1b-12) behind the ports of M1b-14 (per-identity keys) and M1b-09 ("khách của tôi").
  CustomerLinksService,
  { provide: SUBJECT_RESOLVER, useExisting: CustomerLinksService },
  { provide: CUSTOMER_OWNERSHIP, useExisting: CustomerLinksService },
  // M1c-06: SUGGEST_MODE=mock (default) | live (Claude API, ANTHROPIC_API_KEY) | off.
  externalAiClientProvider,
  AiGateway,
  // VCsales is the mock until E5 (VCSALE_MODE). In the core so the outbox (connector process too) can re-check a
  // quote when its command is re-approved (M1c-02), and so everyone shares one client.
  { provide: VCSALE_CLIENT, useFactory: () => createVcsaleClient() },
  QuoteGate,
  { provide: QUOTE_GATE, useExisting: QuoteGate },
];

@Global()
@Module({ providers: CORE_PROVIDERS, exports: CORE_PROVIDERS })
export class CoreModule {}

@Controller()
class MetaController {
  @Get('health')
  @Public()
  health() {
    return { ok: true };
  }

  @Get('me')
  @AnyScope()
  me(@CurrentPrincipal() p: Principal): WhoAmI {
    return { name: p.name, scopes: p.scopes, ...(p.userId ? { userId: p.userId } : {}) };
  }
}

const CONNECTOR_PROVIDERS = [MappingService, OutboxDispatcher, FetchRequestsService, AutoSyncService, SyncRequestsService];

/**
 * Connector process (BA §2.2 #7, D5-08): everything the extension and the
 * platform webhooks need (ingest, mapping, outbox pull/claim/result, fetch
 * requests, autosync) plus the OutboxDispatcher. Runs alone via connector.ts,
 * so channels keep receiving and sending while the web/Dashboard API is down.
 */
@Module({
  imports: [CoreModule, ZaloOaModule, FacebookPageModule],
  controllers: [
    MetaController,
    AccountsController,
    DevicesController,
    // Before IngestController: its `ingest/:stream` would capture `ingest/message-media`.
    MediaController,
    AttachmentsController,
    AsrController,
    IngestController,
    MappingController,
    OutboxController,
    PendingContentController,
    FetchRequestsController,
    AutoSyncController,
    SyncRequestsController,
  ],
  // Guards run in this order: token / scope / tenant, then permissions (M1b-04).
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_GUARD, useClass: AuthzGuard }, DevicesService, ...CONNECTOR_PROVIDERS],
  exports: CONNECTOR_PROVIDERS,
})
export class ConnectorModule {}

/** Full API (main.ts): the connector routes plus the Dashboard and MCP routes. */
@Module({
  imports: [ConnectorModule],
  controllers: [
    AuthController,
    ConversationsController,
    ConversationWorkController,
    ConversationLabelsController,
    ContactsController,
    // Before CustomersController: /customers/erp-tasks and /customers/erp-sync must not fall into /customers/:id.
    ErpTasksController,
    CustomersController,
    CatalogController,
    QuotesController,
    WorkitemsController,
    FriendRequestsController,
    // Before McpController, so `/mcp/dev` never falls into its catch-all.
    DevMcpController,
    McpController,
    ParticipantsController,
    ConversationFetchController,
    QuickRepliesController,
    SlaSettingsController,
    EventsController,
    RealtimeController,
    OrgController,
    PeopleController,
    AuthzController,
    CustomRolesController,
    VcsalesController,
    GrantsController,
    ShellController,
    SearchController,
    SecurityController,
    AuditController,
    ChannelAccessController,
    ZaloFarmController,
    HandoverController,
    TokensAdminController,
    OwnTokensController,
    MetricsController,
    ReportsController,
    SuggestController,
    AiDraftMetricsController,
  ],
  providers: [
    ChannelAccessService,
    FarmClient,
    ZaloFarmService,
    HandoverService,
    TokensService,
    { provide: APP_INTERCEPTOR, useClass: PhoneMaskInterceptor },
    AuditService,
    AlertsService,
    MetricsService,
    ReportsService,
    OrgService,
    CustomRolesService,
    OrgImportService,
    PeopleService,
    UserImportService,
    AuthService,
    GoogleClient,
    UsersService,
    ShellService,
    GrantsService,
    ConversationsService,
    ConversationWorkService,
    ContactsService,
    CustomersService,
    // Plan C11, C12: VCsales catalogue sync and Việc VCsales (02 MH-DK-12).
    ErpTasksService,
    ErpSyncService,
    CustomerPrivacyService,
    Customer360Service,
    CatalogService,
    // M1c-02: send a quote from the chat (the gate lives in the core: the outbox re-checks quotes too).
    QuotesService,
    DebtFlagsService,
    // Plan C5 + C6: connection checks of VCsales and salesperson matching (Quản trị → "Kết nối VCsales").
    VcsalesStatusService,
    // M1c-03: phiếu báo giá / hậu mãi CSKH soạn – NVKD duyệt.
    WorkitemsService,
    FriendRequestsService,
    McpToolsFactory,
    DevRequestsService,
    SpecDocsService,
    DevMcpToolsFactory,
    QuickRepliesService,
    SlaSettingsService,
    // AI reply drafts (M1c-06); VCwiki and VCsales part lookup are mocks until their endpoints exist.
    { provide: VCWIKI_CLIENT, useFactory: () => createVcwikiClient() },
    { provide: PART_LOOKUP, useFactory: () => createPartLookup() },
    SuggestWorker,
    SuggestService,
  ],
})
export class AppModule {}
