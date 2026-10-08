import { cloneElement, type ReactElement } from 'react';
import { Tooltip } from 'antd';
import type { PermissionKey } from '@vclinks/shared';
import { usePermissions } from '../../state/permissions';

/**
 * D8-02 around one button: no role ever has the key -> hidden; has it but a condition is missing
 * (`lockReason`, a mode like "chỉ đề xuất", an unmet cond) -> disabled with the reason as tooltip.
 */
export default function Can({
  perm,
  lockReason,
  needFull,
  children,
}: {
  perm: PermissionKey;
  lockReason?: string | null;
  needFull?: boolean;
  children: ReactElement;
}) {
  const b = usePermissions().button(perm, { lockReason, needFull });
  if (b.state === 'hide') return null;
  if (b.state === 'lock') {
    return (
      <Tooltip title={b.reason}>
        <span style={{ display: 'inline-block' }}>{cloneElement(children, { disabled: true })}</span>
      </Tooltip>
    );
  }
  return children;
}
