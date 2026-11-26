-- ============================================================================
-- CoachConnect Pro — Coach account deletion
-- Required for App Store Guideline 5.1.1(v) and Google Play's account deletion
-- policy: a user must be able to delete their own account from inside the app.
--
-- Run this whole file once in the Supabase SQL editor.
-- It is safe to re-run (everything is CREATE OR REPLACE / IF NOT EXISTS).
--
-- What deleting a coach does:
--   A coach owns exactly one team. Removing the coach removes the team and
--   everything in it: roster, schedule, chat, plans, videos, stats. The parent
--   accounts on that team exist only to view that team, so their profiles go
--   too, and the edge function removes their sign-ins afterwards.
--
-- The teardown runs in ONE transaction. It either all happens or none of it
-- does. There is no half-deleted state.
-- ============================================================================


-- ─── 1. Audit trail ─────────────────────────────────────────────────────────
-- This table deliberately SURVIVES the deletion. Two reasons:
--   1. Billing. If a Stripe cancellation fails, this is the only record left
--      that says someone's card may still be getting charged.
--   2. Compliance. Proof of when a deletion request was honoured.
-- It holds no child data — only the coach's own contact details and counts.

create table if not exists public.deleted_accounts_audit (
  id                     uuid primary key default gen_random_uuid(),
  deleted_at             timestamptz not null default now(),
  user_id                uuid not null,
  user_email             text,
  user_role              text,
  team_id                uuid,
  team_name              text,
  players_deleted        int  default 0,
  parents_deleted        int  default 0,
  stripe_subscription_id text,
  stripe_cancelled       boolean default false,
  storage_files_removed  int  default 0,
  auth_users_removed     int  default 0,
  notes                  text
);

comment on table public.deleted_accounts_audit is
  'Survives account deletion. Used to reconcile billing and prove deletion requests were honoured. Contains no child data.';

alter table public.deleted_accounts_audit enable row level security;

-- No policies on purpose. With RLS on and zero policies, normal signed-in
-- users cannot read or write this table at all. Only the service-role key
-- (edge functions) and SECURITY DEFINER functions can touch it.

create index if not exists deleted_accounts_audit_user_idx
  on public.deleted_accounts_audit (user_id);
create index if not exists deleted_accounts_audit_unreconciled_idx
  on public.deleted_accounts_audit (deleted_at)
  where stripe_subscription_id is not null and stripe_cancelled = false;


-- ─── 2. The teardown function ───────────────────────────────────────────────

create or replace function public.delete_coach_account()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_team      uuid;
  v_email     text;
  v_teamname  text;
  v_stripe    text;
  v_players   uuid[] := '{}';
  v_events    uuid[] := '{}';
  v_parents   uuid[] := '{}';
  v_users     uuid[] := '{}';
  v_audit     uuid;
  r           record;
begin
  -- ── Authorisation ────────────────────────────────────────────────────────
  -- auth.uid() is the caller's own id, taken from their JWT. A coach can only
  -- ever delete themselves: there is no parameter to point this at anyone else.
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  select p.role, p.team_id into v_role, v_team
  from public.profiles p
  where p.id = v_uid;

  if v_role is null then
    raise exception 'No profile found for this account.';
  end if;

  if v_role <> 'coach' then
    raise exception 'This function deletes coach accounts only (role is %).', v_role;
  end if;

  -- A null team_id means a signup that broke part-way through. That coach must
  -- still be able to delete themselves — App Store rules give no exemption for
  -- our own bad data — so we carry on and clear just their own rows.

  -- ── Collect what we are about to destroy, before we destroy it ───────────
  select au.email into v_email from auth.users au where au.id = v_uid;
  select t.name  into v_teamname from public.teams t where t.id = v_team;

  select array_agg(p.id) into v_players
  from public.players p where p.team_id = v_team;
  v_players := coalesce(v_players, '{}');

  select array_agg(e.id) into v_events
  from public.events e where e.team_id = v_team;
  v_events := coalesce(v_events, '{}');

  -- Every parent profile on this team. The coach is excluded here and added
  -- to v_users separately, so the coach is always last to go.
  select array_agg(p.id) into v_parents
  from public.profiles p
  where p.team_id = v_team and p.id <> v_uid;
  v_parents := coalesce(v_parents, '{}');

  v_users := v_parents || v_uid;

  select s.stripe_subscription_id into v_stripe
  from public.subscriptions s
  where s.user_id = v_uid
  limit 1;

  -- ── Write the audit row first ───────────────────────────────────────────
  -- Inside the same transaction, so it is only kept if the teardown commits.
  insert into public.deleted_accounts_audit
    (user_id, user_email, user_role, team_id, team_name,
     players_deleted, parents_deleted, stripe_subscription_id)
  values
    (v_uid, v_email, v_role, v_team, v_teamname,
     coalesce(array_length(v_players,1),0),
     coalesce(array_length(v_parents,1),0),
     v_stripe)
  returning id into v_audit;

  -- ── The teardown ────────────────────────────────────────────────────────
  -- Each row below is (table, column, which id set). Every delete is guarded
  -- by a check that the table and column actually exist, so a table that was
  -- renamed or never created is skipped instead of aborting the whole run.
  --
  -- Order is children first, then parents, then the team itself.

  for r in
    select * from (values
      -- by event id (must run before events are deleted)
      ('game_scores',        'event_id',        'events'),
      ('event_rsvps',        'event_id',        'events'),

      -- by player id
      ('player_game_stats',  'player_id',       'players'),
      ('parent_players',     'player_id',       'players'),
      ('parent_invites',     'player_id',       'players'),
      ('skill_snapshots',    'player_id',       'players'),
      ('player_photos',      'player_id',       'players'),
      ('player_videos',      'player_id',       'players'),
      ('event_rsvps',        'player_id',       'players'),

      -- by user id (all parents on the team, plus the coach)
      ('parent_players',     'parent_id',       'users'),
      ('parental_consents',  'parent_id',       'users'),
      ('blocked_users',      'blocked_user_id', 'users'),
      ('blocked_users',      'user_id',         'users'),
      ('chat_read_status',   'user_id',         'users'),
      ('message_reactions',  'user_id',         'users'),
      ('push_subscriptions', 'user_id',         'users'),
      ('subscriptions',      'user_id',         'users'),
      ('referrals',          'user_id',         'users'),
      ('usage_events',       'user_id',         'users'),
      ('support_tickets',    'user_id',         'users'),
      ('error_logs',         'user_id',         'users'),
      ('coach_invites',      'invited_by_parent_id', 'users'),

      -- by team id
      ('assignments',        'team_id',         'team'),
      ('blocked_users',      'team_id',         'team'),
      ('chat_read_status',   'team_id',         'team'),
      ('chat_reports',       'team_id',         'team'),
      ('custom_drills',      'team_id',         'team'),
      ('custom_plans',       'team_id',         'team'),
      ('drill_videos',       'team_id',         'team'),
      ('event_rsvps',        'team_id',         'team'),
      ('game_plans',         'team_id',         'team'),
      ('lineups',            'team_id',         'team'),
      ('message_reactions',  'team_id',         'team'),
      ('messages',           'team_id',         'team'),
      ('parent_invites',     'team_id',         'team'),
      ('player_photos',      'team_id',         'team'),
      ('player_videos',      'team_id',         'team'),
      ('push_subscriptions', 'team_id',         'team'),
      ('skill_snapshots',    'team_id',         'team'),
      ('support_tickets',    'team_id',         'team'),
      ('usage_events',       'team_id',         'team'),
      ('error_logs',         'team_id',         'team'),
      ('events',             'team_id',         'team'),
      ('players',            'team_id',         'team'),

      -- profiles last: the coach's own row and every parent on the team
      ('profiles',           'id',              'users')
    ) as t(tbl, col, idset)
  loop
    -- Skip anything that does not exist in this database.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = r.tbl
        and column_name  = r.col
    ) then
      continue;
    end if;

    if r.idset = 'team' then
      if v_team is not null then
        execute format('delete from public.%I where %I = $1', r.tbl, r.col)
          using v_team;
      end if;
    elsif r.idset = 'players' then
      if array_length(v_players,1) > 0 then
        execute format('delete from public.%I where %I = any($1)', r.tbl, r.col)
          using v_players;
      end if;
    elsif r.idset = 'events' then
      if array_length(v_events,1) > 0 then
        execute format('delete from public.%I where %I = any($1)', r.tbl, r.col)
          using v_events;
      end if;
    elsif r.idset = 'users' then
      execute format('delete from public.%I where %I = any($1)', r.tbl, r.col)
        using v_users;
    end if;
  end loop;

  -- coach_invites addressed to this coach by email, if that column exists
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='coach_invites' and column_name='coach_email'
  ) and v_email is not null then
    execute 'delete from public.coach_invites where lower(coach_email) = lower($1)'
      using v_email;
  end if;

  -- Finally the team itself, if there was one.
  if v_team is not null then
    delete from public.teams where id = v_team;
  end if;

  -- ── Hand the edge function what it needs to finish up ───────────────────
  -- Storage files and auth sign-ins live outside Postgres, so the edge
  -- function clears those. It needs these ids to do it.
  return jsonb_build_object(
    'ok',          true,
    'audit_id',    v_audit,
    'user_id',     v_uid,
    'user_email',  v_email,
    'team_id',     v_team,
    'team_name',   v_teamname,
    'player_ids',  to_jsonb(v_players),
    'parent_ids',  to_jsonb(v_parents),
    'players_deleted', coalesce(array_length(v_players,1),0),
    'parents_deleted', coalesce(array_length(v_parents,1),0),
    'stripe_subscription_id', v_stripe
  );
end;
$$;

comment on function public.delete_coach_account() is
  'Deletes the calling coach, their team, and all team data in one transaction. Authorised by auth.uid() only — cannot be pointed at another account. Returns ids the edge function needs to clear storage and sign-ins.';

-- Signed-in users may call it. It can only ever delete the caller.
revoke all on function public.delete_coach_account() from public, anon;
grant execute on function public.delete_coach_account() to authenticated;


-- ─── 3. Check what is left to reconcile ─────────────────────────────────────
-- Run this any time to see deletions where the Stripe cancellation did not
-- confirm. Anyone in this list may still be getting charged.
--
--   select deleted_at, user_email, stripe_subscription_id, notes
--   from public.deleted_accounts_audit
--   where stripe_subscription_id is not null and stripe_cancelled = false
--   order by deleted_at desc;
