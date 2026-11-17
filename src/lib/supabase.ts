import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다. .env 파일을 확인해 주세요.')
  }
  if (!client) {
    // 로그인 기능을 쓰지 않으므로 Supabase Auth 세션은 저장하지 않는다.
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
