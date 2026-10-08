/** `people` and `positions` (05 mục 3.1, 3.3). The stored shape of a profile is checked by `PersonDocSchema` on insert. */
import type { EmployeeType, PersonStatus, PositionKind } from '@vc/contracts';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

export interface PrimaryCopy {
  position_id: ObjectId;
  unit_code: string;
  job_title_code: string;
  job_function_code: string;
  manager_person_id: ObjectId | null;
}

/**
 * Every field a profile may hold (04 VH-NSU-01 bảng trường, 05 mục 3.1). Strict: a field outside this list cannot be
 * stored, and none of them is in FORBIDDEN_PERSON_FIELDS (VH-BR-19, test VH-NSU-01 tiêu chí 6).
 */
export const PersonDocSchema = z
  .object({
    _id: z.instanceof(ObjectId),
    employee_code: z.string(),
    full_name: z.string(),
    name_folded: z.string(),
    nickname: z.string().nullable(),
    work_email: z.string().nullable(),
    secondary_email: z.string().nullable(),
    previous_emails: z.array(z.string()),
    photo: z.object({ url: z.string(), source: z.enum(['google', 'hcns', 'nhan_vien']), updated_at: z.date() }).nullable(),
    work_phone: z.string().nullable(),
    legal_entity_code: z.string(),
    employee_type: z.enum(['chinh_thuc', 'thu_viec', 'cong_tac_vien', 'thuc_tap']),
    work_location_code: z.string().nullable(),
    status: z.enum(['chua_vao_lam', 'dang_lam', 'nghi_dai_ngay', 'tam_khoa', 'da_nghi']),
    status_since_at: z.date(),
    joined_on: z.string(),
    left_on: z.string().nullable(),
    /** `khong_vao_lam`: never started (VH-NSU-01 bước 8). */
    left_reason: z.enum(['khong_vao_lam', 'nghi_viec']).nullable(),
    left_note: z.string().nullable(),
    leave: z.object({ from_on: z.string(), to_on: z.string().nullable(), lock_login: z.boolean() }).nullable(),
    suspension: z.object({ from_at: z.date(), reason_code: z.enum(['dinh_chi', 'cho_xu_ly', 'khac']), note: z.string() }).nullable(),
    primary: z
      .object({ position_id: z.instanceof(ObjectId), unit_code: z.string(), job_title_code: z.string(), job_function_code: z.string(), manager_person_id: z.instanceof(ObjectId).nullable() })
      .nullable(),
    is_manager: z.boolean(),
    head_of_unit_codes: z.array(z.string()),
    event_seq: z.number().int(),
    grant_event_seq: z.record(z.number().int()),
    anonymized_at: z.date().nullable(),
    created_at: z.date(),
    created_by: z.string().nullable(),
    updated_at: z.date(),
    rev: z.number().int(),
  })
  .strict();

export type PersonDoc = z.infer<typeof PersonDocSchema> & { status: PersonStatus; employee_type: EmployeeType };

export interface PositionDoc {
  _id: ObjectId;
  person_id: ObjectId;
  kind: PositionKind;
  unit_code: string;
  job_title_code: string;
  job_function_code: string;
  manager_person_id: ObjectId | null;
  start_on: string;
  end_on: string | null;
  start_at: Date;
  end_at: Date | null;
  active: boolean;
  end_reason: 'doi_vi_tri' | 'doi_quan_ly' | 'het_kiem_nhiem' | 'nghi_viec' | 'don_vi_ngung' | 'gop_don_vi' | 'huy_nham' | 'hoan_tac_lo' | null;
  replaced_by_position_id: ObjectId | null;
  scheduled_change_id: ObjectId | null;
  manager_missing: boolean;
  source: 'tay' | 'lo_nhap' | 'khoi_tao_tu_app';
  basis: string;
  note: string;
  created_at: Date;
  updated_at: Date;
  rev: number;
}
