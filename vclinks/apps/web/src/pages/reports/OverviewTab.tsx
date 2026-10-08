import type { ReportOverview } from '@vclinks/shared';
import { Alert, Button, Space, Typography } from 'antd';
import { useState } from 'react';
import { delta, fmtMin, fmtPct } from '../../utils/report';
import { FigureCard } from './Figures';
import TurnsDrawer from './TurnsDrawer';
import type { ReportFilters } from './reportsApi';

const HOW = {
  turns: 'Số lượt chờ bắt đầu trong kỳ. Một lượt bắt đầu ở tin khách đầu tiên sau tin cuối của nick, kết thúc ở tin kế tiếp của nick.',
  frt: 'Trung vị thời gian chờ (phút giờ làm việc) của các lượt đã trả lời; P90 là mốc 9 trên 10 lượt được trả lời kịp.',
  sla: 'Số lượt chờ lâu hơn hạn SLA (kể cả lượt đang chờ đã quá hạn) trên tổng số lượt.',
  via: 'Lượt kết thúc bằng tin gửi từ VClinks trên số lượt đã trả lời. Chỉ để theo dõi, không trừ điểm.',
};

/** Dashboard của tôi (MH-BC-02) for a salesperson; Dashboard tổ (MH-BC-03) for a supervisor, director, management. */
export default function OverviewTab({ o, filters }: { o: ReportOverview; filters: ReportFilters }) {
  const [drawer, setDrawer] = useState(false);
  const t = o.totals;
  const p = o.prevTotals;
  const self = o.mode === 'self';
  return (
    <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
      <Space wrap size="middle" style={{ display: 'flex' }}>
        <FigureCard
          title="Lượt chờ"
          value={t.turns}
          delta={delta(t.turns, p?.turns, 'none', 'n')}
          sub={self && o.team?.turnsPerMember != null ? `Tổ TB: ${String(o.team.turnsPerMember).replace('.', ',')}` : `${t.answered} đã trả lời · ${t.open} đang chờ`}
          how={HOW.turns}
        />
        <FigureCard
          title="Phản hồi (FRT)"
          value={fmtMin(t.frtMedian)}
          delta={delta(t.frtMedian, p?.frtMedian, 'low', 'min')}
          sub={self && o.team ? `Tổ: ${fmtMin(o.team.summary.frtMedian)} · 9/10 lượt trong ${fmtMin(t.frtP90)}` : `9/10 lượt được trả lời trong ${fmtMin(t.frtP90)}`}
          how={HOW.frt}
        />
        <FigureCard
          title="% quá SLA"
          value={fmtPct(t.pctBreached)}
          delta={delta(t.pctBreached, p?.pctBreached, 'low', 'pct')}
          sub={self && o.team ? `Tổ: ${fmtPct(o.team.summary.pctBreached)}` : `${t.breached} lượt quá hạn`}
          how={HOW.sla}
        />
        <FigureCard
          title="% trả lời qua VClinks"
          value={fmtPct(t.pctViaVclinks)}
          delta={delta(t.pctViaVclinks, p?.pctViaVclinks, 'none', 'pct')}
          sub={`${t.viaVclinks} qua VClinks · ${t.fromPhone} từ điện thoại`}
          how={HOW.via}
        />
      </Space>
      {self && o.team ? (
        <Typography.Text type="secondary">
          Trung bình tổ{o.team.teamName ? ` ${o.team.teamName}` : ''} tính trên {o.team.members} nhân viên; không hiện tên hay thứ hạng từng người.
        </Typography.Text>
      ) : null}
      {o.mode === 'team' ? (
        <Alert type="info" showIcon message="Bảng theo từng nhân viên chỉ có ở giám sát và giám đốc division. Tab này hiện số theo tổ." />
      ) : (
        <Space>
          <Button onClick={() => setDrawer(true)} disabled={!t.breached}>Xem {t.breached} lượt quá SLA</Button>
        </Space>
      )}
      {o.mode === 'team' || o.mode === 'nvkd' ? <TeamTable o={o} /> : null}
      <TurnsDrawer open={drawer} title="Lượt quá SLA" filters={filters} breachedOnly onClose={() => setDrawer(false)} />
    </Space>
  );
}

function TeamTable({ o }: { o: ReportOverview }) {
  return (
    <Typography.Text type="secondary">
      Tính trên {o.accountsCounted} tài khoản kênh trong phạm vi của bạn. Chi tiết từng dòng ở tab Hiệu suất.
    </Typography.Text>
  );
}
