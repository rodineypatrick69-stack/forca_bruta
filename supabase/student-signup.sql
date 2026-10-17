-- Autocadastro: o aluno escolhe a senha e o personal cadastrado.
begin;
alter table public.hpe_profiles add column if not exists whatsapp text;
create or replace function public.hpe_register_student_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; student_name text; phone text; selected text;
begin
 if new.raw_user_meta_data->>'hpe_signup' is distinct from 'student' then return new; end if;
 selected=trim(coalesce(new.raw_user_meta_data->>'personal_id',''));
 select p.id into teacher from public.hpe_profiles p where p.id::text=selected and p.role='personal';
 if teacher is null then raise exception 'INVALID_PERSONAL'; end if;
 student_name=trim(new.raw_user_meta_data->>'name');phone=coalesce(new.raw_user_meta_data->>'whatsapp','');
 if student_name is null or length(student_name)<2 or length(student_name)>80 or length(phone)>24 then raise exception 'INVALID_STUDENT'; end if;
 insert into public.hpe_profiles(id,name,email,role,personal_id,whatsapp)
 values(new.id,student_name,new.email,'aluno',teacher,phone);
 return new;
end $$;
revoke all on function public.hpe_register_student_profile() from public,anon,authenticated;
drop trigger if exists hpe_self_signup_profile on auth.users;
create trigger hpe_self_signup_profile after insert on auth.users for each row execute function public.hpe_register_student_profile();
commit;
