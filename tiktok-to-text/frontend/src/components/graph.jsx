import { useEffect, useMemo, useRef } from 'react'

// Đồ thị lực kiểu Obsidian graph view, vẽ bằng canvas (không cần thư viện).
// Kéo nền để di chuyển, cuộn để phóng to, kéo nút để sắp lại, bấm nút để chọn, bấm đúp thẻ để mở.

export const TOPIC_COLORS = ['#e8335a', '#2f80ed', '#16a34a', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899',
  '#84cc16', '#f97316', '#14b8a6', '#6366f1', '#a16207', '#0ea5e9', '#d946ef', '#65a30d']
export const topicColor = (key) => TOPIC_COLORS[Number(String(key).slice(1)) % TOPIC_COLORS.length]

const LINK = { // chiều dài lò xo, độ cứng theo loại cạnh
  category: [70, 0.08], parent: [90, 0.3], tag: [60, 0.04], source: [40, 0.2], ai: [90, 0.06], topic: [80, 0.1],
}
const BASE_R = { card: 4, category: 6, tag: 3, topic: 9 }

function radius(n) {
  return BASE_R[n.kind] + Math.sqrt(n.deg) * (n.kind === 'card' ? 0.8 : 1.4)
}

function cssColors(el) {
  const s = getComputedStyle(el)
  const v = (k) => s.getPropertyValue(k).trim()
  return { text: v('--text'), muted: v('--muted'), border: v('--border'), surface: v('--surface'),
    primary: v('--primary'), info: v('--info'), good: v('--good'), warn: v('--warn') }
}

// Barnes-Hut: gom các nút xa thành một khối để tính lực đẩy O(n log n)
function repulse(nodes, alpha) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity
  for (const n of nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y) }
  const size = Math.max(x1 - x0, y1 - y0) + 1
  const root = { x0, y0, size, mass: 0, cx: 0, cy: 0, kids: null, node: null }
  const insert = (q, n, depth) => {
    q.cx = (q.cx * q.mass + n.x) / (q.mass + 1); q.cy = (q.cy * q.mass + n.y) / (q.mass + 1); q.mass += 1
    if (!q.kids && !q.node) { q.node = n; return }
    if (depth > 30) return
    if (!q.kids) {
      const h = q.size / 2
      q.kids = [0, 1, 2, 3].map((i) => ({ x0: q.x0 + (i & 1) * h, y0: q.y0 + (i >> 1) * h, size: h, mass: 0, cx: 0, cy: 0, kids: null, node: null }))
      const old = q.node; q.node = null
      insertKid(q, old, depth)
    }
    insertKid(q, n, depth)
  }
  const insertKid = (q, n, depth) => {
    const h = q.size / 2
    insert(q.kids[(n.x >= q.x0 + h ? 1 : 0) + (n.y >= q.y0 + h ? 2 : 0)], n, depth + 1)
  }
  for (const n of nodes) insert(root, n, 0)
  const strength = -60 * alpha
  const apply = (q, n) => {
    if (!q.mass || q.node === n) return
    let dx = q.cx - n.x; let dy = q.cy - n.y
    let d2 = dx * dx + dy * dy
    if (q.kids && (q.size * q.size) / (d2 || 1) > 0.81) { q.kids.forEach((k) => apply(k, n)); return }
    if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1 }
    if (d2 > 250000) return   // quá xa (>500px): bỏ qua
    const f = (strength * q.mass) / d2
    n.vx += dx * f; n.vy += dy * f
  }
  for (const n of nodes) apply(root, n)
}

function tick(sim) {
  const { nodes, links } = sim
  sim.alpha += (sim.alphaTarget - sim.alpha) * 0.02
  const a = sim.alpha
  repulse(nodes, a)
  for (const l of links) {
    const [len, k] = LINK[l.kind] || [60, 0.05]
    const dx = l.t.x - l.s.x; const dy = l.t.y - l.s.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const f = ((d - len) / d) * k * a
    const bs = l.t.deg / (l.s.deg + l.t.deg)   // nút ít cạnh dịch nhiều hơn
    l.t.vx -= dx * f * (1 - bs); l.t.vy -= dy * f * (1 - bs)
    l.s.vx += dx * f * bs; l.s.vy += dy * f * bs
  }
  for (const n of nodes) {
    n.vx -= n.x * 0.004 * a; n.vy -= n.y * 0.004 * a      // kéo nhẹ về tâm
    if (n.fx != null) { n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0; continue }
    n.vx *= 0.6; n.vy *= 0.6
    n.x += n.vx; n.y += n.vy
  }
}

export function ForceGraph({ nodes, edges, selected, focus, highlight, onSelect, onOpen, summary }) {
  const wrap = useRef(null)
  const canvas = useRef(null)
  const pos = useRef(new Map())          // giữ vị trí khi đổi bộ lọc
  const state = useRef({ sim: null, view: { x: 0, y: 0, k: 1 }, hover: null, drag: null, raf: 0, colors: null })
  const cb = useRef({})
  cb.current = { onSelect, onOpen, selected, highlight }

  const sim = useMemo(() => {
    const byId = new Map()
    const list = nodes.map((n, i) => {
      const p = pos.current.get(n.id)
      const ang = i * 2.39996; const r = 12 * Math.sqrt(i + 1)
      const o = { ...n, deg: 0, x: p?.x ?? r * Math.cos(ang), y: p?.y ?? r * Math.sin(ang), vx: 0, vy: 0, fx: null, fy: null, nb: new Set() }
      byId.set(n.id, o)
      return o
    })
    const links = []
    for (const e of edges) {
      const s = byId.get(e.s); const t = byId.get(e.t)
      if (!s || !t || s === t) continue
      s.deg += 1; t.deg += 1; s.nb.add(t.id); t.nb.add(s.id)
      links.push({ ...e, s, t })
    }
    list.forEach((n) => { n.r = radius(n) })
    const fresh = list.some((n) => !pos.current.has(n.id))
    return { nodes: list, links, byId, alpha: fresh ? 1 : 0.3, alphaTarget: 0 }
  }, [nodes, edges])

  const kick = (alpha = 0.3) => {
    const st = state.current
    st.sim.alpha = Math.max(st.sim.alpha, alpha)
    if (!st.raf) st.raf = requestAnimationFrame(loop)
  }

  function draw() {
    const st = state.current; const c = canvas.current
    if (!c || !st.sim) return
    const ctx = c.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W = c.width / dpr; const H = c.height / dpr
    const { x, y, k } = st.view
    const col = st.colors
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.translate(W / 2 + x, H / 2 + y); ctx.scale(k, k)

    const act = st.hover || st.sim.byId.get(cb.current.selected)
    const lit = act ? new Set([act.id, ...act.nb]) : null
    const hl = cb.current.highlight
    const dim = (n) => (lit && !lit.has(n.id)) || (hl && !hl.has(n.id))

    for (const l of st.sim.links) {
      const on = act && (l.s === act || l.t === act)
      ctx.globalAlpha = on ? 0.9 : (lit || hl) ? 0.06 : l.kind === 'ai' ? 0.55 : 0.22
      ctx.strokeStyle = on ? col.primary : l.kind === 'ai' ? col.warn : col.muted
      ctx.lineWidth = (on ? 1.6 : l.kind === 'ai' ? 1.1 : 0.6) / Math.sqrt(k)
      ctx.setLineDash(l.kind === 'ai' ? [4 / k, 3 / k] : [])
      ctx.beginPath(); ctx.moveTo(l.s.x, l.s.y); ctx.lineTo(l.t.x, l.t.y); ctx.stroke()
    }
    ctx.setLineDash([])
    for (const n of st.sim.nodes) {
      ctx.globalAlpha = dim(n) ? 0.15 : 1
      ctx.fillStyle = n.kind === 'topic' || (n.kind === 'card' && n.topic) ? topicColor(n.topic)
        : n.kind === 'category' ? col.info : n.kind === 'tag' ? col.good : col.muted
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()
      if (n.kind === 'topic' || n.id === cb.current.selected) {
        ctx.lineWidth = 2 / k; ctx.strokeStyle = n.id === cb.current.selected ? col.text : col.surface; ctx.stroke()
      }
      if (n.kind === 'card' && n.status === 'draft') {   // thẻ nháp: vòng rỗng giữa
        ctx.fillStyle = col.surface; ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.4, 0, Math.PI * 2); ctx.fill()
      }
    }
    // nhãn: nút lớn, nút đang chọn / lân cận, kết quả tìm, hoặc khi phóng to
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    for (const n of st.sim.nodes) {
      const big = n.kind === 'topic' || (n.kind === 'category' && n.deg > 6)
      const show = (lit ? lit.has(n.id) : hl ? hl.has(n.id) : big || k > 1.6 || (k > 1 && n.kind !== 'card'))
      if (!show) continue
      const size = (n.kind === 'topic' ? 13 : n.kind === 'category' ? 11.5 : 10.5) / Math.max(k, 0.6)
      ctx.font = `${n.kind === 'topic' ? 600 : 400} ${size}px -apple-system, 'Segoe UI', Roboto, sans-serif`
      ctx.globalAlpha = 1
      const label = n.label.length > 48 ? `${n.label.slice(0, 46)}…` : n.label
      ctx.lineWidth = 3 / k; ctx.strokeStyle = col.surface; ctx.strokeText(label, n.x, n.y + n.r + 2)
      ctx.fillStyle = n.kind === 'card' ? col.muted : col.text
      ctx.fillText(label, n.x, n.y + n.r + 2)
    }
    ctx.globalAlpha = 1
  }

  function loop() {
    const st = state.current
    st.raf = 0
    if (!st.sim) return
    if (st.sim.alpha > 0.004 || st.sim.alphaTarget > 0) tick(st.sim)
    draw()
    if (st.sim.alpha > 0.004 || st.sim.alphaTarget > 0) st.raf = requestAnimationFrame(loop)
    else st.sim.nodes.forEach((n) => pos.current.set(n.id, { x: n.x, y: n.y }))
  }

  useEffect(() => {
    const st = state.current
    st.sim = sim
    st.hover = null
    if (!st.colors) st.colors = cssColors(wrap.current)
    kick(sim.alpha)
    return () => sim.nodes.forEach((n) => pos.current.set(n.id, { x: n.x, y: n.y }))
  }, [sim]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!state.current.raf) draw() }, [selected, highlight]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {  // đưa nút cần xem vào giữa màn hình
    const n = focus && state.current.sim?.byId.get(focus)
    if (!n) return
    const v = state.current.view
    v.k = Math.max(v.k, 1.4); v.x = -n.x * v.k; v.y = -n.y * v.k
    draw()
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {  // canvas theo kích thước khung + đổi giao diện sáng / tối
    const c = canvas.current
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr
      draw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(c)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const theme = () => { state.current.colors = cssColors(wrap.current); draw() }
    mq.addEventListener('change', theme)
    return () => { ro.disconnect(); mq.removeEventListener('change', theme); cancelAnimationFrame(state.current.raf); state.current.raf = 0 }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toWorld = (e) => {
    const c = canvas.current; const r = c.getBoundingClientRect(); const { x, y, k } = state.current.view
    return { x: (e.clientX - r.left - r.width / 2 - x) / k, y: (e.clientY - r.top - r.height / 2 - y) / k }
  }
  const nodeAt = (p) => {
    const nodes = state.current.sim?.nodes || []
    const k = state.current.view.k
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const n = nodes[i]; const hit = Math.max(n.r, 6 / k)
      if ((n.x - p.x) ** 2 + (n.y - p.y) ** 2 <= hit * hit) return n
    }
    return null
  }

  const onPointerDown = (e) => {
    const st = state.current
    canvas.current.setPointerCapture(e.pointerId)
    const n = nodeAt(toWorld(e))
    st.drag = { n, sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y, moved: false }
    if (n) { n.fx = n.x; n.fy = n.y }
  }
  const onPointerMove = (e) => {
    const st = state.current; const d = st.drag
    if (!d) {
      const n = nodeAt(toWorld(e))
      if (n !== st.hover) { st.hover = n; canvas.current.style.cursor = n ? 'pointer' : 'grab'; if (!st.raf) draw() }
      return
    }
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true
    if (d.n) {
      const p = toWorld(e); d.n.fx = p.x; d.n.fy = p.y
      st.sim.alphaTarget = 0.3; kick(0.3)
    } else {
      st.view.x = d.vx + e.clientX - d.sx; st.view.y = d.vy + e.clientY - d.sy
      if (!st.raf) draw()
    }
  }
  const onPointerUp = () => {
    const st = state.current; const d = st.drag
    st.drag = null
    if (!d) return
    if (d.n) { d.n.fx = null; d.n.fy = null; st.sim.alphaTarget = 0 }
    if (!d.moved) cb.current.onSelect?.(d.n ? d.n.id : null)
  }
  const onDoubleClick = (e) => {
    const n = nodeAt(toWorld(e))
    if (n) cb.current.onOpen?.(n.id)
  }
  useEffect(() => {  // wheel cần passive: false để chặn cuộn trang
    const c = canvas.current
    const wheel = (e) => {
      e.preventDefault()
      const v = state.current.view
      const r = c.getBoundingClientRect()
      const mx = e.clientX - r.left - r.width / 2; const my = e.clientY - r.top - r.height / 2
      const k2 = Math.min(6, Math.max(0.15, v.k * Math.exp(-e.deltaY * 0.0015)))
      v.x = mx - ((mx - v.x) * k2) / v.k; v.y = my - ((my - v.y) * k2) / v.k; v.k = k2
      if (!state.current.raf) draw()
    }
    c.addEventListener('wheel', wheel, { passive: false })
    return () => c.removeEventListener('wheel', wheel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const zoom = (f) => {
    const v = state.current.view
    if (f === 0) { v.x = 0; v.y = 0; v.k = 1 } else { v.k = Math.min(6, Math.max(0.15, v.k * f)); v.x *= f; v.y *= f }
    draw()
  }

  return (
    <div className="graph-canvas" ref={wrap}>
      <canvas ref={canvas} role="img" aria-label={summary ? `Đồ thị tri thức: ${summary}` : 'Đồ thị tri thức'} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerLeave={() => { state.current.hover = null; if (!state.current.drag && !state.current.raf) draw() }}
        onDoubleClick={onDoubleClick} />
      <div className="graph-zoom">
        <button className="icon-btn" onClick={() => zoom(1.3)} aria-label="Phóng to" title="Phóng to">+</button>
        <button className="icon-btn" onClick={() => zoom(1 / 1.3)} aria-label="Thu nhỏ" title="Thu nhỏ">−</button>
        <button className="icon-btn" onClick={() => zoom(0)} aria-label="Về giữa" title="Về giữa">⌖</button>
        <button className="icon-btn" onClick={() => { state.current.sim.nodes.forEach((n) => { n.x *= 0.5; n.y *= 0.5 }); kick(1) }} aria-label="Sắp xếp lại" title="Sắp xếp lại">↻</button>
      </div>
    </div>
  )
}
