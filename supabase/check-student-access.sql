-- Verificações sem inserir contas ou expor e-mails.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hpe_profiles' and column_name='access_code') then raise exception 'ACCESS_CODE_COLUMN_MISSING'; end if;
 if exists(select access_code from public.hpe_profiles where role='aluno' group by access_code having access_code is null or count(*)>1) then raise exception 'ACCESS_CODE_MISSING_OR_DUPLICATED'; end if;
 if exists(select 1 from pg_trigger where tgname='hpe_self_signup_profile' and tgrelid='auth.users'::regclass and not tgisinternal and tgenabled<>'D') then raise exception 'PUBLIC_STUDENT_SIGNUP_STILL_ACTIVE'; end if;
end $$;
select 'OK: códigos únicos, coluna ativa e autocadastro desativado' as resultado;
