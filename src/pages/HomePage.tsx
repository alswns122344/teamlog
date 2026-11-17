import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTeam } from '../lib/api'

const MIN_MEMBERS = 2
const MAX_MEMBERS = 8

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

export default function HomePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [names, setNames] = useState<string[]>(['', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const updateName = (i: number, value: string) =>
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)))

  const addName = () => setNames((prev) => (prev.length < MAX_MEMBERS ? [...prev, ''] : prev))

  const removeName = (i: number) =>
    setNames((prev) => (prev.length > MIN_MEMBERS ? prev.filter((_, idx) => idx !== i) : prev))

  const validate = (): string | null => {
    if (!title.trim()) return '과제명을 입력해 주세요.'
    if (!dueDate) return '마감일을 선택해 주세요.'
    const cleaned = names.map((n) => n.trim()).filter(Boolean)
    if (cleaned.length < MIN_MEMBERS) return `팀원 이름을 ${MIN_MEMBERS}명 이상 입력해 주세요.`
    if (cleaned.length > MAX_MEMBERS) return `팀원은 최대 ${MAX_MEMBERS}명까지입니다.`
    if (new Set(cleaned).size !== cleaned.length) return '같은 이름의 팀원이 있습니다. 이름을 구분해 주세요.'
    if (cleaned.some((n) => n.length > 20)) return '팀원 이름은 20자 이내로 입력해 주세요.'
    return null
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const msg = validate()
    if (msg) {
      setError(msg)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const cleaned = names.map((n) => n.trim()).filter(Boolean)
      const slug = await createTeam(title.trim(), dueDate, cleaned)
      navigate(`/created/${slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '팀을 만들지 못했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-900">
        팀 링크 하나로 각자 한 일을 기록하세요. <b>다른 팀원이 확인한 기록만</b> 기여도 점수에 반영되고,
        발표용 역할 요약도 자동으로 만들어집니다.
      </section>

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl bg-white p-4 shadow-sm sm:p-6" noValidate>
        <h1 className="text-lg font-semibold">새 팀 만들기</h1>

        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium">
            과제명
          </label>
          <input
            id="title"
            className={inputClass}
            value={title}
            maxLength={100}
            placeholder="예: 경영학원론 3조 발표"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="due" className="text-sm font-medium">
            마감일
          </label>
          <input
            id="due"
            type="date"
            className={inputClass}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            팀원 이름 <span className="text-slate-400">({MIN_MEMBERS}~{MAX_MEMBERS}명)</span>
          </legend>
          {names.map((name, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={inputClass}
                value={name}
                maxLength={20}
                placeholder={`팀원 ${i + 1}`}
                aria-label={`팀원 ${i + 1} 이름`}
                onChange={(e) => updateName(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeName(i)}
                disabled={names.length <= MIN_MEMBERS}
                className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                aria-label={`팀원 ${i + 1} 삭제`}
              >
                삭제
              </button>
            </div>
          ))}
          {names.length < MAX_MEMBERS && (
            <button
              type="button"
              onClick={addName}
              className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              + 팀원 추가
            </button>
          )}
          <p className="text-xs text-slate-400">팀원 목록은 만든 뒤에 바꿀 수 없어요. 이름을 정확히 적어 주세요.</p>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? '만드는 중…' : '팀 만들기'}
        </button>
      </form>
    </div>
  )
}
