import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { NO_ACCESS_TEXT, type ProductPriceHidden, type ProductSearchResponse } from '@vclinks/shared';
import { VcsaleUnavailableError, type VcsaleClient } from '@vclinks/vcsale-client';
import { AuthzService } from '../authz/authz.service';
import { decide, type Subject } from '../authz/engine';
import { CustomerPrivacyService } from '../customers/customer-privacy';
import { CustomersService, VCSALE_CLIENT } from '../customers/customers.service';

export const ERR_CATALOG_TEXT = 'Không kết nối được VCsales. Thử lại sau ít phút.';

/**
 * Product lookup in the chat (M1c-01, F9.1). READ ONLY: the only VCsales call is `searchProducts` (BR12).
 * The customer comes from the open conversation's identity, so the viewer must pass the same checks as the
 * Customer panel: the account is in scope (`CustomersService.byIdentity`) and the conversation may be opened
 * (`conv.view`, DK-40). The price by the customer's policy is shown only with `cust.commerce` full, for a
 * confirmed identity with a confirmed VCsales code (DK-15); otherwise the list price and stock only.
 * Never logs the query or message text.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly customers: CustomersService,
    private readonly privacy: CustomerPrivacyService,
    private readonly authz: AuthzService,
    @Inject(VCSALE_CLIENT) private readonly vcsale: VcsaleClient,
  ) {}

  async search(uid: string, userId: string, q: string, u: Subject | undefined): Promise<ProductSearchResponse> {
    const detail = await this.customers.byIdentity(uid, userId, u);
    if (u && !decide(u, 'conv.view', await this.authz.conversationTarget(uid, userId)).allowed) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    const level = await this.privacy.commerceLevel(u, detail);
    const mine = detail.contacts.flatMap((c) => c.identities).find((i) => i.uid === uid && i.userId === userId);
    const link = detail.erpLinks.find((l) => l.erp === 'vcsales' && l.status === 'confirmed');
    let hidden: ProductPriceHidden | null = null;
    if (level !== 'full') hidden = 'no_right';
    else if (mine?.state === 'unconfirmed') hidden = 'unconfirmed';
    else if (!link) hidden = 'no_link';
    const customerCode = hidden ? null : (link?.customerId ?? null);
    try {
      const rows = await this.vcsale.searchProducts(q, { customerCode, limit: 20 });
      return { items: rows, customerCode, priceHidden: hidden, error: null };
    } catch (e) {
      if (!(e instanceof VcsaleUnavailableError)) throw e;
      return { items: [], customerCode, priceHidden: hidden, error: ERR_CATALOG_TEXT };
    }
  }
}
