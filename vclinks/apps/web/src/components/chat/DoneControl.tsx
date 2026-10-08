import { useEffect, useState } from 'react';
import { App, Button, Dropdown } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CONVERSATION_OUTCOMES, CONVERSATION_OUTCOME_LABELS, type ConversationOutcome } from '@vclinks/shared';
import { api } from '../../api';
import type { ChatConversation } from '../../types';

const enc = encodeURIComponent;
type Done = NonNullable<ChatConversation['done']>;

/** Typing in a field never triggers the single-key shortcut. */
function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/**
 * Work state of the open conversation (plan B2 "Xong"): the server value, overridden at once by the user's own
 * close / reopen so the header does not wait for the list to refresh.
 */
export function useDone(conversationId: string, fromServer: ChatConversation['done']) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [done, setDone] = useState<Done | null>(fromServer ?? null);
  // Follow refreshes (e.g. reopened on the server by a new customer message).
  useEffect(() => setDone(fromServer ?? null), [fromServer?.at, fromServer]);

  const refresh = () => {
    for (const queryKey of [['conversations'], ['inbox-summary'], ['conversation', conversationId]]) void qc.invalidateQueries({ queryKey });
  };
  const close = useMutation({
    mutationFn: (outcome: ConversationOutcome) => api(`/conversations/${enc(conversationId)}/done`, { method: 'POST', body: { outcome } }),
    onSuccess: (_, outcome) => {
      setDone({ at: new Date().toISOString(), byName: null, outcome });
      message.success('Đã chuyển sang Đã xong. Khách nhắn tiếp, hội thoại tự mở lại.');
      refresh();
    },
    onError: (e) => message.error((e as Error).message),
  });
  const reopen = useMutation({
    mutationFn: () => api(`/conversations/${enc(conversationId)}/reopen`, { method: 'POST', body: {} }),
    onSuccess: () => {
      setDone(null);
      refresh();
    },
    onError: (e) => message.error((e as Error).message),
  });
  return { done, close, reopen };
}

/** "Đã xong · Hỏi giá" chip of the header meta line. */
export function DoneChip({ done }: { done: Done }) {
  return (
    <span className="soft-chip soft-chip--ok" title={done.byName ? `Đóng bởi ${done.byName}` : undefined}>
      Đã xong{done.outcome ? ` · ${CONVERSATION_OUTCOME_LABELS[done.outcome]}` : ''}
    </span>
  );
}

/** Header action: "Xong" with the one-tap outcome menu (E opens it), or "Mở lại" once closed. */
export default function DoneControl({ state, enabled }: { state: ReturnType<typeof useDone>; enabled: boolean }) {
  const { done, close, reopen } = state;
  const [open, setOpen] = useState(false);

  // E: the "Xong" menu (plan B2 shortcuts).
  useEffect(() => {
    if (!enabled || done) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, done]);

  if (!enabled) return null;
  if (done) {
    return (
      <Button onClick={() => reopen.mutate()} loading={reopen.isPending}>
        Mở lại
      </Button>
    );
  }
  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      menu={{
        items: [{ type: 'group', label: 'Kết quả của hội thoại', children: CONVERSATION_OUTCOMES.map((o) => ({ key: o, label: CONVERSATION_OUTCOME_LABELS[o] })) }],
        onClick: ({ key }) => {
          setOpen(false);
          close.mutate(key as ConversationOutcome);
        },
      }}
    >
      {/* Native title, not a Tooltip: a Tooltip between Dropdown and Button swallows the click. */}
      <Button type="primary" icon={<CheckOutlined />} loading={close.isPending} aria-label="Xong" title="Xong việc với khách này (phím E)">
        <span className="btn-label">Xong</span>
      </Button>
    </Dropdown>
  );
}
