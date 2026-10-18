-- Prepara o primeiro acesso por código numérico com senha temporária.
-- Execute no projeto jzvzlcdaywqjhserndyf antes de publicar a nova função.
begin;

alter table public.hpe_profiles
  add column if not exists password_setup_required boolean not null default false;

alter table public.hpe_profiles
  drop constraint if exists hpe_student_access_code_format;

alter table public.hpe_profiles
  add constraint hpe_student_access_code_format
  check (access_code is null or access_code ~ '^([A-F0-9]{16}|[0-9]{6})$');

notify pgrst, 'reload schema';
commit;
