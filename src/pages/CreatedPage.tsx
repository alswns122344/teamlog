import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTeamPublic } from '../lib/api'
import { copyText } from '../lib/clipboard'
import type { TeamPublic } from '../types'

export default function CreatedPage() {
  const { slug = '' } = useParams()
  const [team, setTeam] = useState<TeamPublic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)

  const teamUrl = `${window.location.origin}/t/${slug}`

  useEffect(() => {
    let alive = true
    getTeamPublic(slug)
      .then((t) => alive && setTeam(t))
      .catch((err) => alive && setError(err instanceof Error ? err.message : '팀 정보를 불러오지 못했습니다.'))
    return () => {
      alive = false
    }
  }, [slug])

  const onCopy = async () => {
    const ok = await copyText(teamUrl)
    setCopied(ok ? 'ok' : 'fail')
    if (ok) setTimeout(() => setCopied(null), 2000)
  }

  if (error) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="mb-3 text-red-700">{error}</p>
        <Link to="/" className="text-indigo-600 underline">
          처음으로
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-emerald-600">팀이 만들어졌어요!</p>
        <h1 className="mt-1 text-lg font-semibold break-words">{team?.title ?? '불러오는 중…'}</h1>
        {team?.due_date && <p className="text-sm text-slate-500">마감일 {team.due_date}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-sm">아래 링크를 단톡방에 공유하세요. 팀원들은 링크에서 자기 이름을 고르고 PIN을 정해 입장합니다.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={teamUrl}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="팀 링크"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
          >
            {copied === 'ok' ? '복사됨 ✓' : '링크 복사'}
          </button>
        </div>
        {copied === 'fail' && (
          <p className="text-sm text-red-600">복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.</p>
        )}
      </div>

      {team && (
        <div>
          <p className="mb-2 text-sm font-medium">팀원 ({team.members.length}명)</p>
          <ul className="flex flex-wrap gap-2">
            {team.members.map((m) => (
              <li key={m.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                {m.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        to={`/t/${slug}/join`}
        className="block w-full rounded-lg bg-indigo-600 py-3 text-center font-semibold text-white hover:bg-indigo-700"
      >
        나도 입장하기
      </Link>
    </div>
  )
}
