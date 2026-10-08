import { describe, expect, it } from 'vitest';
import { erpCreateFormSchema, erpFormMissing, erpTaskCreateSchema, erpTaskListQuerySchema, erpTaskTab } from '../src';

describe('Việc VCsales (02 MH-DK-12)', () => {
  it('the create form takes empty fields as missing; MST only for garages and dealers', () => {
    expect(erpFormMissing({})).toEqual(['legalName', 'type', 'phone', 'deliveryAddress', 'taxCode']);
    const retail = erpCreateFormSchema.parse({ legalName: 'Phạm Thị Mai', type: 'Khách lẻ', phonePointId: 'p1', deliveryAddress: 'Hà Đông', taxCode: '' });
    expect(retail.taxCode).toBeNull();
    expect(erpFormMissing(retail)).toEqual([]);
    expect(erpFormMissing({ ...retail, type: 'Garage' })).toEqual(['taxCode']);
  });

  it('MST: spaces and dots dropped, 10 or 13 digits only', () => {
    expect(erpCreateFormSchema.parse({ taxCode: '0101 234.567' }).taxCode).toBe('0101234567');
    expect(erpCreateFormSchema.parse({ taxCode: '0101234567-001' }).taxCode).toBe('0101234567001');
    expect(erpCreateFormSchema.safeParse({ taxCode: '12345' }).success).toBe(false);
    expect(erpCreateFormSchema.safeParse({ legalName: 'x'.repeat(201) }).success).toBe(false);
  });

  it('kinds: one schema per kind, merge needs another code; tabs', () => {
    expect(erpTaskCreateSchema.safeParse({ kind: 'merge_codes', accountId: 'a', mainCode: 'K1', otherCodes: [] }).success).toBe(false);
    expect(erpTaskCreateSchema.safeParse({ kind: 'update_phone', accountId: 'a', pointId: 'p' }).success).toBe(true);
    expect(erpTaskCreateSchema.safeParse({ kind: 'change_owner', accountId: 'a', toUserId: 'u' }).success).toBe(false);
    expect(erpTaskTab('create_customer')).toBe('create');
    expect(erpTaskTab('merge_codes')).toBe('update');
  });

  it('list query flags: "0" is off, "1" is on', () => {
    expect(erpTaskListQuerySchema.parse({ tab: 'update', mine: '0', finished: '1' })).toEqual({ tab: 'update', mine: false, finished: true });
    expect(erpTaskListQuerySchema.parse({})).toEqual({ tab: 'create' });
  });
});
