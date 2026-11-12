begin;

create or replace function hpe_private.hpe_consultation_mark_seen(target_consultation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'FORBIDDEN';
  end if;

  update public.hpe_consultation_students
  set personal_seen_at = now()
  where id = target_consultation
    and personal_id = actor;
  if found then
    return;
  end if;

  update public.hpe_consultation_students
  set student_seen_at = now()
  where id = target_consultation
    and student_id = actor;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
end;
$$;

grant usage on schema hpe_private to authenticated;
revoke all on function hpe_private.hpe_consultation_mark_seen(uuid) from public, anon;
grant execute on function hpe_private.hpe_consultation_mark_seen(uuid) to authenticated;

create or replace function public.hpe_consultation_mark_seen(target_consultation uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select hpe_private.hpe_consultation_mark_seen(target_consultation);
$$;

revoke all on function public.hpe_consultation_mark_seen(uuid) from public, anon;
grant execute on function public.hpe_consultation_mark_seen(uuid) to authenticated;

commit;
