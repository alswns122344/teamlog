import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { TeamScore } from '../lib/score'
import { roundPercents } from '../lib/score'
import { memberColor } from '../lib/colors'

interface Props {
  teamScore: TeamScore
}

interface Slice {
  name: string
  score: number
  percent: number
  color: string
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Slice }> }) {
  const s = payload?.[0]?.payload
  if (!active || !s) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="flex items-center gap-1.5 font-semibold text-slate-900">
        <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />
        {s.name}
      </p>
      <p className="mt-0.5 text-slate-600">
        {s.score.toLocaleString()}점 · {s.percent}%
      </p>
    </div>
  )
}

export default function ContributionPie({ teamScore }: Props) {
  const { total, members } = teamScore
  const rounded = roundPercents(members.map((m) => m.percent))

  // 색은 팀원 목록 순서로 고정, 점수 0인 팀원은 조각에서만 뺀다
  const slices: Slice[] = members
    .map((m, i) => ({ name: m.name, score: m.score, percent: rounded[i], color: memberColor(i) }))
    .filter((s) => s.score > 0)

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">팀원별 기여도</h2>

      {total === 0 ? (
        <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">
          아직 확인된 기록이 없어요. 팀원이 확인해 준 기록부터 그래프에 나타나요.
        </p>
      ) : (
        <div className="relative mx-auto h-56 w-full max-w-xs">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="score"
                nameKey="name"
                innerRadius="58%"
                outerRadius="92%"
                startAngle={90}
                endAngle={-270}
                stroke="#ffffff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-slate-500">팀 점수</span>
            <span className="text-xl font-bold text-slate-900">{total.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 범례 겸 표: 색만으로 구분하지 않도록 이름·수치를 함께 보여 준다 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 font-medium">팀원</th>
              <th className="py-1.5 text-right font-medium">점수</th>
              <th className="py-1.5 text-right font-medium">기여도</th>
              <th className="py-1.5 text-right font-medium text-slate-400">대기(미반영)</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {members.map((m, i) => (
              <tr key={m.memberId} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: memberColor(i) }} />
                    <span className="break-all">{m.name}</span>
                  </span>
                </td>
                <td className="py-1.5 text-right">{m.score.toLocaleString()}</td>
                <td className="py-1.5 text-right font-semibold">{rounded[i]}%</td>
                <td className="py-1.5 text-right text-slate-400">
                  {m.pendingCount > 0 ? `${m.pendingScore.toLocaleString()} (${m.pendingCount}건)` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
