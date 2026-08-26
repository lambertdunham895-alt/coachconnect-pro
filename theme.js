// ─── DESIGN TOKENS + GLOBAL CSS ──────────────────────────────────────────────
// Extracted from App.jsx. Dark navy #060a12 house style lives here.

const C = {
  bg:"#060a12", card:"#0c1628", cardAlt:"#0a1220",
  border:"#1a2f52", borderBright:"#2a4070",
  red:"#e8192c", redDim:"#c01020",
  gold:"#f5c518", teal:"#00d4aa",
  blue:"#1e7bd4", purple:"#8b5cf6", orange:"#f97316",
  text:"#f0ebe2", textMid:"#8a9fc0", textDim:"#3d5070",
  stripe:"none",
  msgMe:"#1e3a6e", msgOther:"#0e1f38",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;800&display=swap');
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
body { margin: 0; padding: 0; background: #060a12; }
input, select, textarea { font-size: 16px !important; }

@keyframes fadeUp {
  from { opacity:0; transform:translateY(18px) scale(0.98); }
  to   { opacity:1; transform:translateY(0) scale(1); }
}
@keyframes popIn {
  0%   { opacity:0; transform:scale(0.82) translateY(8px); }
  70%  { opacity:1; transform:scale(1.02) translateY(-1px); }
  100% { opacity:1; transform:scale(1) translateY(0); }
}
@keyframes slideUp {
  from { opacity:0; transform:translateY(100%); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes slideInRight {
  from { opacity:0; transform:translateX(24px); }
  to   { opacity:1; transform:translateX(0); }
}
@keyframes pulseBadge {
  0%, 100% { box-shadow: 0 0 0 0 rgba(232,25,44,0.5); }
  50%      { box-shadow: 0 0 0 6px rgba(232,25,44,0); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes glowPulse {
  0%, 100% { filter: drop-shadow(0 0 4px currentColor); }
  50%      { filter: drop-shadow(0 0 10px currentColor); }
}
@keyframes scoreFlash {
  0%   { background-color: rgba(245,197,24,0.15); }
  100% { background-color: transparent; }
}
@keyframes spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.fade-up   { animation: fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both; }
.fade-up-1 { animation: fadeUp 0.35s 0.05s cubic-bezier(0.22,1,0.36,1) both; }
.fade-up-2 { animation: fadeUp 0.35s 0.10s cubic-bezier(0.22,1,0.36,1) both; }
.fade-up-3 { animation: fadeUp 0.35s 0.15s cubic-bezier(0.22,1,0.36,1) both; }
.fade-up-4 { animation: fadeUp 0.35s 0.20s cubic-bezier(0.22,1,0.36,1) both; }
.fade-up-5 { animation: fadeUp 0.35s 0.25s cubic-bezier(0.22,1,0.36,1) both; }
.pop-in    { animation: popIn  0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
.slide-in  { animation: slideInRight 0.3s cubic-bezier(0.22,1,0.36,1) both; }

/* Enhanced card hover with smoother lift and gradient glow */
.card-hover { transition:transform 0.22s cubic-bezier(0.22,1,0.36,1),box-shadow 0.22s ease,border-color 0.22s ease; cursor:pointer; }
.card-hover:hover { transform:translateY(-3px); box-shadow:0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04); }
.card-hover:active { transform:scale(0.98) translateY(0); box-shadow:0 2px 8px rgba(0,0,0,0.3); }

/* Glassmorphism — frosted glass cards */
.glass {
  background: rgba(20,30,50,0.55);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
}
.glass-strong {
  background: rgba(15,25,45,0.75);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 12px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
}
.glass-card {
  background: linear-gradient(145deg, rgba(30,45,75,0.45), rgba(15,25,45,0.55));
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(255,255,255,0.07);
  box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
}

/* Skeleton loaders */
@keyframes skeletonShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #1a2745 25%, #243558 50%, #1a2745 75%);
  background-size: 200% 100%;
  animation: skeletonShimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

/* Animated number / counter effect */
@keyframes numberPop {
  0% { transform:scale(1); }
  40% { transform:scale(1.15); }
  100% { transform:scale(1); }
}
.number-pop { animation: numberPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }

/* Tap ripple effect */
@keyframes ripple {
  to { transform: scale(2.4); opacity: 0; }
}

.btn-press { transition:transform 0.1s cubic-bezier(0.22,1,0.36,1),box-shadow 0.1s ease; }
.btn-press:active { transform:scale(0.95); }

.badge-pulse { animation: pulseBadge 2s ease-in-out infinite; }

.shimmer-text {
  background: linear-gradient(90deg, #f0ebe2 30%, #f5c518 50%, #f0ebe2 70%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 3s linear infinite;
}

.glow-active { animation: glowPulse 2s ease-in-out infinite; }

.score-flash { animation: scoreFlash 0.8s ease both; }

.nav-item { transition: color 0.15s ease, transform 0.15s ease; }
.nav-item:active { transform: scale(0.9); }

.tag-hover { transition: transform 0.12s ease, box-shadow 0.12s ease; }
.tag-hover:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.3); }

/* Subtle floating animation for empty state icons */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}
.float-anim { animation: float 3s ease-in-out infinite; }

/* Hero — Ken Burns slow zoom on background photo */
@keyframes kenBurns {
  from { transform: scale(1); }
  to   { transform: scale(1.12); }
}
.ken-burns { animation: kenBurns 30s ease-in-out infinite alternate; transform-origin: center 35%; will-change: transform; }

/* Hero — glowing primary CTA */
@keyframes heroPulse {
  0%, 100% { box-shadow: 0 8px 32px rgba(232,25,44,0.5); }
  50%      { box-shadow: 0 10px 42px rgba(232,25,44,0.95), 0 0 26px rgba(232,25,44,0.6); }
}
.hero-cta-glow { animation: heroPulse 2.2s ease-in-out infinite; }

::-webkit-scrollbar { width:3px; height:3px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:#1e3060; border-radius:2px; }

.pill-scroll::-webkit-scrollbar { display:none; }
.pill-scroll { scrollbar-width:none; }

.msg-list { overflow-y:auto; }
.msg-list::-webkit-scrollbar { width:2px; }
`;
export { C, FONTS };
