begin;

alter table public.hpe_profiles
  add column if not exists consultation_only boolean not null default false;

create or replace function public.hpe_check_student_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare teacher public.hpe_profiles;
begin
  if new.role = 'aluno' then
    if new.consultation_only then
      if new.personal_id is not null then raise exception 'CONSULTATION_PERSONAL_SEPARATE'; end if;
      return new;
    end if;
    if new.personal_id is null then raise exception 'PERSONAL_REQUIRED'; end if;
    select * into teacher from public.hpe_profiles where id=new.personal_id for update;
    if not found or teacher.role <> 'personal' then raise exception 'INVALID_PERSONAL'; end if;
    if not teacher.lifetime and
       (select count(*) from public.hpe_profiles where role='aluno' and not consultation_only and personal_id=new.personal_id and id<>new.id) >= teacher.license_limit
    then raise exception 'LICENSE_LIMIT'; end if;
  end if;
  return new;
end;
$$;

-- Existing consultation accounts stay connected to their consult record while
-- being removed from the regular student relationship and workspace.
update public.hpe_profiles p
set consultation_only = true,
    personal_id = null
where p.id in (select c.student_id from public.hpe_consultation_students c)
  and p.role = 'aluno';

create or replace function hpe_private.is_linked_hpe_student(target_student uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.hpe_profiles s
    where s.id = target_student
      and s.role = 'aluno'
      and (
        s.personal_id = (select auth.uid())
        or (s.consultation_only and exists (
          select 1 from public.hpe_consultation_students c
          where c.student_id = s.id and c.personal_id = (select auth.uid())
        ))
      )
  );
$$;

create or replace function hpe_private.hpe_student_permission(target uuid, channel text, writing boolean)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.hpe_profiles student
    join public.hpe_profiles caller on caller.id = (select auth.uid())
    where student.id = target
      and student.role = 'aluno'
      and not student.consultation_only
      and (
        (caller.id = student.id and (not writing or channel in ('progress','chat')))
        or (caller.role = 'personal' and caller.id = student.personal_id)
        or (caller.role = 'adm' and not writing)
      )
  );
$$;
grant usage on schema hpe_private to authenticated;
revoke all on function hpe_private.hpe_student_permission(uuid,text,boolean) from public, anon;
grant execute on function hpe_private.hpe_student_permission(uuid,text,boolean) to authenticated;

drop policy if exists hpe_shared_read on public.hpe_student_shared;
create policy hpe_shared_read on public.hpe_student_shared for select to authenticated
using (hpe_private.hpe_student_permission(student_id,channel,false));
drop policy if exists hpe_shared_insert on public.hpe_student_shared;
create policy hpe_shared_insert on public.hpe_student_shared for insert to authenticated
with check (hpe_private.hpe_student_permission(student_id,channel,true));
drop policy if exists hpe_shared_update on public.hpe_student_shared;
create policy hpe_shared_update on public.hpe_student_shared for update to authenticated
using (hpe_private.hpe_student_permission(student_id,channel,true))
with check (hpe_private.hpe_student_permission(student_id,channel,true));
drop policy if exists hpe_chat_read on public.hpe_student_messages;
create policy hpe_chat_read on public.hpe_student_messages for select to authenticated
using (hpe_private.hpe_student_permission(student_id,'chat',false));
drop policy if exists hpe_chat_insert on public.hpe_student_messages;
create policy hpe_chat_insert on public.hpe_student_messages for insert to authenticated
with check (author_id = (select auth.uid()) and hpe_private.hpe_student_permission(student_id,'chat',true));

create or replace function public.hpe_save_student(target uuid, kind text, expected_revision bigint, student_payload jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare rev bigint;
begin
  if not hpe_private.hpe_student_permission(target,kind,true) then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(student_payload) <> 'object' or pg_column_size(student_payload) > 5000000 then raise exception 'INVALID_PAYLOAD'; end if;
  if expected_revision = 0 then
    insert into public.hpe_student_shared(student_id,channel,payload)
    values(target,kind,student_payload)
    on conflict do nothing returning revision into rev;
  else
    update public.hpe_student_shared
    set payload=student_payload,revision=revision+1,updated_at=now()
    where student_id=target and channel=kind and revision=expected_revision
    returning revision into rev;
  end if;
  if rev is null then raise exception 'SHARED_CONFLICT'; end if;
  return rev;
end;
$$;
revoke all on function public.hpe_save_student(uuid,text,bigint,jsonb) from public, anon;
grant execute on function public.hpe_save_student(uuid,text,bigint,jsonb) to authenticated;
revoke all on function public.hpe_student_permission(uuid,text,boolean) from public, anon, authenticated;
drop function public.hpe_student_permission(uuid,text,boolean);

alter table public.hpe_consultation_students
  add column if not exists personal_seen_at timestamptz,
  add column if not exists student_seen_at timestamptz;

create or replace function public.hpe_consultation_mark_seen(target_consultation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'FORBIDDEN'; end if;
  update public.hpe_consultation_students
  set personal_seen_at=now()
  where id=target_consultation and personal_id=actor;
  if found then return; end if;
  update public.hpe_consultation_students
  set student_seen_at=now()
  where id=target_consultation and student_id=actor;
  if not found then raise exception 'FORBIDDEN'; end if;
end;
$$;
revoke all on function public.hpe_consultation_mark_seen(uuid) from public, anon;
grant execute on function public.hpe_consultation_mark_seen(uuid) to authenticated;

drop policy if exists "consultation photos member read" on public.hpe_consultation_photos;
create policy "consultation photos member read" on public.hpe_consultation_photos
for select to authenticated using (
  exists (
    select 1 from public.hpe_consultation_students c
    where c.id = hpe_consultation_photos.consultation_id
      and c.personal_id = hpe_consultation_photos.personal_id
      and (c.personal_id = (select auth.uid()) or c.student_id = (select auth.uid()))
  )
);
drop policy if exists "consultation student photo upload" on public.hpe_consultation_photos;
create policy "consultation student photo upload" on public.hpe_consultation_photos
for insert to authenticated with check (
  uploader_id = (select auth.uid())
  and exists (
    select 1
    from public.hpe_consultation_students c
    join public.hpe_consultation_intakes i on i.consultation_id = c.id
    where c.id = hpe_consultation_photos.consultation_id
      and c.personal_id = hpe_consultation_photos.personal_id
      and c.student_id = (select auth.uid())
      and i.student_id = c.student_id
      and i.photos_consent_at is not null
  )
);
drop policy if exists "consultation personal photo remove" on public.hpe_consultation_photos;
create policy "consultation personal photo remove" on public.hpe_consultation_photos
for delete to authenticated using (
  exists (
    select 1 from public.hpe_consultation_students c
    where c.id = hpe_consultation_photos.consultation_id
      and c.personal_id = hpe_consultation_photos.personal_id
      and c.personal_id = (select auth.uid())
  )
);

drop policy if exists "consultation chat member send" on public.hpe_consultation_messages;
create policy "consultation chat member send" on public.hpe_consultation_messages
for insert to authenticated with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.hpe_consultation_students c
    where c.id = hpe_consultation_messages.consultation_id
      and (c.personal_id = (select auth.uid()) or c.student_id = (select auth.uid()))
  )
  and (
    photo_id is null
    or exists (
      select 1 from public.hpe_consultation_photos p
      where p.id = hpe_consultation_messages.photo_id
        and p.consultation_id = hpe_consultation_messages.consultation_id
        and p.uploader_id = hpe_consultation_messages.author_id
    )
  )
);

drop policy if exists "consultation media member read" on storage.objects;
create policy "consultation media member read" on storage.objects
for select to authenticated using (
  bucket_id = 'hpe-consultation-media'
  and exists (
    select 1 from public.hpe_consultation_students c
    where c.personal_id::text = (storage.foldername(name))[1]
      and c.id::text = (storage.foldername(name))[2]
      and (c.personal_id = (select auth.uid()) or c.student_id = (select auth.uid()))
  )
);
drop policy if exists "consultation student media upload" on storage.objects;
create policy "consultation student media upload" on storage.objects
for insert to authenticated with check (
  bucket_id = 'hpe-consultation-media'
  and exists (
    select 1
    from public.hpe_consultation_students c
    join public.hpe_consultation_intakes i on i.consultation_id = c.id
    where c.personal_id::text = (storage.foldername(name))[1]
      and c.id::text = (storage.foldername(name))[2]
      and c.student_id = (select auth.uid())
      and i.student_id = c.student_id
      and i.photos_consent_at is not null
  )
);
drop policy if exists "consultation personal media remove" on storage.objects;
create policy "consultation personal media remove" on storage.objects
for delete to authenticated using (
  bucket_id = 'hpe-consultation-media'
  and exists (
    select 1 from public.hpe_consultation_students c
    where c.personal_id::text = (storage.foldername(name))[1]
      and c.id::text = (storage.foldername(name))[2]
      and c.personal_id = (select auth.uid())
  )
);

create index if not exists hpe_profiles_personal_id_idx on public.hpe_profiles(personal_id);
create index if not exists hpe_consultation_students_personal_id_idx on public.hpe_consultation_students(personal_id);
create index if not exists hpe_consultation_checkins_student_id_idx on public.hpe_consultation_checkins(student_id);
create index if not exists hpe_consultation_intakes_student_id_idx on public.hpe_consultation_intakes(student_id);
create index if not exists hpe_consultation_measurements_student_id_idx on public.hpe_consultation_measurements(student_id);
create index if not exists hpe_consultation_messages_author_id_idx on public.hpe_consultation_messages(author_id);
create index if not exists hpe_consultation_messages_consultation_created_idx on public.hpe_consultation_messages(consultation_id,created_at desc);
create index if not exists hpe_consultation_photos_personal_id_idx on public.hpe_consultation_photos(personal_id);
create index if not exists hpe_consultation_photos_uploader_id_idx on public.hpe_consultation_photos(uploader_id);
create index if not exists hpe_consultation_photos_consultation_created_idx on public.hpe_consultation_photos(consultation_id,created_at desc);
create index if not exists hpe_consultation_sessions_student_id_idx on public.hpe_consultation_sessions(student_id);
create index if not exists hpe_consultation_sessions_consultation_date_idx on public.hpe_consultation_sessions(consultation_id,session_date desc);
create index if not exists hpe_consultation_checkins_consultation_week_idx on public.hpe_consultation_checkins(consultation_id,week_start desc);
create index if not exists hpe_consultation_measurements_consultation_date_idx on public.hpe_consultation_measurements(consultation_id,measurement_date desc);
create index if not exists hpe_student_messages_author_id_idx on public.hpe_student_messages(author_id);
create index if not exists hpe_student_messages_student_id_idx on public.hpe_student_messages(student_id);

commit;
