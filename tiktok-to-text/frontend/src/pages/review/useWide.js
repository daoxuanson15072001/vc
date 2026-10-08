// Màn đủ rộng cho bố cục chia đôi TPL-A2 (DESIGN V.6: ≥ 1000px) — theo dõi matchMedia, đổi cỡ cửa sổ thì vẽ lại.
import { useEffect, useState } from 'react'

export const WIDE_QUERY = '(min-width: 1000px)'

const match = () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE_QUERY).matches

export function useWide() {
  const [wide, setWide] = useState(match)
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE_QUERY)
    if (!mq) return undefined
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}
