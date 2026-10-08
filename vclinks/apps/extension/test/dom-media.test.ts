// @vitest-environment happy-dom
/**
 * Two kinds of fixtures. `REAL_*` follow structures surveyed on chat.zalo.me
 * (2026-09-28: photo, photo album, file, link, recalled; text/URLs replaced).
 * The others are SYNTHETIC guesses following Zalo's `data-id` naming, kept
 * for kinds not surveyed yet (voice, video, sticker, business card) and for
 * the fallbacks. Replace them with real samples when captured.
 */
import { DEFAULT_DOM_SELECTORS } from '@vclinks/shared';
import { describe, expect, it } from 'vitest';
import {
  MEDIA_SELECTORS,
  detectBlobImages,
  detectImages,
  detectCard,
  detectFiles,
  detectVideo,
  detectVoice,
  diagnoseBubble,
  parseDuration,
  safeUrl,
} from '../src/dom-media';
import { checkDomHealth, extractMessages, extractOne, toContentItems } from '../src/dom-reader';

function bubble(cli: string, inner: string): Element {
  const root = document.createElement('div');
  root.innerHTML = `<div id="bb_msg_id_${cli}" class="chat-message"><div id="message-frame_${cli}">${inner}</div></div>`;
  return root.firstElementChild!;
}

// ---- synthetic fixtures, one per kind ----
const PHOTO = `
  <div data-id="div_ReceivedMsg_Photo">
    <img src="https://zalo.me/avatar/u1.jpg" />
    <img src="https://f21-zpc.zdn.vn/jpg/123/photo-large.jpg" />
  </div>
  <div data-id="div_ReceivedMsg_Text">Ảnh lọc gió</div>
  <span class="send-time">14:42</span>`;

const VOICE_NOT_PLAYED = `
  <div data-id="div_SentMsg_Voice">
    <div class="voice-wave"></div>
    <span data-id="txt_Voice_Duration">0:15</span>
  </div>
  <span data-id="txt_Msg_Time">09:05</span>`;

const VOICE_PLAYED = `
  <div data-id="div_ReceivedMsg_Voice">
    <audio src="https://voice-aac.zdn.vn/abc/voice.aac"></audio>
    <span>1:02</span>
  </div>`;

const VOICE_BLOB = `
  <div data-id="div_ReceivedMsg_Voice"><audio src="blob:https://chat.zalo.me/xyz"></audio><span>0:07</span></div>`;

const FILE = `
  <div data-id="div_ReceivedMsg_File">
    <img src="https://stc-zaloprofile.zdn.vn/pc/v1/images/icon_pdf.png" />
    <div data-id="txt_File_Name">bao-gia-loc-gio-VC.pdf</div>
    <div class="file-info">12.3 MB</div>
    <a download="bao-gia-loc-gio-VC.pdf" href="https://dl.zdn.vn/f/abc/bao-gia-loc-gio-VC.pdf">Tải về</a>
  </div>`;

const FILE_TAG_ONLY = `
  <div class="some-new-class">
    <a download href="https://dl.zdn.vn/f/x/so-lieu.xlsx" title="so-lieu.xlsx">so-lieu.xlsx</a>
    <span>850 KB</span>
  </div>`;

const VIDEO = `
  <div data-id="div_SentMsg_Video">
    <video poster="https://f21-zpc.zdn.vn/jpg/thumb.jpg"><source src="https://video.zdn.vn/v/clip.mp4" /></video>
    <span class="video-duration">0:42</span>
  </div>`;

const VIDEO_BLOB = `
  <div data-id="div_ReceivedMsg_Video">
    <video src="blob:https://chat.zalo.me/v1"></video>
    <img src="https://f21-zpc.zdn.vn/jpg/thumb2.jpg" />
  </div>`;

const CARD = `
  <div data-id="div_ReceivedMsg_Card" data-uid="123456789012">
    <img src="https://s120-ava-talk.zadn.vn/a/b/avatar.jpg" />
    <div class="card-title">Anh Minh Gara Hải Phòng</div>
    <a href="https://zalo.me/123456789012">Nhắn tin</a>
  </div>`;

const WEB_PREVIEW = `
  <div data-id="div_SentMsg_WebContent">
    <div data-id="txt_Preview_Title">Lọc gió Toyota Vios chính hãng</div>
    <a href="https://vcparts.vn/p/loc-gio-vios">vcparts.vn</a>
  </div>`;

const STICKER = `<div data-id="div_ReceivedMsg_Sticker"><img src="https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=1" /></div>`;

// ---- REAL structures (surveyed on chat.zalo.me 2026-09-28; text/URLs replaced) ----
const REAL_PHOTO = `
  <div class="message-wrapper"><div class="message-content-wrapper"><div data-id="div_DisabledTargetEventLayer">
    <div data-id="div_ReceivedMsg_Photo" class="chatImageMessage--audit img-msg-v2">
      <img class="zimg-el" src="https://f21-zpc.zdn.vn/jpg/1/real-photo.jpg" />
    </div>
    <div data-id="div_ReceivedMsg_React"><img src="https://stc.zdn.vn/icon/like.png" /></div>
  </div></div></div>`;

const REAL_GROUP_PHOTO = `
  <div data-id="div_DisabledTargetEventLayer">
    <div data-id="div_SentMsg_GrpPhoto" class="card--group-photo">
      <img class="zimg-el" src="https://f21-zpc.zdn.vn/jpg/1/a.jpg" />
      <img class="zimg-el" src="https://f21-zpc.zdn.vn/jpg/1/b.jpg" />
      <img class="zimg-el" src="https://f21-zpc.zdn.vn/jpg/1/c.jpg" />
    </div>
  </div>`;

const REAL_FILE = `
  <div data-id="div_DisabledTargetEventLayer">
    <div class="file-message-v2 file-message__container">
      <div class="file-message__content-container">
        <div class="file-tit-box file-message-icon"><img src="https://stc.zdn.vn/icon/xlsx.png" /></div>
        <div class="file-message__content">
          <div class="file-message__content-title" title="ton-kho-T9.xlsx"><div class="truncate">ton-kho-T9.xlsx</div></div>
          <div class="file-message__content-info-container">
            <span class="file-message__content-info-size" title="1.2 MB">1.2 MB</span>
            <div class="cloud-status">Đã có trên Cloud</div>
            <div class="file-message__content-actions">
              <a class="clickable file-message__actions download" title="Tải về" href="https://dl.zdn.vn/f/1/ton-kho-T9.xlsx"></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

const REAL_LINK = `
  <div data-id="div_DisabledTargetEventLayer">
    <div data-id="div_SentMsg_Link">
      <a href="https://vcparts.vn/p/loc-gio">Lọc gió chính hãng</a>
    </div>
  </div>`;

const REAL_RECALLED = `<div data-id="div_DisabledTargetEventLayer"></div>`;

const PROFILE_TRAP = `<div data-id="div_ReceivedMsg_Text">Xin chào</div><div data-id="div_Profile_Box"></div>`;

describe('detectors (synthetic fixtures)', () => {
  it('image: keeps the photo, skips avatar, kind=image even with a caption', () => {
    const m = extractOne(bubble('1', PHOTO))!;
    expect(m.images).toEqual(['https://f21-zpc.zdn.vn/jpg/123/photo-large.jpg']);
    expect(m.text).toBe('Ảnh lọc gió');
    expect(m.kind).toBe('image');
  });

  it('voice before Play: no URL, duration from the explicit node, message clock ignored', () => {
    const m = extractOne(bubble('2', VOICE_NOT_PLAYED))!;
    expect(m.voice).toEqual({ durationSec: 15 });
    expect(m.kind).toBe('voice');
    expect(m.direction).toBe('out');
  });

  it('voice after Play: https URL and duration', () => {
    expect(detectVoice(bubble('3', VOICE_PLAYED))).toEqual({ url: 'https://voice-aac.zdn.vn/abc/voice.aac', durationSec: 62 });
  });

  it('voice with a blob: URL drops the URL but keeps the voice', () => {
    expect(detectVoice(bubble('4', VOICE_BLOB))).toEqual({ durationSec: 7 });
  });

  it('file: name, size, ext, download URL; file icon is not an image and URL is not a link', () => {
    const m = extractOne(bubble('5', FILE))!;
    expect(m.files).toEqual([
      { name: 'bao-gia-loc-gio-VC.pdf', size: '12.3 MB', ext: 'pdf', url: 'https://dl.zdn.vn/f/abc/bao-gia-loc-gio-VC.pdf' },
    ]);
    expect(m.images).toEqual([]);
    expect(m.links).toEqual([]);
    expect(m.kind).toBe('file');
  });

  it('file: falls back to <a download> when no data-id anchor exists', () => {
    expect(detectFiles(bubble('6', FILE_TAG_ONLY))).toEqual([
      { name: 'so-lieu.xlsx', size: '850 KB', ext: 'xlsx', url: 'https://dl.zdn.vn/f/x/so-lieu.xlsx' },
    ]);
  });

  it('video: source URL, poster thumbnail, duration; thumbnail not counted as image', () => {
    const m = extractOne(bubble('7', VIDEO))!;
    expect(m.video).toEqual({ url: 'https://video.zdn.vn/v/clip.mp4', thumb: 'https://f21-zpc.zdn.vn/jpg/thumb.jpg', durationSec: 42 });
    expect(m.images).toEqual([]);
    expect(m.kind).toBe('video');
  });

  it('video with blob: src keeps only the thumbnail', () => {
    expect(detectVideo(bubble('8', VIDEO_BLOB))).toEqual({ thumb: 'https://f21-zpc.zdn.vn/jpg/thumb2.jpg' });
  });

  it('card: title, userId from data attribute, profile URL', () => {
    const m = extractOne(bubble('9', CARD))!;
    expect(m.card).toEqual({ title: 'Anh Minh Gara Hải Phòng', url: 'https://zalo.me/123456789012', userId: '123456789012' });
    expect(m.images).toEqual([]); // card avatar is not a message image
    expect(m.kind).toBe('card');
  });

  it('web content preview (msgType 52) becomes a card with title + url', () => {
    const b = bubble('10', WEB_PREVIEW);
    expect(detectCard(b)).toEqual({ title: 'Lọc gió Toyota Vios chính hãng', url: 'https://vcparts.vn/p/loc-gio-vios' });
    expect(extractOne(b)!.links).toEqual(['https://vcparts.vn/p/loc-gio-vios']);
  });

  it('sticker: kind=sticker and no content, so it is not sent', () => {
    const m = extractOne(bubble('11', STICKER))!;
    expect(m.kind).toBe('sticker');
    expect(m.images).toEqual([]);
    expect(toContentItems([m], 1)).toEqual([]);
  });

  it('data-id tokens: "Profile" never matches the File detector', () => {
    const m = extractOne(bubble('12', PROFILE_TRAP))!;
    expect(m.files).toEqual([]);
    expect(m.kind).toBe('text');
  });

  it('drops dangerous URL schemes everywhere', () => {
    const b = bubble('13', `
      <div data-id="div_ReceivedMsg_Text">x</div>
      <img src="data:image/png;base64,AAAA" />
      <a href="javascript:alert(1)">bad</a>
      <a href="http://insecure.example">http</a>`);
    const m = extractOne(b)!;
    expect(m.images).toEqual([]);
    // Typed links are content: http: is kept, javascript: is dropped.
    expect(m.links).toEqual(['http://insecure.example']);
  });

  it('a throwing detector does not hide the others', () => {
    const broken = { ...MEDIA_SELECTORS, file: { ...MEDIA_SELECTORS.file, anchors: ':::not-css' } };
    const m = extractOne(bubble('14', FILE + VOICE_PLAYED), undefined, broken as never)!;
    expect(m.voice?.url).toBe('https://voice-aac.zdn.vn/abc/voice.aac');
    expect(m.files?.length).toBe(1); // tag fallback still finds the file
  });
});

describe('detectors (real structures, 2026-09-28)', () => {
  it('single photo: only img.zimg-el, react icon ignored', () => {
    const m = extractOne(bubble('r1', REAL_PHOTO))!;
    expect(m.images).toEqual(['https://f21-zpc.zdn.vn/jpg/1/real-photo.jpg']);
    expect(m.kind).toBe('image');
  });

  it('photo album: every img.zimg-el', () => {
    const m = extractOne(bubble('r2', REAL_GROUP_PHOTO))!;
    expect(m.images).toHaveLength(3);
    expect(m.kind).toBe('image');
  });

  it('file: name, size and download link from locked classes; icon not an image', () => {
    const m = extractOne(bubble('r3', REAL_FILE))!;
    expect(m.files).toEqual([
      { name: 'ton-kho-T9.xlsx', size: '1.2 MB', ext: 'xlsx', url: 'https://dl.zdn.vn/f/1/ton-kho-T9.xlsx' },
    ]);
    expect(m.images).toEqual([]);
    expect(m.links).toEqual([]);
    expect(m.kind).toBe('file');
  });

  it('link bubble: text, link and card', () => {
    const m = extractOne(bubble('r4', REAL_LINK))!;
    expect(m.text).toBe('Lọc gió chính hãng');
    expect(m.links).toEqual(['https://vcparts.vn/p/loc-gio']);
    expect(m.card).toMatchObject({ title: 'Lọc gió chính hãng', url: 'https://vcparts.vn/p/loc-gio' });
  });

  it('recalled bubble carries no content (placeholder comes from msgType 20)', () => {
    expect(toContentItems([extractOne(bubble('r5', REAL_RECALLED))!], 1)).toEqual([]);
  });
});

describe('toContentItems with media', () => {
  it('sends a voice without URL (partial) and all media fields with kind', () => {
    const root = document.createElement('div');
    root.innerHTML = [
      ['21', VOICE_NOT_PLAYED],
      ['22', FILE],
      ['23', VIDEO],
      ['24', CARD],
    ]
      .map(([c, h]) => `<div id="bb_msg_id_${c}">${h}</div>`)
      .join('');
    // Synthetic kinds are unsurveyed; lock them via the mapping as a real survey would.
    const locked = { ...DEFAULT_DOM_SELECTORS, knownBubbles: { any: '*' } };
    const items = toContentItems(extractMessages(root, locked), 1790000000000);
    expect(items.map((i) => [i.cliMsgId, i.kind])).toEqual([
      ['21', 'voice'],
      ['22', 'file'],
      ['23', 'video'],
      ['24', 'card'],
    ]);
    expect(items[0].voice).toEqual({ durationSec: 15 });
    expect(items[0].text).toBeUndefined();
    expect(items[1].files?.[0].name).toBe('bao-gia-loc-gio-VC.pdf');
  });

  it('health check does not flag drift on a screen of media-only bubbles', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div anim-data-id="1"><div data-id="div_ThrdChItem_Title">A</div></div>' +
      [1, 2, 3, 4, 5].map((i) => `<div id="bb_msg_id_${i}">${VOICE_NOT_PLAYED}</div>`).join('');
    expect(checkDomHealth(root).broken).toEqual([]);
  });
});

describe('helpers', () => {
  it('parseDuration', () => {
    expect(parseDuration('0:15')).toBe(15);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('12"')).toBe(12);
    expect(parseDuration('12.3 MB')).toBeUndefined();
  });

  it('safeUrl keeps https only', () => {
    expect(safeUrl('https://a.b/c')).toBe('https://a.b/c');
    expect(safeUrl('blob:https://a.b/c')).toBeUndefined();
    expect(safeUrl('http://a.b')).toBeUndefined();
    expect(safeUrl('/relative')).toBeUndefined();
  });

  it('diagnoseBubble returns data-ids and media tags, never text', () => {
    const d = diagnoseBubble(bubble('30', FILE + '<div data-id="div_ReceivedMsg_Text">bí mật</div>'));
    expect(d.dataIds).toEqual(['div_ReceivedMsg_File', 'div_ReceivedMsg_Text', 'txt_File_Name']);
    expect(d.mediaTags).toEqual(['a[download]', 'a[href]', 'img']);
    expect(JSON.stringify(d)).not.toContain('bí mật');
  });
});

describe('photos vs UI images (real structure, 2026-09-28)', () => {
  const bubble = (inner: string) => {
    const el = document.createElement('div');
    el.id = 'bb_msg_id_1';
    el.className = 'chat-message';
    el.innerHTML = `${inner}
      <div data-id="btn_ReceivedMsg_React"><img src="https://res-zalo.zadn.vn/upload/media/2019/1/25/iconlike_1548389696575_103596.png"></div>`;
    return el;
  };
  const skip = new RegExp(DEFAULT_DOM_SELECTORS.imageSkip, 'i');

  it('never reports the reaction (like) icon as a message image', () => {
    const el = bubble('<div data-id="div_ReceivedMsg_Text"><span>xk bán</span></div>');
    expect(detectImages(el, skip)).toEqual([]);
    expect(detectBlobImages(el, skip)).toEqual([]);
  });

  it('separates https photos (kept as URLs) from blob: photos (to be uploaded)', () => {
    const el = bubble(`
      <div data-id="div_ReceivedMsg_GrpPhoto" class="card--group-photo">
        <img class="zimg-el" src="blob:https://chat.zalo.me/59d00d58-5d5e-4bb2-b4ab-cf45fd0ada11">
        <img class="zimg-el" src="blob:https://chat.zalo.me/773a4b02-1e16-476a-81ed-2bc160c1dc22">
        <img class="zimg-el" src="https://f1.zadn.vn/photo/1.jpg">
      </div>`);
    expect(detectImages(el, skip)).toEqual(['https://f1.zadn.vn/photo/1.jpg']);
    expect(detectBlobImages(el, skip)).toEqual([
      'blob:https://chat.zalo.me/59d00d58-5d5e-4bb2-b4ab-cf45fd0ada11',
      'blob:https://chat.zalo.me/773a4b02-1e16-476a-81ed-2bc160c1dc22',
    ]);
  });
});
