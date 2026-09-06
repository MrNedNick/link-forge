import { useCallback, useEffect, useRef, useState } from 'react'

/** Element width in real pixels, so a chart can draw text that is not stretched. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  const setNode = useCallback((node: T | null) => {
    ref.current = node
    if (node) setWidth(node.getBoundingClientRect().width)
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref: setNode, width }
}
