import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { maskContactsInText, maskPhone } from '@vclinks/shared';
import { from, mergeMap, type Observable } from 'rxjs';
import { AuthzService } from './authz.service';
import type { AuthzRequest } from './authz.guard';

/** Response fields holding a customer phone number. */
const PHONE_FIELDS = ['phone', 'phoneNumber'] as const;
/** Staff data (admin screens, own profile) is not customer data: left as is. */
/** `/api/customers`: CustomersService masks its own views by customer (owner, nick holder), not by one channel. */
const SKIP_PREFIXES = ['/api/admin', '/api/me', '/api/auth', '/api/reveal', '/api/customers'];

type Visibility = 'full' | 'reveal' | 'masked';

/** Parts of a message's content whose free text is masked like the message text (no "Hiện" button). */
const CONTENT_KEYS = new Set(['card', 'location', 'reminder']);

/**
 * "Ẩn SĐT phía API" (M1b-04, MH-PQ-12, D6): for a signed-in user, every customer phone in a JSON
 * response is masked (`0900 *** 201`) unless cust.phone_full shows it in full on that channel. Masked
 * values carry `phoneMasked: true` and `phoneRevealable` (a "Hiện" button, POST /api/reveal, logged).
 * The channel of a record is its `uid` (or the nearest parent's / the route's).
 */
@Injectable()
export class PhoneMaskInterceptor implements NestInterceptor {
  constructor(private readonly authz: AuthzService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<AuthzRequest>();
    const u = req.subject;
    if (!u || SKIP_PREFIXES.some((p) => req.path.startsWith(p))) return next.handle();
    const routeUid = (req.params?.uid as string | undefined) ?? (typeof req.query?.uid === 'string' ? req.query.uid : undefined) ??
      (typeof req.params?.id === 'string' && req.params.id.includes(':') ? req.params.id.slice(0, req.params.id.indexOf(':')) : undefined);
    const cache = new Map<string, Promise<Visibility>>();
    const visibility = (uid: string | undefined): Promise<Visibility> => {
      if (!uid) return Promise.resolve('masked');
      if (!cache.has(uid)) cache.set(uid, this.authz.phoneOn(u, uid));
      return cache.get(uid)!;
    };
    const walk = async (v: unknown, uid: string | undefined, key = ''): Promise<void> => {
      if (Array.isArray(v)) {
        for (const x of v) await walk(x, uid, key);
        return;
      }
      if (!v || typeof v !== 'object' || v instanceof Date || Buffer.isBuffer(v)) return;
      const o = v as Record<string, unknown>;
      const here = typeof o.uid === 'string' ? o.uid : uid;
      for (const f of PHONE_FIELDS) {
        if (typeof o[f] !== 'string' || !o[f]) continue;
        const vis = await visibility(here);
        if (vis === 'full') continue;
        o[f] = maskPhone(o[f] as string);
        o.phoneMasked = true;
        o.phoneRevealable = vis === 'reveal';
      }
      // Numbers and emails typed inside message text (L-02): a message (has an id and a time) shows a "Hiện"
      // per number; quoted text, the one-line previews and voice transcripts (M1c-04) are masked without a button.
      const isMessage = typeof o.id === 'string' && typeof o.msgId === 'string' && typeof o.sentAt === 'string';
      const textHolders: string[] = [];
      if (typeof o.text === 'string' && (isMessage || key === 'quote' || key === 'lastMessage' || key === 'transcript')) textHolders.push('text');
      if (typeof o.preview === 'string') textHolders.push('preview');
      // Typed captions of a link / business card, a location and a reminder (L5) are message content too.
      if (CONTENT_KEYS.has(key)) for (const f of ['title', 'address']) if (typeof o[f] === 'string') textHolders.push(f);
      for (const f of textHolders) {
        const vis = await visibility(here);
        if (vis === 'full') continue;
        const r = maskContactsInText(o[f] as string);
        if (!r.count) continue;
        o[f] = r.text;
        if (f === 'text' && isMessage) {
          o.textMasked = r.count;
          o.textRevealable = vis === 'reveal';
        }
      }
      for (const [k, x] of Object.entries(o)) if (x && typeof x === 'object' && !PHONE_FIELDS.includes(k as never)) await walk(x, here, k);
    };
    return next.handle().pipe(
      mergeMap((body) =>
        from(
          (async () => {
            await walk(body, routeUid);
            return body;
          })(),
        ),
      ),
    );
  }
}
