import { useState } from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { NO_ACCESS_TEXT } from '@vclinks/shared';
import { ApiError } from '../../api';
import { usePermissions } from '../../state/permissions';
import AccessRequestModal from './AccessRequestModal';

/** The API answered "no access" (403) or "not found" (404): both look the same to the user (NT8, MH-PQ-11 form B). */
export function isNoAccessError(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 403 || e.status === 404);
}

/**
 * MH-PQ-11 "Không có quyền".
 * - Form A (page): a route the user's roles never open. No request button.
 * - Form B (object): a conversation / customer outside the user's scope, or one that does not exist.
 *   It never shows a name, content or owner, only the code the user typed.
 */
export default function NoAccess(props: { kind: 'page'; pageName: string; roles: string[] } | { kind: 'object'; code: string }) {
  const navigate = useNavigate();
  const perms = usePermissions();
  const [asking, setAsking] = useState(false);
  const home = (
    <Button key="home" onClick={() => navigate('/conversations')}>
      Về Hộp thư
    </Button>
  );

  if (props.kind === 'page') {
    return (
      <Result
        status="403"
        title={NO_ACCESS_TEXT.pageTitle}
        subTitle={`Trang ${props.pageName} dành cho ${props.roles.join(', ')}. Nếu bạn cần dùng, hãy liên hệ quản trị viên.`}
        extra={home}
      />
    );
  }
  // Viewers with no `grant.request` (observers) get no request button.
  const canAsk = perms.has('grant.request');
  return (
    <>
      <Result
        status="403"
        title={NO_ACCESS_TEXT.objectTitle}
        subTitle={NO_ACCESS_TEXT.objectDescription(props.code)}
        extra={[
          canAsk && (
            <Button key="ask" type="primary" onClick={() => setAsking(true)}>
              Xin quyền truy cập
            </Button>
          ),
          home,
        ]}
      />
      <AccessRequestModal open={asking} targetId={props.code} onClose={() => setAsking(false)} />
    </>
  );
}
