import { Injectable } from '@nestjs/common';
import type { ClientSession, Db, ObjectId } from 'mongodb';
import type { ChangeItem } from '../../common/changes';

/**
 * "Cập nhật quản lý trực tiếp cho {n} người đang báo cáo trưởng cũ" (04 VH-ORG-04 bước 4). B-05 sets the contract;
 * B-07 registers the provider that turns those people into "Đổi quản lý" items of the position handler, sent in the
 * same group as the new head.
 */
export interface HeadReportsProvider {
  items(db: Db, session: ClientSession, unitCode: string, oldHead: ObjectId, newHead: ObjectId, effectiveOn: string): Promise<ChangeItem[]>;
}

@Injectable()
export class HeadReports {
  private provider: HeadReportsProvider | null = null;

  register(p: HeadReportsProvider): void {
    this.provider = p;
  }

  get available(): boolean {
    return this.provider !== null;
  }

  items(db: Db, session: ClientSession, unitCode: string, oldHead: ObjectId, newHead: ObjectId, effectiveOn: string): Promise<ChangeItem[]> {
    return this.provider ? this.provider.items(db, session, unitCode, oldHead, newHead, effectiveOn) : Promise.resolve([]);
  }
}
