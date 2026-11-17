import { useLayoutEffect, useRef, useState } from 'react'

interface Props {
  memo: string
  /** 접혔을 때 보여 줄 줄 수 */
  lines?: 2 | 3
  className?: string
}

/**
 * 상세 메모 표시. 줄바꿈을 그대로 보여 주고, 길면 앞 몇 줄만 보인 뒤 [더 보기]로 펼친다.
 * [더 보기]는 실제로 잘린 경우에만 나타난다.
 */
export default function MemoText({ memo, lines = 3, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      if (!expanded) setOverflowing(el.scrollHeight > el.clientHeight + 1)
    }
    measure()
    // 화면 폭이 바뀌면 잘림 여부도 바뀐다
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [memo, expanded])

  const clamp = lines === 2 ? 'line-clamp-2' : 'line-clamp-3'

  return (
    <div className={`rounded-md bg-slate-100/70 px-2.5 py-2 ${className}`}>
      <p ref={ref} className={`text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700 ${expanded ? '' : clamp}`}>
        {memo}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 text-xs font-medium text-indigo-600 underline"
        >
          {expanded ? '접기' : '더 보기'}
        </button>
      )}
    </div>
  )
}
