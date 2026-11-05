-- Read only the signed-in student's fees from their current personal's saved data.
-- The account payload remains private; no billing records are changed here.
create schema if not exists hpe_private;
revoke all on schema hpe_private from public, anon;
grant usage on schema hpe_private to authenticated;
create or replace function hpe_private.my_fee_reminders()
returns jsonb language sql stable security definer set search_path = ''
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'month', month.key,
  'expected', month.value->(student.value->>'id')->'expected',
  'received', month.value->(student.value->>'id')->'received',
  'due', month.value->(student.value->>'id')->'due'
 ) order by month.key), '[]'::jsonb)
 from public.hpe_profiles profile
 join public.hpe_account_data account on account.user_id=profile.personal_id
 cross join lateral jsonb_array_elements(
  case when jsonb_typeof(account.payload->'students')='array' then account.payload->'students' else '[]'::jsonb end
 ) student
 cross join lateral jsonb_each(
  case when jsonb_typeof(account.payload->'monthlyFees')='object' then account.payload->'monthlyFees' else '{}'::jsonb end
 ) month
 where auth.uid() is not null and profile.id=auth.uid() and profile.role='aluno'
 and student.value->>'supabaseId'=profile.id::text
 and jsonb_typeof(month.value->(student.value->>'id'))='object';
$$;
revoke all on function hpe_private.my_fee_reminders() from public, anon;
grant execute on function hpe_private.my_fee_reminders() to authenticated;
create or replace function public.hpe_my_fee_reminders()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select hpe_private.my_fee_reminders(); $$;
revoke all on function public.hpe_my_fee_reminders() from public, anon;
grant execute on function public.hpe_my_fee_reminders() to authenticated;
