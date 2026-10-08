/** System settings (VH-ADM-05): defaults from @vc/contracts, changes need a reason and write the audit log. */
import { Inject, Injectable } from '@nestjs/common';
import { isSettingKey, SETTINGS, type SettingKey, type SettingValue } from '@vc/contracts';
import type { Db, MongoClient } from 'mongodb';
import { ApiError } from '../common/api-error';
import { withTx } from '../common/tx';
import { CLOCK, type Clock } from '../common/clock';
import { C } from '../db/collections';
import { DB, MONGO_CLIENT } from '../db/mongo';
import { AuditService, type Actor, type SourceType } from '../audit/audit.service';

export interface SettingDoc {
  _id: string;
  value: unknown;
  default_value: unknown;
  updated_by?: string | null;
  updated_at?: Date;
  reason?: string;
}

@Injectable()
export class SettingsService {
  private cache = new Map<string, { at: number; value: unknown }>();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MONGO_CLIENT) private readonly client: MongoClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  private get col() {
    return this.db.collection<SettingDoc>(C.settings);
  }

  /** Value of a setting (cached 30 seconds); falls back to the default when not stored or invalid. */
  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.value as SettingValue<K>;
    const doc = await this.col.findOne({ _id: key });
    const parsed = SETTINGS[key].schema.safeParse(doc?.value);
    const value = (parsed.success ? parsed.data : SETTINGS[key].default) as SettingValue<K>;
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  async set(key: string, value: unknown, reason: string, actor: Actor, ctx: { correlationId: string; source: SourceType; ipPrefix?: string | null }): Promise<void> {
    if (!isSettingKey(key)) throw new ApiError('not_found', { message: `Không có cài đặt ${key}.` });
    const d = SETTINGS[key];
    if ((d as { readOnly?: boolean }).readOnly) throw new ApiError('rule_violation', { message: `Cài đặt "${d.label}" chỉ đọc.` });
    if (!reason || reason.trim().length < 10) throw new ApiError('rule_violation', { message: 'Nhập lý do (ít nhất 10 ký tự).' });
    const parsed = d.schema.safeParse(value);
    if (!parsed.success) throw new ApiError('rule_violation', { message: `Giá trị không hợp lệ cho "${d.label}": cần ${d.hint}.` });
    await withTx(this.client, async (session) => {
      const before = await this.col.findOne({ _id: key }, { session });
      await this.col.updateOne(
        { _id: key },
        { $set: { value: parsed.data, default_value: d.default, updated_by: actor.person_id ?? actor.sub ?? null, updated_at: this.clock.now(), reason } },
        { upsert: true, session },
      );
      await this.audit.record(session, {
        actor,
        action: 'setting.update',
        target: { type: 'setting', id: key, label: key },
        before: { value: before?.value ?? d.default },
        after: { value: parsed.data },
        reason,
        correlation_id: ctx.correlationId,
        ip_prefix: ctx.ipPrefix ?? null,
        source: { type: ctx.source },
      });
    });
    this.cache.delete(key);
  }
}

/** Seeds every setting with its default when missing (migration B0003_settings). */
export async function seedSettings(db: Db): Promise<void> {
  for (const [key, d] of Object.entries(SETTINGS)) {
    await db.collection<SettingDoc>(C.settings).updateOne({ _id: key }, { $setOnInsert: { value: d.default, default_value: d.default } }, { upsert: true });
  }
}
