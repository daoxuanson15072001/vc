// Thông báo giữ trên trang (DESIGN V.5 CMP-11): bốn tông info / good / warn / bad, có biểu tượng + chữ.
// bad → role="alert"; còn lại role="status". Phản hồi sau một hành động dùng toast(), không dùng Notice.
import { Icon } from './icons'

const ICON = { info: 'info', good: 'check-circle', warn: 'alert', bad: 'x-circle' }

export function Notice({ tone = 'info', title, children, action, testId }) {
  return (
    <div className={`ui-notice ui-notice-${tone}`} role={tone === 'bad' ? 'alert' : 'status'} data-testid={testId}>
      <Icon name={ICON[tone]} size={16} />
      <div className="ui-notice-body">
        {title && <b>{title} </b>}
        {children}
      </div>
      {action}
    </div>
  )
}
