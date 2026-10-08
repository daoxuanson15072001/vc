import { InfoCircleOutlined } from '@ant-design/icons';
import { Card, Popover, Statistic, Typography } from 'antd';
import type { ReactNode } from 'react';
import { type Delta } from '../../utils/report';

const TONE: Record<Delta['tone'], string> = { good: 'var(--ok)', bad: 'var(--danger)', neutral: 'var(--muted)' };

export function DeltaText({ d }: { d: Delta | null }) {
  if (!d) return null;
  return <span style={{ color: TONE[d.tone], fontSize: 12, whiteSpace: 'nowrap' }}>{d.text}</span>;
}

/** One figure card (BC-13): value, change against the previous period, a line of context and "how it is computed". */
export function FigureCard(p: { title: string; value: ReactNode; delta?: Delta | null; sub?: ReactNode; how: string; warn?: boolean }) {
  return (
    <Card size="small" style={{ minWidth: 190, flex: '1 1 190px', ...(p.warn ? { background: 'var(--warn-bg)' } : {}) }}>
      <Statistic
        title={
          <span>
            {p.title}{' '}
            <Popover content={<div style={{ maxWidth: 280 }}>{p.how}</div>} title="Số này tính thế nào">
              <InfoCircleOutlined style={{ color: 'var(--muted)' }} aria-label="Số này tính thế nào" />
            </Popover>
          </span>
        }
        value={p.value as never}
        valueStyle={{ fontSize: 26 }}
      />
      <div style={{ minHeight: 20 }}>
        <DeltaText d={p.delta ?? null} />
      </div>
      {p.sub ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{p.sub}</Typography.Text> : null}
    </Card>
  );
}
