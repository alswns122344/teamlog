# 팀플로그 (TeamLog) — 조별과제 기여도 기록판

팀 링크 하나로 팀원들이 각자 한 일을 기록하고, **다른 팀원이 확인한 기록만** 점수에 반영해
기여도 그래프와 발표용 역할 요약을 자동으로 만들어 주는 웹 도구입니다. 로그인은 없습니다.

- 프론트: React + Vite + TypeScript, Tailwind CSS, Recharts
- 백엔드/DB: Supabase (Postgres + security definer RPC 함수)
- 배포: Netlify

---

## 1. 로컬 실행

필요: Node.js 20 이상, Supabase 프로젝트 1개

```bash
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
# .env 값을 채운 뒤
npm run dev               # http://localhost:5173
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사(`tsc`) + 프로덕션 빌드 → `dist/` |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm test` | Vitest 단위 테스트 (`src/lib/score.test.ts`, `src/lib/summary.test.ts`) |

## 2. 환경변수

| 이름 | 값 (Supabase 대시보드 → Project Settings → API) |
|---|---|
| `VITE_SUPABASE_URL` | Project URL (예: `https://abcd1234.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` 키 |

> anon 키는 브라우저에 공개되는 키입니다. 이 앱은 anon 키로 **테이블에 직접 접근할 수 없고**
> RPC 함수만 실행할 수 있게 막아 두었습니다 (아래 5장). `service_role` 키는 절대 넣지 마세요.

## 3. Supabase 마이그레이션 적용

마이그레이션 파일은 **번호 순서대로** 적용합니다.

| 파일 | 내용 |
|---|---|
| `001_init.sql` | 테이블·RLS·RPC 전체 (처음 한 번) |
| `002_add_memo.sql` | 기록에 상세 메모(`logs.memo`, 최대 2000자) 추가, `add_log`·`update_log`·`get_team_data` 수정 |

**방법 A — SQL Editor (가장 간단)**
1. Supabase 대시보드 → **SQL Editor** → New query
2. `001_init.sql` 내용을 통째로 붙여 넣고 **Run** → "Success. No rows returned"
3. 새 쿼리에 `002_add_memo.sql` 내용을 통째로 붙여 넣고 **Run** → "Success. No rows returned"

> 이미 001을 적용해 둔 DB라면 **002만** 실행하면 됩니다. 002는 여러 번 실행해도 안전합니다.
> 프론트를 새 버전으로 배포하기 **전에** 002를 먼저 적용하세요. (002를 적용하지 않은 DB에 새 프론트를 붙이면
> 기록 저장 시 함수를 찾을 수 없다는 오류가 납니다. 반대로 002 적용 후 옛 프론트는 그대로 동작합니다.)

**방법 B — Supabase CLI**
```bash
npx supabase login
npx supabase link --project-ref <프로젝트-ref>
npx supabase db push
```

> 처음부터 다시 적용하려면 테이블·함수를 지운 뒤 다시 실행해야 합니다
> (`drop table public.logs, public.sessions, public.members, public.teams cascade; drop schema private cascade;`).
> 이 명령은 **데이터가 모두 삭제**되니 테스트용 프로젝트에서만 쓰세요.

## 4. Netlify 배포

1. 이 저장소를 GitHub에 올립니다.
2. Netlify → **Add new site → Import an existing project** → 저장소 선택
3. 빌드 설정
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **Site configuration → Environment variables** 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가
   (Vite는 빌드 시점에 값을 넣으므로, 변수를 바꾸면 **다시 배포**해야 합니다)
5. Deploy

`public/_redirects` (`/*  /index.html  200`) 가 `dist/`에 복사되어, `/t/abcd1234` 같은 주소에서
새로고침해도 404가 나지 않습니다.

CLI로 배포하려면:
```bash
npx netlify-cli deploy --build --prod
```

---

## 5. 보안 설계

- `teams`, `members`, `sessions`, `logs` 모든 테이블에 **RLS ON + 정책 없음**, 그리고 `anon`/`authenticated`의
  테이블 권한을 `revoke` 했습니다. 클라이언트에서 직접 select/insert/update/delete 하면 거부됩니다.
- 모든 접근은 `security definer` RPC 함수로만 합니다. 내부 헬퍼는 API에 노출되지 않는 `private` 스키마에 있습니다.

| RPC | 설명 |
|---|---|
| `create_team(p_title, p_due_date, p_names)` | 팀 생성, slug 반환 (팀원 2~8명, 중복 이름 불가) |
| `get_team_public(p_slug)` | 입장 화면용: 과제명·마감일·팀원 이름·PIN 설정 여부 (해시 비공개) |
| `join_team(p_slug, p_member_id, p_pin)` | PIN 설정 또는 검증 → 세션 토큰 발급 |
| `get_team_data(p_slug, p_token)` | 팀 기록 전체 (토큰 필요, 같은 팀만) |
| `add_log` / `update_log` / `delete_log` | 기록 작성 / 본인의 대기 기록만 수정·삭제. `add_log`·`update_log`는 선택 인자 `p_memo`(상세 메모) 포함 |
| `confirm_log(p_token, p_log_id)` | 다른 팀원의 대기 기록 확인. **본인 기록이면 거부** |

- PIN은 `crypt()`(bcrypt), 세션 토큰은 `sha256` 해시로만 저장합니다 (pgcrypto).
- 세션은 기기별로 `sessions` 테이블에 저장되어, 여러 기기에서 동시에 입장 상태를 유지합니다.
- PIN을 **5번 연속 틀리면 5분간 입장 잠금**됩니다 (4자리 PIN 무차별 대입 방지).
- 확인된 기록은 수정·삭제할 수 없습니다 (DB 함수에서 거부). 상세 메모도 같은 규칙입니다.
- 상세 메모 2000자 제한은 화면과 DB 양쪽에서 검사합니다. DB에서는 RPC 함수(`private.normalize_memo`)와
  테이블 제약(`logs_memo_length`) 두 겹으로 막습니다. 글자 수는 DB `char_length` 기준(이모지 1개 = 1자)이며,
  화면의 글자 수 표시도 같은 기준으로 셉니다.

## 6. 점수 규칙

- 기록 점수 = `걸린 시간(분) × 난이도(1~3)`
- `status = 'confirmed'` 인 기록만 합산합니다. 대기 중 기록은 회색으로 따로 표시하고 점수에서 뺍니다.
- 기여도 % = 개인 점수 / 팀 전체 점수 (화면에는 합계가 100이 되도록 정수 반올림)
- 계산: `src/lib/score.ts`, 발표용 요약: `src/lib/summary.ts` (둘 다 순수 함수, AI 미사용)

---

## 7. 보안 동작 직접 테스트하기

아래는 모두 **입장한 팀 화면(`/t/<slug>`)에서 브라우저 개발자 도구(F12) → Console** 에 붙여 넣어 실행합니다.
먼저 공통 준비 코드를 실행하세요. `URL`, `KEY` 는 `.env` 값으로 바꿉니다.

```js
const URL = 'https://<프로젝트>.supabase.co'
const KEY = '<anon key>'
const slug = location.pathname.split('/')[2]
const { token } = JSON.parse(localStorage.getItem(`teamlog:session:${slug}`))
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const rpc = (fn, body) =>
  fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
const data = (await rpc('get_team_data', { p_slug: slug, p_token: token })).body
```

### 7-1. 본인 기록을 본인이 확인하면 DB에서 거부된다

먼저 화면에서 **내 기록을 하나 작성**(대기 상태)한 뒤 실행합니다.

```js
const mine = data.logs.find((l) => l.member_id === data.me && l.status === 'pending')
await rpc('confirm_log', { p_token: token, p_log_id: mine.id })
```

기대 결과: `status: 400`, `body.message: "본인 기록은 확인할 수 없습니다."` — 기록은 그대로 "대기"입니다.

### 7-2. 테이블을 직접 조회하면 거부된다

```js
for (const t of ['teams', 'members', 'sessions', 'logs']) {
  const r = await fetch(`${URL}/rest/v1/${t}?select=*`, { headers })
  console.log(t, r.status, (await r.json()).message)
}
```

기대 결과: 네 테이블 모두 `401` (`permission denied for table ...`). 데이터가 하나라도 보이면 마이그레이션이 잘못 적용된 것입니다.

직접 쓰기도 막혀 있는지 확인하려면:
```js
await fetch(`${URL}/rest/v1/logs`, { method: 'POST', headers, body: JSON.stringify({ title: 'x' }) }).then((r) => r.status)
// 기대 결과: 401
```

### 7-3. 확인된 기록은 수정할 수 없다

다른 팀원이 확인해 준 내 기록이 있을 때:
```js
const done = data.logs.find((l) => l.member_id === data.me && l.status === 'confirmed')
await rpc('update_log', { p_token: token, p_log_id: done.id, p_title: '조작', p_category: '기타',
  p_minutes: 1440, p_difficulty: 3, p_work_date: done.work_date })
```
기대 결과: `status: 400`, `"확인된 기록은 수정할 수 없습니다."`

### 7-4. 상세 메모 2000자 제한은 DB에서도 검사한다

화면은 2000자 넘게 입력되지 않으므로, 콘솔에서 RPC를 직접 불러 2001자를 보냅니다.
```js
await rpc('add_log', { p_token: token, p_title: '메모 길이 테스트', p_category: '기타',
  p_minutes: 15, p_difficulty: 1, p_work_date: '2026-11-17', p_memo: '가'.repeat(2001) })
```
기대 결과: `status: 400`, `"상세 메모는 2000자 이내로 입력해 주세요. (현재 2001자)"` — 기록이 만들어지지 않습니다.
`'가'.repeat(2000)` 으로 바꾸면 저장됩니다 (테스트 후 화면에서 삭제하세요).

### 7-5. 틀린 PIN으로는 입장할 수 없다

시크릿 창에서 팀 링크를 열고, 이미 PIN을 정한 팀원을 골라 틀린 PIN을 입력합니다.
"PIN이 틀렸습니다. (남은 시도 4회)" 가 나오고 입장되지 않아야 합니다. 5번 틀리면 5분간 잠깁니다.

### 7-6. 가짜 토큰으로는 아무것도 할 수 없다

```js
await rpc('get_team_data', { p_slug: slug, p_token: 'fake' })
// 기대 결과: status 400, "입장 정보가 만료되었습니다. 다시 입장해 주세요."
```

---

## 8. 폴더 구조

```
public/_redirects              Netlify SPA 새로고침 404 방지
src/
  App.tsx                      라우팅 (/, /created/:slug, /t/:slug/join, /t/:slug)
  pages/                       HomePage, CreatedPage, JoinPage, TeamPage
  components/                  LogForm, LogList, PendingList, MemoText, ContributionPie, CategoryBar, Timeline, SummaryBox
  lib/
    api.ts                     RPC 호출 모음
    session.ts                 localStorage: 팀별 member_id·세션 토큰
    score.ts / score.test.ts   점수 계산 + 테스트
    summary.ts / summary.test.ts  발표용 요약 + 테스트
    format.ts / format.test.ts    표시용 함수(시간·날짜·글자 수) + 테스트
    colors.ts, clipboard.ts, supabase.ts
  types.ts
supabase/migrations/
  001_init.sql                 테이블 + RLS + RPC
  002_add_memo.sql             상세 메모 추가
```

## 9. 화면 동작 메모

- 팀 화면은 **30초마다 자동 갱신**되고, 상단 [↻ 새로고침] 버튼으로 바로 갱신할 수 있습니다.
  브라우저 탭이 백그라운드일 때는 갱신을 멈추고, 돌아오면 바로 한 번 갱신합니다.
- 대시보드의 그래프(Recharts)는 대시보드 탭을 열 때만 불러옵니다.
- **상세 메모** (선택, 최대 2000자): 입력하면 칸이 자동으로 늘어나고 글자 수(`120/2000`)가 표시됩니다.
  줄바꿈은 그대로 저장·표시되며, 앞뒤 공백과 빈 줄만 정리됩니다. 기록 카드와 확인 대기 카드에는 앞 3줄만
  보이고 [더 보기]로 펼칩니다. 발표용 요약에는 들어가지 않습니다.
- 모바일 375px 폭 기준으로 레이아웃을 맞췄습니다. 넓은 표는 표 안에서만 가로 스크롤됩니다.
  기록 폼의 난이도·날짜는 폰에서 위아래로 쌓입니다(날짜 칸 잘림 방지).

## 10. 아직 없는 기능 (2차)

AI 요약 다듬기, 대시보드 이미지 저장, 증빙 사진·파일 첨부, PIN 초기화, 팀원 추가·삭제 관리
