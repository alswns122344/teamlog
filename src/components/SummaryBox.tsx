import { useState } from 'react'
import type { Log, Member } from '../types'
import { buildMemberSummaries, summaryText } from '../lib/summary'
import { copyText } from '../lib/clipboard'
import { memberColor } from '../lib/colors'

interface Props {
  teamTitle: string
  members: Member[]
  logs: Log[]
}

export default function SummaryBox({ teamTitle, members, logs }: Props) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const summaries = buildMemberSummaries(members, logs)
  const text = summaryText(teamTitle, summaries)
  const pendingCount = logs.filter((l) => l.status === 'pending').length

  const onCopy = async () => {
    const ok = await copyText(text)
    setCopied(ok ? 'ok' : 'fail')
    if (ok) setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">발표용 역할 요약</h2>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
        >
          {copied === 'ok' ? '복사됨 ✓' : '전체 복사'}
        </button>
      </div>
      {copied === 'fail' && (
        <p className="text-sm text-red-600">복사하지 못했어요. 아래 글을 길게 눌러 직접 복사해 주세요.</p>
      )}

      {pendingCount > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          아직 확인되지 않은 기록 {pendingCount}건은 요약에 들어가지 않았어요. 발표 자료에 넣기 전에 서로 확인을 마쳐 주세요.
        </p>
      )}

      <ul className="space-y-3">
        {summaries.map((s, i) => (
          <li key={s.memberId} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 font-semibold">
                <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: memberColor(i) }} />
                <span className="break-all">{s.name}</span>
              </p>
              <span className="shrink-0 text-lg font-bold text-slate-900 tabular-nums">{s.percent}%</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              주요 역할: <b className="text-slate-900">{s.mainRole ?? '없음'}</b>
            </p>
            {s.topTasks.length > 0 ? (
              <ol className="mt-2 list-inside list-decimal space-y-0.5 text-sm text-slate-700">
                {s.topTasks.map((t) => (
                  <li key={t} className="break-words">
                    {t}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-slate-400">확인된 기록 없음</p>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">복사될 내용 미리보기</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap text-slate-700 select-all">
          {text}
        </pre>
      </div>
    </div>
  )
}
