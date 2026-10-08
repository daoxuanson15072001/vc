// Trang 404 trong app (SEO-02): đường dẫn lạ không còn tự chuyển về trang đầu — nói rõ không có trang này và đưa
// liên kết về. Máy chủ trả mã 404 thật cho đường dẫn ngoài routes.json; trang này lo phần chuyển trang trong app.
import { Link, useLocation } from 'react-router-dom'

export default function NotFound() {
  const { pathname } = useLocation()
  return (
    <section className="ui-notfound" data-testid="not-found">
      <h1>Không tìm thấy trang</h1>
      <p className="muted">
        Không có trang <code>{pathname}</code>. Có thể đường dẫn gõ sai, hoặc trang đã đổi chỗ.
      </p>
      <Link className="ui-btn ui-btn-primary" to="/">Về Việc của tôi</Link>
    </section>
  )
}
