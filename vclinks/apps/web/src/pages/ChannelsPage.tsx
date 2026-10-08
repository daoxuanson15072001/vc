import { useState, type ReactNode } from 'react';
import { Button, Skeleton, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { Channel } from '@vclinks/shared';
import { HealthDot, useHealth } from '../components/AccountHealth';
import { useAccounts } from '../components/AccountSelect';
import ChannelBadge from '../components/ChannelBadge';
import { nickName } from '../utils/nick';
import FacebookPageSection from './channels/FacebookPageSection';
import FacebookPersonalSection from './channels/FacebookPersonalSection';
import ZaloOaSection from './channels/ZaloOaSection';
import ChannelMap from './channels/ChannelMap';
import ZaloFarmSection, { ZaloQrDialog, useZaloFarm } from './channels/ZaloFarmSection';
import type { ZaloQrTarget } from '../components/channels/ZaloQrDialog';
import { usePermissions } from '../state/permissions';
import { usePageTitle } from '../components/layout/PageTitle';

/** Overview card of one channel (design "Kênh kết nối"): what it is for, its sending rule, its state. */
interface ChannelCardDef {
  key: string;
  channel?: Channel;
  /** Badge for channels VClinks does not have yet. */
  mark?: { text: string; className: string };
  title: string;
  text: string;
  rule: string;
  /** Section id below that holds the connect form. */
  anchor?: string;
  soon?: string;
}

const CARDS: ChannelCardDef[] = [
  { key: 'zalo', channel: 'zalo', title: 'Zalo cá nhân', text: 'Nick công ty: quét mã QR để chạy trên máy Zalo của công ty, hoặc qua tiện ích VClinks trên Zalo Web.', rule: 'Không giới hạn khung gửi · không gửi hàng loạt' },
  { key: 'zalo_oa', channel: 'zalo_oa', title: 'Zalo OA', text: 'Official Account của division, nhận tin qua webhook.', rule: 'Tin tư vấn chỉ gửi trong khung Zalo cho phép sau tương tác của khách', anchor: 'kenh-zalo-oa' },
  { key: 'fb_page', channel: 'fb_page', title: 'Fanpage Facebook', text: 'Trang Facebook của công ty, trả lời qua Messenger.', rule: 'Trả lời trong 24 giờ sau tin cuối của khách', anchor: 'kenh-fanpage' },
  { key: 'whatsapp', mark: { text: 'WA', className: 'channel-badge--whatsapp' }, title: 'WhatsApp Business', text: 'Cho nhà cung cấp, đối tác và khách nước ngoài. Đang chờ xác minh doanh nghiệp trên Meta.', rule: 'Trả lời trong 24 giờ · ngoài khung chỉ gửi tin mẫu đã duyệt', soon: 'Sắp có' },
  { key: 'fb_personal', channel: 'fb_personal', title: 'Facebook cá nhân', text: 'Qua tiện ích trên messenger.com, chỉ nick công ty.', rule: 'Rủi ro khóa tài khoản · gửi chậm, giống người thật', anchor: 'kenh-fb-ca-nhan' },
  { key: 'email', mark: { text: '@', className: 'channel-badge--email' }, title: 'Email', text: 'Đọc thư với khách để đưa vào hồ sơ khách 360.', rule: 'Chỉ đọc', soon: 'Sắp có' },
];

/** Connected accounts of every channel, plus one section per channel to connect more; "Bản đồ kênh" at /channels/map. */
export default function ChannelsPage({ view = 'connect' }: { view?: 'connect' | 'map' }) {
  const accounts = useAccounts();
  const health = useHealth();
  const navigate = useNavigate();
  const perms = usePermissions();
  const canMap = perms.has('channel.access');
  const { farm } = useZaloFarm();
  const [qr, setQr] = useState<ZaloQrTarget | null>(null);
  usePageTitle(view === 'map' ? 'Bản đồ kênh' : 'Kênh kết nối');
  const tabs = canMap ? (
    <Tabs
      className="admin-tabs"
      activeKey={view}
      onChange={(k) => navigate(k === 'map' ? '/channels/map' : '/channels')}
      items={[
        { key: 'connect', label: 'Kênh kết nối' },
        { key: 'map', label: 'Bản đồ kênh' },
      ]}
    />
  ) : null;

  if (view === 'map') {
    return (
      <div className="page page--wide">
        <h1 className="page-title">Kênh</h1>
        {tabs}
        <ChannelMap />
      </div>
    );
  }
  const levelOf = (uid: string) => health.data?.find((h) => h.uid === uid)?.level;

  const state = (c: ChannelCardDef): { chip: ReactNode; count: number } => {
    if (c.soon) return { chip: <span className="soft-chip">{c.soon}</span>, count: 0 };
    const list = (accounts.data ?? []).filter((a) => a.channel === c.channel);
    if (!list.length) return { chip: <span className="soft-chip">Chưa kết nối</span>, count: 0 };
    const bad = list.filter((a) => {
      const l = levelOf(a.uid);
      return l === 'red' || l === 'unsafe';
    }).length;
    if (bad) return { chip: <span className="soft-chip soft-chip--danger">{bad} cần xử lý</span>, count: list.length };
    return { chip: <span className="soft-chip soft-chip--ok">{list.length} đang kết nối</span>, count: list.length };
  };

  return (
    <div className="page page--wide">
      <h1 className="page-title">{canMap ? 'Kênh' : 'Kênh kết nối'}</h1>
      {tabs}
      <div className="channel-grid">
        {CARDS.map((c) => {
          const s = state(c);
          return (
            <section key={c.key} className={`surface channel-card${c.soon ? ' channel-card--soon' : ''}`} aria-labelledby={`ch-${c.key}`}>
              <div className="channel-card__head">
                {c.channel ? <ChannelBadge channel={c.channel} compact /> : <span className={`channel-badge channel-badge--compact ${c.mark!.className}`}>{c.mark!.text}</span>}
                <h2 id={`ch-${c.key}`} className="channel-card__title">
                  {c.title}
                </h2>
                {s.chip}
              </div>
              <div className="channel-card__text">{c.text}</div>
              <div className="channel-card__rule">{c.rule}</div>
              {!c.soon && (
                <div className="channel-card__actions">
                  {c.key === 'zalo' ? (
                    <>
                      {farm.data?.installed && farm.data.canManage && (
                        <Button type="primary" onClick={() => setQr({ mode: 'create' })} disabled={farm.data.slots >= farm.data.max}>
                          Kết nối bằng mã QR
                        </Button>
                      )}
                      <Button onClick={() => navigate('/sync')}>Xem đồng bộ nick</Button>
                    </>
                  ) : (
                    <Button onClick={() => document.getElementById(c.anchor!)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                      {s.count ? 'Quản lý' : 'Kết nối'}
                    </Button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <ZaloFarmSection onOpen={setQr} />
      <ZaloQrDialog target={qr} onClose={() => setQr(null)} />

      <section className="surface" aria-labelledby="ch-accounts">
        <h2 id="ch-accounts" className="surface__title">
          Tài khoản đã kết nối
        </h2>
        {accounts.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : accounts.data?.length ? (
          <div className="account-rows">
            {accounts.data.map((a) => (
              <div key={a.uid} className="account-row">
                <ChannelBadge channel={a.channel} />
                <span className="account-row__name">{nickName(a.label, a.ownerName)}</span>
                <span className="account-row__uid">{a.uid}</span>
                <span className="account-row__health">
                  <HealthDot level={levelOf(a.uid)} size={8} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="fact__v--muted">Chưa có tài khoản nào.</div>
        )}
      </section>

      <div id="kenh-fanpage" className="channel-section">
        <FacebookPageSection />
      </div>
      <div id="kenh-zalo-oa" className="channel-section">
        <ZaloOaSection />
      </div>
      <div id="kenh-fb-ca-nhan" className="channel-section">
        <FacebookPersonalSection />
      </div>
    </div>
  );
}
