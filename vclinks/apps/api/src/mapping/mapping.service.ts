import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  DEFAULT_DOM_SELECTORS,
  DEFAULT_FIELD_MAPPING,
  mergeDefaultMapping,
  type DriftRecord,
  type DriftReport,
  type FieldMappingRecord,
  type FieldMappingSpec,
  type MappingStatus,
} from '@vclinks/shared';
import { ObjectId } from 'mongodb';
import { C, DbService } from '../db/db.service';

interface MappingDoc {
  _id: string;
  version: number;
  status: MappingStatus;
  spec: FieldMappingSpec;
  note?: string;
  proposedBy: string;
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

interface DriftDoc extends Omit<DriftRecord, 'id' | 'at'> {
  _id: ObjectId;
  at: Date;
}

const toRecord = (d: MappingDoc): FieldMappingRecord => ({
  id: d._id,
  version: d.version,
  status: d.status,
  spec: d.spec,
  note: d.note,
  proposedBy: d.proposedBy,
  createdAt: d.createdAt.toISOString(),
  approvedBy: d.approvedBy,
  approvedAt: d.approvedAt?.toISOString(),
});

const toDrift = ({ _id, at, ...rest }: DriftDoc): DriftRecord => ({
  id: _id.toHexString(),
  at: at.toISOString(),
  ...rest,
});

/**
 * Versioned field mappings. Claude proposes (MCP), a human approves (Dashboard),
 * the extension pulls the active one. Only one version is `active` at a time.
 */
@Injectable()
export class MappingService implements OnModuleInit {
  constructor(private readonly db: DbService) {}

  private get mappings() {
    return this.db.col<MappingDoc>(C.fieldMappings);
  }
  private get drifts() {
    return this.db.col<DriftDoc>(C.mappingDrifts);
  }

  async onModuleInit() {
    if ((await this.mappings.countDocuments({}, { limit: 1 })) === 0) {
      await this.mappings.insertOne({
        _id: 'mapping-v1',
        version: 1,
        status: 'active',
        spec: DEFAULT_FIELD_MAPPING,
        note: 'Bản mặc định theo khảo sát Zalo Web 28/09/2026',
        proposedBy: 'system',
        createdAt: new Date(),
        approvedBy: 'system',
        approvedAt: new Date(),
      });
    }
    await this.upgradeFromDefaults();
  }

  /**
   * The defaults gain streams/fields over time (e.g. reactions, labels, read
   * state on 28/09/2026). An active mapping that lacks them gets a new active
   * version with just those additions, so the extension picks them up on its
   * next sync. Existing fields, stores and DOM selectors are never changed here;
   * renames still go through propose → approve.
   */
  async upgradeFromDefaults(): Promise<string[]> {
    const active = await this.mappings.findOne({ status: 'active' });
    if (!active) return [];
    const { spec, added } = mergeDefaultMapping(active.spec, DEFAULT_FIELD_MAPPING);
    if (!added.length) return [];
    const last = await this.mappings.find().sort({ version: -1 }).limit(1).next();
    const version = (last?.version ?? active.version) + 1;
    const now = new Date();
    await this.mappings.insertOne({
      _id: `mapping-v${version}`,
      version,
      status: 'active',
      spec,
      note: `Hệ thống bổ sung theo bản mặc định: ${added.join(', ')}`,
      proposedBy: 'system',
      createdAt: now,
      approvedBy: 'system',
      approvedAt: now,
    });
    await this.mappings.updateOne({ _id: active._id }, { $set: { status: 'superseded' } });
    await this.db.audit('system', 'mapping.upgrade', `mapping-v${version}`, { version, added });
    return added;
  }

  async active(): Promise<FieldMappingRecord> {
    const d = await this.mappings.findOne({ status: 'active' });
    if (!d) throw new NotFoundException('Chưa có bảng ánh xạ đang áp dụng');
    return toRecord(d);
  }

  async list(): Promise<FieldMappingRecord[]> {
    return (await this.mappings.find().sort({ version: -1 }).limit(50).toArray()).map(toRecord);
  }

  async propose(spec: FieldMappingSpec, note: string | undefined, actor: string) {
    // A proposal that only fixes IndexedDB fields keeps the active DOM selectors.
    if (!spec.dom) {
      const active = await this.mappings.findOne({ status: 'active' });
      spec = { ...spec, dom: active?.spec.dom ?? DEFAULT_DOM_SELECTORS };
    }
    const last = await this.mappings.find().sort({ version: -1 }).limit(1).next();
    const version = (last?.version ?? 0) + 1;
    const doc: MappingDoc = {
      _id: `mapping-v${version}`,
      version,
      status: 'proposed',
      spec,
      note,
      proposedBy: actor,
      createdAt: new Date(),
    };
    await this.mappings.insertOne(doc);
    await this.db.audit(actor, 'mapping.propose', doc._id, { version });
    return toRecord(doc);
  }

  async approve(id: string, actor: string) {
    const d = await this.mappings.findOne({ _id: id });
    if (!d) throw new NotFoundException('Không tìm thấy bảng ánh xạ');
    if (d.status !== 'proposed') throw new BadRequestException(`Không thể duyệt bản ở trạng thái ${d.status}`);
    await this.mappings.updateMany({ status: 'active' }, { $set: { status: 'superseded' } });
    await this.mappings.updateOne(
      { _id: id },
      { $set: { status: 'active', approvedBy: actor, approvedAt: new Date() } },
    );
    await this.drifts.updateMany({ status: 'open' }, { $set: { status: 'resolved' } });
    await this.db.audit(actor, 'mapping.approve', id, { version: d.version });
    return toRecord((await this.mappings.findOne({ _id: id }))!);
  }

  async reject(id: string, actor: string) {
    const r = await this.mappings.findOneAndUpdate(
      { _id: id, status: 'proposed' },
      { $set: { status: 'rejected' } },
      { returnDocument: 'after' },
    );
    if (!r) throw new BadRequestException('Chỉ từ chối được bản đang chờ duyệt');
    await this.db.audit(actor, 'mapping.reject', id, { version: r.version });
    return toRecord(r);
  }

  /** One open drift per (uid, stream, kind): repeated reports refresh it. */
  async reportDrift(r: DriftReport) {
    const res = await this.drifts.findOneAndUpdate(
      { uid: r.uid, stream: r.stream, kind: r.kind, status: 'open' },
      { $set: { ...r, status: 'open', at: new Date() } },
      { upsert: true, returnDocument: 'after' },
    );
    return { id: res!._id.toHexString() };
  }

  async listDrifts(status?: 'open' | 'resolved'): Promise<DriftRecord[]> {
    return (
      await this.drifts
        .find(status ? { status } : {})
        .sort({ at: -1 })
        .limit(200)
        .toArray()
    ).map(toDrift);
  }

  async resolveDrift(id: string, actor: string) {
    if (!ObjectId.isValid(id)) throw new NotFoundException();
    const r = await this.drifts.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'resolved' } });
    if (!r.matchedCount) throw new NotFoundException();
    await this.db.audit(actor, 'drift.resolve', id);
  }
}
