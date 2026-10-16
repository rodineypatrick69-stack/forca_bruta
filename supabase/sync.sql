begin;
create table if not exists public.hpe_account_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.hpe_account_data enable row level security;
revoke all on public.hpe_account_data from anon, authenticated;
grant select,insert,update on public.hpe_account_data to authenticated;
drop policy if exists hpe_own_data on public.hpe_account_data;
create policy hpe_own_data on public.hpe_account_data to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create or replace function public.hpe_save_account(expected_revision bigint, account_payload jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare new_revision bigint;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if jsonb_typeof(account_payload)<>'object' or pg_column_size(account_payload)>5000000 then raise exception 'INVALID_PAYLOAD'; end if;
  if expected_revision=0 then
    insert into public.hpe_account_data(user_id,payload) values(auth.uid(),account_payload)
      on conflict(user_id) do nothing returning revision into new_revision;
  else
    update public.hpe_account_data set payload=account_payload,revision=revision+1,updated_at=now()
      where user_id=auth.uid() and revision=expected_revision returning revision into new_revision;
  end if;
  if new_revision is null then raise exception 'SYNC_CONFLICT'; end if;
  return new_revision;
end $$;
revoke all on function public.hpe_save_account(bigint,jsonb) from public,anon;
grant execute on function public.hpe_save_account(bigint,jsonb) to authenticated;
commit;
