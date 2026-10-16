-- Tudo é revertido: não deixa contas de teste nem envia e-mails.
begin;
do $$
declare teacher uuid=gen_random_uuid(); pupil uuid=gen_random_uuid(); token text;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(teacher,teacher::text||'@example.invalid','{}');
 insert into public.hpe_profiles(id,name,role,license_limit) values(teacher,'Teste transacional','personal',1);
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 token=public.hpe_my_student_invite();
 if not (public.hpe_student_invite_status(token)->>'valid')::boolean then raise exception 'VALID_INVITE_FAILED'; end if;
 insert into auth.users(id,email,raw_user_meta_data) values(pupil,pupil::text||'@example.invalid',jsonb_build_object('hpe_signup','student','name','Aluno de teste','invite_code',token,'role','adm','lifetime',true));
 if not exists(select 1 from public.hpe_profiles where id=pupil and role='aluno' and personal_id=teacher and lifetime=false) then raise exception 'ROLE_PROTECTION_FAILED'; end if;
 begin
  insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'limit-'||teacher::text||'@example.invalid',jsonb_build_object('hpe_signup','student','name','Sem licença','invite_code',token));
  raise exception 'LIMIT_NOT_ENFORCED';
 exception when others then if sqlerrm not like '%LICENSE_LIMIT%' then raise; end if; end;
 update public.hpe_profiles set lifetime=true where id=teacher;
 insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'lifetime-'||teacher::text||'@example.invalid',jsonb_build_object('hpe_signup','student','name','Vitalício','invite_code',token));
 if has_table_privilege('anon','public.hpe_student_invites','select') then raise exception 'INVITE_TABLE_EXPOSED'; end if;
 if has_function_privilege('anon','public.hpe_my_student_invite()','execute') then raise exception 'INVITE_GENERATION_EXPOSED'; end if;
end $$;
select 'OK: vínculo, papel aluno, limite, vitalício e permissões' as resultado;
rollback;
