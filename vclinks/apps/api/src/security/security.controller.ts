import { AttachmentsService } from '../attachments/attachments.service';
import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { DbService } from '../db/db.service';
import { CustomerKeysService } from './customer-keys.service';
import { MessageVault } from './message-vault';

const eraseSchema = z
  .object({
    /** Channel identity `${uid}:${userId}` (= contacts._id = identity_links._id). */
    identityId: z.string().regex(/^[^:\s]+:[^\s]+$/).max(200).optional(),
    /** Customer account of M1b-12: every linked identity is erased. */
    accountId: z.string().min(1).max(200).optional(),
    /** Explicit confirmation: erasure cannot be undone. */
    confirm: z.literal(true),
  })
  .strict()
  .refine((b) => !!b.identityId || !!b.accountId, { message: 'Cần identityId hoặc accountId' });

/**
 * Security administration (M1b-14). Permissions: apps/api/src/authz/route-permissions.ts, group "Security".
 * Never returns key material or message content.
 */
@Controller('security')
export class SecurityController {
  constructor(
    private readonly keys: CustomerKeysService,
    private readonly vault: MessageVault,
    private readonly db: DbService,
    // M1c-04: files and transcripts of the customer are deleted with the keys.
    private readonly attachments: AttachmentsService,
  ) {}

  @Get('status')
  async status() {
    return { encryptionEnabled: this.vault.enabled, ...(await this.keys.status()) };
  }

  /** "Ẩn danh = huỷ khoá" (BA §2.2 #9): destroys the customer's keys and scrubs plaintext content. */
  @Post('erase')
  @HttpCode(200)
  async erase(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const b = parseOr400(eraseSchema, body);
    const actor = p.userId ?? p.name;
    const r = await this.keys.erase({ identityIds: b.identityId ? [b.identityId] : [], accountId: b.accountId, actor });
    if (!r.subjects.length) throw new BadRequestException('Khách chưa có danh tính kênh nào được liên kết');
    const scrubbed = await this.vault.scrubSubjects(r.subjects);
    const purged = await this.attachments.purgeSubjects(r.subjects);
    await this.db.audit(actor, 'security.erase', b.accountId ?? b.identityId!, { subjects: r.subjects.length, keysDestroyed: r.keysDestroyed, scrubbed, files: purged.files, transcripts: purged.transcripts });
    return { subjects: r.subjects.length, keysDestroyed: r.keysDestroyed, scrubbed, files: purged.files, transcripts: purged.transcripts };
  }
}
