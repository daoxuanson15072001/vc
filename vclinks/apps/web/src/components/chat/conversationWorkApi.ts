import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationLabel, ConversationNote, ConversationPerson, LabelColor } from '@vclinks/shared';
import { api } from '../../api';

/*
 * Work on a conversation (apps/api conversation-work.*): handler (claim / assign / transfer / release),
 * internal notes, VClinks labels.
 */
const base = (id: string) => `/conversations/${encodeURIComponent(id)}`;

/** Refreshes what shows the handler / labels: the list, the counters, the open conversation and its notes. */
function useRefresh(id: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['conversations'] });
    void qc.invalidateQueries({ queryKey: ['inbox-summary'] });
    void qc.invalidateQueries({ queryKey: ['conversation', id] });
    void qc.invalidateQueries({ queryKey: ['conversation-notes', id] });
  };
}

export function useNotes(id: string, enabled = true) {
  return useQuery({
    queryKey: ['conversation-notes', id],
    queryFn: () => api<ConversationNote[]>(`${base(id)}/notes`),
    enabled,
    refetchInterval: 15_000,
    retry: false,
  });
}

/** People who see the conversation (assign / transfer picker, @ list of notes). */
export function usePeople(id: string, enabled: boolean) {
  return useQuery({ queryKey: ['conversation-people', id], queryFn: () => api<ConversationPerson[]>(`${base(id)}/people`), enabled, staleTime: 60_000, retry: false });
}

export function useHandlerActions(id: string) {
  const refresh = useRefresh(id);
  const post = (path: string, body?: unknown) => api(`${base(id)}/${path}`, { method: 'POST', body: body ?? {} });
  return {
    claim: useMutation({ mutationFn: () => post('claim'), onSuccess: refresh }),
    assign: useMutation({ mutationFn: (v: { userId: string; reason?: string }) => post('assign', v), onSuccess: refresh }),
    transfer: useMutation({ mutationFn: (v: { userId: string; reason: string }) => post('transfer', v), onSuccess: refresh }),
    release: useMutation({ mutationFn: () => post('release'), onSuccess: refresh }),
  };
}

export function useNoteActions(id: string) {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['conversation-notes', id] });
  return {
    add: useMutation({ mutationFn: (v: { text: string; mentions: string[] }) => api<ConversationNote>(`${base(id)}/notes`, { method: 'POST', body: v }), onSuccess: refresh }),
    edit: useMutation({ mutationFn: (v: { noteId: string; text: string }) => api<ConversationNote>(`${base(id)}/notes/${encodeURIComponent(v.noteId)}`, { method: 'PATCH', body: { text: v.text } }), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (noteId: string) => api(`${base(id)}/notes/${encodeURIComponent(noteId)}`, { method: 'DELETE' }), onSuccess: refresh }),
  };
}

export function useLabelCatalog(enabled = true) {
  return useQuery({ queryKey: ['conversation-labels'], queryFn: () => api<ConversationLabel[]>('/conversation-labels'), enabled, staleTime: 60_000, retry: false });
}

export function useLabelActions(id: string) {
  const qc = useQueryClient();
  const refresh = useRefresh(id);
  return {
    set: useMutation({ mutationFn: (labelIds: string[]) => api<ConversationLabel[]>(`${base(id)}/labels`, { method: 'PUT', body: { labelIds } }), onSuccess: refresh }),
    create: useMutation({
      mutationFn: (v: { name: string; color: LabelColor }) => api<ConversationLabel>('/conversation-labels', { method: 'POST', body: v }),
      onSuccess: () => void qc.invalidateQueries({ queryKey: ['conversation-labels'] }),
    }),
  };
}
