-- =====================================================================
-- 팀플로그 (TeamLog) 초기 스키마
--  * 모든 테이블은 RLS ON + 정책 없음 + anon/authenticated 권한 회수
--  * 모든 접근은 public 스키마의 security definer RPC 로만 가능
--  * 내부 헬퍼 함수는 API 로 노출되지 않는 private 스키마에 둔다
--  * PIN 은 bcrypt(crypt), 세션 토큰은 sha256 해시로 저장 (pgcrypto)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null check (char_length(title) between 1 and 100),
  due_date    date,
  created_at  timestamptz not null default now()
);

create table public.members (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams(id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 20),
  pin_hash          text,                       -- null 이면 아직 입장(가입) 전
  failed_attempts   int  not null default 0,    -- 연속 PIN 실패 횟수
  locked_until      timestamptz,                -- 이 시각까지 입장 잠금
  created_at        timestamptz not null default now(),
  unique (team_id, name)
);

-- 기기별 세션 (한 팀원이 여러 기기에서 동시에 로그인 상태 유지)
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  token_hash  text not null unique,
  created_at  timestamptz not null default now()
);

create table public.logs (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  member_id     uuid not null references public.members(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 100),
  category      text not null check (category in
                  ('자료조사','기획','PPT·디자인','발표·대본','개발','회의','기타')),
  minutes       int  not null check (minutes between 15 and 1440 and minutes % 15 = 0),
  difficulty    smallint not null check (difficulty between 1 and 3),
  work_date     date not null,
  status        text not null default 'pending' check (status in ('pending','confirmed')),
  confirmed_by  uuid references public.members(id) on delete set null,
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now(),
  check (confirmed_by is null or confirmed_by <> member_id)
);

create index logs_team_id_idx    on public.logs(team_id);
create index members_team_id_idx on public.members(team_id);
create index sessions_member_idx on public.sessions(member_id);

-- ---------------------------------------------------------------------
-- RLS: 켜고 정책은 만들지 않는다 → anon 은 어떤 행도 볼 수 없음
-- 추가로 테이블 권한 자체를 회수한다 (이중 방어)
-- ---------------------------------------------------------------------
alter table public.teams    enable row level security;
alter table public.members  enable row level security;
alter table public.sessions enable row level security;
alter table public.logs     enable row level security;

revoke all on public.teams, public.members, public.sessions, public.logs
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 내부 헬퍼 (private 스키마, API 노출 안 됨)
-- ---------------------------------------------------------------------

-- 토큰 → 팀원. 토큰이 없거나 틀리면 예외.
create or replace function private.auth_member(p_token text)
returns public.members
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_member public.members;
begin
  if p_token is null or p_token = '' then
    raise exception '입장 정보가 없습니다. 다시 입장해 주세요.';
  end if;

  select m.* into v_member
  from public.sessions s
  join public.members m on m.id = s.member_id
  where s.token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception '입장 정보가 만료되었습니다. 다시 입장해 주세요.';
  end if;

  return v_member;
end;
$$;

-- 기록 입력값 검증 (한국어 오류 메시지)
create or replace function private.validate_log(
  p_title text, p_category text, p_minutes int, p_difficulty int, p_work_date date
) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_title is null or char_length(btrim(p_title)) = 0 then
    raise exception '한 일을 입력해 주세요.';
  end if;
  if char_length(btrim(p_title)) > 100 then
    raise exception '한 일은 100자 이내로 입력해 주세요.';
  end if;
  if p_category is null or p_category not in
     ('자료조사','기획','PPT·디자인','발표·대본','개발','회의','기타') then
    raise exception '종류를 올바르게 선택해 주세요.';
  end if;
  if p_minutes is null or p_minutes < 15 or p_minutes > 1440 or p_minutes % 15 <> 0 then
    raise exception '걸린 시간은 15분 단위로 15분~24시간 사이여야 합니다.';
  end if;
  if p_difficulty is null or p_difficulty not between 1 and 3 then
    raise exception '난이도는 1~3 중에서 선택해 주세요.';
  end if;
  if p_work_date is null then
    raise exception '날짜를 선택해 주세요.';
  end if;
end;
$$;

revoke all on function private.auth_member(text) from public, anon, authenticated;
revoke all on function private.validate_log(text, text, int, int, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 공개 RPC
-- ---------------------------------------------------------------------

-- 1) 팀 만들기 → slug 반환
create or replace function public.create_team(
  p_title text, p_due_date date, p_names text[]
) returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_title    text := btrim(coalesce(p_title, ''));
  v_names    text[];
  v_slug     text;
  v_team_id  uuid;
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789'; -- 헷갈리는 문자 제외
  v_bytes    bytea;
  i          int;
begin
  if char_length(v_title) = 0 then
    raise exception '과제명을 입력해 주세요.';
  end if;
  if char_length(v_title) > 100 then
    raise exception '과제명은 100자 이내로 입력해 주세요.';
  end if;

  select coalesce(array_agg(n order by ord), '{}')
    into v_names
  from (
    select btrim(x) as n, ord
    from unnest(coalesce(p_names, '{}')) with ordinality as t(x, ord)
  ) s
  where n <> '';

  if cardinality(v_names) < 2 or cardinality(v_names) > 8 then
    raise exception '팀원은 2~8명이어야 합니다.';
  end if;
  if (select count(distinct n) from unnest(v_names) n) <> cardinality(v_names) then
    raise exception '같은 이름의 팀원이 있습니다. 이름을 구분해 주세요.';
  end if;
  if exists (select 1 from unnest(v_names) n where char_length(n) > 20) then
    raise exception '팀원 이름은 20자 이내로 입력해 주세요.';
  end if;

  -- 8자리 slug, 충돌 시 재시도
  loop
    v_bytes := gen_random_bytes(8);
    v_slug := '';
    for i in 0..7 loop
      v_slug := v_slug || substr(v_alphabet, (get_byte(v_bytes, i) % char_length(v_alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.teams where slug = v_slug);
  end loop;

  insert into public.teams (slug, title, due_date)
  values (v_slug, v_title, p_due_date)
  returning id into v_team_id;

  insert into public.members (team_id, name)
  select v_team_id, n from unnest(v_names) n;

  return v_slug;
end;
$$;

-- 2) 입장 화면용 공개 정보 (해시·기록은 노출 안 함)
create or replace function public.get_team_public(p_slug text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team public.teams;
begin
  select * into v_team from public.teams where slug = p_slug;
  if not found then
    raise exception '팀을 찾을 수 없습니다. 링크를 다시 확인해 주세요.';
  end if;

  return json_build_object(
    'slug', v_team.slug,
    'title', v_team.title,
    'due_date', v_team.due_date,
    'members', coalesce((
      select json_agg(json_build_object(
               'id', m.id, 'name', m.name, 'has_pin', m.pin_hash is not null
             ) order by m.created_at, m.name)
      from public.members m where m.team_id = v_team.id
    ), '[]'::json)
  );
end;
$$;

-- 3) 입장: PIN 설정 또는 검증 → 세션 토큰 발급
--    실패 시 예외 대신 {ok:false} 를 반환한다.
--    (예외를 던지면 실패 횟수 증가까지 롤백되기 때문)
create or replace function public.join_team(
  p_slug text, p_member_id uuid, p_pin text
) returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_member  public.members;
  v_token   text;
  v_fails   int;
  c_max_fails constant int := 5;
  c_lock    constant interval := interval '5 minutes';
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return json_build_object('ok', false, 'message', 'PIN은 숫자 4자리여야 합니다.');
  end if;

  select m.* into v_member
  from public.members m
  join public.teams t on t.id = m.team_id
  where t.slug = p_slug and m.id = p_member_id
  for update of m;

  if not found then
    return json_build_object('ok', false, 'message', '팀원을 찾을 수 없습니다.');
  end if;

  if v_member.locked_until is not null and v_member.locked_until > now() then
    return json_build_object(
      'ok', false,
      'message', format('PIN을 여러 번 틀려 잠겼습니다. %s분 후 다시 시도해 주세요.',
                        ceil(extract(epoch from (v_member.locked_until - now())) / 60)::int)
    );
  end if;

  if v_member.pin_hash is null then
    -- 첫 입장: PIN 설정
    update public.members
       set pin_hash = crypt(p_pin, gen_salt('bf', 8)),
           failed_attempts = 0, locked_until = null
     where id = v_member.id;
  elsif crypt(p_pin, v_member.pin_hash) <> v_member.pin_hash then
    v_fails := v_member.failed_attempts + 1;
    if v_fails >= c_max_fails then
      update public.members
         set failed_attempts = 0, locked_until = now() + c_lock
       where id = v_member.id;
      return json_build_object('ok', false,
        'message', 'PIN을 5번 틀려 5분 동안 입장이 잠겼습니다.');
    else
      update public.members set failed_attempts = v_fails where id = v_member.id;
      return json_build_object('ok', false,
        'message', format('PIN이 틀렸습니다. (남은 시도 %s회)', c_max_fails - v_fails));
    end if;
  else
    update public.members
       set failed_attempts = 0, locked_until = null
     where id = v_member.id;
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.sessions (member_id, token_hash)
  values (v_member.id, encode(digest(v_token, 'sha256'), 'hex'));

  return json_build_object('ok', true, 'member_id', v_member.id, 'token', v_token);
end;
$$;

-- 4) 팀 전체 데이터 (토큰 필요, 같은 팀만)
create or replace function public.get_team_data(p_slug text, p_token text)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_me   public.members := private.auth_member(p_token);
  v_team public.teams;
begin
  select * into v_team from public.teams where id = v_me.team_id;
  if v_team.slug is distinct from p_slug then
    raise exception '이 팀에 입장한 기록이 없습니다. 다시 입장해 주세요.';
  end if;

  return json_build_object(
    'team', json_build_object(
      'id', v_team.id, 'slug', v_team.slug,
      'title', v_team.title, 'due_date', v_team.due_date
    ),
    'me', v_me.id,
    'members', coalesce((
      select json_agg(json_build_object('id', m.id, 'name', m.name)
                      order by m.created_at, m.name)
      from public.members m where m.team_id = v_team.id
    ), '[]'::json),
    'logs', coalesce((
      select json_agg(json_build_object(
               'id', l.id, 'member_id', l.member_id, 'title', l.title,
               'category', l.category, 'minutes', l.minutes,
               'difficulty', l.difficulty, 'work_date', l.work_date,
               'status', l.status, 'confirmed_by', l.confirmed_by,
               'confirmed_at', l.confirmed_at, 'created_at', l.created_at
             ) order by l.work_date desc, l.created_at desc)
      from public.logs l where l.team_id = v_team.id
    ), '[]'::json)
  );
end;
$$;

-- 5) 기록 작성
create or replace function public.add_log(
  p_token text, p_title text, p_category text,
  p_minutes int, p_difficulty int, p_work_date date
) returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_me public.members := private.auth_member(p_token);
  v_id uuid;
begin
  perform private.validate_log(p_title, p_category, p_minutes, p_difficulty, p_work_date);

  insert into public.logs (team_id, member_id, title, category, minutes, difficulty, work_date)
  values (v_me.team_id, v_me.id, btrim(p_title), p_category, p_minutes, p_difficulty, p_work_date)
  returning id into v_id;

  return v_id;
end;
$$;

-- 6) 기록 수정 (본인 + 대기 중만)
create or replace function public.update_log(
  p_token text, p_log_id uuid, p_title text, p_category text,
  p_minutes int, p_difficulty int, p_work_date date
) returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_me  public.members := private.auth_member(p_token);
  v_log public.logs;
begin
  select * into v_log from public.logs where id = p_log_id for update;
  if not found or v_log.team_id <> v_me.team_id then
    raise exception '기록을 찾을 수 없습니다.';
  end if;
  if v_log.member_id <> v_me.id then
    raise exception '본인 기록만 수정할 수 있습니다.';
  end if;
  if v_log.status <> 'pending' then
    raise exception '확인된 기록은 수정할 수 없습니다.';
  end if;

  perform private.validate_log(p_title, p_category, p_minutes, p_difficulty, p_work_date);

  update public.logs
     set title = btrim(p_title), category = p_category, minutes = p_minutes,
         difficulty = p_difficulty, work_date = p_work_date
   where id = p_log_id;
end;
$$;

-- 7) 기록 삭제 (본인 + 대기 중만)
create or replace function public.delete_log(p_token text, p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_me  public.members := private.auth_member(p_token);
  v_log public.logs;
begin
  select * into v_log from public.logs where id = p_log_id for update;
  if not found or v_log.team_id <> v_me.team_id then
    raise exception '기록을 찾을 수 없습니다.';
  end if;
  if v_log.member_id <> v_me.id then
    raise exception '본인 기록만 삭제할 수 있습니다.';
  end if;
  if v_log.status <> 'pending' then
    raise exception '확인된 기록은 삭제할 수 없습니다.';
  end if;

  delete from public.logs where id = p_log_id;
end;
$$;

-- 8) 기록 확인 (다른 팀원의 대기 기록만) — 본인 기록 확인은 여기서 거부
create or replace function public.confirm_log(p_token text, p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_me  public.members := private.auth_member(p_token);
  v_log public.logs;
begin
  select * into v_log from public.logs where id = p_log_id for update;
  if not found or v_log.team_id <> v_me.team_id then
    raise exception '기록을 찾을 수 없습니다.';
  end if;
  if v_log.member_id = v_me.id then
    raise exception '본인 기록은 확인할 수 없습니다.';
  end if;
  if v_log.status = 'confirmed' then
    raise exception '이미 확인된 기록입니다.';
  end if;

  update public.logs
     set status = 'confirmed', confirmed_by = v_me.id, confirmed_at = now()
   where id = p_log_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 함수 실행 권한: 공개 RPC 만 anon 에게 허용
-- ---------------------------------------------------------------------
revoke all on function public.create_team(text, date, text[])                       from public, anon, authenticated;
revoke all on function public.get_team_public(text)                                 from public, anon, authenticated;
revoke all on function public.join_team(text, uuid, text)                           from public, anon, authenticated;
revoke all on function public.get_team_data(text, text)                             from public, anon, authenticated;
revoke all on function public.add_log(text, text, text, int, int, date)             from public, anon, authenticated;
revoke all on function public.update_log(text, uuid, text, text, int, int, date)    from public, anon, authenticated;
revoke all on function public.delete_log(text, uuid)                                from public, anon, authenticated;
revoke all on function public.confirm_log(text, uuid)                               from public, anon, authenticated;

grant execute on function public.create_team(text, date, text[])                    to anon, authenticated;
grant execute on function public.get_team_public(text)                              to anon, authenticated;
grant execute on function public.join_team(text, uuid, text)                        to anon, authenticated;
grant execute on function public.get_team_data(text, text)                          to anon, authenticated;
grant execute on function public.add_log(text, text, text, int, int, date)          to anon, authenticated;
grant execute on function public.update_log(text, uuid, text, text, int, int, date) to anon, authenticated;
grant execute on function public.delete_log(text, uuid)                             to anon, authenticated;
grant execute on function public.confirm_log(text, uuid)                            to anon, authenticated;
