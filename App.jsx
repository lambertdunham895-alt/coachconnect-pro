-- ─────────────────────────────────────────────────────────────────────────────
-- CoachConnect Pro — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "uuid-ossp";


-- ─── TEAMS ───────────────────────────────────────────────────────────────────
-- One team per coach subscription
create table teams (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  age_group   text,
  created_at  timestamptz default now()
);


-- ─── PROFILES ────────────────────────────────────────────────────────────────
-- One profile per authenticated user (coach or parent)
-- Links Supabase Auth user to a team and role
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  team_id     uuid references teams(id) on delete cascade,
  role        text not null check (role in ('coach', 'parent')),
  full_name   text,
  created_at  timestamptz default now()
);


-- ─── PLAYERS ─────────────────────────────────────────────────────────────────
create table players (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid references teams(id) on delete cascade not null,
  name        text not null,
  number      text,
  position    text,
  age         text,
  age_group   text,
  bats        text check (bats in ('R','L','S')),
  throws      text check (throws in ('R','L')),
  goals       text[] default '{}',
  created_at  timestamptz default now()
);


-- ─── PARENT → PLAYER LINKS ───────────────────────────────────────────────────
-- A parent profile can be linked to 1 or more players (e.g. two kids on same team)
-- A player can have up to 2 parents
create table parent_players (
  id          uuid primary key default uuid_generate_v4(),
  parent_id   uuid references profiles(id) on delete cascade not null,
  player_id   uuid references players(id) on delete cascade not null,
  label       text default 'Parent 1',  -- 'Parent 1' or 'Parent 2'
  phone       text,
  unique(parent_id, player_id)
);


-- ─── EVENTS ──────────────────────────────────────────────────────────────────
create table events (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid references teams(id) on delete cascade not null,
  type        text not null check (type in ('game','practice')),
  date        date not null,
  time        text,
  field_name  text,
  address     text,
  opponent    text,
  notes       text,
  created_at  timestamptz default now()
);


-- ─── LINEUPS ─────────────────────────────────────────────────────────────────
-- batting: ordered array of player_ids (nulls for empty slots)
-- positions: JSON object { "SS": "player_id", "CF": "player_id", ... }
create table lineups (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid references events(id) on delete cascade not null unique,
  team_id     uuid references teams(id) on delete cascade not null,
  batting     uuid[] default '{}',
  positions   jsonb default '{}',
  shared      boolean default true,
  updated_at  timestamptz default now()
);


-- ─── DRILL ASSIGNMENTS ───────────────────────────────────────────────────────
create table assignments (
  id            uuid primary key default uuid_generate_v4(),
  team_id       uuid references teams(id) on delete cascade not null,
  player_id     uuid references players(id) on delete cascade not null,
  drill_id      text not null,  -- references DRILL_LIBRARY constant in frontend
  assigned_date date default current_date,
  completed     boolean default false,
  notes         text default '',  -- coach feedback
  created_at    timestamptz default now()
);


-- ─── SKILL SNAPSHOTS ─────────────────────────────────────────────────────────
create table skill_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid references teams(id) on delete cascade not null,
  player_id   uuid references players(id) on delete cascade not null,
  date        date default current_date,
  hitting     int check (hitting between 1 and 10),
  fielding    int check (fielding between 1 and 10),
  throwing    int check (throwing between 1 and 10),
  pitching    int check (pitching between 1 and 10),
  speed       int check (speed between 1 and 10),
  notes       text,
  created_at  timestamptz default now()
);


-- ─── MESSAGES ────────────────────────────────────────────────────────────────
create table messages (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid references teams(id) on delete cascade not null,
  sender_id   uuid references profiles(id) on delete set null,
  sender_name text,
  channel     text not null,  -- 'team' | 'dm-{user_id}'
  text        text not null,
  created_at  timestamptz default now()
);


-- ─── FILE STORAGE REFERENCES ─────────────────────────────────────────────────
-- Actual files live in Supabase Storage buckets
-- These tables just store the metadata + storage path

create table player_photos (
  id          uuid primary key default uuid_generate_v4(),
  player_id   uuid references players(id) on delete cascade not null unique,
  storage_path text not null,  -- path in 'player-photos' bucket
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now()
);

create table drill_videos (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid references teams(id) on delete cascade not null,
  drill_id    text not null,   -- matches DRILL_LIBRARY id
  storage_path text,           -- null if it's a URL link
  url         text,            -- external URL (YouTube etc)
  unique(team_id, drill_id)
);

create table player_videos (
  id            uuid primary key default uuid_generate_v4(),
  team_id       uuid references teams(id) on delete cascade not null,
  player_id     uuid references players(id) on delete cascade not null,
  drill_id      text not null,
  storage_path  text not null,  -- path in 'player-videos' bucket
  note          text,
  uploaded_by   uuid references profiles(id),
  uploaded_at   timestamptz default now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- This is the critical security layer — users can ONLY see their own team's data
-- ─────────────────────────────────────────────────────────────────────────────

alter table teams            enable row level security;
alter table profiles         enable row level security;
alter table players          enable row level security;
alter table parent_players   enable row level security;
alter table events           enable row level security;
alter table lineups          enable row level security;
alter table assignments      enable row level security;
alter table skill_snapshots  enable row level security;
alter table messages         enable row level security;
alter table player_photos    enable row level security;
alter table drill_videos     enable row level security;
alter table player_videos    enable row level security;


-- ── Helper function: get the team_id for the current logged-in user ──────────
create or replace function my_team_id()
returns uuid language sql stable
as $$
  select team_id from profiles where id = auth.uid()
$$;

-- ── Helper function: get the role for the current logged-in user ─────────────
create or replace function my_role()
returns text language sql stable
as $$
  select role from profiles where id = auth.uid()
$$;


-- ── TEAMS: users can only see their own team ─────────────────────────────────
create policy "team members can read their team"
  on teams for select using (id = my_team_id());

create policy "coaches can update their team"
  on teams for update using (id = my_team_id() and my_role() = 'coach');


-- ── PROFILES: users can read profiles on their team ──────────────────────────
create policy "team members can read profiles"
  on profiles for select using (team_id = my_team_id());

create policy "users can update their own profile"
  on profiles for update using (id = auth.uid());


-- ── PLAYERS: coaches can do everything, parents can only read their child ─────
create policy "coaches can manage players"
  on players for all
  using (team_id = my_team_id() and my_role() = 'coach');

create policy "parents can read their linked players"
  on players for select
  using (
    team_id = my_team_id() and
    id in (
      select player_id from parent_players where parent_id = auth.uid()
    )
  );


-- ── EVENTS: all team members can read, only coaches can write ─────────────────
create policy "team members can read events"
  on events for select using (team_id = my_team_id());

create policy "coaches can manage events"
  on events for all
  using (team_id = my_team_id() and my_role() = 'coach');


-- ── LINEUPS: all can read if shared=true, only coaches can write ──────────────
create policy "team members can read shared lineups"
  on lineups for select
  using (team_id = my_team_id() and (shared = true or my_role() = 'coach'));

create policy "coaches can manage lineups"
  on lineups for all
  using (team_id = my_team_id() and my_role() = 'coach');


-- ── ASSIGNMENTS: coaches full access, parents read their child's only ─────────
create policy "coaches can manage assignments"
  on assignments for all
  using (team_id = my_team_id() and my_role() = 'coach');

create policy "parents can read and complete their child assignments"
  on assignments for select
  using (
    team_id = my_team_id() and
    player_id in (
      select player_id from parent_players where parent_id = auth.uid()
    )
  );

create policy "parents can mark assignments complete"
  on assignments for update
  using (
    team_id = my_team_id() and
    player_id in (
      select player_id from parent_players where parent_id = auth.uid()
    )
  );


-- ── SKILL SNAPSHOTS: coaches write, parents read their child's ────────────────
create policy "coaches can manage snapshots"
  on skill_snapshots for all
  using (team_id = my_team_id() and my_role() = 'coach');

create policy "parents can read their child snapshots"
  on skill_snapshots for select
  using (
    team_id = my_team_id() and
    player_id in (
      select player_id from parent_players where parent_id = auth.uid()
    )
  );


-- ── MESSAGES: all team members can read and send ─────────────────────────────
create policy "team members can read messages"
  on messages for select using (team_id = my_team_id());

create policy "team members can send messages"
  on messages for insert with check (team_id = my_team_id());


-- ── PLAYER PHOTOS: coaches full, parents can upload for their child ───────────
create policy "coaches can manage player photos"
  on player_photos for all
  using (
    player_id in (select id from players where team_id = my_team_id())
    and my_role() = 'coach'
  );

create policy "parents can manage their child photo"
  on player_photos for all
  using (
    player_id in (
      select player_id from parent_players where parent_id = auth.uid()
    )
  );


-- ── DRILL VIDEOS: coaches manage, all team members can read ──────────────────
create policy "team members can read drill videos"
  on drill_videos for select using (team_id = my_team_id());

create policy "coaches can manage drill videos"
  on drill_videos for all
  using (team_id = my_team_id() and my_role() = 'coach');


-- ── PLAYER VIDEOS: coaches read all, parents manage their child's ─────────────
create policy "coaches can read all player videos"
  on player_videos for select
  using (team_id = my_team_id() and my_role() = 'coach');

create policy "parents can manage their child videos"
  on player_videos for all
  using (
    team_id = my_team_id() and
    player_id in (
      select player_id from parent_players where parent_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKETS
-- Create these manually in Supabase Dashboard → Storage
-- ─────────────────────────────────────────────────────────────────────────────
-- Bucket: 'player-photos'   → private, max 5MB,  allowed: image/*
-- Bucket: 'player-videos'   → private, max 100MB, allowed: video/*
-- Bucket: 'drill-videos'    → private, max 100MB, allowed: video/*
