import { useState, type ReactNode } from 'react';
import { Alert, Button, Select, Table } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CHANNEL_ACCESS_LEVEL_LABELS, CHANNEL_INFO, type AccountHealth, type Channel, type ChannelAssignRow } from '@vclinks/shared';
import { useHealth } from '../../components/AccountHealth';
import ChannelBadge from '../../components/ChannelBadge';
import ChatAvatar from '../../components/chat/ChatAvatar';
import { isNoAccessError } from '../../components/access/NoAccess';
import { adminApi } from '../admin/adminApi';
import { tokensApi } from '../admin/tokensApi';

/*
 * "Bản đồ kênh" (design "Bản đồ kênh", plan §4): who holds which nick, who covers it today, which channel needs
 * attention. Read-only: every change is made in Quản trị › Gán kênh, where the existing rules and audit apply.
 */

type Kind = 'all' | 'personal' | 'official';
type Tone = 'ok' | 'warn' | 'danger' | 'muted';

const pad = (n: number) => String(n).padStart(2, '0');
const until = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === today.toDateString() ? time : `${time} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

function chip(tone: Tone, text: ReactNode) {
  return <span className={`soft-chip${tone === 'muted' ? '' : ` soft-chip--${tone}`}`}>{text}</span>;
}

/** State of one channel: unsafe hand-over first, then the nick health. */
function stateOf(r: ChannelAssignRow, h: AccountHealth | undefined): { tone: Tone; text: string; attention: boolean } {
  if (r.unsafe) return { tone: 'warn', text: 'Chưa an toàn sau bàn giao', attention: true };
  if (!h) return { tone: 'muted', text: 'Chưa có dữ liệu', attention: false };
  if (h.level === 'red' || h.level === 'unsafe') return { tone: 'danger', text: h.since ? `${h.label} từ ${until(h.since)}` : h.label, attention: true };
  if (h.level === 'yellow') return { tone: 'warn', text: h.label, attention: false };
  return { tone: 'ok', text: h.label, attention: false };
}

/** Temporary "Trực & gửi" grants running now: the cover of the day. */
function coversNow(r: ChannelAssignRow, now: number) {
  return r.access.filter((a) => a.level === 'gui' && a.to && Date.parse(a.to) > now && (!a.from || Date.parse(a.from) <= now));
}

export default function ChannelMap() {
  const navigate = useNavigate();
  const [division, setDivision] = useState<string | undefined>();
  const [kind, setKind] = useState<Kind>('all');
  const list = useQuery({ queryKey: ['admin', 'channels', ''], queryFn: () => tokensApi.channels({}), retry: false });
  const units = useQuery({ queryKey: ['admin', 'units'], queryFn: adminApi.units, retry: false });
  const health = useHealth();
  const now = Date.now();
  const healthOf = (uid: string) => health.data?.find((h) => h.uid === uid);
  const unitName = (id: string | null) => (id ? units.data?.find((u) => u.id === id)?.name : undefined);
  const toAdmin = () => navigate('/admin/channel-access');

  if (list.isError) {
    return isNoAccessError(list.error) ? (
      <Alert type="info" showIcon message="Bản đồ kênh dành cho người được gán kênh (quyền Gán kênh)." />
    ) : (
      <Alert type="error" showIcon message="Không tải được bản đồ kênh. Thử lại sau ít phút." />
    );
  }

  const personal = (c: string) => CHANNEL_INFO[c as Channel]?.sendMode === 'extension';
  const rows = (list.data?.items ?? []).filter((r) => (!division || r.divisionId === division) && (kind === 'all' || (kind === 'personal') === personal(r.channel)));
  const personalRows = rows.filter((r) => personal(r.channel));
  const officialRows = rows.filter((r) => !personal(r.channel));
  const needsWork = (r: ChannelAssignRow) => stateOf(r, healthOf(r.uid)).attention || (personal(r.channel) && !r.holderUserId);
  const attention = rows.filter(needsWork).length;
  const green = rows.filter((r) => !needsWork(r) && healthOf(r.uid)?.level === 'green').length;
  const slow = rows.filter((r) => !needsWork(r) && healthOf(r.uid)?.level === 'yellow').length;
  const covering = rows.filter((r) => coversNow(r, now).length).length;
  const divisions = (units.data ?? []).filter((u) => u.type === 'division');

  const channelCell = (r: ChannelAssignRow) => (
    <div className="map-channel">
      <ChannelBadge channel={r.channel as Channel} compact />
      <div className="map-channel__text">
        <div className="map-channel__name">{r.label || r.uid}</div>
        <div className="map-channel__sub">{unitName(r.divisionId) ?? 'Chưa vào division'}</div>
      </div>
    </div>
  );
  const statusCell = (r: ChannelAssignRow) => {
    const s = stateOf(r, healthOf(r.uid));
    return chip(s.tone, s.text);
  };

  return (
    <div className="channel-map">
      <p className="page-lead">Ai cầm kênh nào, ai đang trực thay hôm nay, kênh nào cần xử lý. Thay đổi làm ở Quản trị › Gán kênh.</p>
      <div className="map-toolbar">
        <Select
          allowClear
          placeholder="Mọi division"
          value={division}
          onChange={setDivision}
          options={divisions.map((u) => ({ value: u.id, label: u.name }))}
          style={{ minWidth: 180 }}
          aria-label="Division"
        />
        <Select<Kind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'Mọi loại kênh' },
            { value: 'personal', label: 'Nick cá nhân' },
            { value: 'official', label: 'Kênh chính thức' },
          ]}
          style={{ minWidth: 160 }}
          aria-label="Loại kênh"
        />
        <span className="map-toolbar__chips">
          {chip(green ? 'ok' : 'muted', `Ổn ${green}`)}
          {slow > 0 && chip('warn', `Chậm ${slow}`)}
          {chip(attention ? 'danger' : 'muted', `Cần xử lý ${attention}`)}
          {chip('muted', `Trực thay hôm nay ${covering}`)}
        </span>
        <Button type="primary" onClick={toAdmin} className="map-toolbar__action">
          Gán kênh
        </Button>
      </div>

      {kind !== 'official' && (
        <section className="surface map-section" aria-labelledby="map-personal">
          <div className="map-section__head">
            <h2 id="map-personal" className="surface__title">
              Nick cá nhân
            </h2>
            <span className="map-section__note">mỗi nick đúng một người giữ</span>
          </div>
          <Table<ChannelAssignRow>
            rowKey="uid"
            size="middle"
            pagination={false}
            loading={list.isLoading}
            dataSource={personalRows}
            scroll={{ x: 760 }}
            locale={{ emptyText: 'Chưa có nick cá nhân nào.' }}
            columns={[
              { title: 'Kênh', key: 'channel', render: (_, r) => channelCell(r) },
              {
                title: 'Người giữ',
                key: 'holder',
                render: (_, r) =>
                  r.holderName ? (
                    <span className="map-person">
                      <ChatAvatar size={24} name={r.holderName} colorKey={r.holderUserId} />
                      {r.holderName}
                    </span>
                  ) : (
                    chip('warn', 'Chưa có người giữ')
                  ),
              },
              {
                title: 'Trực thay hôm nay',
                key: 'cover',
                render: (_, r) => {
                  const c = coversNow(r, now);
                  return c.length ? c.map((a) => `${a.principalName}, tới ${until(a.to!)}`).join('; ') : <span className="fact__v--muted">—</span>;
                },
              },
              { title: 'Trạng thái', key: 'state', render: (_, r) => statusCell(r) },
              {
                title: '',
                key: 'action',
                align: 'right',
                render: (_, r) =>
                  r.holderUserId ? (
                    <Button size="small" onClick={toAdmin}>
                      {r.unsafe ? 'Xác nhận đã đăng xuất' : 'Đổi người giữ'}
                    </Button>
                  ) : (
                    <Button size="small" type="primary" onClick={toAdmin}>
                      Gán người giữ
                    </Button>
                  ),
              },
            ]}
          />
        </section>
      )}

      {kind !== 'personal' && (
        <section className="surface map-section" aria-labelledby="map-official">
          <div className="map-section__head">
            <h2 id="map-official" className="surface__title">
              Kênh chính thức
            </h2>
            <span className="map-section__note">gán cho nhóm, ai vào nhóm tự có quyền</span>
          </div>
          <Table<ChannelAssignRow>
            rowKey="uid"
            size="middle"
            pagination={false}
            loading={list.isLoading}
            dataSource={officialRows}
            scroll={{ x: 760 }}
            locale={{ emptyText: 'Chưa có Zalo OA hay Fanpage nào. Kết nối ở tab Kênh kết nối.' }}
            columns={[
              { title: 'Kênh', key: 'channel', render: (_, r) => channelCell(r) },
              {
                title: 'Nhóm trực và mức quyền',
                key: 'groups',
                render: (_, r) => {
                  const groups = r.access.filter((a) => a.level !== 'giu_nick');
                  return groups.length ? (
                    <div className="map-groups">
                      {groups.map((a) => (
                        <span key={a.id}>
                          {a.principalName} · {CHANNEL_ACCESS_LEVEL_LABELS[a.level]}
                        </span>
                      ))}
                    </div>
                  ) : (
                    chip('warn', 'Chưa gán nhóm')
                  );
                },
              },
              { title: 'Khung gửi', key: 'window', render: (_, r) => (r.channel === 'fb_page' ? '24 giờ sau tin cuối của khách' : 'Theo quy định Zalo OA') },
              { title: 'Trạng thái', key: 'state', render: (_, r) => statusCell(r) },
              {
                title: '',
                key: 'action',
                align: 'right',
                render: (_, r) => (
                  <Button size="small" type={r.access.some((a) => a.level !== 'giu_nick') ? 'default' : 'primary'} onClick={toAdmin}>
                    {r.access.some((a) => a.level !== 'giu_nick') ? 'Đổi nhóm' : 'Gán nhóm'}
                  </Button>
                ),
              },
            ]}
          />
        </section>
      )}
    </div>
  );
}
