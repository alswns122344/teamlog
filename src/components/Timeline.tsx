import type { Log, Member } from '../types'
import { logScore } from '../lib/score'
import { PENDING_COLOR, memberColor } from '../lib/colors'
import { formatDate, formatMinutes } from '../lib/format'

interface Props {
  logs: Log[]
  members: Member[]
}

export default function Timeline({ logs, members }: Props) {
  const indexOf = new Map(members.map((m, i) => [m.id, i]))
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '알 수 없음'

  // 날짜별로 묶기 (최신 날짜 먼저)
  const groups = new Map<string, Log[]>()
  for (const log of [...logs].sort((a, b) => b.work_date.localeCompare(a.work_date))) {
    const list = groups.get(log.work_date) ?? []
    list.push(log)
    groups.set(log.work_date, list)
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">날짜별 기록</h2>

      {groups.size === 0 ? (
        <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">아직 기록이 없어요.</p>
      ) : (
        <ol className="space-y-4">
          {[...groups.entries()].map(([date, items]) => {
            const dayScore = items.filter((l) => l.status === 'confirmed').reduce((s, l) => s + logScore(l), 0)
            return (
              <li key={date}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-slate-100 pb-1">
                  <span className="text-sm font-semibold">{formatDate(date)}</span>
                  <span className="text-xs text-slate-500 tabular-nums">확인 점수 {dayScore.toLocaleString()}</span>
                </div>
                <ul className="space-y-1">
                  {items.map((log) => {
                    const pending = log.status === 'pending'
                    const idx = indexOf.get(log.member_id) ?? 0
                    return (
                      <li
                        key={log.id}
                        className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${pending ? 'bg-slate-50 text-slate-400' : ''}`}
                      >
                        <span
                          className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full"
                          style={{ background: pending ? PENDING_COLOR : memberColor(idx) }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words">
                            <span className={`font-medium ${pending ? '' : 'text-slate-900'}`}>{nameOf(log.member_id)}</span>{' '}
                            <span className={pending ? '' : 'text-slate-700'}>{log.title}</span>
                          </p>
                          <p className="text-xs text-slate-400">
                            {log.category} · {formatMinutes(log.minutes)} · {logScore(log).toLocaleString()}점
                            {pending && ' · 대기 (점수 미반영)'}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
