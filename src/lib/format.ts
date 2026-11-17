import type { Difficulty } from '../types'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: '쉬움',
  2: '보통',
  3: '어려움',
}

/** 90 → "1시간 30분", 45 → "45분" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}시간 ${m}분`
  if (h) return `${h}시간`
  return `${m}분`
}

/** 기록 시간 선택지: 15분 ~ 8시간, 15분 단위 */
export const MINUTE_OPTIONS: number[] = Array.from({ length: 32 }, (_, i) => (i + 1) * 15)

/** 기기 시간대 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** DB char_length 와 같은 기준(유니코드 코드포인트)으로 글자 수를 센다. 이모지 1개 = 1자 */
export function countChars(s: string): number {
  return Array.from(s).length
}

/** 최대 글자 수를 넘으면 잘라낸다 (코드포인트 기준이라 이모지가 반으로 쪼개지지 않음) */
export function clampChars(s: string, max: number): string {
  const chars = Array.from(s)
  return chars.length > max ? chars.slice(0, max).join('') : s
}

/** "2026-11-17" → "11/17 (화)" */
export function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const day = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]
  return `${m}/${d} (${day})`
}
