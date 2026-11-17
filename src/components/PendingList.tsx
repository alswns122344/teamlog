import { useState } from 'react'
import type { Log, Member } from '../types'
import { DIFFICULTY_LABEL, formatDate, formatMinutes } from '../lib/format'
import MemoText from './MemoText'

interface Props {
  logs: Log[]
  members: Member[]
  meId: string
  onConfirm: (logId: string) => Promise<void>
}

export default function PendingList({ logs, members, meId, onConfirm }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '알 수 없음'
  const pending = logs.filter((l) => l.status === 'pending')
  const toConfirm = pending.filter((l) => l.member_id !== meId)
  const mineWaiting = pending.filter((l) => l.member_id === meId)

  const confirm = async (logId: string) => {
    setBusyId(logId)
    setErrors((prev) => {
      const next = { ...prev }
      delete next[logId]
      return next
    })
    try {
      await onConfirm(logId)
    } catch (err) {
      setErrors((prev) => ({ ...prev, [logId]: err instanceof Error ? err.message : '확인하지 못했습니다.' }))
    }
    setBusyId(null)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="font-semibold">
          내가 확인해 줄 기록 <span className="text-slate-400">({toConfirm.length})</span>
        </h2>
        <p className="text-xs text-slate-500">
          팀원이 실제로 한 일이 맞다면 [확인]을 눌러 주세요. 확인한 사람 이름이 기록에 남고, 확인된 기록만 점수에 반영돼요.
        </p>

        {toConfirm.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">확인할 기록이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {toConfirm.map((log) => (
              <li key={log.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{log.title}</p>
                    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{nameOf(log.member_id)}</span>
                      <span>{formatDate(log.work_date)}</span>
                      <span>{log.category}</span>
                      <span>{formatMinutes(log.minutes)}</span>
                      <span>난이도 {DIFFICULTY_LABEL[log.difficulty]}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => confirm(log.id)}
                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {busyId === log.id ? '확인 중…' : '확인'}
                  </button>
                </div>
                {log.memo ? (
                  <MemoText memo={log.memo} className="mt-2" />
                ) : (
                  <p className="mt-2 text-xs text-slate-400">상세 메모 없음</p>
                )}
                {errors[log.id] && (
                  <p role="alert" className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
                    {errors[log.id]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">
          확인을 기다리는 내 기록 <span className="text-slate-400">({mineWaiting.length})</span>
        </h2>
        {mineWaiting.length === 0 ? (
          <p className="text-sm text-slate-500">대기 중인 내 기록이 없어요.</p>
        ) : (
          <ul className="space-y-1">
            {mineWaiting.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="min-w-0 break-words">{log.title}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatDate(log.work_date)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-400">내 기록은 내가 확인할 수 없어요. 다른 팀원에게 확인을 부탁해 주세요.</p>
      </div>
    </div>
  )
}
