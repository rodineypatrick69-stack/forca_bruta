-- Testes transacionais, sem contas persistentes e sem envio de e-mail.
begin;
do $$
declare teacher uuid=gen_random_uuid(); pupil uuid=gen_random_uuid(); token text; rejected boolean=false;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(teacher,teacher::text||'@example.invalid','{}');
 insert into public.hpe_profiles(id,name,role,license_limit) values(teacher,'Personal teste','personal',1);
 if not exists(select 1 from public.hpe_public_personals() where id=teacher and available) then raise exception 'DIRECTORY_FAILED'; end if;
 insert into auth.users(id,email,raw_user_meta_data) values(pupil,pupil::text||'@example.invalid',jsonb_build_object('hpe_signup','student','name','Aluno teste','personal_id',teacher,'role','adm','lifetime',true));
 if not exists(select 1 from public.hpe_profiles where id=pupil and role='aluno' and personal_id=teacher and not lifetime) then raise exception 'LINK_OR_ROLE_FAILED'; end if;
 if exists(select 1 from public.hpe_public_personals() where id=teacher and available) then raise exception 'CAPACITY_DISPLAY_FAILED'; end if;
 begin
  insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'full-'||teacher::text||'@example.invalid',jsonb_build_object('hpe_signup','student','name','Sem vaga','personal_id',teacher));
 exception when others then if sqlerrm not like '%LICENSE_LIMIT%' then raise; end if;rejected=true;end;
 if not rejected then raise exception 'LIMIT_NOT_ENFORCED';end if;
 rejected=false;
 begin
  insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'invalid-'||teacher::text||'@example.invalid',jsonb_build_object('hpe_signup','student','name','Vinculo invalido','personal_id',pupil));
 exception when others then if sqlerrm not like '%INVALID_PERSONAL%' then raise; end if;rejected=true;end;
 if not rejected then raise exception 'INVALID_PERSONAL_ACCEPTED';end if;
 update public.hpe_profiles set lifetime=true where id=teacher;
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 token=public.hpe_my_student_invite();
 insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'invite-'||teacher::text||'@example.invalid',jsonb_build_object('hpe_signup','student','name','Por convite','invite_code',token));
 if exists(select 1 from public.hpe_public_personals() where id=pupil) then raise exception 'STUDENT_EXPOSED';end if;
end $$;
select 'OK: lista, vinculo, papel aluno, vagas e convite' as resultado;
rollback;
