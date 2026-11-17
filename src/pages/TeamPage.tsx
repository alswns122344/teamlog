import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AuthError, addLog, confirmLog, deleteLog, getTeamData, updateLog } from '../lib/api'
import { clearSession, getSession } from '../lib/session'
import type { TeamData } from '../types'
import LogForm from '../components/LogForm'
import LogList from '../components/LogList'
import PendingList from '../components/PendingList'
import Timeline from '../components/Timeline'
import SummaryBox from '../components/SummaryBox'
import { computeScores } from '../lib/score'

// Recharts 를 쓰는 그래프는 대시보드 탭을 열 때만 불러온다 (첫 화면 번들 축소)
const ContributionPie = lazy(() => import('../components/ContributionPie'))
const CategoryBar = lazy(() => import('../components/CategoryBar'))

function ChartFallback() {
  return <div className="h-56 animate-pulse rounded-lg bg-slate-100" aria-label="그래프 불러오는 중" />
}

const REFRESH_INTERVAL_MS = 30_000

const timeText = (d: Date) =>
  d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

type Tab = 'logs' | 'pending' | 'dashboard' | 'summary'

const TABS: { key: Tab; label: string }[] = [
  { key: 'logs', label: '기록' },
  { key: 'pending', label: '확인 대기' },
  { key: 'dashboard', label: '대시보드' },
  { key: 'summary', label: '요약' },
]

export default function TeamPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const session = getSession(slug)
  const token = session?.token ?? ''

  const [data, setData] = useState<TeamData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('logs')
  const [refreshing, setRefreshing] = useState(false)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)

  // 자동 갱신과 저장 후 갱신이 겹칠 때, 가장 마지막에 보낸 요청의 응답만 반영한다.
  const seqRef = useRef(0)

  const load = useCallback(async () => {
    if (!token) return
    const seq = ++seqRef.current
    setRefreshing(true)
    try {
      const next = await getTeamData(slug, token)
      if (seq !== seqRef.current) return
      setData(next)
      setError(null)
      setLoadedAt(new Date())
    } catch (err) {
      if (seq !== seqRef.current) return
      if (err instanceof AuthError) {
        // 토큰이 만료됐거나 다른 팀 것이면 입장 화면으로
        clearSession(slug)
        navigate(`/t/${slug}/join`, { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : '팀 정보를 불러오지 못했습니다.')
    } finally {
      if (seq === seqRef.current) setRefreshing(false)
    }
  }, [slug, token, navigate])

  useEffect(() => {
    load()
  }, [load])

  // 30초마다 자동 갱신. 다른 탭을 보고 있을 때는 쉬고, 다시 돌아오면 바로 갱신한다.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, REFRESH_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  // 쓰기 작업 공통 처리: 성공하면 다시 불러오고, 세션이 만료됐으면 입장 화면으로.
  // 그 외 오류는 호출한 컴포넌트가 화면에 보여 주도록 다시 던진다.
  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn()
      } catch (err) {
        if (err instanceof AuthError) {
          clearSession(slug)
          navigate(`/t/${slug}/join`, { replace: true })
          return
        }
        await load() // 다른 팀원이 그 사이 확인했을 수 있으므로 최신 상태로
        throw err
      }
      await load()
    },
    [slug, navigate, load],
  )

  if (!session) return <Navigate to={`/t/${slug}/join`} replace />

  const switchUser = () => {
    clearSession(slug)
    navigate(`/t/${slug}/join`, { replace: true })
  }

  if (error && !data) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="mb-3 text-red-700">{error}</p>
        <button type="button" onClick={load} className="text-indigo-600 underline">
          다시 시도
        </button>
      </div>
    )
  }

  if (!data) {
    return <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm">불러오는 중…</div>
  }

  const me = data.members.find((m) => m.id === data.me)
  const teamScore = computeScores(data.members, data.logs)
  const toConfirmCount =data.logs.filter((l) => l.status === 'pending' && l.member_id !== data.me).length

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold break-words">{data.team.title}</h1>
            {data.team.due_date && <p className="text-sm text-slate-500">마감일 {data.team.due_date}</p>}
          </div>
          <div className="max-w-[45%] shrink-0 text-right">
            <p className="text-sm break-all">
              <b>{me?.name}</b> 님
            </p>
            <button type="button" onClick={switchUser} className="text-xs text-slate-400 underline">
              다른 이름으로 입장
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
          <span className="min-w-0">
            {error ? (
              <span className="text-red-600">갱신 실패: {error}</span>
            ) : (
              <>
                {loadedAt && `${timeText(loadedAt)} 기준`} · 30초마다 자동 갱신
              </>
            )}
          </span>
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {refreshing ? '갱신 중…' : '↻ 새로고침'}
          </button>
        </div>
      </section>

      <nav className="grid grid-cols-4 gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`relative rounded-lg py-2 text-sm font-medium whitespace-nowrap ${
              tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
            {t.key === 'pending' && toConfirmCount > 0 && (
              <span
                className="absolute -top-1 right-0.5 min-w-5 rounded-full bg-rose-500 px-1.5 text-[11px] leading-5 font-bold text-white"
                aria-label={`확인할 기록 ${toConfirmCount}개`}
              >
                {toConfirmCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'logs' && (
        <>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">새 기록</h2>
            <LogForm submitLabel="기록하기" onSubmit={(input) => act(() => addLog(token, input))} />
            <p className="mt-2 text-xs text-slate-400">
              다른 팀원이 확인해 주면 점수에 반영돼요. 확인 전에는 수정·삭제할 수 있어요.
            </p>
          </section>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <LogList
              logs={data.logs}
              members={data.members}
              meId={data.me}
              onUpdate={(id, input) => act(() => updateLog(token, id, input))}
              onDelete={(id) => act(() => deleteLog(token, id))}
            />
          </section>
        </>
      )}

      {tab === 'pending' && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <PendingList
            logs={data.logs}
            members={data.members}
            meId={data.me}
            onConfirm={(id) => act(() => confirmLog(token, id))}
          />
        </section>
      )}

      {tab === 'dashboard' && (
        <>
          <p className="rounded-xl bg-indigo-50 px-4 py-3 text-xs leading-relaxed text-indigo-900">
            점수 = 걸린 시간(분) × 난이도(1~3). <b>다른 팀원이 확인한 기록만</b> 점수에 들어가요.
          </p>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <Suspense fallback={<ChartFallback />}>
              <ContributionPie teamScore={teamScore} />
            </Suspense>
          </section>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <Suspense fallback={<ChartFallback />}>
              <CategoryBar teamScore={teamScore} />
            </Suspense>
          </section>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <Timeline logs={data.logs} members={data.members} />
          </section>
        </>
      )}

      {tab === 'summary' && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <SummaryBox teamTitle={data.team.title} members={data.members} logs={data.logs} />
        </section>
      )}

      <p className="text-center text-xs text-slate-400">
        <Link to="/" className="underline">
          새 팀 만들기
        </Link>
      </p>
    </div>
  )
}
