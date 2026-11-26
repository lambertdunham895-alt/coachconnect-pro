// ============================================================================
// delete-coach-account
//
// Deletes the calling coach's account: their team, all team data, the files in
// storage, their Stripe subscription, and the sign-ins for the team's parents.
//
// Required by App Store Guideline 5.1.1(v) and Google Play's account deletion
// policy. A coach must be able to do this from inside the app, without emailing
// support.
//
// This is a NEW function. It does not touch the existing `delete-account`
// function that parents use — that one keeps working exactly as it does now.
//
// Order of operations matters and is deliberate:
//   1. Check who is calling, and that they are a coach.
//   2. Tear down the database in one transaction (the SQL function).
//   3. Only then cancel Stripe. If we cancelled first and the teardown failed,
//      the coach would lose their subscription but keep their account.
//   4. Clear storage.
//   5. Remove sign-ins — parents first, the coach last, so a failure part-way
//      still leaves the coach able to sign in and retry.
//
// Anything that fails after step 2 is written to deleted_accounts_audit, which
// survives the deletion. That table is the list of things to clean up by hand.
//
// Secrets come from the environment. Nothing is hardcoded.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_KEY   = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const BUCKETS = {
  chatAttachments:   "chat-attachments",
  playerPhotos:      "player-photos",
  playerVideos:      "player-videos",
  supportScreenshots: "support-screenshots",
};

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// ─── Storage helpers ────────────────────────────────────────────────────────

// Supabase's list() is one level deep and pages at 100. This walks the whole
// tree under a prefix and returns full paths to actual files (not folders).
async function listAll(admin: any, bucket: string, prefix: string): Promise<string[]> {
  const found: string[] = [];

  const walk = async (dir: string, depth: number) => {
    if (depth > 6) return; // guard against a pathological tree
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(dir, { limit: 100, offset });
      if (error || !data || data.length === 0) return;
      for (const entry of data) {
        const full = dir ? `${dir}/${entry.name}` : entry.name;
        // Folders come back with a null id.
        if (entry.id === null) await walk(full, depth + 1);
        else found.push(full);
      }
      if (data.length < 100) return;
      offset += 100;
    }
  };

  await walk(prefix, 0);
  return found;
}

async function removeAll(admin: any, bucket: string, paths: string[]): Promise<number> {
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await admin.storage.from(bucket).remove(batch);
    if (!error) removed += batch.length;
  }
  return removed;
}

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Not signed in." }, 401);
  }

  // Two clients, on purpose:
  //   asUser  — carries the caller's JWT, so auth.uid() works inside the SQL
  //             function. This is what makes it impossible to delete someone
  //             else's account: there is no id parameter to tamper with.
  //   admin   — service role, for storage and for removing sign-ins.
  const asUser = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ── 1. Who is calling? ───────────────────────────────────────────────────
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ error: "Your session has expired. Please sign in again." }, 401);
  }
  const callerId = userData.user.id;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, team_id")
    .eq("id", callerId)
    .maybeSingle();

  if (!profile) {
    return json({ error: "No profile found for this account. Contact support." }, 400);
  }
  if (profile.role !== "coach") {
    // Parents have their own function; don't silently do the wrong teardown.
    return json({ error: "This endpoint deletes coach accounts only." }, 403);
  }

  const teamId = profile.team_id as string | null;

  // ── 2. Database teardown, in one transaction ─────────────────────────────
  const { data: result, error: rpcErr } = await asUser.rpc("delete_coach_account");

  if (rpcErr || !result?.ok) {
    // Nothing was deleted — the transaction rolled back. Safe to tell the
    // coach to try again.
    console.error("delete_coach_account failed:", rpcErr?.message ?? result);
    return json({
      error: rpcErr?.message ?? "Could not delete the account. Nothing was changed. Please try again or contact support.",
    }, 500);
  }

  const auditId    = result.audit_id as string;
  const playerIds  = (result.player_ids ?? []) as string[];
  const parentIds  = (result.parent_ids ?? []) as string[];
  const stripeSub  = result.stripe_subscription_id as string | null;
  const notes: string[] = [];

  // From here on the account is gone. Everything else is best-effort cleanup,
  // and whatever fails gets recorded in the audit row.

  // ── 3. Cancel Stripe ─────────────────────────────────────────────────────
  let stripeCancelled = false;
  if (stripeSub) {
    if (!STRIPE_KEY) {
      notes.push("STRIPE_SECRET_KEY is not set on this project, so the subscription was not cancelled. Cancel it by hand in the Stripe dashboard.");
    } else {
      try {
        const res = await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSub)}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${STRIPE_KEY}` } },
        );
        if (res.ok) {
          stripeCancelled = true;
        } else {
          const body = await res.text().catch(() => "");
          // A subscription that is already cancelled or missing is fine.
          if (res.status === 404 || body.includes("No such subscription")) {
            stripeCancelled = true;
            notes.push("Stripe subscription was already gone.");
          } else {
            notes.push(`Stripe cancellation failed (HTTP ${res.status}). Cancel it by hand.`);
          }
        }
      } catch (e) {
        notes.push(`Stripe cancellation threw: ${String(e)}. Cancel it by hand.`);
      }
    }
  }

  // ── 4. Storage ───────────────────────────────────────────────────────────
  // Each bucket names its files differently, so each needs its own sweep.
  // Getting this wrong leaves children's photos and videos in the bucket after
  // the account is gone, which is the thing we most need to avoid.
  let filesRemoved = 0;
  try {
    // chat-attachments:  {teamId}/{timestamp}_{token}.{ext}
    if (teamId) {
      const paths = await listAll(admin, BUCKETS.chatAttachments, teamId);
      filesRemoved += await removeAll(admin, BUCKETS.chatAttachments, paths);
    }

    // player-videos:  {teamId}/{playerId}/{drillId}_{timestamp}.{ext}
    if (teamId) {
      const paths = await listAll(admin, BUCKETS.playerVideos, teamId);
      filesRemoved += await removeAll(admin, BUCKETS.playerVideos, paths);
    }

    // player-photos is the awkward one. Player photos sit at the bucket root
    // named {playerId}.{ext} — no team folder — and team logos sit under
    // team-logos/{teamId}_{timestamp}.{ext}. A team-prefix sweep would miss
    // every single player photo.
    if (playerIds.length > 0) {
      const rootFiles = await listAll(admin, BUCKETS.playerPhotos, "");
      const mine = rootFiles.filter((p) => {
        const base = p.split("/").pop() ?? p;
        const stem = base.replace(/\.[^.]+$/, "");
        return playerIds.includes(stem);
      });
      filesRemoved += await removeAll(admin, BUCKETS.playerPhotos, mine);
    }
    if (teamId) {
      const logos = await listAll(admin, BUCKETS.playerPhotos, "team-logos");
      const mine = logos.filter((p) => (p.split("/").pop() ?? "").startsWith(`${teamId}_`));
      filesRemoved += await removeAll(admin, BUCKETS.playerPhotos, mine);
    }

    // support-screenshots:  {userId}_{timestamp}_{id}.jpg
    const owners = [callerId, ...parentIds];
    const shots = await listAll(admin, BUCKETS.supportScreenshots, "");
    const mineShots = shots.filter((p) => {
      const base = p.split("/").pop() ?? p;
      return owners.some((u) => base.startsWith(`${u}_`));
    });
    filesRemoved += await removeAll(admin, BUCKETS.supportScreenshots, mineShots);
  } catch (e) {
    notes.push(`Storage cleanup incomplete: ${String(e)}`);
  }

  // ── 5. Sign-ins ──────────────────────────────────────────────────────────
  // Parents on this team have accounts that exist only to view this team.
  // Their profiles are already gone, so signing in would dead-end. Remove
  // them, and leave the coach for last so a failure here is recoverable.
  let authRemoved = 0;
  for (const pid of parentIds) {
    const { error } = await admin.auth.admin.deleteUser(pid);
    if (error) notes.push(`Could not remove parent sign-in ${pid}: ${error.message}`);
    else authRemoved++;
  }

  const { error: selfErr } = await admin.auth.admin.deleteUser(callerId);
  if (selfErr) {
    notes.push(`Could not remove the coach's own sign-in: ${selfErr.message}`);
  } else {
    authRemoved++;
  }

  // ── 6. Record what actually happened ─────────────────────────────────────
  await admin
    .from("deleted_accounts_audit")
    .update({
      stripe_cancelled:      stripeCancelled,
      storage_files_removed: filesRemoved,
      auth_users_removed:    authRemoved,
      notes:                 notes.length ? notes.join(" | ") : null,
    })
    .eq("id", auditId);

  // The account is gone either way. Don't report a failure to the coach over
  // a leftover file — that would push them to try again on an account that no
  // longer exists. The audit row carries anything left to tidy up.
  return json({
    ok: true,
    team_deleted:    !!teamId,
    players_deleted: result.players_deleted ?? 0,
    parents_deleted: result.parents_deleted ?? 0,
    files_removed:   filesRemoved,
    billing_cancelled: stripeCancelled,
  });
});
