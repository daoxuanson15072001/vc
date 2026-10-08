import { describe, expect, it } from 'vitest';
import { mentionsInText } from './commands';

describe('mentionsInText', () => {
  it('keeps picked mentions still written in the text, once each', () => {
    const picked = [
      { name: 'A.A vợ', uid: '1' },
      { name: 'Vcparts Tú', uid: '2' },
      { name: 'A.A vợ', uid: '1' },
    ];
    expect(mentionsInText('Chào @A.A vợ nhé', picked)).toEqual([{ name: 'A.A vợ', uid: '1' }]);
    expect(mentionsInText('Chào cả nhà', picked)).toEqual([]);
  });
});
