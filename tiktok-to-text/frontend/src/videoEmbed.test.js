import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canEmbed, embedSrc, parseTime, parseVideoUrl, segmentAt, sourceVideo, thumbnailOf, watchUrl } from './videoEmbed.js'

const yt = (url, extra) => parseVideoUrl(url, extra)

test('YouTube: các dạng link -> id, dọc với shorts', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
    'youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ?feature=shared',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  ]) {
    const v = yt(url)
    assert.equal(v.platform, 'youtube', url)
    assert.equal(v.id, 'dQw4w9WgXcQ', url)
    assert.equal(v.vertical, false, url)
  }
  const s = yt('https://www.youtube.com/shorts/dQw4w9WgXcQ')
  assert.equal(s.id, 'dQw4w9WgXcQ')
  assert.equal(s.vertical, true)
})

test('YouTube: thời điểm t= / start= và playlist', () => {
  assert.equal(yt('https://youtu.be/dQw4w9WgXcQ?t=90').start, 90)
  assert.equal(yt('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s').start, 65)
  assert.equal(yt('https://www.youtube.com/embed/dQw4w9WgXcQ?start=42').start, 42)
  assert.equal(parseTime('1h2m3s'), 3723)
  assert.equal(parseTime('abc'), 0)
  const p = yt('https://www.youtube.com/playlist?list=PLabc_123-x')
  assert.deepEqual([p.id, p.list], [null, 'PLabc_123-x'])
  assert.ok(canEmbed(p))
  assert.match(embedSrc(p), /embed\/videoseries\?list=PLabc_123-x/)
  const both = yt('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx')
  assert.deepEqual([both.id, both.list], ['dQw4w9WgXcQ', 'PLx'])
})

test('YouTube: link kênh không nhúng được, id lấy từ key khi link lạ', () => {
  assert.equal(yt('https://www.youtube.com/@kenh'), null)
  assert.equal(yt('https://www.youtube.com/watch?v=short'), null)
  assert.equal(yt('https://example.com/watch?v=dQw4w9WgXcQ'), null)
  assert.equal(yt('not a url at all'), null)
  assert.equal(yt(null), null)
})

test('TikTok: /@user/video/<id>, /v/<id>.html, embed, player; link rút gọn dùng key', () => {
  const id = '7234567890123456789'
  for (const url of [
    `https://www.tiktok.com/@kenh.abc/video/${id}?is_from_webapp=1`,
    `https://m.tiktok.com/v/${id}.html`,
    `https://www.tiktok.com/embed/v2/${id}`,
    `https://www.tiktok.com/embed/${id}`,
    `https://www.tiktok.com/player/v1/${id}`,
  ]) {
    const v = yt(url)
    assert.equal(v.platform, 'tiktok', url)
    assert.equal(v.id, id, url)
    assert.equal(v.vertical, true)
  }
  const short = yt('https://vt.tiktok.com/ZSabc123/')
  assert.equal(short.platform, 'tiktok')
  assert.equal(short.id, null)
  assert.ok(!canEmbed(short))
  assert.equal(yt('https://vm.tiktok.com/ZSabc123/', { key: id }).id, id)
  assert.equal(yt('https://vt.tiktok.com/ZSabc123/', { meta: { video_id: id } }).id, id)
  assert.equal(yt('https://vt.tiktok.com/ZSabc123/', { key: 'khong-phai-so' }).id, null)
  assert.ok(!canEmbed(yt('https://www.tiktok.com/@kenh')))   // link kênh: nhận nền tảng, không có video để nhúng
  assert.equal(watchUrl(yt(`https://www.tiktok.com/@a/video/${id}`)), null)   // TikTok: dùng link gốc của tài liệu
  assert.equal(embedSrc(yt(`https://www.tiktok.com/@a/video/${id}`)).startsWith(`https://www.tiktok.com/player/v1/${id}?`), true)
})

test('ảnh bìa, link mở tại giây, câu đang phát', () => {
  const v = yt('https://youtu.be/dQw4w9WgXcQ')
  assert.equal(thumbnailOf(v), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  assert.equal(watchUrl(v, 75.6), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=75s')
  assert.equal(thumbnailOf(yt('https://www.tiktok.com/@a/video/7234567890123456789')), null)
  assert.equal(thumbnailOf(yt('https://www.tiktok.com/@a/video/7234567890123456789'), { thumbnail: 'x.jpg' }), 'x.jpg')
  const segs = [{ start: 0 }, { start: 2.5 }, { start: 5 }]
  assert.deepEqual([segmentAt(segs, 0), segmentAt(segs, 2.4), segmentAt(segs, 2.5), segmentAt(segs, 99)], [0, 0, 1, 2])
  assert.equal(segmentAt([{ start: 3 }], 1), -1)
})

test('nguồn một video: nhúng ở đầu; kênh / playlist thì không', () => {
  const id = '7234567890123456789'
  const doc = { id: 'd1', key: id, meta: { video_id: id } }
  assert.equal(sourceVideo(`https://www.tiktok.com/@a/video/${id}`, [doc]).doc, doc)
  assert.equal(sourceVideo('https://vt.tiktok.com/ZSabc/', [doc]).video.id, id)
  assert.equal(sourceVideo('https://vt.tiktok.com/ZSabc/', []), null)
  assert.equal(sourceVideo('https://www.tiktok.com/@kenh', [doc]), null)        // kênh: không đoán id từ tài liệu
  assert.equal(sourceVideo('https://www.youtube.com/playlist?list=PLx', [doc]), null)
  const y = sourceVideo('https://youtu.be/dQw4w9WgXcQ?t=30', [{ id: 'x', key: 'dQw4w9WgXcQ' }])
  assert.deepEqual([y.video.id, y.video.start, y.doc.id], ['dQw4w9WgXcQ', 30, 'x'])
})
