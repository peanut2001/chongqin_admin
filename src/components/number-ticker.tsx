import { useEffect, useRef, useState } from 'react'

type NumberTickerProps = {
  value: number
  /** 动画时长（毫秒） */
  duration?: number
  decimals?: number
  className?: string
}

/** 数字从上一次的值滚动到新值（ease-out），系统开启「减少动态效果」时直接显示 */
export function NumberTicker({
  value,
  duration = 1200,
  decimals = 0,
  className,
}: NumberTickerProps) {
  const [display, setDisplay] = useState(0)
  // 记录当前显示值，被打断时从当前位置继续滚动
  const currentRef = useRef(0)

  useEffect(() => {
    const from = currentRef.current
    const set = (v: number) => {
      currentRef.current = v
      setDisplay(v)
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      set(value)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      set(from + (value - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {display.toLocaleString('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  )
}
