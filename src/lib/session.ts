// 팀별로 "이 기기에서 나는 누구인지"를 localStorage에 저장한다.
// key: teamlog:session:<slug>  value: { memberId, token }

export interface Session {
  memberId: string
  token: string
}

const key = (slug: string) => `teamlog:session:${slug}`

export function getSession(slug: string): Session | null {
  try {
    const raw = localStorage.getItem(key(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    if (typeof parsed.memberId === 'string' && typeof parsed.token === 'string') {
      return { memberId: parsed.memberId, token: parsed.token }
    }
    return null
  } catch {
    return null
  }
}

export function saveSession(slug: string, session: Session): void {
  try {
    localStorage.setItem(key(slug), JSON.stringify(session))
  } catch {
    // 저장소를 쓸 수 없는 환경(시크릿 모드 제한 등)에서는 무시
  }
}

export function clearSession(slug: string): void {
  try {
    localStorage.removeItem(key(slug))
  } catch {
    // 무시
  }
}
