import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ERR_QUOTE_CHANGED, quoteBlock, type SalesQuote } from '@vclinks/shared';
import { VcsaleUnavailableError, type VcsaleClient, type VcsaleQuote } from '@vclinks/vcsale-client';
import { VCSALE_CLIENT } from '../customers/customers.service';

export const QUOTE_GATE = Symbol('QUOTE_GATE');

export const ERR_VCSALE_DOWN = 'Không kết nối được VCsales. Thử lại sau ít phút.';

export const toSalesQuote = (q: VcsaleQuote): SalesQuote => ({ ...q });

/**
 * The one place that decides whether a quote may go to a customer (BR16, BR17). It always reads VCsales live
 * (never a cache) and refuses an expired, unapproved / cancelled quote or one of another customer code.
 * Used by the send box (POST /quotes/send) and again when a `send_quote` command is re-approved
 * ("Thử lại", "Gửi ngay", "Duyệt lại"), so a quote that expired while the command waited is not sent.
 */
@Injectable()
export class QuoteGate {
  constructor(@Inject(VCSALE_CLIENT) private readonly vcsale: VcsaleClient) {}

  /**
   * Fresh quote when it may be sent, else an HTTP error carrying the text for the person. `viewedVersion`
   * is what the person looked at: a newer version stops the send (409, "vừa được sửa").
   */
  async assertSendable(no: string, customerCode: string, viewedVersion?: string, now: Date = new Date()): Promise<VcsaleQuote> {
    let fresh: VcsaleQuote | null;
    try {
      fresh = await this.vcsale.getQuote(no);
    } catch (e) {
      if (e instanceof VcsaleUnavailableError) throw new ServiceUnavailableException(ERR_VCSALE_DOWN);
      throw e;
    }
    if (!fresh) throw new NotFoundException(`Không tìm thấy báo giá ${no} trên VCsales.`);
    const block = quoteBlock(fresh, customerCode, now);
    if (block) throw new UnprocessableEntityException(block.message);
    if (viewedVersion !== undefined && fresh.version !== viewedVersion) throw new ConflictException(ERR_QUOTE_CHANGED(no));
    return fresh;
  }
}
