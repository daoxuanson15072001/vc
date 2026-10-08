import { Dropdown, Tag } from 'antd';
import type { CatalogApp } from '../lib/catalog';
import { IconMore, IconPin } from './icons';

/** Ô app (VH-HOM-01): a plain link, so Ctrl/⌘ + click and middle click open a new tab. */
export function AppTile({ app, pinned, onTogglePin }: { app: CatalogApp; pinned: boolean; onTogglePin(): void }) {
  return (
    <li className="vh-tile" data-app={app.key}>
      <a href={app.url ?? undefined} className="vh-tile-link">
        <img src={app.icon} alt="" width={44} height={44} className="vh-tile-icon" />
        <span className="vh-tile-text">
          <span className="vh-tile-name">
            {app.name}
            {app.status === 'beta' && <Tag className="vh-tag-beta">Thử nghiệm</Tag>}
          </span>
          <span className="vh-tile-desc" title={app.description}>
            {app.description}
          </span>
        </span>
      </a>
      {pinned && (
        <span className="vh-tile-pin" title="Đã ghim">
          <IconPin />
          <span className="vh-sr">Đã ghim</span>
        </span>
      )}
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{ items: [{ key: 'pin', label: pinned ? 'Bỏ ghim' : 'Ghim lên đầu' }], onClick: onTogglePin }}
      >
        <button type="button" className="vh-tile-more" aria-label={`Tuỳ chọn cho ${app.name}`}>
          <IconMore />
        </button>
      </Dropdown>
    </li>
  );
}

export function SoonTile({ app }: { app: CatalogApp }) {
  const hint = app.eta ? `${app.description}. Dự kiến: ${app.eta}` : app.description;
  return (
    <li className="vh-tile is-soon" aria-disabled="true" title={hint} data-app={app.key}>
      <div className="vh-tile-link">
        <img src={app.icon} alt="" width={44} height={44} className="vh-tile-icon" />
        <span className="vh-tile-text">
          <span className="vh-tile-name">
            {app.name}
            <Tag className="vh-tag-soon">Sắp có</Tag>
          </span>
          <span className="vh-tile-desc">{app.description}</span>
        </span>
      </div>
    </li>
  );
}
