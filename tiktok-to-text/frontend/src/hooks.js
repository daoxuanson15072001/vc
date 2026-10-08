import { useCallback, useEffect, useRef, useState } from 'react'

// Tải dữ liệu; nếu `interval` > 0 thì hỏi lại định kỳ (dùng cho job đang chạy)
export function useFetch(fn, deps, interval = 0) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(async () => {
    try {
      setData(await fnRef.current())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    reload()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!interval) return
    const t = setInterval(reload, interval)
    return () => clearInterval(t)
  }, [interval, reload])

  return { data, error, loading, reload, setData }
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

// Tên app và tiêu đề tab: nguồn ở routes.js / pageMeta.js (CMP-00, CMP-15); xuất lại ở đây cho code cũ
export { APP_NAME } from './routes.js'
export { usePageMeta, usePageTitle } from './pageMeta'
