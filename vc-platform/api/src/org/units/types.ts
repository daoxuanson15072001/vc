/** `org_units` (05 mục 3.4 plus kế hoạch GĐ B mục 4.2: `group_email`, `description`, `head_history`, `deleted_at`). */
import type { UnitStatus, UnitType } from '@vc/contracts';
import type { ObjectId } from 'mongodb';

export interface HeadTerm {
  person_id: ObjectId;
  from_on: string;
  /** Last day as head; null while still head. */
  to_on: string | null;
}

export interface OrgUnitDoc {
  /** The code; never changes and is never reused, even after a soft delete. */
  _id: string;
  name: string;
  name_folded: string;
  short_name: string | null;
  type: UnitType;
  parent_code: string | null;
  /** Codes from the root down to the parent. */
  ancestors: string[];
  /** Nearest Division at or above the unit. */
  division_code: string | null;
  /** Own choice for the root, a Pháp nhân unit and units right under the root; inherited from the parent otherwise. */
  legal_entity_code: string | null;
  function_code: string | null;
  head_person_id: ObjectId | null;
  head_history: HeadTerm[];
  status: UnitStatus;
  effective_from_on: string;
  effective_to_on: string | null;
  merged_into_code: string | null;
  order: number;
  group_email: string | null;
  description: string;
  /** Soft delete of a unit made by mistake (04 VH-ORG-01 bước 6). */
  deleted_at: Date | null;
  /** Last event number of the unit (GĐ C events). */
  event_seq: number;
  created_at: Date;
  updated_at: Date;
  rev: number;
}

/** Fields a person or position document needs here (05 mục 3.1, 3.3). */
export interface PersonLite {
  _id: ObjectId;
  full_name?: string;
  employee_code?: string;
  status?: string;
}
