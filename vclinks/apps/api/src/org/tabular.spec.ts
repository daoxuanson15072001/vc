import { parentTypeMessage, roleUnitMessage } from '@vclinks/shared';
import { parseCsv, parseVnDate } from './tabular';

describe('tabular helpers', () => {
  it('parses quotes, BOM, CRLF and a semicolon delimiter', () => {
    expect(parseCsv('﻿a;b\r\n"x;1";"he said ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'he said "hi"'],
    ]);
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('reads dd/MM/yyyy as midnight Vietnam time and rejects impossible dates', () => {
    expect(parseVnDate('05/10/2026')?.toISOString()).toBe('2026-10-04T17:00:00.000Z');
    expect(parseVnDate('31/02/2026')).toBeNull();
    expect(parseVnDate('2026-10-05')).toBeNull();
  });

  it('builds the spec sentences', () => {
    expect(parentTypeMessage('to_ban_hang')).toBe('Tổ bán hàng chỉ đặt dưới Division hoặc Tổ bán hàng.');
    expect(parentTypeMessage('nhom_cskh')).toBe('Nhóm CSKH chỉ đặt dưới Division.');
    expect(roleUnitMessage('nvkd')).toBe('Vai trò NVKD phải đặt ở Tổ bán hàng.');
  });
});
