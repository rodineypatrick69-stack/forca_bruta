-- Converte os códigos de acesso dos alunos para seis dígitos.
-- Preserve as senhas atuais dos alunos cadastrados.
begin;

do $$
declare
  student record;
  candidate text;
  attempts integer;
begin
  for student in
    select id from public.hpe_profiles where role = 'aluno' order by id
  loop
    attempts := 0;
    loop
      attempts := attempts + 1;
      candidate := lpad(floor(random() * 1000000)::integer::text, 6, '0');
      exit when not exists (
        select 1 from public.hpe_profiles
        where access_code = candidate and id <> student.id
      );
      if attempts >= 1000 then
        raise exception 'Não foi possível gerar um código de acesso único.';
      end if;
    end loop;
    update public.hpe_profiles
      set access_code = candidate
      where id = student.id;
  end loop;
end $$;

alter table public.hpe_profiles
  drop constraint if exists hpe_student_access_code_format;
alter table public.hpe_profiles
  add constraint hpe_student_access_code_format
  check (access_code is null or access_code ~ '^[0-9]{6}$');

notify pgrst, 'reload schema';
commit;
