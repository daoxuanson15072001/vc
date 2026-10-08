import { useMemo } from 'react';
import { Alert, Button, DatePicker, Empty, Input, List, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { AudioOutlined, SearchOutlined } from '@ant-design/icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Link, useSearchParams } from 'react-router-dom';
import { SEARCH_MIN_CHARS, type SearchHit, type SearchMessagesResponse } from '@vclinks/shared';
import { api } from '../api';
import { useAccounts } from '../components/AccountSelect';
import ChatAvatar from '../components/chat/ChatAvatar';
import { fmtTime } from '../time';
import { nickName } from '../utils/nick';
import { hitLink, splitMarks } from '../utils/search';

const KIND_TEXT = { phone: 'Số điện thoại', plate: 'Biển số', oe: 'Mã phụ tùng / mã OE' } as const;

/** MH-SZ-14 `/search?q=&uid=&from=&to=`: message search over every nick of the viewer's scope. */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const uid = params.get('uid') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const accounts = useAccounts();
  const tooShort = q.length > 0 && q.replace(/"/g, '').length < SEARCH_MIN_CHARS;

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  const res = useInfiniteQuery({
    queryKey: ['search', 'messages', q, uid, from, to],
    enabled: q.length >= SEARCH_MIN_CHARS,
    initialPageParam: 1,
    retry: false,
    staleTime: 15_000,
    queryFn: ({ pageParam }) =>
      api<SearchMessagesResponse>('/search/messages', { query: { q, uid, from: from ? dayjs(from).startOf('day').toISOString() : undefined, to: to ? dayjs(to).endOf('day').toISOString() : undefined, page: pageParam, limit: 20 } }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
  const items = useMemo(() => res.data?.pages.flatMap((p) => p.items) ?? [], [res.data]);
  const first = res.data?.pages[0];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>Tìm kiếm tin nhắn</Typography.Title>
      <Space wrap style={{ width: '100%', marginBottom: 12 }}>
        <Input.Search
          key={q}
          defaultValue={q}
          allowClear
          autoFocus
          enterButton={<SearchOutlined />}
          style={{ width: 360 }}
          placeholder="Từ khóa, SĐT, mã OE, biển số…"
          aria-label="Từ khóa tìm tin nhắn"
          onSearch={(v) => set({ q: v.trim() || undefined })}
        />
        <Select
          mode="multiple"
          allowClear
          style={{ minWidth: 220 }}
          placeholder="Nick: Tất cả"
          maxTagCount="responsive"
          value={uid ? uid.split(',') : []}
          onChange={(v: string[]) => set({ uid: v.join(',') || undefined })}
          options={(accounts.data ?? []).map((a) => ({ value: a.uid, label: nickName(a.label, a.ownerName) }))}
        />
        <DatePicker.RangePicker
          format="DD/MM/YYYY"
          placeholder={['Từ ngày', 'Đến ngày']}
          value={from || to ? [from ? dayjs(from) : null, to ? dayjs(to) : null] : null}
          onChange={(v) => set({ from: v?.[0]?.format('YYYY-MM-DD'), to: v?.[1]?.format('YYYY-MM-DD') })}
        />
      </Space>

      {first?.codeKind && <Tag color="blue">Nhận dạng: {KIND_TEXT[first.codeKind]}</Tag>}
      {first?.note && <Alert type="info" showIcon message={first.note} style={{ marginBottom: 12 }} />}

      {!q ? (
        <Typography.Text type="secondary">Gõ từ khóa, số điện thoại, mã phụ tùng hoặc biển số. Nhiều từ: tin phải chứa đủ các từ. Đặt trong "ngoặc kép" để tìm đúng cụm.</Typography.Text>
      ) : tooShort ? (
        <Typography.Text type="secondary">Nhập ít nhất 2 ký tự để tìm.</Typography.Text>
      ) : res.isLoading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : res.isError ? (
        <Alert type="error" showIcon message="Không tìm được lúc này. Vui lòng thử lại." action={<Button size="small" onClick={() => void res.refetch()}>Thử lại</Button>} />
      ) : items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`Không tìm thấy kết quả cho "${q}" trong phạm vi bạn được xem.`} />
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            {items.length.toLocaleString('vi-VN')}{res.hasNextPage ? '+' : ''} kết quả · {((first?.tookMs ?? 0) / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giây
          </Typography.Paragraph>
          <List
            dataSource={items}
            renderItem={(h: SearchHit) => (
              <List.Item key={h.id} style={{ padding: 0 }}>
                <Link to={hitLink(h)} style={{ display: 'block', width: '100%', padding: '10px 12px', color: 'inherit' }} aria-label={`Mở tin trong ${h.title}`}>
                  <List.Item.Meta
                    avatar={<ChatAvatar size={36} name={h.title} colorKey={h.threadId} />}
                    title={
                      <span>
                        {h.title} <Typography.Text type="secondary" style={{ fontWeight: 400 }}>· {nickName(h.accountLabel, h.accountOwner)} · {h.voice && <AudioOutlined />} {fmtTime(h.sentAt)}</Typography.Text>
                      </span>
                    }
                    description={
                      <span>
                        {h.fromSelf ? 'Bạn: ' : h.senderName ? `${h.senderName}: ` : ''}
                        {splitMarks(h.snippet, h.marks).map((p, i) => (p.bold ? <mark key={i} style={{ padding: 0 }}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
                      </span>
                    }
                  />
                </Link>
              </List.Item>
            )}
          />
          {res.hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Button loading={res.isFetchingNextPage} onClick={() => void res.fetchNextPage()}>Xem thêm</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
