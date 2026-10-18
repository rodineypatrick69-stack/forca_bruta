-- Código de acesso para alunos criados pelo personal.
-- Execute no projeto jzvzlcdaywqjhserndyf.
begin;

alter table public.hpe_profiles add column if not exists email text;
alter table public.hpe_profiles add column if not exists whatsapp text;
alter table public.hpe_profiles add column if not exists goal text not null default 'Hipertrofia';
alter table public.hpe_profiles add column if not exists level text not null default 'Iniciante';
alter table public.hpe_profiles add column if not exists training_days integer[] not null default '{}';
update public.hpe_profiles p set email=u.email from auth.users u where u.id=p.id and p.email is null;
alter table public.hpe_profiles add column if not exists access_code text;
create unique index if not exists hpe_profiles_access_code_unique
  on public.hpe_profiles(access_code) where access_code is not null;

-- Atribui códigos únicos aos alunos existentes sem alterar as contas Auth ou suas senhas.
do $$
declare student record; candidate text;
begin
  for student in select id from public.hpe_profiles where role='aluno' and access_code is null loop
    loop
      candidate=upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
      exit when not exists(select 1 from public.hpe_profiles where access_code=candidate);
    end loop;
    update public.hpe_profiles set access_code=candidate where id=student.id and access_code is null;
  end loop;
end $$;

alter table public.hpe_profiles drop constraint if exists hpe_student_access_code_format;
alter table public.hpe_profiles drop constraint if exists hpe_student_access_code_required;
alter table public.hpe_profiles
  add constraint hpe_student_access_code_format
  check (access_code is null or access_code ~ '^[A-F0-9]{16}$');
alter table public.hpe_profiles
  add constraint hpe_student_access_code_required
  check (role <> 'aluno' or access_code is not null);

-- Não permite contas de aluno criadas fora da função protegida.
drop trigger if exists hpe_self_signup_profile on auth.users;
drop function if exists public.hpe_register_student_profile();
drop function if exists public.hpe_student_invite_status(text);
drop function if exists public.hpe_my_student_invite();
drop function if exists public.hpe_public_personals();

-- O trigger de limite de licenças em hpe_profiles permanece ativo.
notify pgrst,'reload schema';
commit;

select count(*) as alunos_com_codigo
from public.hpe_profiles
where role='aluno' and access_code is not null;
