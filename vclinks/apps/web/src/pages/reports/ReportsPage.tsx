import { useQuery } from '@tanstack/react-query';
import type { ReportOverview } from '@vclinks/shared';
import { Alert, Button, Card, Checkbox, DatePicker, Select, Skeleton, Space, Tabs, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PERIOD_LABELS, defaultPeriod, periodOf, rangeOf, type PeriodKey } from '../../utils/report';
import { fullTime } from '../../utils/time';
import ExportModal from './ExportModal';
import OverviewTab from './OverviewTab';
import PerformanceTab from './PerformanceTab';
import { reportsApi, type ReportFilters } from './reportsApi';
import { usePageTitle } from '../../components/layout/PageTitle';

/*
 * Báo cáo (MH-BC-01 frame, 02 Dashboard của tôi, 03 Dashboard tổ, 06 Hiệu suất). Filters live in the query string
 * (00 R6), so a link shows the same period to whoever opens it, inside his own permissions: a team outside his
 * scope is ignored by the API. Figures come from the daily job; a period never reaches today.
 */
const QUICK = (Object.keys(PERIOD_LABELS) as PeriodKey[]).filter((k) => k !== 'custom');
const ALL_TEAMS = '__all__';

export default function ReportsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [exporting, setExporting] = useState(false);

  // The first load does not know the viewer's mode yet: ask with the weekly default, then switch the default.
  const explicit = sp.get('from') && sp.get('to');
  const guess = rangeOf(defaultPeriod('self'));
  const filters: ReportFilters = {
    from: sp.get('from') ?? guess.from,
    to: sp.get('to') ?? guess.to,
    team: sp.get('team') ?? undefined,
    compare: sp.get('compare') !== '0',
  };
  const q = useQuery<ReportOverview>({ queryKey: ['reports', 'overview', filters], queryFn: () => reportsApi.overview(filters), retry: false });
  const o = q.data;

  function setParams(next: Record<string, string | undefined>, replace = false) {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === '') n.delete(k);
      else n.set(k, v);
    }
    setSp(n, { replace });
  }

  // Default period by mode (MH-BC-01 #6): applied once, when the user has not chosen one.
  const mode = o?.mode;
  useEffect(() => {
    if (!mode || explicit) return;
    const r = rangeOf(defaultPeriod(mode));
    if (r.from !== guess.from || r.to !== guess.to) setParams({ from: r.from, to: r.to }, true);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const period = periodOf(filters.from, filters.to);
  const changed = !!(sp.get('from') || sp.get('to') || sp.get('team') || sp.get('compare'));
  const tabKey = tab === 'hieu-suat' && o && o.mode !== 'self' ? 'hieu-suat' : 'tong-quan';
  usePageTitle(tabKey === 'hieu-suat' ? 'Hiệu suất · Báo cáo' : o?.mode === 'self' ? 'Dashboard của tôi' : 'Tổng quan · Báo cáo');
  const tabs = [{ key: 'tong-quan', label: o?.mode === 'self' ? 'Dashboard của tôi' : 'Tổng quan' }, ...(o && o.mode !== 'self' ? [{ key: 'hieu-suat', label: 'Hiệu suất' }] : [])];

  return (
    <div style={{ padding: 16, overflow: 'auto', height: '100%' }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>Báo cáo</Typography.Title>
      <Tabs activeKey={tabKey} items={tabs} onChange={(k) => navigate({ pathname: `/reports/${k}`, search: sp.toString() })} />
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          {o && o.teams.length > 0 ? (
            <Select
              style={{ minWidth: 200 }}
              aria-label="Tổ"
              value={o.appliedTeam ?? ALL_TEAMS}
              onChange={(v) => setParams({ team: v === ALL_TEAMS ? undefined : v })}
              options={[{ value: ALL_TEAMS, label: o.teams.length > 1 ? 'Tất cả tổ của tôi' : o.teams[0]!.name }, ...(o.teams.length > 1 ? o.teams.map((t) => ({ value: t.id, label: t.name })) : [])]}
              disabled={o.teams.length < 2}
            />
          ) : o ? (
            <Typography.Text type="secondary">Phạm vi: Của tôi</Typography.Text>
          ) : null}
          <Select<PeriodKey>
            style={{ minWidth: 190 }}
            aria-label="Kỳ"
            value={period}
            options={[...QUICK, 'custom' as const].map((k) => ({ value: k, label: PERIOD_LABELS[k] }))}
            onChange={(k) => {
              if (k === 'custom') return;
              const r = rangeOf(k);
              setParams({ from: r.from, to: r.to });
            }}
          />
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            value={[dayjs(filters.from), dayjs(filters.to)]}
            disabledDate={(d) => d.isAfter(dayjs().subtract(1, 'day').endOf('day'))}
            allowClear={false}
            onChange={(v) => v?.[0] && v[1] && setParams({ from: v[0].format('YYYY-MM-DD'), to: v[1].format('YYYY-MM-DD') })}
          />
          <Checkbox checked={filters.compare} onChange={(e) => setParams({ compare: e.target.checked ? undefined : '0' })}>So với kỳ trước</Checkbox>
          {changed ? <Button type="link" onClick={() => setSp(new URLSearchParams())}>Xóa bộ lọc</Button> : null}
          {o?.canExport && o.mode !== 'self' ? <Button onClick={() => setExporting(true)}>Xuất Excel</Button> : null}
        </Space>
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Số theo ngày đã kết thúc{o?.computedAt ? `, tính lúc ${fullTime(o.computedAt)}` : ''}; hệ thống cập nhật sau 01:00 mỗi ngày.
          </Typography.Text>
        </div>
      </Card>
      {q.isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : null}
      {q.isError ? (
        <Alert type="error" showIcon message="Không tải được báo cáo." description={(q.error as Error).message} action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />
      ) : null}
      {o && !o.rows.length && !q.isError ? <Alert type="info" showIcon message="Chưa có dữ liệu trong kỳ này." style={{ marginBottom: 16 }} /> : null}
      {o && tabKey === 'tong-quan' ? <OverviewTab o={o} filters={filters} /> : null}
      {o && tabKey === 'hieu-suat' ? <PerformanceTab o={o} filters={filters} /> : null}
      {o ? <ExportModal open={exporting} onClose={() => setExporting(false)} filters={filters} canDetail={o.mode === 'nvkd'} /> : null}
    </div>
  );
}
