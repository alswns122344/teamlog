export const CATEGORIES = [
  '자료조사',
  '기획',
  'PPT·디자인',
  '발표·대본',
  '개발',
  '회의',
  '기타',
] as const

export type Category = (typeof CATEGORIES)[number]

export type LogStatus = 'pending' | 'confirmed'

export type Difficulty = 1 | 2 | 3

export interface PublicMember {
  id: string
  name: string
  has_pin: boolean
}

export interface TeamPublic {
  slug: string
  title: string
  due_date: string | null
  members: PublicMember[]
}

export interface Member {
  id: string
  name: string
}

export interface Team {
  id: string
  slug: string
  title: string
  due_date: string | null
}

export interface Log {
  id: string
  member_id: string
  title: string
  category: Category
  minutes: number
  difficulty: Difficulty
  work_date: string // YYYY-MM-DD
  /** 상세 메모 (줄바꿈 포함, 없으면 null) */
  memo: string | null
  status: LogStatus
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
}

export interface TeamData {
  team: Team
  me: string
  members: Member[]
  logs: Log[]
}

export interface LogInput {
  title: string
  category: Category
  minutes: number
  difficulty: Difficulty
  work_date: string
  /** 빈 문자열이면 메모 없음 */
  memo: string
}

export const MEMO_MAX_LENGTH = 2000
