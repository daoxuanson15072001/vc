import { useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Input, List, Skeleton, Tabs, Tag, Typography } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../api';
import type { ChatMessage } from '../../types';
import { groupByDay, searchLoaded, type SharedItem } from '../../utils/info-panel';
import { messageSummary } from '../../utils/chat';
import { bubbleTime } from '../../utils/time';
import ChatAvatar from './ChatAvatar';
import QuotesPanel from '../customers/QuotesPanel';
import { useParticipants } from './commands';
import { FileCards, ImageGrid, LinkList, MediaImageGrid, VideoView } from './MediaViews';

type Kind = 'media' | 'file' | 'link';
const PAGE = 30;

/** Pages of `/conversations/:id/shared` (photos + video, files, links), newest first. */
function useShared(conversationId: string, kind: Kind, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['shared', conversationId, kind],
    enabled,
    staleTime: 30_000,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<{ items: SharedItem[]; hasMore: boolean }>(`/conversations/${encodeURIComponent(conversationId)}/shared`, {
        query: { kind, limit: PAGE, before: pageParam },
      }),
    getNextPageParam: (last) => (last.hasMore && last.items.length ? last.items[last.items.length - 1].sentAt : undefined),
  });
}

function SharedList({ conversationId, kind, empty, render }: { conversationId: string; kind: Kind; empty: string; render: (items: SharedItem[]) => React.ReactNode }) {
  const q = useShared(conversationId, kind, true);
  if (q.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (q.isError) return <Alert type="error" showIcon message="Không tải được danh sách." action={<Button size="small" onClick={() => q.refetch()}>Thử lại</Button>} />;
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (!items.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} />;
  return (
    <>
      {render(items)}
      {q.hasNextPage && (
        <Button block size="small" style={{ marginTop: 8 }} loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
          Tải thêm
        </Button>
      )}
    </>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  title: string;
  avatar?: string | null;
  isGroup: boolean;
  /** Messages already loaded in the chat, for the stop-gap search tab. */
  messages: ChatMessage[];
  /** Scrolls the chat to a loaded message. */
  onJump?: (m: ChatMessage) => void;
}

/**
 * Conversation info panel (03 MH-SZ-07): members, photos/videos, files, links, quotes sent, search in conversation.
 * Opened from the chat header or the message menu. Everything shown is already visible in the conversation itself
 * (same `conv.view` check on the server); nothing here widens access.
 * Tab "Khách" and "Tra hàng" belong to M1c-01 / the customer panel on the right and are not duplicated here.
 */
export default function ConversationInfoPanel({ open, onClose, conversationId, title, avatar, isGroup, messages, onJump }: Props) {
  const [tab, setTab] = useState('members');
  const [query, setQuery] = useState('');
  const participants = useParticipants(conversationId, open && tab === 'members');
  const found = useMemo(() => searchLoaded(messages, query), [messages, query]);

  const items = [
    {
      key: 'members',
      label: isGroup ? 'Thành viên' : 'Người nhắn',
      children: participants.isLoading ? (
        <Skeleton active avatar paragraph={{ rows: 3 }} />
      ) : !participants.data?.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isGroup ? 'Chưa biết thành viên nào của nhóm' : 'Chưa có người nhắn'} />
      ) : (
        <List
          size="small"
          dataSource={participants.data}
          renderItem={(p) => (
            <List.Item>
              <List.Item.Meta
                avatar={<ChatAvatar size={32} name={p.name} colorKey={p.uid} />}
                title={p.name}
                description={p.messages ? `${p.messages} tin` : 'Chưa nhắn trong hội thoại'}
              />
            </List.Item>
          )}
        />
      ),
    },
    {
      key: 'media',
      label: 'Ảnh/Video',
      children: (
        <SharedList
          conversationId={conversationId}
          kind="media"
          empty="Chưa có ảnh/video nào"
          render={(rows) =>
            groupByDay(rows).map((g) => (
              <div key={g.day} style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary">{g.day}</Typography.Text>
                {g.items.map((it) => (
                  <div key={it.id} style={{ marginTop: 4 }}>
                    {it.images?.length ? <ImageGrid images={it.images} /> : null}
                    {it.mediaImages?.length ? <MediaImageGrid ids={it.mediaImages} /> : null}
                    {it.video ? <VideoView video={it.video} /> : null}
                  </div>
                ))}
              </div>
            ))
          }
        />
      ),
    },
    {
      key: 'file',
      label: 'File',
      children: (
        <SharedList
          conversationId={conversationId}
          kind="file"
          empty="Chưa có file nào"
          render={(rows) => rows.map((it) => (
            <div key={it.id} style={{ marginBottom: 6 }}>
              <FileCards files={it.files ?? []} compact />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{new Date(it.sentAt).toLocaleDateString('vi-VN')}</Typography.Text>
            </div>
          ))}
        />
      ),
    },
    {
      key: 'link',
      label: 'Link',
      children: (
        <SharedList
          conversationId={conversationId}
          kind="link"
          empty="Chưa có link nào"
          render={(rows) => <LinkList links={rows.flatMap((it) => [...(it.links ?? []), ...(it.card?.url ? [it.card.url] : [])])} />}
        />
      ),
    },
    {
      key: 'quotes',
      label: 'Báo giá',
      // M1c-02: quotes of the customer of this chat, read live from VCsales, with how often each was sent.
      children: open && tab === 'quotes' ? <QuotesPanel uid={conversationId.slice(0, conversationId.indexOf(':'))} threadId={conversationId.slice(conversationId.indexOf(':') + 1)} /> : null,
    },
    {
      key: 'search',
      label: 'Tìm',
      children: (
        <>
          <Input.Search allowClear placeholder="Tìm trong hội thoại (từ 2 ký tự)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '6px 0' }}>
            Đang tìm trong các tin đã tải ở khung chat ({messages.length} tin). Tìm toàn bộ lịch sử sẽ có khi tìm kiếm máy chủ hoàn thành.
          </Typography.Paragraph>
          {query.trim().length >= 2 && !found.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`Không thấy "${query.trim()}" trong các tin đã tải`} />
          ) : (
            <List
              size="small"
              dataSource={found}
              renderItem={(m) => (
                <List.Item style={{ cursor: onJump ? 'pointer' : undefined }} onClick={() => { onJump?.(m); onClose(); }}>
                  <List.Item.Meta
                    title={<span>{m.senderName ?? ''} <Tag>{bubbleTime(m.sentAt)}</Tag></span>}
                    description={messageSummary(m)}
                  />
                </List.Item>
              )}
            />
          )}
        </>
      ),
    },
  ];

  return (
    <Drawer open={open} onClose={onClose} width={360} destroyOnClose title="Thông tin hội thoại" styles={{ body: { padding: 12 } }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <ChatAvatar size={44} name={title} src={avatar} colorKey={conversationId} group={isGroup} />
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong style={{ display: 'block' }}>{title}</Typography.Text>
          <Typography.Text type="secondary">{isGroup ? 'Nhóm' : 'Hội thoại 1-1'}</Typography.Text>
        </div>
      </div>
      <Tabs size="small" activeKey={tab} onChange={setTab} items={items} />
    </Drawer>
  );
}
