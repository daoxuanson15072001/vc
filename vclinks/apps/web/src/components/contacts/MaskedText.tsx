import { useEffect, useState } from 'react';
import { App, Button } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { splitMaskedText } from '@vclinks/shared';
import { api } from '../../api';
import { REVEAL_SECONDS } from './MaskedContact';

/** One masked number / email inside a message: "Hiện" shows it for 60 s (logged, never with the value). */
function MaskedPart({ shown, messageId, index, revealable, where }: { shown: string; messageId: string; index: number; revealable: boolean; where: string }) {
  const { message } = App.useApp();
  const [full, setFull] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const reveal = useMutation({
    mutationFn: () => api<{ value: string; warning?: string }>('/reveal/message', { method: 'POST', body: { messageId, index, where } }),
  });
  useEffect(() => {
    if (!full) return;
    setLeft(REVEAL_SECONDS);
    const t = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [full]);
  useEffect(() => {
    if (full && left <= 0) setFull(null);
  }, [full, left]);

  if (full) return <span style={{ whiteSpace: 'nowrap' }}>{full} <span style={{ color: 'var(--muted)', fontSize: 12 }}>còn {left} giây</span></span>;
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {shown}
      {revealable && (
        <Button
          type="link"
          size="small"
          loading={reveal.isPending}
          style={{ padding: '0 4px' }}
          onClick={() =>
            reveal.mutate(undefined, {
              onSuccess: (r) => {
                setFull(r.value);
                if (r.warning) message.warning(r.warning);
              },
              onError: (e) => message.error((e as Error).message),
            })
          }
        >
          Hiện
        </Button>
      )}
    </span>
  );
}

/** Message text whose phones / emails the API masked (L-02): each one gets its own "Hiện" when the viewer may reveal. */
export default function MaskedText({ text, count, messageId, revealable, where }: { text: string; count: number; messageId: string; revealable: boolean; where: string }) {
  return (
    <>
      {splitMaskedText(text, count).map((p, i) =>
        p.maskIndex === undefined ? <span key={i}>{p.text}</span> : <MaskedPart key={i} shown={p.text} messageId={messageId} index={p.maskIndex} revealable={revealable} where={where} />,
      )}
    </>
  );
}
