// ─── OFFLINE CACHE ───────────────────────────────────────────────────────────
// Ball fields have no signal. This keeps the dugout screens — roster, schedule,
// lineups, game plans, practice plans — readable with the phone in airplane
// mode, and makes the app open instantly when it IS online by rendering from
// cache before the first query returns.
//
// IndexedDB, not localStorage: localStorage caps out near 5MB and stores only
// strings, and we need image bytes. Storage buckets are private, so player
// photos are one-hour signed URLs — caching a URL is useless an hour later.
// The bytes themselves are cached instead.
//
// Everything here is best-effort. Private browsing, a full disk, or a browser
// that blocks storage all make these calls fail; every one of them resolves to
// null or false rather than throwing, and the app runs exactly as it does today
// when they do.

const DB_NAME  = 'ccp-offline';
const DB_VER   = 1;
const TEAM     = 'teamData';   // one record per team: the raw rows + a timestamp
const MEDIA    = 'media';      // one record per storage path: the image bytes
const OUTBOX   = 'outbox';     // reserved for Phase 2 (queued writes)

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TEAM))   db.createObjectStore(TEAM,   { keyPath: 'teamId' });
        if (!db.objectStoreNames.contains(MEDIA))  db.createObjectStore(MEDIA,  { keyPath: 'path' });
        if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => { console.warn('offline: IndexedDB unavailable'); resolve(null); };
      req.onblocked = () => resolve(null);
    } catch (_) { resolve(null); }
  });
  return dbPromise;
}

function tx(store, mode, run) {
  return openDb().then(db => {
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let out = null;
        const r = run(s);
        if (r) r.onsuccess = () => { out = r.result; };
        t.oncomplete = () => resolve(out);
        t.onerror    = () => resolve(null);
        t.onabort    = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }).catch(() => null);
}

// ─── Team data ───────────────────────────────────────────────────────────────
// We store the RAW Supabase rows rather than the mapped React state, so the
// same mapping code runs on both the live and the cached path. One source of
// truth: a change to how a player is shaped applies to cached data for free.

export async function saveTeamData(teamId, raw) {
  if (!teamId || !raw) return false;
  const ok = await tx(TEAM, 'readwrite', s => s.put({ teamId, raw, cachedAt: Date.now() }));
  return ok !== null;
}

export async function loadCachedTeamData(teamId) {
  if (!teamId) return null;
  const rec = await tx(TEAM, 'readonly', s => s.get(teamId));
  return rec && rec.raw ? rec : null;   // { teamId, raw, cachedAt }
}

export async function clearTeamCache(teamId) {
  if (teamId) return (await tx(TEAM, 'readwrite', s => s.delete(teamId))) !== null;
  const a = await tx(TEAM,  'readwrite', s => s.clear());
  const b = await tx(MEDIA, 'readwrite', s => s.clear());
  return a !== null && b !== null;
}

// ─── Media bytes ─────────────────────────────────────────────────────────────

export async function cacheMedia(path, blob) {
  if (!path || !blob) return false;
  // Guard against a huge file filling the phone. Photos are a few hundred KB;
  // anything past 8MB is not a roster photo and does not belong in the cache.
  if (blob.size > 8 * 1024 * 1024) return false;
  const ok = await tx(MEDIA, 'readwrite', s => s.put({ path, blob, cachedAt: Date.now() }));
  return ok !== null;
}

export async function getCachedMedia(path) {
  if (!path) return null;
  const rec = await tx(MEDIA, 'readonly', s => s.get(path));
  if (!rec || !rec.blob) return null;
  try { return URL.createObjectURL(rec.blob); } catch (_) { return null; }
}

export async function hasCachedMedia(path) {
  if (!path) return false;
  const rec = await tx(MEDIA, 'readonly', s => s.get(path));
  return !!(rec && rec.blob);
}

// Download the bytes behind a set of signed URLs and keep them. Runs in the
// background after first paint — it must never delay the UI. Skips anything
// already cached so a reopen costs nothing.
export async function cacheMediaFromUrls(pairs) {
  if (!Array.isArray(pairs) || !pairs.length) return 0;
  let saved = 0;
  for (const { path, url } of pairs) {
    if (!path || !url) continue;
    try {
      if (await hasCachedMedia(path)) continue;
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (await cacheMedia(path, blob)) saved++;
    } catch (_) { /* one photo failing is not worth surfacing */ }
  }
  return saved;
}

// ─── Connection state ────────────────────────────────────────────────────────
// navigator.onLine only knows whether the device has a network interface, not
// whether anything is reachable — but combined with failed queries it is a
// good enough signal, and it is what the browser gives us.

export function isOnline() {
  try { return typeof navigator === 'undefined' ? true : navigator.onLine !== false; }
  catch (_) { return true; }
}

export function watchConnection(onChange) {
  if (typeof window === 'undefined') return () => {};
  const up   = () => onChange(true);
  const down = () => onChange(false);
  window.addEventListener('online',  up);
  window.addEventListener('offline', down);
  return () => {
    window.removeEventListener('online',  up);
    window.removeEventListener('offline', down);
  };
}

// "Last updated Tue 6:14pm" — enough for a coach to judge whether to trust it.
export function describeAge(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `today ${time}`;
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `yesterday ${time}`;
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day}, ${time}`.replace(/,\s*,/, ',');   // "Fri, Nov 20, 6:14 AM"

}

// ─── Session ─────────────────────────────────────────────────────────────────
// The team's data is keyed by team_id, which normally comes from the profile
// query — so with no signal there is nothing to look up. This keeps the last
// profile and team row, small enough for localStorage and synchronous, which
// means no await before the first render.

const SESSION_KEY = 'ccp-session';

export function saveSession(profile, team) {
  try {
    if (!profile) return false;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ profile, team: team || null, at: Date.now() }));
    return true;
  } catch (_) { return false; }
}

export function loadSession(userId) {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    // Only usable for the account that saved it — never show one user another's
    // roster because the phone was handed over or an account was switched.
    if (!rec?.profile?.id || (userId && rec.profile.id !== userId)) return null;
    return rec;
  } catch (_) { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); return true; } catch (_) { return false; }
}
