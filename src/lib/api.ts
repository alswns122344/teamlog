import { getSupabase } from './supabase'
import type { LogInput, TeamData, TeamPublic } from '../types'

// 세션 토큰이 없거나 만료·다른 팀일 때. (DB 메시지가 모두 "다시 입장해 주세요."로 끝남)
export class AuthError extends Error {}

// DB 함수에서 raise 한 한국어 메시지를 그대로 Error 로 전달한다.
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) {
    const message = error.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    if (message.includes('다시 입장해 주세요')) throw new AuthError(message)
    throw new Error(message)
  }
  return data as T
}

export function createTeam(title: string, dueDate: string | null, names: string[]) {
  return rpc<string>('create_team', {
    p_title: title,
    p_due_date: dueDate || null,
    p_names: names,
  })
}

export function getTeamPublic(slug: string) {
  return rpc<TeamPublic>('get_team_public', { p_slug: slug })
}

export type JoinResult =
  | { ok: true; member_id: string; token: string }
  | { ok: false; message: string }

export function joinTeam(slug: string, memberId: string, pin: string) {
  return rpc<JoinResult>('join_team', { p_slug: slug, p_member_id: memberId, p_pin: pin })
}

export function getTeamData(slug: string, token: string) {
  return rpc<TeamData>('get_team_data', { p_slug: slug, p_token: token })
}

function logArgs(input: LogInput) {
  return {
    p_title: input.title,
    p_category: input.category,
    p_minutes: input.minutes,
    p_difficulty: input.difficulty,
    p_work_date: input.work_date,
    p_memo: input.memo.trim() ? input.memo : null,
  }
}

export function addLog(token: string, input: LogInput) {
  return rpc<string>('add_log', { p_token: token, ...logArgs(input) })
}

export function updateLog(token: string, logId: string, input: LogInput) {
  return rpc<void>('update_log', { p_token: token, p_log_id: logId, ...logArgs(input) })
}

export function deleteLog(token: string, logId: string) {
  return rpc<void>('delete_log', { p_token: token, p_log_id: logId })
}

export function confirmLog(token: string, logId: string) {
  return rpc<void>('confirm_log', { p_token: token, p_log_id: logId })
}
