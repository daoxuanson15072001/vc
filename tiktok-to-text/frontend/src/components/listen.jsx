// Nghe thẻ VCWIKI bằng giọng tiếng Việt: máy chủ tạo mp3 (giọng neural, phát dần khi đang tạo).
// Máy chủ lỗi -> dùng giọng tiếng Việt có sẵn của trình duyệt (speechSynthesis).
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

const PREF_KEY = 'wiki-tts'
const DEFAULT_PREF = { voice: 'female', rate: 'normal' }
const RATE_NUM = { slow: 0.85, normal: 1, fast: 1.2 }

export function loadPref() {
  try { return { ...DEFAULT_PREF, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') } } catch { return DEFAULT_PREF }
}

export function usePref() {
  const [pref, setPref] = useState(loadPref)
  const update = (k, v) => {
    const next = { ...pref, [k]: v }
    setPref(next)
    try { localStorage.setItem(PREF_KEY, JSON.stringify(next)) } catch { /* trình duyệt chặn lưu */ }
  }
  return [pref, update]
}

export const audioUrl = (card, pref) => api.cardAudioUrl(card.id, { voice: pref.voice, rate: pref.rate, v: card.updated_at })

export function VoiceSelects({ pref, onChange }) {
  return (
    <>
      <select value={pref.voice} onChange={(e) => onChange('voice', e.target.value)} aria-label="Giọng đọc">
        <option value="female">Giọng nữ (Hoài My)</option>
        <option value="male">Giọng nam (Nam Minh)</option>
      </select>
      <select value={pref.rate} onChange={(e) => onChange('rate', e.target.value)} aria-label="Tốc độ đọc">
        <option value="slow">Chậm</option>
        <option value="normal">Vừa</option>
        <option value="fast">Nhanh</option>
      </select>
    </>
  )
}

export function browserSpeak(card, rate, onEnd) {
  const synth = window.speechSynthesis
  const vi = synth?.getVoices().find((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('vi'))
  if (!vi) return false
  const text = [card.title, card.summary, card.body, ...(card.key_points || []), card.when_to_use, card.example]
    .filter(Boolean).join('. ').replace(/[#*_`>|]+/g, '')
  const u = new SpeechSynthesisUtterance(text)
  u.voice = vi
  u.lang = vi.lang
  u.rate = RATE_NUM[rate]
  u.onend = onEnd
  u.onerror = onEnd
  synth.cancel()
  synth.speak(u)
  return true
}

export const FALLBACK_MSG = 'Máy chủ chưa tạo được giọng đọc — đang dùng giọng tiếng Việt của trình duyệt.'
export const NO_VOICE_MSG = 'Không tạo được giọng đọc, và trình duyệt này không có giọng tiếng Việt.'

export function CardListen({ card }) {
  const [pref, setPref] = usePref()
  const [state, setState] = useState('idle')   // idle | loading | playing | browser
  const [err, setErr] = useState(null)
  const audio = useRef(null)
  const active = useRef(false)

  const stop = () => {
    active.current = false
    const el = audio.current
    if (el) { el.pause(); el.removeAttribute('src'); el.load() }
    window.speechSynthesis?.cancel()
    setState('idle')
  }
  useEffect(() => stop, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = () => {
    setErr(null)
    setState('loading')
    active.current = true
    const el = audio.current
    el.src = audioUrl(card, pref)
    el.play().catch(() => {})   // lỗi thật sẽ báo qua onError
  }

  const onError = () => {
    if (!active.current) return
    if (browserSpeak(card, pref.rate, () => { active.current = false; setState('idle') })) {
      setState('browser')
      setErr(FALLBACK_MSG)
    } else {
      active.current = false
      setState('idle')
      setErr(NO_VOICE_MSG)
    }
  }

  return (
    <div className="listen">
      {state === 'idle'
        ? <button className="btn" onClick={play} aria-label="Nghe thẻ này" title="Nghe thẻ">🔊 Nghe thẻ</button>
        : <button className="btn" onClick={stop} aria-label={state === 'loading' ? 'Đang tạo giọng đọc — bấm để dừng' : 'Dừng nghe thẻ'}>{state === 'loading' ? '⏳ Đang tạo giọng đọc…' : '■ Dừng'}</button>}
      <VoiceSelects pref={pref} onChange={(k, v) => { setPref(k, v); stop() }} />
      <audio ref={audio} controls={state === 'playing'} onPlaying={() => active.current && setState('playing')}
        onEnded={() => { active.current = false; setState('idle') }} onError={onError} />
      {err && <div className="small muted">{err}</div>}
    </div>
  )
}
