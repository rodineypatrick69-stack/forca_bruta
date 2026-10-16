-- Execute no SQL Editor do projeto jzvzlcdaywqjhserndyf.
-- Não contém senhas. Não importa os dados locais do aplicativo.
begin;

create table if not exists public.hpe_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('adm', 'personal', 'aluno')),
  personal_id uuid references public.hpe_profiles(id),
  license_limit integer not null default 20 check (license_limit >= 0),
  lifetime boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.hpe_profiles enable row level security;
revoke all on public.hpe_profiles from anon, authenticated;
grant select on public.hpe_profiles to authenticated;

drop policy if exists hpe_read_own_profile on public.hpe_profiles;
create policy hpe_read_own_profile on public.hpe_profiles
  for select to authenticated using (id = (select auth.uid()));

do $$
declare ceo_id uuid;
begin
  select id into ceo_id from auth.users
    where lower(email) = 'ceo@example.com';
  if ceo_id is null then
    raise exception 'Conta do CEO não encontrada em Authentication > Users.';
  end if;
  insert into public.hpe_profiles (id, name, role)
    values (ceo_id, 'CEO · Administrador principal', 'adm')
    on conflict (id) do update set role = 'adm', name = excluded.name;
end $$;

commit;

select p.id, u.email, p.role from public.hpe_profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = 'ceo@example.com';
