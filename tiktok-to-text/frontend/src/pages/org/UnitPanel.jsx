// Khung đơn vị đang chọn ở tab Sơ đồ (SCR-18): đầu khung (tên, mã, loại, chức năng, trưởng đơn vị, menu Thêm ▾ thao
// tác đơn vị) + bảng người (DataTable) — tên người là link ?person=<id> mở hồ sơ (PersonDrawer).
import { useMemo } from 'react'
import { DataTable } from '../../components/DataTable'
import { ActionMenu, RowActions } from '../../components/ActionMenu'
import { StatusBadge } from '../../components/StatusBadge'
import { KIND, LEVELS, fnNameOf, personStatus } from './shared'
import { offboardConfirm, usePersonActions, usePersonLink } from './PersonDrawer'

export default function UnitPanel({ ctx, unit, unassigned, actions }) {
  const { admin, people } = ctx
  const fnName = fnNameOf(ctx.functions)
  const link = usePersonLink()
  const { offboard, rejoin, edit } = usePersonActions(ctx)
  const byId = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people])

  if (!unit && !unassigned) {
    return (
      <section className="card org-unit-panel" aria-label="Người trong đơn vị">
        <p className="muted">Chọn một đơn vị trong cây để xem người trong đơn vị.</p>
      </section>
    )
  }
  const list = (unassigned
    ? people.filter((p) => !p.org?.unit_ids?.length && p.active)
    : people.filter((p) => p.org?.unit_ids?.includes(unit.id)))
    .sort((a, b) => (a.org?.status === 'left') - (b.org?.status === 'left') || a.name.localeCompare(b.name))
  const working = list.filter((p) => p.org?.status !== 'left').length
  const title = unassigned ? 'Chưa xếp đơn vị' : unit.name
  const meta = unit && [unit.code, KIND[unit.kind], unit.function && `chức năng ${fnName(unit.function)}`, unit.head && `trưởng: ${unit.head.name}`]
    .filter(Boolean).join(' · ')

  return (
    <section className="card org-unit-panel unit-people" aria-labelledby="org-unit-h" data-testid="org-unit-panel"
      data-id={unit?.id || 'none'} data-status={unit ? (unit.active ? 'active' : 'hidden') : undefined}>
      <div className="org-card-head">
        <div className="org-unit-title">
          <h2 id="org-unit-h" className="org-h2">{title}</h2>
          {unit && !unit.active && <StatusBadge kind="orgActive" status="hidden" />}
          {meta && <p className="muted small org-flush">{meta}</p>}
          <p className="muted small org-flush" data-testid="org-unit-count">{working} người đang làm</p>
        </div>
        {admin && unit && <ActionMenu name={unit.name} items={actions} testId="org-unit-more" />}
      </div>
      <DataTable
        caption={`Người trong ${title}`}
        rows={list}
        rowTestId="org-person-row"
        getStatus={personStatus}
        rowName={(p) => p.name}
        testId="org-people"
        empty="Chưa có ai trong đơn vị này."
        columns={[
          { key: 'name', header: 'Họ tên', title: true, to: (p) => link(p.id), render: (p) => (
            <span className="org-person">
              <span>{p.name}</span>
              <span className="muted small org-email">{p.email}</span>
            </span>
          ) },
          { key: 'position', header: 'Chức danh', render: (p) => (
            <>
              {[p.org?.position, p.org?.function && fnName(p.org.function)].filter(Boolean).join(' · ') || <span className="muted">—</span>}
              {unit && p.org?.unit_ids?.[0] !== unit.id && <> <span className="ui-badge" data-tone="info">Kiêm nhiệm</span></>}
            </>
          ) },
          { key: 'level', header: 'Cấp bậc', className: 'org-nowrap', render: (p) => (p.org?.level ? `cấp ${p.org.level} · ${LEVELS[p.org.level]}` : <span className="muted">—</span>) },
          { key: 'manager', header: 'Quản lý trực tiếp', render: (p) => (p.org?.manager_id ? byId[p.org.manager_id]?.name || '—' : <span className="muted">—</span>) },
          { key: 'status', header: 'Trạng thái', className: 'org-nowrap', render: (p) => <StatusBadge kind="orgPerson" status={personStatus(p)} /> },
        ]}
        actions={admin ? (p) => (
          personStatus(p) === 'left'
            ? <RowActions name={p.name} actions={[{ label: 'Cho đi làm lại', onSelect: () => rejoin(p), testId: 'org-person-rejoin' }]} />
            : <RowActions name={p.name} testId="org-person" actions={[
              { label: 'Sửa hồ sơ', onSelect: () => edit(p), testId: 'org-person-edit' },
              { label: 'Nghỉ việc…', danger: true, onSelect: () => offboard(p), testId: 'org-person-offboard', confirm: offboardConfirm(p) },
            ]} />
        ) : undefined}
      />
    </section>
  )
}

