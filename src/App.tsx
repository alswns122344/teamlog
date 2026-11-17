import { Link, Route, Routes } from 'react-router-dom'
import { supabaseConfigured } from './lib/supabase'
import HomePage from './pages/HomePage'
import CreatedPage from './pages/CreatedPage'
import JoinPage from './pages/JoinPage'
import TeamPage from './pages/TeamPage'

export default function App() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6">
      <header className="mb-6">
        <Link to="/" className="text-xl font-bold text-indigo-600">
          팀플로그
        </Link>
        <p className="text-sm text-slate-500">조별과제 기여도 기록판</p>
      </header>

      {!supabaseConfigured && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Supabase 환경변수가 없습니다. <code>.env.example</code>을 복사해 <code>.env</code>를 만들고
          값을 채운 뒤 개발 서버를 다시 실행해 주세요.
        </div>
      )}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/created/:slug" element={<CreatedPage />} />
        <Route path="/t/:slug/join" element={<JoinPage />} />
        <Route path="/t/:slug" element={<TeamPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

function NotFound() {
  return (
    <div className="rounded-xl bg-white p-6 text-center shadow-sm">
      <p className="mb-3">페이지를 찾을 수 없습니다.</p>
      <Link to="/" className="text-indigo-600 underline">
        처음으로
      </Link>
    </div>
  )
}
