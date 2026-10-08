import { useEffect, useState, type ReactNode } from 'react';
import { App, Button, Tag, Tooltip } from 'antd';
import { BulbOutlined, InfoCircleOutlined, WarningFilled } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiRiskWarning, type AiDraftSource, type AiDraftView } from '@vclinks/shared';
import { api } from '../../api';

/*
 * "Nháp AI" inside the composer (00 MH-UI composer #2b, #3, #3a; 03 MH-SZ-05 #16; KD-10, SZ-19).
 * "Dùng nháp" only puts the text in the input box: the user edits it and presses "Gửi" like any message
 * (BR07, §12.1). There is no send button here and this hook never calls the outbox.
 */
interface Options {
  conversationId: string;
  /** Puts the draft in the composer (replacing its text). */
  onUse: (text: string, draftId: string) => void;
  disabled?: boolean;
  /** False when the user has no `ai.draft` right or cannot reply here: nothing is fetched or shown. */
  enabled: boolean;
}

const enc = encodeURIComponent;
const keyOf = (conversationId: string) => ['ai-draft', conversationId];

function sourceLabel(s: AiDraftSource): string {
  if (s.type === 'vcsale' && s.at) {
    const t = new Date(s.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    return `${s.label} · ${t}`;
  }
  if (s.type === 'vcwiki') return `VCwiki: ${s.label}`;
  return s.label;
}

/**
 * The AI draft of a conversation as two pieces for the composer: `button` for its tool bar ("Nháp AI",
 * Alt+A) and `panel`, the strip above the input (draft, summary, risk or "no draft" reason).
 */
export function useAiDraft({ conversationId, onUse, disabled, enabled }: Options): { button: ReactNode; panel: ReactNode } {
  const { message } = App.useApp();
  const qc = useQueryClient();
  // Draft asked for in this view (its "no draft" reason is worth showing) and the one the user hid.
  const [fresh, setFresh] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  const latest = useQuery({
    queryKey: keyOf(conversationId),
    queryFn: () => api<AiDraftView | null>(`/conversations/${enc(conversationId)}/ai-draft`),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
  const generate = useMutation({
    mutationFn: (id: string) => api<AiDraftView>(`/conversations/${enc(id)}/ai-draft`, { method: 'POST' }),
    onSuccess: (d, id) => {
      qc.setQueryData(keyOf(id), d);
      setFresh(d.id);
      setHidden(null);
    },
    onError: (e) => message.error((e as Error).message || 'Không soạn được nháp'),
  });
  const reject = useMutation({
    mutationFn: (draftId: string) => api<AiDraftView>(`/conversations/${enc(conversationId)}/ai-draft/${draftId}/reject`, { method: 'POST', body: {} }),
    onSuccess: (d) => qc.setQueryData(keyOf(conversationId), d),
    onError: (e) => message.error((e as Error).message),
  });
  // No ai.draft right on this conversation (or no access): nothing to show.
  const active = enabled && !latest.isError;

  // Alt+A: "Nháp AI".
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyA' && !disabled && !generate.isPending) {
        e.preventDefault();
        generate.mutate(conversationId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, disabled, generate, conversationId]);

  if (!active) return { button: null, panel: null };

  const d = latest.data;
  const hide = d ? (
    <Button size="small" type="text" onClick={() => setHidden(d.id)}>
      Ẩn
    </Button>
  ) : null;
  const button = (
    <Tooltip title="AI soạn nháp từ 30 tin gần nhất, VCwiki và VCsales (Alt+A). Nháp chỉ chèn vào ô soạn, bạn tự sửa và bấm Gửi.">
      <Button type="text" icon={<BulbOutlined />} loading={generate.isPending} disabled={disabled} onClick={() => generate.mutate(conversationId)} className="ai-draft-btn">
        {d?.status === 'pending' ? 'Soạn lại' : 'Nháp AI'}
      </Button>
    </Tooltip>
  );

  let panel: ReactNode = null;
  if (!d || hidden === d.id) {
    // nothing to show
  } else if (d.status === 'risk') {
    panel = (
      <div className="ai-strip ai-strip--warn" aria-live="polite">
        <WarningFilled className="ai-strip__icon" aria-hidden />
        <div className="ai-strip__body">{aiRiskWarning(d.riskFlags)}</div>
      </div>
    );
  } else if ((d.status === 'blocked' || d.status === 'failed' || d.status === 'ignored') && d.id === fresh) {
    // An old failure is not repeated on every visit: only the answer to the user's own click.
    panel = (
      <div className="ai-strip" aria-live="polite">
        <InfoCircleOutlined className="ai-strip__icon" aria-hidden />
        <div className="ai-strip__body">{d.reason ?? 'Không có nháp AI cho hội thoại này.'}</div>
        <div className="ai-strip__actions">{hide}</div>
      </div>
    );
  } else if (d.status === 'pending' || d.status === 'summary') {
    panel = (
      <div className="ai-strip" aria-live="polite">
        <BulbOutlined className="ai-strip__icon" aria-hidden />
        <div className="ai-strip__body">
          <div className="ai-strip__text">
            <b>{d.status === 'pending' ? 'Nháp AI:' : 'Tóm tắt:'}</b> {d.status === 'pending' ? d.draft : d.summary}
          </div>
          {(d.mode === 'mock' || d.sources.length > 0) && (
            <div className="ai-strip__sources">
              {d.mode === 'mock' && <Tag bordered={false}>Nháp mẫu, chưa bật AI thật</Tag>}
              {d.sources.map((s, i) => (
                <Tag key={i} bordered={false}>
                  {sourceLabel(s)}
                </Tag>
              ))}
            </div>
          )}
        </div>
        {d.status === 'summary' && <div className="ai-strip__actions">{hide}</div>}
        {d.status === 'pending' && (
          <div className="ai-strip__actions">
            <Tooltip title="Chỉ chèn vào ô soạn, không tự gửi">
              <Button size="small" disabled={disabled} onClick={() => onUse(d.draft ?? '', d.id)}>
                Dùng nháp
              </Button>
            </Tooltip>
            <Button size="small" type="text" loading={reject.isPending} onClick={() => reject.mutate(d.id)}>
              Bỏ
            </Button>
          </div>
        )}
      </div>
    );
  }
  return { button, panel };
}
