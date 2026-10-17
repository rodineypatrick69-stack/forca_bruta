-- Testes transacionais, sem contas persistentes e sem envio de e-mail. Aplicar após student-personal-selection.sql.
begin;
do $$
declare teacher uuid=gen_random_uuid(); pupil uuid=gen_random_uuid(); draft uuid; rejected boolean=false;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(teacher,teacher::text||'@example.invalid','{}');
 insert into public.hpe_profiles(id,name,role,license_limit) values(teacher,'Personal teste','personal',2);
 if not exists(select 1 from public.hpe_public_personals() where id=teacher and available) then raise exception 'DIRECTORY_FAILED'; end if;
 select (public.hpe_save_student_draft(teacher,null,'Aluno pré-cadastrado',null,'','A definir','A definir','{}')).id into draft;
 if not exists(select 1 from public.hpe_student_drafts where id=draft and personal_id=teacher) then raise exception 'DRAFT_FAILED'; end if;
 insert into auth.users(id,email,raw_user_meta_data) values(pupil,pupil::text||'@example.invalid',jsonb_build_object('hpe_signup','student','name','Aluno pré-cadastrado','personal_id',teacher,'role','adm','lifetime',true));
 if not exists(select 1 from public.hpe_profiles where id=pupil and role='aluno' and personal_id=teacher and not lifetime and goal='A definir') then raise exception 'LINK_OR_ROLE_FAILED'; end if;
 if exists(select 1 from public.hpe_student_drafts where id=draft) then raise exception 'DRAFT_NOT_MERGED'; end if;
 if exists(select 1 from public.hpe_public_personals() where id=teacher and available) then raise exception 'CAPACITY_DISPLAY_FAILED'; end if;
 begin insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'full-'||teacher::text||'@example.invalid',jsonb_build_object('hpe_signup','student','name','Sem vaga','personal_id',teacher)); exception when others then if sqlerrm not like '%LICENSE_LIMIT%' then raise; end if;rejected=true;end;
 if not rejected then raise exception 'LIMIT_NOT_ENFORCED';end if;
 rejected=false;
 begin perform public.hpe_save_student_draft(teacher,null,'Outro aluno',null,'','A definir','A definir','{}'); exception when others then if sqlerrm not like '%LICENSE_LIMIT%' then raise; end if;rejected=true;end;
 if not rejected then raise exception 'DRAFT_LIMIT_NOT_ENFORCED';end if;
 rejected=false;
 begin perform public.hpe_save_student_draft(pupil,null,'Tentativa inválida',null,'','A definir','A definir','{}'); exception when others then if sqlerrm not like '%FORBIDDEN%' then raise; end if;rejected=true;end;
 if not rejected then raise exception 'DRAFT_OWNER_NOT_ENFORCED';end if;
end $$;
select 'OK: lista pública, pré-cadastro privado, conversão, papel, limite e autorização' as resultado;
rollback;
