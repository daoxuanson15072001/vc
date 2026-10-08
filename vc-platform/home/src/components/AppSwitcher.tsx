/** Nút 9 chấm (VH-MH-21): VC Home first, then the apps this person may open. VC Home is the current app here. */
import { Dropdown } from 'antd';
import type { CatalogApp } from '../lib/catalog';
import { IconCheck, IconGrid } from './icons';

export function AppSwitcher({ apps, current = 'vchome' }: { apps: CatalogApp[]; current?: string }) {
  const items = [
    {
      key: 'vchome',
      label: (
        <a href="/" className="vh-switch-item" aria-current={current === 'vchome' ? 'page' : undefined}>
          <img src="/vc-logo.svg" alt="" width={28} height={28} />
          <span>VC Home</span>
          {current === 'vchome' && <IconCheck className="vh-switch-check" />}
        </a>
      ),
    },
    { type: 'divider' as const },
    ...apps.map((a) => ({
      key: a.key,
      label: (
        <a href={a.url ?? '#'} className="vh-switch-item" aria-current={current === a.key ? 'page' : undefined}>
          <img src={a.icon} alt="" width={28} height={28} />
          <span>{a.name}</span>
          {current === a.key && <IconCheck className="vh-switch-check" />}
        </a>
      ),
    })),
  ];
  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight" overlayClassName="vh-switch-menu">
      <button type="button" className="vh-icon-btn" aria-label="Chuyển ứng dụng">
        <IconGrid />
      </button>
    </Dropdown>
  );
}
