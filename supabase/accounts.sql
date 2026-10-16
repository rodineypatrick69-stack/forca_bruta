begin;
alter table public.hpe_profiles add column if not exists email text;
alter table public.hpe_profiles add column if not exists goal text not null default 'Hipertrofia';
alter table public.hpe_profiles add column if not exists level text not null default 'Iniciante';
alter table public.hpe_profiles add column if not exists training_days integer[] not null default '{}';
update public.hpe_profiles p set email=u.email from auth.users u where u.id=p.id and p.email is null;
grant select, insert, update, delete on public.hpe_profiles to service_role;

-- O bloqueio do professor serializa cadastros simultâneos na última licença.
create or replace function public.hpe_check_student_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare teacher public.hpe_profiles;
begin
  if new.role = 'aluno' then
    if new.personal_id is null then raise exception 'PERSONAL_REQUIRED'; end if;
    select * into teacher from public.hpe_profiles where id=new.personal_id for update;
    if not found or teacher.role <> 'personal' then raise exception 'INVALID_PERSONAL'; end if;
    if not teacher.lifetime and
       (select count(*) from public.hpe_profiles where role='aluno' and personal_id=new.personal_id and id<>new.id) >= teacher.license_limit
    then raise exception 'LICENSE_LIMIT'; end if;
  end if;
  return new;
end $$;
revoke all on function public.hpe_check_student_limit() from public, anon, authenticated;
drop trigger if exists hpe_student_limit on public.hpe_profiles;
create trigger hpe_student_limit before insert or update of role, personal_id on public.hpe_profiles
for each row execute function public.hpe_check_student_limit();

create table if not exists public.hpe_license_requests (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.hpe_profiles(id),
  status text not null default 'pendente' check(status in ('pendente','aprovada','recusada','dispensada')),
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create unique index if not exists hpe_one_pending_request on public.hpe_license_requests(personal_id) where status='pendente';
alter table public.hpe_license_requests enable row level security;
revoke all on public.hpe_license_requests from anon, authenticated;
grant select, insert, update, delete on public.hpe_license_requests to service_role;

-- Chamado somente pela função do servidor, após validar o token do usuário.
create or replace function public.hpe_license_action(actor uuid, action text, target uuid, enabled boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare caller public.hpe_profiles; teacher public.hpe_profiles; request public.hpe_license_requests;
begin
  select * into caller from public.hpe_profiles where id=actor;
  if not found then raise exception 'FORBIDDEN'; end if;
  if action='request' then
    if caller.role<>'personal' then raise exception 'FORBIDDEN'; end if;
    select * into teacher from public.hpe_profiles where id=actor for update;
    if teacher.lifetime then raise exception 'UNLIMITED'; end if;
    insert into public.hpe_license_requests(personal_id) values(actor) on conflict do nothing;
  elsif action='lifetime' then
    if caller.role<>'adm' then raise exception 'FORBIDDEN'; end if;
    select * into teacher from public.hpe_profiles where id=target for update;
    if not found or teacher.role<>'personal' then raise exception 'INVALID_PERSONAL'; end if;
    update public.hpe_profiles set lifetime=enabled where id=target;
    if enabled then update public.hpe_license_requests set status='dispensada',resolved_at=now() where personal_id=target and status='pendente'; end if;
  elsif action in ('approve','reject') then
    if caller.role<>'adm' then raise exception 'FORBIDDEN'; end if;
    select * into request from public.hpe_license_requests where id=target;
    if not found then raise exception 'INVALID_REQUEST'; end if;
    select * into teacher from public.hpe_profiles where id=request.personal_id for update;
    select * into request from public.hpe_license_requests where id=target for update;
    if request.status<>'pendente' then raise exception 'ALREADY_RESOLVED'; end if;
    if action='approve' and not teacher.lifetime then
      update public.hpe_profiles set license_limit=license_limit+20 where id=teacher.id;
    end if;
    update public.hpe_license_requests set status=case when teacher.lifetime then 'dispensada' when action='approve' then 'aprovada' else 'recusada' end,resolved_at=now() where id=target;
  else raise exception 'INVALID_ACTION'; end if;
end $$;
revoke all on function public.hpe_license_action(uuid,text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.hpe_license_action(uuid,text,uuid,boolean) to service_role;
commit;
