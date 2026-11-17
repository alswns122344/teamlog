import { describe, expect, it } from 'vitest'
import { buildMemberSummaries, memberHeadline, summaryText, topCategory, topTasks } from './summary'
import { emptyCategoryScores } from './score'
import type { Log, Member } from '../types'

const members: Member[] = [
  { id: 'a', name: '가영' },
  { id: 'b', name: '나준' },
]

let seq = 0
function log(partial: Partial<Log> & Pick<Log, 'member_id' | 'title'>): Log {
  seq += 1
  return {
    id: `log-${seq}`,
    category: '자료조사',
    minutes: 60,
    difficulty: 1,
    work_date: '2026-11-10',
    memo: null,
    status: 'confirmed',
    confirmed_by: null,
    confirmed_at: null,
    created_at: '2026-11-10T00:00:00Z',
    ...partial,
  }
}

describe('topCategory', () => {
  it('점수가 가장 큰 종류를 고른다', () => {
    const s = emptyCategoryScores()
    s['기획'] = 100
    s['개발'] = 300
    expect(topCategory(s)).toBe('개발')
  })

  it('동점이면 종류 목록 순서가 앞선 것', () => {
    const s = emptyCategoryScores()
    s['회의'] = 100
    s['기획'] = 100
    expect(topCategory(s)).toBe('기획')
  })

  it('모두 0이면 null', () => {
    expect(topCategory(emptyCategoryScores())).toBeNull()
  })
})

describe('topTasks', () => {
  it('확인된 기록만, 점수 순 상위 3개', () => {
    const logs = [
      log({ member_id: 'a', title: '논문 요약', minutes: 60, difficulty: 2 }), // 120
      log({ member_id: 'a', title: '설문 설계', minutes: 120, difficulty: 3 }), // 360
      log({ member_id: 'a', title: 'PPT 표지', minutes: 30, difficulty: 1 }), // 30
      log({ member_id: 'a', title: '대본 작성', minutes: 90, difficulty: 2 }), // 180
      log({ member_id: 'a', title: '대기 중인 큰 일', minutes: 600, difficulty: 3, status: 'pending' }),
      log({ member_id: 'b', title: '남의 기록', minutes: 600, difficulty: 3 }),
    ]
    expect(topTasks(logs, 'a')).toEqual(['설문 설계', '대본 작성', '논문 요약'])
  })

  it('같은 제목은 합쳐서 점수를 더한다', () => {
    const logs = [
      log({ member_id: 'a', title: '회의록 정리', minutes: 30 }),
      log({ member_id: 'a', title: ' 회의록 정리 ', minutes: 30 }),
      log({ member_id: 'a', title: '자료 찾기', minutes: 45 }),
    ]
    expect(topTasks(logs, 'a')).toEqual(['회의록 정리', '자료 찾기'])
  })

  it('동점이면 먼저 한 일이 앞선다', () => {
    const logs = [
      log({ member_id: 'a', title: '나중 일', work_date: '2026-11-12' }),
      log({ member_id: 'a', title: '먼저 한 일', work_date: '2026-11-01' }),
    ]
    expect(topTasks(logs, 'a')).toEqual(['먼저 한 일', '나중 일'])
  })
})

describe('buildMemberSummaries / summaryText', () => {
  const logs = [
    log({ member_id: 'a', title: '논문 요약', category: '자료조사', minutes: 60, difficulty: 1 }), // 60
    log({ member_id: 'b', title: '발표 연습', category: '발표·대본', minutes: 60, difficulty: 3 }), // 180
    log({ member_id: 'b', title: '확인 안 된 일', category: '개발', minutes: 600, difficulty: 3, status: 'pending' }),
  ]

  it('팀원별 주요 역할, 상위 한 일, 기여도(합계 100)를 만든다', () => {
    const [a, b] = buildMemberSummaries(members, logs)
    expect(a).toMatchObject({ name: '가영', mainRole: '자료조사', topTasks: ['논문 요약'], percent: 25 })
    expect(b).toMatchObject({ name: '나준', mainRole: '발표·대본', topTasks: ['발표 연습'], percent: 75 })
    expect(memberHeadline(b)).toBe('나준 — 주요 역할: 발표·대본 / 기여도 75%')
  })

  it('확인된 기록이 없는 팀원도 빠지지 않고 표시된다', () => {
    const text = summaryText('테스트 과제', buildMemberSummaries(members, [logs[0]]))
    expect(text).toContain('[테스트 과제] 역할 분담 및 기여도')
    expect(text).toContain('가영 — 주요 역할: 자료조사 / 기여도 100%')
    expect(text).toContain('나준 — 주요 역할: 없음 / 기여도 0%')
    expect(text).toContain('  · 확인된 기록 없음')
    expect(text).not.toContain('확인 안 된 일')
  })

  it('상세 메모는 요약에 들어가지 않는다', () => {
    const withMemo = [
      log({
        member_id: 'a',
        title: '설문 설계',
        memo: '비공개로 남긴 상세 메모\n둘째 줄 내용',
      }),
    ]
    const summaries = buildMemberSummaries(members, withMemo)
    const text = summaryText('테스트 과제', summaries)
    expect(text).toContain('설문 설계')
    expect(text).not.toContain('비공개로 남긴 상세 메모')
    expect(text).not.toContain('둘째 줄 내용')
    expect(JSON.stringify(summaries)).not.toContain('상세 메모')
  })
})
