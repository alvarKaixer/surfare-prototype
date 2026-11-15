-- Run in the Supabase SQL editor as the project administrator.
-- Raw uploads are never stored. Feedback is untrusted and requires human review.
create table if not exists public.surfare_feedback (
  id uuid primary key,
  deletion_hash text not null check (length(deletion_hash) = 64),
  payload jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  withdrawn boolean not null default false,
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'reviewed', 'excluded'))
);
create index if not exists surfare_feedback_created on public.surfare_feedback(created_at);
create index if not exists surfare_feedback_expiry on public.surfare_feedback(expires_at);
alter table public.surfare_feedback enable row level security;
revoke all on public.surfare_feedback from public, anon, authenticated;
grant select, insert, update, delete on public.surfare_feedback to service_role;

create or replace function public.submit_feedback(p_id uuid, p_hash text, p_payload jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare existing public.surfare_feedback;
begin
  -- Serialize writes for idempotency and a global abuse/storage ceiling without IP storage.
  perform pg_advisory_xact_lock(83921001);
  select * into existing from public.surfare_feedback where id = p_id;
  if found then return existing.deletion_hash = p_hash and not existing.withdrawn; end if;
  if (select count(*) from public.surfare_feedback where created_at > now() - interval '1 day') >= 2000 then
    raise exception 'Daily submission limit';
  end if;
  if p_payload->>'policy' <> 'feedback-v1' or length(p_payload::text) > 10000 then
    raise exception 'Invalid feedback';
  end if;
  insert into public.surfare_feedback(id, deletion_hash, payload) values(p_id, p_hash, p_payload);
  return true;
end $$;

create or replace function public.withdraw_feedback(p_id uuid, p_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare existing public.surfare_feedback;
begin
  perform pg_advisory_xact_lock(83921001);
  select * into existing from public.surfare_feedback where id = p_id;
  if found and existing.deletion_hash <> p_hash then return false; end if;
  -- Tombstones prevent an in-flight submit/retry from restoring withdrawn content.
  if not found then
    if (select count(*) from public.surfare_feedback where created_at > now() - interval '1 day') >= 2000 then
      raise exception 'Daily submission limit';
    end if;
    insert into public.surfare_feedback(id, deletion_hash, withdrawn, expires_at)
      values(p_id, p_hash, true, now() + interval '37 days');
  else
    update public.surfare_feedback set payload = null, withdrawn = true,
      review_status = 'excluded', expires_at = now() + interval '37 days' where id = p_id;
  end if;
  return true;
end $$;
revoke all on function public.submit_feedback(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.withdraw_feedback(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_feedback(uuid, text, jsonb) to service_role;
grant execute on function public.withdraw_feedback(uuid, text) to service_role;

-- Enable Cron and verify this job before setting FEEDBACK_ENABLED=true.
create extension if not exists pg_cron;
select cron.schedule('surfare-feedback-expiry', '17 * * * *',
  'delete from public.surfare_feedback where expires_at <= now()');
