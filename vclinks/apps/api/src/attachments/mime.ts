/**
 * Mime of a stored file by its name, for sources that send a generic type: Zalo's file CDN answers
 * `application/octet-stream` for photos and videos sent as files, which the browser then neither shows nor plays.
 * Served with `X-Content-Type-Options: nosniff`, so a wrong extension never makes the browser run the bytes as a page.
 */
const EXT_MIME: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  pdf: 'application/pdf',
};

const GENERIC = /^(application\/(octet-stream|x-download|force-download|binary|unknown)|binary\/octet-stream)$/i;

/**
 * Types a browser may show in a tab: photos, audio, video, and PDF in the browser's own viewer (since 06/10/2026, dev002:
 * quotes and invoices open to read at once; the viewer runs isolated from the page). Everything else downloads.
 */
const INLINE_MIME = /^(image\/(jpeg|png|webp|gif)|audio\/[\w.+-]+|video\/(mp4|webm)|application\/pdf)$/;

export const isInlineMime = (mime: string) => INLINE_MIME.test(mime);

/** Content-Disposition of a served file: shown in the tab or downloaded, always under its own name. */
export function contentDisposition(mime: string, fileName: string | undefined): string {
  return `${isInlineMime(mime) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(fileName || 'tep')}`;
}

/** The stored type when it is specific; otherwise the type of the file extension; otherwise what was given. */
export function effectiveMime(mime: string | null | undefined, fileName?: string | null): string | null {
  const m = mime?.split(';')[0]?.trim() || null;
  if (m && !GENERIC.test(m)) return m;
  const ext = /\.([a-z0-9]{1,8})$/i.exec(fileName ?? '')?.[1]?.toLowerCase();
  return (ext && EXT_MIME[ext]) || m;
}
