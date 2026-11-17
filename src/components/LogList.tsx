import { useState } from 'react'
import type { Log, LogInput, Member } from '../types'
import { DIFFICULTY_LABEL, formatDate, formatMinutes } from '../lib/format'
import LogForm from './LogForm'
import MemoText from './MemoText'

interface Props {
  logs: Log[]
  members: Member[]
  meId: string
  onUpdate: (logId: string, input: LogInput) => Promise<void>
  onDelete: (logId: string) => Promise<void>
}

type Filter = 'all' | 'mine'

export default function LogList({ logs, members, meId, onUpdate, onDelete }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? '알 수 없음'
  const shown = filter === 'mine' ? logs.filter((l) => l.member_id === meId) : logs

  const confirmDelete = async (logId: string) => {
    setBusy(true)
    setError(null)
    try {
      await onDelete(logId)
      setDeletingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제하지 못했습니다.')
    }
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">기록 목록</h2>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
          {(
            [
              ['all', '전체'],
              ['mine', '내 기록'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1 ${filter === key ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">아직 기록이 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((log) => {
            const mine = log.member_id === meId
            const editable = mine && log.status === 'pending'

            if (editingId === log.id) {
              return (
                <li key={log.id} className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
                  <LogForm
                    initial={{
                      title: log.title,
                      category: log.category,
                      minutes: log.minutes,
                      difficulty: log.difficulty,
                      work_date: log.work_date,
                      memo: log.memo ?? '',
                    }}
                    submitLabel="수정 저장"
                    onSubmit={async (input) => {
                      await onUpdate(log.id, input)
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              )
            }

            return (
              <li
                key={log.id}
                className={`rounded-lg border p-3 ${
                  log.status === 'confirmed' ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-medium break-words">{log.title}</p>
                  {log.status === 'confirmed' ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      확인됨
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                      대기
                    </span>
                  )}
                </div>

                <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500">
                  <span className={mine ? 'font-semibold text-indigo-600' : 'font-medium text-slate-700'}>
                    {nameOf(log.member_id)}
                  </span>
                  <span>{formatDate(log.work_date)}</span>
                  <span>{log.category}</span>
                  <span>{formatMinutes(log.minutes)}</span>
                  <span>난이도 {DIFFICULTY_LABEL[log.difficulty]}</span>
                </p>

                {log.memo && <MemoText memo={log.memo} className="mt-2" />}

                {log.status === 'confirmed' && log.confirmed_by && (
                  <p className="mt-1 text-xs text-emerald-700">✓ {nameOf(log.confirmed_by)} 님이 확인</p>
                )}

                {editable && deletingId !== log.id && (
                  <div className="mt-2 flex gap-3 text-xs">
                    <button type="button" onClick={() => setEditingId(log.id)} className="text-slate-600 underline">
                      수정
                    </button>
                    <button type="button" onClick={() => setDeletingId(log.id)} className="text-red-600 underline">
                      삭제
                    </button>
                  </div>
                )}

                {deletingId === log.id && (
                  <div className="mt-2 flex items-center gap-2 rounded-md bg-red-50 p-2 text-xs">
                    <span className="flex-1 text-red-700">이 기록을 삭제할까요?</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => confirmDelete(log.id)}
                      className="rounded bg-red-600 px-3 py-1 font-medium text-white disabled:opacity-60"
                    >
                      삭제
                    </button>
                    <button type="button" onClick={() => setDeletingId(null)} className="px-2 py-1 text-slate-600">
                      취소
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
