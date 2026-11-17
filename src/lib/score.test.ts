import { describe, expect, it } from 'vitest'
import { computeScores, logScore, roundPercents } from './score'
import type { Log, Member } from '../types'

const members: Member[] = [
  { id: 'a', name: '가영' },
  { id: 'b', name: '나준' },
  { id: 'c', name: '다은' },
]

let seq = 0
function log(partial: Partial<Log> & Pick<Log, 'member_id'>): Log {
  seq += 1
  return {
    id: `log-${seq}`,
    title: `기록 ${seq}`,
    category: '자료조사',
    minutes: 60,
    difficulty: 1,
    work_date: '2026-11-17',
    memo: null,
    status: 'confirmed',
    confirmed_by: null,
    confirmed_at: null,
    created_at: '2026-11-17T00:00:00Z',
    ...partial,
  }
}

describe('logScore', () => {
  it('minutes × difficulty', () => {
    expect(logScore({ minutes: 90, difficulty: 3 })).toBe(270)
    expect(logScore({ minutes: 15, difficulty: 1 })).toBe(15)
  })
})

describe('computeScores', () => {
  it('확인된 기록만 점수에 합산하고 대기 기록은 따로 센다', () => {
    const logs = [
      log({ member_id: 'a', minutes: 60, difficulty: 2 }), // 120
      log({ member_id: 'a', minutes: 30, difficulty: 1, status: 'pending' }), // 대기 30
      log({ member_id: 'b', minutes: 120, difficulty: 3, category: '개발' }), // 360
    ]
    const { total, members: ms } = computeScores(members, logs)

    expect(total).toBe(480)
    const [a, b, c] = ms
    expect(a.score).toBe(120)
    expect(a.pendingScore).toBe(30)
    expect(a.pendingCount).toBe(1)
    expect(a.confirmedCount).toBe(1)
    expect(b.score).toBe(360)
    expect(b.byCategory['개발']).toBe(360)
    expect(b.byCategory['자료조사']).toBe(0)
    expect(c.score).toBe(0)
  })

  it('기여도 % = 개인 점수 / 팀 전체 점수', () => {
    const logs = [
      log({ member_id: 'a', minutes: 60, difficulty: 1 }), // 60
      log({ member_id: 'b', minutes: 60, difficulty: 3 }), // 180
    ]
    const { members: ms } = computeScores(members, logs)
    expect(ms[0].percent).toBeCloseTo(25)
    expect(ms[1].percent).toBeCloseTo(75)
    expect(ms[2].percent).toBe(0)
  })

  it('확인된 기록이 없으면 모두 0%', () => {
    const logs = [log({ member_id: 'a', status: 'pending' })]
    const { total, members: ms } = computeScores(members, logs)
    expect(total).toBe(0)
    expect(ms.every((m) => m.percent === 0)).toBe(true)
  })

  it('팀원 순서를 유지하고, 팀원 목록에 없는 기록은 무시한다', () => {
    const logs = [
      log({ member_id: 'c', minutes: 300, difficulty: 3 }),
      log({ member_id: 'zzz', minutes: 600, difficulty: 3 }),
    ]
    const { total, members: ms } = computeScores(members, logs)
    expect(ms.map((m) => m.memberId)).toEqual(['a', 'b', 'c'])
    expect(total).toBe(900)
  })
})

describe('roundPercents', () => {
  it('합계가 정확히 100이 되도록 반올림한다', () => {
    const r = roundPercents([100 / 3, 100 / 3, 100 / 3])
    expect(r.reduce((a, b) => a + b, 0)).toBe(100)
    expect(r).toEqual([34, 33, 33])
  })

  it('나머지가 큰 쪽에 1을 더한다', () => {
    expect(roundPercents([12.6, 37.3, 50.1])).toEqual([13, 37, 50])
  })

  it('모두 0이면 0을 돌려준다', () => {
    expect(roundPercents([0, 0])).toEqual([0, 0])
  })
})
