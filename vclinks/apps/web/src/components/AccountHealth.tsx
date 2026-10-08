import { useState } from 'react';
import { App, Badge, Button, Collapse, Popover, Space, Tooltip, Typography } from 'antd';
import { WifiOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { AccountHealth, AccountStatus, HealthLevel } from '@vclinks/shared';
import { api } from '../api';
import { fmtTime } from '../time';
import { nickName } from '../utils/nick';
import ZaloQrDialog, { type ZaloQrTarget } from './channels/ZaloQrDialog';
import { useZaloFarm } from './channels/zaloFarm';

const HEALTH_REFRESH_MS = 15_000;
const COLOR: Record<HealthLevel, string> = { green: 'var(--ok)', yellow: 'var(--warn)', red: 'var(--danger)', unsafe: 'var(--danger)' };
const RANK: Record<HealthLevel, number> = { unsafe: 0, red: 1, yellow: 2, green: 3 };

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api<AccountHealth[]>('/accounts/health'),
    refetchInterval: HEALTH_REFRESH_MS,
  });
}

/** Health of one account from the shared query; undefined while loading. */
export function useAccountHealth(uid: string | undefined): AccountHealth | undefined {
  const q = useHealth();
  return uid ? q.data?.find((h) => h.uid === uid) : undefined;
}

/** Chip text: "Đang kết nối", "Chậm", "Mất kết nối từ 07:40", "Chưa an toàn". */
export function healthText(h: AccountHealth): string {
  return h.level === 'red' && h.since ? `${h.label} từ ${fmtTime(h.since, 'HH:mm')}` : h.label;
}

export function worst(list: AccountHealth[] | undefined): HealthLevel | undefined {
  if (!list?.length) return undefined;
  return list.reduce((a, h) => (RANK[h.level] < RANK[a] ? h.level : a), 'green' as HealthLevel);
}

export function HealthDot({ level, size = 10 }: { level: HealthLevel | undefined; size?: number }) {
  return (
    <span
      role="img"
      aria-label={level ?? 'chưa rõ'}
      className={`health-dot health-dot--${level ?? 'none'}`}
      style={{ width: size, height: size, background: level ? COLOR[level] : 'var(--border-strong)' }}
    />
  );
}

/** Chip in the chat header: dot + state of the nick the conversation goes through. */
export function HealthChip({ uid, name }: { uid: string; name: string }) {
  const h = useAccountHealth(uid);
  if (!h) return null;
  return (
    <Tooltip title={h.reason ?? 'Nick đang nhận và gửi bình thường'}>
      <span className="health-chip" data-level={h.level}>
        <HealthDot level={h.level} /> {name} · {healthText(h)}
      </span>
    </Tooltip>
  );
}

function NickRow({ h, account, onRescan }: { h: AccountHealth; account?: AccountStatus; onRescan?: () => void }) {
  const { message } = App.useApp();
  const notify = useMutation({
    mutationFn: () => api<{ sent: boolean }>(`/accounts/${encodeURIComponent(h.uid)}/notify-admin`, { method: 'POST', body: {} }),
    onSuccess: (r) =>
      r.sent
        ? message.success(`Đã báo Admin về nick ${nickName(account?.label, account?.ownerName)}`)
        : message.info('Đã báo Admin cách đây chưa lâu, VClinks chưa gửi lại (30 phút một lần).'),
    onError: (e) => message.error(`Chưa báo được Admin: ${(e as Error).message}`),
  });
  const name = nickName(account?.label, account?.ownerName);
  return (
    <div className="health-row">
      <div>
        <HealthDot level={h.level} /> <b>{name}</b> <span className="health-row__state">{healthText(h)}</span>
      </div>
      <div className="health-row__meta">
        Đồng bộ gần nhất {fmtTime(h.lastSyncAt, 'HH:mm')} ·{' '}
        Lệnh chờ {h.pendingCommands} · Lỗi {h.failedCommands}
      </div>
      {h.reason && <div className="health-row__reason">{h.reason}</div>}
      {h.level !== 'green' && (
        <Space size={8} style={{ marginTop: 4 }}>
          {onRescan && (
            <Button size="small" type="primary" onClick={onRescan}>
              Quét lại QR
            </Button>
          )}
          <Button size="small" loading={notify.isPending} onClick={() => notify.mutate()}>
            Báo Admin
          </Button>
        </Space>
      )}
      {h.technical && (
        <Collapse
          ghost
          size="small"
          items={[{ key: 't', label: 'Chi tiết cho Admin', children: <Typography.Text code>{h.technical}</Typography.Text> }]}
        />
      )}
    </div>
  );
}

/** Nav-rail button: dot of the worst nick, popover with every nick (the team section comes with M1b-04). */
export function HealthNavButton({ accounts }: { accounts: AccountStatus[] | undefined }) {
  const navigate = useNavigate();
  const q = useHealth();
  const level = worst(q.data);
  // Nicks of the máy Zalo can be scanned again right here (the holder's own phone), no noVNC needed.
  const { slots } = useZaloFarm();
  const [qr, setQr] = useState<ZaloQrTarget | null>(null);
  const onFarm = (uid: string) => slots.data?.some((s) => s.uid === uid && s.state !== 'da_ngat');
  const content = (
    <div className="health-popover">
      <Typography.Text strong>Nick của tôi</Typography.Text>
      {q.data?.length ? (
        // Worst first, so a dead nick is never below the fold.
        [...q.data]
          .sort((a, b) => RANK[a.level] - RANK[b.level])
          .map((h) => (
            <NickRow key={h.uid} h={h} account={accounts?.find((a) => a.uid === h.uid)} onRescan={onFarm(h.uid) ? () => setQr({ mode: 'rescan', uid: h.uid }) : undefined} />
          ))
      ) : (
        <Typography.Text type="secondary">Chưa có nick nào được kết nối.</Typography.Text>
      )}
      <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/sync')}>
        Xem trang Đồng bộ
      </Button>
    </div>
  );
  return (
    <>
    <ZaloQrDialog target={qr} onClose={() => setQr(null)} />
    <Popover content={content} trigger="click" placement="rightTop" title={null}>
      <button type="button" className="nav-rail__item" aria-label="Trạng thái nick">
        <span className="nav-rail__icon">
          <Badge dot color={level ? COLOR[level] : 'var(--border-strong)'} offset={[-2, 4]}>
            <WifiOutlined style={{ color: 'inherit', fontSize: 20 }} />
          </Badge>
        </span>
        <span className="nav-rail__label">Nick</span>
      </button>
    </Popover>
    </>
  );
}
