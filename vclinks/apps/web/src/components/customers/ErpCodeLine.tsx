import { useState } from 'react';
import { Alert, App, Button, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import type { Customer360 } from '@vclinks/shared';
import { usePermissions } from '../../state/permissions';
import ErpLinkModal from './ErpLinkModal';
import ErpTaskFormModal from './ErpTaskFormModal';
import { useCreateErpTask } from './erpTaskApi';

/**
 * "Mã KH" line of the customer panel and page (MH-DK-10): the linked VCsales code, or "Liên kết mã KH…" (sale admin),
 * "Đưa vào hàng chờ tạo mã" (owner, sale admin; MH-DK-12). With a code: verified phones / e-mails VCsales lacks and
 * "Tạo đề xuất cập nhật" (SA-04, MH-DK-10 #5).
 */
export default function ErpCodeLine({ data: d, bare = false }: { data: Customer360; bare?: boolean }) {
  const { message } = App.useApp();
  const perms = usePermissions();
  const [linking, setLinking] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const create = useCreateErpTask();
  const c = d.customer;
  const erp = c.erpLinks.find((l) => l.erp === 'vcsales' && l.status === 'confirmed');
  const sa = d.viewer.canConfirmErp;
  const mayQueue = d.viewer.isOwner || sa;
  const waiting = d.erpTasks.find((t) => t.kind === 'create_customer');
  const pending = d.erpDiff.filter((x) => !x.queued);
  const propose = async () => {
    try {
      for (const p of pending) await create.mutateAsync({ kind: p.kind === 'phone' ? 'update_phone' : 'update_email', accountId: c.id, pointId: p.pointId });
      message.success('Đã tạo đề xuất cập nhật cho sale admin.');
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  return (
    <div>
      {!bare && 'Mã KH: '}
      {erp ? (
        <Tag color="green">{erp.customerId} ✓</Tag>
      ) : (
        <>
          <Typography.Text type="secondary">Chưa liên kết</Typography.Text>
          {perms.has('cust.erp_link') && (
            <Button type="link" size="small" onClick={() => setLinking(true)}>
              Liên kết mã KH…
            </Button>
          )}
          {waiting ? (
            <Link to="/customers/erp-tasks?tab=create">
              <Tag color={waiting.status === 'waiting_sale' ? 'warning' : 'processing'}>{waiting.status === 'waiting_sale' ? 'Phiếu tạo mã cần bổ sung' : 'Đang chờ tạo mã KH'}</Tag>
            </Link>
          ) : (
            mayQueue && (
              <Button type="link" size="small" onClick={() => setQueueing(true)}>
                Đưa vào hàng chờ tạo mã
              </Button>
            )
          )}
        </>
      )}
      {erp && pending.length > 0 && mayQueue && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 6 }}
          message={`${pending.map((p) => p.masked).join(', ')} khách đang dùng chưa có trên VCsales.`}
          action={
            <Button size="small" loading={create.isPending} onClick={() => void propose()}>
              Tạo đề xuất cập nhật
            </Button>
          }
        />
      )}
      {erp && d.erpDiff.some((x) => x.queued) && (
        <div>
          <Link to="/customers/erp-tasks?tab=update">
            <Typography.Text type="secondary">Đã đề xuất cập nhật VCsales.</Typography.Text>
          </Link>
        </div>
      )}
      {linking && (
        <ErpLinkModal
          open
          accountId={c.id}
          customerName={c.name}
          canReportDuplicates={sa}
          onQueue={
            mayQueue && !waiting
              ? () => {
                  setLinking(false);
                  setQueueing(true);
                }
              : undefined
          }
          onClose={() => setLinking(false)}
        />
      )}
      {queueing && <ErpTaskFormModal accountId={c.id} accountName={c.name} onClose={() => setQueueing(false)} />}
    </div>
  );
}
