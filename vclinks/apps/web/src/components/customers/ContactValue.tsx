import { useEffect, useState } from 'react';
import { App, Button, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { CUSTOMER_REVEAL_SECONDS, type ContactPointView } from '@vclinks/shared';
import { formatPhone } from '../contacts/PhoneText';
import { revealPoint } from './customerApi';

/**
 * Phone or email of a customer by right (02 DK-44, 01 MH-PQ-12). The API already sends the masked form unless the
 * viewer is the owner or holds the nick: then the value is shown as it is, no button, nothing logged.
 * Otherwise (`masked`) "Hiện" shows it for 60 seconds with a countdown and the line "Lượt xem này đã được ghi nhật ký.";
 * the API logs each click without the value. A viewer who may not reveal gets no button.
 */
export default function ContactValue({ accountId, point, allowCopy }: { accountId: string; point: ContactPointView | undefined; allowCopy?: boolean }) {
  const { message } = App.useApp();
  const [full, setFull] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const reveal = useMutation({ mutationFn: (action: 'view' | 'copy') => revealPoint(accountId, point!.id, action) });

  useEffect(() => {
    if (!full) return;
    setLeft(CUSTOMER_REVEAL_SECONDS);
    const t = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [full]);
  useEffect(() => {
    if (full && left <= 0) setFull(null);
  }, [full, left]);

  if (!point) return <Typography.Text type="secondary">Chưa có</Typography.Text>;
  const show = (v: string) => (point.kind === 'phone' ? formatPhone(v) : v);
  const raw = point.phone ?? point.email ?? '';
  if (!point.masked) return <span style={{ whiteSpace: 'nowrap' }}>{show(raw)}</span>;

  if (full) {
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        {show(full)} <Typography.Text copyable={{ text: full, onCopy: () => message.success('Đã sao chép.') }} />
        <Typography.Text type="secondary"> còn {left} giây</Typography.Text>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Lượt xem này đã được ghi nhật ký.
          </Typography.Text>
        </div>
      </span>
    );
  }
  const run = (action: 'view' | 'copy') =>
    reveal.mutate(action, {
      onSuccess: (r) => {
        if (action === 'view') setFull(r.value);
        else {
          void navigator.clipboard?.writeText(r.value);
          message.success('Đã sao chép.');
        }
        // Too many reveals in an hour: the managers were told, the person gets this notice (UAT-PQ-28).
        if (r.warning) message.warning(r.warning);
      },
      onError: (e) => message.error((e as Error).message),
    });
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {raw}
      {point.revealable && (
        <>
          <Button type="link" size="small" loading={reveal.isPending} onClick={() => run('view')}>
            Hiện
          </Button>
          {allowCopy && <Button type="link" size="small" icon={<CopyOutlined />} aria-label="Sao chép" onClick={() => run('copy')} />}
        </>
      )}
    </span>
  );
}

/** Main phone / email of a contact list: first of the kind, strongest first. */
export function mainPoint(points: ContactPointView[], kind: 'phone' | 'email'): ContactPointView | undefined {
  return points.filter((p) => p.kind === kind && p.state !== 'retired')[0];
}
