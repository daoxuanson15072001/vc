/** Catalog documents (05 mục 3.5 plus kế hoạch GĐ B mục 4.2: `name_folded`, `merged_into_code`, `level`…). */
import type { CatalogStatus, ProvinceCode, WorkLocationKind } from '@vc/contracts';

export interface CatalogBase {
  /** The code; never changes. */
  _id: string;
  name: string;
  name_folded: string;
  status: CatalogStatus;
  /** Day the current status started (VH-ORG-07 "Trạng thái, từ ngày"). */
  status_from: string;
  merged_into_code: string | null;
  created_at: Date;
  updated_at: Date;
  rev: number;
}

export interface JobTitleDoc extends CatalogBase {
  level: number;
  default_function_code: string;
  suggest_manager: boolean;
  description: string;
  order: number;
}

export interface JobFunctionDoc extends CatalogBase {
  description: string;
  order: number;
}

export interface LegalEntityDoc extends CatalogBase {
  short_name: string;
  tax_code: string;
  hq_address: string;
  email_domains: string[];
  employee_code_prefix: string | null;
  /** Every registered name with the day it took effect, oldest first; the last one is `name` (VH-ORG-07 bước 4). */
  name_history: { name: string; from_on: string }[];
}

export interface WorkLocationDoc extends CatalogBase {
  kind: WorkLocationKind;
  address: string;
  province: ProvinceCode;
  /** null: shared by every legal entity. */
  legal_entity_code: string | null;
}

export type CatalogDoc = JobTitleDoc | JobFunctionDoc | LegalEntityDoc | WorkLocationDoc;
