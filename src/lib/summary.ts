// 발표용 역할 요약 (순수 함수, AI 사용 안 함)
// 팀원별: 이름 — 주요 역할(가장 점수 많은 종류) / 한 일 상위 3개 / 기여도 %
// 모두 "확인된 기록"만 기준으로 한다.
import { CATEGORIES, type Category, type Log, type Member } from '../types'
import { computeScores, logScore, roundPercents, type CategoryScores } from './score'

export interface MemberSummary {
  memberId: string
  name: string
  /** 가장 점수가 많은 종류. 확인된 기록이 없으면 null */
  mainRole: Category | null
  /** 점수 순 상위 한 일 (같은 제목은 합쳐서 계산) */
  topTasks: string[]
  /** 정수 %, 팀 합계 100 */
  percent: number
}

/** 점수가 가장 큰 종류. 동점이면 종류 목록 순서가 앞선 것. 모두 0이면 null. */
export function topCategory(byCategory: CategoryScores): Category | null {
  let best: Category | null = null
  let bestScore = 0
  for (const c of CATEGORIES) {
    if (byCategory[c] > bestScore) {
      best = c
      bestScore = byCategory[c]
    }
  }
  return best
}

/**
 * 한 팀원의 확인된 기록 중 점수 상위 n개 "한 일" 제목.
 * 같은 제목(앞뒤 공백 무시)은 하나로 합쳐 점수를 더한다.
 * 동점이면 먼저 한 일(work_date 이른 순)이 앞선다.
 */
export function topTasks(logs: Log[], memberId: string, n = 3): string[] {
  const byTitle = new Map<string, { title: string; score: number; firstDate: string }>()
  for (const log of logs) {
    if (log.member_id !== memberId || log.status !== 'confirmed') continue
    const title = log.title.trim()
    const cur = byTitle.get(title)
    if (cur) {
      cur.score += logScore(log)
      if (log.work_date < cur.firstDate) cur.firstDate = log.work_date
    } else {
      byTitle.set(title, { title, score: logScore(log), firstDate: log.work_date })
    }
  }
  return [...byTitle.values()]
    .sort((a, b) => b.score - a.score || a.firstDate.localeCompare(b.firstDate) || a.title.localeCompare(b.title))
    .slice(0, n)
    .map((t) => t.title)
}

/** 팀원 목록 순서대로 요약을 만든다. */
export function buildMemberSummaries(members: Member[], logs: Log[]): MemberSummary[] {
  const { members: scores } = computeScores(members, logs)
  const percents = roundPercents(scores.map((s) => s.percent))
  return scores.map((s, i) => ({
    memberId: s.memberId,
    name: s.name,
    mainRole: topCategory(s.byCategory),
    topTasks: topTasks(logs, s.memberId),
    percent: percents[i],
  }))
}

/** 한 팀원의 요약 첫 줄: "가영 — 주요 역할: 자료조사 / 기여도 40%" */
export function memberHeadline(s: MemberSummary): string {
  return `${s.name} — 주요 역할: ${s.mainRole ?? '없음'} / 기여도 ${s.percent}%`
}

/** 복사용 전체 텍스트 */
export function summaryText(teamTitle: string, summaries: MemberSummary[]): string {
  const lines: string[] = [`[${teamTitle}] 역할 분담 및 기여도`, '']
  for (const s of summaries) {
    lines.push(memberHeadline(s))
    if (s.topTasks.length === 0) {
      lines.push('  · 확인된 기록 없음')
    } else {
      for (const t of s.topTasks) lines.push(`  · ${t}`)
    }
    lines.push('')
  }
  lines.push('※ 팀원 확인을 거친 기록만 반영 (점수 = 걸린 시간(분) × 난이도)')
  return lines.join('\n')
}
