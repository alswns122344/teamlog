import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { CATEGORIES, MEMO_MAX_LENGTH, type Category, type Difficulty, type LogInput } from '../types'
import { DIFFICULTY_LABEL, MINUTE_OPTIONS, clampChars, countChars, formatMinutes, todayLocal } from '../lib/format'

interface Props {
  initial?: LogInput
  submitLabel: string
  onSubmit: (input: LogInput) => Promise<void>
  onCancel?: () => void
}

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

export default function LogForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState<Category>(initial?.category ?? '자료조사')
  const [minutes, setMinutes] = useState(initial?.minutes ?? 60)
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 2)
  const [workDate, setWorkDate] = useState(initial?.work_date ?? todayLocal())
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  // 상세 메모 칸은 내용만큼 자동으로 늘어난다 (수정 폼의 기존 메모 포함)
  const memoRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = memoRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [memo])

  const memoCount = countChars(memo)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError('한 일을 입력해 주세요.')
    if (!workDate) return setError('날짜를 선택해 주세요.')
    if (memoCount > MEMO_MAX_LENGTH) return setError(`상세 메모는 ${MEMO_MAX_LENGTH}자 이내로 입력해 주세요.`)
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({ title: title.trim(), category, minutes, difficulty, work_date: workDate, memo })
      if (!initial) {
        // 새 기록이면 "한 일"과 메모만 비우고 나머지는 연속 입력을 위해 유지
        setTitle('')
        setMemo('')
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다.')
    }
    setSubmitting(false)
  }

  // 기존 값이 선택지에 없을 경우(예: 8시간 초과)도 표시되도록
  const minuteOptions = MINUTE_OPTIONS.includes(minutes) ? MINUTE_OPTIONS : [...MINUTE_OPTIONS, minutes]

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={initial ? undefined : 'log-title'}>
          한 일
        </label>
        <input
          id={initial ? undefined : 'log-title'}
          className={fieldClass}
          value={title}
          maxLength={100}
          placeholder="예: 선행 연구 논문 3편 요약"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-sm font-medium">종류</span>
          <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">걸린 시간</span>
          <select className={fieldClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {minuteOptions.map((m) => (
              <option key={m} value={m}>
                {formatMinutes(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* 폰에서는 날짜 칸이 잘리지 않도록 위아래로 쌓는다 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-sm font-medium">난이도</span>
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="난이도">
            {([1, 2, 3] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={difficulty === d}
                onClick={() => setDifficulty(d)}
                className={`rounded-lg border py-2 text-sm ${
                  difficulty === d
                    ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700'
                    : 'border-slate-300 text-slate-600'
                }`}
              >
                {DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
        </div>
        <label className="space-y-1">
          <span className="text-sm font-medium">날짜</span>
          <input type="date" className={fieldClass} value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
        </label>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-sm font-medium" htmlFor={initial ? undefined : 'log-memo'}>
            상세 메모 <span className="font-normal text-slate-400">(선택)</span>
          </label>
          <span
            className={`text-xs tabular-nums ${
              memoCount >= MEMO_MAX_LENGTH ? 'font-semibold text-red-600' : memoCount >= MEMO_MAX_LENGTH * 0.9 ? 'text-amber-600' : 'text-slate-400'
            }`}
            aria-live="polite"
          >
            {memoCount}/{MEMO_MAX_LENGTH}
          </span>
        </div>
        <textarea
          id={initial ? undefined : 'log-memo'}
          ref={memoRef}
          rows={2}
          className={`${fieldClass} block resize-none overflow-hidden leading-relaxed`}
          value={memo}
          placeholder="확인해 줄 팀원이 알 수 있게 무엇을 어떻게 했는지 적어 주세요. (참고 링크, 결과물 위치 등)"
          onChange={(e) => setMemo(clampChars(e.target.value, MEMO_MAX_LENGTH))}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? '저장 중…' : saved ? '기록했어요 ✓' : submitLabel}
        </button>
      </div>
    </form>
  )
}
