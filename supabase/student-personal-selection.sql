-- Execute depois de accounts.sql e student-signup.sql.
-- Disponibiliza nomes de personais e permite pré-cadastro incompleto no Supabase.
begin;
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='hpe_student_limit' and tgrelid='public.hpe_profiles'::regclass and not tgisinternal and tgenabled<>'D') then raise exception 'Execute accounts.sql antes'; end if;
 if not exists(select 1 from pg_trigger where tgname='hpe_self_signup_profile' and tgrelid='auth.users'::regclass and not tgisinternal and tgenabled<>'D') then raise exception 'Execute student-signup.sql antes'; end if;
end $$;

create table if not exists public.hpe_student_drafts(
 id uuid primary key default gen_random_uuid(), personal_id uuid not null references public.hpe_profiles(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 80), email text, whatsapp text not null default '',
 goal text not null default 'A definir', level text not null default 'A definir', training_days integer[] not null default '{}',
 created_at timestamptz not null default now(), unique(personal_id,email)
);
alter table public.hpe_student_drafts enable row level security;
revoke all on public.hpe_student_drafts from public,anon,authenticated;
grant select,insert,update,delete on public.hpe_student_drafts to service_role;

create or replace function public.hpe_save_student_draft(actor uuid,draft_id uuid,student_name text,student_email text,student_whatsapp text,student_goal text,student_level text,student_days integer[])
returns public.hpe_student_drafts language plpgsql security definer set search_path='' as $$
declare teacher public.hpe_profiles; result public.hpe_student_drafts;
begin
 select * into teacher from public.hpe_profiles where id=actor for update;
 if not found or teacher.role<>'personal' then raise exception 'FORBIDDEN'; end if;
 if length(trim(student_name)) not between 2 and 80 or coalesce(length(student_whatsapp),0)>24 or (student_email is not null and length(student_email)>254) or coalesce(array_length(student_days,1),0)>7 or exists(select 1 from unnest(coalesce(student_days,'{}')) d where d<0 or d>6) then raise exception 'INVALID_DRAFT'; end if;
 if draft_id is not null and not exists(select 1 from public.hpe_student_drafts where id=draft_id and personal_id=actor) then raise exception 'FORBIDDEN'; end if;
 if draft_id is null and not teacher.lifetime and (select count(*) from public.hpe_profiles where role='aluno' and personal_id=actor)+(select count(*) from public.hpe_student_drafts where personal_id=actor)>=teacher.license_limit then raise exception 'LICENSE_LIMIT'; end if;
 if draft_id is null then insert into public.hpe_student_drafts(personal_id,name,email,whatsapp,goal,level,training_days) values(actor,trim(student_name),nullif(trim(student_email),''),coalesce(student_whatsapp,''),coalesce(student_goal,'A definir'),coalesce(student_level,'A definir'),coalesce(student_days,'{}')) returning * into result;
 else update public.hpe_student_drafts set name=trim(student_name),email=nullif(trim(student_email),''),whatsapp=coalesce(student_whatsapp,''),goal=coalesce(student_goal,'A definir'),level=coalesce(student_level,'A definir'),training_days=coalesce(student_days,'{}') where id=draft_id and personal_id=actor returning * into result; end if;
 return result;
end $$;
revoke all on function public.hpe_save_student_draft(uuid,uuid,text,text,text,text,text,integer[]) from public,anon,authenticated;
grant execute on function public.hpe_save_student_draft(uuid,uuid,text,text,text,text,text,integer[]) to service_role;

create or replace function public.hpe_public_personals() returns table(id uuid,name text,available boolean)
language sql stable security definer set search_path='' as $$
 select p.id,p.name,(p.lifetime or (select count(*) from public.hpe_profiles s where s.role='aluno' and s.personal_id=p.id)+(select count(*) from public.hpe_student_drafts d where d.personal_id=p.id)<p.license_limit)
 from public.hpe_profiles p where p.role='personal' order by lower(p.name),p.id
$$;
revoke all on function public.hpe_public_personals() from public,anon,authenticated;
grant execute on function public.hpe_public_personals() to anon,authenticated;

create or replace function public.hpe_register_student_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; student_name text; phone text; selected text; draft public.hpe_student_drafts;
begin
 if new.raw_user_meta_data->>'hpe_signup' is distinct from 'student' then return new; end if;
 selected=trim(coalesce(new.raw_user_meta_data->>'personal_id',''));
 select p.id into teacher from public.hpe_profiles p where p.id::text=selected and p.role='personal';
 if teacher is null then raise exception 'INVALID_PERSONAL'; end if;
 student_name=trim(new.raw_user_meta_data->>'name');phone=coalesce(new.raw_user_meta_data->>'whatsapp','');
 if student_name is null or length(student_name)<2 or length(student_name)>80 or length(phone)>24 then raise exception 'INVALID_STUDENT'; end if;
 -- Reuse a unique pre-registration so its local training identity survives account creation.
 select * into draft from public.hpe_student_drafts d where d.personal_id=teacher and ((d.email is not null and lower(d.email)=lower(new.email)) or (d.email is null and lower(d.name)=lower(student_name) and (select count(*) from public.hpe_student_drafts d2 where d2.personal_id=teacher and d2.email is null and lower(d2.name)=lower(student_name))=1)) order by (d.email is not null) desc limit 1 for update;
 if draft.id is not null then delete from public.hpe_student_drafts where id=draft.id; end if;
 insert into public.hpe_profiles(id,name,email,role,personal_id,whatsapp,goal,level,training_days)
 values(new.id,student_name,new.email,'aluno',teacher,phone,coalesce(draft.goal,'Hipertrofia'),coalesce(draft.level,'Iniciante'),coalesce(draft.training_days,'{}'));
 return new;
end $$;
revoke all on function public.hpe_register_student_profile() from public,anon,authenticated;
-- Desativa o fluxo antigo de códigos sem apagar tabelas para permitir reversão.
revoke all on function public.hpe_my_student_invite() from public,anon,authenticated;
revoke all on function public.hpe_student_invite_status(text) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
