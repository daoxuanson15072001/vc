import type { ReportOverview, ReportRow } from '@vclinks/shared';
import { Button, Table, Typography } from 'antd';
import { useState } from 'react';
import { delta, fmtMin, fmtPct } from '../../utils/report';
import { DeltaText } from './Figures';
import TurnsDrawer from './TurnsDrawer';
import type { ReportFilters } from './reportsApi';

/** Báo cáo hiệu suất chi tiết (MH-BC-06): one row per salesperson (or team for management), Δ against the previous period. */
export default function PerformanceTab({ o, filters }: { o: ReportOverview; filters: ReportFilters }) {
  const [view, setView] = useState<{ row: ReportRow; breachedOnly: boolean } | null>(null);
  const canDrill = o.mode === 'nvkd';
  const cell = (v: string, d: ReturnType<typeof delta>) => (
    <span>
      {v} {d ? <DeltaText d={d} /> : null}
    </span>
  );
  const total: ReportRow = { key: '__total__', kind: 'team', label: 'Tổng', accounts: o.accountsCounted, ...o.totals, prev: o.prevTotals };
  return (
    <>
      <Table<ReportRow>
        size="small"
        rowKey="key"
        dataSource={[...o.rows, total]}
        pagination={false}
        locale={{ emptyText: 'Chưa có dữ liệu trong kỳ này.' }}
        scroll={{ x: 900 }}
        columns={[
          { title: o.mode === 'nvkd' ? 'Nhân viên / kênh' : 'Tổ', dataIndex: 'label', render: (v: string, r) => (r.key === '__total__' ? <strong>{v}</strong> : v) },
          { title: 'Tổ', dataIndex: 'teamName', render: (v?: string | null) => v ?? '–', responsive: ['lg'] },
          { title: 'Lượt chờ', render: (_: unknown, r) => cell(String(r.turns), delta(r.turns, r.prev?.turns, 'none', 'n')) },
          { title: 'FRT trung vị', render: (_: unknown, r) => cell(fmtMin(r.frtMedian), delta(r.frtMedian, r.prev?.frtMedian, 'low', 'min')) },
          { title: 'FRT P90', render: (_: unknown, r) => fmtMin(r.frtP90) },
          {
            title: 'Quá SLA',
            render: (_: unknown, r) =>
              canDrill && r.key !== '__total__' && r.breached ? <Button type="link" size="small" onClick={() => setView({ row: r, breachedOnly: true })}>{r.breached}</Button> : r.breached,
          },
          { title: '% quá SLA', render: (_: unknown, r) => cell(fmtPct(r.pctBreached), delta(r.pctBreached, r.prev?.pctBreached, 'low', 'pct')) },
          { title: 'Qua VClinks', render: (_: unknown, r) => fmtPct(r.pctViaVclinks) },
          { title: 'Từ điện thoại', render: (_: unknown, r) => (r.answered ? fmtPct(Math.round((r.fromPhone / r.answered) * 1000) / 10) : '–') },
          {
            title: '',
            render: (_: unknown, r) => (canDrill && r.key !== '__total__' ? <Button type="link" size="small" onClick={() => setView({ row: r, breachedOnly: false })}>Xem lượt chờ</Button> : null),
          },
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        FRT của dòng tổng là trung vị của mọi lượt, không phải trung bình của các trung vị. Không có cột xếp hạng.
      </Typography.Paragraph>
      <TurnsDrawer
        open={!!view}
        title={view ? `${view.breachedOnly ? 'Lượt quá SLA' : 'Lượt chờ'} · ${view.row.label}` : ''}
        filters={filters}
        row={view?.row.key}
        breachedOnly={view?.breachedOnly}
        onClose={() => setView(null)}
      />
    </>
  );
}
