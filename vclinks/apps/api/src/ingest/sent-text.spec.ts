import { sentLines, sentTextByCliMsgId } from './sent-text';

describe('sentTextByCliMsgId', () => {
  it('maps a single-line send to its cliMsgId', () => {
    expect([...sentTextByCliMsgId({ finalText: '  Dạ em chào anh \n', cliMsgId: 'c1' })]).toEqual([['c1', 'Dạ em chào anh']]);
  });

  it('maps each non-empty line of a multi-line send to cliMsgIds in order', () => {
    const m = sentTextByCliMsgId({ finalText: 'Dòng 1\n\nDòng 2\r\nDòng 3', cliMsgId: 'c3', cliMsgIds: ['c1', 'c2', 'c3'] });
    expect([...m]).toEqual([
      ['c1', 'Dòng 1'],
      ['c2', 'Dòng 2'],
      ['c3', 'Dòng 3'],
    ]);
  });

  it('falls back to the last line when only the last cliMsgId is known', () => {
    expect([...sentTextByCliMsgId({ finalText: 'a\nb', cliMsgId: 'c2' })]).toEqual([['c2', 'b']]);
    // cliMsgIds that do not match the line count are not trusted.
    expect([...sentTextByCliMsgId({ finalText: 'a\nb', cliMsgId: 'c2', cliMsgIds: ['c2'] })]).toEqual([['c2', 'b']]);
  });

  it('returns nothing without text or ids', () => {
    expect(sentTextByCliMsgId({ finalText: '  \n ', cliMsgId: 'c1' }).size).toBe(0);
    expect(sentTextByCliMsgId({ finalText: 'x' }).size).toBe(0);
    expect(sentLines('x​\n y')).toEqual(['x', 'y']);
  });
});
