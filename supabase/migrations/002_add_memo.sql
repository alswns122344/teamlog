-- =====================================================================
-- 002: 기록에 "상세 메모" 추가
--  * logs.memo (선택, 최대 2000자, 줄바꿈 보존)
--  * add_log / update_log 에 p_memo 인자 추가 (맨 뒤, 기본값 null)
--  * get_team_data 응답에 memo 포함
--  001 을 적용한 DB 위에 그대로 실행한다. 여러 번 실행해도 안전하다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 컬럼
-- ---------------------------------------------------------------------
alter table public.logs add column if not exists memo text;

alter table public.logs drop constraint if exists logs_memo_length;
alter table public.logs
  add constraint logs_memo_length check (memo is null or char_length(memo) <= 2000);

-- ---------------------------------------------------------------------
-- 메모 정리 + 검증 헬퍼 (private, API 노출 안 됨)
--  * \r\n → \n 통일, 앞뒤 공백·빈 줄만 제거 (가운데 줄바꿈은 그대로)
--  * 비어 있으면 null
-- ---------------------------------------------------------------------
create or replace function private.normalize_memo(p_memo text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text;
begin
  if p_memo is null then
    return null;
  end if;
  v := btrim(replace(p_memo, E'\r\n', E'\n'), E' \t\r\n');
  if v = '' then
    return null;
  end if;
  if char_length(v) > 2000 then
    raise exception '상세 메모는 2000자 이내로 입력해 주세요. (현재 %자)', char_length(v);
  end if;
  return v;
end;
$$;

revoke all on function private.normalize_memo(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- add_log: 기존 시그니처를 지우고 p_memo 를 추가해 다시 만든다
-- (인자 목록이 바뀌면 create or replace 가 덮어쓰지 않고 오버로드를 만들기 때문)
-- ---------------------------------------------------------------------
drop function if exists public.add_log(text, text, text, int, int, date);
drop function if exists public.add_log(text, text, text, int, int, date, text);

create function public.add_log(
  p_token text, p_title text, p_category text,
  p_minutes int, p_difficulty int, p_work_date date,
  p_memo text default null
) returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_me   public.members := private.auth_member(p_token);
  v_memo text;
  v_id   uuid;
begin
  perform private.validate_log(p_title, p_category, p_minutes, p_difficulty, p_work_date);
  v_memo := private.normalize_memo(p_memo);

  insert into public.logs (team_id, member_id, title, category, minutes, difficulty, work_date, memo)
  values (v_me.team_id, v_me.id, btrim(p_title), p_category, p_minutes, p_difficulty, p_work_date, v_memo)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- update_log: 규칙은 그대로 (본인 + 대기 중만), 메모도 함께 수정
-- ---------------------------------------------------------------------
drop function if exists public.update_log(text, uuid, text, text, int, int, date);
drop function if exists public.update_log(text, uuid, text, text, int, int, date, text);

create function public.update_log(
  p_token text, p_log_id uuid, p_title text, p_category text,
  p_minutes int, p_difficulty int, p_work_date date,
  p_memo text default null
) returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_me   public.members := private.auth_member(p_token);
  v_log  public.logs;
  v_memo text;
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
  v_memo := private.normalize_memo(p_memo);

  update public.logs
     set title = btrim(p_title), category = p_category, minutes = p_minutes,
         difficulty = p_difficulty, work_date = p_work_date, memo = v_memo
   where id = p_log_id;
end;
$$;

-- ---------------------------------------------------------------------
-- get_team_data: 시그니처 동일, 응답에 memo 추가
-- ---------------------------------------------------------------------
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
               'memo', l.memo,
               'status', l.status, 'confirmed_by', l.confirmed_by,
               'confirmed_at', l.confirmed_at, 'created_at', l.created_at
             ) order by l.work_date desc, l.created_at desc)
      from public.logs l where l.team_id = v_team.id
    ), '[]'::json)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 실행 권한 (새로 만든 함수는 권한을 다시 지정해야 한다)
-- ---------------------------------------------------------------------
revoke all on function public.add_log(text, text, text, int, int, date, text)          from public, anon, authenticated;
revoke all on function public.update_log(text, uuid, text, text, int, int, date, text) from public, anon, authenticated;
revoke all on function public.get_team_data(text, text)                                from public, anon, authenticated;

grant execute on function public.add_log(text, text, text, int, int, date, text)          to anon, authenticated;
grant execute on function public.update_log(text, uuid, text, text, int, int, date, text) to anon, authenticated;
grant execute on function public.get_team_data(text, text)                                to anon, authenticated;

-- PostgREST 가 바뀐 함수 시그니처를 바로 인식하도록 스키마 캐시 새로고침
notify pgrst, 'reload schema';
