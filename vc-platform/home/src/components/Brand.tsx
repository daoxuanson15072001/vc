import { Link } from 'react-router-dom';

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="vh-brand" aria-label="VC Home, về trang chủ">
      <img src="/vc-logo.svg" alt="" width={36} height={36} />
      <span className="vh-brand-text">
        <strong>VC Home</strong>
        <small>VC Phồn Vinh</small>
      </span>
    </Link>
  );
}
