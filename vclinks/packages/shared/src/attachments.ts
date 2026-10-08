import { z } from 'zod';
import { uidSchema } from './schemas';

/**
 * Company file store and voice-to-text (M1c-04, BA 5.3 C4/C5/C10/C11, D19, D36).
 * `attachments` rows point at bytes kept in the company store (GridFS `media`, id = sha256);
 * `transcripts` hold the text of voice notes. Files and transcripts are personal data (CLAUDE.md §12).
 */
export const ATTACHMENT_KINDS = ['image', 'file', 'audio', 'video'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

/** Per-kind size cap in bytes (the API buffers one file in memory). */
export const ATTACHMENT_MAX_BYTES: Record<AttachmentKind, number> = {
  image: 20 * 1024 * 1024,
  file: 50 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  video: 64 * 1024 * 1024,
};

/** Upload URLs from `create_upload_url` expire after 15 minutes (CLAUDE.md §4.3). */
export const UPLOAD_URL_TTL_SEC = 15 * 60;
/** Download links handed to the browser (`<audio>` / `<video>` cannot send a header) are short-lived. */
export const DOWNLOAD_LINK_TTL_SEC = 10 * 60;

/** pending: still to be downloaded from the (expiring) Zalo link; uploaded: bytes received, checksum not confirmed; stored: in the company store. */
export const ATTACHMENT_STATUSES = ['awaiting_upload', 'uploaded', 'pending', 'stored', 'expired', 'failed'] as const;
export type AttachmentStatus = (typeof ATTACHMENT_STATUSES)[number];

export const TRANSCRIPT_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
export type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];

export const ASR_MODES = ['mock', 'live'] as const;
export type AsrMode = (typeof ASR_MODES)[number];

/** Prefix of the message text once a voice note is transcribed (CLAUDE.md §5). */
export const VOICE_TEXT_PREFIX = '[Ghi âm] ';

export const createUploadUrlSchema = z.object({
  uid: uidSchema,
  messageId: z.string().min(1).max(300),
  fileName: z.string().min(1).max(255),
  mime: z.string().min(3).max(120),
  size: z.number().int().positive().max(64 * 1024 * 1024),
});
export type CreateUploadUrlInput = z.infer<typeof createUploadUrlSchema>;

export const confirmUploadSchema = z.object({
  uploadId: z.string().min(8).max(200),
  /** sha256 (hex) of the bytes the caller sent; checked against what the store received. */
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export interface UploadUrlResult {
  uploadId: string;
  /** Path (relative to the API origin) to PUT the raw bytes to; valid until `expiresAt`. */
  url: string;
  expiresAt: string;
}

export const asrResultSchema = z.object({
  text: z.string().max(100_000),
  lang: z.string().max(10).default('vi'),
  model: z.string().max(100),
  durationSec: z.number().nonnegative().max(86_400).optional(),
});
export type AsrResultInput = z.infer<typeof asrResultSchema>;

export const asrFailSchema = z.object({ error: z.string().max(300) });

/** One job handed to the ASR worker. */
export interface AsrJobView {
  jobId: string;
  attachmentId: string;
  mime: string;
  size: number;
  /** Path (relative to the API origin) to GET the audio bytes with the worker token. */
  audioPath: string;
}

export interface TranscriptView {
  status: TranscriptStatus;
  /** Only when `status = done`. */
  text?: string;
  model?: string;
}

export interface AttachmentView {
  id: string;
  kind: AttachmentKind;
  status: AttachmentStatus;
  fileName?: string;
  mime?: string;
  size?: number;
  /** Voice notes only. */
  transcript?: TranscriptView;
}

export interface DownloadLink {
  url: string;
  expiresAt: string;
}
