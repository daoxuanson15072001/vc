import { describe, expect, it } from 'vitest';
import { classifyContext, classifyPart, detectSensitivity, maxSensitivity, stripC3 } from '../src';

describe('sensitivity (M1b-14)', () => {
  it('detects C3 topic words next to an amount', () => {
    for (const t of [
      'Công nợ hiện tại của anh là 12.500.000đ',
      'han muc tin dung 50 trieu',
      'Gara mình được giá riêng 850k cho má phanh',
      'Dư nợ quá hạn: 3,2 tr',
      'chiết khấu riêng 15%',
    ]) {
      expect(detectSensitivity(t)).toBe('C3');
    }
  });

  it('keeps ordinary chat at C2', () => {
    for (const t of ['Má phanh Vios giá bao nhiêu em?', 'anh còn nợ không em', 'Giá 850.000 đ anh ạ', '']) {
      expect(detectSensitivity(t)).toBe('C2');
    }
  });

  it('never lowers a declared level', () => {
    expect(classifyPart({ kind: 'sale', text: 'trong hạn', level: 'C3' })).toBe('C3');
    expect(classifyPart({ kind: 'wiki', text: 'Quy trình bảo hành', level: 'C0' })).toBe('C1');
    expect(classifyContext([{ kind: 'message', text: 'chào' }, { kind: 'playbook', text: 'xưng anh' }])).toBe('C2');
    expect(maxSensitivity([])).toBe('C0');
  });

  it('stripC3 drops declared and detected C3 items', () => {
    const items = [
      { id: 1, text: 'chào anh' },
      { id: 2, text: 'x', level: 'C3' as const },
      { id: 3, text: 'công nợ 5.000.000 đ' },
    ];
    expect(stripC3(items).map((i) => i.id)).toEqual([1]);
  });
});
