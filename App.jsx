import React, { useState, useEffect, useRef } from "react";
import PracticePlans from "./components/PracticePlans";
import LandingPage from "./components/LandingPage";
import ChatView from "./components/ChatView";
import RosterScanner from "./components/RosterScanner";
import { C, FONTS } from "./theme";
import {
  saveTeamData, loadCachedTeamData, cacheMediaFromUrls,
  getCachedMedia, cacheMedia, isOnline, watchConnection, describeAge,
  saveSession, loadSession, clearSession,
} from "./lib/offline";
import { DRILL_LIBRARY, catMeta, CATEGORIES } from "./data/drills";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const supabase = createClient(
  "https://hcadlkmejdekhbgfvyaq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYWRsa21lamRla2hiZ2Z2eWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTg1MjIsImV4cCI6MjA4ODQ3NDUyMn0.PlHlQX5b5ts7SnXd7hWfuWi01Y_aK6QnWvzZPVb54Ko"
);

// AI scan endpoints require a logged-in coach (they spend real AI credits, so
// they are no longer callable anonymously). This attaches the coach token.
const scanAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) };
};

// ─── FOUNDER ADMIN + USAGE TRACKING ──────────────────────────────────────────
const FOUNDER_ID = "75c3ef3c-789e-422f-a9b7-e3a0a82a6e3c";
const _trackedRecently = {};
async function trackUsage(userId, teamId, feature) {
  try {
    if (!userId || !feature) return;
    if (userId === FOUNDER_ID) return; // don't track the founder — keeps analytics honest
    const now = Date.now();
    if (_trackedRecently[feature] && now - _trackedRecently[feature] < 60000) return;
    _trackedRecently[feature] = now;
    await supabase.from("usage_events").insert({ user_id: userId, team_id: teamId || null, feature });
  } catch (_) { /* analytics must never break the app */ }
}

// ─── PRIVATE-STORAGE MEDIA HELPERS ───────────────────────────────────────────
// All media buckets are PRIVATE (2026-08-15 security fix). Files are served via
// short-lived signed URLs instead of public URLs. These helpers turn a storage
// path — or a legacy public URL stored in older DB rows — into a fresh signed
// URL. Signed URLs expire, so resolve at load/render time and store PATHS in
// the database, never URLs.
const SIGNED_URL_TTL = 60 * 60; // seconds — 1 hour

function parseStorageUrl(url){
  const m = String(url||"").match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}
async function signedUrl(bucket, path, ttl = SIGNED_URL_TTL){
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
    if (error) { console.error("signedUrl:", bucket, path, error.message); return null; }
    return data?.signedUrl || null;
  } catch { return null; }
}
async function resolveMediaUrl(defaultBucket, pathOrUrl){
  if (!pathOrUrl) return null;
  const v = String(pathOrUrl);
  if (/^(data:|blob:)/.test(v)) return v;
  if (/^https?:/.test(v)) {
    const p = parseStorageUrl(v);
    if (!p) return v;                       // external URL (e.g. YouTube) — untouched
    return await signedUrl(p.bucket, p.path);
  }
  return await signedUrl(defaultBucket, v);
}

const LOGO = "/logo.png";

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = 'BDCH5WAXHX6Bh2_39gOms5DByeW5C_4FQwlqcNdfgtrmF29YuVbrc2_WMLJr43iOZUJrzvEiUx-XqIHGDOfRo5E';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function registerPushSubscription(userId, teamId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const subJson = subscription.toJSON();
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      team_id: teamId,
      endpoint: subJson.endpoint,
      keys_p256dh: subJson.keys.p256dh,
      keys_auth: subJson.keys.auth,
    }, { onConflict: 'user_id,endpoint' });
    console.log('Push subscription saved');
    return subscription;
  } catch(err) { console.error('Push registration failed:', err); return null; }
}

async function sendPushNotification(teamId, title, body, excludeUserId=null) {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: { team_id: teamId, title, body, exclude_user_id: excludeUserId },
    });
    if(error) console.error('Push notification error:', error);
    else console.log('Push sent:', data);
  } catch(err) { console.error('Push send error:', err); }
}

// FONTS moved to theme.js


// ─── TOKENS ──────────────────────────────────────────────────────────────────
// Design tokens (C) moved to theme.js


const catColor = c => catMeta[c]?.color||"#888";
const catIcon  = c => catMeta[c]?.icon ||"▸";

// ─── DATA ────────────────────────────────────────────────────────────────────
const POSITIONS  = ["Pitcher","Catcher","1B","2B","3B","SS","LF","CF","RF","Utility"];
const AGE_GROUPS = ["6–8 (T-ball)","9–12 (Little League)","13–15 (Junior)","16–18 (Senior)"];

// DRILL_LIBRARY moved to data/drills.js


// ─── SKILL TRACKING ──────────────────────────────────────────────────────────
// ─── RUBRIC SYSTEM ───────────────────────────────────────────────────────────
const RUBRIC_LABELS = {1:"Needs Work",2:"Developing",3:"Proficient",4:"Excellent"};
const RUBRIC_VAL_COLORS = {1:"#e8192c",2:"#f97316",3:"#f5c518",4:"#00d4aa"};

const RUBRIC = [
  {
    id:"fd", label:"Fielding", color:"#1e7bd4",
    groups:[
      {id:"fd_in",  label:"Infield",  criteria:["Mechanics","Range","Overall"],
       positions:["1B","2B","3B","SS","Catcher","Utility"]},
      {id:"fd_out", label:"Outfield", criteria:["Range","Overall"],
       positions:["LF","CF","RF","Pitcher","Utility"]},
    ]
  },
  {
    id:"tc", label:"Throw & Catch", color:"#00d4aa",
    groups:[
      {id:"tc_th", label:"Throwing", criteria:["Mechanics","Strength","Accuracy","Overall"], positions:null},
      {id:"tc_ca", label:"Catching", criteria:["Overall"], positions:null},
    ]
  },
  {
    id:"hi", label:"Hitting", color:"#e8192c",
    groups:[
      {id:"hi_hi", label:"Hitting", criteria:["Mechanics","Power","Contact","Overall"], positions:null},
    ]
  },
  {
    id:"pc", label:"Pitch & Catcher", color:"#f97316",
    groups:[
      {id:"pc_pi", label:"Pitcher", criteria:["Mechanics","Speed","Accuracy"],
       positions:["Pitcher","Utility"]},
      {id:"pc_ca", label:"Catcher", criteria:["Mechanics","Arm"],
       positions:["Catcher","Utility"]},
    ]
  },
];

const rubricForPosition = (position) =>
  RUBRIC.map(s=>({...s, groups:s.groups.filter(g=>!g.positions||g.positions.includes(position))}))
        .filter(s=>s.groups.length>0);

// Chart categories derived from rubric averages (1–4 scale)
const CHART_SKILLS = ["Hitting","Fielding","Throwing","Pitching","Catching"];
const CHART_COLORS = {Hitting:"#e8192c",Fielding:"#1e7bd4",Throwing:"#00d4aa",Pitching:"#f97316",Catching:"#8b5cf6"};

const computeChartRatings = (rubric={}) => {
  const avg = keys => {
    const vals = keys.map(k=>rubric[k]).filter(v=>v!=null&&v>0);
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10 : null;
  };
  const allKeys = Object.keys(rubric);
  const r={};
  const h=avg(allKeys.filter(k=>k.startsWith("hi_"))); if(h) r.Hitting=h;
  const f=avg(allKeys.filter(k=>k.startsWith("fd_"))); if(f) r.Fielding=f;
  const t=avg(allKeys.filter(k=>k.startsWith("tc_th"))); if(t) r.Throwing=t;
  const caKeys=[...allKeys.filter(k=>k.startsWith("tc_ca")||k.startsWith("pc_ca"))];
  const ca=avg(caKeys); if(ca) r.Catching=ca;
  const p=avg(allKeys.filter(k=>k.startsWith("pc_pi"))); if(p) r.Pitching=p;
  return r;
};

// Maps each chart skill to the rubric group prefixes that feed it
const SKILL_PREFIXES = {
  Hitting:  ["hi_hi"],
  Fielding: ["fd_in","fd_out"],
  Throwing: ["tc_th"],
  Pitching: ["pc_pi"],
  Catching: ["tc_ca","pc_ca"],
};

// Distinct colors for subcriteria lines
const SUBCRITERION_COLORS = [
  "#00d4aa","#f5c518","#e8192c","#1e7bd4","#f97316","#8b5cf6","#ec4899","#06b6d4"
];

// Get all criteria keys for a given chart skill that exist in a rubric
const getCriteriaKeys = (skill, rubric={}) => {
  const prefixes = SKILL_PREFIXES[skill] || [];
  return Object.keys(rubric).filter(k => prefixes.some(p => k.startsWith(p+"_")));
};





// ─── HELPERS ─────────────────────────────────────────────────────────────────
// IDs are database primary keys, so they come from the crypto RNG rather than
// Math.random() (which is not cryptographically secure and can be predictable).
// crypto.randomUUID needs a secure context; the fallback still uses real
// entropy via getRandomValues, and only the last resort touches Math.random.
const uid = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;               // version 4
      b[8] = (b[8] & 0x3f) | 0x80;               // RFC 4122 variant
      const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    }
  } catch (_) { /* fall through */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

// Short opaque token for filenames and local React keys — not a database key.
const randomToken = (len = 10) => {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const b = crypto.getRandomValues(new Uint8Array(len));
      return [...b].map(x => (x % 36).toString(36)).join('');
    }
  } catch (_) { /* fall through */ }
  return Math.random().toString(36).slice(2, 2 + len);
};

// Global mutable ref for custom drills — updated by App when loaded from Supabase
let _customDrillsRef = [];
function getAllDrills() { return [...DRILL_LIBRARY, ..._customDrillsRef]; }
function findDrill(id) { return getAllDrills().find(d => d.id === id); }

const fmtTime = ts => {
  const d = new Date(ts);
  const now2 = new Date();
  const diffDays = Math.floor((now2 - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return d.toLocaleDateString("en-US",{weekday:"short"});
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
};

const initials = name => name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

const avatarColors = ["#e8192c","#1e7bd4","#00d4aa","#f97316","#8b5cf6","#f5c518"];
const avatarColor  = name => avatarColors[name.charCodeAt(0) % avatarColors.length];

// ─── SHARED UI ───────────────────────────────────────────────────────────────

// ── Toast System ──────────────────────────────────────────────────────────────
// Module-level emitter so ANY function (helpers, async Supabase calls, deep
// components) can fire a toast without prop-drilling. Mount <ToastHost/> once.
const _toastListeners = new Set();
let _toastId = 0;
const toast = {
  show(message, type="info", duration=4000) {
    if(!message) return;
    const id = ++_toastId;
    _toastListeners.forEach(fn => fn({id, message, type, duration}));
    return id;
  },
  success(message, duration=4000){ return toast.show(message, "success", duration); },
  error(message, duration=6000){ return toast.show(message, "error", duration); },   // errors linger longer
  info(message, duration=4000){ return toast.show(message, "info", duration); },
};

// ── Error logging → error_logs table ─────────────────────────────────────────
// Fire-and-forget: failures in the app land somewhere the founder can see them
// instead of dying in the user's browser console. Guard rails: max 10 per
// session, no duplicate messages, and the logger itself can never throw.
const _errSeen = new Set();
let _errCount = 0;
let _errCtx = { user_id: null, team_id: null };
function setErrorContext(ctx){ _errCtx = { ..._errCtx, ...ctx }; }
function logError(source, message, stack){
  try {
    if(!message) return;
    const key = String(message).slice(0, 200);
    if(_errSeen.has(key) || _errCount >= 10) return;
    _errSeen.add(key); _errCount++;
    supabase.from('error_logs').insert({
      user_id: _errCtx.user_id,
      team_id: _errCtx.team_id,
      source: source || 'manual',
      message: String(message).slice(0, 1000),
      stack: stack ? String(stack).slice(0, 4000) : null,
      url: (typeof window !== 'undefined' ? window.location.href.split('#')[0] : '').slice(0, 300),
      user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 300),
    }).then(()=>{}, ()=>{});
  } catch(e){}
}

// Throttled save-failure notice. A burst of failed background writes (e.g. lost
// connection mid-session) collapses into ONE message instead of spamming the user.
let _lastSaveErrAt = 0;
function notifySaveError() {
  const now = Date.now();
  if(now - _lastSaveErrAt < 5000) return;  // at most one every 5s
  _lastSaveErrAt = now;
  toast.error("Some changes didn't save — check your connection.");
}

function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(()=>{
    const onToast = (t) => {
      setToasts(prev => [...prev, t]);
      if(t.duration > 0){
        setTimeout(()=> setToasts(prev => prev.filter(x => x.id !== t.id)), t.duration);
      }
    };
    _toastListeners.add(onToast);
    return ()=> _toastListeners.delete(onToast);
  },[]);

  const dismiss = (id) => setToasts(prev => prev.filter(x => x.id !== id));

  const styles = {
    success:{ bg:"#0c2a1f", border:"#10b981", icon:"✓", iconColor:"#10b981" },
    error:  { bg:"#2a0f12", border:C.red||"#e8192c", icon:"✕", iconColor:C.red||"#e8192c" },
    info:   { bg:"#0f1e38", border:C.blue||"#1e7bd4", icon:"ℹ", iconColor:C.blue||"#1e7bd4" },
  };

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:99999,display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"12px 12px 0",pointerEvents:"none"}}>
      {toasts.map(t=>{
        const s = styles[t.type]||styles.info;
        return (
          <div key={t.id} onClick={()=>dismiss(t.id)}
            className="fade-up"
            style={{pointerEvents:"auto",cursor:"pointer",width:"100%",maxWidth:440,background:s.bg,border:`1px solid ${s.border}80`,borderLeft:`4px solid ${s.border}`,borderRadius:12,padding:"13px 16px",display:"flex",alignItems:"flex-start",gap:12,boxShadow:`0 8px 32px rgba(0,0,0,0.45)`,backdropFilter:"blur(8px)"}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:`${s.iconColor}25`,color:s.iconColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0,marginTop:1}}>{s.icon}</div>
            <div style={{flex:1,fontSize:14,color:"#e8edf5",lineHeight:1.45,fontFamily:"Plus Jakarta Sans, sans-serif"}}>{t.message}</div>
            <div style={{color:"#6b7a90",fontSize:16,lineHeight:1,flexShrink:0,marginTop:1}}>×</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({icon, title, body, action, onAction}) {
  return (
    <div className="fade-up glass-card" style={{textAlign:"center",padding:"48px 24px 36px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,borderRadius:20,position:"relative",overflow:"hidden"}}>
      {/* Decorative gradient orbs */}
      <div style={{position:"absolute",top:-40,left:-40,width:160,height:160,borderRadius:"50%",background:`radial-gradient(circle,${C.red}15 0%,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-40,right:-40,width:140,height:140,borderRadius:"50%",background:`radial-gradient(circle,${C.gold}10 0%,transparent 70%)`,pointerEvents:"none"}}/>
      {/* Icon with circular backdrop */}
      <div className="float-anim" style={{position:"relative",width:96,height:96,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:6}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",background:`radial-gradient(circle,${C.red}20 0%,transparent 70%)`}}/>
        <div style={{position:"absolute",inset:8,borderRadius:"50%",border:`2px dashed ${C.border}`,opacity:0.6}}/>
        <div style={{fontSize:48,position:"relative"}}>{icon}</div>
      </div>
      <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,color:"#fff",letterSpacing:1.5,marginTop:4}}>{title}</div>
      {body&&<div style={{fontSize:13,color:C.textDim,lineHeight:1.6,maxWidth:280}}>{body}</div>}
      {action&&onAction&&(
        <button onClick={onAction} className="btn-press" style={{marginTop:10,padding:"12px 26px",borderRadius:12,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 6px 24px ${C.red}50, inset 0 1px 0 rgba(255,255,255,0.2)`,position:"relative"}}>
          {action} →
        </button>
      )}
    </div>
  );
}

// Skeleton loader components for graceful loading states
function SkeletonCard({height=80}) {
  return <div className="skeleton" style={{width:"100%",height,borderRadius:14,marginBottom:10}}/>;
}
function SkeletonList({count=3, height=80}) {
  return <div style={{display:"flex",flexDirection:"column",gap:10}}>{Array.from({length:count}).map((_,i)=><SkeletonCard key={i} height={height}/>)}</div>;
}
function SkeletonText({width="60%", height=14}) {
  return <div className="skeleton" style={{width,height,borderRadius:6,marginBottom:6}}/>;
}

const MapLink = ({location, isGame}) => {
  if(!location) return null;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontSize:13,color:C.textMid}}>📍 {location}</span>
      {isGame&&(
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:C.blue,background:`${C.blue}18`,border:`1px solid ${C.blue}40`,borderRadius:4,padding:"2px 7px",textDecoration:"none",whiteSpace:"nowrap",flexShrink:0}}>
          🗺 Directions
        </a>
      )}
    </div>
  );
};

const Tag = ({label,color,small}) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:small?9:10,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color,background:`${color}18`,border:`1px solid ${color}40`,borderRadius:4,padding:small?"2px 6px":"3px 8px",whiteSpace:"nowrap"}}>{label}</span>
);

const Stars = ({rating,onChange}) => (
  <div style={{display:"flex",gap:2}}>
    {[1,2,3,4,5].map(n=>(
      <span key={n} onClick={()=>onChange?.(n)} style={{fontSize:22,cursor:onChange?"pointer":"default",color:n<=(rating||0)?C.gold:"#1e3060",lineHeight:1,padding:"4px 2px",textShadow:n<=(rating||0)?`0 0 8px ${C.gold}66`:"none",transition:"all 0.12s"}}>★</span>
    ))}
  </div>
);

const Ring = ({pct,size=56,color=C.red,label,sub}) => {
  const r=(size-8)/2, circ=2*Math.PI*r, dash=circ*(pct/100);
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a2f52" strokeWidth={4}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${color}aa)`,transition:"stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:size*0.28,color:C.text,lineHeight:1}}>{label}</div>
        {sub&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:7,letterSpacing:1,color:C.textMid,textTransform:"uppercase"}}>{sub}</div>}
      </div>
    </div>
  );
};

const Avatar = ({name, size=34, showRing=false, photo=null}) => (
  photo
    ? <div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0,boxShadow:showRing?`0 0 0 2px ${C.bg},0 0 0 4px ${avatarColor(name)}60`:"none"}}>
        <img src={photo} alt={name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
      </div>
    : <div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${avatarColor(name)},${avatarColor(name)}99)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:size*0.38,color:"#fff",flexShrink:0,boxShadow:showRing?`0 0 0 2px ${C.bg},0 0 0 4px ${avatarColor(name)}60`:"none",letterSpacing:0}}>
        {initials(name)}
      </div>
);

const inp = {width:"100%",background:"#08111e",border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 14px",color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",outline:"none",transition:"border-color 0.2s"};
const sel = {...inp,appearance:"none",WebkitAppearance:"none"};

const Inp = ({label,...p}) => (
  <div>
    {label&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>{label}</div>}
    <input style={inp} {...p}/>
  </div>
);

const SelF = ({label,value,onChange,options}) => (
  <div>
    {label&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>{label}</div>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={sel}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>
  </div>
);

const PrimaryBtn = ({onClick,children,disabled,full}) => (
  <button className="btn-press" onClick={onClick} disabled={disabled} style={{padding:"13px 22px",borderRadius:10,border:"none",cursor:disabled?"default":"pointer",background:disabled?"#1a2f52":`linear-gradient(135deg,${C.red},${C.redDim})`,color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:2,textTransform:"uppercase",width:full?"100%":"auto",minHeight:48,opacity:disabled?0.5:1,boxShadow:disabled?"none":`0 4px 20px ${C.red}40`,transition:"all 0.15s cubic-bezier(0.22,1,0.36,1)"}}>{children}</button>
);

const GhostBtn = ({onClick,children,danger}) => (
  <button className="btn-press" onClick={onClick} style={{padding:"11px 18px",borderRadius:10,cursor:"pointer",minHeight:46,background:"transparent",border:`1px solid ${danger?C.red+"60":C.border}`,color:danger?C.red:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:14,letterSpacing:1.5,textTransform:"uppercase",transition:"all 0.15s cubic-bezier(0.22,1,0.36,1)"}}>{children}</button>
);

const SectionHead = ({children,accent,tip}) => (
  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
    {accent&&<div style={{width:3,height:18,background:`linear-gradient(180deg,${C.red},${C.gold})`,borderRadius:2,flexShrink:0}}/>}
    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:3,color:C.textMid,textTransform:"uppercase"}}>{children}</div>
    {tip&&<Tip text={tip}/>}
  </div>
);

// ── Plain-English Tooltip ─────────────────────────────────────────────────────
function Tip({text, inline}) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{position:"relative",display:"inline-flex",alignItems:"center",verticalAlign:"middle"}}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}
        style={{width:inline?16:18,height:inline?16:18,borderRadius:"50%",background:open?`${C.blue}40`:`${C.blue}20`,border:`1px solid ${C.blue}50`,color:C.blue,fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:inline?9:10,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0,flexShrink:0,lineHeight:1}}>?</button>
      {open&&(
        <>
          <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:999}}/>
          <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",bottom:"calc(100% + 8px)",zIndex:1000,background:"#1a2a4a",border:`1px solid ${C.blue}50`,borderRadius:12,padding:"10px 14px",width:240,boxShadow:`0 8px 32px #00000080`,pointerEvents:"none"}}>
            <div style={{fontSize:12,color:"#c8deff",lineHeight:1.55,fontFamily:"Plus Jakarta Sans, sans-serif"}}>{text}</div>
            <div style={{position:"absolute",bottom:-6,left:"50%",transform:"translateX(-50%)",width:10,height:10,background:"#1a2a4a",border:`1px solid ${C.blue}50`,borderTop:"none",borderLeft:"none",rotate:"45deg"}}/>
          </div>
        </>
      )}
    </span>
  );
}

// ── New Coach Welcome Card ────────────────────────────────────────────────────
const COACH_PAGE_TIPS = {
  home: {
    title:"Welcome to your Coach Dashboard",
    tips:[
      "Your team's drill progress and upcoming events live here at a glance.",
      "The gold alert card appears when a player completes a drill and needs your review.",
      "Tap any player's name in Drill Progress to jump straight to their profile.",
      "Need a hand? Tap the gear icon, then Help & Support — we reply by email.",
    ]
  },
  roster: {
    title:"Managing Your Roster",
    tips:[
      "Fastest way to build your roster: tap SCAN and snap a photo of your sign-up sheet — AI reads names, numbers, and parent contacts for you.",
      "Or tap '+ Add Player' to add players one at a time — include parent contact info so they can be invited.",
      "Tap a player's card to open their full profile: drills, progress, goals and badges.",
    ]
  },
  drills: {
    title:"Assigning Drills",
    tips:[
      "Browse the drill library by category, then tap a player's name to assign it to them.",
      "Attach a demo video to any drill so players can see exactly how it's done.",
      "Parents see assigned drills instantly and can mark them complete from their view.",
      "When a player uploads a practice video it shows up in your Needs Review queue — watch it and send feedback.",
    ]
  },
  schedule: {
    title:"Schedule & Events",
    tips:[
      "Got a printed league schedule? Tap SCAN, snap a photo, and import the whole season at once.",
      "Or add practices and games one at a time with '+ Add Event' — parents see upcoming events automatically.",
      "Tap any game to open the Game Plan and set your lineup and field positions.",
      "Once you mark a lineup as shared, parents and players can see their batting slot and position.",
    ]
  },
  msgs: {
    title:"Messaging Parents",
    tips:[
      "Team Chat goes to every parent at once — great for announcements and cancellations.",
      "Each parent also has a private DM channel for one-on-one conversations.",
      "Press and hold any message to react with an emoji.",
      "Use 'Message All Parents' to broadcast the same message to every parent DM simultaneously.",
    ]
  },
  plans: {
    title:"Practice Plans",
    tips:[
      "Choose from pre-built 90-minute plans or create your own from scratch.",
      "Each plan has a built-in timer — tap 'Start Timer' to run your practice block by block.",
      "Custom plans save automatically so you can reuse your favorites each week.",
    ]
  },
};

function NewCoachCard({page="home", setTab}) {
  const storageKey = `ccp_tips_dismissed_v2_${page}`;
  const [dismissed, setDismissed] = useState(()=>{try{return localStorage.getItem(storageKey)==='true'}catch(e){return false}});
  const [expanded,  setExpanded]  = useState(false);
  const tip = COACH_PAGE_TIPS[page] || COACH_PAGE_TIPS.home;
  const handleDismiss = () => { setDismissed(true); try{localStorage.setItem(storageKey,'true')}catch(e){} };
  if(dismissed) return null;
  return (
    <div className="fade-up" style={{background:`linear-gradient(135deg,#0a1f12,${C.card})`,border:`1px solid ${C.teal}40`,borderRadius:16,marginBottom:16,overflow:"hidden",boxShadow:`0 4px 24px ${C.teal}15`}}>
      <button onClick={()=>setExpanded(e=>!e)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:C.teal,letterSpacing:0.5}}>{tip.title}</div>
          <div style={{fontSize:12,color:C.textDim,marginTop:1}}>Tap to see quick tips for this page</div>
        </div>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:18,color:C.textDim,transition:"transform 0.2s",transform:expanded?"rotate(90deg)":"none"}}>›</div>
      </button>
      {expanded&&(
        <div style={{borderTop:`1px solid ${C.teal}25`}}>
          {tip.tips.map((t,i)=>(
            <div key={i} style={{display:"flex",gap:10,padding:"10px 16px",borderBottom:i<tip.tips.length-1?`1px solid ${C.border}30`:"none"}}>
              <div style={{color:C.teal,fontFamily:"Bebas Neue, sans-serif",fontSize:14,flexShrink:0,marginTop:1}}>{i+1}</div>
              <div style={{fontSize:12,color:C.textMid,lineHeight:1.55}}>{t}</div>
            </div>
          ))}
          <div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}30`}}>
            <button onClick={handleDismiss} style={{background:"none",border:"none",color:C.textDim,fontSize:12,fontFamily:"Barlow Condensed, sans-serif",letterSpacing:1,cursor:"pointer",padding:0}}>Got it — dismiss this</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Video helpers ─────────────────────────────────────────────────────────────
const getYouTubeId = url => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

function DrillVideoBlock({drillId, drillVideos, setDrillVideos, coachMode, teamId}) {
  const [editing, setEditing] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const video = drillVideos[drillId];

  const save = async () => {
    if (!urlInput.trim()) return;
    const v = {url: urlInput.trim(), label: labelInput.trim() || "Watch Video"};
    setDrillVideos(prev => ({...prev, [drillId]: v}));
    if(teamId) {
      await supabase.from('drill_videos').upsert(
        {team_id: teamId, drill_id: drillId, url: v.url, label: v.label},
        {onConflict: 'team_id,drill_id'}
      );
    }
    setEditing(false);
  };
  const remove = async () => {
    setDrillVideos(prev => { const n={...prev}; delete n[drillId]; return n; });
    if(teamId) await supabase.from('drill_videos').delete().eq('team_id',teamId).eq('drill_id',drillId);
  };

  const ytId = video ? getYouTubeId(video.url) : null;

  return (
    <div style={{marginTop:12}}>
      {!video && coachMode && !editing && (
        <button onClick={()=>{setEditing(true);setUrlInput("");setLabelInput("");}} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",borderRadius:9,background:"transparent",border:`1px dashed ${C.borderBright}`,color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:38,width:"100%",justifyContent:"center"}}>
          🎬 Add Demo Video
        </button>
      )}

      {editing && coachMode && (
        <div style={{background:"#08111e",border:`1px solid ${C.border}`,borderRadius:10,padding:14}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:2}}>Demo Video URL</div>
          <div style={{fontSize:11,color:C.textDim,marginBottom:8}}>Link a YouTube or other video showing players how to do this drill correctly</div>
          <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://youtube.com/watch?v=..." style={{...inp,marginBottom:10}}/>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Button Label (optional)</div>
          <input value={labelInput} onChange={e=>setLabelInput(e.target.value)} placeholder="e.g. Watch Demo" style={{...inp,marginBottom:12}}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={save} style={{flex:1,padding:"10px 0",borderRadius:9,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:42}}>Save</button>
            <button onClick={()=>setEditing(false)} style={{padding:"10px 16px",borderRadius:9,background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",minHeight:42}}>Cancel</button>
          </div>
        </div>
      )}

      {video && (
        <div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${C.borderBright}`}}>
          {ytId ? (
            <div style={{position:"relative",paddingTop:"56.25%",background:"#000"}}>
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                title={video.label}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}}
              />
            </div>
          ) : (
            <a href={video.url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:`linear-gradient(90deg,${C.blue}18,transparent)`,textDecoration:"none"}}>
              <div style={{width:40,height:40,borderRadius:10,background:`${C.blue}25`,border:`1px solid ${C.blue}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🎬</div>
              <div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,color:C.blue,marginBottom:2}}>{video.label}</div>
                <div style={{fontSize:11,color:C.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{video.url}</div>
              </div>
              <div style={{marginLeft:"auto",color:C.blue,fontSize:18}}>↗</div>
            </a>
          )}
          {coachMode && (
            <div style={{display:"flex",borderTop:`1px solid ${C.border}`}}>
              <button onClick={()=>{setUrlInput(video.url);setLabelInput(video.label);setEditing(true);}} style={{flex:1,padding:"9px 0",background:"transparent",border:"none",borderRight:`1px solid ${C.border}`,color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:38}}>Edit</button>
              <button onClick={remove} style={{flex:1,padding:"9px 0",background:"transparent",border:"none",color:C.red+"80",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:38}}>Remove</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LAUNCH SCREEN ────────────────────────────────────────────────────────────
function LaunchScreen({ onDone }) {
  // Rolling baseball intro video — holds until the logo lands (~4.2s), then hands off.
  useEffect(() => {
    const t = setTimeout(onDone, 5500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:9999,overflow:"hidden"}}>
      <style>{FONTS}</style>
      <video autoPlay muted playsInline preload="auto" poster="/loader-poster.jpg" src="/baseball-loader.mp4"
        style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",background:C.bg}}/>
    </div>
  );
}


function AppInner() {
  const [session,  setSession]  = useState(null);   // Supabase session
  const [showSupport, setShowSupport] = useState(false); // Help & Support modal
  const [profile,  setProfile]  = useState(null);   // { role, team_id, full_name }
  const [authReady,setAuthReady]= useState(false);  // hide UI until auth checked
  const [parentUserId, setPUID] = useState(null);
  const [parentPlayerLink, setParentPlayerLink] = useState(null);
  const [launching, setLaunching] = useState(true); // show launch screen first
  const [recoveryMode, setRecoveryMode] = useState(false); // user arrived via password-reset email link

  // ── Listen for auth state changes ────────────────────────────────────────
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setSession(session);
      if(session) loadProfile(session.user.id);
      else setAuthReady(true);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event,session)=>{
      // Only reload data on actual sign-in, not token refresh
      if(event === 'PASSWORD_RECOVERY') {
        // User clicked the reset link in their email — Supabase signed them in
        // with a temporary session; show the "set new password" screen.
        setSession(session);
        setRecoveryMode(true);
        setAuthReady(true);
      } else if(event === 'SIGNED_OUT') {
        setSession(null); setProfile(null); setAuthReady(true);
      } else if(event === 'SIGNED_IN') {
        setSession(session);
        if(session) loadProfile(session.user.id);
      } else if(event === 'TOKEN_REFRESHED') {
        // Just update session, don't reload data
        setSession(session);
      }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  // ── Global error capture: uncaught errors + unhandled promise rejections ──
  useEffect(()=>{
    const onErr = (e)=>logError('window', e.message, e.error && e.error.stack);
    const onRej = (e)=>{
      const r = e.reason;
      logError('promise', (r && r.message) || String(r), r && r.stack);
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return ()=>{
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  },[]);

  // Keep the error logger's context current so reports carry who/which team
  useEffect(()=>{
    setErrorContext({ user_id: session?.user?.id || null, team_id: profile?.team_id || null });
  },[session, profile]);


  const [teamDisplayName, setTeamDisplayName] = useState("");

  // A single stalled request used to hang the whole load screen forever on a
  // flaky connection. Each query now times out, retries once, then gives up
  // with empty data so the app still opens instead of freezing.
  const q = async (make, label) => {
    for (let i = 0; i < 2; i++) {
      try {
        return await Promise.race([
          make(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
        ]);
      } catch (e) {
        if (i === 1) { console.error('query failed:', label, e.message); return { data: [] }; }
      }
    }
  };

  // Fetch from Supabase, render it, then keep a copy on the device.
  const loadTeamData = async (teamId, userId) => {
    try {
      const [
        {data:pData}, {data:aData}, {data:eData},
        {data:mData}, {data:sData}, {data:lData}, {data:gData}, {data:dvData},
        {data:cpData}, {data:phData}, {data:readData}, {data:pvData},
        {data:cdData},
        {data:buData},
        {data:crData},
      ] = await Promise.all([
        q(()=>supabase.from('players').select('*').eq('team_id',teamId).order('created_at'),'players'),
        q(()=>supabase.from('assignments').select('*').eq('team_id',teamId).order('created_at'),'assignments'),
        q(()=>supabase.from('events').select('*').eq('team_id',teamId).order('date'),'events'),
        // Newest 400 messages only — chat used to load the entire team history
        // on every single app open, which grew without limit all season.
        q(()=>supabase.from('messages').select('*').eq('team_id',teamId).order('created_at',{ascending:false}).limit(400),'messages'),
        q(()=>supabase.from('skill_snapshots').select('*').eq('team_id',teamId).order('date'),'skill_snapshots'),
        q(()=>supabase.from('lineups').select('*').eq('team_id',teamId),'lineups'),
        q(()=>supabase.from('game_plans').select('*').eq('team_id',teamId),'game_plans'),
        q(()=>supabase.from('drill_videos').select('*').eq('team_id',teamId),'drill_videos'),
        q(()=>supabase.from('custom_plans').select('*').eq('team_id',teamId).order('created_at'),'custom_plans'),
        q(()=>supabase.from('player_photos').select('*').eq('team_id' , teamId),'player_photos'),
        q(()=>supabase.from('chat_read_status').select('*').eq('team_id',teamId),'chat_read_status'),
        q(()=>supabase.from('player_videos').select('*').eq('team_id',teamId),'player_videos'),
        q(()=>supabase.from('custom_drills').select('*').eq('team_id',teamId).order('created_at'),'custom_drills'),
        q(()=>supabase.from('blocked_users').select('*').eq('team_id',teamId),'blocked_users'),
        q(()=>supabase.from('chat_reports').select('*').eq('team_id',teamId).order('created_at',{ascending:false}),'chat_reports'),
      ]);

      // Keep the raw rows for offline. Stored before rendering so a crash
      // mid-render still leaves a usable cache behind.
      const raw = {pData,aData,eData,mData,sData,lData,gData,dvData,
                   cpData,phData,readData,pvData,cdData,buData,crData};
      saveTeamData(teamId, raw);
      setCacheAge(Date.now());

      await applyTeamData(raw, userId, true);
    } catch(err) {
      console.error('loadTeamData error:', err);
      throw err; // re-throw so loadProfile's catch picks it up
    }
  };

  // Turn raw rows into React state. Runs for both a live fetch and a cache
  // restore, so there is one mapping to maintain rather than two.
  //   online=true  → sign media URLs from Supabase and cache the bytes
  //   online=false → serve media from the bytes already on the device
  const applyTeamData = async (raw, userId, online) => {
    const {pData,aData,eData,mData,sData,lData,gData,dvData,
           cpData,phData,readData,pvData,cdData,buData,crData} = raw;
    try {

    // Build players
    const loadedPlayers = (pData||[]).map(p=>({
      id:p.id, name:p.name, age:p.age, ageGroup:p.age_group||'',
      position:p.position||'', number:p.number||'',
      bats:p.bats||'R', throws:p.throws||'R',
      goals:p.goals||[], parents:p.parents_info||[],
      createdAt: p.created_at ? new Date(p.created_at).getTime() : 0,
    }));
    setPlayers(loadedPlayers);

    setAsgn((aData||[]).map(a=>({
      id:a.id, playerId:a.player_id, drillId:a.drill_id,
      assignedDate:a.assigned_date, completed:a.completed||false,
      coachRating:a.coach_rating||null, notes:a.notes||'',
      acknowledged:a.acknowledged||false,
      createdAt: a.created_at ? new Date(a.created_at).getTime() : 0,
    })));
    setEvents((eData||[]).map(e=>({
      id:e.id, type:e.type, date:e.date, time:e.time||'',
      location:[e.field_name,e.address].filter(Boolean).join(' — '),
      fieldName:e.field_name||'', address:e.address||'',
      notes:e.notes||'', opponent:e.opponent||'', uniform:e.uniform||'',
      createdAt: e.created_at ? new Date(e.created_at).getTime() : 0,
    })));

    // Build channel ID mapping: old formats → new per-parent format
    const channelRemap = {};
    loadedPlayers.forEach(p=>{
      (p.parents||[]).forEach(par => {
        // Map old dm-{playerId} → dm-{parentInfoId}
        channelRemap[`dm-${p.id}`] = `dm-${par.id}`;
      });
    });
    // Parent links — scoped to THIS team's players (previously fetched the whole
    // table across all teams, relying on RLS alone and growing with every team).
    const {data:ppData} = loadedPlayers.length
      ? await q(()=>supabase.from('parent_players').select('*').in('player_id', loadedPlayers.map(p=>p.id)),'parent_players')
      : {data: []};
    // Map dm-{authUserId} → dm-{parentInfoId} using parent_players links
    (ppData||[]).forEach(pp => {
      const player = loadedPlayers.find(p=>p.id===pp.player_id);
      if(player && player.parents && player.parents.length > 0) {
        // Find the matching parent info entry by email or just use the first
        const matchedPar = player.parents.find(par => par.email && pp.email && par.email.toLowerCase()===pp.email.toLowerCase()) || player.parents[0];
        if(matchedPar) channelRemap[`dm-${pp.parent_id}`] = `dm-${matchedPar.id}`;
      }
    });

    const msgMap = {};
    ((mData||[]).slice().reverse()).forEach(m=>{
      let ch = m.channel;
      if(channelRemap[ch]) ch = channelRemap[ch];
      if(!msgMap[ch]) msgMap[ch]=[];
      msgMap[ch].push({id:m.id,senderId:m.sender_id,senderName:m.sender_name,text:m.text,ts:new Date(m.created_at).getTime(),attachment:m.payload?.attachment||null});
    });
    setMessages(msgMap);

    // Build set of known channels (only count unread for these)
    const knownChannels = new Set(["team"]);
    loadedPlayers.forEach(p=>{
      (p.parents||[]).forEach(par => knownChannels.add(`dm-${par.id}`));
    });

    // Compute unread from read status — only for known channels
    const readMap = {};
    (readData||[]).forEach(r=>{ readMap[r.channel] = new Date(r.last_read_at).getTime(); });
    const unreadMap = {};
    knownChannels.forEach(ch => {
      const msgs = msgMap[ch] || [];
      const lastRead = readMap[ch] || 0;
      unreadMap[ch] = msgs.filter(m => m.ts > lastRead && m.senderId !== userId).length;
    });
    setUnread(unreadMap);
    setSkillSnapshots((sData||[]).map(s=>({
      id:s.id, playerId:s.player_id, date:s.date,
      rubric:s.rubric||{}, notes:s.notes||'',
    })));
    const luMap = {};
    (lData||[]).forEach(l=>{ luMap[l.event_id]={batting:l.batting||[],positions:l.positions||{},shared:l.shared}; });
    setLineups(luMap);
    const gpMap = {};
    (gData||[]).forEach(g=>{ gpMap[g.event_id]={pitcher:g.pitcher||'',defense:g.defense||'',offense:g.offense||'',notes:g.notes||'',shared:g.shared||false}; });
    setGamePlans(gpMap);

    const dvMap = {};
    (dvData||[]).forEach(d=>{ dvMap[d.drill_id]={url:d.url||'',label:d.label||'Watch Video'}; });
    setDrillVideos(dvMap);

    setCustomPlans((cpData||[]).map(p=>({
      id:p.id, title:p.title||'', focus:p.focus||'', ageGroup:p.age_group||'',
      duration:p.duration||'', blocks:p.blocks||[], isCustom:true,
      createdAt: p.created_at ? new Date(p.created_at).getTime() : 0,
    })));

    setCustomDrills((cdData||[]).map(d=>({
      id:d.id, name:d.name, category:d.category, duration:d.duration,
      desc:d.description, results:d.results, isCustom:true,
    })));

    // Buckets are private: sign all photo paths in ONE batched call.
    // Each signed URL carries a unique token, so no cache-buster is needed.
    // Offline, signed URLs are worthless — serve the bytes already on the
    // device instead, which is why the cache stores blobs and not links.
    const photoMap = {};
    const photoRows = (phData||[]).filter(ph=>ph.player_id && ph.storage_path);
    if (photoRows.length && online) {
      const {data:signedPhotos} = await supabase.storage.from('player-photos')
        .createSignedUrls(photoRows.map(r=>r.storage_path), SIGNED_URL_TTL);
      const toCache = [];
      photoRows.forEach((ph,i)=>{
        const u = signedPhotos?.[i]?.signedUrl;
        if (u) { photoMap[ph.player_id] = u; toCache.push({path:ph.storage_path, url:u}); }
      });
      // Pull the bytes down in the background, after this render. Never awaited:
      // a slow photo must not hold up the roster appearing.
      if (toCache.length) setTimeout(()=>cacheMediaFromUrls(toCache), 1200);
    } else if (photoRows.length) {
      for (const ph of photoRows) {
        const local = await getCachedMedia(ph.storage_path);
        if (local) photoMap[ph.player_id] = local;
      }
    }
    setPlayerPhotos(photoMap);

    // Load player videos from DB
    // Videos are up to 50MB each and get reviewed at home on wifi, never in a
    // dugout, so they are deliberately not cached. Offline the row still loads
    // with a null url, so the UI shows "needs a connection" rather than
    // claiming the video does not exist.
    const pvMap = {};
    const videoRows = (pvData||[]).filter(pv=>pv.player_id && pv.drill_id && pv.storage_path);
    if (videoRows.length) {
      let signedVids = null;
      if (online) {
        ({data:signedVids} = await supabase.storage.from('player-videos')
          .createSignedUrls(videoRows.map(r=>r.storage_path), SIGNED_URL_TTL));
      }
      videoRows.forEach((pv,i)=>{
        const key = `${pv.player_id}_${pv.drill_id}`;
        pvMap[key] = { url: signedVids?.[i]?.signedUrl || null, storagePath: pv.storage_path, uploadedAt: new Date(pv.uploaded_at).getTime(), feedback: [] };
      });
    }
    setPlayerVideos(pvMap);

    // Load blocked users and chat reports
    setBlockedUsers((buData||[]).map(b=>({id:b.id,userId:b.user_id,blockedUserId:b.blocked_user_id,teamId:b.team_id})));
    setChatReports((crData||[]).map(r=>({id:r.id,reporterId:r.reporter_id,reporterName:r.reporter_name,reportedUserId:r.reported_user_id,reportedUserName:r.reported_user_name,messageId:r.message_id,messageText:r.message_text,reason:r.reason,createdAt:r.created_at,resolved:r.resolved||false})));

    // setDataLoaded is called in loadProfile after parent link is also set
    } catch(err) {
      console.error('applyTeamData error:', err);
      throw err; // re-throw so loadProfile's catch picks it up
    }
  };

  // Render whatever is already on the device. Returns true if anything was
  // restored, so the caller knows whether the screen is usable yet.
  const hydrateFromCache = async (teamId, userId) => {
    try {
      const rec = await loadCachedTeamData(teamId);
      if (!rec) return false;
      await applyTeamData(rec.raw, userId, false);
      setCacheAge(rec.cachedAt);
      return true;
    } catch (err) {
      console.warn('cache restore failed:', err);
      return false;
    }
  };

  const [loadError, setLoadError] = useState(null);

  const loadProfile = async (userId, attempt = 0) => {
    const MAX_ATTEMPTS = 6;   // up to ~6 tries before giving up
    const RETRY_DELAY = 600;  // ms between tries

    // Cache first: paint from the device, then refresh from the network. On a
    // field with no signal this is the whole app; online it just means the
    // roster is up before the first query returns. Only on the first attempt —
    // a retry has already hydrated.
    let hydrated = false;
    if (attempt === 0) {
      const sess = loadSession(userId);
      if (sess?.profile?.team_id) {
        try {
          setProfile(sess.profile);
          if (sess.team?.name) setTeamDisplayName(sess.team.name);
          if (sess.team) setTeamData(sess.team);
          hydrated = await hydrateFromCache(sess.profile.team_id, userId);
          if (hydrated) { setDataLoaded(true); setAuthReady(true); }
        } catch (err) { console.warn('cache boot failed:', err); }
      }
    }

    try {
      // maybeSingle() returns null (not an error) when the row isn't there yet —
      // important right after signup, when the profile/team rows may still be inserting.
      const {data, error} = await supabase.from("profiles").select("*").eq("id",userId).maybeSingle();

      // Real query error (network / permissions / transient) — retry briefly, then fail.
      if (error) {
        console.error('Profile load error:', error.message);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(r=>setTimeout(r, RETRY_DELAY));
          return loadProfile(userId, attempt + 1);
        }
        if (hydrated) { setOnline(false); setAuthReady(true); return; }
        setLoadError("Couldn't load your profile. Please try again."); setAuthReady(true); return;
      }

      // No row yet — almost always a brand-new signup still finishing. Wait and retry.
      if (!data) {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(r=>setTimeout(r, RETRY_DELAY));
          return loadProfile(userId, attempt + 1);
        }
        setLoadError("Profile not found. Please sign out and create a new account."); setAuthReady(true); return;
      }

      setProfile(data);
      if (data?.team_id) {
        const {data:td} = await supabase.from("teams").select("*").eq("id",data.team_id).single();
        if (td?.name) setTeamDisplayName(td.name);
        if (td?.logo_url) {
          // Older rows stored a full public URL (now dead); newer rows store the
          // storage path. resolveMediaUrl handles both. Fire-and-forget so the
          // logo never blocks team data loading.
          resolveMediaUrl('player-photos', td.logo_url).then(u=>{ if (u) setTeamLogo(u); });
        }
        if (td) setTeamData(td);
        // Remember enough to boot offline next time: which team, and its row.
        saveSession(data, td || null);
        await loadTeamData(data.team_id, userId);
        setOnline(true);
        if(data.role === 'parent' && data.player_id) {
          setParentPlayerLink({player_id: data.player_id, parent_id: userId});
          setPUID(userId);
        }
      }
      setDataLoaded(true);
      setAuthReady(true);
      // Register push notifications (async, non-blocking)
      if (data?.team_id) registerPushSubscription(userId, data.team_id);
    } catch(err) {
      console.error('loadProfile error:', err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r=>setTimeout(r, RETRY_DELAY));
        return loadProfile(userId, attempt + 1);
      }
      if (hydrated) { setOnline(false); setAuthReady(true); return; }
      setLoadError("Something went wrong loading your data. Check your internet connection and try again.");
      setAuthReady(true);
    }
  };

  // For parents: whenever profile is set, fetch their player link
  useEffect(()=>{
    if(!profile || profile.role !== 'parent') return;
    supabase.from("parent_players").select("*").eq("parent_id", profile.id)
      .then(({data:links})=>{
        if(links && links.length > 0) {
          setParentPlayerLink(links[0]);
          setPUID(profile.id);
        }
      });
  },[profile?.id]);

  const handleAuth = (user, prof) => {
    setSession({user});
    setProfile(prof);
  };

  // Watch the connection. Coming back online refetches silently so the coach
  // never has to think about pulling to refresh.
  useEffect(()=>{
    return watchConnection((up)=>{
      setOnline(up);
      if (up && profile?.team_id && session?.user?.id) {
        loadTeamData(profile.team_id, session.user.id).catch(()=>{});
      }
    });
  },[profile?.team_id, session?.user?.id]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearSession();            // never boot the next user into this roster
    setCacheAge(null);
    setSession(null); setProfile(null); setPUID(null);
    setPlayers([]); setAsgn([]); setEvents([]); setMessages({}); setUnread({});
    setSkillSnapshots([]); setLineups({}); setGamePlans({});
    setCustomPlans([]); setCustomDrills([]); setDrillVideos({}); setPlayerVideos({});
    setPlayerPhotos({}); setTeamLogo(null); setTeamDisplayName("");
    setBlockedUsers([]); setChatReports([]);
    setDataLoaded(false);
  };

  // Open the Stripe billing portal (cancel, update card, invoices)
  const openBillingPortal = async () => {
    try {
      const {data:{session:authSession}} = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if(!token){ toast.error("Please sign in again."); return; }
      const res = await fetch("https://hcadlkmejdekhbgfvyaq.supabase.co/functions/v1/stripe-checkout", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body: JSON.stringify({action:"portal"}),
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      if(data.url) window.location.href = data.url;
      else throw new Error("Couldn't open billing.");
    } catch(err) {
      const msg = String(err.message||err);
      if(/no subscription/i.test(msg)) toast.error("No active subscription yet. Start a plan first to manage billing.");
      else toast.error("Couldn't open billing. Please try again.");
    }
  };

  // derive player and parent object from parentUserId
  const getParentContext = (uid) => {
    if(parentPlayerLink) {
      const linkedPlayer = players.find(p=>p.id===parentPlayerLink.player_id);
      if(linkedPlayer) return {
        player: linkedPlayer,
        parent: {id:uid, name:profile?.full_name||'Parent', phone:'', email:''}
      };
    }
    for (const pl of players) {
      const par = (pl.parents||[]).find(p=>p.id===uid);
      if (par) return {player:pl, parent:par};
    }
    return {player:null, parent:null};
  };
  // ── App state — starts empty, loaded from DB after auth ──────────────────
  const [players, setPlayers]         = useState([]);
  const [assignments, setAsgn]        = useState([]);
  const [events, setEvents]           = useState([]);
  const [messages, setMessages]       = useState({});
  const [unread, setUnread]           = useState({});
  const [skillSnapshots, setSkillSnapshots] = useState([]);
  const [drillVideos, setDrillVideos] = useState({});
  const [playerVideos, setPlayerVideos] = useState({});
  const [playerPhotos, setPlayerPhotos] = useState({});
  const [teamLogo, setTeamLogo]       = useState(null);
  const [teamData, setTeamData]       = useState({});
  const [lineups, setLineups]         = useState({});
  const [customPlans, setCustomPlans] = useState([]);
  const [customDrills, setCustomDrills] = useState([]);
  const [gamePlans, setGamePlans]     = useState({});
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [chatReports, setChatReports]   = useState([]);
  const [dataLoaded, setDataLoaded]   = useState(false);
  // Offline support: when the cached copy was taken, and whether we are online.
  const [cacheAge, setCacheAge]       = useState(null);
  const [online, setOnline]           = useState(isOnline());

  // Keep a ref so DB functions always have the current profile
  const profileRef = useRef(null);
  useEffect(()=>{ profileRef.current = profile; }, [profile]);

  // Keep a ref of the current events list so DB setters can tell whether an
  // event row already exists before writing FK-dependent lineup/game-plan rows.
  const eventsRef = useRef([]);
  useEffect(()=>{ eventsRef.current = events; }, [events]);

  // Sync custom drills to global ref so getAllDrills()/findDrill() work everywhere
  useEffect(()=>{ _customDrillsRef = customDrills; }, [customDrills]);

  // ── DB shape converters ──────────────────────────────────────────────────
  const tid = () => profileRef.current?.team_id;

  const toDbPlayer = (p) => ({
    id: p.id, team_id: tid(),
    name: p.name, age: String(p.age||''), age_group: p.ageGroup||'',
    position: p.position||'', number: p.number||'',
    bats: p.bats||'R', throws: p.throws||'R',
    goals: p.goals||[], parents_info: p.parents||[],
  });
  const toDbAsgn = (a) => ({
    id: a.id, team_id: tid(),
    player_id: a.playerId, drill_id: a.drillId,
    assigned_date: a.assignedDate, completed: a.completed||false,
    notes: a.notes||'', acknowledged: a.acknowledged||false,
    coach_rating: a.coachRating||null,
  });
  const toDbEvent = (e) => ({
    id: e.id, team_id: tid(),
    type: e.type, date: e.date, time: e.time||'',
    field_name: e.fieldName||(e.location?e.location.split(' — ')[0]:''),
    address: e.address||(e.location?e.location.split(' — ')[1]:''),
    notes: e.notes||'', opponent: e.opponent||'', uniform: e.uniform||'',
  });

  // ── Explicit DB-aware setters ────────────────────────────────────────────
  const setPlayersDb = (updater) => {
    setPlayers(prev => {
      const next = typeof updater==='function' ? updater(prev) : updater;
      if (!tid()) return next;
      
      const prevIds = new Set(prev.map(p=>p.id));
      const nextIds = new Set(next.map(p=>p.id));
      // Inserts
      next.filter(p=>!prevIds.has(p.id)).forEach(p=>{
        const row = toDbPlayer(p);
        console.log('Inserting player:', row);
        supabase.from('players').insert(row).then(({error,data})=>{
          if(error){ if(error.code!=='23505'){ console.error('Player insert FAILED:',error.code,error.message,error.details); notifySaveError(); } }
          else console.log('Player insert OK');
        });
      });
      // Updates
      next.filter(p=>prevIds.has(p.id)&&JSON.stringify(prev.find(x=>x.id===p.id))!==JSON.stringify(p)).forEach(p=>{
        supabase.from('players').update(toDbPlayer(p)).eq('id',p.id).then(({error})=>{
          if(error){ console.error('Player update FAILED:',error.code,error.message); notifySaveError(); }
        });
      });
      // Deletes
      prev.filter(p=>!nextIds.has(p.id)).forEach(p=>{
        supabase.from('players').delete().eq('id',p.id).then(({error})=>{
          if(error){ console.error('Player delete FAILED:',error.code,error.message); notifySaveError(); }
        });
      });
      return next;
    });
  };

  const setAsgnDb = (updater) => {
    setAsgn(prev => {
      const next = typeof updater==='function' ? updater(prev) : updater;
      if (!tid()) return next;
      
      const prevIds = new Set(prev.map(a=>a.id));
      const nextIds = new Set(next.map(a=>a.id));
      next.filter(a=>!prevIds.has(a.id)).forEach(a=>{
        supabase.from('assignments').insert(toDbAsgn(a)).then(({error})=>{
          if(error){ if(error.code!=='23505'){ console.error('Asgn insert FAILED:',error.code,error.message); notifySaveError(); } }
          else {
            // Send push notification for new drill assignment
            const drill = findDrill(a.drillId);
            const player = players.find(p=>p.id===a.playerId);
            if(drill && player) {
              sendPushNotification(tid(), `New Drill: ${drill.name}`, `Coach assigned "${drill.name}" to ${player.name}`, session?.user?.id);
            }
          }
        });
      });
      next.filter(a=>prevIds.has(a.id)&&JSON.stringify(prev.find(x=>x.id===a.id))!==JSON.stringify(a)).forEach(a=>{
        supabase.from('assignments').update(toDbAsgn(a)).eq('id',a.id).then(({error})=>{
          if(error){ console.error('Asgn update FAILED:',error.code,error.message); notifySaveError(); }
        });
      });
      prev.filter(a=>!nextIds.has(a.id)).forEach(a=>{
        supabase.from('assignments').delete().eq('id',a.id).then(({error})=>{
          if(error){ console.error('Asgn delete FAILED:',error.code,error.message); notifySaveError(); }
        });
      });
      return next;
    });
  };

  const setEventsDb = (updater) => {
    setEvents(prev => {
      const next = typeof updater==='function' ? updater(prev) : updater;
      if (!tid()) return next;
      
      const prevIds = new Set(prev.map(e=>e.id));
      const nextIds = new Set(next.map(e=>e.id));
      next.filter(e=>!prevIds.has(e.id)).forEach(e=>{
        supabase.from('events').insert(toDbEvent(e)).then(({error})=>{
          if(error){ if(error.code!=='23505'){ console.error('Event insert FAILED:',error.code,error.message); notifySaveError(); } }
          else {
            // Send push notification for new event
            const dateStr = e.date ? new Date(e.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '';
            const typeLabel = e.type==='game' ? 'Game' : 'Practice';
            sendPushNotification(tid(), `New ${typeLabel} Scheduled`, `${typeLabel} on ${dateStr}${e.time?' at '+e.time:''}${e.opponent?' vs '+e.opponent:''}`, session?.user?.id);
          }
        });
      });
      next.filter(e=>prevIds.has(e.id)&&JSON.stringify(prev.find(x=>x.id===e.id))!==JSON.stringify(e)).forEach(e=>{
        supabase.from('events').update(toDbEvent(e)).eq('id',e.id).then(({error})=>{
          if(error){ console.error('Event update FAILED:',error.code,error.message); notifySaveError(); }
        });
      });
      prev.filter(e=>!nextIds.has(e.id)).forEach(e=>{
        supabase.from('events').delete().eq('id',e.id).then(({error})=>{
          if(error){ console.error('Event delete FAILED:',error.code,error.message); notifySaveError(); }
        });
      });
      return next;
    });
  };

  const setSnapshotsDb = (updater) => {
    setSkillSnapshots(prev => {
      const next = typeof updater==='function' ? updater(prev) : updater;
      if (!tid()) return next;
      
      const prevIds = new Set(prev.map(s=>s.id));
      next.filter(s=>!prevIds.has(s.id)).forEach(s=>{
        supabase.from('skill_snapshots').insert({
          id:s.id, team_id:tid(), player_id:s.playerId,
          date:s.date, rubric:s.rubric||{}, notes:s.notes||'',
        }).then(({error})=>{ if(error){ console.error('Snapshot FAILED:',error.message); notifySaveError(); } });
      });
      return next;
    });
  };

  const setLineupsDb = (updater) => {
    setLineups(prev => {
      const next = typeof updater==='function' ? updater(prev) : updater;
      if (!tid()) return next;

      const savedEventIds = new Set(eventsRef.current.map(e=>e.id));
      Object.entries(next).forEach(([eventId,lu])=>{
        if(JSON.stringify(prev[eventId])!==JSON.stringify(lu)){
          // Skip persistence if the event row doesn't exist yet (new event still being
          // built in the form). The event's save() will write the lineup once it exists.
          if(!savedEventIds.has(eventId)) return;
          supabase.from('lineups').upsert({event_id:eventId,team_id:tid(),batting:lu.batting||[],positions:lu.positions||{},shared:lu.shared!==false,updated_at:new Date().toISOString()},{onConflict:'event_id'})
            .then(({error})=>{ if(error){ console.error('Lineup FAILED:',error.message); notifySaveError(); } });
        }
      });
      return next;
    });
  };

  const setGamePlansDb = (updater) => {
    setGamePlans(prev => {
      const next = typeof updater==='function' ? updater(prev) : updater;
      if (!tid()) return next;

      const savedEventIds = new Set(eventsRef.current.map(e=>e.id));
      Object.entries(next).forEach(([eventId,gp])=>{
        if(JSON.stringify(prev[eventId])!==JSON.stringify(gp)){
          // Skip persistence if the event row doesn't exist yet — save() handles it later.
          if(!savedEventIds.has(eventId)) return;
          supabase.from('game_plans').upsert({event_id:eventId,team_id:tid(),pitcher:gp.pitcher||'',defense:gp.defense||'',offense:gp.offense||'',notes:gp.notes||'',shared:gp.shared||false,updated_at:new Date().toISOString()},{onConflict:'event_id'})
            .then(({error})=>{ if(error){ console.error('GamePlan FAILED:',error.message); notifySaveError(); } });
        }
      });
      return next;
    });
  };

  const setCustomPlansDb = (updater) => {
    setCustomPlans(prev => {
      const next = typeof updater==='function' ? updater(prev) : updater;
      if (!tid()) return next;

      const prevIds = new Set(prev.map(p=>p.id));
      const nextIds = new Set(next.map(p=>p.id));
      // Inserts
      next.filter(p=>!prevIds.has(p.id)).forEach(p=>{
        supabase.from('custom_plans').insert({
          id:p.id, team_id:tid(), title:p.title||'', focus:p.focus||'',
          age_group:p.ageGroup||'', duration:p.duration||'', blocks:p.blocks||[],
        }).then(({error})=>{ if(error){ console.error('Plan insert FAILED:',error.message); notifySaveError(); } });
      });
      // Updates
      next.filter(p=>prevIds.has(p.id)&&JSON.stringify(prev.find(x=>x.id===p.id))!==JSON.stringify(p)).forEach(p=>{
        supabase.from('custom_plans').update({
          title:p.title||'', focus:p.focus||'', age_group:p.ageGroup||'',
          duration:p.duration||'', blocks:p.blocks||[], updated_at:new Date().toISOString(),
        }).eq('id',p.id).then(({error})=>{ if(error){ console.error('Plan update FAILED:',error.message); notifySaveError(); } });
      });
      // Deletes
      prev.filter(p=>!nextIds.has(p.id)).forEach(p=>{
        supabase.from('custom_plans').delete().eq('id',p.id).then(({error})=>{
          if(error){ console.error('Plan delete FAILED:',error.message); notifySaveError(); }
        });
      });
      return next;
    });
  };

  const handlePlayerPhotoUpload = async (playerId, base64DataUrl) => {
    setPlayerPhotos(prev=>({...prev,[playerId]:base64DataUrl}));
    const teamId = profile?.team_id;
    if (!teamId) return;
    try {
      const res = await fetch(base64DataUrl);
      const blob = await res.blob();
      const ext = (blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');
      const path = `${playerId}.${ext}`;
      const {error} = await supabase.storage.from('player-photos').upload(path, blob, {upsert:true});
      if (error) { console.error('Player photo upload error:', error.message); return; }
      const signed = await signedUrl('player-photos', path);
      if (signed) setPlayerPhotos(prev=>({...prev,[playerId]:signed}));
      await supabase.from('player_photos').upsert({
        player_id:playerId, team_id:teamId, storage_path:path,
        uploaded_by:session?.user?.id||null,
      },{onConflict:'player_id'});
    } catch(err) { console.error('Player photo error:',err); }
  };

  // ── Realtime messages ────────────────────────────────────────────────────
  useEffect(()=>{
    if(!profile?.team_id) return;
    const realtimeCh = supabase.channel('msgs-'+profile.team_id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`team_id=eq.${profile.team_id}`},(payload)=>{
        const m = payload.new;
        const msg = {id:m.id,senderId:m.sender_id,senderName:m.sender_name,text:m.text,ts:new Date(m.created_at).getTime(),attachment:m.payload?.attachment||null};
        setMessages(prev=>{
          const existing = prev[m.channel]||[];
          if(existing.find(e=>e.id===m.id)) return prev;
          return {...prev,[m.channel]:[...existing,msg]};
        });
      }).subscribe();
    return ()=>{ supabase.removeChannel(realtimeCh); };
  },[profile?.team_id]);

  // ── Team logo upload ─────────────────────────────────────────────────────
  const handleTeamLogoChange = async (base64DataUrl) => {
    setTeamLogo(base64DataUrl);
    const teamId = profile?.team_id;
    if (!teamId) return;
    try {
      const res = await fetch(base64DataUrl);
      const blob = await res.blob();
      const ext = (blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');
      const path = `team-logos/${teamId}_${Date.now()}.${ext}`;
      const {error} = await supabase.storage.from('player-photos').upload(path, blob, {upsert:true});
      if (!error) {
        // Store the storage PATH (signed URLs expire; paths do not).
        await supabase.from('teams').update({logo_url:path}).eq('id',teamId);
        const signed = await signedUrl('player-photos', path);
        if (signed) setTeamLogo(signed);
      } else {
        console.error('Logo upload error:',error);
      }
    } catch(err) { console.error('Logo upload error:',err); }
  };

  // ── Team settings save ──────────────────────────────────────────────────
  const handleTeamSettingsSave = async (formData) => {
    const teamId = profile?.team_id;
    if (!teamId) return;
    const {error} = await supabase.from('teams').update({
      name: formData.name,
      age_group: formData.age_group,
      season: formData.season,
      location: formData.location,
      coach_name: formData.coach_name,
      coach_phone: formData.coach_phone,
      coach_email: formData.coach_email,
    }).eq('id', teamId);
    if (error) {
      console.error('Team settings save failed:', error.message);
      toast.error('Couldn\'t save team settings. Please try again.');
      return;
    }
    // Update local state
    if (formData.name) setTeamDisplayName(formData.name);
    setTeamData(prev => ({...prev, ...formData}));
    toast.success('Team settings saved.');
  };

  // ── Subscription ─────────────────────────────────────────────────────────
  const TRIAL_DAYS = 14;
  const [subscription, setSubscription] = useState({status:"trialing",trialStart:Date.now(),plan:"trial"});
  const [subLoaded, setSubLoaded] = useState(false);

  // Load subscription from DB
  useEffect(()=>{
    if(!session?.user?.id || !profile) return;
    supabase.from('subscriptions').select('*').eq('user_id',session.user.id).single()
      .then(({data})=>{
        if(data) {
          setSubscription({
            status:data.status,
            plan:data.plan,
            trialStart:new Date(data.trial_start||data.created_at).getTime(),
            stripeSubId:data.stripe_subscription_id,
            periodEnd:data.current_period_end,
          });
        } else {
          // No sub record yet — create a trial record
          const trialStart = new Date(profile.created_at||Date.now());
          setSubscription({status:"trialing",plan:"trial",trialStart:trialStart.getTime()});
          supabase.from('subscriptions').upsert({
            user_id:session.user.id, team_id:profile.team_id,
            plan:"trial", status:"trialing",
            trial_start:trialStart.toISOString(),
            trial_end:new Date(trialStart.getTime()+TRIAL_DAYS*86400000).toISOString(),
          },{onConflict:'user_id'}).then(({error})=>{if(error)console.error('Trial insert:',error.message);});
        }
        setSubLoaded(true);
      });
  },[session?.user?.id, profile?.id]);

  // Handle ?checkout=success URL param
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    if(params.get('checkout')==='success') {
      setSubscription(prev=>({...prev,status:'active',plan:params.get('plan')||'pro'}));
      setShowUpgrade(true);
      setCheckoutSuccess(true);
      // Clean URL
      window.history.replaceState({},document.title,window.location.pathname);
      // Reload from DB after a short delay (webhook needs time)
      setTimeout(()=>{
        if(session?.user?.id) {
          supabase.from('subscriptions').select('*').eq('user_id',session.user.id).single()
            .then(({data})=>{
              if(data && data.status==='active') setSubscription(prev=>({...prev,status:'active',plan:data.plan}));
            });
        }
      }, 3000);
    }
  },[session?.user?.id]);

  const msLeft = (subscription.trialStart + TRIAL_DAYS*86400000) - Date.now();
  const daysLeft = Math.max(0,Math.ceil(msLeft/86400000));
  const isActive  = subscription.status==="active";
  const isExpired = subscription.status==="expired"||subscription.status==="canceled"||(subscription.status==="trialing"&&daysLeft===0);
  const isTrial   = subscription.status==="trialing"&&daysLeft>0;
  const canAccess = () => { if(isActive) return true; if(isExpired) return false; return true; };
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [tab, setTab]           = useState("home");
  // ── Usage analytics: log which tabs get used (feeds founder Admin panel) ──
  useEffect(()=>{
    if(session?.user?.id && tab) trackUsage(session.user.id, profile?.team_id, "tab:"+tab);
  },[tab, session?.user?.id]);

  const [skipOnboarding, setSkipOnboarding] = useState(false);
  const [selectedPlayer, setSP] = useState(null);
  const [activeChat, setActiveChat] = useState(null);

  const totalUnread = Object.values(unread).reduce((a,b)=>a+(b||0),0);

  const sendMsg = (channelId, text, senderInfo, attachment=null) => {
    const realSenderId = session?.user?.id || senderInfo.id;
    const msg = {id:uid(), senderId:realSenderId, senderName:senderInfo.name, text, ts:Date.now(), attachment};
    setMessages(prev=>({...prev,[channelId]:[...(prev[channelId]||[]),msg]}));
    if(profile?.team_id) {
      supabase.from('messages').insert({
        id:msg.id, team_id:profile.team_id,
        sender_id:realSenderId, sender_name:senderInfo.name,
        channel:channelId, text,
        payload: attachment ? { attachment } : null,
      }).then(({error})=>{
        if(error){ console.error('Message insert',error); toast.error("Message failed to send. Check your connection and try again."); }
        else {
          const isTeam = channelId === 'team';
          const attachLabel = attachment ? (attachment.type==='image' ? ' 📷 Photo' : ` 📎 ${attachment.name}`) : '';
          const title = isTeam ? 'Team Chat' : `Message from ${senderInfo.name}`;
          const body = isTeam ? `${senderInfo.name}: ${(text||attachLabel).substring(0,100)}` : (text||attachLabel).substring(0,100);
          sendPushNotification(profile.team_id, title, body, realSenderId);
        }
      });
    }
  };

  const markRead = channelId => {
    setUnread(prev=>({...prev,[channelId]:0}));
    // Persist to DB
    if(profile?.team_id && session?.user?.id) {
      supabase.from('chat_read_status').upsert({
        user_id: session.user.id,
        team_id: profile.team_id,
        channel: channelId,
        last_read_at: new Date().toISOString(),
      }, {onConflict: 'user_id,channel'}).then(({error})=>{
        if(error) console.error('markRead save failed:', error.message);
      });
    }
  };

  // ── Block & Report ──────────────────────────────────────────────────────
  const blockUser = async (blockedUserId) => {
    const userId = session?.user?.id;
    const teamId = profile?.team_id;
    if(!userId || !teamId || !blockedUserId || userId===blockedUserId) return;
    if(blockedUsers.some(b=>b.userId===userId && b.blockedUserId===blockedUserId)) return; // already blocked
    const entry = {id:uid(), user_id:userId, blocked_user_id:blockedUserId, team_id:teamId};
    setBlockedUsers(prev=>[...prev,{id:entry.id,userId,blockedUserId,teamId}]);
    const {error} = await supabase.from('blocked_users').insert(entry);
    if(error) console.error('Block user failed:', error.message);
  };

  const unblockUser = async (blockedUserId) => {
    const userId = session?.user?.id;
    if(!userId) return;
    setBlockedUsers(prev=>prev.filter(b=>!(b.userId===userId && b.blockedUserId===blockedUserId)));
    await supabase.from('blocked_users').delete().eq('user_id',userId).eq('blocked_user_id',blockedUserId);
  };

  const reportMessage = async (msg, reason) => {
    const userId = session?.user?.id;
    const teamId = profile?.team_id;
    const reporterName = profile?.full_name || 'Unknown';
    if(!userId || !teamId) return;
    const entry = {
      id:uid(), reporter_id:userId, reporter_name:reporterName,
      reported_user_id:msg.senderId, reported_user_name:msg.senderName,
      message_id:msg.id, message_text:(msg.text||'[attachment]').substring(0,500),
      reason, team_id:teamId, resolved:false,
    };
    setChatReports(prev=>[{id:entry.id,reporterId:userId,reporterName,reportedUserId:msg.senderId,reportedUserName:msg.senderName,messageId:msg.id,messageText:entry.message_text,reason,createdAt:new Date().toISOString(),resolved:false},...prev]);
    const {error} = await supabase.from('chat_reports').insert(entry);
    if(error) console.error('Report message failed:', error.message);
  };

  const resolveReport = async (reportId) => {
    setChatReports(prev=>prev.map(r=>r.id===reportId?{...r,resolved:true}:r));
    await supabase.from('chat_reports').update({resolved:true}).eq('id',reportId);
  };

  if (launching) return <LaunchScreen onDone={() => setLaunching(false)} />;

  // Password-recovery: user arrived from the reset email — make them set a new
  // password before anything else.
  if (recoveryMode && session) return (
    <ResetPasswordScreen onDone={()=>{ setRecoveryMode(false); loadProfile(session.user.id); }}/>
  );

  if (loadError) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
      <style>{FONTS}</style>
      <div style={{textAlign:"center",maxWidth:380}}>
        <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:3,color:C.red,marginBottom:12}}>Connection Error</div>
        <div style={{fontSize:14,color:C.textMid,lineHeight:1.7,marginBottom:24}}>{loadError}</div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button onClick={()=>window.location.reload()} className="btn-press" style={{padding:"12px 24px",borderRadius:10,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 4px 16px ${C.red}40`}}>Try Again</button>
          <button onClick={handleSignOut} className="btn-press" style={{padding:"12px 24px",borderRadius:10,background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Sign Out</button>
        </div>
      </div>
    </div>
  );

  if (!authReady) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{FONTS}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:3,color:C.textDim}}>Loading…</div>
        <div style={{fontSize:12,color:C.textDim,marginTop:12}}>If this takes too long, <button onClick={()=>window.location.reload()} style={{background:"none",border:"none",color:C.blue,cursor:"pointer",fontSize:12,fontFamily:"inherit",textDecoration:"underline",padding:0}}>tap here to reload</button></div>
      </div>
    </div>
  );

  if (authReady && session && profile && !dataLoaded) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{FONTS}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:3,color:C.teal,marginBottom:8}}>Loading Team Data…</div>
        <div style={{fontSize:13,color:C.textDim}}>Getting your roster, drills, and schedule</div>
        <div style={{fontSize:12,color:C.textDim,marginTop:16}}>If this takes too long, <button onClick={()=>window.location.reload()} style={{background:"none",border:"none",color:C.blue,cursor:"pointer",fontSize:12,fontFamily:"inherit",textDecoration:"underline",padding:0}}>tap here to reload</button></div>
      </div>
    </div>
  );

  if (!session || !profile) return <LandingPage onAuth={handleAuth}/>;

  const role = profile.role;

  if (role==="parent") {
    const {player, parent} = getParentContext(parentUserId);
    // If no parentUserId yet, show player picker
    if(!parentUserId) {
      const linkedPlayers = players.flatMap(p=>(p.parents||[]).map(par=>({player:p, parentId:par.id, parentName:par.name})));
      // Show full hub UI if not linked to any team
      if(!parentPlayerLink && linkedPlayers.length === 0) {
        return (
          <UnlinkedParentHub
            parentName={profile?.full_name || ""}
            parentEmail={session?.user?.email || ""}
            parentId={session?.user?.id || ""}
            onSignOut={handleSignOut}
            customDrills={customDrills}
          />
        );
      }
      return (
        <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
          <style>{FONTS}</style>
          <div style={{background:C.card,borderRadius:20,border:`1px solid ${C.border}`,padding:"28px 24px",width:"100%",maxWidth:360}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:3,color:C.textDim,textTransform:"uppercase",marginBottom:16,textAlign:"center"}}>SELECT YOUR PLAYER</div>
            {parentPlayerLink
              ? <div style={{textAlign:"center",padding:"16px 0",color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontSize:13}}>Loading your player…</div>
              : linkedPlayers.map(({player:p, parentId})=>(
                <button key={p.id} onClick={()=>setPUID(parentId)}
                  style={{display:"block",width:"100%",padding:"14px 18px",marginBottom:10,background:"transparent",border:`2px solid ${C.gold}60`,borderRadius:12,color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:16,letterSpacing:1,cursor:"pointer",textAlign:"left"}}>
                  ⚾ {p.name} <span style={{color:C.textDim,fontSize:12}}>({p.position})</span>
                </button>
              ))
            }
            <button onClick={handleSignOut} style={{display:"block",width:"100%",marginTop:8,background:"none",border:"none",color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontSize:13,cursor:"pointer",padding:"8px 0"}}>← Sign out</button>
          </div>
        </div>
      );
    }
    const myAsgn = assignments.filter(a=>a.playerId===player?.id);
    // Find this parent's matching entry in parents_info to get the right DM channel
    const myParentEntry = player?.parents?.find(par => par.email && session?.user?.email && par.email.toLowerCase() === session.user.email.toLowerCase());
    const myDmChannel = myParentEntry ? `dm-${myParentEntry.id}` : `dm-${player?.parents?.[0]?.id || player?.id}`;
    const myChannels = ["team", myDmChannel];
    const myUnread   = myChannels.reduce((a,c)=>a+(unread[c]||0),0);
    return (
      <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif"}}>
        <style>{FONTS}</style>
        <OfflineBanner online={online} cacheAge={cacheAge}/>
        <TopBar
          title={activeChat ? (activeChat==="team"?"Team Chat": "Messages") : (player?.name||"My Player")}
          sub={activeChat ? null : `${parent?.name||"Parent"} · Parent View`}
          backLabel={activeChat ? "Chat" : "Sign Out"}
          onBack={activeChat ? ()=>setActiveChat(null) : handleSignOut}
        />
        {activeChat
          ? <ChatView online={online} channelId={activeChat} messages={messages[activeChat]||[]} onSend={(t,att)=>sendMsg(activeChat,t,{id:parentUserId,name:parent?.name||"Parent"},att)} myId={parentUserId} onOpen={()=>markRead(activeChat)} players={players} teamLogo={teamLogo} teamName={teamDisplayName} teamId={profile?.team_id} blockedUsers={blockedUsers} onBlock={blockUser} onUnblock={unblockUser} onReport={reportMessage}/>
          : <ParentView onSupport={()=>setShowSupport(true)} player={player} parent={parent} assignments={myAsgn} events={events} setAsgn={setAsgnDb} unread={myUnread} onOpenChat={(ch)=>{setActiveChat(ch);markRead(ch);}} parentUserId={parentUserId} dmChannel={myDmChannel} drillVideos={drillVideos} skillSnapshots={skillSnapshots} playerVideos={playerVideos} setPlayerVideos={setPlayerVideos} gamePlans={gamePlans} lineups={lineups} players={players} playerPhotos={playerPhotos} setPlayerPhotos={setPlayerPhotos} onPhotoUpload={handlePlayerPhotoUpload} teamLogo={teamLogo} teamName={teamDisplayName} canAccess={canAccess} customDrills={customDrills}/>
        }
        {showSupport && <SupportModal session={session} profile={profile} onClose={()=>setShowSupport(false)}/>}
      </div>
    );
  }

  // Coach
  const needsOnboarding = role==="coach" && dataLoaded && players.length===0 && !skipOnboarding;
  const goToPlayer = p => {setSP(p); setTab("player");};

  if (needsOnboarding) return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif"}}>
      <style>{FONTS}</style>
      <ErrorBoundary>
        <OnboardingFlow
          coachName={profile?.full_name||"Coach"}
          teamName={teamDisplayName}
          teamId={profile?.team_id}
          setPlayers={setPlayersDb}
          setAsgn={setAsgnDb}
          onSkip={()=>setSkipOnboarding(true)}
          onComplete={()=>setSkipOnboarding(true)}
        />
      </ErrorBoundary>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",paddingBottom:"calc(72px + env(safe-area-inset-bottom))"}}>

      <style>{FONTS}</style>
      <OfflineBanner online={online} cacheAge={cacheAge}/>
      <TopBar
        title={activeChat ? (activeChat==="team"?"Team Chat": (()=>{
          const chId = activeChat.replace('dm-','');
          for(const pl of players) {
            const par = (pl.parents||[]).find(p=>p.id===chId);
            if(par) return par.name || pl.name;
          }
          return "Direct Message";
        })()) : (tab==="player"&&selectedPlayer ? selectedPlayer.name : "CoachConnect Pro")}
        sub={activeChat ? null : (tab==="player"&&selectedPlayer ? selectedPlayer.position : "Coach Dashboard")}
        onBack={activeChat ? ()=>setActiveChat(null) : (tab==="player" ? ()=>setTab("roster") : null)}
        onLogout={(!activeChat&&tab!=="player") ? handleSignOut : null}
        trialBadge={isTrial ? daysLeft : null}
        onUpgrade={!isActive ? ()=>setShowUpgrade(true) : null}
      />

      {/* Trial / expired banner — personalized: shows the coach what THEY built and what locks */}
      {isTrial && daysLeft <= 5 && !showUpgrade && (()=>{
        const urgent = daysLeft <= 3;
        const upcomingGames = (events||[]).filter(e => e.date >= new Date().toISOString().slice(0,10)).length;
        const built = [];
        if((players||[]).length > 0) built.push(`your ${players.length}-player roster`);
        if(upcomingGames > 0) built.push(`${upcomingGames} upcoming event${upcomingGames!==1?"s":""}`);
        if((players||[]).length > 0) built.push("season stats");
        const stakes = built.length
          ? `${built.join(", ").replace(/, ([^,]*)$/, " and $1")} ${urgent ? "— Drills, Practice Plans, Lineups & Scorebook lock when the trial ends. Roster, schedule & chat stay free." : "are all set up. Keep the momentum going."}`
          : (urgent ? "Drills, Practice Plans, Lineups & Scorebook lock when the trial ends. Roster, schedule & chat stay free." : "Upgrade to keep full access after your trial ends.");
        return (
          <div style={{background:urgent?`linear-gradient(90deg,${C.red}30,${C.red}15)`:`linear-gradient(90deg,${C.gold}20,${C.gold}0c)`,borderBottom:`1px solid ${urgent?C.red+"60":C.gold+"40"}`,padding:urgent?"12px 16px":"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:1.5,color:urgent?C.red:C.gold,textTransform:"uppercase"}}>
                {urgent ? `⏳ Only ${daysLeft} day${daysLeft!==1?"s":""} left in your trial` : `⏳ ${daysLeft} day${daysLeft!==1?"s":""} left in your trial`}
              </div>
              <div style={{fontSize:12,color:C.textMid,marginTop:1,lineHeight:1.45}}>{stakes.charAt(0).toUpperCase()+stakes.slice(1)}</div>
            </div>
            <button onClick={()=>setShowUpgrade(true)} style={{padding:"8px 16px",borderRadius:9,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",boxShadow:`0 4px 12px ${C.red}40`}}>{urgent?"Keep My Team →":"Upgrade"}</button>
          </div>
        );
      })()}
      {isExpired && !showUpgrade && (
        <div style={{background:`linear-gradient(90deg,#1a0808,${C.card})`,borderBottom:`1px solid ${C.red}60`,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.red,textTransform:"uppercase"}}>🔒 Trial Ended</div>
            <div style={{fontSize:12,color:C.textMid,marginTop:1}}>Drills, Progress, Practice Plans, Lineups & Scorebook are locked. Roster, schedule & chat stay free. Upgrade to restore full access.</div>
            <button onClick={openBillingPortal} style={{background:"none",border:"none",color:C.textDim,fontSize:11,textDecoration:"underline",cursor:"pointer",padding:"4px 0 0",fontFamily:"Plus Jakarta Sans, sans-serif"}}>Manage subscription</button>
          </div>
          <button onClick={()=>setShowUpgrade(true)} style={{padding:"8px 16px",borderRadius:9,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",boxShadow:`0 4px 12px ${C.red}40`}}>Unlock Now</button>
        </div>
      )}

      {/* Upgrade modal overlay */}
      {showUpgrade && (
        <UpgradeScreen
          daysLeft={daysLeft}
          isTrial={isTrial}
          isExpired={isExpired}
          onClose={()=>setShowUpgrade(false)}
          onSubscribe={()=>{ setSubscription(prev=>({...prev,status:"active"})); setShowUpgrade(false); setCheckoutSuccess(false); }}
          session={session}
          initialSuccess={checkoutSuccess}
        />
      )}

      {activeChat
        ? <ChatView online={online} channelId={activeChat} messages={messages[activeChat]||[]} onSend={(t,att)=>sendMsg(activeChat,t,{id:session?.user?.id||'coach',name:profile?.full_name||"Coach"},att)} myId={session?.user?.id||'coach'} onOpen={()=>markRead(activeChat)} players={players} teamLogo={teamLogo} onTeamLogoChange={handleTeamLogoChange} teamName={teamDisplayName} teamId={profile?.team_id} blockedUsers={blockedUsers} onBlock={blockUser} onUnblock={unblockUser} onReport={reportMessage}/>
        : (
          <div style={{padding:"20px 14px",maxWidth:640,margin:"0 auto"}}>
            {tab==="home"     && <CoachHome onSupport={()=>setShowSupport(true)} players={players} assignments={assignments} events={events} customPlans={customPlans} goToPlayer={goToPlayer} setTab={setTab} teamLogo={teamLogo} onTeamLogoChange={handleTeamLogoChange} teamName={teamDisplayName} playerVideos={playerVideos} teamData={teamData} onTeamSettingsSave={handleTeamSettingsSave} chatReports={chatReports} onResolveReport={resolveReport} canAccess={canAccess} onUpgrade={()=>setShowUpgrade(true)}/>}
            {tab==="roster"   && <Roster players={players} setPlayers={setPlayersDb} goToPlayer={goToPlayer} playerPhotos={playerPhotos} teamId={profile?.team_id}/>}
            {tab==="drills"   && <AssignDrills players={players} assignments={assignments} setAsgn={setAsgnDb} drillVideos={drillVideos} setDrillVideos={setDrillVideos} canAccess={canAccess} onUpgrade={()=>setShowUpgrade(true)} playerVideos={playerVideos} teamId={profile?.team_id} customDrills={customDrills} setCustomDrills={setCustomDrills}/>}
            {tab==="schedule" && <Schedule events={events} setEvents={setEventsDb} gamePlans={gamePlans} setGamePlans={setGamePlansDb} players={players} lineups={lineups} setLineups={setLineupsDb} teamId={profile?.team_id} canAccess={canAccess} session={session} onUpgrade={()=>setShowUpgrade(true)}/>}
            {tab==="plans"    && (canAccess() ? <PracticePlans customPlans={customPlans} setCustomPlans={setCustomPlansDb}/> : <PaywallGate feature="Practice Plans" onUpgrade={()=>setShowUpgrade(true)}/>)}
            {tab==="msgs"     && <MessagesTab players={players} messages={messages} unread={unread} onOpen={(ch)=>{setActiveChat(ch);markRead(ch);}} onBroadcast={(text, channelIds)=>{ channelIds.forEach(ch=>sendMsg(ch, text, {id:session?.user?.id||"coach",name:profile?.full_name||"Coach"})); }} teamLogo={teamLogo} teamName={teamDisplayName}/>}
            {tab==="admin"    && session?.user?.id===FOUNDER_ID && <AdminPanel session={session}/>}
            {tab==="player"   && selectedPlayer && <PlayerDetail player={players.find(p=>p.id===selectedPlayer.id)||selectedPlayer} assignments={assignments} setAsgn={setAsgnDb} setPlayers={setPlayersDb} skillSnapshots={skillSnapshots} setSkillSnapshots={setSnapshotsDb} drillVideos={drillVideos} setDrillVideos={setDrillVideos} playerVideos={playerVideos} setPlayerVideos={setPlayerVideos} playerPhotos={playerPhotos} canAccess={canAccess} onUpgrade={()=>setShowUpgrade(true)} teamId={profile?.team_id} onDelete={()=>setTab("roster")} customDrills={customDrills}/>}
          </div>
        )
      }
      {showSupport && <SupportModal session={session} profile={profile} onClose={()=>setShowSupport(false)}/>}
      <BottomNav tab={tab} setTab={t=>{setActiveChat(null);setTab(t);}} totalUnread={totalUnread} isFounder={session?.user?.id===FOUNDER_ID}/>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastHost/>
      <AppInner/>
    </ErrorBoundary>
  );
}

// ─── TOP BAR ─────────────────────────────────────────────────────────────────
// ─── RESET PASSWORD (arrived via email recovery link) ────────────────────────
function ResetPasswordScreen({onDone}) {
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const save = async () => {
    setError("");
    if(pass1.length < 6){ setError("Password must be at least 6 characters."); return; }
    if(pass1 !== pass2){ setError("Passwords don't match."); return; }
    setSaving(true);
    const {error:err} = await supabase.auth.updateUser({ password: pass1 });
    setSaving(false);
    if(err){ setError(err.message); return; }
    setDone(true);
    setTimeout(onDone, 1200);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
      <style>{FONTS}</style>
      <div style={{background:C.card,borderRadius:20,border:`1px solid ${C.border}`,padding:"28px 24px",width:"100%",maxWidth:380,boxShadow:`0 24px 60px #00000088`,position:"relative"}}>
        <div style={{position:"absolute",top:0,left:24,right:24,height:2,background:`linear-gradient(90deg,transparent,${C.red},${C.gold},transparent)`,borderRadius:2}}/>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,letterSpacing:2,color:C.text,marginBottom:6}}>Set a New Password</div>
        <div style={{fontSize:13,color:C.textMid,lineHeight:1.6,marginBottom:20}}>You're signed in via your reset link. Choose a new password to finish.</div>
        {done ? (
          <div style={{padding:"14px 16px",borderRadius:10,background:`${C.teal}15`,border:`1px solid ${C.teal}50`,color:C.teal,fontSize:13,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1}}>✓ Password updated — taking you to your dashboard…</div>
        ) : (
          <>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{position:"relative"}}>
                <input value={pass1} onChange={e=>setPass1(e.target.value)} placeholder="New password" type={show?"text":"password"} style={{...inp,paddingRight:44}}/>
                <button onClick={()=>setShow(x=>!x)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:14,padding:4}}>{show?"🙈":"👁"}</button>
              </div>
              <input value={pass2} onChange={e=>setPass2(e.target.value)} placeholder="Confirm new password" type={show?"text":"password"} style={inp}
                onKeyDown={e=>e.key==="Enter"&&save()}/>
            </div>
            {error&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:9,background:`${C.red}15`,border:`1px solid ${C.red}40`,fontSize:12,color:"#ff8080"}}>{error}</div>}
            <button onClick={save} disabled={saving||!pass1||!pass2} style={{width:"100%",marginTop:20,padding:"15px 0",borderRadius:12,background:saving?C.card:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:saving?C.textDim:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:2,textTransform:"uppercase",cursor:saving?"not-allowed":"pointer",minHeight:52}}>
              {saving?"Saving…":"Save New Password →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TopBar({title,sub,onBack,backLabel,onLogout,trialBadge,onUpgrade}) {
  return (
    <header style={{position:"sticky",top:0,zIndex:200,background:`${C.bg}ee`,backdropFilter:"blur(16px)",borderBottom:`1px solid ${C.border}`,padding:"0 12px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.red}60,transparent)`}}/>
      {/* Left side — logo + title, allow shrink */}
      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:1,overflow:"hidden"}}>
        {onBack
          ? <button onClick={onBack} style={{background:"none",border:"none",color:C.red,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:1,cursor:"pointer",padding:"4px 0",minHeight:44,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",flexShrink:0}}>‹ {backLabel||"Back"}</button>
          : <div style={{borderRadius:11,padding:2,background:`linear-gradient(135deg,${C.red},${C.gold})`,boxShadow:`0 0 14px ${C.red}66, 0 2px 8px rgba(0,0,0,0.5)`,flexShrink:0,display:"flex"}}>
              <div style={{width:36,height:36,borderRadius:9,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <img src={LOGO} alt="logo" style={{width:30,height:30,objectFit:"contain"}}/>
              </div>
            </div>
        }
        <div style={{minWidth:0,overflow:"hidden"}}>
          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:17,letterSpacing:1.5,color:C.text,lineHeight:1.1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div>
          {sub&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:9,letterSpacing:2,color:C.red,textTransform:"uppercase",whiteSpace:"nowrap"}}>{sub}</div>}
        </div>
      </div>
      {/* Right side — fixed width, never shrinks */}
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        {trialBadge!==null&&trialBadge!==undefined&&(
          <button onClick={onUpgrade} style={{padding:"5px 8px",borderRadius:8,background:trialBadge<=3?`${C.red}25`:`${C.gold}18`,border:`1px solid ${trialBadge<=3?C.red+"60":C.gold+"50"}`,color:trialBadge<=3?C.red:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap"}}>
            {trialBadge}d trial
          </button>
        )}
        {onLogout&&(
          <button onClick={onLogout} title="Sign out" aria-label="Sign out" style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,height:36,padding:"0 10px",display:"flex",alignItems:"center",justifyContent:"center",gap:5,color:C.textMid,cursor:"pointer",flexShrink:0,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.2,textTransform:"uppercase",whiteSpace:"nowrap"}}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}

// ─── BOTTOM NAV ──────────────────────────────────────────────────────────────

// Resize/compress an image File to a JPEG blob so support-screenshot uploads stay small
function compressImage(file, maxDim=1400, quality=0.8){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      let width=img.width, height=img.height;
      if(width>maxDim||height>maxDim){
        if(width>=height){ height=Math.round(height*maxDim/width); width=maxDim; }
        else { width=Math.round(width*maxDim/height); height=maxDim; }
      }
      const canvas=document.createElement("canvas");
      canvas.width=width; canvas.height=height;
      canvas.getContext("2d").drawImage(img,0,0,width,height);
      canvas.toBlob(b=>{ b?resolve(b):reject(new Error("compress failed")); }, "image/jpeg", quality);
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("image load failed")); };
    img.src=url;
  });
}

// ─── SUPPORT MODAL (users send help requests to the founder inbox) ───────────
function SupportModal({session, profile, onClose}) {
  const [subject,setSubject]=useState("");
  const [message,setMessage]=useState("");
  const [sending,setSending]=useState(false);
  const [done,setDone]=useState(false);
  const [shots,setShots]=useState([]); // {id, preview, url, uploading, error}
  const uid = session?.user?.id;
  const addFiles = async (fileList) => {
    const files = Array.from(fileList||[]).slice(0, 3 - shots.length);
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const id = randomToken(10);
      const preview = URL.createObjectURL(file);
      setShots(prev=>[...prev,{id,preview,url:null,uploading:true,error:false}]);
      try {
        const blob = await compressImage(file);
        const path = `${uid||"anon"}_${Date.now()}_${id}.jpg`;
        const {error} = await supabase.storage.from("support-screenshots").upload(path, blob, {upsert:true, contentType:"image/jpeg"});
        if (error) throw error;
        // Store the storage PATH on the ticket; the admin view signs it to display.
        setShots(prev=>prev.map(s=>s.id===id?{...s,url:path,uploading:false}:s));
      } catch(err) {
        console.error("screenshot upload failed", err);
        setShots(prev=>prev.map(s=>s.id===id?{...s,uploading:false,error:true}:s));
      }
    }
  };
  const removeShot = (id) => setShots(prev=>prev.filter(s=>s.id!==id));
  const anyUploading = shots.some(s=>s.uploading);
  const submit=async()=>{
    if(!subject.trim()||!message.trim())return;
    setSending(true);
    try{
      const {error}=await supabase.from("support_tickets").insert({
        user_id:session?.user?.id, team_id:profile?.team_id||null,
        email:session?.user?.email||"", name:profile?.full_name||"",
        subject:subject.trim(), message:message.trim(),
        screenshot_urls: shots.filter(s=>s.url).map(s=>s.url)
      });
      if(error)throw error;
      // Notify the founder's devices — fire and forget
      supabase.functions.invoke("send-notification", { body: {
        user_id: FOUNDER_ID,
        title: "New Support Ticket",
        body: (profile?.full_name||session?.user?.email||"Someone") + ": " + subject.trim(),
        tag: "support",
        url: "/"
      }}).catch(()=>{});
      setDone(true);
    }catch(e){ console.error("support ticket failed", e); }
    setSending(false);
  };
  const inpStyle={width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:C.cardAlt,color:C.text,fontSize:14,outline:"none",boxSizing:"border-box"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:500,background:C.bg,borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",border:`1px solid ${C.border}`,borderBottom:"none"}}>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,letterSpacing:3,color:C.text,marginBottom:4}}>Help & Support</div>
        {done ? (
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{color:C.text,fontSize:15,marginBottom:6,fontWeight:600}}>Message sent!</div>
            <div style={{color:C.textMid,fontSize:13,marginBottom:18}}>We'll get back to you at {session?.user?.email||"your email"} as soon as possible.</div>
            <button onClick={onClose} style={{padding:"12px 28px",borderRadius:10,border:"none",background:C.red,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>Done</button>
          </div>
        ) : (
          <>
            <div style={{color:C.textMid,fontSize:13,marginBottom:16}}>Found a bug? Have a question? Send us a message and we'll reply by email.</div>
            <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="What do you need help with?" style={{...inpStyle,marginBottom:10}}/>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tell us what's going on..." rows={5} style={{...inpStyle,resize:"vertical",marginBottom:14,fontFamily:"inherit"}}/>
            {/* Screenshot attachments (optional) */}
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:shots.length?10:0}}>
                {shots.map(s=>(
                  <div key={s.id} style={{position:"relative",width:64,height:64,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`,background:C.cardAlt}}>
                    <img src={s.preview} alt="" style={{width:"100%",height:"100%",objectFit:"cover",opacity:s.uploading?0.4:1}}/>
                    {s.uploading && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.text}}>…</div>}
                    {s.error && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:C.red,textAlign:"center",padding:2}}>failed</div>}
                    <button onClick={()=>removeShot(s.id)} style={{position:"absolute",top:2,right:2,width:18,height:18,borderRadius:9,border:"none",background:"rgba(0,0,0,0.7)",color:"#fff",fontSize:13,lineHeight:"18px",padding:0,cursor:"pointer"}}>×</button>
                  </div>
                ))}
              </div>
              {shots.length<3 && (
                <label style={{display:"inline-flex",alignItems:"center",gap:7,padding:"9px 14px",borderRadius:9,border:`1px dashed ${C.border}`,background:"transparent",color:C.textMid,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Add screenshot
                  <input type="file" accept="image/*" multiple onChange={e=>{addFiles(e.target.files); e.target.value="";}} style={{display:"none"}}/>
                </label>
              )}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={submit} disabled={sending||anyUploading||!subject.trim()||!message.trim()} style={{flex:1,padding:"13px",borderRadius:10,border:"none",background:(sending||anyUploading)?C.textDim:C.red,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",opacity:(!subject.trim()||!message.trim())?0.5:1}}>{sending?"Sending...":anyUploading?"Uploading…":"Send Message"}</button>
              <button onClick={onClose} style={{padding:"13px 18px",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.textMid,fontWeight:600,fontSize:14,cursor:"pointer"}}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── FOUNDER ADMIN PANEL (usage analytics + support inbox) ───────────────────
function AdminPanel({session}) {
  const [events,setEvents]=useState([]);
  const [tickets,setTickets]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showResolved,setShowResolved]=useState(false);
  const load=async()=>{
    setLoading(true);
    const since=new Date(Date.now()-30*864e5).toISOString();
    const [ev,tk]=await Promise.all([
      supabase.from("usage_events").select("feature,user_id,created_at").gte("created_at",since).order("created_at",{ascending:false}).limit(5000),
      supabase.from("support_tickets").select("*").order("created_at",{ascending:false}).limit(200)
    ]);
    setEvents(ev.data||[]); setTickets(tk.data||[]); setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const day=864e5, now=Date.now();
  const in7=events.filter(e=>now-new Date(e.created_at).getTime()<7*day);
  const todayStr=new Date().toDateString();
  const todayEv=events.filter(e=>new Date(e.created_at).toDateString()===todayStr);
  const uniq=a=>new Set(a.map(e=>e.user_id)).size;
  const featCounts={};
  in7.forEach(e=>{featCounts[e.feature]=(featCounts[e.feature]||0)+1;});
  const feats=Object.entries(featCounts).sort((a,b)=>b[1]-a[1]);
  const maxCount=feats.length?feats[0][1]:1;
  const KNOWN=["tab:home","tab:roster","tab:drills","tab:schedule","tab:plans","tab:msgs"];
  const unused=KNOWN.filter(k=>!featCounts[k]);
  const open=tickets.filter(t=>t.status==="open");
  const resolved=tickets.filter(t=>t.status==="resolved");
  const label=f=>f.replace("tab:","").replace(/^\w/,c=>c.toUpperCase());
  const resolve=async(t)=>{
    await supabase.from("support_tickets").update({status:"resolved",resolved_at:new Date().toISOString()}).eq("id",t.id);
    setTickets(prev=>prev.map(x=>x.id===t.id?{...x,status:"resolved"}:x));
  };
  const reopen=async(t)=>{
    await supabase.from("support_tickets").update({status:"open",resolved_at:null}).eq("id",t.id);
    setTickets(prev=>prev.map(x=>x.id===t.id?{...x,status:"open"}:x));
  };
  const Stat=({label,value,color})=>(
    <div style={{flex:1,minWidth:70,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 10px",textAlign:"center"}}>
      <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:26,color:color||C.text,lineHeight:1}}>{value}</div>
      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:10,letterSpacing:1,color:C.textDim,textTransform:"uppercase",marginTop:4}}>{label}</div>
    </div>
  );
  const TicketCard=({t})=>(
    <div style={{background:C.card,border:`1px solid ${t.status==="open"?C.gold+"55":C.border}`,borderRadius:14,padding:"14px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
        <div style={{fontWeight:700,fontSize:14,color:C.text}}>{t.subject}</div>
        <div style={{fontSize:10,color:C.textDim,whiteSpace:"nowrap"}}>{new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</div>
      </div>
      <div style={{fontSize:12,color:C.textMid,marginBottom:8}}>{t.name||"Unknown"} · {t.email||"no email"}</div>
      <div style={{fontSize:13,color:C.text,lineHeight:1.5,marginBottom:12,whiteSpace:"pre-wrap"}}>{t.message}</div>
      {Array.isArray(t.screenshot_urls) && t.screenshot_urls.length>0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
          {t.screenshot_urls.map((u,i)=>(
            <SignedMedia key={i} bucket="support-screenshots" pathOrUrl={u}>
              {url=>(
                <a href={url} target="_blank" rel="noreferrer" style={{display:"block",width:72,height:72,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
                  <img src={url} alt={"screenshot "+(i+1)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                </a>
              )}
            </SignedMedia>
          ))}
        </div>
      )}
      <div style={{display:"flex",gap:8}}>
        {t.email && <a href={`mailto:${t.email}?subject=${encodeURIComponent("Re: "+t.subject+" — CoachConnect Pro Support")}`} style={{flex:1,textAlign:"center",padding:"10px",borderRadius:9,background:`${C.blue}22`,border:`1px solid ${C.blue}55`,color:C.blue,fontWeight:700,fontSize:12,textDecoration:"none"}}>Reply by Email</a>}
        {t.status==="open"
          ? <button onClick={()=>resolve(t)} style={{flex:1,padding:"10px",borderRadius:9,background:`${C.teal}22`,border:`1px solid ${C.teal}55`,color:C.teal,fontWeight:700,fontSize:12,cursor:"pointer"}}>Mark Resolved</button>
          : <button onClick={()=>reopen(t)} style={{flex:1,padding:"10px",borderRadius:9,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontWeight:700,fontSize:12,cursor:"pointer"}}>Reopen</button>}
      </div>
    </div>
  );
  return (
    <div style={{paddingBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:2,color:C.text}}>Founder Dashboard</div>
        <button onClick={load} style={{padding:"8px 14px",borderRadius:9,border:`1px solid ${C.border}`,background:C.card,color:C.textMid,fontSize:12,fontWeight:700,cursor:"pointer"}}>{loading?"...":"Refresh"}</button>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        <Stat label="Active Today" value={uniq(todayEv)} color={C.teal}/>
        <Stat label="Active 7d" value={uniq(in7)} color={C.blue}/>
        <Stat label="Events 7d" value={in7.length}/>
        <Stat label="Open Tickets" value={open.length} color={open.length?C.gold:C.text}/>
      </div>

      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:12,letterSpacing:2,color:C.textDim,textTransform:"uppercase",marginBottom:8}}>Feature Usage — Last 7 Days</div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:10}}>
        {feats.length===0 && <div style={{color:C.textDim,fontSize:13,textAlign:"center",padding:"10px 0"}}>{loading?"Loading...":"No usage data yet — it starts collecting now."}</div>}
        {feats.map(([f,n])=>(
          <div key={f} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{color:C.text,fontWeight:600}}>{label(f)}</span>
              <span style={{color:C.textDim}}>{n}</span>
            </div>
            <div style={{height:6,borderRadius:3,background:C.cardAlt,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.max(4,(n/maxCount)*100)}%`,borderRadius:3,background:`linear-gradient(90deg,${C.red},${C.gold})`}}/>
            </div>
          </div>
        ))}
      </div>
      {unused.length>0 && (
        <div style={{background:`${C.gold}10`,border:`1px solid ${C.gold}33`,borderRadius:12,padding:"10px 14px",marginBottom:18,fontSize:12,color:C.textMid}}>
          <span style={{color:C.gold,fontWeight:700}}>Not used this week:</span> {unused.map(label).join(", ")}
        </div>
      )}

      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:12,letterSpacing:2,color:C.textDim,textTransform:"uppercase",marginBottom:8}}>Support Inbox {open.length>0&&`(${open.length} open)`}</div>
      {open.length===0 && <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px",textAlign:"center",color:C.textDim,fontSize:13,marginBottom:10}}>{loading?"Loading...":"No open tickets — inbox zero!"}</div>}
      {open.map(t=><TicketCard key={t.id} t={t}/>)}
      {resolved.length>0 && (
        <>
          <button onClick={()=>setShowResolved(v=>!v)} style={{width:"100%",padding:"10px",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.textDim,fontSize:12,fontWeight:700,cursor:"pointer",marginBottom:10}}>
            {showResolved?"Hide":"Show"} {resolved.length} resolved
          </button>
          {showResolved && resolved.map(t=><TicketCard key={t.id} t={t}/>)}
        </>
      )}
    </div>
  );
}

// ─── NAV ICONS (clean line style) ────────────────────────────────────────────
function NavIcon({id, size=20}) {
  const p = {fill:"none", stroke:"currentColor", strokeWidth:2, strokeLinecap:"round", strokeLinejoin:"round"};
  const icons = {
    home:     <><path {...p} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline {...p} points="9 22 9 12 15 12 15 22"/></>,
    roster:   <><path {...p} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle {...p} cx="9" cy="7" r="4"/><path {...p} d="M23 21v-2a4 4 0 0 0-3-3.87"/><path {...p} d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    schedule: <><rect {...p} x="3" y="4" width="18" height="18" rx="2"/><line {...p} x1="16" y1="2" x2="16" y2="6"/><line {...p} x1="8" y1="2" x2="8" y2="6"/><line {...p} x1="3" y1="10" x2="21" y2="10"/></>,
    drills:   <><path {...p} d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect {...p} x="8" y="2" width="8" height="4" rx="1"/><line {...p} x1="12" y1="11" x2="16" y2="11"/><line {...p} x1="12" y1="16" x2="16" y2="16"/><line {...p} x1="8" y1="11" x2="8.01" y2="11"/><line {...p} x1="8" y1="16" x2="8.01" y2="16"/></>,
    plans:    <><path {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline {...p} points="14 2 14 8 20 8"/><line {...p} x1="16" y1="13" x2="8" y2="13"/><line {...p} x1="16" y1="17" x2="8" y2="17"/></>,
    msgs:     <path {...p} d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8z"/>,
    admin:    <><line {...p} x1="18" y1="20" x2="18" y2="10"/><line {...p} x1="12" y1="20" x2="12" y2="4"/><line {...p} x1="6" y1="20" x2="6" y2="14"/></>,
    report:   <><path {...p} d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect {...p} x="8" y="2" width="8" height="4" rx="1"/><line {...p} x1="9" y1="12" x2="15" y2="12"/><line {...p} x1="9" y1="16" x2="13" y2="16"/></>,
    stats:    <><line {...p} x1="18" y1="20" x2="18" y2="10"/><line {...p} x1="12" y1="20" x2="12" y2="4"/><line {...p} x1="6" y1="20" x2="6" y2="14"/></>,
    baseball: <><circle {...p} cx="12" cy="12" r="10"/><path {...p} d="M6.2 4.5a14.5 14.5 0 0 1 0 15"/><path {...p} d="M17.8 4.5a14.5 14.5 0 0 0 0 15"/></>,
    library:  <><path {...p} d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path {...p} d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
    play:     <><circle {...p} cx="12" cy="12" r="10"/><polygon {...p} points="10 8 16 12 10 16 10 8"/></>,
    lock:     <><rect {...p} x="3" y="11" width="18" height="11" rx="2"/><path {...p} d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    clock:    <><circle {...p} cx="12" cy="12" r="10"/><polyline {...p} points="12 6 12 12 16 14"/></>,
    flame:    <path {...p} d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>,
    tag:      <><path {...p} d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><line {...p} x1="7" y1="7" x2="7.01" y2="7"/></>,
    check:    <polyline {...p} points="20 6 9 17 4 12"/>,
    flag:     <><path {...p} d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line {...p} x1="4" y1="22" x2="4" y2="15"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24">{icons[id]||null}</svg>;
}

function BottomNav({tab,setTab,totalUnread,isFounder=false}) {
  const items = [
    {id:"home",     label:"Home"},
    {id:"roster",   label:"Roster"},
    {id:"schedule", label:"Schedule"},
    {id:"drills",   label:"Drills"},
    {id:"plans",    label:"Practice"},
    {id:"msgs",     label:"Chat"},
  ];
  if(isFounder) items.push({id:"admin", label:"Admin"});

  return (
    <nav style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:`${C.bg}f2`,backdropFilter:"blur(20px)",borderTop:`1px solid ${C.border}`,display:"flex",paddingBottom:"env(safe-area-inset-bottom)",height:"calc(66px + env(safe-area-inset-bottom))"}}>

      <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`}}/>
      {items.map(item => {
        const active = tab===item.id||(tab==="player"&&item.id==="roster");
        const badge  = item.id==="msgs" && totalUnread>0;
        return (
          <button key={item.id} onClick={()=>setTab(item.id)}
            className="nav-item"
            style={{flex:1,background:"none",border:"none",color:active?C.red:C.textDim,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,cursor:"pointer",position:"relative",transition:"color 0.15s,transform 0.15s"}}>
            {active&&<div style={{position:"absolute",top:0,left:"10%",right:"10%",height:2,background:`linear-gradient(90deg,transparent,${C.red},transparent)`,borderRadius:"0 0 4px 4px"}}/>}
            <div style={{position:"relative"}}>
              <span style={{filter:active?`drop-shadow(0 0 8px ${C.red}bb)`:"none",transition:"filter 0.2s",transform:active?"scale(1.1)":"scale(1)",display:"inline-flex"}}><NavIcon id={item.id}/></span>
              {badge&&<div className="badge-pulse" style={{position:"absolute",top:-4,right:-6,width:16,height:16,borderRadius:"50%",background:C.red,border:`2px solid ${C.bg}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:8,color:"#fff"}}>{totalUnread>9?"9+":totalUnread}</div>}
            </div>
            <span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:8,letterSpacing:1,textTransform:"uppercase"}}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── REVIEWS SECTION ────────────────────────────────────────────────────────
function ReviewsSection() {
  const [reviews, setReviews] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('Youth Baseball Coach');
  const [formRating, setFormRating] = useState(5);
  const [formText, setFormText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    supabase.from('reviews').select('*').eq('approved', true).order('created_at', { ascending: false }).limit(10).then(({ data }) => {
      if (data) setReviews(data);
    });
  }, []);

  const handleSubmit = async () => {
    if (!formName.trim() || !formText.trim() || formText.trim().length < 10) return;
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({ name: formName.trim(), role: formRole.trim() || 'Youth Baseball Coach', rating: formRating, review_text: formText.trim() });
    setSubmitting(false);
    if (!error) {
      setSubmitted(true);
      setFormName(''); setFormRole('Youth Baseball Coach'); setFormRating(5); setFormText('');
    }
  };

  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div style={{padding:"60px 20px",maxWidth:800,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:4,color:C.red,textTransform:"uppercase",marginBottom:8}}>What Coaches Are Saying</div>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:38,letterSpacing:2,color:"#fff"}}>Real Reviews From Real Coaches</div>
      </div>

      {reviews.length > 0 ? (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:32}}>
          {reviews.map(r => (
            <div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"24px 20px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.gold},${C.red})`}}/>
              <div style={{color:C.gold,fontSize:18,letterSpacing:2,marginBottom:12}}>{stars(r.rating)}</div>
              <div style={{fontSize:14,color:C.textMid,lineHeight:1.7,fontStyle:"italic",marginBottom:16}}>"{r.review_text}"</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${C.red}40,${C.gold}40)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Bebas Neue, sans-serif",fontSize:16,color:"#fff"}}>{r.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:14,color:"#fff"}}>{r.name}</div>
                  <div style={{fontSize:11,color:C.textDim}}>{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{textAlign:"center",padding:"40px 20px",background:C.card,borderRadius:18,border:`1px solid ${C.border}`,marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:12}}>⚾</div>
          <div style={{fontSize:15,color:C.textMid,lineHeight:1.7}}>Be the first coach to leave a review!</div>
        </div>
      )}

      <div style={{textAlign:"center"}}>
        {!showForm && !submitted && (
          <button onClick={()=>setShowForm(true)} className="btn-press" style={{padding:"12px 28px",borderRadius:10,background:`${C.gold}20`,border:`1px solid ${C.gold}50`,color:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Leave a Review ✍️</button>
        )}

        {submitted && (
          <div style={{padding:"20px 24px",background:`${C.teal}15`,border:`1px solid ${C.teal}40`,borderRadius:14,maxWidth:400,margin:"0 auto"}}>
            <div style={{fontSize:24,marginBottom:8}}>🎉</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:16,color:C.teal,marginBottom:4}}>Thank You!</div>
            <div style={{fontSize:13,color:C.textMid}}>Your review has been submitted and will appear after approval.</div>
          </div>
        )}

        {showForm && !submitted && (
          <div style={{maxWidth:440,margin:"0 auto",background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"28px 24px",textAlign:"left",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.gold},${C.red})`}}/>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:1,color:"#fff",marginBottom:20,textAlign:"center"}}>Share Your Experience</div>
            <div style={{marginBottom:14}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,color:C.textDim,textTransform:"uppercase",marginBottom:6}}>Your Name *</div>
              <input value={formName} onChange={e=>setFormName(e.target.value)} placeholder="Coach Mike" style={{width:"100%",padding:"10px 14px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,color:C.textDim,textTransform:"uppercase",marginBottom:6}}>Role / Title</div>
              <input value={formRole} onChange={e=>setFormRole(e.target.value)} placeholder="Youth Baseball Coach" style={{width:"100%",padding:"10px 14px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,color:C.textDim,textTransform:"uppercase",marginBottom:6}}>Rating</div>
              <div style={{display:"flex",gap:6}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>setFormRating(n)} style={{fontSize:28,background:"none",border:"none",cursor:"pointer",color:n<=formRating?C.gold:C.border,padding:0}}>★</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,color:C.textDim,textTransform:"uppercase",marginBottom:6}}>Your Review * <span style={{fontWeight:400,textTransform:"none"}}>(10-500 characters)</span></div>
              <textarea value={formText} onChange={e=>setFormText(e.target.value)} placeholder="Tell other coaches what you think..." rows={4} style={{width:"100%",padding:"10px 14px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:"#fff",fontSize:14,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
              <div style={{fontSize:11,color:C.textDim,marginTop:4,textAlign:"right"}}>{formText.length}/500</div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"12px",borderRadius:10,background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>Cancel</button>
              <button onClick={handleSubmit} disabled={submitting || !formName.trim() || formText.trim().length < 10} className="btn-press" style={{flex:2,padding:"12px",borderRadius:10,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",opacity:submitting||!formName.trim()||formText.trim().length<10?0.5:1}}>{submitting?'Submitting...':'Submit Review'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LANDING PAGE ─────────────────────────────────────────────────────────────
// ─── UNLINKED PARENT HUB ───
// Shown when a parent signs up but hasn't been invited to a team yet.
// Gives them value (free resources, drill library, Positioning Trainer) AND a way
// to invite their coach to sign up.
function UnlinkedParentHub({parentName="", parentEmail="", parentId="", onSignOut, customDrills=[]}) {
  const [view, setView] = useState("home"); // "home" | "drills" | "invite"
  const [coachEmail, setCoachEmail] = useState("");
  const [coachName, setCoachName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const sendInvite = async () => {
    if(!coachEmail.trim() || !coachEmail.includes("@")) {
      setError("Please enter a valid email address for your coach.");
      return;
    }
    setError("");
    setSending(true);
    try {
      const id = uid();
      const {error:dbErr} = await supabase.from("coach_invites").insert({
        id,
        invited_by_parent_id: parentId,
        invited_by_parent_name: parentName,
        invited_by_parent_email: parentEmail,
        coach_email: coachEmail.toLowerCase().trim(),
        coach_name: coachName.trim(),
        team_name: teamName.trim(),
        message: message.trim(),
        status: "pending",
      });
      if(dbErr) throw dbErr;
      // Try to send email via edge function (won't fail the flow if it errors).
      // The function now requires a signed-in caller (it is rate limited and,
      // once RESEND_API_KEY is set, sends real email), so pass the session token.
      try {
        const { data: { session: inviteSession } } = await supabase.auth.getSession();
        await fetch("https://hcadlkmejdekhbgfvyaq.supabase.co/functions/v1/send-coach-invite", {
          method: "POST",
          headers: {
            "Content-Type":"application/json",
            ...(inviteSession ? { Authorization: `Bearer ${inviteSession.access_token}` } : {}),
          },
          body: JSON.stringify({
            invite_id: id,
            coach_email: coachEmail.toLowerCase().trim(),
            coach_name: coachName.trim(),
            parent_name: parentName,
            parent_email: parentEmail,
            team_name: teamName.trim(),
            message: message.trim(),
          })
        });
      } catch(emailErr) { /* email failure shouldn't break flow */ }
      setSent(true);
    } catch(err) {
      setError("Could not send invite right now. Try again in a moment.");
    } finally {
      setSending(false);
    }
  };

  // Header (shared across views)
  const Header = () => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {view!=="home" && <button onClick={()=>{setView("home");setSent(false);setError("");}} style={{background:"none",border:"none",color:C.gold,fontSize:18,cursor:"pointer",padding:4}}>‹</button>}
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,letterSpacing:1.5,color:"#fff"}}>{view==="home"?"Welcome":view==="drills"?"Drill Library":"Invite Your Coach"}</div>
      </div>
      <button onClick={onSignOut} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,padding:"6px 10px",cursor:"pointer",textTransform:"uppercase"}}>Sign Out</button>
    </div>
  );

  // ─── DRILLS VIEW ───
  if(view==="drills") {
    return (
      <div style={{maxWidth:560,margin:"0 auto",padding:"18px 14px",paddingBottom:60}}>
        <style>{FONTS}</style>
        <Header/>
        <div style={{padding:"12px 14px",background:`${C.teal}15`,border:`1px solid ${C.teal}40`,borderRadius:10,color:C.teal,fontSize:12,marginBottom:14,lineHeight:1.5}}>
          💡 Browse our full drill library. Work on these at home with your kid!
        </div>
        <ParentDrillLibrary customDrills={customDrills}/>
      </div>
    );
  }

  // ─── INVITE COACH VIEW ───
  if(view==="invite") {
    return (
      <div style={{maxWidth:560,margin:"0 auto",padding:"18px 14px",paddingBottom:60}}>
        <style>{FONTS}</style>
        <Header/>
        {sent ? (
          <div className="fade-up" style={{textAlign:"center",padding:"40px 20px"}}>
            <div style={{fontSize:64,marginBottom:16}}>✉️</div>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,letterSpacing:1.5,color:"#fff",marginBottom:10}}>Invite Sent!</div>
            <div style={{fontSize:14,color:C.textMid,lineHeight:1.6,marginBottom:24,maxWidth:340,margin:"0 auto 24px"}}>We let your coach know you'd love them to sign up for CoachConnect Pro. Once they create an account and add you as a parent, your team will appear here automatically.</div>
            <button onClick={()=>setView("home")} style={{padding:"12px 24px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#c89500)`,border:"none",color:"#1a1200",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Back to Home</button>
          </div>
        ) : (
          <div className="fade-up">
            <div style={{padding:"14px 16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:16,fontSize:13,color:C.textMid,lineHeight:1.6}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:11,letterSpacing:2,color:C.gold,textTransform:"uppercase",marginBottom:6}}>How it works</div>
              We'll send your coach an email letting them know you'd love them to use CoachConnect Pro for your team. They get a free trial — no credit card required.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Coach's Email *</div>
                <input value={coachEmail} onChange={e=>setCoachEmail(e.target.value)} type="email" placeholder="coach@example.com" style={{width:"100%",boxSizing:"border-box",padding:"12px 14px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:14,outline:"none"}}/>
              </div>
              <div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Coach's Name (optional)</div>
                <input value={coachName} onChange={e=>setCoachName(e.target.value)} placeholder="Coach Smith" style={{width:"100%",boxSizing:"border-box",padding:"12px 14px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:14,outline:"none"}}/>
              </div>
              <div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Team Name (optional)</div>
                <input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="The Bulldogs" style={{width:"100%",boxSizing:"border-box",padding:"12px 14px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:14,outline:"none"}}/>
              </div>
              <div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Personal Note (optional)</div>
                <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3} placeholder="Hey Coach! I think you'd love this app for our team..." style={{width:"100%",boxSizing:"border-box",padding:"12px 14px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:14,outline:"none",resize:"vertical",fontFamily:"inherit"}}/>
              </div>
              {error && <div style={{padding:"10px 12px",background:`${C.red}15`,border:`1px solid ${C.red}40`,borderRadius:8,color:C.red,fontSize:12}}>⚠️ {error}</div>}
              <button onClick={sendInvite} disabled={sending||!coachEmail.trim()} style={{padding:"14px 0",borderRadius:12,background:sending||!coachEmail.trim()?"#1a2a2a":`linear-gradient(135deg,${C.gold},#c89500)`,border:"none",color:"#1a1200",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:sending||!coachEmail.trim()?"default":"pointer",minHeight:50,marginTop:6}}>
                {sending?"Sending...":"📨 Send Invite to Coach"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── HOME VIEW ───
  return (
    <div style={{maxWidth:560,margin:"0 auto",padding:"18px 14px",paddingBottom:60}}>
      <style>{FONTS}</style>
      <Header/>
      {/* Welcome banner */}
      <div className="glass-card fade-up" style={{padding:"22px 20px",borderRadius:18,marginBottom:18,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.red},${C.gold},${C.red})`}}/>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,letterSpacing:1.5,color:"#fff",lineHeight:1.1,marginBottom:8}}>
          Welcome{parentName?`, ${parentName.split(" ")[0]}`:""}! ⚾
        </div>
        <div style={{fontSize:13,color:C.textMid,lineHeight:1.6}}>You're not connected to a team yet. Either ask your coach to invite you, <strong style={{color:C.gold}}>OR</strong> use the free tools below to start working with your kid right now.</div>
      </div>

      {/* Action cards */}
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:18}}>
        <button onClick={()=>setView("invite")} style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",background:`linear-gradient(135deg,${C.gold}25,${C.gold}10)`,border:`1px solid ${C.gold}60`,borderRadius:14,cursor:"pointer",textAlign:"left",width:"100%"}}>
          <div style={{fontSize:32}}>📨</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:16,color:"#fff",letterSpacing:0.5,marginBottom:2}}>Invite Your Coach</div>
            <div style={{fontSize:12,color:C.textMid,lineHeight:1.5}}>Let them know you'd love this for the team. Free trial.</div>
          </div>
          <div style={{color:C.gold,fontSize:18}}>›</div>
        </button>
        <button onClick={()=>setView("drills")} style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",background:`linear-gradient(135deg,${C.teal}25,${C.teal}10)`,border:`1px solid ${C.teal}60`,borderRadius:14,cursor:"pointer",textAlign:"left",width:"100%"}}>
          <div style={{fontSize:32}}>⚾</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:16,color:"#fff",letterSpacing:0.5,marginBottom:2}}>Browse Drill Library</div>
            <div style={{fontSize:12,color:C.textMid,lineHeight:1.5}}>Hitting, fielding, baserunning. Work at home with your kid.</div>
          </div>
          <div style={{color:C.teal,fontSize:18}}>›</div>
        </button>
      </div>

      {/* Free Resources */}
      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:10}}>📚 Free Resources</div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
        <a href="/positioning.html" target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:C.card,border:`1px solid ${C.teal}40`,borderRadius:12,textDecoration:"none",color:"inherit"}}>
          <div style={{width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",color:C.teal}}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M4.9 4.9c2.4 2 3.9 5 3.9 7.1s-1.5 5.1-3.9 7.1"/><path d="M19.1 4.9c-2.4 2-3.9 5-3.9 7.1s1.5 5.1 3.9 7.1"/></svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:14,color:"#fff"}}>Positioning Trainer</div>
            <div style={{fontSize:11,color:C.textDim,marginTop:2}}>Watch all 9 players move on 66 plays — then test yourself</div>
          </div>
          <div style={{color:C.teal,fontSize:14}}>↗</div>
        </a>
        <a href="/Youth_Baseball_Parent_Guide.pdf" download="" target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:C.card,border:`1px solid ${C.red}40`,borderRadius:12,textDecoration:"none",color:"inherit"}}>
          <div style={{fontSize:24}}>👨‍👩‍👦</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:14,color:"#fff"}}>The Parent's Survival Guide</div>
            <div style={{fontSize:11,color:C.textDim,marginTop:2}}>What to say after a strikeout (and what NOT to say)</div>
          </div>
          <div style={{color:C.red,fontSize:14}}>↓</div>
        </a>
      </div>

      {/* Refresh hint */}
      <div style={{padding:"14px 16px",background:`${C.bg}`,border:`1px dashed ${C.border}`,borderRadius:12,textAlign:"center",fontSize:12,color:C.textDim,lineHeight:1.5}}>
        Already invited by your coach? <strong style={{color:C.gold}}>Refresh the page</strong> to load your team.
      </div>
    </div>
  );
}





// ─── MESSAGES TAB (channel list) ─────────────────────────────────────────────
function MessagesTab({players,messages,unread,onOpen,onBroadcast,teamLogo,teamName}) {
  const teamInitials = teamName
    ? teamName.split(/\s+/).filter(Boolean).map(w=>w[0].toUpperCase()).slice(0,3).join("")
    : "TC";
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");

  // Create one channel per parent (not per player)
  const parentChannels = players.flatMap(p =>
    (p.parents||[]).map(par => ({
      id: `dm-${par.id}`,
      name: par.name || 'Parent',
      sub: `${p.name}'s parent`,
      playerName: p.name,
      playerPosition: p.position,
      icon: null,
      isGroup: false,
    }))
  );
  const channels = [
    {id:"team", name:"Team Chat", sub:"Everyone on the team", icon:"⚾", isGroup:true},
    ...parentChannels,
  ];

  const sendBroadcast = () => {
    if(!broadcastText.trim()) return;
    onBroadcast(broadcastText.trim(), parentChannels.map(c=>c.id));
    setBroadcastText("");
    setShowBroadcast(false);
  };

  return (
    <div>
      <NewCoachCard page="msgs"/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:18,color:C.text,letterSpacing:1,textTransform:"uppercase"}}>Messages</div>
        <button onClick={()=>setShowBroadcast(true)}
          style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 4px 14px ${C.red}40`,minHeight:38}}>
          📣 Message All
        </button>
      </div>

      {/* Broadcast modal */}
      {showBroadcast&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{width:"100%",background:C.bg,borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",boxShadow:"0 -8px 40px #000a"}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:18,color:C.text,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>📣 Message All Parents</div>
            <div style={{fontSize:12,color:C.textDim,marginBottom:16}}>This will send your message to all {parentChannels.length} parent DMs at once.</div>
            <textarea
              value={broadcastText}
              onChange={e=>setBroadcastText(e.target.value)}
              placeholder="e.g. Practice tomorrow is cancelled due to rain. See you Saturday!"
              style={{width:"100%",background:"#08111e",border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:14,lineHeight:1.6,resize:"none",minHeight:100,outline:"none",boxSizing:"border-box",marginBottom:14}}
            />
            <div style={{display:"flex",gap:10}}>
              <button onClick={sendBroadcast} disabled={!broadcastText.trim()}
                style={{flex:1,padding:"14px 0",borderRadius:12,background:broadcastText.trim()?`linear-gradient(135deg,${C.red},${C.redDim})`:"#1a2a2a",border:"none",color:broadcastText.trim()?"#fff":C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:broadcastText.trim()?"pointer":"default",minHeight:50}}>
                📣 Send to All Parents
              </button>
              <button onClick={()=>{setShowBroadcast(false);setBroadcastText("");}}
                style={{padding:"14px 20px",borderRadius:12,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",minHeight:50}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:1,background:C.card,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}>
        {channels.map((ch,i) => {
          const msgs = messages[ch.id]||[];
          const last = msgs[msgs.length-1];
          const uCount = unread[ch.id]||0;
          return (
            <button key={ch.id} onClick={()=>onOpen(ch.id)} className="card-hover" style={{display:"flex",gap:14,alignItems:"center",padding:"14px 16px",background:"transparent",border:"none",borderBottom:i<channels.length-1?`1px solid ${C.border}40`:"none",textAlign:"left",width:"100%",minHeight:72,cursor:"pointer"}}>
              {ch.isGroup
                ? <div style={{width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,#1a3a7a,#0a1f50)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",boxShadow:`0 0 12px ${C.blue}30`}}>
                    {teamLogo
                      ? <img src={teamLogo} alt="team" style={{width:46,height:46,objectFit:"cover"}}/>
                      : <span style={{fontFamily:"Bebas Neue, sans-serif",fontSize:16,letterSpacing:1,color:"#fff"}}>{teamInitials}</span>
                    }
                  </div>
                : <Avatar name={ch.name} size={46} showRing={uCount>0}/>
              }
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:16,color:uCount>0?"#fff":C.textMid,letterSpacing:0.5}}>{ch.name}</div>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:10,color:C.textDim,flexShrink:0,marginLeft:8}}>{last?fmtTime(last.ts):""}</div>
                </div>
                {last ? (
                  <div style={{fontSize:13,color:uCount>0?C.text:C.textDim,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"90%",fontWeight:uCount>0?600:400}}>
                    {last.senderName}: {last.text}
                  </div>
                ) : (
                  <div style={{fontSize:12,color:C.textDim,fontStyle:"italic"}}>{ch.sub}</div>
                )}
              </div>
              {uCount>0&&<div className="pulseBadge" style={{width:22,height:22,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:10,color:"#fff",flexShrink:0,boxShadow:`0 0 8px ${C.red}60`}}>{uCount}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamSettingsPanel({teamData={}, teamName="", onSave, onCancel, onSupport=()=>{}, teamLogo=null, onTeamLogoChange=null}) {
  const [logoBusy, setLogoBusy] = useState(false);
  const handleLogoPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onTeamLogoChange) return;
    setLogoBusy(true);
    try {
      const blob = await compressImage(file, 512, 0.85);
      const reader = new FileReader();
      reader.onload = (ev) => { onTeamLogoChange(ev.target.result); setLogoBusy(false); };
      reader.onerror = () => { toast.error("Couldn't read that image."); setLogoBusy(false); };
      reader.readAsDataURL(blob);
    } catch (err) {
      toast.error("Couldn't process that image. Try another photo.");
      setLogoBusy(false);
    }
  };
  const teamInitialsS = (form0 => form0)((teamData.name || teamName || "TC").split(/\s+/).filter(Boolean).map(w=>w[0].toUpperCase()).slice(0,3).join(""));
  const [form, setForm] = useState({
    name: teamData.name || teamName || "",
    age_group: teamData.age_group || "",
    season: teamData.season || "2026",
    location: teamData.location || "",
    coach_name: teamData.coach_name || "",
    coach_phone: teamData.coach_phone || "",
    coach_email: teamData.coach_email || "",
  });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const [billingLoading, setBillingLoading] = useState(false);

  const manageSubscription = async () => {
    setBillingLoading(true);
    try {
      const {data:{session:authSession}} = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if(!token){ toast.error("Please sign in again."); setBillingLoading(false); return; }
      const res = await fetch("https://hcadlkmejdekhbgfvyaq.supabase.co/functions/v1/stripe-checkout", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body: JSON.stringify({action:"portal"}),
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      if(data.url) window.location.href = data.url;
      else throw new Error("Couldn't open the billing portal.");
    } catch(err) {
      const msg = String(err.message||err);
      // Friendly message for the common "no subscription yet" case
      if(/no subscription/i.test(msg)) toast.error("No active subscription yet. Start a plan first to manage billing.");
      else toast.error("Couldn't open billing. Please try again.");
      setBillingLoading(false);
    }
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,letterSpacing:3,color:C.text}}>Team Settings</div>
        <button onClick={onCancel} style={{background:"none",border:"none",color:C.textDim,fontSize:22,cursor:"pointer",padding:"4px 8px"}}>✕</button>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Team Logo */}
        {onTeamLogoChange && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:3,color:C.gold,textTransform:"uppercase",marginBottom:14}}>Team Logo</div>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:72,height:72,borderRadius:"50%",overflow:"hidden",flexShrink:0,border:`2px solid ${teamLogo?C.red+"cc":C.border}`,display:"flex",alignItems:"center",justifyContent:"center",background:teamLogo?"#000":"linear-gradient(145deg,#1a3a7a,#0a1f50)"}}>
                {teamLogo
                  ? <img src={teamLogo} alt="Team logo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <span style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,letterSpacing:1,color:"#fff"}}>{teamInitialsS}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,color:C.textDim,lineHeight:1.5,marginBottom:10}}>
                  {teamLogo ? "Shown on your dashboard, in chat, and on the parent view." : "Add your team logo — it appears on your dashboard, in chat, and on the parent view."}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:9,background:"transparent",border:`1px solid ${C.red}70`,color:C.red,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.2,textTransform:"uppercase",cursor:logoBusy?"wait":"pointer",opacity:logoBusy?0.6:1}}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {logoBusy ? "Uploading…" : (teamLogo ? "Change Logo" : "Upload Logo")}
                    <input type="file" accept="image/*" onChange={handleLogoPick} disabled={logoBusy} style={{display:"none"}}/>
                  </label>
                  {teamLogo && (
                    <button onClick={()=>onTeamLogoChange(null)} disabled={logoBusy} style={{padding:"8px 12px",borderRadius:9,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.2,textTransform:"uppercase",cursor:"pointer"}}>Remove</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Info */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:3,color:C.red,textTransform:"uppercase",marginBottom:14}}>⚾ Team Info</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Inp label="Team Name" value={form.name} onChange={e=>f("name",e.target.value)} placeholder="e.g. Big Dogs"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <SelF label="Age Group" value={form.age_group} onChange={v=>f("age_group",v)} options={["","6–8 (T-ball)","9–12 (Little League)","13–15 (Junior)","16–18 (Senior)"]}/>
              <Inp label="Season" value={form.season} onChange={e=>f("season",e.target.value)} placeholder="2026"/>
            </div>
            <Inp label="Home Field / Location" value={form.location} onChange={e=>f("location",e.target.value)} placeholder="e.g. Riverside Park, Field 2"/>
          </div>
        </div>

        {/* Coach Contact */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:3,color:C.blue,textTransform:"uppercase",marginBottom:14}}>👤 Coach Contact Info</div>
          <div style={{fontSize:12,color:C.textDim,marginBottom:12,lineHeight:1.5}}>This info is shared with parents so they can reach you.</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Inp label="Coach Name" value={form.coach_name} onChange={e=>f("coach_name",e.target.value)} placeholder="e.g. Lambert Dunham"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Phone" value={form.coach_phone} onChange={e=>f("coach_phone",e.target.value)} placeholder="(555) 000-0000" type="tel"/>
              <Inp label="Email" value={form.coach_email} onChange={e=>f("coach_email",e.target.value)} placeholder="coach@email.com" type="email"/>
            </div>
          </div>
        </div>

        {/* Subscription & Billing */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:3,color:C.gold,textTransform:"uppercase",marginBottom:10}}>💳 Subscription & Billing</div>
          <div style={{fontSize:12,color:C.textDim,marginBottom:14,lineHeight:1.5}}>Update your card, view invoices, or cancel your subscription anytime through our secure billing portal.</div>
          <button onClick={manageSubscription} disabled={billingLoading} style={{width:"100%",padding:"13px 0",borderRadius:11,background:billingLoading?"#1a2f52":"transparent",border:`1px solid ${C.gold}`,color:billingLoading?C.textDim:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:billingLoading?"default":"pointer",minHeight:48}}>
            {billingLoading ? "Opening…" : "Manage Subscription"}
          </button>
        </div>
      </div>

      {/* Help & Support */}
      <button onClick={onSupport} style={{display:"flex",alignItems:"center",gap:12,width:"100%",background:C.cardAlt,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginTop:20,cursor:"pointer",textAlign:"left"}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.text,letterSpacing:0.5}}>Help & Support</div>
          <div style={{fontSize:11,color:C.textDim}}>Report a bug or ask a question</div>
        </div>
        <div style={{color:C.textDim,fontSize:15}}>›</div>
      </button>

      <div style={{display:"flex",gap:10,marginTop:20}}>
        <button className="btn-press" onClick={()=>onSave(form)} disabled={!form.name.trim()} style={{flex:1,padding:"14px 0",borderRadius:12,background:form.name.trim()?`linear-gradient(135deg,${C.red},${C.redDim})`:"#1a2f52",border:"none",color:form.name.trim()?"#fff":C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:2,textTransform:"uppercase",cursor:form.name.trim()?"pointer":"default",minHeight:52,boxShadow:form.name.trim()?`0 6px 20px ${C.red}40`:"none"}}>
          ✓ Save Settings
        </button>
        <button onClick={onCancel} style={{padding:"14px 20px",borderRadius:12,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:52}}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── COACH HOME ───────────────────────────────────────────────────────────────
function CoachHome({onSupport=()=>{},players,assignments,events,customPlans=[],goToPlayer,setTab,teamLogo,onTeamLogoChange,teamName,playerVideos={},teamData={},onTeamSettingsSave=null,chatReports=[],onResolveReport=()=>{},canAccess=()=>true,onUpgrade=()=>{}}) {
  const done=assignments.filter(a=>a.completed).length;
  const pending=assignments.filter(a=>!a.completed).length;
  const pct=assignments.length?Math.round(done/assignments.length*100):0;
  const today=new Date().toISOString().slice(0,10);
  const nextEvent=events.filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const _hr = new Date().getHours();
  const greeting = _hr < 12 ? "Good morning" : _hr < 17 ? "Good afternoon" : "Good evening";
  const teamInitials = teamName
    ? teamName.split(/\s+/).filter(Boolean).map(w=>w[0].toUpperCase()).slice(0,3).join("")
    : "TC";
  const [showSettings, setShowSettings] = useState(false);

  // ── Live game score for next event (if game) ──
  const [nextGameScore, setNextGameScore] = useState(null);
  useEffect(()=>{
    if(!nextEvent || nextEvent.type!=="game") { setNextGameScore(null); return; }
    supabase.from("game_scores").select("*").eq("event_id", nextEvent.id).maybeSingle().then(({data})=>{
      setNextGameScore(data||null);
    });
    const channel = supabase.channel('home-game-score-'+nextEvent.id)
      .on('postgres_changes', {event:'*', schema:'public', table:'game_scores', filter:`event_id=eq.${nextEvent.id}`}, (payload)=>{
        if(payload.eventType==='DELETE') setNextGameScore(null);
        else setNextGameScore(payload.new);
      }).subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[nextEvent?.id]);

  // Needs Review: completed but not yet acknowledged
  const needsReview = assignments.filter(a=>a.completed && !a.acknowledged);
  // Group by player
  const reviewByPlayer = players.map(p=>({
    player:p,
    items: needsReview.filter(a=>a.playerId===p.id)
  })).filter(x=>x.items.length>0);

  // ── Recent Activity feed (derived from existing data; arrays are created_at-ordered) ──
  // Genuinely chronological. This used to rank by CATEGORY (players 300,
  // events 250, plans 200, drills 150) rather than by time — so players always
  // occupied the top 4 slots and a new practice plan or drill assignment could
  // never surface at all. Now every item carries its real created_at and the
  // feed is sorted on that.
  const recentActivity = (()=>{
    const items = [];
    const when = (o) => o?.createdAt || 0;

    players.forEach(p=>{
      items.push({ key:`pl-${p.id}`, at:when(p), iconId:"roster", color:C.red,
        title:`${p.name} was added to the roster`, tab:"roster" });
    });

    customPlans.forEach(p=>{
      items.push({ key:`cp-${p.id}`, at:when(p), iconId:"plans", color:C.gold,
        title:`Practice plan "${p.title||'Untitled'}" created`, tab:"plans" });
    });

    events.forEach(e=>{
      const label = e.type==="game"
        ? `Game${e.opponent?` vs. ${e.opponent}`:""} added to schedule`
        : `Practice added to schedule`;
      items.push({ key:`ev-${e.id}`, at:when(e), iconId:"schedule", color:C.blue, title:label, tab:"schedule" });
    });

    // Drill assignments collapse by drill: assigning one drill to nine players
    // is one activity, not nine. Keep the most recent assignment per drill.
    const byDrill = new Map();
    assignments.forEach(a=>{
      const prev = byDrill.get(a.drillId);
      if(!prev || when(a) > when(prev)) byDrill.set(a.drillId, a);
    });
    byDrill.forEach((a, drillId)=>{
      const d = findDrill(drillId);
      items.push({ key:`as-${drillId}`, at:when(a), icon:"⚾", color:C.teal,
        title:`Drill "${d?.name||'Drill'}" assigned`, tab:"drills" });
    });

    return items.sort((a,b)=>b.at-a.at).slice(0,6);
  })();

  return (
    <div>
      {/* Team Settings Modal */}
      {showSettings && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{width:"100%",maxWidth:500,background:C.bg,borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",boxShadow:"0 -8px 40px #000a",maxHeight:"85vh",overflowY:"auto"}}>
            <TeamSettingsPanel
              onSupport={onSupport}
              teamData={teamData}
              teamName={teamName}
              teamLogo={teamLogo}
              onTeamLogoChange={onTeamLogoChange}
              onSave={(data)=>{onTeamSettingsSave(data);setShowSettings(false);}}
              onCancel={()=>setShowSettings(false)}
            />
          </div>
        </div>
      )}

      <NewCoachCard page="home" setTab={setTab}/>

      {/* ── Stadium Header (full-bleed) ── */}
      <div className="fade-up" style={{position:"relative",overflow:"hidden",marginLeft:"calc(50% - 50vw)",marginRight:"calc(50% - 50vw)",width:"100vw",marginTop:-20,marginBottom:16,boxShadow:`0 12px 48px #00000080`}}>
        {/* Stadium background photo */}
        <div style={{position:"absolute",inset:0}}>
          <img src="/stadium-bg.jpg" alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center"}}/>
          {/* Directional overlay — dark behind the text (left), fully clear over the baseball (right) */}
          <div style={{position:"absolute",inset:0,background:`linear-gradient(90deg, rgba(6,17,31,0.85) 0%, rgba(6,17,31,0.6) 28%, rgba(6,17,31,0.18) 52%, rgba(6,17,31,0) 72%)`}}/>
        </div>
        {/* Top accent line */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:`linear-gradient(90deg,${C.red},${C.gold},${C.red})`,zIndex:2}}/>
        {/* Bottom accent line */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:`linear-gradient(90deg,transparent,${C.red}80,${C.gold}80,transparent)`,zIndex:2}}/>

        {/* Settings gear */}
        {onTeamSettingsSave && (
          <button onClick={()=>setShowSettings(true)} style={{position:"absolute",top:14,right:14,width:36,height:36,borderRadius:10,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(6px)",border:`1px solid #ffffff25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,cursor:"pointer",zIndex:4,color:"#fff"}}>⚙️</button>
        )}

        {/* Content — constrained to the same 640 column so it lines up with the rest of the page */}
        <div style={{position:"relative",zIndex:3,maxWidth:640,margin:"0 auto",padding:"24px 20px 22px"}}>
          {/* Top row: logo + greeting + team name */}
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}>
            {/* Logo — display only; change it in Team Settings */}
            <div onClick={()=>{ if(onTeamSettingsSave) setShowSettings(true); }} style={{cursor:onTeamSettingsSave?"pointer":"default",flexShrink:0,position:"relative"}} title={onTeamSettingsSave?"Change logo in Team Settings":undefined}>
              <div style={{width:84,height:84,borderRadius:"50%",overflow:"hidden",border:`3px solid ${teamLogo?C.red+"cc":"#ffffff40"}`,boxShadow:teamLogo?`0 0 0 4px ${C.red}25, 0 8px 32px ${C.red}40`:`0 0 0 4px #ffffff10, 0 8px 28px #00000080`,display:"flex",alignItems:"center",justifyContent:"center",background:teamLogo?"#000":`linear-gradient(145deg,#1a3a7a,#0a1f50)`}}>
                {teamLogo
                  ? <img src={teamLogo} alt="Team logo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <span style={{fontFamily:"Bebas Neue, sans-serif",fontSize:30,letterSpacing:1,color:"#fff",textShadow:`0 0 16px ${C.red}80`}}>{teamInitials}</span>
                }
              </div>
            </div>

            {/* Greeting + name */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"Plus Jakarta Sans, sans-serif",fontWeight:700,fontSize:15,color:"#fff",marginBottom:2,textShadow:"0 2px 8px rgba(0,0,0,0.7)"}}>
                {greeting}, Coach!
              </div>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:40,letterSpacing:2,color:"#fff",lineHeight:1,textShadow:`0 2px 16px rgba(0,0,0,0.8)`,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {teamName||"Your Team"}
              </div>
              {/* Accent divider */}
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8}}>
                <div style={{height:3,width:32,background:`linear-gradient(90deg,${C.red},${C.gold})`,borderRadius:2}}/>
                <div style={{height:3,width:14,background:C.gold,opacity:0.5,borderRadius:2}}/>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,color:"#ffffffe0",textTransform:"uppercase",marginLeft:4,textShadow:"0 1px 6px rgba(0,0,0,0.7)"}}>2026 Season</div>
              </div>
            </div>
          </div>

          {/* Stats strip removed — the Drill Progress card below carries these numbers */}
        </div>
      </div>

      {/* ── Drill Progress ── */}
      <div className="fade-up glass-card" style={{borderRadius:20,padding:"22px 20px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:C.stripe,pointerEvents:"none",opacity:0.5}}/>
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle,${C.red}20 0%,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.red}80,${C.gold}80,${C.red}80)`}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",position:"relative"}}>
          <div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:3,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Drill Progress</div>
            <div style={{display:"flex",gap:24,alignItems:"flex-end"}}>
              {[{v:players.length,l:"Players",c:C.text},{v:done,l:"Done",c:C.gold},{v:pending,l:"Pending",c:C.red}].map(s=>(
                <div key={s.l}>
                  <div key={`${s.l}-${s.v}`} className="number-pop" style={{fontFamily:"Bebas Neue, sans-serif",fontSize:48,color:s.c,lineHeight:1,textShadow:`0 0 30px ${s.c}60`}}>{s.v}</div>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase"}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <Ring pct={pct} size={72} color={pct===100?C.teal:C.red} label={`${pct}%`} sub="Done"/>
        </div>
        <div style={{marginTop:16,background:"#1a2f5240",borderRadius:4,height:6,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${C.red},${C.gold})`,borderRadius:4,boxShadow:`0 0 10px ${C.gold}60`,transition:"width 0.8s ease"}}/>
        </div>
      </div>

      {/* ── Needs Review Alert ── */}
      {needsReview.length > 0 && (
        <div className="fade-up" style={{background:`linear-gradient(135deg,#1a0e00,#1a1400)`,borderRadius:16,border:`1px solid ${C.gold}50`,padding:"16px 18px",marginBottom:16,position:"relative",overflow:"hidden",boxShadow:`0 4px 24px ${C.gold}20`}}>
          <div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:`linear-gradient(180deg,${C.gold},${C.gold}40)`}}/>
          <div style={{position:"absolute",inset:0,backgroundImage:C.stripe,pointerEvents:"none"}}/>
          <div style={{display:"flex",alignItems:"center",gap:14,position:"relative"}}>
            <div style={{width:44,height:44,borderRadius:12,background:`${C.gold}20`,border:`1px solid ${C.gold}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📋</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:C.gold,letterSpacing:0.5,marginBottom:2}}>
                {needsReview.length} Drill{needsReview.length!==1?"s":""} Need{needsReview.length===1?"s":""} Review
              </div>
              <div style={{fontSize:12,color:C.textMid,lineHeight:1.4}}>
                Tap a player's profile to review — {reviewByPlayer.map(x=>`${x.player.name.split(" ")[0]} (${x.items.length})`).join(" · ")}
              </div>
            </div>
            <button onClick={()=>setTab("roster")} style={{padding:"9px 16px",borderRadius:10,background:`linear-gradient(135deg,${C.gold}30,${C.gold}15)`,border:`1px solid ${C.gold}60`,color:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",minHeight:40,flexShrink:0}}>
              Roster →
            </button>
          </div>
        </div>
      )}

      {nextEvent&&(
        <div className="fade-up-1" style={{background:nextEvent.type==="game"?`linear-gradient(135deg,#1a0808 0%,${C.card} 100%)`:`linear-gradient(135deg,#080f1a 0%,${C.card} 100%)`,borderRadius:16,border:`1px solid ${nextEvent.type==="game"?C.red+"50":C.blue+"50"}`,padding:"16px 18px",marginBottom:16,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,backgroundImage:C.stripe,pointerEvents:"none"}}/>
          <div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:`linear-gradient(180deg,${nextEvent.type==="game"?C.red:C.blue},transparent)`}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                <Tag label={nextEvent.type==="game"?"⚾ Game":"⚾ Practice"} color={nextEvent.type==="game"?C.red:C.blue}/>
                <span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:12,color:C.textMid,letterSpacing:1}}>{new Date(nextEvent.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} · {nextEvent.time}</span>
              </div>
              {nextEvent.opponent?<div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:26,color:C.text,letterSpacing:1,marginBottom:4}}>vs. {nextEvent.opponent}</div>:<div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,color:C.text,letterSpacing:1,marginBottom:4}}>Team Practice</div>}
              <MapLink location={nextEvent.location} isGame={nextEvent.type==="game"}/>
              {nextEvent.notes&&<div style={{fontSize:12,color:C.textMid,marginTop:6,fontStyle:"italic",opacity:0.8}}>{nextEvent.notes}</div>}
            </div>
            <div style={{textAlign:"center",marginLeft:12,flexShrink:0}}>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:36,color:nextEvent.type==="game"?C.red:C.blue,lineHeight:1,textShadow:`0 0 20px ${nextEvent.type==="game"?C.red:C.blue}80`}}>{new Date(nextEvent.date+"T12:00:00").getDate()}</div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid}}>{new Date(nextEvent.date+"T12:00:00").toLocaleString("en-US",{month:"short"}).toUpperCase()}</div>
            </div>
          </div>
          {/* Live score (if game in progress or final) */}
          {nextEvent.type==="game"&&nextGameScore&&nextGameScore.game_status!=='not_started'&&(
            <div style={{position:"relative",marginTop:12,padding:"10px 14px",background:`linear-gradient(135deg,#0a1525,${C.card})`,border:`1px solid ${nextGameScore.game_status==='in_progress'?C.red:C.border}`,borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
              {nextGameScore.game_status==='in_progress'&&<div className="badge-pulse" style={{padding:"3px 8px",borderRadius:6,background:C.red,color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:9,letterSpacing:1.5,textTransform:"uppercase"}}>● LIVE</div>}
              {nextGameScore.game_status==='final'&&<div style={{padding:"3px 8px",borderRadius:6,background:C.textDim,color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:9,letterSpacing:1.5,textTransform:"uppercase"}}>FINAL</div>}
              <div style={{flex:1,display:"flex",alignItems:"center",gap:12,justifyContent:"center"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1,color:C.textDim,textTransform:"uppercase"}}>{(nextGameScore.home_team||"Home").slice(0,12)}</div>
                  <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,color:C.text,lineHeight:1}}>{nextGameScore.home_score}</div>
                </div>
                <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:14,color:C.textDim}}>—</div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1,color:C.textDim,textTransform:"uppercase"}}>{(nextGameScore.away_team||"Away").slice(0,12)}</div>
                  <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,color:C.text,lineHeight:1}}>{nextGameScore.away_score}</div>
                </div>
              </div>
              {nextGameScore.game_status==='in_progress'&&(
                <div style={{textAlign:"right",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,color:C.textDim,letterSpacing:1}}>
                  <div>{nextGameScore.is_top_inning?"TOP":"BOT"} {nextGameScore.current_inning}</div>
                  <div style={{color:C.gold,marginTop:1}}>{nextGameScore.outs} OUT</div>
                </div>
              )}
            </div>
          )}
          {/* Score Game button (games only) */}
          {nextEvent.type==="game"&&(
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:10,position:"relative"}}>
              <button onClick={(e)=>{
                e.stopPropagation();
                if(canAccess && !canAccess("scorebook")){ onUpgrade && onUpgrade(); return; }
                const tid = teamData?.id || '';
                // Attach the coach's Supabase session in the URL fragment (never sent to
                // servers) so the scorebook can talk to the database AS this coach. Read
                // synchronously from storage so window.open stays in the click gesture
                // (avoids mobile popup blocking) and the token is present on first load.
                let frag = '';
                try {
                  let raw = localStorage.getItem('sb-hcadlkmejdekhbgfvyaq-auth-token');
                  if(!raw){
                    for(let i=0;i<localStorage.length;i++){
                      const k = localStorage.key(i);
                      if(k && k.startsWith('sb-') && k.endsWith('-auth-token')){ raw = localStorage.getItem(k); break; }
                    }
                  }
                  if(raw){
                    const parsed = JSON.parse(raw);
                    const s = parsed && parsed.access_token ? parsed : (parsed && (parsed.currentSession || parsed.session)) || {};
                    if(s.access_token && s.refresh_token){
                      frag = `#at=${encodeURIComponent(s.access_token)}&rt=${encodeURIComponent(s.refresh_token)}`;
                    }
                  }
                } catch(err){}
                const url = `https://ccp-scorebook.vercel.app/?team_id=${encodeURIComponent(tid)}&event_id=${encodeURIComponent(nextEvent.id)}${frag}`;
                window.open(url, '_blank');
              }} className="btn-press" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 12px",background:"transparent",border:`1px solid ${C.gold}80`,borderRadius:8,cursor:"pointer",color:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,textTransform:"uppercase"}}>
                <span style={{fontSize:12}}>⚾</span>
                {nextGameScore&&nextGameScore.game_status==='in_progress'?'Continue Scoring':nextGameScore&&nextGameScore.game_status==='final'?'View Scorebook':'Score Game'}
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      )}
      {/* ── Recent Activity ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <SectionHead accent>Recent Activity</SectionHead>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {recentActivity.length===0
          ? <EmptyState icon={<span style={{color:C.textMid,display:"flex"}}><NavIcon id="plans" size={44}/></span>} title="No activity yet" body="As you add players, schedule games, and assign drills, your recent activity will show up here." action="Add a Player" onAction={()=>setTab("roster")}/>
          : recentActivity.map((a,i)=>(
            <button key={a.key} onClick={()=>setTab(a.tab)} className={`card-hover fade-up-${Math.min(i+2,5)}`} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",textAlign:"left",width:"100%",minHeight:60,backgroundImage:C.stripe,position:"relative",overflow:"hidden",boxShadow:"0 4px 16px #00000040",display:"flex",alignItems:"center",gap:14}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:`linear-gradient(180deg,${a.color},${a.color}40)`}}/>
              <div style={{width:40,height:40,borderRadius:11,background:`${a.color}1f`,border:`1px solid ${a.color}45`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:a.color,flexShrink:0,marginLeft:6}}>{a.iconId?<NavIcon id={a.iconId} size={18}/>:a.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"Plus Jakarta Sans, sans-serif",fontWeight:600,fontSize:14,color:C.text,lineHeight:1.35}}>{a.title}</div>
              </div>
              <div style={{color:C.textDim,fontSize:18,flexShrink:0}}>›</div>
            </button>
          ))
        }
      </div>

      {/* ── Chat Reports ── */}
      {chatReports.length > 0 && (
        <div style={{marginTop:20}}>
          <SectionHead accent>Chat Reports ({chatReports.filter(r=>!r.resolved).length} open)</SectionHead>
          {chatReports.filter(r=>!r.resolved).length===0 ? (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"20px 16px",textAlign:"center"}}>
              <div style={{color:C.teal,display:"flex",justifyContent:"center",marginBottom:6}}><NavIcon id="check" size={26}/></div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,color:C.textMid}}>All reports resolved</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {chatReports.filter(r=>!r.resolved).map(r=>(
                <div key={r.id} style={{background:`linear-gradient(135deg,#1a0808,${C.card})`,border:`1px solid ${C.red}40`,borderRadius:14,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:C.red}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                    <div style={{flex:1,minWidth:0,paddingLeft:6}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                        <Tag label={r.reason} color={C.red}/>
                        <span style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:11,color:C.textDim,letterSpacing:0.5}}>{new Date(r.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</span>
                      </div>
                      <div style={{fontSize:12,color:C.textMid,marginBottom:4}}>
                        <span style={{color:C.text,fontWeight:600}}>{r.reporterName}</span> reported <span style={{color:C.red,fontWeight:600}}>{r.reportedUserName}</span>
                      </div>
                      <div style={{fontSize:12,color:C.textDim,fontStyle:"italic",lineHeight:1.4,background:"#ffffff06",borderRadius:8,padding:"8px 10px",border:`1px solid ${C.border}`}}>
                        "{r.messageText}"
                      </div>
                    </div>
                    <button onClick={()=>{if(window.confirm("Mark this report as resolved?")){onResolveReport(r.id);}}} style={{padding:"8px 14px",borderRadius:10,background:`${C.teal||"#34d399"}20`,border:`1px solid ${C.teal||"#34d399"}50`,color:C.teal||"#34d399",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                      ✓ Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ROSTER ──────────────────────────────────────────────────────────────────
function Roster({players,setPlayers,goToPlayer,playerPhotos={},teamId}) {
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({name:"",age:"",ageGroup:AGE_GROUPS[1],position:"SS",number:"",bats:"R",throws:"R",parent1:"",parent1phone:"",parent1email:"",parent2:"",parent2phone:"",parent2email:"",goals:""});
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  // Scanner lives in components/RosterScanner.jsx — shared with onboarding.
  const [showScanner, setShowScanner] = useState(false);

  const save= async ()=>{
    if(!form.name.trim())return;
    const parents=[];
    const pid=uid();
    if(form.parent1.trim()) parents.push({id:pid+"a",name:form.parent1.trim(),phone:form.parent1phone.trim(),email:form.parent1email.trim()});
    if(form.parent2.trim()) parents.push({id:pid+"b",name:form.parent2.trim(),phone:form.parent2phone.trim(),email:form.parent2email.trim()});
    const newPlayer = {id:pid,name:form.name,age:parseInt(form.age)||0,ageGroup:form.ageGroup,position:form.position,number:form.number,bats:form.bats,throws:form.throws,parents,goals:form.goals.split("\n").filter(Boolean),createdAt:Date.now()};
    // setPlayers is the DB-aware setter — it persists the insert and surfaces any save error itself.
    setPlayers(prev=>[...prev,newPlayer]);
    setForm({name:"",age:"",ageGroup:AGE_GROUPS[1],position:"SS",number:"",bats:"R",throws:"R",parent1:"",parent1phone:"",parent1email:"",parent2:"",parent2phone:"",parent2email:"",goals:""});
    setShowForm(false);
    toast.success(`${newPlayer.name} added to roster.`);
  };
  return (
    <div>
      <NewCoachCard page="roster"/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,gap:8}}>
        <SectionHead accent>Roster</SectionHead>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowScanner(true)} style={{padding:"10px 14px",borderRadius:10,background:`linear-gradient(135deg,${C.teal},#0a8a72)`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 4px 16px ${C.teal}40`,display:"flex",alignItems:"center",gap:6}}>📸 Scan</button>
          <PrimaryBtn onClick={()=>setShowForm(!showForm)}>+ Player</PrimaryBtn>
        </div>
      </div>
      {showForm&&(
        <div className="fade-up" style={{background:`linear-gradient(135deg,#100c1a,${C.card})`,borderRadius:16,border:`1px solid ${C.red}40`,padding:20,marginBottom:18,boxShadow:`0 0 30px ${C.red}15`}}>
          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:18,letterSpacing:3,color:C.red,marginBottom:16}}>NEW PLAYER</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Inp label="Player Name" value={form.name} onChange={e=>f("name",e.target.value)} placeholder="Full name"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Inp label="Age" value={form.age} type="number" onChange={e=>f("age",e.target.value)} placeholder="12"/>
              <Inp label="Jersey #" value={form.number} onChange={e=>f("number",e.target.value)} placeholder="7"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <SelF label="Position" value={form.position} onChange={v=>f("position",v)} options={POSITIONS}/>
              <SelF label="Bats" value={form.bats} onChange={v=>f("bats",v)} options={["R","L","S"]}/>
              <SelF label="Throws" value={form.throws} onChange={v=>f("throws",v)} options={["R","L"]}/>
            </div>
            <SelF label="Age Group" value={form.ageGroup} onChange={v=>f("ageGroup",v)} options={AGE_GROUPS}/>
            {/* Parent 1 */}
            <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}20`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.blue,textTransform:"uppercase"}}>Parent / Guardian 1</div>
              <Inp label="Name" value={form.parent1} onChange={e=>f("parent1",e.target.value)} placeholder="Full name"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Inp label="Phone" value={form.parent1phone} onChange={e=>f("parent1phone",e.target.value)} placeholder="(555) 000-0000" type="tel"/>
                <Inp label="Email" value={form.parent1email} onChange={e=>f("parent1email",e.target.value)} placeholder="email@example.com" type="email"/>
              </div>
            </div>
            {/* Parent 2 */}
            <div style={{background:`${C.blue}05`,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>Parent / Guardian 2 <span style={{opacity:0.5}}>(optional)</span></div>
              <Inp label="Name" value={form.parent2} onChange={e=>f("parent2",e.target.value)} placeholder="Full name"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Inp label="Phone" value={form.parent2phone} onChange={e=>f("parent2phone",e.target.value)} placeholder="(555) 000-0000" type="tel"/>
                <Inp label="Email" value={form.parent2email} onChange={e=>f("parent2email",e.target.value)} placeholder="email@example.com" type="email"/>
              </div>
            </div>
            <div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Dev Goals (one per line)</div>
              <textarea value={form.goals} onChange={e=>f("goals",e.target.value)} rows={3} placeholder={"Improve backhand range...\nWork on bat speed..."} style={{...inp,resize:"vertical",fontFamily:"Plus Jakarta Sans, sans-serif"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <PrimaryBtn onClick={save} disabled={!form.name}>Save Player</PrimaryBtn>
            <GhostBtn onClick={()=>setShowForm(false)}>Cancel</GhostBtn>
          </div>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {players.map((p,i)=>(
          <button key={p.id} onClick={()=>goToPlayer(p)} className={`card-hover fade-up-${Math.min(i+1,5)}`} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",textAlign:"left",width:"100%",backgroundImage:C.stripe,boxShadow:"0 4px 16px #00000040",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,right:0,background:`linear-gradient(135deg,${C.red},${C.redDim})`,padding:"6px 14px 10px 20px",clipPath:"polygon(20px 0,100% 0,100% 100%,0 100%)",fontFamily:"Bebas Neue, sans-serif",fontSize:14,letterSpacing:2,color:"#fff"}}>{p.position}</div>
            <div style={{display:"flex",alignItems:"center",gap:12,paddingRight:60}}>
              <Avatar name={p.name} size={48} photo={playerPhotos[p.id]||null} showRing/>
              <div style={{flex:1,minWidth:0}}>
                {/* Name + number */}
                <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:5}}>
                  {p.number&&<div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,color:C.gold,lineHeight:1,textShadow:`0 0 10px ${C.gold}60`}}>#{p.number}</div>}
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:18,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
                  <Tag label={p.ageGroup} color={C.textMid}/>
                  <Tag label={`Age ${p.age}`} color={C.textDim}/>
                  {p.bats&&<Tag label={`Bats ${p.bats==="S"?"Switch":p.bats}`} color={C.blue}/>}
                  {p.throws&&<Tag label={`Throws ${p.throws}`} color={C.teal}/>}
                </div>
                {(p.parents||[]).length>0&&(
                  <div style={{fontSize:11,color:C.textDim}}>👨‍👩‍👦 {p.parents.map(x=>x.name).join(" · ")}</div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Shared scanner — see components/RosterScanner.jsx */}
      {showScanner && (
        <RosterScanner
          defaultAgeGroup={AGE_GROUPS[1]}
          onClose={()=>setShowScanner(false)}
          onImport={(newPlayers)=>{
            // setPlayers is the DB-aware setter — it persists each new player
            // and surfaces save errors itself.
            setPlayers(prev => [...prev, ...newPlayers]);
            setShowScanner(false);
          }}
        />
      )}
    </div>
  );
}

// ─── ASSIGN DRILLS ────────────────────────────────────────────────────────────
function AssignDrills({players,assignments,setAsgn,drillVideos,setDrillVideos,canAccess,onUpgrade,playerVideos={},teamId,customDrills=[],setCustomDrills=()=>{}}) {
  if(canAccess && !canAccess("drills")) return <PaywallGate feature="Full Drill Library" onUpgrade={onUpgrade}/>;
  const [cat, setCat] = useState("All");
  const [selectedDrill, setSelectedDrill] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showCreateDrill, setShowCreateDrill] = useState(false);
  const [newDrill, setNewDrill] = useState({name:'',category:'Hitting',duration:'15 min',desc:'',results:''});
  const [saving, setSaving] = useState(false);

  const filteredDrills = getAllDrills().filter(d => cat==="All" || d.category===cat);

  const handleCreateDrill = async () => {
    if(!newDrill.name.trim() || !newDrill.desc.trim()) return;
    setSaving(true);
    const drillId = 'custom_' + uid();
    const drillObj = { id:drillId, name:newDrill.name.trim(), category:newDrill.category, duration:newDrill.duration.trim()||'15 min', desc:newDrill.desc.trim(), results:newDrill.results.trim(), isCustom:true };
    setCustomDrills(prev => [...prev, drillObj]);
    if(teamId) {
      await supabase.from('custom_drills').insert({ id:drillId, team_id:teamId, name:drillObj.name, category:drillObj.category, duration:drillObj.duration, description:drillObj.desc, results:drillObj.results });
    }
    setSaving(false);
    setNewDrill({name:'',category:'Hitting',duration:'15 min',desc:'',results:''});
    setShowCreateDrill(false);
  };

  const handleDeleteCustomDrill = async (drillId) => {
    setCustomDrills(prev => prev.filter(d => d.id !== drillId));
    if(teamId) await supabase.from('custom_drills').delete().eq('id', drillId);
  };

  const isAssigned = (pid, drillId) => assignments.some(a => a.playerId===pid && a.drillId===drillId);

  const togglePlayer = (pid) => {
    if(!selectedDrill) return;
    if(isAssigned(pid, selectedDrill.id)){
      // setAsgn is the DB-aware setter — it persists the delete itself.
      setAsgn(prev => prev.filter(a => !(a.playerId===pid && a.drillId===selectedDrill.id)));
    } else {
      const newA = {id:uid(), playerId:pid, drillId:selectedDrill.id, assignedDate:new Date().toISOString().slice(0,10), completed:false, coachRating:null, notes:"", acknowledged:false, createdAt:Date.now()};
      // setAsgn is the DB-aware setter — it persists the insert AND sends the parent push notification itself.
      setAsgn(prev => [...prev, newA]);
    }
  };

  return (
    <div>
      <NewCoachCard page="drills"/>
      <SectionHead accent tip="Tap a drill to assign it to one or more players. They'll see it instantly in their parent app.">Assign Drills</SectionHead>

      {/* Create Custom Drill Button */}
      {!showCreateDrill && (
        <button onClick={()=>setShowCreateDrill(true)} className="btn-press" style={{width:"100%",padding:"14px",borderRadius:12,background:`${C.gold}15`,border:`1.5px dashed ${C.gold}60`,color:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{fontSize:18}}>+</span> Create Custom Drill
        </button>
      )}

      {/* Create Custom Drill Form */}
      {showCreateDrill && (
        <div style={{background:C.card,border:`1px solid ${C.gold}40`,borderRadius:16,padding:"20px 18px",marginBottom:16,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.gold},${C.red})`}}/>
          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,letterSpacing:1,color:"#fff",marginBottom:16,textAlign:"center"}}>Create Custom Drill</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1,color:C.textDim,textTransform:"uppercase",marginBottom:4}}>Drill Name *</div>
              <input value={newDrill.name} onChange={e=>setNewDrill(p=>({...p,name:e.target.value}))} placeholder="e.g. Line Drive Derby" style={{width:"100%",padding:"10px 12px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1,color:C.textDim,textTransform:"uppercase",marginBottom:4}}>Category</div>
                <select value={newDrill.category} onChange={e=>setNewDrill(p=>({...p,category:e.target.value}))} style={{width:"100%",padding:"10px 12px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box",appearance:"auto"}}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1,color:C.textDim,textTransform:"uppercase",marginBottom:4}}>Duration</div>
                <input value={newDrill.duration} onChange={e=>setNewDrill(p=>({...p,duration:e.target.value}))} placeholder="15 min" style={{width:"100%",padding:"10px 12px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              </div>
            </div>
            <div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1,color:C.textDim,textTransform:"uppercase",marginBottom:4}}>Description *</div>
              <textarea value={newDrill.desc} onChange={e=>setNewDrill(p=>({...p,desc:e.target.value}))} placeholder="Describe the drill setup, steps, and how to run it..." rows={3} style={{width:"100%",padding:"10px 12px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:"#fff",fontSize:14,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>
            <div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1,color:C.textDim,textTransform:"uppercase",marginBottom:4}}>Expected Results <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></div>
              <textarea value={newDrill.results} onChange={e=>setNewDrill(p=>({...p,results:e.target.value}))} placeholder="What should players improve at after doing this drill?" rows={2} style={{width:"100%",padding:"10px 12px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:"#fff",fontSize:14,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>
            <div style={{display:"flex",gap:10,marginTop:4}}>
              <button onClick={()=>{setShowCreateDrill(false);setNewDrill({name:'',category:'Hitting',duration:'15 min',desc:'',results:''});}} style={{flex:1,padding:"12px",borderRadius:10,background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>Cancel</button>
              <button onClick={handleCreateDrill} disabled={saving||!newDrill.name.trim()||!newDrill.desc.trim()} className="btn-press" style={{flex:2,padding:"12px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},${C.gold}cc)`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",opacity:saving||!newDrill.name.trim()||!newDrill.desc.trim()?0.5:1}}>{saving?'Saving...':'Save Drill'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:16}}>
        <div style={{display:"flex",gap:8,paddingBottom:4,width:"max-content"}}>
          {["All",...CATEGORIES].map(c=>{
            const color = c==="All" ? C.red : catColor(c);
            const active = cat===c;
            return (
              <button key={c} onClick={()=>setCat(c)} style={{padding:"8px 16px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap",minHeight:36,flexShrink:0,transition:"all 0.15s",border:`1px solid ${active?color:C.border}`,background:active?`${color}28`:"transparent",color:active?color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",boxShadow:active?`0 0 12px ${color}40`:"none"}}>
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Drill list */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filteredDrills.map((drill,i) => {
          const cc = catColor(drill.category);
          const assignedCount = players.filter(p => isAssigned(p.id, drill.id)).length;
          const isOpen = expanded===drill.id;
          const isSelected = selectedDrill?.id===drill.id;

          return (
            <div key={drill.id} style={{background:isSelected?`${C.teal}10`:C.card, border:`1px solid ${isSelected?C.teal+"60":C.border}`, borderRadius:14, overflow:"hidden", transition:"all 0.2s", boxShadow:isSelected?`0 0 20px ${C.teal}15`:"none"}}>

              {/* Drill header row — tap to select */}
              <button onClick={()=>{ setSelectedDrill(isSelected?null:drill); setExpanded(isSelected?null:drill.id); }}
                style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"transparent",border:"none",textAlign:"left",cursor:"pointer",minHeight:56}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:cc,boxShadow:`0 0 8px ${cc}80`,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:16,color:C.text,marginBottom:2,display:"flex",alignItems:"center",gap:6}}>{drill.name}{drill.isCustom&&<span style={{padding:"1px 6px",borderRadius:6,background:`${C.gold}20`,border:`1px solid ${C.gold}50`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:8,letterSpacing:1,color:C.gold,textTransform:"uppercase"}}>Custom</span>}</div>
                  <div style={{display:"flex",gap:6}}><Tag label={drill.category} color={cc} small/><Tag label={drill.duration} color={C.textDim} small/></div>
                </div>
                {assignedCount>0 && (
                  <div style={{padding:"3px 9px",borderRadius:8,background:`${C.teal}20`,border:`1px solid ${C.teal}40`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.teal,whiteSpace:"nowrap"}}>
                    {assignedCount} player{assignedCount!==1?"s":""}
                  </div>
                )}
                <div style={{fontSize:14,color:isSelected?C.teal:C.textDim,transition:"transform 0.2s",transform:isOpen?"rotate(90deg)":"none"}}>›</div>
              </button>

              {/* Expanded: drill info + player picker */}
              {isOpen && (
                <div style={{padding:"0 16px 16px"}}>
                  <div style={{fontSize:13,color:C.textMid,lineHeight:1.6,marginBottom:8}}>{drill.desc}</div>
                  {drill.results&&<div style={{fontSize:12,color:`${C.teal}cc`,lineHeight:1.55,marginBottom:12,paddingLeft:10,borderLeft:`2px solid ${C.teal}40`}}><span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:C.teal,marginRight:6}}>Goal:</span>{drill.results}</div>}
                  <DrillVideoBlock drillId={drill.id} drillVideos={drillVideos} setDrillVideos={setDrillVideos} coachMode={true} teamId={teamId}/>

                  {/* Player selector */}
                  <div style={{marginTop:14}}>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:10}}>Assign to Players</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {players.map(p => {
                        const on = isAssigned(p.id, drill.id);
                        return (
                          <button key={p.id} onClick={()=>togglePlayer(p.id)}
                            style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,background:on?`${C.teal}15`:"transparent",border:`1px solid ${on?C.teal+"60":C.border}`,cursor:"pointer",transition:"all 0.15s",textAlign:"left",minHeight:50}}>
                            <Avatar name={p.name} size={34}/>
                            <div style={{flex:1}}>
                              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,color:on?C.teal:C.text}}>{p.name}</div>
                              <div style={{fontSize:11,color:C.textDim}}>{p.position} · #{p.number}</div>
                            </div>
                            <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${on?C.teal:C.border}`,background:on?C.teal:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                              {on&&<div style={{color:"#000",fontSize:12,fontWeight:900}}>✓</div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {drill.isCustom && (
                    <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                      <button onClick={(e)=>{e.stopPropagation();if(window.confirm(`Delete custom drill "${drill.name}"? Any existing assignments using this drill will remain but the drill details won't be visible.`)){handleDeleteCustomDrill(drill.id);setSelectedDrill(null);setExpanded(null);}}} style={{padding:"8px 16px",borderRadius:8,background:`${C.red}15`,border:`1px solid ${C.red}40`,color:C.red,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>🗑 Delete Custom Drill</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────

function Schedule({events,setEvents,gamePlans={},setGamePlans=()=>{},players=[],lineups={},setLineups=()=>{},teamId,canAccess=()=>true,onUpgrade=()=>{},session=null}) {
  const [view,      setView]      = useState("list"); // "list" | "form"
  const [formTab,   setFormTab]   = useState("info"); // "info"|"lineup"|"pitching"|"situations"
  const [editId,    setEditId]    = useState(null);
  const [formEvId,  setFormEvId]  = useState(null);
  const blank={type:"practice",date:"",time:"",fieldName:"",address:"",notes:"",opponent:"",uniform:""};
  const [form, setForm] = useState(blank);
  const ff=(k,v)=>setForm(p=>({...p,[k]:v}));

  // ── Schedule scanner state ──
  const [showScanner, setShowScanner] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scannedEvents, setScannedEvents] = useState([]); // array of extracted events being reviewed
  const scanFileRef = useRef(null);

  // ── RSVP state ──
  const [rsvpsByEvent, setRsvpsByEvent] = useState({}); // {eventId: [{player_id, player_name, status}]}
  const [rsvpDetail, setRsvpDetail] = useState(null); // event id whose RSVP detail is shown

  // Load RSVPs for all events
  useEffect(()=>{
    if(!teamId || events.length===0) return;
    const eventIds = events.map(e=>e.id);
    supabase.from("event_rsvps").select("*").eq("team_id",teamId).in("event_id",eventIds).then(({data})=>{
      if(!data) return;
      const grouped = {};
      data.forEach(r=>{
        if(!grouped[r.event_id]) grouped[r.event_id]=[];
        grouped[r.event_id].push({player_id:r.player_id,player_name:r.player_name,status:r.status});
      });
      setRsvpsByEvent(grouped);
    });
  },[teamId, events.length]);


  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    setScanError("");
    setScanLoading(true);
    setScannedEvents([]);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve,reject)=>{
        reader.onload = ()=>{
          const result = reader.result;
          const b64 = result.split(',')[1];
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`https://hcadlkmejdekhbgfvyaq.supabase.co/functions/v1/scan-schedule`, {
        method: "POST",
        headers: await scanAuthHeaders(),
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: file.type || "image/jpeg",
          currentYear: new Date().getFullYear(),
        }),
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      if(!data.events || data.events.length===0) {
        setScanError("No events could be detected in this image. Try a clearer photo or a different section of the schedule.");
      } else {
        // Add local edit IDs to each event for tracking
        setScannedEvents(data.events.map((ev,i)=>({...ev, _localId:`scan_${Date.now()}_${i}`, _include:true})));
      }
    } catch(err) {
      setScanError("Scan failed: " + (err.message||String(err)));
    } finally {
      setScanLoading(false);
      if(scanFileRef.current) scanFileRef.current.value = "";
    }
  };

  const updateScannedEvent = (localId, field, value) => {
    setScannedEvents(prev => prev.map(ev => ev._localId===localId ? {...ev, [field]:value} : ev));
  };

  const toggleScannedEvent = (localId) => {
    setScannedEvents(prev => prev.map(ev => ev._localId===localId ? {...ev, _include:!ev._include} : ev));
  };

  const removeScannedEvent = (localId) => {
    setScannedEvents(prev => prev.filter(ev => ev._localId!==localId));
  };

  const importScannedEvents = async () => {
    const toAdd = scannedEvents.filter(ev => ev._include && ev.date);
    if(toAdd.length===0) return;
    // Dedupe: skip any scanned event that already exists (same date + opponent +
    // time). Without this, re-scanning the same schedule stacks duplicates.
    const key = ev => [ev.date, (ev.opponent||"").trim().toLowerCase(), (ev.time||"").trim()].join("|");
    const existing = new Set(events.map(key));
    const fresh = [];
    let skipped = 0;
    for(const ev of toAdd){
      const k = key(ev);
      if(existing.has(k)){ skipped++; continue; }
      existing.add(k); // also dedupes within the scan itself
      fresh.push(ev);
    }
    const newEvents = fresh.map(ev => ({
      id: uid(),
      createdAt: Date.now(),
      type: ev.type==="game"?"game":"practice",
      date: ev.date,
      time: ev.time||"",
      fieldName: ev.fieldName||"",
      address: ev.address||"",
      location: [ev.fieldName, ev.address].filter(Boolean).join(" — "),
      opponent: ev.opponent||"",
      uniform: "",
      notes: "",
    }));
    // setEvents is the DB-aware setter — it persists each new event itself.
    if(newEvents.length > 0) setEvents(prev => [...prev, ...newEvents]);
    setShowScanner(false);
    setScannedEvents([]);
    setScanError("");
    if(skipped > 0 && newEvents.length > 0) toast.success(`Added ${newEvents.length} event${newEvents.length!==1?"s":""} — skipped ${skipped} already on your schedule.`);
    else if(skipped > 0) toast.success(`All ${skipped} scanned event${skipped!==1?"s":""} are already on your schedule — nothing added.`);
    else toast.success(`Added ${newEvents.length} event${newEvents.length!==1?"s":""} to your schedule.`);
  };

  // ── Lineup tap-to-select state ──
  const [selectedPid,      setSelectedPid]      = useState(null);
  const [selectedFieldPid, setSelectedFieldPid] = useState(null);

  const lu       = formEvId ? (lineups[formEvId]||{batting:Array(9).fill(null),positions:{}}) : {batting:Array(9).fill(null),positions:{}};
  const saveLu   = next => setLineups(prev=>({...prev,[formEvId]:next}));
  const gp       = formEvId ? (gamePlans[formEvId]||{}) : {};
  const setGP    = (field,val) => setGamePlans(prev=>({...prev,[formEvId]:{...(prev[formEvId]||{}),[field]:val}}));

  const playerById  = id => players.find(p=>p.id===id);
  const inBatting   = pid => lu.batting.includes(pid);
  const battingBench = players.filter(p=>!inBatting(p.id));

  const setBattingSlot=(idx,pid)=>{const n=[...lu.batting];const e=n.indexOf(pid);if(e!==-1&&e!==idx)n[e]=null;n[idx]=pid;saveLu({...lu,batting:n,shared:true});setGamePlans(prev=>({...prev,[formEvId]:{...(prev[formEvId]||{}),shared:true}}));};
  const clearBattingSlot=idx=>{const n=[...lu.batting];n[idx]=null;saveLu({...lu,batting:n});};
  const swapBatting=(a,b)=>{const n=[...lu.batting];[n[a],n[b]]=[n[b],n[a]];saveLu({...lu,batting:n});};
  const setFieldPos=(pos,pid)=>{const n={...lu.positions};Object.keys(n).forEach(k=>{if(n[k]===pid)delete n[k];});if(pid)n[pos]=pid;else delete n[pos];saveLu({...lu,positions:n,shared:true});setGamePlans(prev=>({...prev,[formEvId]:{...(prev[formEvId]||{}),shared:true}}));};

  const handleSlotTap=idx=>{
    const pid=lu.batting[idx];
    if(selectedPid){
      if(selectedPid===pid){setSelectedPid(null);return;}
      const n=[...lu.batting];const fromIdx=n.indexOf(selectedPid);
      if(fromIdx!==-1)n[fromIdx]=pid||null;
      n[idx]=selectedPid;saveLu({...lu,batting:n});setSelectedPid(null);
    } else if(pid) setSelectedPid(pid);
  };
  const handleFieldTap=pos=>{
    if(!selectedFieldPid)return;
    const n={...lu.positions};Object.keys(n).forEach(k=>{if(n[k]===selectedFieldPid)delete n[k];});
    const displaced=n[pos];
    if(displaced){const oldPos=Object.entries(lu.positions).find(([k,v])=>v===selectedFieldPid)?.[0];if(oldPos)n[oldPos]=displaced;}
    n[pos]=selectedFieldPid;saveLu({...lu,positions:n});setSelectedFieldPid(null);
  };

  const openNew=()=>{
    const id=uid(); setFormEvId(id); setEditId(null); setForm(blank);
    setFormTab("info"); setSelectedPid(null); setSelectedFieldPid(null);
    setView("form");
  };
  const openEdit=ev=>{
    const parts=(ev.location||"").split(" — ");
    setFormEvId(ev.id); setEditId(ev.id);
    setForm({type:ev.type,date:ev.date,time:ev.time,fieldName:parts[0]||"",address:parts[1]||"",notes:ev.notes,opponent:ev.opponent||"",uniform:ev.uniform||""});
    setFormTab("info"); setSelectedPid(null); setSelectedFieldPid(null);
    setView("form");
  };
  const save=async ()=>{
    if(!form.date||!form.fieldName)return;
    const location=[form.fieldName,form.address].filter(Boolean).join(" — ");
    const row = {id:formEvId, team_id:teamId, type:form.type, date:form.date, time:form.time||'',
      field_name:form.fieldName, address:form.address||'', notes:form.notes||'', opponent:form.opponent||'', uniform:form.uniform||''};
    const isNew = !editId;
    const isDup = (e) => e && (e.code==='23505' || /duplicate key|already exists/i.test(e.message||''));
    // Snapshot form values now — we switch the view immediately, so don't rely on form state later.
    const snapForm = {...form};
    const evId = formEvId;
    const curLu = lineups[evId];
    const curGp = gamePlans[evId];

    // ── Update UI immediately so the form closes right away ──
    if(editId){
      setEvents(prev=>prev.map(e=>e.id===editId?{...e,...snapForm,location}:e));
    } else {
      setEvents(prev=>[...prev,{id:evId,...snapForm,location,createdAt:Date.now()}]);
    }
    setView("list");

    // ── Persist in the background (doesn't block the UI) ──
    if(teamId){
      try {
        const {error} = editId
          ? await supabase.from('events').update(row).eq('id',editId)
          : await supabase.from('events').insert(row);
        if(error && !isDup(error)){
          console.error('Event save failed:', error.message);
          toast.error("Couldn't save the event. Please try again.");
          return;
        }
      } catch(err) {
        if(!isDup(err)){
          console.error('Event save threw:', err);
          toast.error("Couldn't save the event. Please try again.");
          return;
        }
      }

      // Parent push for new events (best-effort)
      if(isNew){
        const dateStr = snapForm.date ? new Date(snapForm.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '';
        const typeLabel = snapForm.type==='game' ? 'Game' : 'Practice';
        sendPushNotification(teamId, `New ${typeLabel} Scheduled`, `${typeLabel} on ${dateStr}${snapForm.time?' at '+snapForm.time:''}${snapForm.opponent?' vs '+snapForm.opponent:''}`, session?.user?.id);
      }

      // Lineup + game plan (event now exists, so FK is satisfied)
      try {
        if(curLu && ((curLu.batting||[]).some(Boolean)||Object.keys(curLu.positions||{}).length>0)){
          const {error}=await supabase.from('lineups').upsert({event_id:evId,team_id:teamId,batting:curLu.batting||[],positions:curLu.positions||{},shared:curLu.shared!==false,updated_at:new Date().toISOString()},{onConflict:'event_id'});
          if(error) console.error('Lineup save failed:',error.message);
        }
        if(curGp && Object.keys(curGp).length>0){
          const {error}=await supabase.from('game_plans').upsert({event_id:evId,team_id:teamId,pitcher:curGp.pitcher||'',defense:curGp.defense||'',offense:curGp.offense||'',notes:curGp.notes||'',shared:curGp.shared||false,updated_at:new Date().toISOString()},{onConflict:'event_id'});
          if(error) console.error('GamePlan save failed:',error.message);
        }
      } catch(err) {
        console.error('Lineup/GamePlan save threw (event still saved):', err);
      }
    }

    toast.success(isNew ? "Event created." : "Event updated.");
  };
  const cancel=()=>{
    if(!editId){
      setGamePlans(prev=>{const n={...prev};delete n[formEvId];return n;});
      setLineups(prev=>{const n={...prev};delete n[formEvId];return n;});
    }
    setView("list");
  };
  const del=id=>{
    setEvents(prev=>prev.filter(e=>e.id!==id));
    setGamePlans(prev=>{const n={...prev};delete n[id];return n;});
    setLineups(prev=>{const n={...prev};delete n[id];return n;});
    if(teamId) supabase.from('events').delete().eq('id',id)
      .then(({error})=>{ if(error) console.error('Event delete failed:',error.message); });
  };
  const todayStr=new Date().toISOString().slice(0,10);
  const [schedView, setSchedView] = useState("upcoming"); // "upcoming" | "past"
  const upcomingEvents=[...events].filter(e=>e.date>=todayStr).sort((a,b)=>a.date.localeCompare(b.date));
  const pastEvents=[...events].filter(e=>e.date<todayStr).sort((a,b)=>b.date.localeCompare(a.date)); // newest first
  const sorted = schedView==="past" ? pastEvents : upcomingEvents;
  const isGame=form.type==="game";
  const formTabs=isGame?[{id:"info",label:"🔴 Info"},{id:"batting",label:"🔴 Batting Order"},{id:"field",label:"🔴 Field Positions"}]:[];

  // ── FORM VIEW ────────────────────────────────────────────────────────────────
  if(view==="form") return (
    <div>
      <button onClick={cancel} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.red,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:1,cursor:"pointer",padding:"0 0 14px",minHeight:36}}>‹ Schedule</button>

      {/* Header card */}
      <div style={{background:`linear-gradient(135deg,#100c1a,${C.card})`,borderRadius:16,border:`1px solid ${isGame?C.red+"40":C.blue+"40"}`,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,letterSpacing:3,color:isGame?C.red:C.blue,marginBottom:2}}>
          {editId?(isGame?"EDIT GAME":"EDIT PRACTICE"):(isGame?"NEW GAME":"NEW PRACTICE")}
        </div>
        {/* Type toggle (only for new events) */}
        {!editId&&(
          <div style={{display:"flex",gap:8,marginTop:10}}>
            {["practice","game"].map(t=>(
              <button key={t} onClick={()=>{ff("type",t);setFormTab("info");}} style={{flex:1,padding:"10px 0",borderRadius:10,border:`1px solid ${form.type===t?(t==="game"?C.red:C.blue):C.border}`,background:form.type===t?`${t==="game"?C.red:C.blue}20`:"transparent",color:form.type===t?(t==="game"?C.red:C.blue):C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:44}}>
                {t==="game"?"⚾ Game":"⚾ Practice"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab bar — only for games */}
      {isGame&&(
        <div style={{display:"flex",gap:0,marginBottom:18,background:C.card,borderRadius:12,padding:4,border:`1px solid ${C.border}`}}>
          {formTabs.map(t=>(
            <button key={t.id} onClick={()=>{ if((t.id==="batting"||t.id==="field") && canAccess && !canAccess("lineups")){ onUpgrade && onUpgrade(); return; } setFormTab(t.id); }} style={{flex:1,padding:"10px 0",borderRadius:9,background:formTab===t.id?`linear-gradient(135deg,${C.red},${C.redDim})`:"transparent",border:"none",color:formTab===t.id?"#fff":C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:0.8,textTransform:"uppercase",cursor:"pointer",minHeight:42,boxShadow:formTab===t.id?`0 4px 16px ${C.red}40`:"none",transition:"all 0.2s"}}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── INFO TAB (always shown for practice; tab for game) ── */}
      {(!isGame||formTab==="info")&&(
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:12}}>
            <Inp label="Date" value={form.date} type="date" onChange={e=>ff("date",e.target.value)}/>
            <Inp label="Time" value={form.time} onChange={e=>ff("time",e.target.value)} placeholder="5:30 PM"/>
          </div>
          <Inp label="Field Name" value={form.fieldName} onChange={e=>ff("fieldName",e.target.value)} placeholder="e.g. Sam Field, Field 5"/>
          <Inp label="Address" value={form.address} onChange={e=>ff("address",e.target.value)} placeholder="e.g. 1234 Main St, Springfield"/>
          {isGame&&<Inp label="Opponent" value={form.opponent} onChange={e=>ff("opponent",e.target.value)} placeholder="East Side Eagles"/>}
          {isGame&&<Inp label="Uniform Color" value={form.uniform} onChange={e=>ff("uniform",e.target.value)} placeholder="e.g. White home jersey, Gray away"/>}
          <div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Notes / Focus Areas</div>
            <textarea value={form.notes} onChange={e=>ff("notes",e.target.value)} rows={3} placeholder={isGame?"Game notes, matchup details…":"Today's practice focus…"} style={{...inp,resize:"vertical",fontFamily:"Plus Jakarta Sans, sans-serif"}}/>
          </div>

          {/* Share toggle — games only */}
          {isGame&&(()=>{ const sh = lu.shared!==false; return (
            <button onClick={()=>{const nv=!sh;saveLu({...lu,shared:nv});setGP("shared",nv);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"12px 14px",borderRadius:12,background:sh?`${C.teal}15`:`${C.card}80`,border:`1px solid ${sh?C.teal+"60":C.border}`,cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:18}}>{sh?"📢":"🔒"}</div>
                <div style={{textAlign:"left"}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:sh?C.teal:C.textMid}}>{sh?"Lineup visible to parents":"Lineup hidden from parents"}</div>
                  <div style={{fontSize:11,color:C.textDim,marginTop:1}}>{sh?"Auto-shared when you set the lineup · tap to hide":"Tap to make lineup visible to parents"}</div>
                </div>
              </div>
              <div style={{width:44,height:24,borderRadius:12,background:sh?C.teal:"#333",position:"relative",flexShrink:0,transition:"background 0.2s",boxShadow:sh?`0 0 12px ${C.teal}60`:"none"}}>
                <div style={{position:"absolute",top:3,left:sh?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px #00000060"}}/>
              </div>
            </button>
          );})()}

          <div style={{display:"flex",gap:10,marginTop:4}}>
            <PrimaryBtn onClick={save} disabled={!form.date||!form.fieldName}>{editId?"Save Changes":"Create Event"}</PrimaryBtn>
            <GhostBtn onClick={cancel}>Cancel</GhostBtn>
          </div>
          {isGame&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:11,color:C.textDim,letterSpacing:1,textAlign:"center"}}>Set Batting Order & Field Positions using the tabs above</div>}
        </div>
      )}

      {/* ── BATTING ORDER TAB ── */}
      {isGame&&formTab==="batting"&&(
        <div>
          {selectedPid&&(()=>{const sp=playerById(selectedPid);return sp?(
            <div style={{background:`${C.gold}18`,border:`1px solid ${C.gold}60`,borderRadius:12,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
              <Avatar name={sp.name} size={30}/><div style={{flex:1,fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.gold}}>{sp.name} selected — tap a slot to place them</div>
              <button onClick={()=>setSelectedPid(null)} style={{background:"none",border:"none",color:C.textDim,fontSize:18,cursor:"pointer",padding:4}}>×</button>
            </div>
          ):null;})()}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>Tap player → tap slot to place</div>
              <Tip inline text="Tap any player to select (they glow gold), then tap a slot to place them. Slots swap if occupied."/>
            </div>
            <button onClick={()=>{saveLu({...lu,batting:Array(9).fill(null)});setSelectedPid(null);}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 10px",color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>Clear</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
            {lu.batting.map((pid,idx)=>{
              const p=pid?playerById(pid):null;
              const isSelected=pid&&pid===selectedPid;
              const isTarget=!!selectedPid&&!isSelected;
              return (
                <div key={idx} onClick={()=>handleSlotTap(idx)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,background:isSelected?`linear-gradient(90deg,${C.gold}30,${C.gold}15)`:isTarget&&!p?`${C.blue}08`:p?`linear-gradient(90deg,${C.card},${C.cardAlt})`:C.card,border:`2px solid ${isSelected?C.gold:isTarget&&!p?C.blue+"50":p?C.borderBright:C.border}`,minHeight:54,cursor:"pointer",transition:"all 0.15s",boxShadow:isSelected?`0 0 16px ${C.gold}40`:isTarget&&!p?`0 0 8px ${C.blue}20`:"none"}}>
                  <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:26,color:isSelected?C.gold:p?C.gold:isTarget?C.blue:C.textDim,lineHeight:1,minWidth:26,textAlign:"center"}}>{idx+1}</div>
                  {p?(<><Avatar name={p.name} size={34}/><div style={{flex:1}}><div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:isSelected?C.gold:C.text}}>{p.name}</div><div style={{display:"flex",gap:4,marginTop:2}}><Tag label={p.position} color={isSelected?C.gold:C.red} small/></div></div>{isSelected?<div style={{fontSize:16,color:C.gold}}>✦</div>:<button onClick={e=>{e.stopPropagation();clearBattingSlot(idx);}} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:18,padding:"4px",minWidth:30,minHeight:30,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>}</>):(
                    <div style={{flex:1,fontFamily:"Barlow Condensed, sans-serif",fontSize:11,letterSpacing:2,color:isTarget?C.blue:C.textDim,textTransform:"uppercase"}}>{isTarget?"← Tap to place here":"— Empty slot —"}</div>
                  )}
                </div>
              );
            })}
          </div>
          <BenchRoster bench={battingBench} selectedPid={selectedPid} onSelectPlayer={setSelectedPid} onTapAdd={pid=>{const ei=lu.batting.indexOf(null);if(ei!==-1)setBattingSlot(ei,pid);}}/>
        </div>
      )}

      {/* ── FIELD POSITIONS TAB ── */}
      {isGame&&formTab==="field"&&(
        <div>
          <PositionLegend/>
          <FieldDiamond
            positions={lu.positions}
            playerById={playerById}
            selectedPid={selectedFieldPid}
            setFieldPos={setFieldPos}
            onSelectPos={pos=>{
              if(selectedFieldPid){
                handleFieldTap(pos);
              } else {
                const pid=lu.positions[pos];
                if(pid) setSelectedFieldPid(pid);
              }
            }}
          />
          {/* Unassigned players */}
          <div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:10}}>
              {selectedFieldPid?"Select a position on the field above":"Tap a player to select, then tap their position on the field"}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {players.filter(p=>!Object.values(lu.positions).includes(p.id)).map(p=>{
                const isSelected=p.id===selectedFieldPid;
                return (
                  <div key={p.id} onClick={()=>setSelectedFieldPid(isSelected?null:p.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:12,background:isSelected?`linear-gradient(90deg,${C.gold}25,${C.gold}10)`:C.card,border:`2px solid ${isSelected?C.gold:C.border}`,cursor:"pointer",transition:"all 0.15s",boxShadow:isSelected?`0 0 14px ${C.gold}35`:"none"}}>
                    <Avatar name={p.name} size={32}/>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:14,color:isSelected?C.gold:C.text}}>{p.name}</div>
                      <div style={{display:"flex",gap:5,marginTop:2}}>
                        {p.number&&<Tag label={`#${p.number}`} color={isSelected?C.gold:C.textDim} small/>}
                        <Tag label={p.position} color={C.textDim} small/>
                      </div>
                    </div>
                    {isSelected
                      ?<div style={{fontSize:13,color:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700}}>✦ Selected</div>
                      :<div style={{fontSize:11,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",letterSpacing:1}}>Tap to select</div>
                    }
                  </div>
                );
              })}
              {players.filter(p=>!Object.values(lu.positions).includes(p.id)).length===0&&(
                <div style={{textAlign:"center",padding:"16px 0",color:C.teal,fontFamily:"Barlow Condensed, sans-serif",fontSize:12,letterSpacing:2,textTransform:"uppercase"}}>All players assigned ✓</div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Save button pinned at bottom of non-info game tabs */}
      {isGame&&formTab!=="info"&&(
        <div style={{display:"flex",gap:10,marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
          <PrimaryBtn onClick={save} disabled={!form.date||!form.fieldName}>{editId?"Save Changes":"Create Event"}</PrimaryBtn>
          <GhostBtn onClick={cancel}>Cancel</GhostBtn>
        </div>
      )}
    </div>
  );

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div>
      <NewCoachCard page="schedule"/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,gap:8}}>
        <SectionHead accent>Schedule</SectionHead>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowScanner(true)} style={{padding:"10px 14px",borderRadius:10,background:`linear-gradient(135deg,${C.teal},#0a8a72)`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 4px 16px ${C.teal}40`,display:"flex",alignItems:"center",gap:6}}>📸 Scan</button>
          <PrimaryBtn onClick={openNew}>+ Event</PrimaryBtn>
        </div>
      </div>
      {/* Upcoming / Past toggle — past events are kept, not lost. Shown whenever any past events exist. */}
      {pastEvents.length>0&&(
        <div style={{display:"flex",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:3,gap:2,marginBottom:14}}>
          {[["upcoming",`Upcoming (${upcomingEvents.length})`],["past",`Past (${pastEvents.length})`]].map(([k,label])=>(
            <button key={k} onClick={()=>setSchedView(k)} style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",background:schedView===k?C.red:"transparent",color:schedView===k?"#fff":C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s"}}>{label}</button>
          ))}
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {sorted.map((ev,i)=>{
          const isG=ev.type==="game"; const ec=isG?C.red:C.blue;
          const luu=lineups[ev.id]||{};
          const hasLineup=(luu.batting||[]).some(Boolean)||Object.keys(luu.positions||{}).length>0;
          const hasGamePlan=isG&&hasLineup;
          return (
            <div key={ev.id} className={`fade-up-${Math.min(i+1,5)}`} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",boxShadow:"0 4px 16px #00000040"}}>
              <div style={{background:`linear-gradient(90deg,${ec}18,transparent)`,padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                  <div style={{textAlign:"center",minWidth:48,flexShrink:0}}>
                    <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:34,color:ec,lineHeight:1,textShadow:`0 0 16px ${ec}80`}}>{new Date(ev.date+"T12:00:00").getDate()}</div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim}}>{new Date(ev.date+"T12:00:00").toLocaleString("en-US",{month:"short"}).toUpperCase()}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                      <Tag label={isG?"⚾ Game":"⚾ Practice"} color={ec}/>
                      {hasGamePlan&&<Tag label="📋 Plan Ready" color={C.gold} small/>}
                      {hasLineup&&<Tag label="👥 Lineup Set" color={C.teal} small/>}
                    </div>
                    {ev.opponent&&<div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,color:C.text,letterSpacing:1,marginBottom:4}}>vs. {ev.opponent}</div>}
                    <MapLink location={ev.location} isGame={isG}/>
                    <div style={{fontSize:13,color:C.textMid}}>🕐 {ev.time}</div>
                    {ev.notes&&<div style={{fontSize:12,color:C.textMid,marginTop:6,fontStyle:"italic",opacity:0.8}}>{ev.notes}</div>}
                    {ev.uniform&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}><span style={{fontSize:14}}>👕</span><div style={{fontSize:12,color:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:0.5}}>Wear: {ev.uniform}</div></div>}
                  </div>
                </div>
                {/* RSVP Summary Bar */}
                {(()=>{
                  const evRsvps = rsvpsByEvent[ev.id] || [];
                  const going = evRsvps.filter(r=>r.status==="going").length;
                  const out = evRsvps.filter(r=>r.status==="out").length;
                  const maybe = evRsvps.filter(r=>r.status==="maybe").length;
                  const noResponse = Math.max(0, players.length - evRsvps.length);
                  if(players.length===0) return null;
                  return (
                    <button onClick={(e)=>{e.stopPropagation();setRsvpDetail(ev.id);}} style={{display:"flex",alignItems:"center",gap:10,marginTop:10,padding:"8px 12px",background:`${C.bg}`,border:`1px solid ${C.border}`,borderRadius:10,cursor:"pointer",width:"100%",textAlign:"left"}}>
                      <span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,color:C.textDim,textTransform:"uppercase"}}>RSVP</span>
                      <div style={{display:"flex",gap:8,flex:1,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12}}>
                        <span style={{color:C.teal}}>✓ {going}</span>
                        <span style={{color:C.red}}>✗ {out}</span>
                        <span style={{color:C.gold}}>? {maybe}</span>
                        {noResponse>0&&<span style={{color:C.textDim}}>· {noResponse} pending</span>}
                      </div>
                      <span style={{color:C.textDim,fontSize:14}}>›</span>
                    </button>
                  );
                })()}
              </div>
              <div style={{display:"flex"}}>
                <button onClick={()=>openEdit(ev)} style={{flex:2,padding:"11px 0",background:hasGamePlan?`${C.gold}10`:"transparent",border:"none",borderRight:`1px solid ${C.border}`,color:hasGamePlan?C.gold:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",minHeight:44}}>
                  ✏️ {isG?(hasGamePlan?"Edit Game Plan":"Edit / Add Plan"):"Edit"}
                </button>
                <button onClick={()=>del(ev.id)} style={{flex:1,padding:"11px 0",background:"transparent",border:"none",color:C.red+"99",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",minHeight:44}}>Delete</button>
              </div>
            </div>
          );
        })}
        {sorted.length===0&&schedView==="upcoming"&&pastEvents.length>0&&<EmptyState icon="📅" title="No upcoming events" body={`Nothing scheduled ahead — but you have ${pastEvents.length} past event${pastEvents.length!==1?"s":""} saved. Tap "Past" above to see them, or add what's next.`} action="Add Event" onAction={openNew}/>}
        {sorted.length===0&&schedView==="upcoming"&&pastEvents.length===0&&<EmptyState icon="📅" title="No events scheduled" body="Add your first practice or game. Parents will automatically see upcoming events in their app." action="Add First Event" onAction={openNew}/>}
        {sorted.length===0&&schedView==="past"&&<EmptyState icon="📅" title="No past events" body="Events automatically move here once their date has passed."/>}
      </div>

      {/* ── RSVP DETAIL MODAL ─────────────────────────────────────────────── */}
      {rsvpDetail && (()=>{
        const ev = events.find(e=>e.id===rsvpDetail);
        if(!ev) return null;
        const evRsvps = rsvpsByEvent[ev.id] || [];
        const rsvpMap = {};
        evRsvps.forEach(r=>{ rsvpMap[r.player_id]=r.status; });
        const groupedPlayers = {
          going: players.filter(p=>rsvpMap[p.id]==="going"),
          maybe: players.filter(p=>rsvpMap[p.id]==="maybe"),
          out: players.filter(p=>rsvpMap[p.id]==="out"),
          pending: players.filter(p=>!rsvpMap[p.id]),
        };
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setRsvpDetail(null)}>
            <div onClick={(e)=>e.stopPropagation()} style={{width:"100%",maxWidth:560,boxSizing:"border-box",background:C.bg,borderRadius:"20px 20px 0 0",padding:"20px 16px 32px",boxShadow:"0 -8px 40px #000",maxHeight:"85vh",overflowY:"auto"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,letterSpacing:2,color:"#fff",lineHeight:1}}>RSVP Status</div>
                  <div style={{fontSize:12,color:C.textDim,marginTop:4}}>{ev.opponent?`vs. ${ev.opponent}`:"Practice"} · {new Date(ev.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
                </div>
                <button onClick={()=>setRsvpDetail(null)} style={{width:36,height:36,borderRadius:10,background:"#ffffff10",border:`1px solid #ffffff20`,color:"#fff",fontSize:16,cursor:"pointer"}}>✕</button>
              </div>
              {[
                {key:"going", label:"Going", color:C.teal, icon:"✓"},
                {key:"maybe", label:"Maybe", color:C.gold, icon:"?"},
                {key:"out",   label:"Can't Make It", color:C.red, icon:"✗"},
                {key:"pending", label:"No Response Yet", color:C.textDim, icon:"·"},
              ].map(group=>{
                const list = groupedPlayers[group.key];
                if(list.length===0) return null;
                return (
                  <div key={group.key} style={{marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:`${group.color}25`,border:`1px solid ${group.color}50`,display:"flex",alignItems:"center",justifyContent:"center",color:group.color,fontSize:13,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700}}>{group.icon}</div>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:group.color,letterSpacing:1.5,textTransform:"uppercase"}}>{group.label} · {list.length}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {list.map(p=>(
                        <div key={p.id} style={{padding:"10px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,fontSize:14,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif"}}>
                          {p.name} {p.number?<span style={{color:C.textDim,fontSize:12}}>· #{p.number}</span>:null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── SCHEDULE SCANNER MODAL ───────────────────────────────────────── */}
      {showScanner && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{width:"100%",maxWidth:560,boxSizing:"border-box",background:C.bg,borderRadius:"20px 20px 0 0",padding:"20px 16px 32px",boxShadow:"0 -8px 40px #000",maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column"}}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:26,letterSpacing:2,color:"#fff",lineHeight:1}}>📸 Scan Schedule</div>
                <div style={{fontSize:12,color:C.textDim,marginTop:4}}>Upload a photo, let AI extract the events</div>
              </div>
              <button onClick={()=>{setShowScanner(false);setScannedEvents([]);setScanError("");}} style={{width:36,height:36,borderRadius:10,background:"#ffffff10",border:`1px solid #ffffff20`,color:"#fff",fontSize:16,cursor:"pointer"}}>✕</button>
            </div>

            {/* Upload area (shown when no events scanned yet) */}
            {scannedEvents.length===0 && !scanLoading && (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <button onClick={()=>scanFileRef.current?.click()} style={{padding:"40px 20px",borderRadius:16,background:`${C.teal}10`,border:`2px dashed ${C.teal}60`,color:C.teal,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                  <div style={{fontSize:36}}>📷</div>
                  <div>Tap to upload schedule photo</div>
                  <div style={{fontSize:11,color:C.textDim,fontFamily:"Plus Jakarta Sans, sans-serif",fontWeight:400,letterSpacing:0,textTransform:"none"}}>PDF screenshot, photo, or email — anything readable works</div>
                </button>
                <input ref={scanFileRef} type="file" accept="image/*" onChange={handleScanFile} style={{display:"none"}}/>
                {scanError && <div style={{padding:"12px 14px",borderRadius:10,background:`${C.red}15`,border:`1px solid ${C.red}40`,color:C.red,fontSize:13,lineHeight:1.5}}>⚠️ {scanError}</div>}
                <div style={{padding:"14px 16px",background:C.card,borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.textMid,lineHeight:1.6}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:11,letterSpacing:2,color:C.gold,textTransform:"uppercase",marginBottom:6}}>💡 Tips</div>
                  • Clear, well-lit photos work best<br/>
                  • Make sure dates and times are readable<br/>
                  • You can review and edit everything before adding
                </div>
              </div>
            )}

            {/* Loading state */}
            {scanLoading && (
              <div style={{padding:"60px 20px",textAlign:"center"}}>
                <div style={{display:"inline-block",width:36,height:36,border:`3px solid ${C.teal}30`,borderTopColor:C.teal,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,color:C.textMid,letterSpacing:2,textTransform:"uppercase",marginTop:14}}>Reading schedule...</div>
                <div style={{fontSize:12,color:C.textDim,marginTop:6}}>This usually takes 5-10 seconds</div>
              </div>
            )}

            {/* Review / edit scanned events */}
            {scannedEvents.length>0 && !scanLoading && (
              <div>
                <div style={{padding:"12px 14px",borderRadius:10,background:`${C.teal}15`,border:`1px solid ${C.teal}40`,color:C.teal,fontSize:13,marginBottom:14,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1}}>✓ Found {scannedEvents.length} event{scannedEvents.length!==1?'s':''} — review and edit below</div>
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                  {scannedEvents.map(ev=>(
                    <div key={ev._localId} style={{background:ev._include?C.card:"#0a1525",border:`1px solid ${ev._include?(ev.type==="game"?C.red+"40":C.blue+"40"):C.border}`,borderRadius:12,padding:"12px 14px",opacity:ev._include?1:0.5,transition:"all 0.2s"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <button onClick={()=>toggleScannedEvent(ev._localId)} style={{width:22,height:22,borderRadius:6,background:ev._include?C.teal:"transparent",border:`1.5px solid ${ev._include?C.teal:C.border}`,cursor:"pointer",color:"#fff",fontSize:13,flexShrink:0}}>{ev._include?"✓":""}</button>
                        <select value={ev.type} onChange={e=>updateScannedEvent(ev._localId,"type",e.target.value)} style={{padding:"5px 8px",borderRadius:8,background:ev.type==="game"?`${C.red}20`:`${C.blue}20`,border:`1px solid ${ev.type==="game"?C.red+"60":C.blue+"60"}`,color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,textTransform:"uppercase",cursor:"pointer"}}>
                          <option value="game">🔴 Game</option>
                          <option value="practice">🔵 Practice</option>
                        </select>
                        <button onClick={()=>removeScannedEvent(ev._localId)} style={{marginLeft:"auto",background:"transparent",border:"none",color:C.red+"99",fontSize:16,cursor:"pointer",padding:4}}>🗑</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:8,marginBottom:8}}>
                        <input type="date" value={ev.date} onChange={e=>updateScannedEvent(ev._localId,"date",e.target.value)} style={{width:"100%",minWidth:0,boxSizing:"border-box",padding:"8px 10px",borderRadius:8,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13,outline:"none"}}/>
                        <input value={ev.time} onChange={e=>updateScannedEvent(ev._localId,"time",e.target.value)} placeholder="5:30 PM" style={{width:"100%",minWidth:0,boxSizing:"border-box",padding:"8px 10px",borderRadius:8,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13,outline:"none"}}/>
                      </div>
                      {ev.type==="game" && <input value={ev.opponent} onChange={e=>updateScannedEvent(ev._localId,"opponent",e.target.value)} placeholder="Opponent" style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",borderRadius:8,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13,marginBottom:8,outline:"none"}}/>}
                      <input value={ev.fieldName} onChange={e=>updateScannedEvent(ev._localId,"fieldName",e.target.value)} placeholder="Field / Location" style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",borderRadius:8,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13,outline:"none"}}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={importScannedEvents} disabled={scannedEvents.filter(e=>e._include && e.date).length===0} style={{flex:1,padding:"14px 0",borderRadius:12,background:scannedEvents.filter(e=>e._include && e.date).length>0?`linear-gradient(135deg,${C.teal},#0a8a72)`:"#1a2a2a",border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:scannedEvents.filter(e=>e._include && e.date).length>0?"pointer":"default",minHeight:50,boxShadow:scannedEvents.filter(e=>e._include && e.date).length>0?`0 4px 20px ${C.teal}40`:"none"}}>
                    ✓ Add {scannedEvents.filter(e=>e._include && e.date).length} Event{scannedEvents.filter(e=>e._include && e.date).length!==1?'s':''}
                  </button>
                  <button onClick={()=>{setScannedEvents([]);setScanError("");}} style={{padding:"14px 20px",borderRadius:12,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",minHeight:50}}>Start Over</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── PLAYER DETAIL ────────────────────────────────────────────────────────────
function InviteButton({playerId, teamId, email, name}) {
  const [status, setStatus] = useState("loading");

  useEffect(()=>{
    // Check if a parent is already linked to this player
    supabase.from('parent_players').select('id').eq('player_id', playerId).then(({data})=>{
      if(data && data.length > 0) setStatus("linked");
      else {
        // Check if invite already sent
        supabase.from('parent_invites').select('id').eq('player_id', playerId).eq('email', email.toLowerCase().trim())
          .then(({data:inv})=>{ setStatus(inv && inv.length > 0 ? "sent" : "idle"); });
      }
    });
  },[playerId]);

  if(status==="loading") return null;
  if(status==="linked") return (
    <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.teal,background:`${C.teal}15`,border:`1px solid ${C.teal}30`,borderRadius:7,padding:"4px 10px"}}>
      ✓ Linked
    </div>
  );
  if(status==="sent") return (
    <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.gold,background:`${C.gold}15`,border:`1px solid ${C.gold}30`,borderRadius:7,padding:"4px 10px"}}>
      📨 Invite sent
    </div>
  );
  return (
    <button onClick={async()=>{
      setStatus("sending");
      const {error} = await supabase.from('parent_invites').upsert(
        {player_id:playerId, team_id:teamId, email:email.toLowerCase().trim(), label:name||'Parent'},
        {onConflict:'player_id,email'}
      );
      setStatus(error ? "idle" : "sent");
    }} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.gold,background:`${C.gold}15`,border:`1px solid ${C.gold}30`,borderRadius:7,padding:"4px 10px",cursor:"pointer",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>
      📨 Invite
    </button>
  );
}

function PlayerDetail({player,assignments,setAsgn,setPlayers,skillSnapshots,setSkillSnapshots,drillVideos={},setDrillVideos=()=>{},playerVideos={},setPlayerVideos=()=>{},playerPhotos={},canAccess,onUpgrade,teamId,onDelete=()=>{}}) {
  const [detailTab, setDetailTab] = useState("drills");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const mine=assignments.filter(a=>a.playerId===player.id);
  const done=mine.filter(a=>a.completed).length;
  const pct=mine.length?Math.round(done/mine.length*100):0;

  const startEdit = () => {
    setForm({
      name: player.name,
      age: String(player.age),
      ageGroup: player.ageGroup,
      position: player.position,
      number: player.number || "",
      bats: player.bats || "R",
      throws: player.throws || "R",
      parent1:      player.parents?.[0]?.name  || "",
      parent1phone: player.parents?.[0]?.phone || "",
      parent1email: player.parents?.[0]?.email || "",
      parent2:      player.parents?.[1]?.name  || "",
      parent2phone: player.parents?.[1]?.phone || "",
      parent2email: player.parents?.[1]?.email || "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    const parents = [];
    if(form.parent1.trim()) parents.push({id: player.parents?.[0]?.id || uid()+"a", name:form.parent1.trim(), phone:form.parent1phone.trim(), email:form.parent1email.trim()});
    if(form.parent2.trim()) parents.push({id: player.parents?.[1]?.id || uid()+"b", name:form.parent2.trim(), phone:form.parent2phone.trim(), email:form.parent2email.trim()});
    const updated = {...player, name:form.name.trim()||player.name, age:parseInt(form.age)||player.age, ageGroup:form.ageGroup, position:form.position, number:form.number, bats:form.bats, throws:form.throws, parents};
    setPlayers(prev => prev.map(p => p.id===player.id ? updated : p));
    if(teamId) {
      supabase.from('players').update({
        name:updated.name, age:String(updated.age), age_group:updated.ageGroup,
        position:updated.position, number:updated.number, bats:updated.bats,
        throws:updated.throws, parents_info:parents,
      }).eq('id',player.id).then(({error})=>{ if(error) console.error('Player edit failed:',error.message); });
    }
    setEditing(false);
  };

  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  return (
    <div>
      {/* Player hero card */}
      <div className="fade-up" style={{background:`linear-gradient(135deg,#0f1e38,#100c18)`,borderRadius:18,border:`1px solid ${C.border}`,padding:"18px 14px 18px 18px",marginBottom:16,backgroundImage:C.stripe,position:"relative",boxShadow:`0 8px 32px #00000060`,overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.red},${C.gold},${C.red})`}}/>

        {editing && form ? (
          /* ── EDIT MODE ── */
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:16,letterSpacing:2,color:C.gold,marginBottom:2}}>EDIT PROFILE</div>
            <Inp label="Player Name" value={form.name} onChange={e=>f("name",e.target.value)}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Age" type="number" value={form.age} onChange={e=>f("age",e.target.value)}/>
              <Inp label="Jersey #" value={form.number} onChange={e=>f("number",e.target.value)} placeholder="7"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <SelF label="Position" value={form.position} onChange={v=>f("position",v)} options={POSITIONS}/>
              <SelF label="Bats" value={form.bats} onChange={v=>f("bats",v)} options={["R","L","S"]}/>
              <SelF label="Throws" value={form.throws} onChange={v=>f("throws",v)} options={["R","L"]}/>
            </div>
            <SelF label="Age Group" value={form.ageGroup} onChange={v=>f("ageGroup",v)} options={AGE_GROUPS}/>

            {/* Parent 1 */}
            <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}20`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.blue,textTransform:"uppercase"}}>Parent / Guardian 1</div>
              <Inp label="Name" value={form.parent1} onChange={e=>f("parent1",e.target.value)}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <Inp label="Phone" type="tel" value={form.parent1phone} onChange={e=>f("parent1phone",e.target.value)} placeholder="(555) 000-0000"/>
                <Inp label="Email" type="email" value={form.parent1email} onChange={e=>f("parent1email",e.target.value)} placeholder="email@example.com"/>
              </div>
            </div>

            {/* Parent 2 */}
            <div style={{background:`${C.blue}05`,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>Parent / Guardian 2 <span style={{opacity:0.5}}>(optional)</span></div>
              <Inp label="Name" value={form.parent2} onChange={e=>f("parent2",e.target.value)}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <Inp label="Phone" type="tel" value={form.parent2phone} onChange={e=>f("parent2phone",e.target.value)} placeholder="(555) 000-0000"/>
                <Inp label="Email" type="email" value={form.parent2email} onChange={e=>f("parent2email",e.target.value)} placeholder="email@example.com"/>
              </div>
            </div>

            <div style={{display:"flex",gap:10,marginTop:4}}>
              <PrimaryBtn onClick={saveEdit}>Save Changes</PrimaryBtn>
              <GhostBtn onClick={()=>setEditing(false)}>Cancel</GhostBtn>
            </div>
          </div>
        ) : (
          /* ── VIEW MODE ── */
          <>
            {/* Top row: photo + name + buttons */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              {playerPhotos[player.id]
                ? <div style={{flexShrink:0}}><Avatar name={player.name} size={52} photo={playerPhotos[player.id]} showRing/></div>
                : null
              }
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:1,color:"#fff",lineHeight:1.1}}>{player.name}</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={startEdit} title="Edit profile" style={{background:`${C.gold}15`,border:`1px solid ${C.gold}40`,borderRadius:8,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:12,color:C.gold}}>✏️</button>
                <button onClick={async()=>{
                  if(!window.confirm(`Permanently delete ${player.name} and ALL of their data?\n\nThis removes their profile, photos, videos, skill history, drill assignments, game stats, and lineup spots. This cannot be undone.`)) return;
                  if(!teamId){ setPlayers(prev=>prev.filter(p=>p.id!==player.id)); onDelete(); return; }
                  try{
                    const {data,error} = await supabase.rpc('delete_player_completely',{p_player_id:player.id});
                    if(error){ window.alert('Delete failed: '+error.message); return; }
                    const photoPaths=(data&&data.photo_paths)||[];
                    const videoPaths=(data&&data.video_paths)||[];
                    if(photoPaths.length) await supabase.storage.from('player-photos').remove(photoPaths);
                    if(videoPaths.length) await supabase.storage.from('player-videos').remove(videoPaths);
                    setPlayers(prev=>prev.filter(p=>p.id!==player.id));
                    onDelete();
                  }catch(e){ window.alert('Delete failed: '+(e&&e.message?e.message:e)); }
                }} title="Remove player" style={{background:`${C.red}15`,border:`1px solid ${C.red}40`,borderRadius:8,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:12,color:C.red}}>🗑️</button>
              </div>
            </div>

            {/* Tags row */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {player.number&&<Tag label={`#${player.number}`} color={C.gold}/>}
              <Tag label={player.position} color={C.red}/>
              <Tag label={player.ageGroup} color={C.textMid}/>
              <Tag label={`Age ${player.age}`} color={C.textDim}/>
              {player.bats&&<Tag label={`Bats ${player.bats==="S"?"Switch":player.bats}`} color={C.blue}/>}
              {player.throws&&<Tag label={`Throws ${player.throws}`} color={C.teal}/>}
            </div>

            {/* Parent info */}
            {(player.parents||[]).length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                {player.parents.map(par=>(
                  <div key={par.id} style={{background:`${C.blue}10`,border:`1px solid ${C.blue}25`,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.text,marginBottom:6}}>👤 {par.name}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                      {par.phone&&<a href={`tel:${par.phone}`} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:C.blue,textDecoration:"none",background:`${C.blue}15`,border:`1px solid ${C.blue}30`,borderRadius:7,padding:"4px 10px"}}>📞 {par.phone}</a>}
                      {par.email&&<a href={`mailto:${par.email}`} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:C.teal,textDecoration:"none",background:`${C.teal}15`,border:`1px solid ${C.teal}30`,borderRadius:7,padding:"4px 10px"}}>✉️ {par.email}</a>}
                      {par.email&&teamId&&<InviteButton playerId={player.id} teamId={teamId} email={par.email} name={par.name}/>}
                      {!par.phone&&!par.email&&<span style={{fontSize:11,color:C.textDim,fontStyle:"italic"}}>No contact info added</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Progress bar + ring */}
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{flex:1}}>
                <div style={{background:"#1a2f5240",borderRadius:4,height:5,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${C.red},${C.gold})`,borderRadius:4,boxShadow:`0 0 8px ${C.gold}60`,transition:"width 0.8s ease"}}/>
                </div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:11,color:C.textDim,marginTop:5,letterSpacing:1}}>{done} of {mine.length} drills complete</div>
              </div>
              <Ring pct={pct} size={48} color={pct===100?C.teal:C.red} label={`${pct}%`} sub="Done"/>
            </div>
          </>
        )}
      </div>

      {/* Tab switcher — hidden while editing */}
      {!editing&&<div style={{display:"flex",gap:0,marginBottom:20,background:C.card,borderRadius:12,padding:4,border:`1px solid ${C.border}`}}>
      {[{id:"drills",label:"Drills"},{id:"progress",label:"Progress"},{id:"goals",label:"Goals"},{id:"badges",label:"Badges"}].map(t=>(
          <button key={t.id} onClick={()=>setDetailTab(t.id)} style={{flex:1,padding:"10px 0",borderRadius:9,background:detailTab===t.id?`linear-gradient(135deg,${C.red},${C.redDim})`:"transparent",border:"none",color:detailTab===t.id?"#fff":C.text,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.2,textTransform:"uppercase",cursor:"pointer",minHeight:42,boxShadow:detailTab===t.id?`0 4px 16px ${C.red}40`:"none",transition:"all 0.2s",position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:detailTab===t.id?"rgba(255,255,255,0.7)":C.red,display:"block",flexShrink:0}}></span>
            {t.label}
          </button>
        ))}
      </div>}

      <ErrorBoundary>
      {!editing && detailTab==="drills"    && <DrillsTab mine={mine} setAsgn={setAsgn} drillVideos={drillVideos} setDrillVideos={setDrillVideos} playerVideos={playerVideos} player={player} coachMode={true} removeAsgn={id=>{setAsgn(prev=>prev.filter(a=>a.id!==id));supabase.from('assignments').delete().eq('id',id).then(({error})=>{if(error)console.error('Coach removeAsgn DB failed:',error.message);});}} teamId={teamId}/>}
      {!editing && detailTab==="progress"  && <ProgressTab player={player} assignments={assignments} skillSnapshots={skillSnapshots.filter(s=>s.playerId===player.id)} setSkillSnapshots={setSkillSnapshots} canAccess={canAccess} onUpgrade={onUpgrade}/>}
      {!editing && detailTab==="goals"     && <GoalsTab player={player} setPlayers={setPlayers}/>}
      {!editing && detailTab==="badges"    && <BadgesPanel player={player} assignments={assignments} skillSnapshots={skillSnapshots} events={[]}/>}
      </ErrorBoundary>
    </div>
  );
}

function DrillsTab({mine,setAsgn,drillVideos,setDrillVideos,playerVideos={},player=null,coachMode=false,removeAsgn=null,teamId}) {
  const [openDrill,setOpenDrill]=useState(null);
  const [reviewNotes, setReviewNotes]=useState({});
  const toggle=id=>setAsgn(prev=>prev.map(a=>a.id===id?{...a,completed:!a.completed}:a));
  const setRating=(id,r)=>setAsgn(prev=>prev.map(a=>a.id===id?{...a,coachRating:r}:a));
  const setNote=(id,note)=>setAsgn(prev=>prev.map(a=>a.id===id?{...a,notes:note}:a));
  const acknowledge=(id, teamId)=>{
    const note = reviewNotes[id] || "";
    setAsgn(prev=>{
      const asgn = prev.find(a=>a.id===id);
      if(!asgn) return prev;
      const videoKey = player ? `${player.id}_${asgn.drillId}` : null;
      const hasVideo = videoKey && playerVideos[videoKey]?.url;
      if(!hasVideo) {
        // No video — remove the drill entirely
        supabase.from('assignments').delete().eq('id',id).then(({error})=>{ if(error) console.error('Acknowledge delete failed:',error.message); });
        return prev.filter(a=>a.id!==id);
      }
      // Has video — mark acknowledged so player sees feedback and can dismiss
      supabase.from('assignments').update({acknowledged:true, notes:note||asgn.notes}).eq('id',id)
        .then(({error})=>{ if(error) console.error('Acknowledge update failed:',error.message); });
      return prev.map(a=>a.id===id?{...a,acknowledged:true,notes:note||a.notes}:a);
    });
    setReviewNotes(prev=>{const n={...prev};delete n[id];return n;});
  };

  // Needs Review: this player's completed but unacknowledged drills
  const needsReview = coachMode ? mine.filter(a=>a.completed && !a.acknowledged) : [];

  return (
    <div>
      {/* ── Needs Review Section (coach only) ── */}
      {coachMode && needsReview.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,color:C.gold,textTransform:"uppercase"}}>📋 Needs Review</div>
            <div style={{padding:"2px 8px",borderRadius:6,background:`${C.gold}20`,border:`1px solid ${C.gold}40`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,color:C.gold}}>{needsReview.length}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {needsReview.map((a,i)=>{
              const drill=findDrill(a.drillId);
              if(!drill) return null;
              const cc=catColor(drill.category);
              const pvKey=player?`${player.id}_${drill.id}`:null;
              const playerVid=pvKey?playerVideos[pvKey]:null;
              const localNote=reviewNotes[a.id]!==undefined?reviewNotes[a.id]:(a.notes||"");
              return (
                <div key={a.id} style={{background:C.card,border:`1px solid ${C.gold}40`,borderRadius:14,overflow:"hidden"}}>
                  {/* Drill header */}
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderBottom:`1px solid ${C.border}30`,background:`${C.gold}08`}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:cc,boxShadow:`0 0 6px ${cc}80`,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:C.text}}>{drill.name}</div>
                      <div style={{display:"flex",gap:6,marginTop:2}}>
                        <Tag label={drill.category} color={cc} small/>
                        <Tag label={drill.duration} color={C.textDim} small/>
                        {playerVid&&<Tag label="📹 Video" color={C.gold} small/>}
                      </div>
                    </div>
                  </div>
                  <div style={{padding:"14px 16px"}}>
                    {/* Player video */}
                    {playerVid&&(
                      <div style={{marginBottom:12,borderRadius:10,overflow:"hidden",border:`1px solid ${C.gold}40`,background:`${C.gold}08`}}>
                        <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.gold}30`,display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:13}}>📹</span>
                          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,color:C.gold}}>Player Video</div>
                          <div style={{fontSize:11,color:C.textDim,marginLeft:"auto"}}>{playerVid.uploadedAt?new Date(playerVid.uploadedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"recently"}</div>
                        </div>
                        <video src={playerVid.url} controls style={{width:"100%",display:"block",maxHeight:200,background:"#000"}}/>
                        {playerVid.note&&<div style={{padding:"6px 12px",fontSize:12,color:C.textMid,fontStyle:"italic",borderTop:`1px solid ${C.gold}20`}}>"{playerVid.note}"</div>}
                      </div>
                    )}
                    {/* Coach feedback */}
                    <div style={{marginBottom:10}}>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Coach Feedback</div>
                      <textarea
                        value={localNote}
                        onChange={e=>setReviewNotes(prev=>({...prev,[a.id]:e.target.value}))}
                        placeholder="Leave feedback for this player..."
                        rows={2}
                        style={{...inp,width:"100%",resize:"vertical",fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13}}
                      />
                    </div>
                    <button onClick={()=>acknowledge(a.id)} style={{width:"100%",padding:"11px 0",borderRadius:10,background:`linear-gradient(135deg,${C.teal},${C.teal}cc)`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 4px 16px ${C.teal}40`,minHeight:44}}>
                      ✓ Acknowledge & Send Feedback
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:"20px 0"}}/>
        </div>
      )}
      <SectionHead accent>Assigned Drills</SectionHead>
      {mine.length===0&&<EmptyState icon="🏋️" title="No drills assigned yet" body="Assign drills from the library and this player will see them in their parent app. Track their progress as they practice."/>}
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
        {mine.map(a=>{
          const drill=findDrill(a.drillId);
          if(!drill)return null;
          const open=openDrill===a.id,cc=catColor(drill.category);
          // player-uploaded video for this drill
          const pvKey = player ? `${player.id}_${drill.id}` : null;
          const playerVid = pvKey ? playerVideos[pvKey] : null;
          // coach demo video
          const demoVid = drillVideos[drill.id];
          return (
            <div key={a.id} style={{background:a.completed?`${C.teal}06`:C.card,border:`1px solid ${a.completed?C.teal+"40":C.border}`,borderRadius:14,overflow:"hidden",transition:"all 0.2s"}}>
              <div style={{padding:"14px 16px",display:"flex",gap:12,alignItems:"center"}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:cc,boxShadow:`0 0 8px ${cc}80`,flexShrink:0,marginTop:6}}></div>
                <button onClick={()=>setOpenDrill(open?null:a.id)} style={{background:"none",border:"none",textAlign:"left",flex:1,cursor:"pointer",padding:0,minHeight:36}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:16,color:a.completed?C.teal:C.text,marginBottom:3}}>{a.completed&&"✓ "}{drill.name}</div>
                    {playerVid&&<div style={{padding:"2px 7px",borderRadius:6,background:`${C.gold}20`,border:`1px solid ${C.gold}50`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,color:C.gold,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>📹 Video</div>}
                    {coachMode&&a.completed&&<div style={{padding:"2px 7px",borderRadius:6,background:`${C.teal}20`,border:`1px solid ${C.teal}50`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,color:C.teal,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>✅ Done</div>}
                    {coachMode&&!a.completed&&<div style={{padding:"2px 7px",borderRadius:6,background:`${C.textDim}15`,border:`1px solid ${C.textDim}30`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,color:C.textDim,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>Not Completed</div>}
                  </div>
                  <Tag label={drill.duration} color={C.textDim} small/>
                </button>
                {!coachMode && <button onClick={()=>toggle(a.id)} style={{padding:"9px 14px",borderRadius:9,cursor:"pointer",minHeight:44,flexShrink:0,background:a.completed?"transparent":`linear-gradient(135deg,${C.red},${C.redDim})`,border:a.completed?`1px solid ${C.teal}`:"none",color:a.completed?C.teal:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1.5,textTransform:"uppercase",boxShadow:a.completed?"none":`0 4px 12px ${C.red}40`}}>{a.completed?"✓ Done":"Mark Done"}</button>}
              </div>
              {open&&<div style={{padding:"0 16px 16px",borderTop:`1px solid ${C.border}40`}}>
                <div style={{fontSize:13,color:C.textMid,lineHeight:1.65,marginBottom:8,paddingTop:12}}>{drill.desc}</div>
                {drill.results&&<div style={{fontSize:12,color:C.teal+"cc",lineHeight:1.55,marginBottom:14,paddingLeft:10,borderLeft:`2px solid ${C.teal}40`}}><span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:C.teal,marginRight:6}}>Goal:</span>{drill.results}</div>}

                {/* Completed status — read only, action happens in Needs Review queue above */}
                {coachMode && a.completed && (
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:`${C.teal}12`,border:`1px solid ${C.teal}40`,marginBottom:14}}>
                    <span style={{fontSize:16}}>✅</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.teal}}>Player marked this complete</div>
                      <div style={{fontSize:11,color:C.textDim}}>{a.acknowledged ? "Acknowledged — feedback sent to player" : "Waiting for your review in the queue above"}</div>
                    </div>
                    {a.acknowledged && <div style={{padding:"5px 10px",borderRadius:8,background:`${C.teal}15`,border:`1px solid ${C.teal}40`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.teal,letterSpacing:1,textTransform:"uppercase"}}>✓ Sent</div>}
                  </div>
                )}

                {/* Player-uploaded performance video */}
                {playerVid&&(
                  <div style={{marginBottom:16,borderRadius:12,overflow:"hidden",border:`1px solid ${C.gold}40`,background:`${C.gold}08`}}>
                    <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.gold}30`,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:15}}>📹</span>
                      <div>
                        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.gold}}>Player Performance Video</div>
                        <div style={{fontSize:11,color:C.textDim}}>Uploaded by parent · {playerVid.uploadedAt ? new Date(playerVid.uploadedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "recently"}</div>
                      </div>
                    </div>
                    <video src={playerVid.url} controls style={{width:"100%",display:"block",maxHeight:220,background:"#000"}}/>
                    {playerVid.note&&<div style={{padding:"8px 14px",fontSize:12,color:C.textMid,fontStyle:"italic",borderTop:`1px solid ${C.gold}20`}}>"{playerVid.note}"</div>}
                  </div>
                )}

                {/* Coach demo video */}
                {coachMode&&<DrillVideoBlock drillId={drill.id} drillVideos={drillVideos} setDrillVideos={setDrillVideos} coachMode={coachMode} teamId={teamId}/>}
                {!coachMode&&demoVid&&<DrillVideoBlock drillId={drill.id} drillVideos={drillVideos} setDrillVideos={()=>{}} coachMode={false}/>}

                <div style={{marginTop:14}}>
                  {!coachMode && a.acknowledged && a.notes && <div style={{padding:"10px 14px",background:`${C.gold}10`,borderLeft:`3px solid ${C.gold}`,borderRadius:"0 8px 8px 0",fontSize:13,color:C.text,fontStyle:"italic"}}>🗣 Coach: {a.notes}</div>}
                  {!coachMode && a.completed && !a.acknowledged && <div style={{padding:"8px 14px",background:`${C.teal}08`,borderLeft:`3px solid ${C.teal}40`,borderRadius:"0 8px 8px 0",fontSize:12,color:C.textMid,fontStyle:"italic"}}>✅ Marked complete — waiting for coach feedback</div>}
                </div>

                {/* Coach: Remove drill button — always visible */}
                {coachMode && removeAsgn && (
                  <button onClick={()=>{if(window.confirm(`Remove "${drill.name}" from this player?`))removeAsgn(a.id);}} style={{width:"100%",padding:"10px 0",borderRadius:10,background:`${C.red}08`,border:`1px solid ${C.red}30`,color:C.red,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:40,marginTop:12}}>
                    🗑 Remove Drill
                  </button>
                )}
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalsTab({player,setPlayers}) {
  const [newGoal,setNewGoal]=useState("");
  const addGoal=()=>{if(!newGoal.trim())return;setPlayers(prev=>prev.map(p=>p.id===player.id?{...p,goals:[...(p.goals||[]),newGoal.trim()]}:p));setNewGoal("");};
  const removeGoal=i=>setPlayers(prev=>prev.map(p=>p.id===player.id?{...p,goals:p.goals.filter((_,j)=>j!==i)}:p));
  return (
    <div>
      <SectionHead accent>Development Goals</SectionHead>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {(player.goals||[]).map((g,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.gold}`,borderRadius:"0 12px 12px 0",padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:48}}>
            <span style={{fontSize:14,color:C.textMid}}>→ {g}</span>
            <button onClick={()=>removeGoal(i)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:20,padding:"0 4px",minWidth:36,minHeight:36}}>×</button>
          </div>
        ))}
        {!(player.goals?.length)&&<div style={{color:C.textDim,fontSize:13,fontFamily:"Barlow Condensed, sans-serif",letterSpacing:1,textTransform:"uppercase"}}>No goals set yet</div>}
      </div>
      <div style={{display:"flex",gap:10}}>
        <input value={newGoal} onChange={e=>setNewGoal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGoal()} placeholder="Add a development goal..." style={{...inp,flex:1}}/>
        <PrimaryBtn onClick={addGoal}>Add</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── PROGRESS TAB ─────────────────────────────────────────────────────────────
function ProgressTab({player, assignments, skillSnapshots, setSkillSnapshots, canAccess, onUpgrade}) {
  if(canAccess && !canAccess("progress")) return <PaywallGate feature="Progress Tracking & Charts" onUpgrade={onUpgrade}/>;
  const [showForm, setShowForm] = useState(false);
  const [formRubric, setFormRubric] = useState({});
  const [formNotes, setFormNotes] = useState("");
  const [activeSkill, setActiveSkill] = useState("all");

  // ── Streak calculation ────────────────────────────────────────────────────
  const completedByDate = {};
  assignments.filter(a=>a.completed).forEach(a=>{
    const d = a.assignedDate;
    completedByDate[d] = (completedByDate[d]||0) + 1;
  });
  const sortedDates = Object.keys(completedByDate).sort();
  let streak=0, bestStreak=0;
  const todayStr = new Date().toISOString().slice(0,10);
  for(let i=0;i<sortedDates.length;i++){
    if(i===0){ streak=1; } else {
      const diff=(new Date(sortedDates[i])-new Date(sortedDates[i-1]))/(1000*60*60*24);
      streak = diff<=2 ? streak+1 : 1;
    }
    bestStreak = Math.max(bestStreak, streak);
  }
  let currentStreak=0;
  if(sortedDates.length>0){
    const gap=(new Date(todayStr)-new Date(sortedDates[sortedDates.length-1]))/(1000*60*60*24);
    currentStreak = gap<=2 ? streak : 0;
  }
  const totalCompleted = assignments.filter(a=>a.completed).length;
  const totalAssigned  = assignments.length;

  // ── Chart data ────────────────────────────────────────────────────────────
  const sorted = [...skillSnapshots].sort((a,b)=>a.date.localeCompare(b.date));
  const latest = sorted[sorted.length-1];
  const latestChart = latest ? computeChartRatings(latest.rubric||{}) : {};
  const prevChart = sorted.length>1 ? computeChartRatings(sorted[sorted.length-2].rubric||{}) : {};
  const availableSkills = CHART_SKILLS.filter(s=>latestChart[s]!=null);

  // All-skills aggregate chart
  const chartDataAll = sorted.map(s=>({
    date: new Date(s.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    ...computeChartRatings(s.rubric||{}),
  }));

  // Drill-down: get all criteria keys for the selected skill across all snapshots
  const drillKeys = activeSkill!=="all" && latest
    ? getCriteriaKeys(activeSkill, latest.rubric||{})
    : [];

  // Build pretty label from key e.g. "fd_in_Mechanics" → "Infield Mechanics"
  const labelFromKey = key => {
    const parts = key.split("_");
    // last segment is the criterion name
    return parts[parts.length-1];
  };

  const chartDataDrill = sorted.map(s=>({
    date: new Date(s.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    ...Object.fromEntries(drillKeys.map(k=>[labelFromKey(k), s.rubric?.[k]||null])),
  }));

  const chartData    = activeSkill==="all" ? chartDataAll : chartDataDrill;
  const drillLabels  = drillKeys.map(labelFromKey);

  // Deduplicate labels (e.g. both fd_in_Overall and fd_out_Overall → just "Overall")
  const uniqueDrillLabels = [...new Set(drillLabels)];

  const posRubric = rubricForPosition(player.position||"Utility");
  const skillsToShow = activeSkill==="all" ? availableSkills : [];

  const saveSnapshot = () => {
    setSkillSnapshots(prev=>[...prev,{id:uid(),playerId:player.id,date:todayStr,rubric:{...formRubric},notes:formNotes}]);
    setFormRubric({}); setFormNotes(""); setShowForm(false);
  };

  const setRv = (key,val) => setFormRubric(prev=>({...prev,[key]:val}));

  return (
    <div>
      {/* ── Streak & stats row ── */}
      <SectionHead accent>Consistency</SectionHead>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        {[
          {label:"Current\nStreak", val:currentStreak, unit:"days", color:currentStreak>0?C.teal:C.textDim},
          {label:"Best\nStreak",    val:bestStreak,    unit:"days", color:C.gold},
          {label:"Drills\nDone",    val:totalCompleted, unit:`of ${totalAssigned}`, color:C.blue},
        ].map(s=>(
          <div key={s.label} style={{background:C.card,border:`1px solid ${s.color}40`,borderRadius:14,padding:"14px 10px",textAlign:"center",boxShadow:`0 0 16px ${s.color}12`}}>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:34,color:s.color,lineHeight:1,textShadow:`0 0 16px ${s.color}60`}}>{s.val}</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1.5,color:s.color+"99",textTransform:"uppercase",marginTop:2}}>{s.unit}</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:9,letterSpacing:1,color:C.textDim,textTransform:"uppercase",whiteSpace:"pre",marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Skill Progression header ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <SectionHead accent>Skill Progression</SectionHead>
        <PrimaryBtn onClick={()=>{setShowForm(!showForm);setFormRubric({});setFormNotes("");}}>+ Rate Now</PrimaryBtn>
      </div>

      {/* ── Rubric rating form ── */}
      {showForm && (
        <div className="fade-up" style={{background:`linear-gradient(135deg,#100c1a,${C.card})`,borderRadius:16,border:`1px solid ${C.red}40`,padding:"18px 16px",marginBottom:20}}>
          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:16,letterSpacing:3,color:C.red,marginBottom:4}}>NEW SKILL SNAPSHOT</div>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:11,color:C.textDim,marginBottom:18}}>{player.name} · {player.position}</div>

          {posRubric.map(section=>(
            <div key={section.id} style={{marginBottom:20}}>
              {/* Section header */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${section.color}30`}}>
                <div style={{width:3,height:18,borderRadius:2,background:section.color,flexShrink:0}}/>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,color:section.color,textTransform:"uppercase"}}>{section.label}</div>
              </div>
              {section.groups.map(group=>(
                <div key={group.id} style={{marginBottom:14}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase",marginBottom:8}}>{group.label}</div>
                  {group.criteria.map(criterion=>{
                    const key=`${group.id}_${criterion}`;
                    const val=formRubric[key]||0;
                    return (
                      <div key={criterion} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:12,color:C.textMid,minWidth:80,flexShrink:0}}>{criterion}</div>
                        <div style={{display:"flex",gap:4,flex:1}}>
                          {[1,2,3,4].map(n=>{
                            const active=val===n;
                            const col=RUBRIC_VAL_COLORS[n];
                            return (
                              <button key={n} onClick={()=>setRv(key,n)} style={{flex:1,padding:"7px 4px",borderRadius:8,border:`1px solid ${active?col:C.border}`,background:active?`${col}25`:"transparent",color:active?col:C.textDim,fontFamily:"Bebas Neue, sans-serif",fontSize:16,cursor:"pointer",minHeight:38,transition:"all 0.15s",boxShadow:active?`0 0 8px ${col}40`:"none"}}>
                                {n}
                              </button>
                            );
                          })}
                        </div>
                        {val>0&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:RUBRIC_VAL_COLORS[val],minWidth:72,textAlign:"right",letterSpacing:0.5}}>{RUBRIC_LABELS[val]}</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}

          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Coach Notes</div>
          <input value={formNotes} onChange={e=>setFormNotes(e.target.value)} placeholder="Observations from today's session..." style={{...inp,marginBottom:16}}/>
          <div style={{display:"flex",gap:10}}>
            <PrimaryBtn onClick={saveSnapshot}>Save Snapshot</PrimaryBtn>
            <GhostBtn onClick={()=>setShowForm(false)}>Cancel</GhostBtn>
          </div>
        </div>
      )}

      {sorted.length===0 && !showForm && (
        <div className="fade-up"><EmptyState icon="📈" title="No ratings yet" body="Tap 'Rate Now' after a practice to log your first skill snapshot. Over time you'll see a chart of their improvement."/></div>
      )}

      {sorted.length > 0 && (
        <>
          {/* Skill filter pills */}
          <div className="pill-scroll" style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,marginBottom:16}}>
            {["all",...availableSkills].map(s=>{
              const color = s==="all" ? C.textMid : CHART_COLORS[s];
              const active = activeSkill===s;
              return (
                <button key={s} onClick={()=>setActiveSkill(s)} style={{padding:"7px 14px",borderRadius:20,border:`1px solid ${active?color:C.border}`,cursor:"pointer",whiteSpace:"nowrap",minHeight:34,flexShrink:0,background:active?`${color}25`:"transparent",color:active?color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",transition:"all 0.15s"}}>
                  {s==="all"?"All Skills":s}
                </button>
              );
            })}
          </div>

          {/* Drill-down label when a skill is selected */}
          {activeSkill!=="all" && (
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:CHART_COLORS[activeSkill],textTransform:"uppercase",marginBottom:10}}>
              {activeSkill} — Subcriteria Breakdown
            </div>
          )}

          {/* Line chart */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 8px 8px",marginBottom:8}}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{top:4,right:16,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5240" vertical={false}/>
                <XAxis dataKey="date" tick={{fill:C.textDim,fontSize:9,fontFamily:"Barlow Condensed, sans-serif"}} tickLine={false} axisLine={false}/>
                <YAxis domain={[0,4]} ticks={[1,2,3,4]} tick={{fill:C.textDim,fontSize:9,fontFamily:"Barlow Condensed, sans-serif"}} tickLine={false} axisLine={false}
                  tickFormatter={v=>({1:"NW",2:"Dev",3:"Prof",4:"Exc"}[v]||"")}/>
                <Tooltip
                  contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,fontFamily:"Barlow Condensed, sans-serif",fontSize:12}}
                  labelStyle={{color:C.textMid,letterSpacing:1,fontSize:10}}
                  formatter={(val,name)=>[`${RUBRIC_LABELS[Math.round(val)]||val}`,name]}
                />
                {activeSkill==="all"
                  ? skillsToShow.map(skill=>(
                      <Line key={skill} type="monotone" dataKey={skill} stroke={CHART_COLORS[skill]} strokeWidth={2.5} dot={{fill:CHART_COLORS[skill],r:4,strokeWidth:0}} activeDot={{r:6,strokeWidth:0,fill:CHART_COLORS[skill]}}/>
                    ))
                  : uniqueDrillLabels.map((label,i)=>{
                      const color = SUBCRITERION_COLORS[i % SUBCRITERION_COLORS.length];
                      return <Line key={label} type="monotone" dataKey={label} stroke={color} strokeWidth={2.5} dot={{fill:color,r:4,strokeWidth:0}} activeDot={{r:6,strokeWidth:0,fill:color}} connectNulls/>;
                    })
                }
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend for drill-down view */}
          {activeSkill!=="all" && uniqueDrillLabels.length>0 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16,paddingLeft:8}}>
              {uniqueDrillLabels.map((label,i)=>{
                const color = SUBCRITERION_COLORS[i % SUBCRITERION_COLORS.length];
                return (
                  <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:16,height:3,borderRadius:2,background:color,flexShrink:0}}/>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.textMid,letterSpacing:1}}>{label}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Latest snapshot rubric breakdown */}
          {latest && (
            <>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:14}}>
                Latest Snapshot — {new Date(latest.date+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
              </div>

              {/* Category progress bars */}
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                {availableSkills.map(skill=>{
                  const val=latestChart[skill]||0;
                  const prev=prevChart[skill];
                  const delta=prev!=null?Math.round((val-prev)*10)/10:null;
                  const color=CHART_COLORS[skill];
                  return (
                    <div key={skill} style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,color,letterSpacing:1,textTransform:"uppercase",width:76,flexShrink:0}}>{skill}</div>
                      <div style={{flex:1,height:8,background:"#0d1628",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${(val/4)*100}%`,background:`linear-gradient(90deg,${color}70,${color})`,borderRadius:4,boxShadow:`0 0 6px ${color}50`,transition:"width 0.8s ease"}}/>
                      </div>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,color,minWidth:56,textAlign:"right"}}>{RUBRIC_LABELS[Math.round(val)]||val}</div>
                      {delta!=null&&delta!==0&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,color:delta>0?C.teal:C.red,minWidth:28}}>{delta>0?`+${delta}`:delta}</div>}
                    </div>
                  );
                })}
              </div>

              {/* Rubric breakdown by section */}
              {posRubric.map(section=>{
                const sectionKeys = Object.entries(latest.rubric||{}).filter(([k])=>
                  section.groups.some(g=>k.startsWith(g.id+"_")));
                if(sectionKeys.length===0) return null;
                return (
                  <div key={section.id} style={{background:C.card,border:`1px solid ${section.color}25`,borderRadius:14,padding:"14px 16px",marginBottom:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                      <div style={{width:3,height:16,borderRadius:2,background:section.color,flexShrink:0}}/>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:12,letterSpacing:2,color:section.color,textTransform:"uppercase"}}>{section.label}</div>
                    </div>
                    {section.groups.map(group=>{
                      const groupKeys=Object.entries(latest.rubric||{}).filter(([k])=>k.startsWith(group.id+"_"));
                      if(groupKeys.length===0) return null;
                      return (
                        <div key={group.id} style={{marginBottom:10}}>
                          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,color:C.textDim,textTransform:"uppercase",marginBottom:6}}>{group.label}</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                            {group.criteria.map(criterion=>{
                              const key=`${group.id}_${criterion}`;
                              const val=latest.rubric?.[key];
                              if(!val) return null;
                              const col=RUBRIC_VAL_COLORS[val];
                              return (
                                <div key={criterion} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,background:`${col}15`,border:`1px solid ${col}40`}}>
                                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:11,color:C.textMid}}>{criterion}</div>
                                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:11,color:col}}>{RUBRIC_LABELS[val]}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {latest.notes && (
                <div style={{padding:"12px 16px",background:`${C.gold}10`,borderLeft:`3px solid ${C.gold}`,borderRadius:"0 10px 10px 0",fontSize:13,color:C.textMid,fontStyle:"italic",marginBottom:16}}>
                  📋 {latest.notes}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── PARENT DRILL LIBRARY (read-only browse) ────────────────────────────────
function ParentDrillLibrary({customDrills=[]}) {
  const [cat, setCat] = useState("All");
  const [expanded, setExpanded] = useState(null);

  const allDrills = [...DRILL_LIBRARY, ...customDrills];
  const filteredDrills = allDrills.filter(d => cat==="All" || d.category===cat);
  const drillCount = filteredDrills.length;

  return (
    <div className="fade-up">
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:2,color:"#fff",marginBottom:4}}>Drill Library</div>
        <div style={{fontSize:12,color:C.textDim}}>{drillCount} drill{drillCount!==1?"s":""} available · Browse & practice at home</div>
      </div>

      {/* Category filter */}
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:16}}>
        <div style={{display:"flex",gap:6,paddingBottom:4,width:"max-content"}}>
          {["All",...CATEGORIES].map(c=>{
            const color = c==="All" ? C.red : catColor(c);
            const active = cat===c;
            return (
              <button key={c} onClick={()=>setCat(c)} style={{padding:"7px 14px",borderRadius:18,cursor:"pointer",whiteSpace:"nowrap",minHeight:32,flexShrink:0,transition:"all 0.15s",border:`1px solid ${active?color:C.border}`,background:active?`${color}28`:"transparent",color:active?color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,textTransform:"uppercase"}}>
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Drill list */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filteredDrills.map(drill => {
          const cc = catColor(drill.category);
          const isOpen = expanded===drill.id;
          return (
            <div key={drill.id} style={{background:C.card,border:`1px solid ${isOpen?cc+"50":C.border}`,borderRadius:14,overflow:"hidden",transition:"all 0.2s"}}>
              <button onClick={()=>setExpanded(isOpen?null:drill.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"transparent",border:"none",textAlign:"left",cursor:"pointer",minHeight:50}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:cc,boxShadow:`0 0 6px ${cc}80`,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:C.text,marginBottom:2,display:"flex",alignItems:"center",gap:6}}>
                    {drill.name}
                    {drill.isCustom&&<span style={{padding:"1px 5px",borderRadius:5,background:`${C.gold}20`,border:`1px solid ${C.gold}50`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:8,letterSpacing:1,color:C.gold,textTransform:"uppercase"}}>Coach</span>}
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    <span style={{padding:"2px 8px",borderRadius:6,background:`${cc}20`,border:`1px solid ${cc}40`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1,color:cc,textTransform:"uppercase"}}>{drill.category}</span>
                    <span style={{padding:"2px 8px",borderRadius:6,background:`${C.textDim}15`,border:`1px solid ${C.border}`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1,color:C.textDim,textTransform:"uppercase"}}>{drill.duration}</span>
                  </div>
                </div>
                <div style={{fontSize:13,color:isOpen?cc:C.textDim,transition:"transform 0.2s",transform:isOpen?"rotate(90deg)":"none"}}>›</div>
              </button>
              {isOpen && (
                <div style={{padding:"0 14px 14px"}}>
                  <div style={{fontSize:13,color:C.textMid,lineHeight:1.65,marginBottom:8}}>{drill.desc}</div>
                  {drill.results&&(
                    <div style={{fontSize:12,color:`${C.teal}cc`,lineHeight:1.55,paddingLeft:10,borderLeft:`2px solid ${C.teal}40`}}>
                      <span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:C.teal,marginRight:6}}>Goal:</span>
                      {drill.results}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PARENT VIEW ──────────────────────────────────────────────────────────────
function ParentView({player,parent,assignments,events,setAsgn,unread,onOpenChat,parentUserId,dmChannel="",onSupport=()=>{},drillVideos,skillSnapshots=[],playerVideos={},setPlayerVideos=()=>{},gamePlans={},lineups={},players=[],playerPhotos={},setPlayerPhotos=()=>{},onPhotoUpload=null,teamLogo=null,teamName="",canAccess=()=>true,customDrills=[]}) {
  const teamInitials = teamName
    ? teamName.split(/\s+/).filter(Boolean).map(w=>w[0].toUpperCase()).slice(0,3).join("")
    : "TC";
  const [section,setSection]=useState("drills");
  const [selEvId,setSelEvId]=useState(null);
  const [showDeleteAcct,setShowDeleteAcct]=useState(false);
  const [deletingAcct,setDeletingAcct]=useState(false);
  const [delAcctError,setDelAcctError]=useState("");
  const handleDeleteAccount = async () => {
    setDeletingAcct(true); setDelAcctError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in — please sign in again.");
      const res = await fetch("https://hcadlkmejdekhbgfvyaq.supabase.co/functions/v1/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok || data.error) throw new Error(data.error || "Could not delete account. Please try again or contact support.");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e) {
      setDelAcctError(String(e.message || e));
      setDeletingAcct(false);
    }
  };
  if(!player)return (
    <div style={{padding:40,textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:12}}>⚾</div>
      <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:2,color:C.textMid,marginBottom:8}}>Player Not Found</div>
      <div style={{fontSize:13,color:C.textDim,lineHeight:1.6,maxWidth:300,margin:"0 auto"}}>Your player profile couldn't be loaded. Ask your coach to check that your invite is set up correctly.</div>
    </div>
  );
  const toggle=id=>{
    setAsgn(prev=>prev.map(a=>a.id===id?{...a,completed:true}:a));
    supabase.from('assignments').update({completed:true}).eq('id',id).then(({error})=>{ if(error) console.error('Toggle complete failed:',error.message); });
  };
  const removeAsgn=id=>{
    setAsgn(prev=>prev.filter(a=>a.id!==id));
    supabase.from('assignments').delete().eq('id',id).then(({error})=>{ if(error) console.error('removeAsgn failed:',error.message); });
  };
  const today=new Date().toISOString().slice(0,10);
  const upcoming=events.filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const nextEvent=upcoming[0];

  // ── RSVP STATE & HANDLERS ──
  const [myRsvps, setMyRsvps] = useState({}); // {event_id: 'going'|'out'|'maybe'}

  // Load RSVPs for this player
  useEffect(()=>{
    if(!player?.id) return;
    supabase.from("event_rsvps").select("*").eq("player_id",player.id).then(({data})=>{
      if(!data) return;
      const map = {};
      data.forEach(r=>{ map[r.event_id]=r.status; });
      setMyRsvps(map);
    });
  },[player?.id]);

  // ── Live game scores ──
  const [parentGameScores, setParentGameScores] = useState({}); // {eventId: row}
  useEffect(()=>{
    const eventIds = events.filter(e=>e.type==="game").map(e=>e.id);
    if(eventIds.length===0) return;
    supabase.from("game_scores").select("*").in("event_id",eventIds).then(({data})=>{
      if(!data) return;
      const map = {};
      data.forEach(r=>{ map[r.event_id]=r; });
      setParentGameScores(map);
    });
    const channel = supabase.channel('game-scores-parent')
      .on('postgres_changes', {event:'*', schema:'public', table:'game_scores'}, (payload)=>{
        const row = payload.new || payload.old;
        if(!row || !eventIds.includes(row.event_id)) return;
        if(payload.eventType==='DELETE') {
          setParentGameScores(prev=>{const c={...prev}; delete c[row.event_id]; return c;});
        } else {
          setParentGameScores(prev=>({...prev, [row.event_id]:payload.new}));
        }
      }).subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[events.length]);

  // ── My player's game stats (for Stats tab) ──
  const [myStats, setMyStats] = useState([]); // [{event_id, at_bats, hits, ...}]
  useEffect(()=>{
    if(!player?.id) return;
    supabase.from("player_game_stats").select("*").eq("player_id",player.id).order("updated_at",{ascending:false}).then(({data})=>{
      setMyStats(data||[]);
    });
    const channel = supabase.channel('player-stats-'+player.id)
      .on('postgres_changes', {event:'*', schema:'public', table:'player_game_stats', filter:`player_id=eq.${player.id}`}, (payload)=>{
        if(payload.eventType==='DELETE') {
          setMyStats(prev=>prev.filter(s=>s.id!==payload.old.id));
        } else if(payload.eventType==='INSERT') {
          setMyStats(prev=>[payload.new,...prev]);
        } else {
          setMyStats(prev=>prev.map(s=>s.id===payload.new.id?payload.new:s));
        }
      }).subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[player?.id]);

  const setRsvp = async (eventId, status) => {
    if(!player?.id) return;
    setMyRsvps(prev=>({...prev,[eventId]:status}));
    const id = `${eventId}_${player.id}`;
    const teamId = player.teamId || (events.find(e=>e.id===eventId)?.teamId) || "";
    const row = {
      id,
      event_id: eventId,
      player_id: player.id,
      player_name: player.name,
      team_id: teamId,
      status,
      responded_by: parentUserId || "",
      responded_at: new Date().toISOString(),
    };
    await supabase.from("event_rsvps").upsert(row, {onConflict:"event_id,player_id"});
  };

  const done=assignments.filter(a=>a.completed).length;
  const pct=assignments.length?Math.round(done/assignments.length*100):0;
  const photo = playerPhotos[player.id] || null;

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if(onPhotoUpload) onPhotoUpload(player.id, ev.target.result);
      else setPlayerPhotos(prev=>({...prev,[player.id]:ev.target.result}));
    };
    reader.readAsDataURL(file);
  };

  const sections=[
    {id:"report",  ic:"report",   label:"Report"},
    {id:"stats",   ic:"stats",    label:"Stats"},
    {id:"drills",  ic:"baseball", label:"Drills"},
    {id:"library", ic:"library",  label:"Library"},
    {id:"schedule",ic:"schedule", label:"Schedule"},
    {id:"chat",    ic:"msgs",     label:"Chat", badge:unread},
  ];

  return (
    <div style={{maxWidth:560,margin:"0 auto",padding:"18px 14px",paddingBottom:100}}>



      {/* ── Team Identity Banner ── */}
      <div className="fade-up" style={{position:"relative",overflow:"hidden",marginLeft:"calc(50% - 50vw)",marginRight:"calc(50% - 50vw)",width:"100vw",marginTop:-18,marginBottom:18,boxShadow:`0 12px 48px #00000080`}}>
        {/* Dugout photo background — mirrors the coach-side stadium header */}
        <div style={{position:"absolute",inset:0}}>
          <img src="/dugout-bg.jpg" alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center"}}/>
          {/* Light scrim — just enough behind the text on the left, photo stays vivid elsewhere */}
          <div style={{position:"absolute",inset:0,background:`linear-gradient(90deg, rgba(6,17,31,0.8) 0%, rgba(6,17,31,0.34) 32%, rgba(6,17,31,0.06) 58%, rgba(6,17,31,0) 80%)`}}/>
        </div>
        <div style={{position:"absolute",top:0,right:0,bottom:0,width:"55%",background:`linear-gradient(160deg,transparent 0%,${C.red}12 50%,${C.red}06 100%)`,clipPath:"polygon(20% 0%,100% 0%,100% 100%,0% 100%)"}}/>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.red},${C.gold},${C.red})`}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${C.red}80,${C.gold}80,transparent)`}}/>
        <div style={{position:"absolute",top:-20,left:-20,width:160,height:160,borderRadius:"50%",background:`radial-gradient(circle,${C.red}25 0%,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:2,maxWidth:560,margin:"0 auto",padding:"30px 20px",display:"flex",alignItems:"center",gap:18,minHeight:200,boxSizing:"border-box"}}>
          <div style={{width:96,height:96,borderRadius:20,overflow:"hidden",border:`2px solid ${teamLogo?C.red+"90":"#ffffff20"}`,boxShadow:teamLogo?`0 0 0 4px ${C.red}20, 0 6px 28px ${C.red}50`:`0 0 0 4px #ffffff08, 0 6px 20px #00000060`,display:"flex",alignItems:"center",justifyContent:"center",background:teamLogo?"#000":`linear-gradient(145deg,#1a3a7a,#0a1f50)`,flexShrink:0}}>
            {teamLogo
              ? <img src={teamLogo} alt="Team logo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : <span style={{fontFamily:"Bebas Neue, sans-serif",fontSize:32,letterSpacing:1,color:"#fff",textShadow:`0 0 20px ${C.red}80`}}>{teamInitials}</span>
            }
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:4,color:C.red,textTransform:"uppercase",marginBottom:6,textShadow:"0 1px 4px #000000,0 0 10px #000000cc"}}>⚾ 2026 Season</div>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:46,letterSpacing:2,color:"#fff",lineHeight:1,textShadow:`0 2px 4px #000000,0 1px 14px #000000ee,0 0 30px #000000aa`,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:8}}>
              {teamName||"Your Team"}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{height:2,width:28,background:`linear-gradient(90deg,${C.red},${C.gold})`}}/>
              <div style={{height:2,width:8,background:C.gold,opacity:0.4}}/>
              <div style={{height:2,width:4,background:C.gold,opacity:0.2}}/>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="fade-up" style={{background:`linear-gradient(135deg,#0f1e38,#100c18)`,borderRadius:18,border:`1px solid ${C.border}`,padding:"20px 18px",marginBottom:18,backgroundImage:C.stripe,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.red},${C.gold},${C.red})`}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14}}>
          <div style={{display:"flex",gap:14,alignItems:"center",flex:1}}>
            {/* Photo + upload button */}
            <div style={{position:"relative",flexShrink:0}}>
              <Avatar name={player.name} size={72} photo={photo} showRing/>
              <label title="Upload photo" style={{position:"absolute",bottom:-2,right:-2,width:24,height:24,borderRadius:"50%",background:C.gold,border:`2px solid ${C.bg}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11}}>
                📷
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{display:"none"}}/>
              </label>
            </div>
            <div>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:26,color:C.text,letterSpacing:2,marginBottom:4,lineHeight:1}}>{player.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {player.number&&<Tag label={`#${player.number}`} color={C.gold}/>}
                <Tag label={player.position} color={C.red}/>
                <Tag label={player.ageGroup} color={C.textMid}/>
                {player.bats&&<Tag label={`Bats ${player.bats==="S"?"Switch":player.bats}`} color={C.blue}/>}
                {player.throws&&<Tag label={`Throws ${player.throws}`} color={C.teal}/>}
              </div>
            </div>
          </div>
          <Ring pct={pct} size={56} color={pct===100?C.teal:C.gold} label={`${pct}%`} sub="Done"/>
        </div>
        <div style={{marginTop:14,background:"#1a2f5240",borderRadius:4,height:5,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${C.gold},${C.teal})`,borderRadius:4,transition:"width 0.8s ease"}}/>
        </div>
      </div>

      {/* ── Fixed Bottom Nav Bar ── */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:`${C.bg}f2`,backdropFilter:"blur(20px)",borderTop:`1px solid ${C.border}`,display:"flex",paddingBottom:"env(safe-area-inset-bottom)",height:"calc(66px + env(safe-area-inset-bottom))"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`}}/>
        {sections.map(s=>{
          const active=section===s.id;
          return (
            <button key={s.id} onClick={()=>{setSection(s.id);setSelEvId(null);}}
              className="nav-item"
              style={{flex:1,background:"none",border:"none",color:active?C.red:C.textDim,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,cursor:"pointer",position:"relative",transition:"color 0.15s,transform 0.15s"}}>
              {active&&<div style={{position:"absolute",top:0,left:"10%",right:"10%",height:2,background:`linear-gradient(90deg,transparent,${C.red},transparent)`,borderRadius:"0 0 4px 4px"}}/>}
              <div style={{position:"relative"}}>
                <span style={{filter:active?`drop-shadow(0 0 8px ${C.red}bb)`:"none",transition:"filter 0.2s",transform:active?"scale(1.1)":"scale(1)",display:"inline-flex"}}><NavIcon id={s.ic}/></span>
                {s.badge>0&&<div className="badge-pulse" style={{position:"absolute",top:-4,right:-6,width:16,height:16,borderRadius:"50%",background:C.red,border:`2px solid ${C.bg}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:8,color:"#fff"}}>{s.badge>9?"9+":s.badge}</div>}
              </div>
              <span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:8,letterSpacing:1,textTransform:"uppercase"}}>{s.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Drills */}
      {section==="drills"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {assignments.length===0&&<EmptyState icon="⚾" title="No drills yet" body="Your coach hasn't assigned any drills yet. Check back after your next practice!"/>}
          {assignments.map(a=>{
            const drill=findDrill(a.drillId);
            if(!drill)return null;
            const cc=catColor(drill.category);
            return (
              <div key={a.id} className="card-hover" style={{background:a.completed?`${C.teal}06`:C.card,border:`1px solid ${a.completed?C.teal+"40":C.border}`,borderRadius:14,padding:16,transition:"all 0.2s cubic-bezier(0.22,1,0.36,1)"}}>
                <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:cc,boxShadow:`0 0 8px ${cc}80`,flexShrink:0,marginTop:6}}></div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:16,color:a.completed?C.teal:C.text,marginBottom:3}}>{a.completed&&"✓ "}{drill.name}</div>
                    <div style={{display:"flex",gap:6}}><Tag label={drill.category} color={cc} small/><Tag label={drill.duration} color={C.textDim} small/></div>
                  </div>
                  <button className="btn-press" onClick={()=>toggle(a.id)} style={{padding:"9px 14px",borderRadius:9,cursor:"pointer",minHeight:44,flexShrink:0,background:a.completed?"transparent":`linear-gradient(135deg,${C.red},${C.redDim})`,border:a.completed?`1px solid ${C.teal}`:"none",color:a.completed?C.teal:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1,textTransform:"uppercase",transition:"all 0.15s cubic-bezier(0.22,1,0.36,1)"}}>
                    {a.completed?"✓":"Done?"}
                  </button>
                </div>
                <div style={{fontSize:13,color:C.textMid,lineHeight:1.6,marginBottom:8}}>{drill.desc}</div>
                {drill.results&&<div style={{fontSize:12,color:C.teal+"cc",lineHeight:1.55,marginBottom:10,paddingLeft:10,borderLeft:`2px solid ${C.teal}40`}}><span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:C.teal,marginRight:6}}>Goal:</span>{drill.results}</div>}

                {/* Coach demo video */}
                {drillVideos[drill.id]&&(
                  <a href={drillVideos[drill.id].url} target="_blank" rel="noopener noreferrer"
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:`${C.blue}15`,border:`1px solid ${C.blue}40`,borderRadius:10,textDecoration:"none",marginBottom:10}}>
                    <div style={{width:36,height:36,borderRadius:8,background:`${C.blue}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🎬</div>
                    <div>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,color:C.blue}}>Watch Demo Video</div>
                      <div style={{fontSize:11,color:C.textDim,marginTop:1}}>Tap to see how this drill is done</div>
                    </div>
                    <div style={{marginLeft:"auto",color:C.blue,fontSize:18}}>↗</div>
                  </a>
                )}

                {/* Parent video upload — only before acknowledged */}
                {!a.acknowledged && <ParentVideoUpload playerId={player.id} drillId={drill.id} drillName={drill.name} playerVideos={playerVideos} setPlayerVideos={setPlayerVideos}/>}

                {/* State messaging */}
                {(()=>{
                  const pvKey = `${player.id}_${drill.id}`;
                  const hadVideo = playerVideos[pvKey]?.url;
                  if(!a.completed) return null;
                  // Acknowledged → show coach notes + player dismiss button
                  if(a.acknowledged) return (
                    <div style={{marginTop:10}}>
                      {a.notes && <div style={{padding:"10px 14px",background:`${C.gold}10`,borderLeft:`3px solid ${C.gold}`,borderRadius:"0 8px 8px 0",fontSize:13,color:C.text,fontStyle:"italic",marginBottom:10}}>🗣 Coach: {a.notes}</div>}
                      {!a.notes && <div style={{padding:"8px 14px",background:`${C.teal}08`,borderLeft:`3px solid ${C.teal}40`,borderRadius:"0 8px 8px 0",fontSize:12,color:C.textMid,marginBottom:10}}>{hadVideo?"✅ Coach reviewed your video!":"✅ Coach acknowledged — great work!"}</div>}
                      <button onClick={()=>removeAsgn(a.id)} style={{width:"100%",padding:"10px 0",borderRadius:10,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:40}}>
                        ✓ Got it — Remove Drill
                      </button>
                    </div>
                  );
                  // Not yet acknowledged — waiting
                  return (
                    <div style={{marginTop:10,padding:"8px 14px",background:`${C.teal}08`,borderLeft:`3px solid ${C.teal}40`,borderRadius:"0 8px 8px 0",fontSize:12,color:C.textMid,fontStyle:"italic"}}>
                      {hadVideo ? "📹 Video sent — waiting for coach to review" : "✅ Marked complete — waiting for coach acknowledgment"}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Drill Library (browse all drills) - free for all parents */}
      {section==="library"&&<ParentDrillLibrary customDrills={customDrills}/>}

      {/* Schedule */}
      {section==="schedule"&&selEvId&&(()=>{
        const selEv = upcoming.find(e=>e.id===selEvId);
        const playerById = (id) => players.find(p=>p.id===id);

        if(selEv) {
          const isGame = selEv.type==="game";
          const lu = lineups[selEv.id]||{};
          const batting = (lu.batting||[]).filter(Boolean);
          const positions = lu.positions||{};
          const hasLineup = (lu.shared!==false) && (batting.length>0||Object.keys(positions).length>0);
          const evDate = new Date(selEv.date+"T12:00:00");
          return (
            <div>
              {/* Back button */}
              <button onClick={()=>setSelEvId(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer",padding:"0 0 16px 0",textTransform:"uppercase"}}>
                ‹ Back to Schedule
              </button>

              {/* Event hero */}
              <div style={{background:`linear-gradient(135deg,${isGame?"#1a0808":"#080f1a"},${C.card})`,border:`1px solid ${isGame?C.red+"60":C.blue+"60"}`,borderRadius:16,padding:18,marginBottom:16}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                  <Tag label={isGame?"⚾ Game":"🏋️ Practice"} color={isGame?C.red:C.blue}/>
                  <span style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:12,color:C.textMid,letterSpacing:1}}>{evDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</span>
                </div>
                {selEv.opponent&&<div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,color:C.text,letterSpacing:1,marginBottom:8,lineHeight:1}}>vs. {selEv.opponent}</div>}
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <MapLink location={selEv.location} isGame={isGame}/>
                  <div style={{fontSize:13,color:C.textMid}}>🕐 {selEv.time}</div>
                  {selEv.notes&&<div style={{fontSize:12,color:C.textMid,fontStyle:"italic",marginTop:4,paddingTop:8,borderTop:`1px solid ${C.border}`}}>{selEv.notes}</div>}
                </div>
              </div>

              {/* Lineup section */}
              {isGame&&(
                hasLineup ? (
                  <div>
                    {/* Batting order */}
                    {batting.length>0&&(
                      <div style={{marginBottom:20}}>
                        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase",marginBottom:10}}>⚾ Batting Order</div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {batting.map((pid,idx)=>{
                            const p=playerById(pid); if(!p) return null;
                            const fieldPos=Object.entries(positions).find(([k,v])=>v===pid)?.[0];
                            const isMe=p.id===player.id;
                            return (
                              <div key={idx} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,background:isMe?`linear-gradient(90deg,${C.gold}20,${C.gold}08)`:`${C.card}80`,border:`1px solid ${isMe?C.gold:C.border}`,boxShadow:isMe?`0 0 12px ${C.gold}25`:"none"}}>
                                <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,color:isMe?C.gold:C.textDim,lineHeight:1,minWidth:24,textAlign:"center"}}>{idx+1}</div>
                                <Avatar name={p.name} size={32}/>
                                <div style={{flex:1}}>
                                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:isMe?C.gold:C.text}}>
                                    {p.name}{isMe&&<span style={{fontSize:10,color:C.gold,marginLeft:8,letterSpacing:1}}>← YOU</span>}
                                  </div>
                                  {p.number&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:11,color:C.textDim}}>#{p.number}</div>}
                                </div>
                                {fieldPos&&<Tag label={fieldPos} color={C.blue} small/>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Field diamond */}
                    {Object.keys(positions).length>0&&(
                      <div>
                        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase",marginBottom:10}}>🏟 Field Positions</div>
                        <FieldDiamond positions={positions} playerById={playerById} selectedPid={null} onSelectPos={()=>{}} setFieldPos={()=>{}}/>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{textAlign:"center",padding:"24px 0",background:C.card,borderRadius:14,border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:28,marginBottom:8}}>📋</div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,color:C.textDim,letterSpacing:2,textTransform:"uppercase"}}>Lineup not posted yet</div>
                    <div style={{fontSize:12,color:C.textDim,marginTop:4}}>Check back closer to game time</div>
                  </div>
                )
              )}
            </div>
          );
        }

        return null;
      })()}

      {section==="schedule"&&!selEvId&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {upcoming.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",letterSpacing:2,textTransform:"uppercase",fontSize:13}}>No upcoming events</div>}
          {upcoming.map((ev,i)=>{
            const isGame=ev.type==="game";
            const evDate=new Date(ev.date+"T12:00:00");
            const _lu=lineups[ev.id]||{};
            const hasLineup=isGame&&((_lu.batting||[]).some(Boolean)||Object.keys(_lu.positions||{}).length>0);
            const isNext=i===0;
            const myStatus = myRsvps[ev.id];
            return (
              <div key={ev.id}
                style={{background:isNext?`linear-gradient(135deg,${isGame?"#1a0808":"#080f1a"},${C.card})`:C.card,
                  border:`1px solid ${isNext?(isGame?C.red+"60":C.blue+"60"):C.border}`,
                  borderRadius:14,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
                <div onClick={()=>setSelEvId(ev.id)} style={{display:"flex",gap:14,alignItems:"center",cursor:"pointer"}}>
                  <div style={{textAlign:"center",minWidth:44,flexShrink:0}}>
                    <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,color:isGame?C.red:C.blue,lineHeight:1}}>{evDate.getDate()}</div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,color:C.textDim,letterSpacing:1}}>{evDate.toLocaleString("en-US",{month:"short"}).toUpperCase()}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    {isNext&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:2,color:isGame?C.red:C.blue,textTransform:"uppercase",marginBottom:3}}>Next up</div>}
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:16,color:C.text,marginBottom:2}}>{ev.opponent?`vs. ${ev.opponent}`:"Practice"}</div>
                    <MapLink location={ev.location} isGame={isGame}/>
                    <div style={{fontSize:12,color:C.textMid}}>🕐 {ev.time}</div>
                    {hasLineup&&<div style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:5,padding:"3px 8px",borderRadius:6,background:`${C.teal}15`,border:`1px solid ${C.teal}40`}}><span style={{fontSize:9}}>📢</span><span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,color:C.teal,letterSpacing:1,textTransform:"uppercase"}}>Lineup posted</span></div>}
                    {ev.uniform&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:5}}><span style={{fontSize:12}}>👕</span><span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,color:C.gold,letterSpacing:0.5}}>Wear: {ev.uniform}</span></div>}
                  </div>
                  <span style={{color:C.textDim,fontSize:20,flexShrink:0}}>›</span>
                </div>
                {/* Live Score (games only) */}
                {isGame&&parentGameScores[ev.id]&&parentGameScores[ev.id].game_status!=='not_started'&&(()=>{
                  const sc = parentGameScores[ev.id];
                  const isLive = sc.game_status==='in_progress';
                  const isFinal = sc.game_status==='final';
                  return (
                    <div style={{padding:"10px 12px",background:`linear-gradient(135deg,#0a1525,${C.bg})`,border:`1px solid ${isLive?C.red:C.border}`,borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
                      {isLive&&<div className="badge-pulse" style={{padding:"3px 8px",borderRadius:6,background:C.red,color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:9,letterSpacing:1.5,textTransform:"uppercase"}}>● LIVE</div>}
                      {isFinal&&<div style={{padding:"3px 8px",borderRadius:6,background:C.textDim,color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:9,letterSpacing:1.5,textTransform:"uppercase"}}>FINAL</div>}
                      <div style={{flex:1,display:"flex",alignItems:"center",gap:10,justifyContent:"center"}}>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1,color:C.textDim,textTransform:"uppercase"}}>{(sc.home_team||"Home").slice(0,12)}</div>
                          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,color:C.text,lineHeight:1}}>{sc.home_score}</div>
                        </div>
                        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:14,color:C.textDim}}>—</div>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1,color:C.textDim,textTransform:"uppercase"}}>{(sc.away_team||"Away").slice(0,12)}</div>
                          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,color:C.text,lineHeight:1}}>{sc.away_score}</div>
                        </div>
                      </div>
                      {isLive&&(
                        <div style={{textAlign:"right",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,color:C.textDim,letterSpacing:1}}>
                          <div>{sc.is_top_inning?"TOP":"BOT"} {sc.current_inning}</div>
                          <div style={{color:C.gold,marginTop:1}}>{sc.outs} OUT</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* RSVP Buttons */}
                <div style={{display:"flex",gap:6,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase",alignSelf:"center",marginRight:4}}>Going?</div>
                  {[
                    {key:"going",label:"✓ Yes",color:C.teal},
                    {key:"out",label:"✗ No",color:C.red},
                    {key:"maybe",label:"? Maybe",color:C.gold},
                  ].map(opt=>{
                    const active = myStatus===opt.key;
                    return (
                      <button key={opt.key} onClick={(e)=>{e.stopPropagation();setRsvp(ev.id,opt.key);}} style={{flex:1,padding:"7px 8px",borderRadius:8,background:active?`${opt.color}25`:`${C.bg}`,border:`1px solid ${active?opt.color:C.border}`,color:active?opt.color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,cursor:"pointer",transition:"all 0.15s",textTransform:"uppercase"}}>{opt.label}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goals */}
      {section==="goals"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {!(player.goals?.length)&&<div style={{textAlign:"center",padding:"24px 0",color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",letterSpacing:2,textTransform:"uppercase",fontSize:13}}>No goals set yet by your coach</div>}
          {(player.goals||[]).map((g,i)=><div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.gold}`,borderRadius:"0 12px 12px 0",padding:"14px 16px",fontSize:14,color:C.textMid}}>→ {g}</div>)}
        </div>
      )}

      {/* Report Card */}
      {section==="report"&&<ParentReportCard player={player} assignments={assignments} skillSnapshots={skillSnapshots.filter(s=>s.playerId===player.id)} events={events}/>}

      {/* Stats — game-by-game and season totals */}
      {section==="stats"&&(()=>{
        // Compute season totals
        const totals = myStats.reduce((acc,g)=>({
          at_bats: acc.at_bats + (g.at_bats||0),
          hits: acc.hits + (g.hits||0),
          singles: acc.singles + (g.singles||0),
          doubles: acc.doubles + (g.doubles||0),
          triples: acc.triples + (g.triples||0),
          home_runs: acc.home_runs + (g.home_runs||0),
          runs_scored: acc.runs_scored + (g.runs_scored||0),
          rbis: acc.rbis + (g.rbis||0),
          walks: acc.walks + (g.walks||0),
          strikeouts: acc.strikeouts + (g.strikeouts||0),
          hbp: acc.hbp + (g.hbp||0),
          sac_fly: acc.sac_fly + (g.sac_fly||0),
          stolen_bases: acc.stolen_bases + (g.stolen_bases||0),
          games: acc.games + 1,
        }),{at_bats:0,hits:0,singles:0,doubles:0,triples:0,home_runs:0,runs_scored:0,rbis:0,walks:0,strikeouts:0,hbp:0,sac_fly:0,stolen_bases:0,games:0});
        const avg = totals.at_bats>0 ? (totals.hits/totals.at_bats).toFixed(3).replace(/^0/,"") : ".000";
        const pa = totals.at_bats + totals.walks + totals.hbp + totals.sac_fly;
        const obp = pa>0 ? ((totals.hits+totals.walks+totals.hbp)/pa).toFixed(3).replace(/^0/,"") : ".000";
        const tb = totals.singles + (totals.doubles*2) + (totals.triples*3) + (totals.home_runs*4);
        const slg = totals.at_bats>0 ? (tb/totals.at_bats).toFixed(3).replace(/^0/,"") : ".000";
        const ops = (parseFloat(obp)+parseFloat(slg)).toFixed(3).replace(/^0/,"");

        // Helper to compute per-game stats for display
        const gameStats = myStats.map(g=>{
          const ev = events.find(e=>e.id===g.event_id);
          const gameAvg = (g.at_bats||0)>0 ? ((g.hits||0)/(g.at_bats||0)).toFixed(3).replace(/^0/,"") : ".000";
          return {...g, ev, gameAvg};
        });

        return (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Hero card with season AVG */}
            <div className="glass-card" style={{borderRadius:20,padding:"22px 20px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.gold},${C.red},${C.gold})`}}/>
              <div style={{position:"absolute",top:-50,right:-50,width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle,${C.gold}20 0%,transparent 70%)`,pointerEvents:"none"}}/>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:3,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>{player.name.split(" ")[0]}'s Season</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:18,position:"relative"}}>
                <div>
                  <div className="number-pop" style={{fontFamily:"Bebas Neue, sans-serif",fontSize:64,color:C.gold,lineHeight:1,letterSpacing:1,textShadow:`0 0 30px ${C.gold}80`}}>{avg}</div>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase",marginTop:4}}>Batting Avg</div>
                </div>
                <div style={{flex:1,display:"flex",justifyContent:"flex-end",gap:14}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:30,color:C.text,lineHeight:1}}>{obp}</div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1.5,color:C.textDim,textTransform:"uppercase",marginTop:3}}>OBP</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:30,color:C.text,lineHeight:1}}>{slg}</div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1.5,color:C.textDim,textTransform:"uppercase",marginTop:3}}>SLG</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:30,color:C.gold,lineHeight:1}}>{ops}</div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1.5,color:C.gold,textTransform:"uppercase",marginTop:3}}>OPS</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Season totals breakdown */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 16px"}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:14}}>📊 Season Totals · {totals.games} Game{totals.games!==1?'s':''}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {[
                  {label:"AB",   value:totals.at_bats,    color:C.text},
                  {label:"H",    value:totals.hits,       color:C.teal},
                  {label:"R",    value:totals.runs_scored,color:C.gold},
                  {label:"RBI",  value:totals.rbis,       color:C.gold},
                  {label:"1B",   value:totals.singles,    color:C.text},
                  {label:"2B",   value:totals.doubles,    color:C.teal},
                  {label:"3B",   value:totals.triples,    color:C.teal},
                  {label:"HR",   value:totals.home_runs,  color:C.red},
                  {label:"BB",   value:totals.walks,      color:C.blue},
                  {label:"K",    value:totals.strikeouts, color:C.textMid},
                  {label:"HBP",  value:totals.hbp,        color:C.textMid},
                  {label:"SB",   value:totals.stolen_bases,color:C.teal},
                ].map(s=>(
                  <div key={s.label} style={{textAlign:"center",padding:"10px 0",background:`${C.bg}80`,borderRadius:10,border:`1px solid ${C.border}`}}>
                    <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,color:s.color,lineHeight:1}}>{s.value}</div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1.5,color:C.textDim,textTransform:"uppercase",marginTop:3}}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Game-by-game */}
            {gameStats.length>0?(
              <div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:10}}>Game by Game</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {gameStats.map(g=>{
                    const dateStr = g.ev?.date ? new Date(g.ev.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "Game";
                    const oppStr = g.ev?.opponent ? `vs. ${g.ev.opponent}` : "Practice";
                    const hadAB = (g.at_bats||0)>0 || (g.walks||0)>0 || (g.hbp||0)>0;
                    const score = parentGameScores[g.event_id];
                    return (
                      <div key={g.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:hadAB||score?10:0}}>
                          <div>
                            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:14,color:C.text}}>{oppStr}</div>
                            <div style={{fontSize:11,color:C.textDim,marginTop:2}}>{dateStr}</div>
                          </div>
                          {hadAB&&(
                            <div style={{textAlign:"right"}}>
                              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,color:C.gold,lineHeight:1}}>{g.hits}-{g.at_bats}</div>
                              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1.5,color:C.textDim,textTransform:"uppercase",marginTop:3}}>{g.gameAvg}</div>
                            </div>
                          )}
                        </div>
                        {/* Game Score */}
                        {score&&score.game_status!=='not_started'&&(()=>{
                          const isLive = score.game_status==='in_progress';
                          const isFinal = score.game_status==='final';
                          const homeWon = score.home_score > score.away_score;
                          const awayWon = score.away_score > score.home_score;
                          return (
                            <div style={{padding:"10px 12px",background:`linear-gradient(135deg,#0a1525,${C.bg})`,border:`1px solid ${isLive?C.red:C.border}`,borderRadius:10,display:"flex",alignItems:"center",gap:10,marginBottom:hadAB?10:0}}>
                              {isLive&&<div className="badge-pulse" style={{padding:"3px 8px",borderRadius:6,background:C.red,color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:9,letterSpacing:1.5,textTransform:"uppercase"}}>● LIVE</div>}
                              {isFinal&&<div style={{padding:"3px 8px",borderRadius:6,background:homeWon?C.teal:awayWon?C.red:C.textDim,color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:9,letterSpacing:1.5,textTransform:"uppercase"}}>{homeWon?"W":awayWon?"L":"T"} · Final</div>}
                              <div style={{flex:1,display:"flex",alignItems:"center",gap:10,justifyContent:"center"}}>
                                <div style={{textAlign:"center"}}>
                                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1,color:C.textDim,textTransform:"uppercase"}}>{(score.home_team||"Home").slice(0,12)}</div>
                                  <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,color:homeWon?C.gold:C.text,lineHeight:1}}>{score.home_score}</div>
                                </div>
                                <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:14,color:C.textDim}}>—</div>
                                <div style={{textAlign:"center"}}>
                                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1,color:C.textDim,textTransform:"uppercase"}}>{(score.away_team||"Away").slice(0,12)}</div>
                                  <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,color:awayWon?C.gold:C.text,lineHeight:1}}>{score.away_score}</div>
                                </div>
                              </div>
                              {isLive&&(
                                <div style={{textAlign:"right",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,color:C.textDim,letterSpacing:1}}>
                                  <div>{score.is_top_inning?"TOP":"BOT"} {score.current_inning}</div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {hadAB&&(
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                            {(g.runs_scored||0)>0 && <div style={{padding:"3px 8px",background:`${C.gold}15`,border:`1px solid ${C.gold}40`,borderRadius:6,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.gold,letterSpacing:0.5}}>{g.runs_scored} R</div>}
                            {(g.rbis||0)>0 && <div style={{padding:"3px 8px",background:`${C.gold}15`,border:`1px solid ${C.gold}40`,borderRadius:6,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.gold,letterSpacing:0.5}}>{g.rbis} RBI</div>}
                            {(g.home_runs||0)>0 && <div style={{padding:"3px 8px",background:`${C.red}15`,border:`1px solid ${C.red}40`,borderRadius:6,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.red,letterSpacing:0.5}}>{g.home_runs} HR</div>}
                            {(g.triples||0)>0 && <div style={{padding:"3px 8px",background:`${C.teal}15`,border:`1px solid ${C.teal}40`,borderRadius:6,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.teal,letterSpacing:0.5}}>{g.triples} 3B</div>}
                            {(g.doubles||0)>0 && <div style={{padding:"3px 8px",background:`${C.teal}15`,border:`1px solid ${C.teal}40`,borderRadius:6,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.teal,letterSpacing:0.5}}>{g.doubles} 2B</div>}
                            {(g.walks||0)>0 && <div style={{padding:"3px 8px",background:`${C.blue}15`,border:`1px solid ${C.blue}40`,borderRadius:6,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.blue,letterSpacing:0.5}}>{g.walks} BB</div>}
                            {(g.strikeouts||0)>0 && <div style={{padding:"3px 8px",background:"#ffffff08",border:`1px solid ${C.border}`,borderRadius:6,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.textMid,letterSpacing:0.5}}>{g.strikeouts} K</div>}
                            {(g.stolen_bases||0)>0 && <div style={{padding:"3px 8px",background:`${C.teal}15`,border:`1px solid ${C.teal}40`,borderRadius:6,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.teal,letterSpacing:0.5}}>{g.stolen_bases} SB</div>}
                          </div>
                        )}
                        {!hadAB&&<div style={{fontSize:11,color:C.textDim,fontStyle:"italic"}}>Did not bat</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ):(
              <EmptyState icon="📊" title="No stats yet" body={`${player.name.split(" ")[0]}'s game stats will appear here as soon as the coach starts scoring games.`}/>
            )}
          </div>
        );
      })()}

      {/* Chat shortcuts */}
      {section==="chat"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[
            {id:"team",          name:"Team Chat",       sub:"Coach + all families", icon:"⚾", isGroup:true},
            {id:dmChannel||`dm-${player?.id}`,name:"Coach", sub:"Direct message", icon:null, isGroup:false},
          ].map(ch=>(
            <button key={ch.id} onClick={()=>onOpenChat(ch.id)} className="card-hover" style={{display:"flex",gap:14,alignItems:"center",padding:"16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,textAlign:"left",width:"100%",minHeight:70,cursor:"pointer"}}>
              {ch.isGroup
                ?<div style={{width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,#1a3a7a,#0a1f50)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
                    {teamLogo
                      ? <img src={teamLogo} alt="team" style={{width:46,height:46,objectFit:"cover"}}/>
                      : <span style={{fontFamily:"Bebas Neue, sans-serif",fontSize:16,letterSpacing:1,color:"#fff"}}>{teamInitials}</span>
                    }
                  </div>
                :<Avatar name="Coach" size={46}/>}
              <div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:17,color:C.text,marginBottom:3}}>{ch.name}</div>
                <div style={{fontSize:12,color:C.textDim}}>{ch.sub}</div>
              </div>
              <span style={{marginLeft:"auto",color:C.red,fontSize:20}}>›</span>
            </button>
          ))}
        </div>
      )}

      {/* Help & Support */}
      <button onClick={onSupport} style={{display:"flex",alignItems:"center",gap:12,width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginTop:16,cursor:"pointer",textAlign:"left"}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.text,letterSpacing:0.5}}>Help & Support</div>
          <div style={{fontSize:11,color:C.textDim}}>Report a bug or ask a question</div>
        </div>
        <div style={{color:C.textDim,fontSize:15}}>›</div>
      </button>

      {/* Delete My Account */}
      <button onClick={()=>{setShowDeleteAcct(true);setDelAcctError("");}} style={{display:"flex",alignItems:"center",gap:12,width:"100%",background:"transparent",border:`1px solid ${C.red}30`,borderRadius:14,padding:"14px",marginTop:10,cursor:"pointer",textAlign:"left"}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.red,letterSpacing:0.5}}>Delete My Account</div>
          <div style={{fontSize:11,color:C.textDim}}>Permanently remove your login and personal data</div>
        </div>
        <div style={{color:C.textDim,fontSize:15}}>›</div>
      </button>

      {showDeleteAcct && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={()=>!deletingAcct&&setShowDeleteAcct(false)}>
          <div style={{background:C.card,border:`1px solid ${C.red}50`,borderRadius:16,padding:"22px 18px",maxWidth:420,width:"100%"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:1.5,color:C.red,marginBottom:10}}>DELETE MY ACCOUNT</div>
            <div style={{fontSize:13,color:C.text,lineHeight:1.6,marginBottom:10}}>
              This permanently deletes your parent account: your login, chat messages, notification settings, and your connection to {player?.name||"your player"}. This cannot be undone.
            </div>
            <div style={{fontSize:12,color:C.textDim,lineHeight:1.6,marginBottom:14}}>
              Note: {player?.name||"your player"}'s roster information belongs to the team and is not deleted here. To remove it, ask your coach to delete the player, or contact support.
            </div>
            {delAcctError && <div style={{fontSize:12,color:C.red,background:`${C.red}15`,border:`1px solid ${C.red}40`,borderRadius:8,padding:"8px 10px",marginBottom:12}}>{delAcctError}</div>}
            <div style={{display:"flex",gap:10}}>
              <button disabled={deletingAcct} onClick={()=>setShowDeleteAcct(false)} style={{flex:1,padding:"12px 0",borderRadius:10,background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>Cancel</button>
              <button disabled={deletingAcct} onClick={handleDeleteAccount} style={{flex:1,padding:"12px 0",borderRadius:10,background:deletingAcct?`${C.red}50`:C.red,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:1.5,textTransform:"uppercase",cursor:deletingAcct?"wait":"pointer"}}>{deletingAcct?"Deleting…":"Delete Permanently"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LINEUP BUILDER ───────────────────────────────────────────────────────────
const FIELD_IMG = "/field-diagram.jpg";

const FIELD_POSITIONS = ["P","C","1B","2B","3B","SS","LF","CF","RF"];

const POSITION_NAMES = {
  "P":  "Pitcher — throws the ball to start each play",
  "C":  "Catcher — crouches behind home plate, catches pitches",
  "1B": "First Base — stands near first base, catches throws",
  "2B": "Second Base — covers the area between first and second",
  "3B": "Third Base — guards third base, often called the 'hot corner'",
  "SS": "Shortstop — plays between second and third, usually your best fielder",
  "LF": "Left Field — covers the left side of the outfield",
  "CF": "Center Field — covers the middle of the outfield",
  "RF": "Right Field — covers the right side of the outfield",
};

function PositionLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{marginBottom:12}}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:`1px solid ${C.blue}30`,borderRadius:8,padding:"5px 10px",color:C.blue,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>
        📖 What do the position abbreviations mean? {open?"▲":"▼"}
      </button>
      {open&&(
        <div style={{marginTop:8,background:`${C.blue}08`,border:`1px solid ${C.blue}20`,borderRadius:10,padding:"10px 12px",display:"flex",flexDirection:"column",gap:5}}>
          {FIELD_POSITIONS.map(pos=>(
            <div key={pos} style={{display:"flex",gap:8,alignItems:"baseline"}}>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:13,color:C.blue,minWidth:28,letterSpacing:1}}>{pos}</div>
              <div style={{fontSize:11,color:C.textMid,lineHeight:1.4}}>{POSITION_NAMES[pos]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const POS_COORDS = {
  P:    { left:"50.0%", top:"55.2%" },
  C:    { left:"50.2%", top:"70.1%" },
  "1B": { left:"66.2%", top:"53.9%" },
  "2B": { left:"59.4%", top:"43.8%" },
  "3B": { left:"34.4%", top:"52.5%" },
  SS:   { left:"41.0%", top:"43.0%" },
  LF:   { left:"24.2%", top:"30.4%" },
  CF:   { left:"49.8%", top:"21.3%" },
  RF:   { left:"75.8%", top:"30.8%" },
};

// (LineupBuilder removed — unused dead code; lineup UI now lives in Schedule)

// ── Field Diamond SVG graphic ─────────────────────────────────────────────────
function FieldDiamond({positions, playerById, selectedPid, onSelectPos, setFieldPos}) {
  return (
    <div style={{position:"relative",width:"100%",paddingTop:"100%",borderRadius:16,overflow:"hidden",boxShadow:`0 8px 32px #00000080`,border:`2px solid #1a4a2a`,marginBottom:20}}>
      {/* Field photo */}
      <img src={FIELD_IMG} alt="baseball field" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 90% 90% at 50% 50%,transparent 50%,rgba(0,0,0,0.35) 100%)",pointerEvents:"none"}}/>

      {/* Position markers */}
      {FIELD_POSITIONS.map(pos=>{
        const pid    = positions[pos];
        const p      = pid ? playerById(pid) : null;
        const coords = POS_COORDS[pos];
        const isTarget = !!selectedPid && !p;
        const isSelectedHere = !!selectedPid && pid === selectedPid;
        return (
          <div key={pos}
            onClick={()=>onSelectPos(pos)}
            style={{position:"absolute",left:coords.left,top:coords.top,transform:"translate(-50%,-50%)",zIndex:10,cursor:"pointer"}}>
            {p ? (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <div style={{width:28,height:28,borderRadius:"50%",
                  background:isSelectedHere?`linear-gradient(135deg,${C.gold},${C.gold}cc)`:`linear-gradient(135deg,${avatarColor(p.name)},${avatarColor(p.name)}cc)`,
                  border:`2px solid ${isSelectedHere?"#fff":avatarColor(p.name)}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:"Bebas Neue, sans-serif",fontWeight:800,fontSize:10,color:"#fff",
                  boxShadow:`0 0 ${isSelectedHere?"16px "+C.gold+"90":"10px "+avatarColor(p.name)+"90"},0 2px 8px rgba(0,0,0,0.8)`,
                  transition:"all 0.15s"}}>
                  {p.number ? `#${p.number}` : initials(p.name)}
                </div>
                <div style={{background:"rgba(0,0,0,0.85)",borderRadius:3,padding:"1px 4px",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:8,color:isSelectedHere?C.gold:"#fff",letterSpacing:0.5,whiteSpace:"nowrap",backdropFilter:"blur(4px)"}}>{pos}</div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <div style={{width:22,height:22,borderRadius:"50%",
                  background:isTarget?"rgba(30,123,212,0.55)":"rgba(0,0,0,0.45)",
                  border:`${isTarget?"2px":"1px"} solid ${isTarget?"#60a5fa":"rgba(255,255,255,0.5)"}`,
                  backdropFilter:"blur(4px)",
                  boxShadow:isTarget?`0 0 16px ${C.blue}80`:"0 1px 6px rgba(0,0,0,0.5)",
                  transition:"all 0.15s"}}/>
                <div style={{background:"rgba(0,0,0,0.75)",borderRadius:3,padding:"1px 4px",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:8,color:isTarget?"#93c5fd":"rgba(255,255,255,0.8)",letterSpacing:0.5,whiteSpace:"nowrap",backdropFilter:"blur(4px)"}}>{pos}</div>
              </div>
            )}
          </div>
        );
      })}

      {/* Banner: who's selected */}
      {selectedPid&&(()=>{const sp=playerById(selectedPid);return sp?(
        <div style={{position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",background:"rgba(212,163,30,0.92)",borderRadius:10,padding:"6px 18px",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:2,color:"#000",textTransform:"uppercase",backdropFilter:"blur(8px)",boxShadow:`0 4px 16px rgba(0,0,0,0.5)`,whiteSpace:"nowrap"}}>
          {sp.number?`#${sp.number} `:""}{sp.name} — tap a position
        </div>
      ):null;})()}
    </div>
  );
}

// ── Bench roster strip ────────────────────────────────────────────────────────
function BenchRoster({bench, selectedPid, onSelectPlayer, onTapAdd}) {
  return (
    <div>
      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:10}}>
        Bench / Available ({bench.length})
      </div>
      {bench.length===0
        ? <div style={{textAlign:"center",padding:"16px 0",color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontSize:12,letterSpacing:2,textTransform:"uppercase"}}>All players assigned ✓</div>
        : <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {bench.map(p=>{
              const isSelected = p.id===selectedPid;
              return (
                <div key={p.id} onClick={()=>onSelectPlayer&&onSelectPlayer(isSelected?null:p.id)}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:12,
                    background:isSelected?`linear-gradient(90deg,${C.gold}25,${C.gold}10)`:C.card,
                    border:`2px solid ${isSelected?C.gold:C.border}`,
                    cursor:"pointer",transition:"all 0.15s",
                    boxShadow:isSelected?`0 0 14px ${C.gold}35`:"none"}}>
                  <Avatar name={p.name} size={34}/>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:isSelected?C.gold:C.textMid}}>{p.name}</div>
                    <Tag label={p.position} color={isSelected?C.gold:C.textDim} small/>
                  </div>
                  {isSelected
                    ? <div style={{fontSize:14,color:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1}}>✦ Selected</div>
                    : <div style={{fontSize:12,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Tap to select</div>
                  }
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ─── ONBOARDING FLOW ──────────────────────────────────────────────────────────
function OnboardingFlow({coachName, teamName, teamId, setPlayers, setAsgn, onSkip, onComplete}) {
  const [step, setStep] = useState(0); // 0=welcome, 1=add player, 2=assign drill, 3=done
  const [addedPlayer, setAddedPlayer] = useState(null);
  const [bulkAddedCount, setBulkAddedCount] = useState(0);
  const [form, setForm] = useState({name:"",age:"",ageGroup:AGE_GROUPS[1],position:"SS",number:"",bats:"R",throws:"R",parent1:"",parent1email:""});
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const [selectedDrill, setSelectedDrill] = useState(null);
  const [drillSearch, setDrillSearch] = useState("");
  const [drillCat, setDrillCat] = useState("All");

  // Scanner lives in components/RosterScanner.jsx — shared with the Roster screen.
  const [showScanner, setShowScanner] = useState(false);

  const firstName = (coachName||"Coach").split(" ")[0];

  const savePlayer = async () => {
    if(!form.name.trim()) return;
    const pid = uid();
    const parents = [];
    if(form.parent1.trim()) parents.push({id:pid+"a",name:form.parent1.trim(),phone:"",email:form.parent1email.trim()});
    const newPlayer = {id:pid,name:form.name,age:parseInt(form.age)||0,ageGroup:form.ageGroup,position:form.position,number:form.number,bats:form.bats,throws:form.throws,parents,goals:[]};
    // setPlayers is the DB-aware setter — it persists and surfaces errors itself.
    setPlayers(prev=>[...prev,newPlayer]);
    setAddedPlayer(newPlayer);
    setStep(2);
  };

  const assignDrill = () => {
    if(!selectedDrill || !addedPlayer) return;
    const asgn = {id:uid(),playerId:addedPlayer.id,drillId:selectedDrill.id,assignedDate:new Date().toISOString().slice(0,10),completed:false,notes:"",acknowledged:false,coachRating:null};
    setAsgn(prev=>[...prev,asgn]);
    setStep(3);
  };

  const filteredDrills = getAllDrills().filter(d => {
    if(drillCat!=="All" && d.category!==drillCat) return false;
    if(drillSearch && !d.name.toLowerCase().includes(drillSearch.toLowerCase())) return false;
    return true;
  }).slice(0,8);

  const categories = ["All",...Object.keys(catMeta)];

  const stepIndicator = (
    <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:28}}>
      {[0,1,2,3].map(i=>(
        <div key={i} style={{width:i===step?28:8,height:8,borderRadius:4,background:i<=step?`linear-gradient(90deg,${C.red},${C.gold})`:C.border,transition:"all 0.3s cubic-bezier(0.22,1,0.36,1)"}}/>
      ))}
    </div>
  );

  return (
    <div style={{maxWidth:500,margin:"0 auto",padding:"24px 16px",minHeight:"100vh",display:"flex",flexDirection:"column"}}>

      {/* Skip button */}
      {step<3&&(
        <div style={{textAlign:"right",marginBottom:8}}>
          <button onClick={onSkip} style={{background:"none",border:"none",color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:12,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",padding:"8px 4px"}}>Skip for now →</button>
        </div>
      )}

      {stepIndicator}

      {/* ── STEP 0: WELCOME ── */}
      {step===0&&(
        <div className="fade-up" style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",gap:24}}>
          <div style={{fontSize:56,marginBottom:8}}>⚾</div>
          <div>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:36,letterSpacing:3,color:C.text,lineHeight:1.1}}>
              Welcome, {firstName}!
            </div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:14,color:C.textMid,marginTop:12,lineHeight:1.6,maxWidth:340,margin:"12px auto 0"}}>
              Let's set up <span style={{color:C.gold,fontWeight:800}}>{teamName||"your team"}</span> in under a minute. Snap a photo of your team sheet and we'll add your whole roster at once — or add players one at a time.
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:320,marginTop:8}}>
            {[
              {icon:"📸",label:"Scan your roster",sub:"AI reads your team sheet in seconds"},
              {icon:"⚾",label:"Assign drills",sub:"69 drills across 9 categories"},
              {icon:"📅",label:"Build your schedule",sub:"Games, practices, and lineups"},
            ].map((item,i)=>(
              <div key={i} className={`fade-up-${i+1}`} style={{display:"flex",gap:14,alignItems:"center",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",textAlign:"left"}}>
                <div style={{width:40,height:40,borderRadius:10,background:`${C.red}15`,border:`1px solid ${C.red}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{item.icon}</div>
                <div>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,color:C.text,letterSpacing:0.5}}>{item.label}</div>
                  <div style={{fontSize:11,color:C.textDim,marginTop:1}}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="btn-press" onClick={()=>setStep(1)} style={{width:"100%",maxWidth:320,padding:"16px 0",borderRadius:12,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:16,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:54,boxShadow:`0 8px 24px ${C.red}50`,marginTop:8}}>
            Let's Go →
          </button>
        </div>
      )}

      {/* ── STEP 1: ADD ROSTER (scan first, manual fallback) ── */}
      {step===1&&(
        <div className="fade-up">
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:40,marginBottom:8}}>👥</div>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:26,letterSpacing:3,color:C.text}}>Add Your Roster</div>
            <div style={{fontSize:13,color:C.textDim,marginTop:6}}>Scan a team sheet to add everyone — or add one player manually</div>
          </div>

          {/* Scan CTA — the fast path, shown first */}
          <button onClick={()=>setShowScanner(true)} style={{width:"100%",display:"flex",alignItems:"center",gap:14,textAlign:"left",padding:"18px 16px",borderRadius:16,background:`linear-gradient(135deg,${C.teal}18,${C.teal}08)`,border:`1.5px solid ${C.teal}55`,cursor:"pointer",boxShadow:`0 0 24px ${C.teal}12`,marginBottom:18}}>
            <div style={{width:46,height:46,borderRadius:12,background:`${C.teal}25`,border:`1px solid ${C.teal}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>📸</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:C.teal,letterSpacing:0.5,textTransform:"uppercase"}}>Scan a team sheet</div>
              <div style={{fontSize:12,color:C.textMid,marginTop:2,lineHeight:1.4}}>Snap a photo of your roster, sign-up sheet, or spreadsheet — AI adds everyone at once.</div>
            </div>
            <div style={{color:C.teal,fontSize:22,fontWeight:800,flexShrink:0}}>→</div>
          </button>

          {/* Divider */}
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"4px 0 18px"}}>
            <div style={{flex:1,height:1,background:C.border}}/>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>or add one manually</div>
            <div style={{flex:1,height:1,background:C.border}}/>
          </div>

          <div style={{background:`linear-gradient(135deg,#100c1a,${C.card})`,borderRadius:16,border:`1px solid ${C.red}40`,padding:20,boxShadow:`0 0 30px ${C.red}15`}}>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Inp label="Player Name" value={form.name} onChange={e=>f("name",e.target.value)} placeholder="e.g. Nolan Ryan Jr."/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Inp label="Age" value={form.age} type="number" onChange={e=>f("age",e.target.value)} placeholder="12"/>
                <Inp label="Jersey #" value={form.number} onChange={e=>f("number",e.target.value)} placeholder="7"/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <SelF label="Position" value={form.position} onChange={v=>f("position",v)} options={POSITIONS}/>
                <SelF label="Bats" value={form.bats} onChange={v=>f("bats",v)} options={["R","L","S"]}/>
                <SelF label="Throws" value={form.throws} onChange={v=>f("throws",v)} options={["R","L"]}/>
              </div>
              <SelF label="Age Group" value={form.ageGroup} onChange={v=>f("ageGroup",v)} options={AGE_GROUPS}/>
              <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}20`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.blue,textTransform:"uppercase"}}>Parent / Guardian (optional)</div>
                <Inp label="Name" value={form.parent1} onChange={e=>f("parent1",e.target.value)} placeholder="Parent's full name"/>
                <Inp label="Email" value={form.parent1email} onChange={e=>f("parent1email",e.target.value)} placeholder="parent@email.com" type="email"/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button className="btn-press" onClick={savePlayer} disabled={!form.name.trim()} style={{flex:1,padding:"14px 0",borderRadius:12,background:!form.name.trim()?"#1a2f52":`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:!form.name.trim()?C.textDim:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:2,textTransform:"uppercase",cursor:!form.name.trim()?"default":"pointer",minHeight:52,boxShadow:!form.name.trim()?"none":`0 6px 20px ${C.red}40`}}>
                Save & Continue →
              </button>
            </div>
          </div>

          <button onClick={()=>setStep(0)} style={{display:"block",width:"100%",marginTop:12,background:"none",border:"none",color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontSize:13,cursor:"pointer",padding:"8px 0"}}>← Back</button>
        </div>
      )}

      {/* ── STEP 2: ASSIGN A DRILL ── */}
      {step===2&&(
        <div className="fade-up">
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:40,marginBottom:8}}>🏋️</div>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:26,letterSpacing:3,color:C.text}}>Assign a Drill</div>
            <div style={{fontSize:13,color:C.textDim,marginTop:6}}>
              Pick a drill for <span style={{color:C.gold,fontWeight:700}}>{addedPlayer?.name||"your player"}</span>
            </div>
          </div>

          {/* Category filter */}
          <div className="pill-scroll" style={{display:"flex",gap:6,overflowX:"auto",marginBottom:12,paddingBottom:4}}>
            {categories.map(cat=>(
              <button key={cat} onClick={()=>setDrillCat(cat)} style={{padding:"7px 14px",borderRadius:20,background:drillCat===cat?`linear-gradient(135deg,${C.red},${C.redDim})`:"transparent",border:`1px solid ${drillCat===cat?C.red:C.border}`,color:drillCat===cat?"#fff":C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.15s"}}>
                {cat==="All"?"All":catIcon(cat)+" "+cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <input value={drillSearch} onChange={e=>setDrillSearch(e.target.value)} placeholder="Search drills..." style={{...inp,marginBottom:14}}/>

          {/* Drill list */}
          <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:320,overflowY:"auto"}}>
            {filteredDrills.map(drill=>{
              const cc = catColor(drill.category);
              const selected = selectedDrill?.id===drill.id;
              return (
                <button key={drill.id} className="btn-press" onClick={()=>setSelectedDrill(drill)} style={{background:selected?`${cc}15`:C.card,border:`2px solid ${selected?cc:C.border}`,borderRadius:14,padding:"14px 16px",textAlign:"left",cursor:"pointer",transition:"all 0.15s",boxShadow:selected?`0 0 20px ${cc}25`:"none"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:cc,boxShadow:`0 0 8px ${cc}80`,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,color:selected?cc:C.text,letterSpacing:0.5}}>{drill.name}</div>
                      <div style={{display:"flex",gap:6,marginTop:4}}>
                        <Tag label={drill.category} color={cc} small/>
                        <Tag label={drill.duration} color={C.textDim} small/>
                      </div>
                    </div>
                    {selected&&<div style={{color:cc,fontSize:18,fontWeight:800}}>✓</div>}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button className="btn-press" onClick={assignDrill} disabled={!selectedDrill} style={{flex:1,padding:"14px 0",borderRadius:12,background:!selectedDrill?"#1a2f52":`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:!selectedDrill?C.textDim:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:2,textTransform:"uppercase",cursor:!selectedDrill?"default":"pointer",minHeight:52,boxShadow:!selectedDrill?"none":`0 6px 20px ${C.red}40`}}>
              Assign & Finish →
            </button>
          </div>

          <button onClick={()=>{setStep(3);}} style={{display:"block",width:"100%",marginTop:10,background:"none",border:"none",color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontSize:12,cursor:"pointer",padding:"8px 0"}}>Skip this step →</button>
        </div>
      )}

      {/* ── STEP 3: ALL SET ── */}
      {step===3&&(
        <div className="fade-up" style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",gap:20}}>
          <div style={{width:80,height:80,borderRadius:"50%",background:`${C.teal}20`,border:`2px solid ${C.teal}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,boxShadow:`0 0 32px ${C.teal}40`}}>🎉</div>
          <div>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:32,letterSpacing:3,color:C.text}}>You're All Set!</div>
            <div style={{fontSize:14,color:C.textMid,marginTop:10,lineHeight:1.7,maxWidth:340,margin:"10px auto 0"}}>
              {bulkAddedCount>0
                ? `${bulkAddedCount} player${bulkAddedCount!==1?'s':''} added to your roster.`
                : addedPlayer ? `${addedPlayer.name} is on the roster${selectedDrill?` with "${selectedDrill.name}" assigned`:""}.` : "Your team is ready."} Here's what to do next:
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:340}}>
            {[
              {icon:"👥",label:bulkAddedCount>0?"Review your roster":"Add the rest of your roster",sub:bulkAddedCount>0?"Check details and edit any player in the Roster tab":"Go to Roster tab to add all players"},
              {icon:"📅",label:"Set up your schedule",sub:"Add upcoming games and practices"},
              {icon:"📨",label:"Invite parents",sub:"From a player's profile, send invite emails"},
            ].map((item,i)=>(
              <div key={i} className={`fade-up-${i+1}`} style={{display:"flex",gap:14,alignItems:"center",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",textAlign:"left"}}>
                <div style={{width:36,height:36,borderRadius:10,background:`${C.teal}15`,border:`1px solid ${C.teal}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{item.icon}</div>
                <div>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,color:C.text}}>{item.label}</div>
                  <div style={{fontSize:11,color:C.textDim,marginTop:1}}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="btn-press" onClick={onComplete} style={{width:"100%",maxWidth:340,padding:"16px 0",borderRadius:12,background:`linear-gradient(135deg,${C.teal},#00a882)`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:16,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:54,boxShadow:`0 8px 24px ${C.teal}40`,marginTop:4}}>
            Go to Dashboard →
          </button>
        </div>
      )}

      {/* Shared scanner — same component the Roster screen uses */}
      {showScanner && (
        <RosterScanner
          defaultAgeGroup={form.ageGroup || AGE_GROUPS[1]}
          onClose={()=>setShowScanner(false)}
          onImport={(newPlayers)=>{
            // setPlayers is the DB-aware setter — it persists each new player
            // and surfaces save errors itself.
            setPlayers(prev => [...prev, ...newPlayers]);
            setBulkAddedCount(newPlayers.length);
            setAddedPlayer(null);
            setShowScanner(false);
            setStep(3); // bulk import meets the onboarding goal — go to the finish screen
          }}
        />
      )}
    </div>
  );
}

// ─── PAYWALL GATE ─────────────────────────────────────────────────────────────
function PaywallGate({feature, onUpgrade}) {
  return (
    <div className="fade-up" style={{textAlign:"center",padding:"48px 24px"}}>
      <div style={{fontSize:48,marginBottom:16}}>🔒</div>
      <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,letterSpacing:2,color:C.text,marginBottom:8}}>{feature}</div>
      <div style={{fontSize:14,color:C.textMid,lineHeight:1.6,marginBottom:28,maxWidth:280,margin:"0 auto 28px"}}>
        This feature is part of CoachConnect Pro. Upgrade to unlock the full drill library, progress charts, and more.
      </div>
      <button onClick={onUpgrade} style={{padding:"14px 32px",borderRadius:12,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:16,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 8px 24px ${C.red}50`}}>
        View Plans & Upgrade
      </button>
    </div>
  );
}

// ─── UPGRADE SCREEN ───────────────────────────────────────────────────────────
function UpgradeScreen({daysLeft, isTrial, isExpired, onClose, onSubscribe, session, initialSuccess}) {
  const [step, setStep] = useState(initialSuccess ? "success" : "plans"); // "plans" | "success"
  const [selectedPlan, setSelectedPlan] = useState("founding_monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const plans = [
    {id:"founding_monthly", name:"Founding Coach", price:"14.99", interval:"mo", desc:"Locked-in rate for early supporters", badge:"Limited — First 50 Coaches", badgeIcon:"flame", badgeColor:C.gold},
    {id:"pro_monthly",      name:"Pro Monthly",    price:"24.99", interval:"mo", desc:"Full access, billed monthly",       badge:null},
    {id:"pro_yearly",       name:"Pro Annual",     price:"20.83", interval:"mo", desc:"$249.99/year — save $50/year",       badge:"Best Value", badgeIcon:"tag", badgeColor:C.teal},
  ];

  const handleCheckout = async () => {
    setLoading(true); setError("");
    try {
      const {data:{session:authSession}} = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) throw new Error("Not logged in");
      const res = await fetch("https://hcadlkmejdekhbgfvyaq.supabase.co/functions/v1/stripe-checkout", {
        method: "POST",
        headers: {"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body: JSON.stringify({action:"checkout", price_key:selectedPlan}),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch(err) {
      setError(String(err.message||err));
      setLoading(false);
    }
  };

  const FEATURES = [
    { icon:"library",  label:"Full Drill Library", sub:"69 pro drills across 9 categories" },
    { icon:"stats",    label:"Progress Tracking", sub:"Skill charts, streaks & snapshots" },
    { icon:"drills",   label:"Game Builder",    sub:"Batting order & field positions" },
    { icon:"msgs",     label:"Team Messaging",    sub:"Group chat & parent DMs" },
    { icon:"schedule", label:"Schedule Manager",  sub:"Games, practices & RSVP" },
    { icon:"play",     label:"Video per Drill",   sub:"Attach YouTube or any video link" },
  ];

  const sel = plans.find(p=>p.id===selectedPlan);

  return (
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",flexDirection:"column",overflowY:"auto"}}>
      <div style={{maxWidth:480,width:"100%",margin:"0 auto",padding:"24px 16px 48px"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:24,letterSpacing:3,color:C.text}}>
            {step==="success" ? "Welcome to Pro!" : "Upgrade to Pro"}
          </div>
          {step!=="success"&&<button onClick={onClose} style={{background:"none",border:"none",color:C.textDim,fontSize:24,cursor:"pointer",padding:4,minWidth:36,minHeight:36}}>×</button>}
        </div>

        {/* ── PLANS STEP ── */}
        {step==="plans" && (<>
          {isTrial&&<div style={{background:`${C.gold}15`,border:`1px solid ${C.gold}40`,borderRadius:12,padding:"12px 16px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}>
            <div style={{color:C.gold,display:"flex",flexShrink:0}}><NavIcon id="clock" size={20}/></div>
            <div><div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,color:C.gold,letterSpacing:1}}>YOUR TRIAL ENDS IN {daysLeft} DAY{daysLeft!==1?"S":""}</div>
            <div style={{fontSize:12,color:C.textMid}}>Subscribe now to keep everything without interruption</div></div>
          </div>}
          {isExpired&&<div style={{background:`${C.red}15`,border:`1px solid ${C.red}40`,borderRadius:12,padding:"12px 16px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}>
            <div style={{color:C.red,display:"flex",flexShrink:0}}><NavIcon id="lock" size={20}/></div>
            <div><div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,color:C.red,letterSpacing:1}}>YOUR TRIAL HAS ENDED</div>
            <div style={{fontSize:12,color:C.textMid}}>Reactivate now to regain full access</div></div>
          </div>}

          {/* Plan cards */}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
            {plans.map(p=>{
              const active = selectedPlan===p.id;
              return (
                <button key={p.id} onClick={()=>setSelectedPlan(p.id)} style={{background:active?`linear-gradient(135deg,#100c1a,${C.card})`:C.card,border:`2px solid ${active?C.red+"80":C.border}`,borderRadius:16,padding:"16px 18px",cursor:"pointer",textAlign:"left",position:"relative",overflow:"hidden",transition:"all 0.2s",boxShadow:active?`0 0 24px ${C.red}20`:"none"}}>
                  {active&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.red},${C.gold},${C.red})`}}/>}
                  {p.badge&&<div style={{display:"flex",alignItems:"center",gap:5,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,color:p.badgeColor||C.textMid,textTransform:"uppercase",marginBottom:6}}>{p.badgeIcon&&<NavIcon id={p.badgeIcon} size={12}/>}{p.badge}</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:16,color:active?C.text:C.textMid,letterSpacing:1}}>{p.name}</div>
                      <div style={{fontSize:11,color:C.textDim,marginTop:2}}>{p.desc}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,color:active?C.text:C.textMid,lineHeight:1}}>${p.price}</div>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:10,color:C.textDim,letterSpacing:1}}>/{p.interval}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Feature list */}
          <div style={{background:`linear-gradient(135deg,#100c1a,${C.card})`,border:`1px solid ${C.border}`,borderRadius:16,padding:"20px 18px",marginBottom:20}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:14}}>Everything included</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {FEATURES.map(f=>(
                <div key={f.label} style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{width:32,height:32,borderRadius:8,background:`${C.teal}18`,border:`1px solid ${C.teal}30`,display:"flex",alignItems:"center",justifyContent:"center",color:C.teal,flexShrink:0}}><NavIcon id={f.icon} size={16}/></div>
                  <div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,color:C.text}}>{f.label}</div>
                    <div style={{fontSize:11,color:C.textDim}}>{f.sub}</div>
                  </div>
                  <div style={{marginLeft:"auto",color:C.teal,fontSize:16}}>✓</div>
                </div>
              ))}
            </div>
          </div>

          {error&&<div style={{marginBottom:12,padding:"10px 14px",borderRadius:9,background:`${C.red}15`,border:`1px solid ${C.red}40`,fontSize:12,color:"#ff8080"}}>{error}</div>}

          <button onClick={handleCheckout} disabled={loading} style={{width:"100%",padding:"16px 0",borderRadius:12,background:loading?C.card:`linear-gradient(135deg,${C.red},${C.redDim})`,border:loading?`1px solid ${C.border}`:"none",color:loading?C.textMid:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:16,letterSpacing:2,textTransform:"uppercase",cursor:loading?"not-allowed":"pointer",minHeight:54,boxShadow:loading?"none":`0 8px 24px ${C.red}50`,transition:"all 0.2s"}}>
            {loading ? "Redirecting to Stripe..." : `Subscribe — $${sel?.price}/${sel?.interval}`}
          </button>
          <div style={{textAlign:"center",fontSize:11,color:C.textDim,marginTop:12,lineHeight:1.6}}>Cancel anytime · No contracts · Secure payment via Stripe</div>
        </>)}

        {/* ── SUCCESS STEP ── */}
        {step==="success" && (
          <div className="fade-up" style={{textAlign:"center",padding:"32px 16px"}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:`${C.teal}20`,border:`2px solid ${C.teal}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 24px",boxShadow:`0 0 32px ${C.teal}40`}}>✓</div>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:32,letterSpacing:2,color:C.text,marginBottom:8}}>You're all set!</div>
            <div style={{fontSize:14,color:C.textMid,lineHeight:1.7,marginBottom:32}}>Welcome to CoachConnect Pro. Your full drill library and progress tracking are now unlocked. A receipt has been sent to your email.</div>
            <button onClick={onSubscribe} style={{width:"100%",padding:"16px 0",borderRadius:12,background:`linear-gradient(135deg,${C.teal},#00a882)`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:16,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",minHeight:54,boxShadow:`0 8px 24px ${C.teal}40`}}>
              Start Coaching →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SIGNED MEDIA (render prop) ──────────────────────────────────────────────
// Resolves a storage path or legacy public URL to a fresh signed URL at render
// time. Renders nothing until resolved; renders nothing at all on failure.
// ─── OFFLINE BANNER ──────────────────────────────────────────────────────────
// One quiet line, not a modal. A coach on a field already knows the signal is
// bad; what they need is confidence the data in front of them is recent enough
// to use, so the banner leads with when it was taken.
function OfflineBanner({online, cacheAge}) {
  if (online) return null;
  const age = describeAge(cacheAge);
  return (
    <div role="status" style={{
      position:"sticky", top:0, zIndex:200,
      background:"#3a2a0c", borderBottom:`1px solid ${C.gold}55`,
      color:C.gold, padding:"7px 14px",
      display:"flex", alignItems:"center", gap:9,
      fontFamily:"Barlow Condensed, sans-serif", fontWeight:700,
      fontSize:12.5, letterSpacing:0.7,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
        <path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
      <span>Offline{age ? ` — showing data from ${age}` : " — showing saved data"}</span>
    </div>
  );
}

function SignedMedia({bucket, pathOrUrl, children}){
  const [url, setUrl] = useState(null);
  useEffect(()=>{
    let live = true;
    (async ()=>{
      // Bytes on the device first: they render instantly and work with no
      // signal. A signed URL is only fetched when nothing is cached, and the
      // bytes are kept so the next view needs no network at all.
      const isPath = pathOrUrl && !/^(https?:|data:|blob:)/.test(String(pathOrUrl));
      if (isPath) {
        const local = await getCachedMedia(pathOrUrl);
        if (local) { if (live) setUrl(local); return; }
      }
      const u = await resolveMediaUrl(bucket, pathOrUrl);
      if (live) setUrl(u);
      if (u && isPath) {
        try {
          const res = await fetch(u);
          if (res.ok) cacheMedia(pathOrUrl, await res.blob());
        } catch (_) { /* caching is best-effort */ }
      }
    })();
    return ()=>{ live=false; };
  },[bucket, pathOrUrl]);
  if (!url) return null;
  return children(url);
}

// ─── PARENT VIDEO UPLOAD ─────────────────────────────────────────────────────
function ParentVideoUpload({playerId, drillId, drillName, playerVideos, setPlayerVideos}) {
  const key = `${playerId}_${drillId}`;
  const entry = playerVideos[key];
  const inputRef = React.useRef();

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error('Video must be under 50MB.'); return; }
    setLoading(true);
    setUploadProgress('Uploading...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Your session expired — please sign in again.'); setLoading(false); return; }
      const userId = session.user.id;
      const { data: prof } = await supabase.from('profiles').select('team_id').eq('id', userId).single();
      const teamId = prof?.team_id;
      if (!teamId) { toast.error('No team found on your account.'); setLoading(false); return; }

      const ext = file.name.split('.').pop() || 'mp4';
      const storagePath = `${teamId}/${playerId}/${drillId}_${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage.from('player-videos').upload(storagePath, file, { cacheControl: '3600', upsert: true });
      if (uploadError) { console.error('Upload error:', uploadError); toast.error('Upload failed. Check your connection and try again.'); setLoading(false); return; }

      // Buckets are private — get a signed URL for immediate playback.
      const publicUrl = await signedUrl('player-videos', storagePath);

      // Save to DB
      setUploadProgress('Saving...');
      const { error: dbError } = await supabase.from('player_videos').insert({
        team_id: teamId, player_id: playerId, drill_id: drillId,
        storage_path: storagePath, uploaded_by: userId,
      });
      if (dbError) {
        console.error('DB save error:', dbError);
        toast.error('Video uploaded but couldn\'t be saved. Please try again.');
        setLoading(false); setUploadProgress('');
        return;
      }

      // Update local state
      setPlayerVideos(prev => ({
        ...prev,
        [key]: { url: publicUrl, storagePath, name: file.name, uploadedAt: Date.now(), feedback: prev[key]?.feedback || [] }
      }));
      toast.success('Video uploaded! Your coach will review it.');
    } catch(err) {
      console.error('Video upload failed:', err);
      toast.error('Video upload failed. Please try again.');
    }
    setLoading(false);
    setUploadProgress('');
  };

  const handleRemove = async () => {
    if (!entry?.storagePath) { setPlayerVideos(prev => { const n={...prev}; delete n[key]; return n; }); return; }
    try {
      await supabase.storage.from('player-videos').remove([entry.storagePath]);
      await supabase.from('player_videos').delete().eq('storage_path', entry.storagePath);
    } catch(err) { console.error('Delete error:', err); }
    setPlayerVideos(prev => { const n={...prev}; delete n[key]; return n; });
  };

  if (entry) return (
    <div style={{marginTop:12,borderTop:`1px solid ${C.border}`,paddingTop:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:14}}>📹</span>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,color:C.teal,textTransform:"uppercase"}}>Your Video</div>
        </div>
        <button onClick={handleRemove} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:13,padding:"2px 6px"}}>✕ Remove</button>
      </div>
      <video src={entry.url} controls playsInline style={{width:"100%",borderRadius:10,background:"#000",maxHeight:220,objectFit:"contain"}}/>
      <div style={{fontSize:11,color:C.textDim,marginTop:5}}>Uploaded {new Date(entry.uploadedAt).toLocaleDateString()} · Visible to your coach</div>
      {entry.feedback?.length > 0 && (
        <div style={{marginTop:12,background:`${C.teal}08`,border:`1px solid ${C.teal}30`,borderRadius:10,padding:"10px 14px"}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.teal,textTransform:"uppercase",marginBottom:8}}>💬 Coach Feedback</div>
          {entry.feedback.map((fb,i)=>(
            <div key={fb.id} style={{display:"flex",gap:10,marginBottom:i<entry.feedback.length-1?10:0,paddingBottom:i<entry.feedback.length-1?10:0,borderBottom:i<entry.feedback.length-1?`1px solid ${C.border}30`:"none"}}>
              <div style={{flexShrink:0,background:`${C.teal}25`,borderRadius:6,padding:"3px 7px",fontFamily:"Bebas Neue, sans-serif",fontSize:14,color:C.teal,height:"fit-content",marginTop:1}}>{fb.timeCode}</div>
              <div style={{fontSize:13,color:C.textMid,lineHeight:1.5}}>{fb.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{marginTop:12,borderTop:`1px solid ${C.border}`,paddingTop:12}}>
      <input ref={inputRef} type="file" accept="video/*" style={{display:"none"}} onChange={handleFile}/>
      <button onClick={()=>inputRef.current.click()} disabled={loading} style={{width:"100%",padding:"11px 0",borderRadius:10,background:"transparent",border:`1px dashed ${C.teal}50`,color:C.teal,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:loading?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,minHeight:44,transition:"all 0.2s",opacity:loading?0.6:1}}>
        <span style={{fontSize:16}}>📹</span> {loading ? uploadProgress || "Uploading…" : "Upload Practice Video"}
      </button>
      <div style={{fontSize:11,color:C.textDim,marginTop:5,textAlign:"center"}}>Film {drillName} at home and send it to your coach for feedback</div>
    </div>
  );
}

// ─── COACH VIDEO REVIEW ───────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={hasError:false,error:null}; }
  static getDerivedStateFromError(e){ return {hasError:true,error:e}; }
  componentDidCatch(e,info){ console.error("ErrorBoundary caught:", e, info); }
  render(){
    if(this.state.hasError) return (
      <div style={{padding:24,textAlign:"center",background:"#060a12",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:16,letterSpacing:2,textTransform:"uppercase",marginBottom:8,color:"#e8192c"}}>Something went wrong</div>
        <div style={{fontSize:13,color:"#ff6b6b",maxWidth:340,marginBottom:8,wordBreak:"break-word",background:"#1a0808",padding:"12px 16px",borderRadius:10,border:"1px solid #e8192c40",textAlign:"left"}}>{this.state.error?.message||"An unexpected error occurred."}</div>
        <div style={{fontSize:11,color:"#3d5070",maxWidth:340,marginBottom:16,wordBreak:"break-word",textAlign:"left"}}>{this.state.error?.stack?.slice(0,200)}</div>
        <button onClick={()=>window.location.reload()} style={{padding:"10px 24px",borderRadius:10,background:"#e8192c",border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>Reload App</button>
      </div>
    );
    return this.props.children;
  }
}

function computeBadges(player, assignments, skillSnapshots, events) {
  const streak = computeStreak(player.id, assignments).currentStreak;
  const earned = BADGES.filter(b=>b.id!=="overachiever" && b.check(player,assignments,skillSnapshots,streak,events));
  const overachiever = BADGES.find(b=>b.id==="overachiever");
  if(earned.length>=5) earned.push(overachiever);
  return earned;
}

function computeStreak(playerId, assignments) {
  const days = [...new Set(assignments.filter(a=>a.playerId===playerId&&a.completed&&a.assignedDate).map(a=>a.assignedDate))].sort((a,b)=>b.localeCompare(a));
  let cur=0,best=0,prev=null;
  for(const d of days){
    if(!prev){cur=1;}
    else{const diff=(new Date(prev)-new Date(d))/86400000;if(diff<=2)cur++;else cur=1;}
    best=Math.max(best,cur);prev=d;
  }
  return {currentStreak:cur,bestStreak:best,totalCompleted:assignments.filter(a=>a.playerId===playerId&&a.completed).length};
}

function BadgesPanel({player, assignments, skillSnapshots, events}) {
  const earned = computeBadges(player, assignments, skillSnapshots, events);
  const locked = BADGES.filter(b=>!earned.find(e=>e.id===b.id));
  return (
    <div>
      {earned.length>0&&<>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.gold,textTransform:"uppercase",marginBottom:10}}>🏆 Earned ({earned.length})</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
          {earned.map(b=>(
            <div key={b.id} style={{background:`${b.color}20`,border:`1px solid ${b.color}60`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,boxShadow:`0 0 12px ${b.color}20`}}>
              <div style={{fontSize:22}}>{b.icon}</div>
              <div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:b.color}}>{b.name}</div>
                <div style={{fontSize:11,color:C.textDim}}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </>}
      {locked.length>0&&<>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase",marginBottom:10}}>🔒 Locked ({locked.length})</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {locked.map(b=>(
            <div key={b.id} style={{background:"#0a0f1a",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,opacity:0.5}}>
              <div style={{fontSize:22,filter:"grayscale(1)"}}>{b.icon}</div>
              <div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.textDim}}>{b.name}</div>
                <div style={{fontSize:11,color:C.textDim}}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </>}
      {earned.length===0&&locked.length===BADGES.length&&<div style={{textAlign:"center",padding:"24px 0",color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontSize:12,letterSpacing:2,textTransform:"uppercase"}}>Complete drills to start earning badges</div>}
    </div>
  );
}


// ─── PARENT REPORT CARD ───────────────────────────────────────────────────────
function ParentReportCard({player, assignments, skillSnapshots, events}) {
  const streakData = computeStreak(player.id, assignments);
  const myAsgn = assignments.filter(a=>a.playerId===player.id);
  const completed = myAsgn.filter(a=>a.completed);
  const pending   = myAsgn.filter(a=>!a.completed);
  const mySnaps   = skillSnapshots.filter(s=>s.playerId===player.id).sort((a,b)=>a.date.localeCompare(b.date));
  const latestSnap = mySnaps[mySnaps.length-1];
  const prevSnap   = mySnaps[mySnaps.length-2];
  const badges     = computeBadges(player, assignments, skillSnapshots, events);
  const recentNotes= [...myAsgn].filter(a=>a.notes&&a.notes.trim()).slice(-3).reverse();
  const nextGame   = events.filter(e=>e.type==="game"&&e.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date))[0];

  const SKILL_COLORS_REPORT={"Hitting":"#e8192c","Fielding":"#1e7bd4","Throwing":"#00d4aa","Pitching":"#f97316","Speed":"#8b5cf6"};

  return (
    <div style={{paddingTop:8}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,#100c1a,${C.card})`,borderRadius:18,border:`1px solid ${C.border}`,padding:"20px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.red},${C.gold},${C.teal})`}}/>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:3,color:C.red,textTransform:"uppercase",marginBottom:4}}>Weekly Report Card</div>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,letterSpacing:2,color:C.text,lineHeight:1,marginBottom:4}}>{player.name}</div>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:12,color:C.textDim}}>{player.position} · {player.ageGroup}</div>
      </div>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
        {[
          {label:"Current Streak",value:streakData.currentStreak,unit:"days",color:C.teal},
          {label:"Drills Done",value:streakData.totalCompleted,unit:"total",color:C.blue},
          {label:"Badges",value:badges.length,unit:"earned",color:C.gold},
        ].map(s=>(
          <div key={s.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 10px",textAlign:"center"}}>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:32,color:s.color,lineHeight:1,textShadow:`0 0 16px ${s.color}60`}}>{s.value}</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:8,letterSpacing:1.5,color:C.textDim,textTransform:"uppercase",marginTop:2}}>{s.unit}</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.textMid,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Skill snapshot */}
      {latestSnap&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px",marginBottom:16}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:12}}>📈 Current Skill Ratings</div>
          {(()=>{
            const chartRatings = computeChartRatings(latestSnap.rubric||{});
            const prevRatings  = prevSnap ? computeChartRatings(prevSnap.rubric||{}) : {};
            return Object.entries(chartRatings).map(([skill,rating])=>{
              const prev=prevRatings[skill];
              const delta=prev!=null?Math.round((rating-prev)*10)/10:null;
              const sc=CHART_COLORS[skill]||C.teal;
              return (
                <div key={skill} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,color:C.textMid}}>{skill}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {delta!=null&&delta!==0&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,color:delta>0?C.teal:C.red}}>{delta>0?`+${delta}`:delta}</div>}
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:sc}}>{RUBRIC_LABELS[Math.round(rating)]||rating}</div>
                    </div>
                  </div>
                  <div style={{height:6,borderRadius:3,background:`${sc}20`,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${(rating/4)*100}%`,background:`linear-gradient(90deg,${sc},${sc}cc)`,borderRadius:3,boxShadow:`0 0 6px ${sc}60`,transition:"width 0.6s ease"}}/>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Recent coach notes */}
      {recentNotes.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px",marginBottom:16}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:10}}>🗣 Recent Coach Feedback</div>
          {recentNotes.map((a,i)=>{
            const drill=findDrill(a.drillId);
            return (
              <div key={a.id} style={{padding:"10px 14px",background:`${C.gold}08`,borderLeft:`3px solid ${C.gold}40`,borderRadius:"0 8px 8px 0",marginBottom:i<recentNotes.length-1?8:0}}>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,color:C.gold,letterSpacing:1,marginBottom:3}}>{drill?.name||"Drill"}</div>
                <div style={{fontSize:13,color:C.textMid,fontStyle:"italic"}}>"{a.notes}"</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending drills */}
      {pending.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px",marginBottom:16}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:10}}>📋 Drills To Complete ({pending.length})</div>
          {pending.map(a=>{const d=findDrill(a.drillId);return d?(
            <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}30`}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,color:C.text}}>{d.name}</div>
              <Tag label={d.duration} color={C.textDim} small/>
            </div>
          ):null;})}
        </div>
      )}

      {/* Badges earned */}
      {badges.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px",marginBottom:16}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:10}}>🏆 Badges Earned</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {badges.map(b=>(
              <div key={b.id} style={{background:`${b.color}20`,border:`1px solid ${b.color}50`,borderRadius:10,padding:"6px 12px",display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:16}}>{b.icon}</span>
                <span style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,color:b.color}}>{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next game */}
      {nextGame&&(
        <div style={{background:`linear-gradient(135deg,#1a0808,${C.card})`,border:`1px solid ${C.red}40`,borderRadius:14,padding:"16px"}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.red,textTransform:"uppercase",marginBottom:6}}>⚾ Next Game</div>
          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,color:C.text,marginBottom:4}}>vs. {nextGame.opponent||"TBD"}</div>
          <div style={{fontSize:12,color:C.textDim}}>📅 {new Date(nextGame.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} · {nextGame.time}</div>
          <div style={{fontSize:12,color:C.textDim,marginTop:2}}>📍 {nextGame.location}</div>
        </div>
      )}
    </div>
  );
}

// ─── SHARED EXPORTS (used by component files) ────────────────────────────────
export { C, uid, randomToken, inp, Tag, SectionHead, PrimaryBtn, GhostBtn, Inp, NewCoachCard, FONTS, LOGO, supabase, Avatar, fmtTime, avatarColor, toast, signedUrl, resolveMediaUrl, SignedMedia, SIGNED_URL_TTL, AGE_GROUPS, scanAuthHeaders };
