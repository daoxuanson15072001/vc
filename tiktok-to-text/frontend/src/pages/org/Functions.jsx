// Tab Chức năng (SCR-18, ORG-02 — chỉ quản trị viên): bảng chức năng, sửa trong Modal, ẩn / hiện, thêm chức năng.
import { useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { DataTable } from '../../components/DataTable'
import { RowActions } from '../../components/ActionMenu'
import { StatusBadge } from '../../components/StatusBadge'
import { Modal } from '../../components/Overlay'
import { run } from './shared'

export default function Functions({ ctx }) {
  const [form, setForm] = useState({ code: '', name: '' })
  const [editing, setEditing] = useState(null)
  const { data: cats } = useFetch(() => api.categories(), [])
  const roots = (cats || []).filter((c) => c.level === 1)
  const rootName = (slug) => roots.find((c) => c.slug === slug)?.name || slug

  return (
    <div className="org-split org-split-form">
      <section className="org-stack" aria-labelledby="org-fn-h">
        <h2 id="org-fn-h" className="org-h2">Danh mục chức năng</h2>
        <p className="muted small org-flush">
          Trục cắt ngang các Division (Kinh doanh, Marketing, Tài chính – Kế toán…). Mỗi phòng gắn một chức năng, mỗi người có một chức năng chính.
          Mã không đổi được sau khi tạo. <b>Mảng tri thức</b> = nhánh gốc cây lĩnh vực ứng với chức năng — là “mảng của mình” khi chọn bậc nội dung theo cấp bậc.
        </p>
        <DataTable
          caption="Danh mục chức năng"
          rows={ctx.functions}
          rowTestId="org-function-row"
          getStatus={(f) => (f.active ? 'active' : 'hidden')}
          rowName={(f) => f.name}
          empty="Chưa có chức năng nào."
          columns={[
            { key: 'name', header: 'Tên', title: true },
            { key: 'code', header: 'Mã', render: (f) => <code>{f.code}</code> },
            { key: 'root', header: 'Mảng tri thức', render: (f) => (f.category_root ? rootName(f.category_root) : <span className="muted">—</span>) },
            { key: 'count', header: 'Phòng · người', render: (f) => `${f.unit_count} · ${f.people_count}` },
            { key: 'status', header: 'Trạng thái', render: (f) => <StatusBadge kind="orgActive" status={f.active ? 'active' : 'hidden'} /> },
          ]}
          actions={(f) => (
            <RowActions name={f.name} actions={[
              { label: 'Sửa', onSelect: () => setEditing({ id: f.id, name: f.name, category_root: f.category_root || '' }) },
              { label: f.active ? 'Ẩn' : 'Hiện', onSelect: () => run(() => api.patchOrgFunction(f.id, { active: !f.active }), `Đã ${f.active ? 'ẩn' : 'hiện'} chức năng ${f.name}`, ctx.bump) },
            ]} />
          )}
        />
      </section>

      <form className="card form" aria-labelledby="org-fn-add-h" onSubmit={async (e) => {
        e.preventDefault()
        if (await run(() => api.createOrgFunction(form), `Đã thêm chức năng ${form.name}`, ctx.bump)) setForm({ code: '', name: '' })
      }}>
        <h2 id="org-fn-add-h" className="org-h2">Thêm chức năng</h2>
        <label className="field"><span>Mã</span>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} placeholder="vd finance" required />
          <small>Chữ thường không dấu, chữ số, gạch ngang</small>
        </label>
        <label className="field"><span>Tên</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="vd Tài chính – Kế toán" required /></label>
        <button type="submit" className="ui-btn ui-btn-primary">Thêm chức năng</button>
      </form>

      {editing && (
        <Modal open title={`Sửa chức năng ${editing.name}`} size="sm" onClose={() => setEditing(null)} testId="org-function-modal"
          footer={(
            <>
              <button type="button" className="ui-btn" onClick={() => setEditing(null)}>Huỷ</button>
              <button type="submit" form="org-function-form" className="ui-btn ui-btn-primary">Lưu chức năng</button>
            </>
          )}>
          <form id="org-function-form" onSubmit={async (e) => {
            e.preventDefault()
            const ok = await run(() => api.patchOrgFunction(editing.id, { name: editing.name, category_root: editing.category_root }), `Đã lưu chức năng ${editing.name}`, ctx.bump)
            if (ok) setEditing(null)
          }}>
            <label className="field"><span>Tên chức năng</span>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </label>
            <label className="field"><span>Mảng tri thức</span>
              <select value={editing.category_root} onChange={(e) => setEditing({ ...editing, category_root: e.target.value })}>
                <option value="">— Không gắn —</option>
                {roots.map((c) => <option key={c.slug} value={c.slug}>{c.code ? `${c.code} ` : ''}{c.name}</option>)}
              </select>
            </label>
          </form>
        </Modal>
      )}
    </div>
  )
}
