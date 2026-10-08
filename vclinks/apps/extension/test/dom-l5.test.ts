// @vitest-environment happy-dom
/**
 * L5 message kinds (M1c-08): location (msgType 17), call, reminder, plus video (msgType 18).
 * ALL fixtures here are SYNTHETIC (self-made, no customer data): Zalo's real markup for these kinds has not been
 * surveyed yet. They follow Zalo's `data-id` naming. Replace with real samples once the project owner sends them in
 * the test group (docs/04-ky-thuat/zalo-web/zalo-dom-selectors.md "Loại còn thiếu mẫu").
 */
import { DEFAULT_DOM_SELECTORS, DEFAULT_KNOWN_BUBBLES } from '@vclinks/shared';
import { describe, expect, it } from 'vitest';
import { detectCall, detectLocation, detectReminder } from '../src/dom-media';
import { extractOne, toContentItems } from '../src/dom-reader';

function bubble(cli: string, inner: string): Element {
  const root = document.createElement('div');
  root.innerHTML = `<div id="bb_msg_id_${cli}" class="chat-message"><div id="message-frame_${cli}">${inner}</div></div>`;
  return root.firstElementChild!;
}

const LOCATION = `
  <div data-id="div_ReceivedMsg_Location">
    <img src="https://map.example.test/static/thumb.png" />
    <div>Kho Test Hà Nội</div>
    <div>1 Phố Thử Nghiệm</div>
    <a href="https://maps.example.test/?q=21.0285,105.8542">Xem bản đồ</a>
  </div>`;
const LOCATION_ATTR = `<div data-id="div_SentMsg_Location" data-lat="10.7769" data-lng="106.7009"><div>Giao hàng tại đây</div></div>`;
const CALL_MISSED = `<div data-id="div_ReceivedMsg_Call"><span>Cuộc gọi nhỡ</span></div>`;
const CALL_ENDED = `<div data-id="div_SentMsg_Call"><span>Cuộc gọi video đi</span><span data-id="call_Duration">02:15</span></div>`;
const REMINDER = `<div data-id="div_ReceivedMsg_Reminder"><div>Hẹn giao lọc gió</div><div>09:00 05/10/2026</div></div>`;
const SELECTORS = {
  ...DEFAULT_DOM_SELECTORS,
  knownBubbles: { ...DEFAULT_KNOWN_BUBBLES, location: '[data-id$="Msg_Location"]', call: '[data-id$="Msg_Call"]', reminder: '[data-id$="Msg_Reminder"]' },
};

describe('location (synthetic fixture)', () => {
  it('reads title, address, map link and coordinates from the link; the map image is not a photo', () => {
    const m = extractOne(bubble('301', LOCATION))!;
    expect(m.kind).toBe('location');
    expect(m.location).toEqual({
      lat: 21.0285,
      lng: 105.8542,
      title: 'Kho Test Hà Nội',
      address: expect.stringContaining('1 Phố Thử Nghiệm'),
      url: 'https://maps.example.test/?q=21.0285,105.8542',
    });
    expect(m.images).toEqual([]);
    expect(m.links).toEqual([]);
  });
  it('coordinates from data attributes; no link', () => {
    expect(detectLocation(bubble('302', LOCATION_ATTR))).toMatchObject({ lat: 10.7769, lng: 106.7009, title: 'Giao hàng tại đây' });
  });
  it('drops out-of-range coordinates and non-https map links', () => {
    const b = bubble('303', `<div data-id="div_ReceivedMsg_Location"><div>Điểm</div><a href="http://m.example.test/?q=999,999">x</a></div>`);
    const loc = detectLocation(b)!;
    expect(loc.lat).toBeUndefined();
    expect(loc.url).toBeUndefined();
    expect(loc.title).toBe('Điểm');
  });
});

describe('call (synthetic fixture)', () => {
  it('missed call', () => {
    expect(detectCall(bubble('311', CALL_MISSED))).toEqual({ outcome: 'missed' });
    expect(extractOne(bubble('311', CALL_MISSED))!.kind).toBe('call');
  });
  it('ended video call with duration', () => {
    expect(detectCall(bubble('312', CALL_ENDED))).toEqual({ outcome: 'ended', video: true, durationSec: 135 });
  });
});

describe('reminder (synthetic fixture)', () => {
  it('title and time as written', () => {
    expect(detectReminder(bubble('321', REMINDER))).toEqual({ title: 'Hẹn giao lọc gió', when: '09:00 05/10/2026' });
    expect(extractOne(bubble('321', REMINDER))!.kind).toBe('reminder');
  });
});

describe('content items', () => {
  it('stored only once the structure is locked in knownBubbles; unsurveyed ones stay pending', () => {
    const el = bubble('331', LOCATION);
    const locked = toContentItems([extractOne(el, SELECTORS)!], 1790000000000);
    expect(locked).toHaveLength(1);
    expect(locked[0]).toMatchObject({ cliMsgId: '331', kind: 'location', location: { lat: 21.0285 } });
    // Default known bubbles do not include the guessed L5 anchors, so nothing is stored.
    expect(toContentItems([extractOne(el)!], 1790000000000)).toHaveLength(0);
  });
  it('call and reminder reach the payload', () => {
    const items = toContentItems([extractOne(bubble('332', CALL_MISSED), SELECTORS)!, extractOne(bubble('333', REMINDER), SELECTORS)!], 1790000000000);
    expect(items.map((i) => i.kind)).toEqual(['call', 'reminder']);
    expect(items[0].call).toEqual({ outcome: 'missed' });
    expect(items[1].reminder?.title).toBe('Hẹn giao lọc gió');
  });
});
