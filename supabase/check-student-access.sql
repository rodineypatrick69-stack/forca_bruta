-- Verificações sem inserir contas ou expor e-mails.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hpe_profiles' and column_name='access_code') then raise exception 'ACCESS_CODE_COLUMN_MISSING'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hpe_profiles' and column_name='password_setup_required') then raise exception 'PASSWORD_SETUP_COLUMN_MISSING'; end if;
 if exists(select 1 from public.hpe_profiles where role='aluno' and (access_code is null or access_code !~ '^[0-9]{6}$')) then raise exception 'ACCESS_CODE_INVALID'; end if;
 if exists(select access_code from public.hpe_profiles where role='aluno' group by access_code having count(*)>1) then raise exception 'ACCESS_CODE_DUPLICATED'; end if;
 if exists(select 1 from pg_trigger where tgname='hpe_self_signup_profile' and tgrelid='auth.users'::regclass and not tgisinternal and tgenabled<>'D') then raise exception 'PUBLIC_STUDENT_SIGNUP_STILL_ACTIVE'; end if;
end $$;
select 'OK: códigos de 6 dígitos únicos, senha inicial protegida e autocadastro desativado' as resultado;
