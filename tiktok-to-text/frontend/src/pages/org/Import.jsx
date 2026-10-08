// Tab Nhập dữ liệu (SCR-18, ORG-04 — chỉ quản trị viên): chọn file Excel / CSV **hoặc** dán bảng CSV (AIX-09) →
// Xem trước (báo lỗi từng dòng, cột Kết quả đứng đầu) → Xác nhận nhập; mật khẩu tài khoản mới hiện một lần.
import { useState } from 'react'
import { api } from '../../api'
import { StatusBadge } from '../../components/StatusBadge'
import { Notice } from '../../components/Notice'
import { run } from './shared'

const TEMPLATE = 'Email,Họ tên,Mã đơn vị,Chức năng,Email quản lý,Email quản lý chuyên môn,Chức danh,Cấp bậc\n' +
  'nguyen.van.a@vcprosperous.com,Nguyễn Văn A,VCPART-KD,sales,truong.phong@vcprosperous.com,,Nhân viên kinh doanh,2\n'
const TEMPLATE_URL = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${TEMPLATE}`)}`
const COLS = ['Dòng', 'Kết quả', 'Email', 'Họ tên', 'Đơn vị', 'Chức năng', 'Quản lý', 'QL chuyên môn', 'Chức danh', 'Cấp bậc']

export default function Import({ ctx }) {
  const [file, setFile] = useState(null)
  const [pasted, setPasted] = useState('')        // AIX-09: dán bảng CSV thay cho chọn file (agent không chọn file được)
  const [srcKind, setSrcKind] = useState('file')  // nguồn dùng khi bấm Xem trước: 'file' | 'paste' (cái sửa gần nhất)
  const source = srcKind === 'paste'
    ? (pasted.trim() ? new File([pasted.endsWith('\n') ? pasted : `${pasted}\n`], 'dan.csv', { type: 'text/csv' }) : null)
    : file
  const [preview, setPreview] = useState(null)
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)
  const reset = () => { setPreview(null); setDone(null) }

  const go = async (dryRun) => {
    setBusy(true)
    const r = await run(() => api.orgImport(source, dryRun),
      dryRun ? null : (x) => (x.applied ? `Đã nhập ${x.counts.create} tài khoản mới, ${x.counts.update} cập nhật` : 'Chưa ghi gì — file còn dòng lỗi'))
    setBusy(false)
    if (!r) return
    if (dryRun) { setPreview(r); setDone(null) } else { setDone(r); setPreview(r.applied ? null : r); if (r.applied) ctx.bump() }
  }
  const shown = preview || done
  const c = shown?.counts

  return (
    <div className="org-stack">
      <section className="card org-stack" aria-labelledby="org-import-h">
        <h2 id="org-import-h" className="org-h2">Nhập cơ cấu từ Excel / CSV</h2>
        <p className="muted small org-flush">
          Mỗi dòng một người, cột: <b>Email · Họ tên · Mã đơn vị · Chức năng · Email quản lý · Email quản lý chuyên môn · Chức danh · Cấp bậc</b> (1–7, để trống = chưa xếp; file không có cột Cấp bậc thì giữ cấp bậc đang có).
          Chức năng bỏ trống thì lấy theo phòng. Người chưa có tài khoản được tạo với mật khẩu ngẫu nhiên. Chạy lại cùng file không tạo trùng.
          Đơn vị phải có sẵn trong cây. <a href={TEMPLATE_URL} download="mau_nhap_to_chuc.csv">Tải file mẫu (CSV)</a>
        </p>
        <label className="field org-flush"><span>File Excel / CSV</span>
          <input type="file" accept=".xlsx,.csv" data-testid="org-import-file"
            onChange={(e) => { setFile(e.target.files[0] || null); setSrcKind('file'); reset() }} />
        </label>
        <label className="field org-flush">
          <span>Hoặc dán bảng CSV</span>
          <textarea rows={4} className="mono small" value={pasted} data-testid="org-import-paste" placeholder={TEMPLATE}
            onChange={(e) => { setPasted(e.target.value); setSrcKind(e.target.value.trim() ? 'paste' : 'file'); reset() }} />
          <small>Không chọn được file? Dán nội dung CSV (dòng đầu là tiêu đề cột như file mẫu) rồi bấm Xem trước. Dùng nguồn bạn chọn hoặc dán gần nhất.</small>
        </label>
        <div className="org-actions">
          <button type="button" className={`ui-btn${preview ? '' : ' ui-btn-primary'}`} disabled={!source || busy} data-testid="org-import-preview" onClick={() => go(true)}>Xem trước</button>
          {preview && (
            <button type="button" className="ui-btn ui-btn-primary" disabled={busy || c.error > 0 || !preview.total} data-testid="org-import-apply" onClick={() => go(false)}>Xác nhận nhập</button>
          )}
        </div>
      </section>

      {done?.applied && (
        <section className="card org-stack import-done" aria-labelledby="org-import-done-h" data-testid="org-import-done">
          <h2 id="org-import-done-h" className="org-h2">Đã nhập</h2>
          <Notice tone="good">{c.create} tài khoản mới · {c.update} cập nhật · {c.unchanged} giữ nguyên.</Notice>
          {done.created.length > 0 && (
            <>
              <p className="small org-flush"><b>Mật khẩu chỉ hiện một lần</b> — sao chép và gửi riêng cho từng người; họ tự đổi sau khi đăng nhập.</p>
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">Tài khoản mới tạo và mật khẩu ban đầu</caption>
                  <thead><tr><th scope="col">Email</th><th scope="col">Họ tên</th><th scope="col">Mật khẩu</th></tr></thead>
                  <tbody>{done.created.map((u) => <tr key={u.email}><td>{u.email}</td><td>{u.name}</td><td className="mono">{u.password}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {preview && (
        <section className="card table-wrap import-preview" aria-labelledby="org-import-preview-h" data-testid="org-import-preview-table">
          <div className="org-preview-head">
            <h2 id="org-import-preview-h" className="org-h2">Xem trước — {preview.total} dòng</h2>
            <p className="small org-flush">
              {c.create} tạo mới · {c.update} cập nhật · {c.unchanged} giữ nguyên · <span className={c.error ? 'tone-bad' : ''}>{c.error} dòng lỗi</span>
              {c.error > 0 && ' — sửa file rồi xem trước lại; còn lỗi thì không ghi dòng nào.'}
              {preview.dry_run === false && !preview.applied && ' Chưa ghi gì.'}
            </p>
          </div>
          <table className="table">
            <caption className="sr-only">Xem trước nhập cơ cấu: {preview.total} dòng, {c.error} dòng lỗi. Cột Kết quả ghi lỗi từng dòng.</caption>
            <thead><tr>{COLS.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.row} data-id={r.row} data-status={r.action} data-testid="org-import-row">
                  <td className="num">{r.row}</td>
                  <td className="import-result">
                    <StatusBadge kind="orgImport" status={r.action} />
                    {r.errors.map((e) => <div key={e} className="small tone-bad"><span className="sr-only">Lỗi: </span>{e}</div>)}
                  </td>
                  <td>{r.email}</td>
                  <td>{r.name}</td>
                  <td>{r.unit_code}</td>
                  <td>{r.function || ''}</td>
                  <td>{r.manager_email}</td>
                  <td>{r.functional_manager_email}</td>
                  <td>{r.position || ''}</td>
                  <td className="num">{r.level || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
