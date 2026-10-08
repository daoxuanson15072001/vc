import { useEffect, useState } from 'react';
import { App, Button, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { maskEmail } from '@vclinks/shared';
import { api } from '../../api';
import { formatPhone } from './PhoneText';

/** Seconds a revealed number stays on screen (MH-PQ-12 #3). */
export const REVEAL_SECONDS = 60;

/** Phone fields as the API returns them (phone-mask.interceptor): `phone` is already masked unless allowed in full. */
export interface PhoneFields {
  phone?: string | null;
  phoneMasked?: boolean;
  phoneRevealable?: boolean;
}

/**
 * Shared phone display (MH-PQ-12). The API sends the masked form (`0900 *** 201`) unless the viewer may see
 * it always; "Hiện" calls POST /api/reveal (logged, never in the log text), shows the number for 60 s with a
 * countdown, "Sao chép" copies it. A viewer who may not reveal gets no button.
 */
export function MaskedPhone({ contact, uid, userId, where, allowCopy }: { contact: PhoneFields; uid: string; userId: string; where?: string; allowCopy?: boolean }) {
  const { message } = App.useApp();
  const [full, setFull] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const reveal = useMutation({
    mutationFn: (action: 'view' | 'copy') => api<{ phone: string | null; warning?: string }>('/reveal', { method: 'POST', body: { field: 'phone', uid, userId, where, action } }),
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

  if (!contact.phone) return <Typography.Text type="secondary">Chưa có SĐT</Typography.Text>;
  if (!contact.phoneMasked) return <span style={{ whiteSpace: 'nowrap' }}>{formatPhone(contact.phone)}</span>;

  if (full) {
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        {formatPhone(full)}{' '}
        <Typography.Text copyable={{ text: full, onCopy: () => message.success('Đã sao chép.') }} />
        <Typography.Text type="secondary"> còn {left} giây</Typography.Text>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Lượt xem này đã được ghi nhật ký.
          </Typography.Text>
        </div>
      </span>
    );
  }
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {contact.phone}
      {contact.phoneRevealable && (
        <>
          <Button
            type="link"
            size="small"
            loading={reveal.isPending}
            onClick={() =>
              reveal.mutate('view', {
                onSuccess: (r) => {
                  setFull(r.phone);
                  // Too many reveals in an hour: the managers were told, the person gets this notice (UAT-PQ-28).
                  if (r.warning) message.warning(r.warning);
                },
                onError: (e) => message.error((e as Error).message),
              })
            }
          >
            Hiện
          </Button>
          {allowCopy && (
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              aria-label="Sao chép số"
              onClick={() =>
                reveal.mutate('copy', {
                  // Copy without showing the number (MH-PQ-12 #7); the audit line has action `copy`.
                  onSuccess: (r) => {
                    void navigator.clipboard?.writeText(r.phone ?? '');
                    message.success('Đã sao chép số.');
                  },
                  onError: (e) => message.error((e as Error).message),
                })
              }
            />
          )}
        </>
      )}
    </span>
  );
}

/** Email shown as `ga***@example.vn` (MH-PQ-12). Customer emails have no API field yet: the API sends them masked when they do. */
export function MaskedEmail({ email }: { email: string | null | undefined }) {
  if (!email) return <Typography.Text type="secondary">Chưa có email</Typography.Text>;
  return <span>{email.includes('***') ? email : maskEmail(email)}</span>;
}
