import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CATEGORIES, type Category } from '../types'
import type { TeamScore } from '../lib/score'
import { PENDING_COLOR, categoryColor } from '../lib/colors'

interface Props {
  teamScore: TeamScore
}

const PENDING_KEY = '대기(미반영)'

type Row = { name: string } & Record<string, number | string>

interface TipItem {
  name?: string | number
  value?: number | string | ReadonlyArray<number | string>
  color?: string
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ReadonlyArray<TipItem>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => typeof p.value === 'number' && p.value > 0)
  const confirmed = items.filter((p) => p.name !== PENDING_KEY).reduce((s, p) => s + (p.value as number), 0)
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">
        {label} · {confirmed.toLocaleString()}점
      </p>
      {items.length === 0 && <p className="text-slate-500">기록 없음</p>}
      <ul className="mt-1 space-y-0.5">
        {items.map((p) => (
          <li key={String(p.name)} className="flex items-center justify-between gap-4 text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="tabular-nums">{(p.value as number).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function CategoryBar({ teamScore }: Props) {
  const { members } = teamScore

  // 팀 전체에서 한 번이라도 점수가 있는 종류만 표시 (색은 종류마다 고정)
  const used: Category[] = CATEGORIES.filter((c) => members.some((m) => m.byCategory[c] > 0))
  const hasPending = members.some((m) => m.pendingScore > 0)

  const rows: Row[] = members.map((m) => {
    const row: Row = { name: m.name }
    for (const c of used) row[c] = m.byCategory[c]
    row[PENDING_KEY] = m.pendingScore
    return row
  })

  const empty = used.length === 0 && !hasPending
  const height = Math.max(160, members.length * 44 + 40)

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">팀원별 · 종류별 점수</h2>

      {empty ? (
        <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">아직 기록이 없어요.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            {used.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: categoryColor(c) }} />
                {c}
              </li>
            ))}
            {hasPending && (
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: PENDING_COLOR }} />
                {PENDING_KEY}
              </li>
            )}
          </ul>

          <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke="#e1e0d9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#898781' }}
                  axisLine={{ stroke: '#c3c2b7' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={64}
                  tick={{ fontSize: 12, fill: '#52514e' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => (v.length > 5 ? `${v.slice(0, 5)}…` : v)}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                {used.map((c) => (
                  <Bar
                    key={c}
                    dataKey={c}
                    name={c}
                    stackId="score"
                    fill={categoryColor(c)}
                    stroke="#ffffff"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                ))}
                {hasPending && (
                  <Bar
                    dataKey={PENDING_KEY}
                    name={PENDING_KEY}
                    stackId="score"
                    fill={PENDING_COLOR}
                    stroke="#ffffff"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400">회색 막대는 아직 확인되지 않은 기록이에요. 점수에는 들어가지 않아요.</p>

          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-slate-500 underline">표로 보기</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-max text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-1 pr-3 font-medium">팀원</th>
                    {CATEGORIES.map((c) => (
                      <th key={c} className="py-1 pr-3 text-right font-medium">
                        {c}
                      </th>
                    ))}
                    <th className="py-1 text-right font-medium text-slate-400">대기</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {members.map((m) => (
                    <tr key={m.memberId} className="border-b border-slate-100 last:border-0">
                      <td className="py-1 pr-3">{m.name}</td>
                      {CATEGORIES.map((c) => (
                        <td key={c} className="py-1 pr-3 text-right">
                          {m.byCategory[c] ? m.byCategory[c].toLocaleString() : '-'}
                        </td>
                      ))}
                      <td className="py-1 text-right text-slate-400">
                        {m.pendingScore ? m.pendingScore.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  )
}
