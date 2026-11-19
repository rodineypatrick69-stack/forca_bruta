begin;

-- Allow self-created standalone student profiles while preserving trainer limits.
create or replace function public.hpe_check_student_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare teacher public.hpe_profiles;
begin
  if new.role = 'aluno' then
    if new.consultation_only then
      if new.personal_id is not null then raise exception 'CONSULTATION_PERSONAL_SEPARATE'; end if;
      return new;
    end if;
    if tg_op = 'UPDATE'
       and not coalesce(old.consultation_only, false)
       and old.personal_id is not null
       and new.personal_id is null then
      raise exception 'PERSONAL_REQUIRED';
    end if;
    if new.personal_id is null then return new; end if;
    select * into teacher from public.hpe_profiles where id = new.personal_id for update;
    if not found or teacher.role <> 'personal' then raise exception 'INVALID_PERSONAL'; end if;
    if not teacher.lifetime and
       (select count(*) from public.hpe_profiles
        where role = 'aluno' and not consultation_only
          and personal_id = new.personal_id and id <> new.id) >= teacher.license_limit
    then raise exception 'LICENSE_LIMIT'; end if;
  end if;
  return new;
end;
$$;

revoke all on function public.hpe_check_student_limit() from public, anon, authenticated;
drop trigger if exists hpe_student_limit on public.hpe_profiles;
create trigger hpe_student_limit
before insert or update of role, personal_id, consultation_only on public.hpe_profiles
for each row execute function public.hpe_check_student_limit();

-- Store only a keyed digest of the caller IP for a short public-signup limit.
create table if not exists public.hpe_independent_signup_limits (
  ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null default 1 check (attempts > 0)
);
alter table public.hpe_independent_signup_limits enable row level security;
revoke all on table public.hpe_independent_signup_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.hpe_independent_signup_limits to service_role;

create or replace function public.hpe_allow_independent_signup(signup_ip_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempt_count integer;
begin
  if signup_ip_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  insert into public.hpe_independent_signup_limits(ip_hash, window_started_at, attempts)
  values (signup_ip_hash, now(), 1)
  on conflict (ip_hash) do update
    set window_started_at = case
          when public.hpe_independent_signup_limits.window_started_at <= now() - interval '15 minutes' then now()
          else public.hpe_independent_signup_limits.window_started_at
        end,
        attempts = case
          when public.hpe_independent_signup_limits.window_started_at <= now() - interval '15 minutes' then 1
          else public.hpe_independent_signup_limits.attempts + 1
        end
  returning attempts into attempt_count;

  if mod(extract(epoch from now())::bigint, 60) = 0 then
    delete from public.hpe_independent_signup_limits
    where window_started_at < now() - interval '1 day';
  end if;
  return attempt_count <= 5;
end;
$$;
revoke all on function public.hpe_allow_independent_signup(text) from public, anon, authenticated;
grant execute on function public.hpe_allow_independent_signup(text) to service_role;

notify pgrst, 'reload schema';
commit;
