begin;
create or replace function public.hpe_student_permission(target uuid, channel text, writing boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from public.hpe_profiles student
  join public.hpe_profiles caller on caller.id=auth.uid()
  where student.id=target and student.role='aluno' and (
   (caller.id=student.id and (not writing or channel in ('progress','chat'))) or
   (caller.role='personal' and caller.id=student.personal_id) or
   (caller.role='adm' and not writing)
  )
 );
$$;
revoke all on function public.hpe_student_permission(uuid,text,boolean) from public,anon;
grant execute on function public.hpe_student_permission(uuid,text,boolean) to authenticated;
create table if not exists public.hpe_student_shared(
 student_id uuid not null references public.hpe_profiles(id) on delete cascade,
 channel text not null check(channel in ('program','progress')),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 revision bigint not null default 1,updated_at timestamptz not null default now(),
 primary key(student_id,channel)
);
alter table public.hpe_student_shared enable row level security;
revoke all on public.hpe_student_shared from anon,authenticated;
grant select,insert,update on public.hpe_student_shared to authenticated;
drop policy if exists hpe_shared_read on public.hpe_student_shared;
create policy hpe_shared_read on public.hpe_student_shared for select to authenticated
using(public.hpe_student_permission(student_id,channel,false));
drop policy if exists hpe_shared_insert on public.hpe_student_shared;
create policy hpe_shared_insert on public.hpe_student_shared for insert to authenticated
with check(public.hpe_student_permission(student_id,channel,true));
drop policy if exists hpe_shared_update on public.hpe_student_shared;
create policy hpe_shared_update on public.hpe_student_shared for update to authenticated
using(public.hpe_student_permission(student_id,channel,true))
with check(public.hpe_student_permission(student_id,channel,true));

create or replace function public.hpe_save_student(target uuid,kind text,expected_revision bigint,student_payload jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare rev bigint;
begin
 if not public.hpe_student_permission(target,kind,true) then raise exception 'FORBIDDEN'; end if;
 if jsonb_typeof(student_payload)<>'object' or pg_column_size(student_payload)>5000000 then raise exception 'INVALID_PAYLOAD'; end if;
 if expected_revision=0 then
  insert into public.hpe_student_shared(student_id,channel,payload) values(target,kind,student_payload)
  on conflict do nothing returning revision into rev;
 else
  update public.hpe_student_shared set payload=student_payload,revision=revision+1,updated_at=now()
  where student_id=target and channel=kind and revision=expected_revision returning revision into rev;
 end if;
 if rev is null then raise exception 'SHARED_CONFLICT'; end if;
 return rev;
end $$;
revoke all on function public.hpe_save_student(uuid,text,bigint,jsonb) from public,anon;
grant execute on function public.hpe_save_student(uuid,text,bigint,jsonb) to authenticated;
create table if not exists public.hpe_student_messages(
 id uuid primary key,student_id uuid not null references public.hpe_profiles(id) on delete cascade,
 author_id uuid not null default auth.uid() references auth.users(id),
 body text not null check(length(body) between 1 and 2000),created_at timestamptz not null default now()
);
alter table public.hpe_student_messages enable row level security;
revoke all on public.hpe_student_messages from anon,authenticated;
grant select,insert on public.hpe_student_messages to authenticated;
drop policy if exists hpe_chat_read on public.hpe_student_messages;
create policy hpe_chat_read on public.hpe_student_messages for select to authenticated
using(public.hpe_student_permission(student_id,'chat',false));
drop policy if exists hpe_chat_insert on public.hpe_student_messages;
create policy hpe_chat_insert on public.hpe_student_messages for insert to authenticated
with check(author_id=auth.uid() and public.hpe_student_permission(student_id,'chat',true));
commit;
