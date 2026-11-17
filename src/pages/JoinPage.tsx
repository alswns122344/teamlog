import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { getTeamPublic, joinTeam } from '../lib/api'
import { getSession, saveSession } from '../lib/session'
import type { PublicMember, TeamPublic } from '../types'

const pinInputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 4)

export default function JoinPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [team, setTeam] = useState<TeamPublic | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PublicMember | null>(null)
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const alreadyJoined = getSession(slug) !== null

  const load = useCallback(async () => {
    try {
      const t = await getTeamPublic(slug)
      setTeam(t)
      // 선택한 팀원의 PIN 설정 여부가 그 사이 바뀌었을 수 있으니 갱신
      setSelected((prev) => (prev ? (t.members.find((m) => m.id === prev.id) ?? null) : null))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '팀 정보를 불러오지 못했습니다.')
    }
  }, [slug])

  useEffect(() => {
    if (!alreadyJoined) load()
  }, [alreadyJoined, load])

  // 이 기기에서 이미 입장했다면 다시 묻지 않는다
  if (alreadyJoined) return <Navigate to={`/t/${slug}`} replace />

  const choose = (m: PublicMember) => {
    setSelected(m)
    setPin('')
    setPinConfirm('')
    setError(null)
  }

  const isNew = selected ? !selected.has_pin : false

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    if (pin.length !== 4) {
      setError('PIN은 숫자 4자리여야 합니다.')
      return
    }
    if (isNew && pin !== pinConfirm) {
      setError('PIN 확인이 일치하지 않습니다.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await joinTeam(slug, selected.id, pin)
      if (res.ok) {
        saveSession(slug, { memberId: res.member_id, token: res.token })
        navigate(`/t/${slug}`, { replace: true })
        return
      }
      setError(res.message)
      setPin('')
      setPinConfirm('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '입장하지 못했습니다.')
    }
    setSubmitting(false)
  }

  if (loadError) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="mb-3 text-red-700">{loadError}</p>
        <Link to="/" className="text-indigo-600 underline">
          처음으로
        </Link>
      </div>
    )
  }

  if (!team) {
    return <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm">불러오는 중…</div>
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h1 className="text-lg font-semibold break-words">{team.title}</h1>
        {team.due_date && <p className="text-sm text-slate-500">마감일 {team.due_date}</p>}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">내 이름을 골라 주세요</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {team.members.map((m) => {
            const active = selected?.id === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => choose(m)}
                aria-pressed={active}
                className={`rounded-lg border px-3 py-3 text-left transition ${
                  active
                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-medium break-words">{m.name}</span>
                <span className={`text-xs ${m.has_pin ? 'text-slate-400' : 'text-emerald-600'}`}>
                  {m.has_pin ? 'PIN 입력' : '처음 입장'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <form onSubmit={onSubmit} className="space-y-3 border-t border-slate-100 pt-4" noValidate>
          {isNew ? (
            <>
              <p className="text-sm">
                <b>{selected.name}</b> 님, 처음 입장하시네요. 앞으로 쓸 <b>PIN 4자리</b>를 정해 주세요.
              </p>
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                PIN은 지금은 다시 설정할 수 없어요. 꼭 기억해 두세요. 다른 기기에서 입장할 때도 이 PIN을 씁니다.
              </p>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="••••"
                aria-label="새 PIN 4자리"
                className={pinInputClass}
                value={pin}
                onChange={(e) => setPin(onlyDigits(e.target.value))}
                autoFocus
              />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="••••"
                aria-label="PIN 확인"
                className={pinInputClass}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(onlyDigits(e.target.value))}
              />
              <p className="text-xs text-slate-400">확인을 위해 한 번 더 입력해 주세요.</p>
            </>
          ) : (
            <>
              <p className="text-sm">
                <b>{selected.name}</b> 님의 PIN 4자리를 입력해 주세요.
              </p>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="••••"
                aria-label="PIN 4자리"
                className={pinInputClass}
                value={pin}
                onChange={(e) => setPin(onlyDigits(e.target.value))}
                autoFocus
              />
            </>
          )}

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
            {submitting ? '확인 중…' : isNew ? 'PIN 정하고 입장하기' : '입장하기'}
          </button>
        </form>
      )}
    </div>
  )
}
