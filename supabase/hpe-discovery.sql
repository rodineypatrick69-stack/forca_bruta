-- Localização opcional e temporária para a busca de academias, personais e alunos sem vínculo.
-- Execute no projeto Supabase jzvzlcdaywqjhserndyf antes de publicar a função hpe-accounts.

begin;
create table if not exists public.hpe_discovery (
  profile_id uuid primary key references public.hpe_profiles(id) on delete cascade,
  role text not null check (role in ('aluno','personal')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);
create index if not exists hpe_discovery_role_updated_idx
  on public.hpe_discovery(role, updated_at desc);
alter table public.hpe_discovery enable row level security;
revoke all on public.hpe_discovery from anon, authenticated;
grant all on public.hpe_discovery to service_role;
commit;
