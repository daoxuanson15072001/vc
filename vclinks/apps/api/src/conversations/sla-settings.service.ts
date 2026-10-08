import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_SLA_CONFIG, type SlaConfig, type SlaSettingsInput, type SlaSettingsList, type SlaSettingsRow } from '@vclinks/shared';
import { DbService } from '../db/db.service';
import { decide, type Subject } from '../authz/engine';
import { ORG_C, type OrgUnitDoc } from '../org/org.types';
import { SLA_SETTINGS, clearSlaCache } from './inbox-state';

interface SlaSettingsDoc extends Partial<SlaConfig> {
  _id: string;
  updatedAt?: Date;
  updatedBy?: string;
}

/**
 * "SLA và giờ làm việc" (docs 01 key config.sla): first-response minutes, warning share and work calendar per
 * division, in `sla_settings` (read by inbox-state). A division without its own settings uses `default`, else the
 * built-in calendar. Per the role matrix only a sales director edits their division (DV); Admin and observers read.
 */
@Injectable()
export class SlaSettingsService {
  constructor(private readonly db: DbService) {}

  private col() {
    return this.db.col<SlaSettingsDoc>(SLA_SETTINGS);
  }

  private static effective(doc: SlaSettingsDoc | undefined, base: SlaConfig): SlaConfig {
    return {
      slaMinutes: doc?.slaMinutes ?? base.slaMinutes,
      warnRatio: doc?.warnRatio ?? base.warnRatio,
      calendar: doc?.calendar ?? base.calendar,
    };
  }

  private static may(u: Subject | undefined, unit: OrgUnitDoc, need: 'view' | 'full'): boolean {
    return !u || decide(u, 'config.sla', { divisionId: unit._id, unitIds: [unit._id] }, { need }).allowed;
  }

  async list(u: Subject | undefined): Promise<SlaSettingsList> {
    const divisions = await this.db
      .col<OrgUnitDoc>(ORG_C.orgUnits)
      .find({ type: 'division', active: true })
      .sort({ name: 1 })
      .toArray();
    const docs = await this.col().find({}).toArray();
    const byId = new Map(docs.map((d) => [d._id, d]));
    const def = byId.get('default');
    const base = SlaSettingsService.effective(def, DEFAULT_SLA_CONFIG);
    const rows: SlaSettingsRow[] = divisions
      .filter((d) => SlaSettingsService.may(u, d, 'view'))
      .map((d) => {
        const own = byId.get(d._id);
        return {
          divisionId: d._id,
          divisionName: d.name,
          own: !!own,
          config: SlaSettingsService.effective(own, base),
          canEdit: SlaSettingsService.may(u, d, 'full'),
          updatedAt: own?.updatedAt?.toISOString() ?? null,
          updatedBy: own?.updatedBy ?? null,
        };
      });
    return { default: base, defaultIsBuiltIn: !def, divisions: rows };
  }

  private async division(id: string): Promise<OrgUnitDoc> {
    const unit = await this.db.col<OrgUnitDoc>(ORG_C.orgUnits).findOne({ _id: id, type: 'division' });
    if (!unit) throw new NotFoundException('Không tìm thấy division này.');
    return unit;
  }

  /** Saves the division's own settings (the route checked config.sla full on this division). */
  async save(divisionId: string, input: SlaSettingsInput, actor: string): Promise<void> {
    const unit = await this.division(divisionId);
    const now = new Date();
    await this.col().updateOne(
      { _id: unit._id },
      { $set: { slaMinutes: input.slaMinutes, warnRatio: input.warnRatio, calendar: input.calendar, updatedAt: now, updatedBy: actor } },
      { upsert: true },
    );
    clearSlaCache();
    await this.db.audit(actor, 'config.sla_update', unit._id, { slaMinutes: input.slaMinutes, warnRatio: input.warnRatio, holidays: input.calendar.holidays.length });
  }

  /** Back to the company default for this division. */
  async reset(divisionId: string, actor: string): Promise<void> {
    const unit = await this.division(divisionId);
    await this.col().deleteOne({ _id: unit._id });
    clearSlaCache();
    await this.db.audit(actor, 'config.sla_reset', unit._id);
  }
}
