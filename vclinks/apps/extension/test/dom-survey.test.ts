// @vitest-environment happy-dom
/**
 * Fixtures follow the structures surveyed on chat.zalo.me on 2026-09-28
 * (docs/04-ky-thuat/zalo-web/zalo-dom-selectors.md); text and URLs are replaced. The voice bubble is
 * a SYNTHETIC unsurveyed structure, standing in for any kind not locked yet.
 */
import { DEFAULT_DOM_SELECTORS } from '@vclinks/shared';
import { describe, expect, it } from 'vitest';
import { bubbleSignature, bubbleSkeleton, classifyBubble, surveyBubbles, unknownDriftKeys } from '../src/dom-survey';
import { extractMessages, extractOne, toContentItems } from '../src/dom-reader';

const wrap = (cli: string, inner: string) =>
  `<div id="bb_msg_id_${cli}" class="chat-message chat-message-v2 wrap-message"><div class="message-wrapper"><div class="message-content-wrapper"><div data-id="div_DisabledTargetEventLayer">${inner}</div></div></div></div>`;

const REAL_TEXT = `<div data-id="div_ReceivedMsg_Text" class="text-message__container">Chào anh, còn lọc gió không?</div><button data-id="btn_ReceivedMsg_React"></button>`;
const REAL_LAST_SENT = `<div data-id="div_LastSentMsg_Text" class="text-message__container">Còn anh ạ</div>`;
const REAL_PHOTO = `<div data-id="div_ReceivedMsg_Photo" class="chatImageMessage--audit img-msg-v2"><img class="zimg-el" src="https://f21-zpc.zdn.vn/jpg/1/a.jpg" /></div>`;
const REAL_GRP_PHOTO = `<div data-id="div_SentMsg_GrpPhoto" class="card--group-photo"><img class="zimg-el" src="https://f21-zpc.zdn.vn/jpg/1/b.jpg" /><img class="zimg-el" src="https://f21-zpc.zdn.vn/jpg/1/c.jpg" /></div>`;
const REAL_FILE = `
  <div class="file-message-v2 file-message__container"><div class="file-message__content-container">
    <div class="file-tit-box file-message-icon"></div>
    <div class="file-message__content">
      <div class="file-message__content-title" title="bao-gia.xlsx"><div class="truncate">bao-gia.xlsx</div></div>
      <div class="file-message__content-info-container">
        <span class="file-message__content-info-size" title="48 KB">48 KB</span>
        <div class="cloud-status"></div>
        <div class="file-message__content-actions"><a class="clickable file-message__actions download" title="Tải về" href="https://dl.zdn.vn/f/bao-gia.xlsx"></a></div>
      </div>
    </div>
  </div></div>`;
const REAL_LINK = `<div data-id="div_SentMsg_Link"><a href="https://vcparts.vn/p/1">vcparts.vn</a></div>`;
const REAL_RECALLED = ``;
// SYNTHETIC: stands in for any structure not surveyed yet.
const SYN_VOICE = `<div data-id="div_ReceivedMsg_Voice"><span>0:15</span></div>`;

function page(parts: [string, string][]): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = parts.map(([cli, inner]) => wrap(cli, inner)).join('');
  return root;
}

describe('classifyBubble (real structures)', () => {
  const one = (inner: string) => page([['1', inner]]).firstElementChild!;

  it('recognises every surveyed structure', () => {
    expect(classifyBubble(one(REAL_TEXT))).toBe('known:text');
    expect(classifyBubble(one(REAL_LAST_SENT))).toBe('known:text');
    expect(classifyBubble(one(REAL_PHOTO))).toBe('known:photo');
    expect(classifyBubble(one(REAL_GRP_PHOTO))).toBe('known:groupPhoto');
    expect(classifyBubble(one(REAL_FILE))).toBe('known:file');
    expect(classifyBubble(one(REAL_LINK))).toBe('known:link');
  });

  it('treats a bubble with only the layout layer as empty (recalled)', () => {
    expect(classifyBubble(one(REAL_RECALLED))).toBe('empty');
  });

  it('flags an unsurveyed structure as unknown', () => {
    expect(classifyBubble(one(SYN_VOICE))).toBe('unknown');
  });

  it('uses knownBubbles from the mapping, and survives a bad selector', () => {
    const el = one(SYN_VOICE);
    expect(classifyBubble(el, { knownBubbles: { bad: '[[[', voice: '[data-id$="Msg_Voice"]' } })).toBe('known:voice');
  });
});

describe('extraction honours the survey', () => {
  it('marks the newest own bubble (div_LastSentMsg_*) as outgoing', () => {
    const el = page([['1', REAL_LAST_SENT]]).firstElementChild!;
    expect(extractOne(el)?.direction).toBe('out');
  });

  it('reads the real file bubble', () => {
    const [m] = extractMessages(page([['1', REAL_FILE]]));
    expect(m.files).toEqual([{ name: 'bao-gia.xlsx', size: '48 KB', ext: 'xlsx', url: 'https://dl.zdn.vn/f/bao-gia.xlsx' }]);
  });

  it('never stores content of an unsurveyed structure (stays pending)', () => {
    const msgs = extractMessages(page([['1', REAL_TEXT], ['2', SYN_VOICE], ['3', REAL_GRP_PHOTO]]));
    expect(msgs.find((m) => m.cliMsgId === '2')?.structure).toBe('unknown');
    const items = toContentItems(msgs, 1);
    expect(items.map((i) => i.cliMsgId)).toEqual(['1', '3']);
    expect(items[1].images).toHaveLength(2);
  });
});

describe('surveyBubbles / drift keys', () => {
  it('groups unknown bubbles by direction-neutral signature', () => {
    const root = page([
      ['1', REAL_TEXT],
      ['2', SYN_VOICE],
      ['3', SYN_VOICE.replace('ReceivedMsg', 'SentMsg')],
      ['4', REAL_RECALLED],
    ]);
    const s = surveyBubbles(root, DEFAULT_DOM_SELECTORS);
    expect(s.counts).toEqual({ 'known:text': 1, unknown: 2, empty: 1 });
    expect(s.unknown).toHaveLength(1);
    expect(s.unknown[0].count).toBe(2);
    expect(s.unknown[0].signature).toContain('Msg_Voice');
  });

  it('skeleton and drift keys carry structure only, never text or attribute values', () => {
    const el = page([['1', REAL_FILE + SYN_VOICE]]).firstElementChild!;
    const sk = bubbleSkeleton(el).join('\n');
    expect(sk).toContain('file-message__content-info-size');
    expect(sk).toContain('[title]');
    expect(sk).not.toMatch(/bao-gia|48 KB|0:15|dl\.zdn\.vn/);
    const keys = unknownDriftKeys(surveyBubbles(page([['2', SYN_VOICE]]), DEFAULT_DOM_SELECTORS));
    expect(keys[0]).toMatch(/^sig\(x1\): /);
    expect(keys.join('\n')).not.toContain('0:15');
    expect(keys.every((k) => k.length <= 200)).toBe(true);
  });

  it('signature ignores message direction', () => {
    const a = page([['1', SYN_VOICE]]).firstElementChild!;
    const b = page([['1', SYN_VOICE.replace('ReceivedMsg', 'LastSentMsg')]]).firstElementChild!;
    expect(bubbleSignature(a)).toBe(bubbleSignature(b));
  });
});
