import { Descriptions, Empty, Space, Table, Tag, Typography } from 'antd';
import type { DomSelectors, FieldMappingSpec, Stream, StreamMapping } from '@vclinks/shared';
import { STREAM_LABEL, STREAM_ORDER } from '../labels';

type Change = 'added' | 'removed' | 'changed' | 'same';

interface FieldRow {
  target: string;
  source?: string;
  previous?: string;
  required: boolean;
  change: Change;
}

const CHANGE_TAG: Record<Change, { label: string; color: string } | null> = {
  added: { label: 'Thêm', color: 'green' },
  removed: { label: 'Bỏ', color: 'red' },
  changed: { label: 'Đổi', color: 'orange' },
  same: null,
};

const ROW_BG: Record<Change, string | undefined> = {
  added: 'var(--ok-bg)',
  removed: 'var(--danger-bg)',
  changed: 'var(--warn-bg)',
  same: undefined,
};

function diffFields(next?: StreamMapping, prev?: StreamMapping): FieldRow[] {
  const nf = next?.fields ?? {};
  const pf = prev?.fields ?? {};
  const req = new Set(next?.required ?? []);
  const targets = [...new Set([...Object.keys(nf), ...Object.keys(pf)])];
  return targets.map((target) => {
    const source = nf[target];
    const previous = pf[target];
    let change: Change = 'same';
    if (!prev) change = 'same';
    else if (source === undefined) change = 'removed';
    else if (previous === undefined) change = 'added';
    else if (source !== previous) change = 'changed';
    return { target, source, previous, required: req.has(target), change };
  });
}

function Changed({ next, prev, compare }: { next?: string; prev?: string; compare: boolean }) {
  if (!compare || next === prev) return <Typography.Text code>{next ?? '—'}</Typography.Text>;
  return (
    <Space size={4}>
      <Typography.Text delete type="secondary">
        {prev ?? '—'}
      </Typography.Text>
      →<Typography.Text code mark>{next ?? '—'}</Typography.Text>
    </Space>
  );
}

function StreamDiff({ stream, next, prev }: { stream: Stream; next?: StreamMapping; prev?: StreamMapping }) {
  const compare = !!prev;
  const rows = diffFields(next, prev);
  const reqPrev = new Set(prev?.required ?? []);
  const reqNext = new Set(next?.required ?? []);
  const reqChanged = compare && (reqPrev.size !== reqNext.size || [...reqNext].some((r) => !reqPrev.has(r)));
  const changes = rows.filter((r) => r.change !== 'same').length;

  return (
    <div style={{ marginBottom: 16 }}>
      <Space style={{ marginBottom: 6 }} wrap>
        <Typography.Text strong>{STREAM_LABEL[stream]}</Typography.Text>
        {compare && (changes || reqChanged || prev?.store !== next?.store || prev?.dbPrefix !== next?.dbPrefix) ? (
          <Tag color="orange">Có thay đổi</Tag>
        ) : compare ? (
          <Tag>Không đổi</Tag>
        ) : null}
      </Space>
      <Descriptions size="small" column={3} style={{ marginBottom: 6 }}>
        <Descriptions.Item label="DB">
          <Changed next={next?.dbPrefix} prev={prev?.dbPrefix} compare={compare} />
        </Descriptions.Item>
        <Descriptions.Item label="Store">
          <Changed next={next?.store} prev={prev?.store} compare={compare} />
        </Descriptions.Item>
        <Descriptions.Item label="Bắt buộc">
          <Space size={[0, 4]} wrap>
            {[...new Set([...reqNext, ...(compare ? reqPrev : [])])].map((r) => (
              <Tag key={r} color={!compare ? undefined : !reqPrev.has(r) ? 'green' : !reqNext.has(r) ? 'red' : undefined}>
                {r}
              </Tag>
            ))}
          </Space>
        </Descriptions.Item>
      </Descriptions>
      <Table<FieldRow>
        size="small"
        rowKey="target"
        pagination={false}
        dataSource={rows}
        onRow={(r) => ({ style: { background: ROW_BG[r.change] } })}
        columns={[
          {
            title: 'Trường chuẩn',
            dataIndex: 'target',
            render: (t: string, r) => (
              <Space size={4}>
                <Typography.Text strong={r.required} delete={r.change === 'removed'}>
                  {t}
                </Typography.Text>
                {r.required && <Typography.Text type="danger">*</Typography.Text>}
              </Space>
            ),
          },
          {
            title: 'Trường gốc (IndexedDB)',
            key: 'source',
            render: (_, r) =>
              r.change === 'removed' ? (
                <Typography.Text delete type="secondary">
                  {r.previous}
                </Typography.Text>
              ) : (
                <Changed next={r.source} prev={r.previous} compare={r.change === 'changed'} />
              ),
          },
          ...(compare
            ? [
                {
                  title: 'Thay đổi',
                  key: 'change',
                  width: 90,
                  render: (_: unknown, r: FieldRow) => {
                    const t = CHANGE_TAG[r.change];
                    return t ? <Tag color={t.color}>{t.label}</Tag> : null;
                  },
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

const DOM_LABEL: Record<keyof DomSelectors, string> = {
  bubbleIdPrefix: 'Tiền tố id bong bóng chat',
  text: 'Chữ trong bong bóng',
  sentMarker: 'Dấu hiệu tin đã gửi',
  imageSkip: 'Bỏ qua ảnh (regex)',
  threadIdAttr: 'Thuộc tính threadId (sidebar)',
  threadTitle: 'Tên hội thoại (sidebar)',
  groupIdPrefix: 'Tiền tố threadId của nhóm',
  knownBubbles: 'Loại bong bóng đã khảo sát',
};

/** Selector values are strings, except `knownBubbles` (kind → selector). */
const domValue = (d: DomSelectors | undefined, k: keyof DomSelectors): string | undefined => {
  const v = d?.[k];
  if (v === undefined || typeof v === 'string') return v;
  return Object.entries(v)
    .map(([kind, css]) => `${kind}: ${css}`)
    .join('\n');
};

/** DOM selectors (Zalo Web UI), diffed like the stream fields. */
function DomDiff({ next, prev, compare }: { next?: DomSelectors; prev?: DomSelectors; compare: boolean }) {
  if (!next && !prev) return null;
  const keys = Object.keys(DOM_LABEL) as (keyof DomSelectors)[];
  const changed = compare && keys.some((k) => domValue(next, k) !== domValue(prev, k));
  return (
    <div style={{ marginBottom: 16 }}>
      <Space style={{ marginBottom: 6 }} wrap>
        <Typography.Text strong>Selector giao diện (DOM)</Typography.Text>
        {compare && (changed ? <Tag color="orange">Có thay đổi</Tag> : <Tag>Không đổi</Tag>)}
      </Space>
      <Table
        size="small"
        rowKey="key"
        pagination={false}
        dataSource={keys.map((key) => ({ key, next: domValue(next, key), prev: domValue(prev, key) }))}
        onRow={(r) => ({ style: { background: compare && r.next !== r.prev ? ROW_BG.changed : undefined } })}
        columns={[
          { title: 'Khóa', dataIndex: 'key', render: (k: keyof DomSelectors) => DOM_LABEL[k] },
          {
            title: 'Selector',
            key: 'sel',
            render: (_, r) => <Changed next={r.next} prev={r.prev} compare={compare} />,
          },
        ]}
      />
    </div>
  );
}

/** Per-stream view of `spec`, diffed against `base` (the active mapping) when given. */
export default function MappingDiff({ spec, base }: { spec: FieldMappingSpec; base?: FieldMappingSpec }) {
  if (!spec?.streams) return <Empty description="Bảng ánh xạ trống" />;
  return (
    <div>
      {!base && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Chưa có bảng ánh xạ đang áp dụng để so sánh.
        </Typography.Paragraph>
      )}
      {STREAM_ORDER.map((s) => (
        <StreamDiff key={s} stream={s} next={spec.streams[s]} prev={base?.streams?.[s]} />
      ))}
      <DomDiff next={spec.dom} prev={base?.dom} compare={!!base} />
    </div>
  );
}
