import { CATEGORIES, type Category } from '../types'

// 색약 검증을 통과한 8색 팔레트. 순서 자체가 인접 색 구분을 보장하므로 바꾸지 않는다.
export const SERIES_COLORS = [
  '#2a78d6', // 파랑
  '#eb6834', // 주황
  '#1baf7a', // 청록
  '#eda100', // 노랑
  '#e87ba4', // 분홍
  '#008300', // 초록
  '#6250d6', // 보라
  '#e34948', // 빨강
] as const

/** 대기 중(점수 미반영) 표시용 회색 */
export const PENDING_COLOR = '#cbd5e1'

/** 팀원 색은 팀원 목록 순서로 고정한다 (점수 순위가 바뀌어도 색은 그대로). */
export function memberColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

export function categoryColor(category: Category): string {
  return SERIES_COLORS[CATEGORIES.indexOf(category)]
}
