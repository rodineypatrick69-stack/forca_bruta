-- Execute depois de accounts.sql e student-signup.sql.
-- Publica somente identificador, nome profissional e disponibilidade.
begin;
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='hpe_student_limit' and tgrelid='public.hpe_profiles'::regclass and not tgisinternal and tgenabled<>'D') then
  raise exception 'Execute accounts.sql antes: controle de licencas ausente';
 end if;
 if not exists(select 1 from pg_trigger where tgname='hpe_self_signup_profile' and tgrelid='auth.users'::regclass and not tgisinternal and tgenabled<>'D') then
  raise exception 'Execute student-signup.sql antes: autocadastro ausente';
 end if;
end $$;

create or replace function public.hpe_public_personals()
returns table(id uuid,name text,available boolean)
language sql stable security definer set search_path='' as $$
 select p.id,p.name,(p.lifetime or (select count(*) from public.hpe_profiles s where s.role='aluno' and s.personal_id=p.id)<p.license_limit)
 from public.hpe_profiles p where p.role='personal'
 order by lower(p.name),p.id
$$;
revoke all on function public.hpe_public_personals() from public,anon,authenticated;
grant execute on function public.hpe_public_personals() to anon,authenticated;

create or replace function public.hpe_register_student_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; student_name text; phone text; code text; selected text;
begin
 if new.raw_user_meta_data->>'hpe_signup' is distinct from 'student' then return new; end if;
 code=trim(coalesce(new.raw_user_meta_data->>'invite_code',''));
 selected=trim(coalesce(new.raw_user_meta_data->>'personal_id',''));
 if code<>'' then
  select p.id into teacher from public.hpe_student_invites i join public.hpe_profiles p on p.id=i.personal_id
  where i.code=lower(code) and p.role='personal';
 else
  -- Compare as text to reject invalid UUID input without trusting client roles.
  select p.id into teacher from public.hpe_profiles p where p.id::text=selected and p.role='personal';
 end if;
 if teacher is null then raise exception 'INVALID_PERSONAL'; end if;
 student_name=trim(new.raw_user_meta_data->>'name');phone=coalesce(new.raw_user_meta_data->>'whatsapp','');
 if student_name is null or length(student_name)<2 or length(student_name)>80 or length(phone)>24 then raise exception 'INVALID_STUDENT'; end if;
 -- The hpe_student_limit trigger locks the personal and enforces capacity.
 -- Role, license_limit and lifetime from metadata are never copied.
 insert into public.hpe_profiles(id,name,email,role,personal_id,whatsapp)
 values(new.id,student_name,new.email,'aluno',teacher,phone);
 return new;
end $$;
revoke all on function public.hpe_register_student_profile() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
