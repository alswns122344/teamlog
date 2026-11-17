// 점수 계산 (순수 함수). 화면·요약 어디서든 이 파일의 함수만 쓴다.
//  - 기록 점수 = minutes × difficulty
//  - status 가 confirmed 인 기록만 합산
//  - 기여도 % = 개인 점수 / 팀 전체 점수
import { CATEGORIES, type Category, type Log, type Member } from '../types'

export function logScore(log: Pick<Log, 'minutes' | 'difficulty'>): number {
  return log.minutes * log.difficulty
}

export type CategoryScores = Record<Category, number>

export function emptyCategoryScores(): CategoryScores {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as CategoryScores
}

export interface MemberScore {
  memberId: string
  name: string
  /** 확인된 기록 점수 합 */
  score: number
  /** 기여도 (0~100, 반올림 전 실수). 팀 점수가 0이면 0 */
  percent: number
  /** 확인된 기록의 종류별 점수 */
  byCategory: CategoryScores
  confirmedCount: number
  /** 대기 중 기록 점수 합 (점수에 반영되지 않음, 참고용) */
  pendingScore: number
  pendingCount: number
}

export interface TeamScore {
  total: number
  members: MemberScore[]
}

/** 팀원 순서는 members 배열 순서를 그대로 유지한다 (점수 순 정렬 아님). */
export function computeScores(members: Member[], logs: Log[]): TeamScore {
  const map = new Map<string, MemberScore>(
    members.map((m) => [
      m.id,
      {
        memberId: m.id,
        name: m.name,
        score: 0,
        percent: 0,
        byCategory: emptyCategoryScores(),
        confirmedCount: 0,
        pendingScore: 0,
        pendingCount: 0,
      },
    ]),
  )

  for (const log of logs) {
    const ms = map.get(log.member_id)
    if (!ms) continue
    const s = logScore(log)
    if (log.status === 'confirmed') {
      ms.score += s
      ms.byCategory[log.category] += s
      ms.confirmedCount += 1
    } else {
      ms.pendingScore += s
      ms.pendingCount += 1
    }
  }

  const list = [...map.values()]
  const total = list.reduce((sum, m) => sum + m.score, 0)
  for (const m of list) m.percent = total > 0 ? (m.score / total) * 100 : 0

  return { total, members: list }
}

/**
 * 정수 %로 반올림하되 합계가 정확히 100이 되도록 맞춘다 (최대 나머지 방식).
 * 모두 0이면 모두 0을 반환한다.
 */
export function roundPercents(percents: number[]): number[] {
  const sum = percents.reduce((a, b) => a + b, 0)
  if (sum <= 0) return percents.map(() => 0)

  const scaled = percents.map((p) => (p / sum) * 100)
  const floors = scaled.map(Math.floor)
  let remaining = 100 - floors.reduce((a, b) => a + b, 0)

  const order = scaled
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i)

  const result = [...floors]
  for (const { i } of order) {
    if (remaining <= 0) break
    result[i] += 1
    remaining -= 1
  }
  return result
}
