-- ─────────────────────────────────────────────────────────────────────────────
-- CoachConnect Pro — RLS Policy Fix
-- Run this in Supabase SQL Editor
-- The original policies only had USING (works for SELECT/UPDATE/DELETE)
-- INSERT requires WITH CHECK — without it, inserts are silently blocked
-- ─────────────────────────────────────────────────────────────────────────────

-- PLAYERS
drop policy if exists "coaches can manage players" on players;
create policy "coaches can manage players"
  on players for all
  using (team_id = my_team_id() and my_role() = 'coach')
  with check (team_id = my_team_id() and my_role() = 'coach');

-- ASSIGNMENTS
drop policy if exists "coaches can manage assignments" on assignments;
create policy "coaches can manage assignments"
  on assignments for all
  using (team_id = my_team_id() and my_role() = 'coach')
  with check (team_id = my_team_id() and my_role() = 'coach');

-- EVENTS
drop policy if exists "coaches can manage events" on events;
create policy "coaches can manage events"
  on events for all
  using (team_id = my_team_id() and my_role() = 'coach')
  with check (team_id = my_team_id() and my_role() = 'coach');

-- SKILL SNAPSHOTS
drop policy if exists "coaches can manage snapshots" on skill_snapshots;
create policy "coaches can manage snapshots"
  on skill_snapshots for all
  using (team_id = my_team_id() and my_role() = 'coach')
  with check (team_id = my_team_id() and my_role() = 'coach');

-- LINEUPS
drop policy if exists "coaches can manage lineups" on lineups;
create policy "coaches can manage lineups"
  on lineups for all
  using (team_id = my_team_id() and my_role() = 'coach')
  with check (team_id = my_team_id() and my_role() = 'coach');

-- GAME PLANS
drop policy if exists "coaches can manage game plans" on game_plans;
create policy "coaches can manage game plans"
  on game_plans for all
  using (team_id = my_team_id() and my_role() = 'coach')
  with check (team_id = my_team_id() and my_role() = 'coach');

-- MESSAGES
drop policy if exists "team members can send messages" on messages;
create policy "team members can send messages"
  on messages for insert
  with check (team_id = my_team_id());

-- PARENT MARK ASSIGNMENTS COMPLETE
drop policy if exists "parents can mark assignments complete" on assignments;
create policy "parents can mark assignments complete"
  on assignments for update
  using (
    team_id = my_team_id() and
    player_id in (select player_id from parent_players where parent_id = auth.uid())
  )
  with check (
    team_id = my_team_id() and
    player_id in (select player_id from parent_players where parent_id = auth.uid())
  );
