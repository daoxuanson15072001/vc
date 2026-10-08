import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OutboxAttachment, OutboxItem } from '@vclinks/shared';
import { api } from '../../api';

/** Payload of one outbox command (see packages/shared/src/outbox.ts). */
export type OutboxCommand =
  | { action: 'send_images'; attachments: string[] }
  | { action: 'send_file'; attachments: string[] }
  | { action: 'send_card'; card: { name: string; userId?: string; withPhone?: boolean } }
  | { action: 'send_sticker'; sticker: { set: string; index: number; thumbUrl?: string; id?: number; cateId?: number; type?: number } }
  | { action: 'create_poll'; poll: { question: string; options: string[] } }
  | { action: 'react'; reaction: { cliMsgId: string; icon: string } }
  | { action: 'pin_conversation'; pin: boolean }
  | { action: 'mark_read' }
  | { action: 'mark_unread' }
  | { action?: undefined; text: string; mentions: { name: string; uid?: string }[] };

export interface Participant {
  uid: string;
  name: string;
  messages: number;
}

const MAX_BYTES = 10 * 1024 * 1024;

/** Reads a File as base64 (no data: prefix). */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error ?? new Error('Không đọc được tệp'));
    r.readAsDataURL(file);
  });
}

/** Uploads one file for an outbox command; the API keeps it in GridFS. */
export async function uploadAttachment(file: File): Promise<OutboxAttachment> {
  if (file.size > MAX_BYTES) throw new Error(`"${file.name}" lớn hơn 10 MB`);
  return api<OutboxAttachment>('/outbox/attachments', {
    method: 'POST',
    body: { fileName: file.name, mime: file.type || 'application/octet-stream', dataBase64: await toBase64(file) },
  });
}

/** Creates an approved outbox command for a thread (the click is the approval). */
export function useOutboxCommand(uid: string, threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cmd: OutboxCommand) => api<OutboxItem>('/outbox', { method: 'POST', body: { uid, threadId, ...cmd } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outbox', uid, threadId] }),
  });
}

/** People who wrote in the conversation (suggestions for @mentions / name cards). */
export function useParticipants(conversationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['participants', conversationId],
    queryFn: () => api<Participant[]>(`/conversations/${encodeURIComponent(conversationId)}/participants`),
    enabled,
    staleTime: 60_000,
  });
}

/** `@Name` mentions still present in the text (the user may have deleted some). */
export function mentionsInText(text: string, picked: { name: string; uid?: string }[]) {
  const seen = new Set<string>();
  return picked.filter((m) => {
    if (seen.has(m.name) || !text.includes(`@${m.name}`)) return false;
    seen.add(m.name);
    return true;
  });
}
