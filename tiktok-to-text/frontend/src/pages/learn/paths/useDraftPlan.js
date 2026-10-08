// Trạng thái bản nháp lộ trình đang sửa ở trang Thiết kế (LRN-04): plan (tuần → bài → thẻ), kho lưu bài học, cờ ghi đè,
// lưu nháp qua PUT /learn/paths/<id>/design. Giữ ở Design.jsx để đổi bước không mất chữ đã sửa và chân trang chung
// (Lưu nháp / Tiếp) gọi được `save`.
import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { toast } from '../../../components/toast'

export function useDraftPlan(draft, onSaved) {
  const [plan, setPlan] = useState(() => structuredClone(draft.plan))
  const [spaceId, setSpaceId] = useState(draft.space_id || '')
  const { data: spaces } = useFetch(() => api.spaces(), [])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [notices, setNotices] = useState([])
  const [overwrite, setOverwrite] = useState(false)
  const [dirty, setDirty] = useState(false)
  const locked = draft.status !== 'draft'

  useEffect(() => {
    if (!spaceId && spaces?.length) setSpaceId((spaces.find((s) => s.type === 'personal' && s.my_role === 'owner') || spaces[0]).id)
  }, [spaces]) // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (fn) => { setDirty(true); setPlan((p) => { const n = structuredClone(p); fn(n); return n }) }

  // Trả bản nháp đã lưu, hoặc null khi lỗi (lỗi hiện ở `err`)
  const save = async ({ quiet = false } = {}) => {
    setErr(null)
    setBusy(true)
    const body = {
      title: plan.title || draft.title, space_id: spaceId || null, overwrite,
      exam: { blueprint: plan.exam?.blueprint || '', duration_min: Number(plan.exam?.duration_min || 45), pass_score: Number(plan.exam?.pass_score ?? 70) },
      weeks: plan.weeks.map((w) => ({
        week: w.week,
        lessons: w.lessons.filter((l) => l.cards.length).map((l) => ({
          lesson_id: l.lesson_id || null, title: l.title || 'Bài học', objectives: l.objectives || [], narrative: l.narrative || '', practice: l.practice || [],
          cards: l.cards.map((c) => ({ card_id: c.card_id })),
        })),
      })),
    }
    try {
      const d = await api.saveDesignDraft(draft.id, body)
      setPlan(structuredClone(d.plan))
      if (!quiet) toast(`Đã lưu nháp: ${d.lesson_ids.length} bài học nháp.`)
      setNotices(d.notices || [])
      setOverwrite(false)
      setDirty(false)
      onSaved(d)
      return d
    } catch (e) {
      setErr(e.message)
      return null
    } finally {
      setBusy(false)
    }
  }
  return { plan, edit, spaceId, setSpaceId, spaces, busy, err, notices, overwrite, setOverwrite, dirty, locked, save }
}
