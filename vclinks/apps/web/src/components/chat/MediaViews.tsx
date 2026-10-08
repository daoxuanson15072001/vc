import { Image, Tooltip } from 'antd';
import {
  AudioOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FileZipOutlined,
  IdcardOutlined,
  LinkOutlined,
  LoadingOutlined,
  PlayCircleFilled,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from 'antd';
import { api, attachmentObjectUrl, mediaObjectUrl } from '../../api';
import type { AttachmentView, DownloadLink } from '@vclinks/shared';
import type { CardMedia, FileMedia, VideoMedia, VoiceMedia } from '../../types';
import { fileExt, fmtSize, safeUrl } from '../../utils/chat';
import { fmtDuration } from '../../utils/time';

export function ImageGrid({ images }: { images: string[] }) {
  const urls = images.map((u) => safeUrl(u)).filter((u): u is string => !!u);
  if (!urls.length) return null;
  const cols = urls.length === 1 ? 1 : urls.length === 2 || urls.length === 4 ? 2 : 3;
  return (
    <Image.PreviewGroup>
      <div
        className="media-grid"
        style={{ ['--cols' as string]: cols, ['--ratio' as string]: cols === 1 ? 'auto' : '1 / 1' } as CSSProperties}
      >
        {urls.map((u, i) => (
          <Image key={`${u}-${i}`} src={u} alt={`Ảnh ${i + 1}`} loading="lazy" fallback={BROKEN_IMG} />
        ))}
      </div>
    </Image.PreviewGroup>
  );
}

/** Photos stored by VClinks (uploaded from Zalo Web blob: URLs), loaded with the Dashboard token. */
export function MediaImageGrid({ ids }: { ids: string[] }) {
  const [urls, setUrls] = useState<(string | null)[] | null>(null);
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    void Promise.all(ids.map((id) => mediaObjectUrl(id))).then((u) => alive && setUrls(u));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!urls) {
    return (
      <div className="bubble__text" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
        Đang tải {ids.length > 1 ? `${ids.length} ảnh` : 'ảnh'}…
      </div>
    );
  }
  const ok = urls.filter((u): u is string => !!u);
  const failed = urls.length - ok.length;
  return (
    <>
      {ok.length ? <ImageGrid images={ok} /> : null}
      {failed ? (
        <div className="bubble__text" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
          {failed > 1 ? `${failed} ảnh` : 'Ảnh'} không tải được
        </div>
      ) : null}
    </>
  );
}

// Tiny gray placeholder for images that fail to load (expired Zalo CDN links).
const BROKEN_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="100%" height="100%" fill="#d0d7e1"/><text x="50%" y="52%" font-family="sans-serif" font-size="12" fill="#6b7a90" text-anchor="middle">Ảnh không tải được</text></svg>',
  );

export function LinkList({ links }: { links: string[] }) {
  const items = links.map((l) => ({ raw: l, url: safeUrl(l) }));
  if (!items.length) return null;
  return (
    <div className="link-list">
      {items.map(({ raw, url }, i) =>
        url ? (
          <a key={`${raw}-${i}`} href={url} target="_blank" rel="noopener noreferrer nofollow">
            <LinkOutlined />
            <span>{raw}</span>
          </a>
        ) : (
          <div key={`${raw}-${i}`}>
            <LinkOutlined /> {raw}
          </div>
        ),
      )}
    </div>
  );
}

function fileIcon(ext: string): { icon: ReactNode; color: string } {
  if (ext === 'pdf') return { icon: <FilePdfOutlined />, color: '#e5484d' };
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return { icon: <FileWordOutlined />, color: '#2b5fd9' };
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return { icon: <FileExcelOutlined />, color: '#12a150' };
  if (['ppt', 'pptx', 'odp'].includes(ext)) return { icon: <FilePptOutlined />, color: '#e8590c' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: <FileZipOutlined />, color: '#8e6c00' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp'].includes(ext)) return { icon: <FileImageOutlined />, color: '#7a5af8' };
  if (['txt', 'log', 'md', 'json', 'xml'].includes(ext)) return { icon: <FileTextOutlined />, color: '#667085' };
  return { icon: <FileOutlined />, color: '#667085' };
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);
const VIDEO_EXT = new Set(['mp4', 'm4v', 'webm', 'mov']);
const AUDIO_EXT = new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus']);

export type FileMediaKind = 'image' | 'video' | 'audio' | 'document';

/** How a file is shown: photos, videos and audio sent as files play in the chat (like Zalo, Messenger); the rest is a card. */
export function fileMediaKind(f: Pick<FileMedia, 'name' | 'ext'>): FileMediaKind {
  const e = fileExt(f.name, f.ext);
  if (IMAGE_EXT.has(e)) return 'image';
  if (VIDEO_EXT.has(e)) return 'video';
  if (AUDIO_EXT.has(e)) return 'audio';
  return 'document';
}

/** Saves a file under its own name: the company copy through a short-lived same-origin link, else the Zalo link. */
async function saveFile(name: string, attachment: AttachmentView | undefined, url: string | null): Promise<void> {
  if (attachment) {
    const l = await api<DownloadLink>(`/attachments/${encodeURIComponent(attachment.id)}/link`);
    const a = document.createElement('a');
    a.href = l.url;
    a.download = name || 'tep';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else if (url) {
    window.open(url, '_blank', 'noopener');
  }
}

/** Files the browser shows in its own viewer (the API serves them inline): a click reads them instead of saving. */
const VIEW_EXT = new Set(['pdf']);

/**
 * Opens a file in a new tab (PDF: the browser's built-in viewer). The tab opens at the click so no popup blocker
 * stops it; the short-lived link of the company copy follows.
 */
async function viewFile(attachment: AttachmentView | undefined, url: string | null): Promise<void> {
  const w = window.open('about:blank', '_blank');
  if (w) w.opener = null;
  try {
    const href = attachment ? (await api<DownloadLink>(`/attachments/${encodeURIComponent(attachment.id)}/link`)).url : url;
    if (!href) throw new Error('no link');
    const abs = new URL(href, window.location.origin).href;
    if (w) w.location.href = abs;
    else window.open(abs, '_blank', 'noopener');
  } catch {
    w?.close();
  }
}

interface FileProps {
  file: FileMedia;
  /** The copy in the company store, once kept (the Zalo link of the original expires). */
  attachment?: AttachmentView;
  /** The Zalo link (https), used until the copy is kept. */
  url: string | null;
}

function DownloadButton({ file, attachment, url }: FileProps) {
  const [busy, setBusy] = useState(false);
  if (!attachment && !url) return null;
  return (
    <Tooltip title={attachment ? 'Tải về (bản lưu trong kho công ty)' : 'Tải về từ Zalo (link có thể hết hạn)'}>
      <Button
        className="file-dl"
        type="text"
        size="small"
        shape="circle"
        icon={<DownloadOutlined />}
        loading={busy}
        aria-label={`Tải về ${file.name || 'tệp'}`}
        onClick={(e) => {
          e.stopPropagation();
          setBusy(true);
          void saveFile(file.name, attachment, url)
            .catch(() => undefined)
            .finally(() => setBusy(false));
        }}
      />
    </Tooltip>
  );
}

/** Name, size and download under a photo / video / audio sent as a file. */
function FileCaption(props: FileProps) {
  const size = fmtSize(props.file.size ?? props.attachment?.size);
  return (
    <figcaption className="file-media__caption">
      <span className="file-media__name" title={props.file.name}>
        {props.file.name || 'Tệp đính kèm'}
      </span>
      {size && <span className="file-media__size">{size}</span>}
      <DownloadButton {...props} />
    </figcaption>
  );
}

/** A photo sent as a file: the picture itself (click to zoom), from the company copy once kept. */
function FileImage(props: FileProps) {
  const { file, attachment, url } = props;
  const [src, setSrc] = useState<string | null>(attachment ? null : url);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!attachment) {
      setSrc(url);
      return;
    }
    let alive = true;
    void attachmentObjectUrl(attachment.id).then((u) => {
      if (!alive) return;
      if (u || url) setSrc(u ?? url);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [attachment, url]);
  const missing = !attachment && !url;
  return (
    <figure className="file-media">
      {src && !failed ? (
        <Image src={src} alt={file.name || 'Ảnh'} rootClassName="file-media__image" fallback={BROKEN_IMG} />
      ) : (
        <div className="file-media__placeholder">{missing ? 'Ảnh chưa có tệp' : failed ? 'Ảnh không tải được' : 'Đang tải ảnh…'}</div>
      )}
      <FileCaption {...props} />
    </figure>
  );
}

/** A video sent as a file: played in the chat (the signed link of the company copy is renewed once if it expired). */
function FileVideo(props: FileProps) {
  const { attachment, url } = props;
  const [link, renew] = useAttachmentLink(attachment?.id, !!attachment);
  const src = attachment ? link : url;
  const retried = useRef(false);
  const [failed, setFailed] = useState(false);
  return (
    <figure className="file-media">
      {src && !failed ? (
        <video
          className="file-media__video"
          controls
          preload="metadata"
          playsInline
          src={src}
          onError={() => {
            if (attachment && !retried.current) {
              retried.current = true;
              renew();
            } else setFailed(true);
          }}
        />
      ) : (
        <div className="file-media__placeholder">
          {failed ? 'Trình duyệt chưa phát được video này, hãy tải về để xem' : attachment || url ? 'Đang tải video…' : 'Video chưa có tệp'}
        </div>
      )}
      <FileCaption {...props} />
    </figure>
  );
}

/** An audio file: a player in the chat. */
function FileAudio(props: FileProps) {
  const { attachment, url } = props;
  const [link] = useAttachmentLink(attachment?.id, !!attachment);
  const src = attachment ? link : url;
  return (
    <figure className="file-media file-media--audio">
      {src ? <audio controls preload="none" src={src} /> : <div className="file-media__line">{attachment || url ? 'Đang tải…' : 'Chưa có tệp'}</div>}
      <FileCaption {...props} />
    </figure>
  );
}

/**
 * Any other file: a card with its type, name and size. A PDF opens to read in a new tab (download button beside it,
 * like Slack / Teams); other documents download on click (Word / Excel would need an outside viewer: never).
 */
function FileDocument(props: FileProps) {
  const { file, attachment, url } = props;
  const ext = fileExt(file.name, file.ext);
  const { icon, color } = fileIcon(ext);
  const size = fmtSize(file.size ?? attachment?.size);
  const can = !!attachment || !!url;
  const viewable = can && VIEW_EXT.has(ext);
  const [busy, setBusy] = useState(false);
  const act = () => {
    if (!can || busy) return;
    if (viewable) {
      void viewFile(attachment, url);
      return;
    }
    setBusy(true);
    void saveFile(file.name, attachment, url)
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };
  const where = attachment ? 'bản lưu trong kho công ty' : 'link Zalo, có thể hết hạn';
  return (
    <div
      className={`file-card${can ? ' file-card--action' : ''}`}
      role={can ? 'button' : undefined}
      tabIndex={can ? 0 : undefined}
      aria-label={can ? `${viewable ? 'Xem' : 'Tải về'} ${file.name || 'tệp'}` : undefined}
      title={can ? `Bấm để ${viewable ? 'xem' : 'tải về'} (${where})` : undefined}
      onClick={act}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          act();
        }
      }}
    >
      <span className="file-card__icon" style={{ color }}>
        {icon}
      </span>
      <div className="file-card__body">
        <div className="file-card__name" title={file.name}>
          {file.name || 'Tệp đính kèm'}
        </div>
        <div className="file-card__size">
          {[ext.toUpperCase(), size].filter(Boolean).join(' · ') || 'Tệp'}
          {!can && ' · chưa có tệp'}
          {viewable && <span className="file-card__hint"> · Bấm để xem</span>}
        </div>
      </div>
      {viewable ? <DownloadButton {...props} /> : can && <span className="file-card__dl">{busy ? <LoadingOutlined /> : <DownloadOutlined />}</span>}
    </div>
  );
}

/**
 * Files of a message. Photos, videos and audio show inline like Zalo shows them; `compact` (lists such as the
 * conversation's file tab) keeps every file as a card.
 */
export function FileCards({ files, attachments, compact }: { files: FileMedia[]; attachments?: AttachmentView[]; compact?: boolean }) {
  if (!files.length) return null;
  return (
    <>
      {files.map((f, i) => {
        const props: FileProps = {
          file: f,
          attachment: attachments?.find((a) => a.kind === 'file' && a.status === 'stored' && a.id.endsWith(`#file:${i}`)),
          url: safeUrl(f.url) ?? null,
        };
        const kind = compact ? 'document' : fileMediaKind(f);
        if (kind === 'image') return <FileImage key={i} {...props} />;
        if (kind === 'video') return <FileVideo key={i} {...props} />;
        if (kind === 'audio') return <FileAudio key={i} {...props} />;
        return <FileDocument key={i} {...props} />;
      })}
    </>
  );
}

/** Playback speeds of a voice note (D36). */
export const VOICE_SPEEDS = [1, 1.5, 2] as const;

/**
 * Short-lived signed link of a stored attachment (for `<audio>` / `<video>` that cannot send the token).
 * `renew()` asks for a fresh one, e.g. when a player is started after the link expired.
 */
function useAttachmentLink(id: string | undefined, enabled: boolean): [string | null, () => void] {
  const [url, setUrl] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!id || !enabled) return;
    let alive = true;
    void api<DownloadLink>(`/attachments/${encodeURIComponent(id)}/link`)
      .then((l) => alive && setUrl(l.url))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [id, enabled, round]);
  return [url, () => setRound((r) => r + 1)];
}

/**
 * Voice note: player from the company store when kept (the Zalo link expires), speed 1x / 1.5x / 2x,
 * transcript below ("Đang chuyển chữ…", failure with "Thử lại"). KD-20, D36.
 */
export function VoiceView({ voice, attachment, onRetried }: { voice: VoiceMedia; attachment?: AttachmentView; onRetried?: () => void }) {
  const stored = attachment?.status === 'stored';
  const [link] = useAttachmentLink(attachment?.id, stored);
  const url = stored ? (link ?? undefined) : safeUrl(voice.url);
  const dur = fmtDuration(voice.durationSec);
  const [speed, setSpeed] = useState<number>(1);
  const [retrying, setRetrying] = useState(false);
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [speed, url]);
  const tr = attachment?.transcript;
  return (
    <div className="voice-box">
      {url ? (
        <>
          <audio ref={ref} controls preload="none" src={url} onPlay={() => ref.current && (ref.current.playbackRate = speed)} />
          <div className="voice-speed" role="group" aria-label="Tốc độ phát">
            {VOICE_SPEEDS.map((x) => (
              <button key={x} type="button" className={x === speed ? 'voice-speed__btn is-on' : 'voice-speed__btn'} onClick={() => setSpeed(x)}>
                {x}x
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--muted)' }}>
          <AudioOutlined /> Ghi âm{dur ? ` ${dur}` : ''} {stored ? '— đang tải' : attachment?.status === 'expired' ? '— link Zalo đã hết hạn, không có tệp' : '— chưa có tệp'}
        </div>
      )}
      {stored && tr ? (
        <div className="voice-transcript" data-status={tr.status}>
          {tr.status === 'queued' || tr.status === 'running' ? (
            <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Đang chuyển chữ…</span>
          ) : tr.status === 'failed' ? (
            <>
              <span style={{ color: 'var(--muted)' }}>Chưa chuyển được thành chữ. </span>
              <Button
                size="small"
                type="link"
                loading={retrying}
                onClick={() => {
                  setRetrying(true);
                  void api(`/attachments/${encodeURIComponent(attachment!.id)}/transcribe`, { method: 'POST' })
                    .then(() => onRetried?.())
                    .finally(() => setRetrying(false));
                }}
              >
                Thử lại
              </Button>
            </>
          ) : tr.text ? (
            <span>{tr.text}</span>
          ) : (
            <span style={{ color: 'var(--muted)' }}>Không nhận ra lời nói trong ghi âm.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Photos kept in the company store (the Zalo links of the original expire). */
export function StoredImageGrid({ ids }: { ids: string[] }) {
  const [urls, setUrls] = useState<(string | null)[] | null>(null);
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    void Promise.all(ids.map((id) => attachmentObjectUrl(id))).then((u) => alive && setUrls(u));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!urls) return <div className="bubble__text" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Đang tải ảnh…</div>;
  return <ImageGrid images={urls.filter((u): u is string => !!u)} />;
}

export function VideoView({ video, attachment }: { video: VideoMedia; attachment?: AttachmentView }) {
  const stored = attachment?.status === 'stored';
  const [link, renew] = useAttachmentLink(attachment?.id, stored);
  const retried = useRef(false);
  const url = stored ? (link ?? undefined) : safeUrl(video.url);
  const thumb = safeUrl(video.thumb);
  const dur = fmtDuration(video.durationSec);
  if (url) {
    return (
      <div className="video-box">
        <video
          controls
          preload="metadata"
          playsInline
          src={url}
          poster={thumb}
          onError={() => {
            // The signed link lives 10 minutes: get a fresh one once when playback starts later.
            if (stored && !retried.current) {
              retried.current = true;
              renew();
            }
          }}
        />
      </div>
    );
  }
  return (
    <div>
      <div className="video-thumb" aria-label="Video">
        {thumb && <img src={thumb} alt="" loading="lazy" />}
        <PlayCircleFilled className="video-thumb__play" />
        {dur && <span className="video-thumb__dur">{dur}</span>}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
        <VideoCameraOutlined /> Video — chưa có tệp
      </div>
    </div>
  );
}

export function ContactCard({ card }: { card: CardMedia }) {
  const url = safeUrl(card.url);
  const title = card.title || card.userId || 'Danh thiếp';
  const body = (
    <div className="file-card">
      <span className="file-card__icon" style={{ color: '#0068ff' }}>
        <IdcardOutlined />
      </span>
      <div className="file-card__body">
        <div className="file-card__name">{title}</div>
        <div className="file-card__size">Danh thiếp{card.userId && card.title ? ` · ${card.userId}` : ''}</div>
      </div>
    </div>
  );
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'inherit' }}>
      {body}
    </a>
  ) : (
    body
  );
}
