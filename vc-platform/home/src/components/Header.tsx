import { Dropdown } from 'antd';
import { Link } from 'react-router-dom';
import { claims, useAuth } from '../lib/auth';
import { myApps } from '../lib/catalog';
import { useCatalog } from '../lib/catalog-context';
import { AppSwitcher } from './AppSwitcher';
import { Brand } from './Brand';
import { IconChevronDown } from './icons';
import { UserAvatar } from './UserAvatar';

export function Header() {
  const { state, logout } = useAuth();
  const { apps } = useCatalog();
  if (state.status !== 'authenticated') return null;
  const c = claims(state.user);
  const items = [
    { key: 'ho-so', label: <Link to="/ho-so">Hồ sơ</Link> },
    { key: 'dang-xuat', label: 'Đăng xuất', onClick: () => void logout() },
  ];
  return (
    <header className="vh-header">
      <Brand />
      <div className="vh-header-right">
        <AppSwitcher apps={myApps(apps, c.groups)} />
        <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
          <button type="button" className="vh-account" aria-label={`Menu tài khoản của ${c.givenName || c.email}`}>
            <UserAvatar sub={c.sub} name={c.name} email={c.email} picture={c.picture} />
            <span className="vh-account-name">{c.givenName || c.email}</span>
            <IconChevronDown />
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
