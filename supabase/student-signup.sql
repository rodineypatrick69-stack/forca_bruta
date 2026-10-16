-- Autocadastro: aluno escolhe a senha, vínculo vem de convite do personal.
begin;
alter table public.hpe_profiles add column if not exists whatsapp text;
create table if not exists public.hpe_student_invites (
 personal_id uuid primary key references public.hpe_profiles(id) on delete cascade,
 code text not null unique default replace(gen_random_uuid()::text,'-',''),
 created_at timestamptz not null default now()
);
alter table public.hpe_student_invites enable row level security;
revoke all on public.hpe_student_invites from public, anon, authenticated;

create or replace function public.hpe_my_student_invite() returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if not exists(select 1 from public.hpe_profiles where id=auth.uid() and role='personal') then raise exception 'FORBIDDEN'; end if;
 insert into public.hpe_student_invites(personal_id) values(auth.uid()) on conflict(personal_id) do nothing;
 select code into result from public.hpe_student_invites where personal_id=auth.uid();
 return result;
end $$;
revoke all on function public.hpe_my_student_invite() from public, anon, authenticated;
grant execute on function public.hpe_my_student_invite() to authenticated;

create or replace function public.hpe_student_invite_status(invite_code text) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('valid',p.lifetime or (select count(*) from public.hpe_profiles where personal_id=p.id and role='aluno')<p.license_limit,'name',p.name)
 from public.hpe_student_invites i join public.hpe_profiles p on p.id=i.personal_id
 where i.code=lower(trim(invite_code)) and p.role='personal'),'{"valid":false}'::jsonb)
$$;
revoke all on function public.hpe_student_invite_status(text) from public, anon, authenticated;
grant execute on function public.hpe_student_invite_status(text) to anon, authenticated;

create or replace function public.hpe_register_student_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; student_name text; phone text;
begin
 if new.raw_user_meta_data->>'hpe_signup' is distinct from 'student' then return new; end if;
 select p.id into teacher from public.hpe_student_invites i join public.hpe_profiles p on p.id=i.personal_id
 where i.code=lower(trim(new.raw_user_meta_data->>'invite_code')) and p.role='personal';
 if teacher is null then raise exception 'INVALID_INVITE'; end if;
 student_name=trim(new.raw_user_meta_data->>'name');phone=coalesce(new.raw_user_meta_data->>'whatsapp','');
 if student_name is null or length(student_name)<2 or length(student_name)>80 or length(phone)>24 then raise exception 'INVALID_STUDENT'; end if;
 -- Never trust role, personal_id, lifetime or limits from signup metadata.
 -- Existing hpe_student_limit trigger locks teacher and enforces capacity.
 insert into public.hpe_profiles(id,name,email,role,personal_id,whatsapp)
 values(new.id,student_name,new.email,'aluno',teacher,phone);
 return new;
end $$;
revoke all on function public.hpe_register_student_profile() from public, anon, authenticated;
drop trigger if exists hpe_self_signup_profile on auth.users;
create trigger hpe_self_signup_profile after insert on auth.users for each row execute function public.hpe_register_student_profile();
commit;
