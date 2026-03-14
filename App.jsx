import { useState, useEffect, useCallback } from 'react';

// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://cehvqrpxlocjmgxspel.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gHh5BA4zhnu4gVtikeDmoQ_Al37mmdmLeyJhbGci0i1JUzI1NiIsInR5cCI6CI6IkpXVcJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlaHZxcnB4bG9jam1neHNwZWwiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwOTMyNTgzNiwiZXhwIjoyMDI0OTAxODM2fQ.MjA4NzIxMDEyN30.JDDJilsOX4qeeyt2HJTRp-seOZFZnRDVyei9VAL70K';
// ===== END CONFIGURATION =====

/* ─── GLOBAL STYLES ─── */
const injectStyles = () => {
  if (document.getElementById("ccp-styles")) return;
  const style = document.createElement("style");
  style.id = "ccp-styles";
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: #0a1628; --navy2: #111f3c; --navy3: #1a2f52;
      --field: #1a3d2e; --grass: #2d6a4f;
      --orange: #f4801a; --gold: #f5c518;
      --chalk: #f0ece3; --white: #ffffff;
      --gray1: #8a9ab5; --gray2: #4a5a78;
      --red: #e53e3e; --green: #38a169; --blue: #4299e1;
    }
    html, body { height: 100%; overflow: hidden; margin: 0; padding: 0; }
    body { font-family: 'Barlow', sans-serif; background: var(--navy); color: var(--chalk); -webkit-font-smoothing: antialiased; }
    #root { position: fixed; top: 0; left: 0; right: 0; bottom: 0; }
    .app-shell { position: absolute; top: 0; left: 0; right: 0; bottom: 0; max-width: 480px; margin: 0 auto; background: var(--navy); display: flex; flex-direction: column; }
    .page-content { position: absolute; top: 0; left: 0; right: 0; bottom: 60px; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding-bottom: 20px; }
    .page-content::-webkit-scrollbar { display: none; }
    .bottom-nav { position: absolute; bottom: 0; left: 0; right: 0; height: 60px; }
    /* Auth - fullscreen scroll */
    .auth-outer { position: fixed; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; background: linear-gradient(160deg, var(--navy) 0%, var(--navy2) 50%, var(--field) 100%); }
    .auth-outer::-webkit-scrollbar { display: none; }
    .auth-screen { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px 60px; }
    .auth-logo { text-align: center; margin-bottom: 40px; }
    .auth-logo img { 
      border-radius: 24px; 
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 60px rgba(245, 130, 32, 0.3),
        0 0 100px rgba(37, 99, 235, 0.2);
      border: 3px solid rgba(255, 255, 255, 0.15);
      background: linear-gradient(135deg, rgba(245, 130, 32, 0.1), rgba(37, 99, 235, 0.1));
      padding: 8px;
      transition: all 0.3s ease;
    }
    .auth-logo img:hover { 
      transform: scale(1.05);
      box-shadow: 
        0 12px 40px rgba(0, 0, 0, 0.5),
        0 0 80px rgba(245, 130, 32, 0.4),
        0 0 120px rgba(37, 99, 235, 0.3);
    }
    .auth-logo h1 { font-family: 'Barlow Condensed', sans-serif; font-size: 32px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: var(--white); }
    .auth-logo p { font-size: 13px; color: var(--gray1); letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .auth-card { width: 100%; max-width: 380px; background: var(--navy2); border: 1px solid var(--navy3); border-radius: 16px; padding: 28px 24px; }
    .auth-card h2 { font-family: 'Barlow Condensed', sans-serif; font-size: 24px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; }
    .auth-card p { color: var(--gray1); font-size: 14px; margin-bottom: 24px; }
    .input-group { margin-bottom: 14px; }
    .input-group label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--gray1); margin-bottom: 5px; }
    .input-field { width: 100%; background: var(--navy3); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 14px; font-size: 15px; color: var(--white); font-family: 'Barlow', sans-serif; outline: none; transition: border-color 0.2s; }
    .input-field:focus { border-color: var(--orange); }
    .input-field::placeholder { color: var(--gray2); }
    textarea.input-field { resize: none; min-height: 72px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 20px; border-radius: 10px; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; cursor: pointer; border: none; transition: all 0.15s; white-space: nowrap; }
    .btn-primary { background: var(--orange); color: var(--white); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-secondary { background: var(--navy3); color: var(--chalk); border: 1.5px solid rgba(255,255,255,0.1); }
    .btn-ghost { background: transparent; color: var(--gray1); border: 1.5px solid rgba(255,255,255,0.1); }
    .btn-success { background: var(--green); color: white; }
    .btn-danger { background: var(--red); color: white; }
    .btn-pro { background: linear-gradient(135deg, var(--gold), var(--orange)); color: var(--navy); }
    .btn-sm { padding: 7px 14px; font-size: 13px; }
    .btn-xs { padding: 5px 10px; font-size: 12px; }
    .w-full { width: 100%; }
    /* Role */
    .role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
    .role-card { background: var(--navy3); border: 2px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px 16px; text-align: center; cursor: pointer; transition: all 0.15s; }
    .role-card.selected { border-color: var(--orange); background: rgba(244,128,26,0.1); }
    .role-card .role-icon { font-size: 32px; margin-bottom: 10px; }
    .role-card h3 { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; text-transform: uppercase; }
    .role-card p { font-size: 11px; color: var(--gray1); margin-top: 4px; }
    /* Nav */
    .top-header { background: var(--navy2); border-bottom: 1px solid rgba(255,255,255,0.07); padding: 14px 16px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 58px; }
    .top-header h2 { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .bottom-nav { position: absolute; bottom: 0; left: 0; right: 0; height: 60px; background: var(--navy2); border-top: 1px solid rgba(255,255,255,0.07); display: flex; z-index: 10; }
    .tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 2px; cursor: pointer; min-width: 0; }
    .tab-icon { font-size: 19px; line-height: 1; }
    .tab-label { font-size: 9px; font-weight: 600; letter-spacing: 0.3px; text-transform: uppercase; margin-top: 3px; color: var(--gray2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; padding: 0 2px; }
    .tab-item.active .tab-label { color: var(--orange); }
    .tab-item.active { border-top: 2px solid var(--orange); }
    .tab-icon-wrap { position: relative; display: inline-block; }
    .badge { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; background: var(--red); color: white; font-size: 9px; font-weight: 700; border-radius: 8px; padding: 0 4px; position: absolute; top: -4px; right: -6px; }
    /* Home */
    .home-header { background: linear-gradient(135deg, var(--navy2), var(--field)); padding: 20px 16px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .home-greeting { font-size: 13px; color: var(--gray1); text-transform: uppercase; letter-spacing: 1px; }
    .home-name { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 800; color: var(--white); }
    .team-name { font-size: 13px; color: var(--orange); font-weight: 600; margin-top: 2px; display: flex; align-items: center; gap: 6px; }
    .pro-badge { display: inline-flex; align-items: center; background: linear-gradient(135deg, var(--gold), var(--orange)); color: var(--navy); font-size: 9px; font-weight: 800; letter-spacing: 1px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 14px; }
    .stat-card { background: var(--navy2); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 12px 6px; text-align: center; }
    .stat-num { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 900; color: var(--white); line-height: 1; }
    .stat-label { font-size: 9px; color: var(--gray1); margin-top: 3px; text-transform: uppercase; letter-spacing: 0.3px; }
    .stat-card.highlight .stat-num { color: var(--orange); }
    .stat-card.alert .stat-num { color: var(--red); }
    .stat-card.success .stat-num { color: var(--green); }
    /* Section */
    .section { padding: 0 14px 14px; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gray1); }
    /* Cards */
    .card { background: var(--navy2); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px; margin-bottom: 8px; }
    .card-title { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; }
    .card-sub { font-size: 12px; color: var(--gray1); margin-top: 2px; }
    /* Status */
    .status-pill { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
    .pill-yes { background: rgba(56,161,105,0.15); color: var(--green); }
    .pill-no { background: rgba(229,62,62,0.15); color: var(--red); }
    .pill-maybe { background: rgba(245,197,24,0.15); color: var(--gold); }
    .pill-pending { background: rgba(138,154,181,0.15); color: var(--gray1); }
    .pill-completed { background: rgba(56,161,105,0.15); color: var(--green); }
    .pill-overdue { background: rgba(229,62,62,0.15); color: var(--red); }
    /* Quick actions */
    .quick-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .quick-btn { background: var(--navy3); border: 1.5px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.15s; }
    .quick-btn:active { transform: scale(0.97); }
    .qb-icon { font-size: 22px; }
    .qb-text { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; text-transform: uppercase; }
    .quick-btn.pro-action { border-color: rgba(245,197,24,0.3); }
    .quick-btn.pro-action .qb-text { color: var(--gold); }
    /* Events */
    .event-card { background: var(--navy2); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px; margin-bottom: 8px; cursor: pointer; }
    .event-card.game { border-left: 3px solid var(--orange); }
    .event-card.practice { border-left: 3px solid var(--green); }
    .event-type-tag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .tag-game { background: rgba(244,128,26,0.15); color: var(--orange); }
    .tag-practice { background: rgba(45,106,79,0.4); color: #6fcf97; }
    .event-title { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 800; }
    .event-meta { font-size: 12px; color: var(--gray1); margin-top: 4px; }
    .event-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
    /* RSVP */
    .rsvp-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 12px; }
    .rsvp-btn { padding: 10px 8px; border-radius: 10px; border: 2px solid transparent; background: var(--navy3); color: var(--chalk); font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 700; text-transform: uppercase; cursor: pointer; text-align: center; transition: all 0.15s; }
    .rsvp-btn.yes { border-color: var(--green); background: rgba(56,161,105,0.15); color: var(--green); }
    .rsvp-btn.no { border-color: var(--red); background: rgba(229,62,62,0.15); color: var(--red); }
    .rsvp-btn.maybe { border-color: var(--gold); background: rgba(245,197,24,0.15); color: var(--gold); }
    /* Drills */
    .drill-card { background: var(--navy2); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px; margin-bottom: 8px; }
    .drill-category { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--blue); margin-bottom: 4px; }
    .drill-title { font-family: 'Barlow Condensed', sans-serif; font-size: 17px; font-weight: 800; }
    .drill-desc { font-size: 13px; color: var(--gray1); margin-top: 6px; line-height: 1.4; }
    /* Messages */
    .conv-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; }
    .avatar { width: 44px; height: 44px; border-radius: 12px; background: var(--navy3); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; font-family: 'Barlow Condensed', sans-serif; font-weight: 800; color: var(--orange); }
    .conv-body { flex: 1; min-width: 0; }
    .conv-name { font-weight: 600; font-size: 15px; }
    .conv-preview { font-size: 13px; color: var(--gray1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .conv-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .conv-time { font-size: 11px; color: var(--gray2); }
    /* Chat */
    .msg-bubble { max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.4; }
    .msg-bubble.sent { background: var(--orange); color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
    .msg-bubble.recv { background: var(--navy2); color: var(--chalk); align-self: flex-start; border-bottom-left-radius: 4px; }
    .msg-sender { font-size: 11px; font-weight: 700; color: var(--gold); margin-bottom: 4px; }
    .msg-time { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 4px; text-align: right; }
    .chat-input-row { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.07); background: var(--navy2); flex-shrink: 0; }
    .chat-input { flex: 1; background: var(--navy3); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 10px 16px; font-size: 14px; color: var(--white); font-family: 'Barlow', sans-serif; outline: none; }
    .send-btn { width: 44px; height: 44px; border-radius: 50%; background: var(--orange); border: none; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; flex-shrink: 0; }
    /* Roster */
    .player-card { background: var(--navy2); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
    .player-num { width: 36px; height: 36px; border-radius: 8px; background: var(--orange); display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 900; color: white; flex-shrink: 0; }
    .player-name { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; }
    .player-meta { font-size: 12px; color: var(--gray1); margin-top: 2px; }
    .player-tags { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
    .mini-tag { background: var(--navy3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 600; color: var(--gray1); }
    /* Inbox */
    .inbox-item { background: var(--navy2); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 12px; cursor: pointer; }
    .inbox-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .inbox-icon.orange { background: rgba(244,128,26,0.15); }
    .inbox-icon.red { background: rgba(229,62,62,0.15); }
    .inbox-icon.blue { background: rgba(66,153,225,0.15); }
    .inbox-icon.green { background: rgba(56,161,105,0.15); }
    .inbox-title { font-weight: 600; font-size: 14px; }
    .inbox-sub { font-size: 12px; color: var(--gray1); margin-top: 3px; }
    .inbox-action { font-size: 11px; color: var(--orange); font-weight: 700; margin-top: 6px; }
    /* Paywall */
    .paywall-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: flex-end; z-index: 1000; animation: fadeIn 0.2s; }
    .paywall-sheet { width: 100%; max-width: 480px; margin: 0 auto; background: var(--navy2); border-radius: 24px 24px 0 0; padding: 24px 20px 44px; animation: slideUp 0.25s ease-out; max-height: 90vh; overflow-y: auto; }
    .paywall-handle { width: 36px; height: 4px; background: var(--navy3); border-radius: 2px; margin: 0 auto 20px; }
    .plan-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .plan-card { background: var(--navy3); border: 2px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 16px 12px; text-align: center; cursor: pointer; transition: all 0.15s; position: relative; }
    .plan-card.selected { border-color: var(--gold); }
    .plan-best-tag { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, var(--gold), var(--orange)); color: var(--navy); font-size: 10px; font-weight: 800; padding: 2px 10px; border-radius: 10px; white-space: nowrap; text-transform: uppercase; }
    .plan-period { font-size: 12px; color: var(--gray1); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .plan-price { font-family: 'Barlow Condensed', sans-serif; font-size: 32px; font-weight: 900; }
    .plan-per { font-size: 11px; color: var(--gray1); }
    .plan-save { font-size: 11px; color: var(--green); font-weight: 700; margin-top: 4px; }
    .feature-list { margin-bottom: 20px; }
    .feature-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; }
    .feature-check { color: var(--green); font-size: 14px; }
    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 20px; animation: fadeIn 0.15s; }
    .modal { width: 100%; max-width: 400px; background: var(--navy2); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px; animation: scaleIn 0.2s; max-height: 90vh; overflow-y: auto; }
    .modal-title { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 800; text-transform: uppercase; margin-bottom: 14px; }
    /* Settings */
    .settings-section { margin-bottom: 24px; }
    .settings-section h3 { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--gray1); padding: 0 16px 8px; }
    .settings-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .settings-item-left { display: flex; align-items: center; gap: 12px; }
    .settings-item-icon { font-size: 20px; }
    .settings-item-label { font-size: 15px; font-weight: 500; }
    .settings-item-sub { font-size: 11px; color: var(--gray1); margin-top: 2px; }
    .toggle { width: 44px; height: 26px; background: var(--navy3); border-radius: 13px; border: 1.5px solid rgba(255,255,255,0.1); cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
    .toggle.on { background: var(--orange); border-color: var(--orange); }
    .toggle::after { content: ''; position: absolute; width: 18px; height: 18px; background: white; border-radius: 50%; top: 2px; left: 2px; transition: transform 0.2s; }
    .toggle.on::after { transform: translateX(18px); }
    /* Plans */
    .plan-template-card { background: var(--navy2); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px; margin-bottom: 8px; cursor: pointer; }
    .plan-duration { background: rgba(66,153,225,0.15); color: var(--blue); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; }
    .segment-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; }
    .segment-time { color: var(--orange); font-weight: 700; font-size: 12px; min-width: 28px; }
    /* Invite */
    .invite-code-box { background: var(--navy3); border: 2px dashed rgba(244,128,26,0.4); border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 12px; }
    .invite-code { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 900; letter-spacing: 4px; color: var(--orange); }
    .invite-code-label { font-size: 11px; color: var(--gray1); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    /* Report */
    .report-reason { background: var(--navy3); border: 1.5px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; margin-bottom: 8px; cursor: pointer; font-size: 14px; transition: all 0.15s; }
    .report-reason.selected { border-color: var(--orange); background: rgba(244,128,26,0.1); }
    /* Empty */
    .empty-state { text-align: center; padding: 40px 20px; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-state h3 { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 800; }
    .empty-state p { font-size: 14px; color: var(--gray1); margin-top: 6px; line-height: 1.5; }
    /* Back btn */
    .back-btn { display: flex; align-items: center; gap: 6px; color: var(--orange); font-size: 14px; font-weight: 600; cursor: pointer; }
    /* Animations */
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes scaleIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @media (min-width: 481px) {
      .app-shell { border: 1px solid rgba(255,255,255,0.07); box-shadow: 0 0 60px rgba(0,0,0,0.5); }
    }
  `;
  document.head.appendChild(style);
};

/* ─── MOCK DATA ─── */
const MOCK_TEAM = { id: "t1", name: "Riverside Hawks 12U", code: "HAWK24" };
const MOCK_EVENTS = [
  { id: "e1", type: "practice", title: "Thursday Practice", starts_at: "2026-02-26T17:00:00", location: "Riverside Park Field 2", notes: "Batting practice & base running drills", rsvp: "yes" },
  { id: "e2", type: "game", title: "vs. Eagles", starts_at: "2026-02-28T09:00:00", location: "Westside Sports Complex", opponent: "Eagles", uniform: "away", address: "456 West Boulevard, Kansas City, MO 64111", rsvp: null },
  { id: "e3", type: "practice", title: "Tuesday Practice", starts_at: "2026-03-03T17:00:00", location: "Riverside Park Field 2", notes: "Focus on pitching mechanics & grounders", rsvp: "yes" },
  { id: "e4", type: "game", title: "vs. Tigers", starts_at: "2026-03-07T10:00:00", location: "Central Complex Field A", opponent: "Tigers", uniform: "home", address: "123 Central Ave, Springfield, MO 65807", rsvp: "maybe" },
  { id: "e5", type: "practice", title: "Thursday Practice", starts_at: "2026-03-10T17:00:00", location: "Riverside Park Field 2", notes: "Defensive drills & team scrimmage", rsvp: null },
];
/* ─── COMPREHENSIVE DRILL LIBRARY ─── */
const DRILL_LIBRARY = {
  pitching: [
    { id: "p1", title: "Balance Point Drill", category: "Pitching", description: "Pitchers work on leg lift and balance point. Lift leg to maximum height, hold 3-5 seconds in perfect balance (weight over rubber, eyes on target, hands at chest), then complete pitch. Start with 10 holds without throwing.", details: "Develops body control, proper balance throughout delivery, and consistent leg lift. Prevents rushing and falling off. Builds core strength and stability." },
    { id: "p2", title: "Towel Drill", category: "Pitching", description: "Hold towel instead of ball and go through full pitching motion. At release point, snap towel down toward target with proper arm action and follow-through. Focus on extension, pronation, finishing with chest over front knee.", details: "Reinforces proper arm path, follow-through, and finish position without stress of throwing. Develops muscle memory for correct mechanics and allows high-volume repetition safely." },
    { id: "p3", title: "Flat Ground Work", category: "Pitching", description: "Throw from flat ground at 75-90% effort, focusing on specific mechanics: arm slot, hip drive, landing position, or follow-through. Work at 60 feet or regulation distance. 20-30 throws per session.", details: "Allows work on mechanics with less arm stress. Builds feel for different pitches, improves command, and provides opportunity to make adjustments without game pressure." },
    { id: "p4", title: "Target Practice with Zones", category: "Pitching", description: "Strike zone target with four quadrants (inside/outside, up/down). Pitcher must hit specific zones called by coach. Track success rate: 10 pitches to each zone. Progress to sequencing.", details: "Develops pinpoint command, ability to hit spots on demand, and teaches pitch sequencing. Builds confidence commanding all parts of strike zone." },
    { id: "p5", title: "Pick-Off Moves & Holding Runners", category: "Pitching", description: "Practice pick-off moves to all bases: slide-step delivery, various looks, timing moves, varying times to plate. Include reads of runner's secondary leads. Time delivery to home (goal: under 1.3-1.4 seconds).", details: "Develops ability to control running game, multiple looks to keep runners honest, and quick delivery when needed. Teaches deception and timing." },
    { id: "p6", title: "Long Toss for Pitchers", category: "Pitching", description: "Start at 60 feet, progress to 150-180 feet, then work back in. Focus on maintaining proper arm slot and delivery mechanics even at longer distances. Maintain extension and finish through all distances.", details: "Builds arm strength, develops proper arm action, increases velocity. Serves as arm care and develops feeling of throwing through targets rather than to them." },
    { id: "p7", title: "Pitch Arsenal Development", category: "Pitching", description: "Dedicate bullpen sessions to specific pitch development. Throw 15-20 of each pitch type: fastball (four-seam, two-seam), changeup, curveball, slider. Focus on grip, arm speed, movement. Track with video.", details: "Develops confidence in all pitches, improves feel and command of secondary pitches, expands repertoire. Teaches pitch-specific grips and release points." },
    { id: "p8", title: "Fielding Practice (PFP)", category: "Pitching", description: "Work on fielding comebackers, covering first base, backing up bases, handling bunts. Practice footwork for each scenario: fielding and throwing to bases, proper angles to first, cutoff positioning.", details: "Makes pitchers complete defensive players, prevents errors on routine plays, builds athleticism. Teaches proper techniques for all defensive responsibilities." },
    { id: "p9", title: "Mental Pitch Sequencing", category: "Pitching", description: "Without throwing, work through at-bats against imaginary hitters in different counts. Call out each pitch selection and location, explain reasoning. Coach provides feedback on strategy.", details: "Develops game IQ, teaches pitch selection strategy, and builds understanding of how to attack hitters. Prepares pitchers to think like a pitcher, not just throw." },
    { id: "p10", title: "Simulated Innings/Game Situations", category: "Pitching", description: "Set up game-like situations: bases loaded two outs, runner on third one out, etc. Pitcher must execute under pressure with proper tempo. Include consequences for walks or hits. Track pitch counts.", details: "Simulates game pressure, teaches composure in high-stress situations, develops ability to execute when it matters. Builds mental toughness and competitive mindset." },
  ],
  hitting: [
    { id: "h1", title: "Tee Work Progression", category: "Hitting", description: "Set up tee at different locations across plate (inside, middle, outside) and heights (low, mid, high). 10 swings each location. Inside pitches pulled, middle up the middle, outside to opposite field.", details: "Develops plate coverage, proper swing path for different pitch locations, opposite field power. Learn to adjust swing mechanics based on pitch location." },
    { id: "h2", title: "Soft Toss", category: "Hitting", description: "Coach kneels to side (45-degree angle) 8-10 feet away and tosses balls underhand into hitting zone. Focus on timing, hands inside the ball, driving through contact. Mix locations and vary timing.", details: "Builds hand-eye coordination, proper swing mechanics, allows high repetition without fatigue. Develops quick hands and ability to adjust to different locations." },
    { id: "h3", title: "Front Toss with Recognition", category: "Hitting", description: "Coach throws from behind screen 20 feet away. Call 'yes' or 'no' before releasing - 'yes' means swing, 'no' means take. Progress to using different colored balls where hitter only swings at specific colors.", details: "Improves pitch recognition, plate discipline, and decision-making under time pressure. Develops ability to lay off bad pitches while being aggressive on strikes." },
    { id: "h4", title: "Two-Strike Approach", category: "Hitting", description: "Live BP or machine. Every at-bat starts with 0-2 count. Hitters must shorten swing, protect plate, put ball in play. Emphasize contact over power.", details: "Teaches situational hitting, bat control, how to battle with two strikes. Reduces strikeouts and develops more compact swing when needed." },
    { id: "h5", title: "Opposite Field Drill", category: "Hitting", description: "Place cones or targets in opposite field (right field for RHH). All swings driven to opposite field gap or line. Use tee work, soft toss, or live pitching focused on outside locations.", details: "Develops ability to use whole field, increases bat control, prevents pulling off ball, teaches proper weight transfer through the zone." },
    { id: "h6", title: "One-Hand Drills", category: "Hitting", description: "Swing with only top hand or bottom hand separately, using lighter bat. Work on tee or soft toss. Top hand develops power and extension; bottom hand develops control and guiding barrel.", details: "Isolates and strengthens each hand's role in swing, improves bat control, identifies weaknesses in swing mechanics." },
    { id: "h7", title: "Live At-Bat Simulation", category: "Hitting", description: "Full at-bats against live pitching with real counts. Track every pitch, work the count, execute different approaches based on situation (runner on third, hit-and-run, etc.).", details: "Develops game-like approach, mental toughness, pitch recognition in real-time, and situational awareness." },
  ],
  fielding: [
    { id: "f1", title: "Ground Ball Progression", category: "Fielding", description: "Start 10-15 feet from coach. Roll/bounce balls creating different hops - short hops, medium hops, long hops. Proper position: feet wider than shoulders, glove out front, backside down, eyes on ball. Progress to moving left and right.", details: "Develops soft hands, proper fielding fundamentals, ability to read hops and adjust positioning. Builds confidence fielding difficult short hops." },
    { id: "f2", title: "Triangle Drill", category: "Fielding", description: "Three cones in triangle (15-20 feet apart). Start at one cone, field ground ball, shuffle to next cone, receive another, backhand at third cone, sprint to first. Continuous rotation 60-90 seconds.", details: "Improves footwork, fielding on the move, forehand and backhand technique, conditioning. Develops ability to field from different angles and body positions." },
    { id: "f3", title: "Double Play Feeds & Turns", category: "Fielding", description: "Middle infielders receive feeds from different angles (up middle, left, right) and make pivot at second base. Start slow on footwork and clean transfers, progress to game speed. Practice both feeds.", details: "Builds chemistry between middle infielders, develops quick hands and feet for turning double plays, teaches proper footwork to avoid base runners." },
    { id: "f4", title: "Do or Die Drill", category: "Fielding", description: "Ball hit/rolled to fielder who must charge hard, field cleanly, make accurate throw to home plate. Simulate runner trying to score from third, creating urgency.", details: "Teaches aggressive fielding, clean transfers under pressure, accurate throws when everything is on the line. Develops confidence in high-pressure situations." },
    { id: "f5", title: "Reaction Ball Drill", category: "Fielding", description: "Use reaction ball (oddly shaped ball that bounces unpredictably) or coach bounces balls at odd angles. Players must react quickly and adjust positioning to field the ball.", details: "Improves reaction time, hand-eye coordination, ability to adjust to bad hops. Builds athleticism and confidence handling difficult plays." },
    { id: "f6", title: "Fly Ball Communication", category: "Fielding", description: "Two-three players near each other. Coach hits fly balls between them, they must communicate ('I got it!', 'You take it!') to determine who makes catch. Include routine and difficult balls.", details: "Develops verbal communication, awareness of teammates, establishes priority systems (center fielder has priority). Prevents collisions and dropped balls due to confusion." },
    { id: "f7", title: "First-to-Third Drill", category: "Fielding", description: "Outfielders field ball in gap or down line and must make strong, accurate throw to third base to prevent runner advancing first-to-third. Focus on proper footwork, crow hop, throwing through cutoff man.", details: "Improves arm strength, accuracy, decision-making. Teaches proper throwing mechanics and angles to hit cutoff men or bases." },
  ],
  catching: [
    { id: "c1", title: "Two-Hand Catch Progression", category: "Catching", description: "Easy tosses from 10-15 feet. Catch every ball with two hands (glove and throwing hand). Progress to harder throws, then fly balls and ground balls. Keep throwing hand near glove at all times.", details: "Develops proper catching fundamentals, prevents dropped balls, enables quick transfers for throws, builds secure catching habits. Creates muscle memory for proper technique." },
    { id: "c2", title: "Fly Ball Communication & Priority", category: "Catching", description: "Groups of 3-4 players spread out. Coach hits fly balls between them at various angles and depths. Players must call loudly ('I got it! I got it! I got it!'). Priority: center fielder over corners, infielders give way to outfielders.", details: "Prevents collisions and dropped balls, establishes clear communication protocols, builds confidence catching while teammates are near, teaches priority systems." },
    { id: "c3", title: "Tracking Fly Balls - Over Shoulder", category: "Catching", description: "Coach hits/throws fly balls requiring player to turn and run to catch over shoulder. Locate ball immediately, turn and run to spot (not backpedal), catch while running full speed. Practice both directions.", details: "Develops ability to track balls in air while running, teaches proper drop-step technique, prevents backpedaling injuries, builds confidence catching on the run." },
    { id: "c4", title: "Sun/Lights Drill", category: "Catching", description: "Hit fly balls directly into sun or stadium lights. Players practice using glove to shield eyes, locating ball despite glare, making the catch. Use sunglasses when appropriate.", details: "Prepares players for real-game situations with sun/light interference, teaches proper technique for shielding eyes, builds confidence in difficult visual conditions." },
    { id: "c5", title: "Short-Hop Emphasis", category: "Catching", description: "Coach throws/hits balls creating short hops - balls bouncing just 1-3 feet in front of player. Work on attacking ball, getting glove down early, soft hands to absorb tricky bounce. Mix forehand and backhand.", details: "Develops soft hands and proper technique for most difficult hops, builds confidence in challenging plays, teaches aggressive approach to in-between hops. Most errors on short hops." },
    { id: "c6", title: "Dive Progression", category: "Catching", description: "Start on knees or sitting. Roll balls to side where players extend and catch. Progress to diving from standing. Use softer surfaces initially. Emphasize extending glove, two hands when possible, protecting body on landing.", details: "Teaches proper diving technique, builds confidence laying out for balls, prevents injuries from poor diving form, develops full-extension catching ability." },
    { id: "c7", title: "Line Drive Reaction", category: "Catching", description: "Coach uses fungo or throws hard line drives directly at players from 30-40 feet. Players react quickly, getting glove up, reading trajectory instantly. Mix balls to left, right, and directly at them.", details: "Improves reaction time and hand-eye coordination, teaches proper positioning for line drives, builds confidence tracking hard-hit balls. Develops quick-twitch reactions." },
    { id: "c8", title: "Catch & Crow Hop", category: "Catching", description: "Catch fly balls or line drives and immediately execute proper crow hop and throw to target. Focus on catching with momentum toward target, quick transfer, explosive throw. Time from catch to release.", details: "Develops smooth transition from catching to throwing, teaches proper footwork after catch, builds throwing accuracy after fielding. Prevents wasted movement." },
    { id: "c9", title: "Pop-Up Drift Awareness", category: "Catching", description: "Coach hits high pop-ups with backspin (most pop-ups naturally have this). Players understand pop-ups drift back toward infield. Practice reading spin, adjusting positioning, catching while moving backward or circling.", details: "Teaches physics of pop-ups, prevents players from camping under spots where ball won't land, develops ability to read ball rotation and adjust positioning." },
    { id: "c10", title: "Glove Positioning Fundamentals", category: "Catching", description: "Balls above waist: thumbs together, fingers pointing up. Balls below waist: pinkies together, fingers pointing down. Practice rapid transitions between high and low balls for automatic positioning.", details: "Creates automatic, correct glove positioning, prevents awkward catches that lead to drops, builds fundamentally sound catching technique that works in all situations." },
  ],
  throwing: [
    { id: "t1", title: "Long Toss Progression", category: "Throwing", description: "Partners start 30-40 feet apart with proper mechanics. After 10 throws, each takes 2-3 steps back. Continue until reaching maximum distance, then work back in. Focus on four-seam grip, arm angle, follow-through.", details: "Builds arm strength, proper throwing mechanics, develops arm arc needed for longer throws. Serves as both a drill and arm care routine." },
    { id: "t2", title: "Crow Hop & Release", category: "Throwing", description: "Practice proper crow hop: field position, quick shuffle step, gather and push off back leg, aggressive step toward target, quick release. Start without ball to perfect footwork, then add throws.", details: "Develops quick, efficient transfers and throws. Essential for outfielders and any position needing to make strong throw after fielding." },
    { id: "t3", title: "Targets & Accuracy Work", category: "Throwing", description: "Set up targets (cones, buckets, marked spots) at various distances and angles. Players must hit specific targets with throws. Start close and increase distance. Award points for accuracy.", details: "Improves throwing accuracy, builds confidence hitting cutoff men and bases, adds competitive element to throwing practice." },
    { id: "t4", title: "Knee Throws", category: "Throwing", description: "Players kneel on throwing side knee and make throws from this position. Isolates upper body and arm action, removing lower body compensation.", details: "Teaches proper arm mechanics, shoulder rotation, follow-through. Identifies mechanical flaws that might be hidden by strong lower body." },
    { id: "t5", title: "Quick Release Drill", category: "Throwing", description: "Field ball and release within 1.5-2 seconds. Coach times with stopwatch. Practice from various fielding positions and angles.", details: "Develops quick hands, efficient transfers from glove to hand, fast release. Critical for preventing stolen bases and getting lead runners." },
    { id: "t6", title: "Relay Throws", category: "Throwing", description: "Multiple players in line practicing relay throws from outfield to infield. Outfielder throws to cutoff man (middle infielder), who immediately relays to base. Emphasize quick catch-and-throw, positioning, accuracy.", details: "Develops teamwork, communication, ability to make quick, accurate throws. Teaches proper relay positioning and techniques." },
  ],
  catcherSpecific: [
    { id: "cs1", title: "Blocking Drill", category: "Catcher", description: "Start in crouch. Coach throws/bounces balls in dirt to different locations (middle, left, right). Get body in front, drop to knees, keep chest over ball, trap with chest protector and glove. Mix speeds and angles.", details: "Develops proper blocking technique, fearlessness in the dirt, ability to keep balls in front to prevent wild pitches and passed balls." },
    { id: "cs2", title: "Framing/Receiving Work", category: "Catcher", description: "Use target, pitching machine, or pitcher from regulation distance. Work on receiving balls on edges of strike zone, focusing on 'sticking' pitches by catching and holding position. Emphasize quiet hands and subtle movements.", details: "Improves pitch framing ability to gain called strikes, develops soft hands, teaches how to work with umpires effectively." },
    { id: "cs3", title: "Pop-Up Priority Drill", category: "Catcher", description: "Hit/throw pop-ups around home plate in various directions. Catcher must quickly remove mask (throw away from direction of ball), locate ball, make catch. Remember pop-ups spin back toward infield.", details: "Teaches proper technique for tracking pop-ups, removing equipment safely, understanding spin dynamics of foul balls." },
    { id: "cs4", title: "Throw Down Progression", category: "Catcher", description: "Work on throwing mechanics to second base. Start with footwork only (receiving position, quick transfer, step and throw), then add throwing. Get rid of ball in under 2.0 seconds. Also practice throws to third and first.", details: "Develops quick release, accuracy, proper footwork to control running game and pick off base runners." },
    { id: "cs5", title: "Tag Plays at Home", category: "Catcher", description: "Set up situations where runner is trying to score. Practice receiving throws from various angles, positioning body to block plate (within rules), applying tags quickly and safely. Include dropped ball recoveries.", details: "Teaches proper technique for high-pressure plays at home, body positioning, safe tagging technique while protecting against injury." },
    { id: "cs6", title: "One-Knee Receiving", category: "Catcher", description: "Practice receiving from one-knee stance (common with no runners on). Focus on staying low, quiet glove presentation, framing pitches effectively from this position.", details: "Develops comfort and effectiveness in one-knee stance, improves framing from this position, teaches when to use traditional versus one-knee setup." },
  ],
  baserunning: [
    { id: "br1", title: "First-Step Quickness", category: "Baserunning", description: "Runners take lead and react to commands: 'go' (steal), 'back' (pitcher throws to first), 'hold' (no pitch). Use stopwatch to time first three steps. Focus on explosive first step and proper crossover technique.", details: "Develops quick reactions, explosive starts, proper crossover step technique for stealing bases and advancing on balls in play." },
    { id: "br2", title: "Round-the-Bases Technique", category: "Baserunning", description: "Practice hitting inside of bag when rounding bases, maintaining speed through base, taking proper angle to set up for next base. Time full circuits and individual base-to-base segments.", details: "Teaches efficient base running, proper angles and footwork on turns, how to maintain maximum speed throughout the bases." },
    { id: "br3", title: "Secondary Lead & Reads", category: "Baserunning", description: "Take primary lead, then execute secondary lead (timing with pitcher's release). Practice reading balls in dirt, line drives, fly balls, with proper reactions. Include freeze or advance decisions on line drives.", details: "Develops proper lead technique, improves reading ball off bat, teaches appropriate reactions to different batted balls." },
    { id: "br4", title: "Tag-Up Drill", category: "Baserunning", description: "Start at a base and practice tagging up on fly balls. Coach hits fly balls at different depths, runners time break to next base. Work from all three bases with emphasis on third-to-home on sacrifice flies.", details: "Teaches proper tag-up technique, improves timing, develops ability to judge flyball depth and make advancement decisions." },
    { id: "br5", title: "First-to-Third", category: "Baserunning", description: "Hit/throw balls into outfield gaps. Runners practice going first-to-third, focusing on reading outfielder, hitting inside corner of second base, listening for coaches. Time the plays and create competition.", details: "Develops aggressive base running, proper technique for two-base advancement, teaches when to challenge outfielders' arms." },
    { id: "br6", title: "Slide Progression", category: "Baserunning", description: "Teach proper sliding in grass or on slip-and-slide first. Progress to: bent-leg slide, head-first slide, pop-up slide, hook slide. Practice both sides for hook slides.", details: "Teaches safe, efficient sliding technique, prevents injuries, develops ability to avoid tags and reach bases quickly." },
    { id: "br7", title: "Situational Base Running", category: "Baserunning", description: "Set up game scenarios: runner on first with <2 outs (must advance on ground ball), runner on third <2 outs (tag and score on fly ball), etc. Runners execute proper technique for each situation.", details: "Develops baseball IQ, teaches situation-specific base running, ensures players know proper protocols in all game situations." },
  ],
  conditioning: [
    { id: "con1", title: "60-Yard Sprints", category: "Conditioning", description: "Sprint 60 yards (or 90 feet for younger players) at maximum effort. Rest 90-120 seconds between reps. Complete 6-10 reps. Focus on explosion off start and maintaining form throughout.", details: "Builds speed, explosive power, anaerobic capacity needed for base running and fielding plays. Mimics game distances." },
    { id: "con2", title: "Ladder Drills", category: "Conditioning", description: "Use agility ladder on ground. Perform various footwork patterns: one foot each square, two feet each square, lateral shuffles, icky shuffle, in-in-out-out patterns. Complete 5-6 different patterns, 3-4 reps each.", details: "Improves foot speed, coordination, agility, body control. Develops quick feet needed for fielding and base running." },
    { id: "con3", title: "Shuttle Runs (5-10-5)", category: "Conditioning", description: "Start at center cone, sprint 5 yards right and touch line, sprint 10 yards left and touch that line, then sprint 5 yards back through center. Time each rep with 60-second rest. Complete 6-8 reps.", details: "Develops change-of-direction ability, acceleration, deceleration, anaerobic endurance needed for multiple plays in an inning." },
    { id: "con4", title: "Pole-to-Pole Runs", category: "Conditioning", description: "Start at left field foul pole, jog down line to home, sprint across field to right field foul pole, jog down that line to home, sprint back to left field foul pole. Complete 3-5 circuits with 2-min rest.", details: "Builds aerobic base, stamina for full games, mental toughness. Teaches proper pacing and recovery while moving." },
    { id: "con5", title: "Medicine Ball Work", category: "Conditioning", description: "Use 2-6 pound weighted balls or medicine balls for rotational throws, overhead slams, chest passes, side throws. Complete 3 sets of 10-12 reps for each exercise.", details: "Builds explosive power, core strength, rotational strength needed for hitting and throwing. Develops fast-twitch muscle fibers." },
    { id: "con6", title: "Plank Circuit", category: "Conditioning", description: "Hold front plank 30-60 seconds, side plank (each side) 30-45 seconds, reverse plank 30 seconds. Complete 3-4 rounds with 30-second rest between exercises.", details: "Builds core stability essential for throwing, hitting, injury prevention. Develops muscular endurance and body control." },
    { id: "con7", title: "Hill Sprints or Stadium Stairs", category: "Conditioning", description: "Sprint up hill or stadium stairs (50-100 feet/steps), walk down for recovery. Complete 8-12 reps. Focus on driving knees up and maintaining good running form despite fatigue.", details: "Builds leg power, cardiovascular endurance, mental toughness. Develops leg drive needed for base running and explosive movements." },
  ],
  mental: [
    { id: "m1", title: "Visualization Practice", category: "Mental Skills", description: "Sit quietly 5-10 minutes with eyes closed. Guide through visualizing successful at-bats, making difficult defensive plays, or executing in pressure situations. Emphasize seeing, feeling, hearing every detail in mind.", details: "Develops mental rehearsal skills, builds confidence through repeated 'successful' experiences, prepares mind for actual game situations." },
    { id: "m2", title: "Breathing & Composure", category: "Mental Skills", description: "Teach box breathing (4-4-4-4: inhale 4 seconds, hold 4, exhale 4, hold 4). Practice during breaks or before pressure situations. Create pressure scenarios where players must use breathing to stay calm.", details: "Provides tools to manage anxiety and pressure, slows heart rate in tense situations, helps maintain focus and composure." },
    { id: "m3", title: "Failure Response Drill", category: "Mental Skills", description: "Set up difficult drills where failure is likely (machine set very fast, extremely hard ground balls, etc.). After each failure, players demonstrate positive body language: shoulders back, head up, positive self-talk out loud ('next one', 'I got this').", details: "Teaches resilience, positive response to failure, body language awareness. Builds mental toughness and ability to move on quickly from mistakes." },
    { id: "m4", title: "Situational Recognition Quiz", category: "Mental Skills", description: "Coach calls out game situations (runner on second, one out, ground ball to short, etc.) and players quickly state what they would do defensively. Rotate through all positions. Can also do hitting scenarios.", details: "Develops baseball IQ, situational awareness, preparation. Ensures players know what to do before situations arise in games." },
    { id: "m5", title: "Pre-Pitch Routine Development", category: "Mental Skills", description: "Each player develops and practices their pre-pitch or pre-swing routine. Batters establish approach in box (same stance, timing, breathing). Pitchers develop routine on mound. Practice until automatic.", details: "Creates consistency and comfort in game situations, provides mental reset between pitches, helps maintain focus and composure." },
    { id: "m6", title: "Goal Setting Sessions", category: "Mental Skills", description: "Write down specific, measurable goals for season, month, week. Include both outcome goals (batting average, stolen bases) and process goals (quality at-bats, proper footwork). Review and adjust regularly.", details: "Provides direction and motivation, teaches self-assessment, helps players take ownership of development. Builds accountability." },
    { id: "m7", title: "Pressure Simulation", category: "Mental Skills", description: "Create high-pressure practice situations: bases loaded scrimmage, timed competitions between teams, must-succeed scenarios (if you don't execute, team runs). Build in real consequences to simulate game pressure.", details: "Develops ability to perform under pressure, simulates game stress in practice, teaches players to focus when stakes are high. Builds mental toughness." },
  ],
};

const ALL_DRILLS = [
  ...DRILL_LIBRARY.pitching,
  ...DRILL_LIBRARY.hitting,
  ...DRILL_LIBRARY.fielding,
  ...DRILL_LIBRARY.catching,
  ...DRILL_LIBRARY.throwing,
  ...DRILL_LIBRARY.catcherSpecific,
  ...DRILL_LIBRARY.baserunning,
  ...DRILL_LIBRARY.conditioning,
  ...DRILL_LIBRARY.mental,
];

const MOCK_DRILLS = [
  { id: "d1", title: "Tee Work – Inside Pitch", category: "Hitting", description: "15 swings focusing on driving inside pitches to the pull side. Hips lead, hands through the zone.", due_at: "2026-02-20", status: "completed", assigned_by: "Coach Martinez", feedback: { status: "good", note: "Nice power! Keep driving through the ball." } },
  { id: "d2", title: "4-Seam Grip & Throw", category: "Pitching", description: "50 reps dry with proper 4-seam grip. Focus on finger pressure and wrist snap at release.", due_at: "2026-02-19", status: "completed", assigned_by: "Coach Martinez", feedback: { status: "good", note: "Great form! Keep the elbow up on the follow-through." } },
  { id: "d3", title: "Ground Ball Shuffle", category: "Fielding", description: "Partner drill: 20 grounders each side. Stay low, shuffle feet, field clean through the glove.", due_at: "2026-02-17", status: "overdue", assigned_by: "Coach Martinez", feedback: null },
];
const MOCK_COACH_DRILLS = [
  { id: "cd1", title: "Tee Work – Inside Pitch", category: "Hitting", due_at: "Mar 5", completions: 3, total: 8,
    players: [
      { playerId: "p1", completed: true },  { playerId: "p2", completed: false },
      { playerId: "p3", completed: true },  { playerId: "p4", completed: false },
      { playerId: "p5", completed: true },  { playerId: "p6", completed: false },
      { playerId: "p7", completed: false }, { playerId: "p8", completed: false },
    ]},
  { id: "cd2", title: "4-Seam Grip & Throw", category: "Pitching", due_at: "Mar 3", completions: 8, total: 8,
    players: [
      { playerId: "p1", completed: true },  { playerId: "p2", completed: true },
      { playerId: "p3", completed: true },  { playerId: "p4", completed: true },
      { playerId: "p5", completed: true },  { playerId: "p6", completed: true },
      { playerId: "p7", completed: true },  { playerId: "p8", completed: true },
    ]},
  { id: "cd3", title: "Ground Ball Shuffle", category: "Fielding", due_at: "Mar 2", completions: 2, total: 8,
    players: [
      { playerId: "p1", completed: false }, { playerId: "p2", completed: true },
      { playerId: "p3", completed: false }, { playerId: "p4", completed: false },
      { playerId: "p5", completed: true },  { playerId: "p6", completed: false },
      { playerId: "p7", completed: false }, { playerId: "p8", completed: false },
    ]},
  { id: "cd4", title: "Long Toss Progression", category: "Throwing", due_at: "Mar 6", completions: 5, total: 8,
    players: [
      { playerId: "p1", completed: true },  { playerId: "p2", completed: true },
      { playerId: "p3", completed: false }, { playerId: "p4", completed: true },
      { playerId: "p5", completed: false }, { playerId: "p6", completed: true },
      { playerId: "p7", completed: true },  { playerId: "p8", completed: false },
    ]},
];
const MOCK_ROSTER = [
  { 
    id: "p1", name: "Jake Rivera", number: "12", positions: ["SS", "P"], bats: "R", throws: "R", role: "player", 
    parent1Name: "Sarah Rivera", parent1Phone: "(816) 555-0123", parent1Email: "sarah.rivera@email.com",
    parent2Name: "Carlos Rivera", parent2Phone: "(816) 555-0223", parent2Email: "carlos.rivera@email.com",
    picture: "👦", skillNotes: "Strong arm, good range. Working on hitting inside pitches. Excellent leadership on field." 
  },
  { 
    id: "p2", name: "Tyler Chen", number: "7", positions: ["CF", "P"], bats: "L", throws: "L", role: "player", 
    parent1Name: "David Chen", parent1Phone: "(816) 555-0124", parent1Email: "d.chen@email.com",
    parent2Name: "Michelle Chen", parent2Phone: "(816) 555-0224", parent2Email: "michelle.chen@email.com",
    picture: "👦", skillNotes: "Great speed and instincts. Needs to be more aggressive on base paths. Developing changeup grip." 
  },
  { 
    id: "p3", name: "Marcus Johnson", number: "3", positions: ["C", "1B"], bats: "R", throws: "R", role: "player", 
    parent1Name: "Jennifer Johnson", parent1Phone: "(816) 555-0125", parent1Email: "jen.johnson@email.com",
    parent2Name: "Robert Johnson", parent2Phone: "(816) 555-0225", parent2Email: "rob.johnson@email.com",
    picture: "👦", skillNotes: "Natural catcher, strong blocking skills. Pop time improving. Focus on receiving low strikes." 
  },
  { 
    id: "p4", name: "Ethan Williams", number: "22", positions: ["3B", "P"], bats: "R", throws: "R", role: "player", 
    parent1Name: "Mike Williams", parent1Phone: "(816) 555-0126", parent1Email: "mike.w@email.com",
    parent2Name: "Angela Williams", parent2Phone: "(816) 555-0226", parent2Email: "angela.w@email.com",
    picture: "👦", skillNotes: "Power hitter with good glove at third. Working on pitch selection. Fastball has good movement." 
  },
  { 
    id: "p5", name: "Diego Morales", number: "15", positions: ["RF", "2B"], bats: "R", throws: "R", role: "player", 
    parent1Name: "Carmen Morales", parent1Phone: "(816) 555-0127", parent1Email: "c.morales@email.com",
    parent2Name: "Luis Morales", parent2Phone: "(816) 555-0227", parent2Email: "luis.morales@email.com",
    picture: "👦", skillNotes: "Excellent contact hitter. Needs to take more walks. Smooth double play turns at second base." 
  },
  { 
    id: "p6", name: "Noah Thompson", number: "8", positions: ["LF", "1B"], bats: "L", throws: "L", role: "player", 
    parent1Name: "Lisa Thompson", parent1Phone: "(816) 555-0128", parent1Email: "lisa.t@email.com",
    parent2Name: "James Thompson", parent2Phone: "(816) 555-0228", parent2Email: "james.t@email.com",
    picture: "👦", skillNotes: "Power from left side. Comfortable at first base. Working on opposite field approach." 
  },
  { 
    id: "p7", name: "Aiden Park", number: "1", positions: ["2B", "SS"], bats: "B", throws: "R", role: "player", 
    parent1Name: "Kevin Park", parent1Phone: "(816) 555-0129", parent1Email: "kevin.park@email.com",
    parent2Name: "Susan Park", parent2Phone: "(816) 555-0229", parent2Email: "susan.park@email.com",
    picture: "👦", skillNotes: "Switch hitter with good bat control. Quick hands in the field. Needs to communicate more on pop-ups." 
  },
  { 
    id: "p8", name: "Caleb Foster", number: "19", positions: ["1B", "C"], bats: "R", throws: "R", role: "player", 
    parent1Name: "Amanda Foster", parent1Phone: "(816) 555-0130", parent1Email: "amanda.foster@email.com",
    parent2Name: "Daniel Foster", parent2Phone: "(816) 555-0230", parent2Email: "daniel.foster@email.com",
    picture: "👦", skillNotes: "Good size and footwork at first. Backup catcher developing. Focus on staying back on breaking balls." 
  },
  { id: "c1", name: "Coach Martinez", number: null, positions: [], bats: null, throws: null, role: "head_coach", phone: "(816) 555-0101", email: "coach.martinez@hawks.com" },
  { id: "c2", name: "Coach Davis", number: null, positions: [], bats: null, throws: null, role: "assistant_coach", phone: "(816) 555-0102", email: "coach.davis@hawks.com" },
];
const MOCK_CONVS = [
  { id: "cv1", type: "group", name: "🦅 Hawks Team Chat", preview: "Coach Martinez: Don't forget Thursday gear!", time: "2h ago", unread: 3 },
  { id: "cv2", type: "direct", name: "Coach Martinez", preview: "Sounds good, see you there!", time: "4h ago", unread: 0 },
  { id: "cv3", type: "direct", name: "Coach Davis", preview: "Jake's arm feeling okay this week?", time: "Yesterday", unread: 1 },
];
const INIT_MESSAGES = {
  cv1: [
    { id: "m1", sender: "Coach Martinez", body: "Great practice everyone! Keep working on those grounders.", time: "Tue 5:32pm", sent: false },
    { id: "m2", sender: "Sarah Rivera", body: "Jake will be a few minutes late Thursday – dentist at 4:30.", time: "Tue 6:01pm", sent: false },
    { id: "m3", sender: "You", body: "Got it, we'll get him warmed up when he arrives!", time: "Tue 6:05pm", sent: true },
    { id: "m4", sender: "Coach Martinez", body: "Don't forget Thursday – bring your catchers gear Marcus!", time: "Today 8am", sent: false },
  ],
  cv2: [
    { id: "m5", sender: "Coach Martinez", body: "Jake's plate discipline has really improved. Keep encouraging the tee work!", time: "Mon 4pm", sent: false },
    { id: "m6", sender: "You", body: "Thank you! He's been doing it every night after school.", time: "Mon 4:15pm", sent: true },
    { id: "m7", sender: "Coach Martinez", body: "Sounds good, see you there!", time: "Mon 4:30pm", sent: false },
  ],
  cv3: [
    { id: "m8", sender: "Coach Davis", body: "Jake's arm feeling okay this week?", time: "Yesterday", sent: false },
  ],
};
const MOCK_PLANS = [
  {
    id: "pp1", title: "Practice 1: Defensive Foundation", duration: 90,
    description: "Ground ball relays, fly ball communication, catcher skills, defensive situations, and rundown drills",
    segments: [
      { id: "s1", title: "Dynamic Stretching & Partner Toss", minutes: 10, drill: null, notes: "Players pair up 15-20ft apart, jog while playing catch, gradually to 40ft. Proper throwing mechanics." },
      { id: "s2", title: "Ground Ball Relay Races", minutes: 15, drill: "Ground Ball Progression", notes: "Divide into 3-4 teams, relay lines 60ft apart. Field, throw to teammate, run to back of line. Competition format." },
      { id: "s3", title: "Fly Ball Communication Drills", minutes: 15, drill: "Fly Ball Communication & Priority", notes: "Groups of 3 in outfield. Must call 'I got it!' or 'You take it!' Add collision avoidance progressions." },
      { id: "s4", title: "Catcher Skills Circuit", minutes: 15, drill: "Blocking Drill", notes: "Blocking (5min), throwing to 2nd (5min), throwing to 3rd on bunts (5min). Other infielders practice receiving." },
      { id: "s5", title: "Defensive Situations", minutes: 25, drill: null, notes: "Runner on 1st (DP), runner on 2nd (cutoff), runner on 3rd (fly ball), bases loaded (home). Run each 4-5 times." },
      { id: "s6", title: "Pickle/Rundown Competition", minutes: 10, drill: null, notes: "Create 3 rundown areas. Defense vs runners. Run runner back to previous base, max 2 throws." },
    ]
  },
  {
    id: "pp2", title: "Practice 2: Base Running & Speed", duration: 90,
    description: "Tag games, home-to-first sprints, rounding bases, sliding practice, tag-up drills, and scrimmage",
    segments: [
      { id: "s7", title: "Tag Games", minutes: 10, drill: null, notes: "Freeze tag or regular tag for 3min, dynamic stretches 7min. Change of direction, acceleration." },
      { id: "s8", title: "Home to First Sprints", minutes: 10, drill: "First-Step Quickness", notes: "Simulate swing, sprint to first. Time with stopwatch. 3 attempts from each batter's box. Run through bag." },
      { id: "s9", title: "Rounding Bases", minutes: 10, drill: "Round-the-Bases Technique", notes: "Practice rounding first on doubles, rounding second on triples. Relay races in groups of 4. Wide turn." },
      { id: "s10", title: "Sliding Practice", minutes: 10, drill: "Slide Progression", notes: "Slip-n-slide or mats at each base. Bent-leg slide 2-3 times per base. Start slide 6-8ft from base." },
      { id: "s11", title: "Tag-Up Drills", minutes: 10, drill: "Tag-Up Drill", notes: "Runners at 2nd and 3rd. Practice tagging up on fly balls, judging depth. One foot on bag, explode on contact." },
      { id: "s12", title: "Team Scrimmage: Defense vs. Runners", minutes: 30, drill: null, notes: "Full defense, rotating runners. Practice steal opportunities, runner on 3rd situations, runners on corners." },
      { id: "s13", title: "Cool-down & Reflection", minutes: 10, drill: null, notes: "Light stretching, hydration. Team circle: each player shares one thing they learned." },
    ]
  },
  {
    id: "pp3", title: "Practice 3: Communication & Teamwork", duration: 95,
    description: "Throwing with communication, pop-up priority, bunt defense, first-and-third defense, outfield relays",
    segments: [
      { id: "s14", title: "Throwing Lines with Communication", minutes: 10, drill: null, notes: "Two parallel lines 40ft apart. Call 'ready!' before throwing, 'got it!' when catching. Add distractions." },
      { id: "s15", title: "Pop-Up Priority Drill", minutes: 15, drill: "Fly Ball Communication", notes: "Full infield. Pop-ups where 2-3 players converge. Priority rules: infield>outfield, center>corners." },
      { id: "s16", title: "Bunt Defense Rotations", minutes: 15, drill: null, notes: "Practice sacrifice bunt, bunt for hit, squeeze play. Rotate positions every 5 attempts. Catcher calls play!" },
      { id: "s17", title: "First-and-Third Defensive Scenarios", minutes: 20, drill: null, notes: "Defend steal attempts: throw through, cut and catch off third, fake to third, pump fake. Runners vs defense." },
      { id: "s18", title: "Outfield Relay Competitions", minutes: 15, drill: "Relay Throws", notes: "Three teams (RF-2B-Home, CF-SS-Home, LF-3B-Home). Clean relay=3pts, cutoff hit but offline=1pt." },
      { id: "s19", title: "Scrimmage with Communication Focus", minutes: 15, drill: null, notes: "If coach doesn't hear communication, play doesn't count (redo). Communication becomes automatic." },
      { id: "s20", title: "Team Building: Trust Circle", minutes: 5, drill: null, notes: "Share one teammate who helped today. Or group challenge: hold plank while passing ball around circle." },
    ]
  },
  {
    id: "pp4", title: "Practice 4: Quick Hands & Reactions", duration: 90,
    description: "Reaction balls, short-hop challenge, tennis ball quick-toss, barehand fielding, live situational play",
    segments: [
      { id: "s21", title: "Reaction Ball Games", minutes: 10, drill: "Reaction Ball Drill", notes: "Partners with reaction balls (six-sided rubber balls). Bounce to partner who must field. Increase distance and speed." },
      { id: "s22", title: "Short-Hop Challenge", minutes: 15, drill: "Short-Hop Emphasis", notes: "Partners 20ft apart. Intentionally throw short hops. Progress from stationary to moving laterally. Count clean fields." },
      { id: "s23", title: "Tennis Ball Quick-Toss Reactions", minutes: 15, drill: null, notes: "Coach rapid-fires tennis balls (one every 2-3 sec). Field and toss back immediately. Variations: backhand, forehand, two balls." },
      { id: "s24", title: "Barehand Fielding Competitions", minutes: 15, drill: null, notes: "Use tennis balls. Field barehanded, underhand flips to partner, add movement. Team vs team." },
      { id: "s25", title: "Team Defense: Live Situational Play", minutes: 25, drill: null, notes: "Full defense, rotating runners. Fast-paced ground balls and line drives. Focus: DP turns, quick transfers, tag plays." },
      { id: "s26", title: "Relay Throw Accuracy", minutes: 10, drill: "Targets & Accuracy Work", notes: "Three relay teams, 10 throws to target. Hit target=3pts, within 5ft=1pt. Quick release." },
    ]
  },
  {
    id: "pp5", title: "Practice 5: Outfield Emphasis", duration: 95,
    description: "Long toss, do-or-die charging, going back on balls, throwing to bases, communication, backing up",
    segments: [
      { id: "s27", title: "Long Toss Progression", minutes: 10, drill: "Long Toss Progression", notes: "Partners start 30ft, gradually increase to 60-90ft for youth. Proper crow hop, throw on line, full extension." },
      { id: "s28", title: "Do-or-Die Charging Drill", minutes: 15, drill: "Do or Die Drill", notes: "Sprint toward ground balls. Field on run and throw immediately. Simulate runner scoring from 3rd. Attack ball." },
      { id: "s29", title: "Going Back on Balls", minutes: 15, drill: "Tracking Fly Balls - Over Shoulder", notes: "Turn and run back at angle. Drop step or crossover. Look over shoulder while running. Don't backpedal." },
      { id: "s30", title: "Throwing to Bases Relay Races", minutes: 20, drill: "First-to-Third Drill", notes: "Outfielder hits cutoff, cutoff relays to base. Competition: time from hit to ball reaching base. All scenarios." },
      { id: "s31", title: "Communication on Fly Balls", minutes: 15, drill: "Fly Ball Communication & Priority", notes: "Full outfield and infield. Priority rules: center>corners, outfield>infield. Call early, call loud." },
      { id: "s32", title: "Backing Up Bases", minutes: 10, drill: null, notes: "Ground ball to infield=back up first. Steal=back up throw. Sprint immediately, position 30-40ft behind base." },
      { id: "s33", title: "Home Run Derby Defense", minutes: 10, drill: null, notes: "Coach hits fly balls to fence. Outfielders chase down, try to rob home runs. Catching=save HR (team points)." },
    ]
  },
  {
    id: "pp6", title: "Practice 6: Infield Precision", duration: 95,
    description: "Agility ladder, around the horn, double plays, slow rollers, backhands, tag plays, live IF/OF",
    segments: [
      { id: "s34", title: "Agility Ladder & Partner Toss", minutes: 10, drill: "Ladder Drills", notes: "5min quick feet through ladder (various patterns). 5min play catch focusing on accurate chest-high throws." },
      { id: "s35", title: "Around the Horn", minutes: 15, drill: null, notes: "Standard: 3B→2B→1B→C→3B. Reverse and skip variations. Time it, try to beat team record. Count consecutive clean rotations." },
      { id: "s36", title: "Double Play Competitions", minutes: 15, drill: "Double Play Feeds & Turns", notes: "Ground balls to all positions. SS/2B teams compete for most successful DPs in 10 attempts. Quick feet, chest-high feed." },
      { id: "s37", title: "Slow Rollers & Charging", minutes: 10, drill: null, notes: "Sprint and charge ball. Barehand or glove field, throw on run to first. All positions practice. Attack aggressively." },
      { id: "s38", title: "Backhand Plays", minutes: 10, drill: null, notes: "Lines at SS and 3B. Ground balls to backhand side. Get behind if possible, extend if not. Keep glove low, strong throw." },
      { id: "s39", title: "Tag Plays at Bases", minutes: 10, drill: "Tag Plays at Home", notes: "Rotate infielders to 2B and 3B. Catchers throw, infielders receive and tag. Straddle bag, quick swipe tag." },
      { id: "s40", title: "Full Team: Live Infield/Outfield", minutes: 20, drill: null, notes: "Rapid-fire ground balls and line drives. Runners on for DP opportunities, bases loaded infield in, bunt defense. Game speed!" },
      { id: "s41", title: "Team Accomplishment Share", minutes: 5, drill: null, notes: "Circle up. Each player names one great play they saw a teammate make. Positive reinforcement culture." },
    ]
  },
  {
    id: "pp7", title: "Practice 7: Throwing Accuracy Day", duration: 90,
    description: "Progressive throwing, target practice, long toss, crow hop technique, relay contests, rundowns",
    segments: [
      { id: "s42", title: "Progressive Throwing", minutes: 10, drill: "Long Toss Progression", notes: "30ft for 2min, 50ft for 3min, 70ft for 3min, long toss for 2min. Step toward target, follow through." },
      { id: "s43", title: "Target Practice Competitions", minutes: 10, drill: "Targets & Accuracy Work", notes: "Targets at 2nd, 3rd, home. Bullseye=3pts, close=1pt. Outfield to bases, infield to first, catcher throws." },
      { id: "s44", title: "Long Toss Partners", minutes: 10, drill: "Long Toss for Pitchers", notes: "Gradually extend to maximum throw. High arc on long throws. Record personal best distance. Full body involved." },
      { id: "s45", title: "Crow Hop Technique Races", minutes: 10, drill: "Crow Hop & Release", notes: "Field on run, crow hop, throw to target. Time from field to release. Right-left-throw for righties." },
      { id: "s46", title: "Relay Throw Contests", minutes: 10, drill: "Relay Throws", notes: "Four-person teams (OF→CF→IF→Base). Time + accuracy scoring. Chest-high throws, quick exchange, 'RELAY!'" },
      { id: "s47", title: "Around the Bases Relay", minutes: 15, drill: null, notes: "Players at each base. Home→1st→2nd→3rd→home continuously. Speed round, accuracy round, reverse direction." },
      { id: "s48", title: "Rundown Scenarios", minutes: 15, drill: null, notes: "Runners between all bases. Max 2 throws to get out. Run runner back to previous base. Pump fake, accurate throw." },
      { id: "s49", title: "Stretching & Arm Care", minutes: 10, drill: null, notes: "Static stretching major muscle groups. Arm circles, shoulder stretches. Discuss importance of arm care." },
    ]
  },
  {
    id: "pp8", title: "Practice 8: Situational Mastery", duration: 95,
    description: "Runner on 3rd, bases loaded, double play situations, bunt defense, live scrimmage with situations",
    segments: [
      { id: "s50", title: "Dynamic Movement", minutes: 10, drill: null, notes: "Jogging, high knees, butt kicks, shuffles, backpedaling while playing catch. Full range of motion." },
      { id: "s51", title: "Runner on 3rd, <2 Outs", minutes: 12, drill: "Situational Base Running", notes: "Ground ball (where to throw?), fly ball (tag up), passed ball, squeeze attempt. Play at home vs out at first." },
      { id: "s52", title: "Bases Loaded, Infield In", minutes: 12, drill: null, notes: "Force at any base. Ground balls to each position, pop-ups, line drives. Home for force, turn DP, or take sure out." },
      { id: "s53", title: "Nobody Out, Runner on Third", minutes: 12, drill: null, notes: "Bunt attempt, ground ball, fly ball, squeeze. Infield drawn in or normal depth? Prevent run if possible." },
      { id: "s54", title: "Double Play Situations", minutes: 12, drill: "Double Play Feeds & Turns", notes: "Runner on 1st or 1st and 2nd. Ground ball to each position. Get one out minimum." },
      { id: "s55", title: "Bunt Defense", minutes: 12, drill: null, notes: "Sacrifice (runner on 1st), squeeze (runner on 3rd), safety squeeze, bunt for hit. Who fields? Where to throw?" },
      { id: "s56", title: "Live Scrimmage: Mix All Situations", minutes: 15, drill: null, notes: "Coach calls situation before pitch. Defense executes. Think before ball is hit, communicate plan." },
      { id: "s57", title: "Review & Team Huddle", minutes: 10, drill: null, notes: "Quick quiz on situations. Celebrate good decisions. Discuss common mistakes without blame." },
    ]
  },
  {
    id: "pp9", title: "Practice 9: Speed & Competition", duration: 85,
    description: "Sprint relays, base-to-base races, fielding tournament, throwing challenge, position challenges, scrimmage",
    segments: [
      { id: "s58", title: "Sprint Relays", minutes: 10, drill: "60-Yard Sprints", notes: "Teams of 4. Home to first and back, first to second and back, around all bases. All-out effort." },
      { id: "s59", title: "Base-to-Base Timed Races", minutes: 12, drill: "Round-the-Bases Technique", notes: "Home to first (L&R box), first to third, home to home. 2 attempts each, record best time. Post leaderboard!" },
      { id: "s60", title: "Fielding Accuracy Tournament", minutes: 12, drill: null, notes: "Ground balls (10), fly balls (10), pop-ups (10). Clean play=1pt. Rotate through all three stations." },
      { id: "s61", title: "Throwing Accuracy Challenge", minutes: 13, drill: "Targets & Accuracy Work", notes: "First base throws, relay throws, catcher throws. Hit target=3pts, within 2ft=2pts, within 5ft=1pt." },
      { id: "s62", title: "Position-Specific Challenges", minutes: 13, drill: null, notes: "Infielders: most ground balls in 2min. Outfielders: most accurate throws. Catchers: best pop time. Pitchers: most strikes." },
      { id: "s63", title: "Team Scrimmage with Scoring", minutes: 20, drill: null, notes: "Two teams, actual score. Bonus points for hustle, communication, DPs, relay throws. Apply all skills!" },
      { id: "s64", title: "Cool-down & Awards", minutes: 5, drill: null, notes: "Light stretching. Announce competition winners. Emphasize effort and improvement. Team celebration!" },
    ]
  },
  {
    id: "pp10", title: "Practice 10: Full-Team Simulation", duration: 95,
    description: "Full game simulation with position rotations, coaching moments, strategic scenarios, team culture building",
    segments: [
      { id: "s65", title: "Team Circle Throwing", minutes: 10, drill: null, notes: "Large circle. Pass clockwise, counterclockwise, skip throws across, multiple balls. Call name before throwing." },
      { id: "s66", title: "Modified Scrimmage Setup", minutes: 5, drill: null, notes: "Explain format: coaches pitch/hit for pace. 5 outs per 'inning' for more at-bats. Rotate positions every 3 innings." },
      { id: "s67", title: "Innings 1-3", minutes: 20, drill: null, notes: "Full scrimmage. Focus: backing up throws, cutoff positioning, communication on every ball, hustling. Coach pauses to teach." },
      { id: "s68", title: "Innings 4-6", minutes: 20, drill: null, notes: "Continue scrimmage. Focus: base running decisions, defensive positioning, relay throws, situations. Keep score but emphasize good plays." },
      { id: "s69", title: "Innings 7-9", minutes: 20, drill: null, notes: "Final innings with pressure. Focus: closing out close game, handling pressure, supporting teammates, playing until final out." },
      { id: "s70", title: "Post-Scrimmage Wrap-up", minutes: 10, drill: null, notes: "Highlight great plays. Season goals discussion. Each player shares one thing they did well. Positive feedback circle!" },
      { id: "s71", title: "Coach Message & Send-off", minutes: 10, drill: null, notes: "Fun + learning > perfection. Baseball = making mistakes and learning together. Excited for next practice!" },
    ]
  },
];
const MOCK_INVITES = [
  { id: "inv1", code: "HAWK-P-7F2X", role: "parent", uses_count: 3, max_uses: 20, expires_at: "2026-03-01", is_revoked: false },
  { id: "inv2", code: "HAWK-A-9K1M", role: "assistant_coach", uses_count: 1, max_uses: 2, expires_at: "2026-02-28", is_revoked: false },
];

const fmt = (iso) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtT = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/* ════════════════════════════════
   APP ROOT
════════════════════════════════ */
export default function App() {
  useEffect(() => { injectStyles(); }, []);

  const [screen, setScreen] = useState("launch");
  const [email, setEmail] = useState("coach@hawks.com");
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState(null);
  const [displayName, setDisplayName] = useState("Sarah Rivera");
  const [playerPhotos, setPlayerPhotos] = useState({}); // { playerId: photoUrl }
  const [isPro, setIsPro] = useState(false);

  const [activeTab, setActiveTab] = useState("home");
  const [subScreen, setSubScreen] = useState(null);
  const [subData, setSubData] = useState(null);

  const [rsvps, setRsvps] = useState({ e1: "yes", e3: "maybe" });
  const [messages, setMessages] = useState(INIT_MESSAGES);
  const [convList, setConvList] = useState(MOCK_CONVS);
  const [reactions, setReactions] = useState({});
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [drillCompletion, setDrillCompletion] = useState({});
  const [drillVideos, setDrillVideos] = useState({});
  const [settings, setSettings] = useState({ groupChatPosting: "everyone", allowParentDMs: true, quietHours: true });
  const [teamLogo, setTeamLogo] = useState(null);
  
  // Inbox item tracking
  const [handledRsvpEvents, setHandledRsvpEvents] = useState(new Set());
  const [handledDrills, setHandledDrills] = useState(new Set());
  const [planAttached, setPlanAttached] = useState(false);
  const [messagesViewed, setMessagesViewed] = useState(false);

  const [showPaywall, setShowPaywall] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [selectedPlanForEvent, setSelectedPlanForEvent] = useState(null);
  const [showCreateDrill, setShowCreateDrill] = useState(false);
  const [preselectedDrill, setPreselectedDrill] = useState(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  
  // Inbox modals
  const [showMessageNonResponders, setShowMessageNonResponders] = useState(false);
  const [messageNonRespondersData, setMessageNonRespondersData] = useState(null);
  const [showSendReminder, setShowSendReminder] = useState(false);
  const [sendReminderData, setSendReminderData] = useState(null);
  const [showAttachPlan, setShowAttachPlan] = useState(false);
  const [attachPlanData, setAttachPlanData] = useState(null);

  const isCoach = role === "head_coach" || role === "assistant_coach";
  const triggerPro = useCallback(() => { if (!isPro) { setShowPaywall(true); return false; } return true; }, [isPro]);
  const goSub = (s, d = null) => { setSubScreen(s); setSubData(d); };
  const goBack = () => { setSubScreen(null); setSubData(null); };

  // Auth flow
  if (screen === "launch") return <LaunchScreen onDone={() => setScreen("signin")} />;
  if (screen === "signin") return <SignInScreen email={email} setEmail={setEmail} onNext={() => setScreen("otp")} />;
  if (screen === "otp") return <OTPScreen email={email} otp={otp} setOtp={setOtp} onVerify={() => setScreen("roleSelect")} />;
  if (screen === "roleSelect") return <RoleSelectScreen onSelect={(r, n) => { setRole(r); setDisplayName(n); setScreen("joinTeam"); }} />;
  if (screen === "joinTeam") return <JoinTeamScreen role={role} onJoin={() => { setScreen("main"); setActiveTab(role === "player" ? "schedule" : "home"); }} />;

  // Sub-screens (full-page)
  if (subScreen === "event-detail") return (
    <div className="app-shell">
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
        <EventDetailScreen event={subData} rsvp={rsvps[subData.id]} onRSVP={s => setRsvps(p => ({ ...p, [subData.id]: s }))} onBack={goBack} isCoach={isCoach} isPro={isPro} triggerPro={triggerPro} role={role} displayName={displayName} />
      </div>
    </div>
  );
  if (subScreen === "chat") return (
    <div className="app-shell">
      <ChatScreen 
        conv={subData} 
        msgs={messages[subData.id] || []}
        reactions={reactions}
        setReactions={setReactions}
        canPost={role !== "player" && (subData.type === "direct" || settings.groupChatPosting === "everyone" || isCoach)} 
        onSend={(body, type) => {
          const now = new Date();
          const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const newMsg = { id: Date.now(), sender: displayName || "You", body, time: timeStr, sent: true, type: type || "text" };
          setMessages(p => ({ ...p, [subData.id]: [...(p[subData.id] || []), newMsg] }));
          setConvList(p => p.map(c => c.id === subData.id ? { ...c, preview: body.length > 40 ? body.substring(0,40)+'…' : body, time: "Just now", unread: 0 } : c));
        }}
        onOpen={() => setConvList(p => p.map(c => c.id === subData.id ? { ...c, unread: 0 } : c))}
        onBack={goBack} 
        onReport={() => setShowReport(true)}
        role={role}
        isCoach={isCoach}
        displayName={displayName}
      />
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
  if (subScreen === "player-detail") return (
    <div className="app-shell">
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
        <PlayerDetailScreen player={subData} isCoach={isCoach} onBack={goBack} drillCompletion={drillCompletion} role={role} displayName={displayName} playerPhotos={playerPhotos} setPlayerPhotos={setPlayerPhotos} />
      </div>
    </div>
  );
  if (subScreen === "plan-detail") return (
    <div className="app-shell">
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
        <PlanDetailScreen plan={subData} onBack={goBack} onUsePlan={(plan) => { goBack(); setSelectedPlanForEvent(plan); setShowCreateEvent(true); }} />
      </div>
    </div>
  );
  if (subScreen === "invites") return (
    <div className="app-shell">
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
        <InviteScreen invites={MOCK_INVITES} onBack={goBack} />
      </div>
    </div>
  );

  // Tabs config
  const TABS = isCoach
    ? [
        { key: "home", icon: "🏠", label: "Home" },
        { key: "inbox", icon: "📋", label: "Inbox" },
        { key: "schedule", icon: "📅", label: "Schedule" },
        { key: "plans", icon: "📝", label: "Plans" },
        { key: "drills", icon: "⚾", label: "Drills" },
        { key: "messages", icon: "💬", label: "Chat" },
        { key: "roster", icon: "👥", label: "Roster" },
        { key: "settings", icon: "⚙️", label: "Settings" },
      ]
    : role === "player"
    ? [
        { key: "schedule", icon: "📅", label: "Schedule" },
        { key: "drills", icon: "⚾", label: "Drills" },
        { key: "messages", icon: "💬", label: "Chat" },
        { key: "roster", icon: "👥", label: "Roster" },
        { key: "settings", icon: "⚙️", label: "Settings" },
      ]
    : [
        { key: "home", icon: "🏠", label: "Home" },
        { key: "schedule", icon: "📅", label: "Schedule" },
        { key: "drills", icon: "⚾", label: "Drills" },
        { key: "messages", icon: "💬", label: "Chat" },
        { key: "roster", icon: "👥", label: "Roster" },
        { key: "settings", icon: "⚙️", label: "Settings" },
      ];

  const unread = convList.reduce((s, c) => s + (c.unread || 0), 0);

  const renderTab = () => {
    switch (activeTab) {
      case "home": return <HomeTab role={role} displayName={displayName} isPro={isPro} isCoach={isCoach} rsvps={rsvps} events={events} drills={MOCK_DRILLS} drillCompletion={drillCompletion} setActiveTab={setActiveTab} onEvent={e => goSub("event-detail", e)} onCreateEvent={() => setShowCreateEvent(true)} onCreateDrill={(drill) => { if (triggerPro()) { setPreselectedDrill(drill || null); setShowCreateDrill(true); } }} onInvite={() => { if (isCoach || triggerPro()) goSub("invites"); }} setIsPro={setIsPro} triggerPro={triggerPro} teamLogo={teamLogo} playerPhotos={playerPhotos} />;
      case "inbox": return <InboxTab 
        isPro={isPro} 
        role={role} 
        setShowPaywall={setShowPaywall} 
        events={events} 
        rsvps={rsvps} 
        drills={MOCK_DRILLS}
        drillCompletion={drillCompletion}
        handledRsvpEvents={handledRsvpEvents}
        handledDrills={handledDrills}
        planAttached={planAttached}
        messagesViewed={messagesViewed}
        onMessageNonResponders={(event) => {
          // Find non-responders for this event
          const allPlayers = MOCK_ROSTER.filter(p => p.role === 'player');
          const responders = []; // In real app, would check who has RSVP'd
          const nonResponders = allPlayers.filter(p => !responders.includes(p.id));
          const nonResponderNames = nonResponders.map(p => `${p.parent1Name || p.name}`);
          setMessageNonRespondersData({ event, nonResponders: nonResponderNames });
          setShowMessageNonResponders(true);
        }}
        onSendReminder={(drill) => {
          // Find assigned players for this drill
          const assignedPlayers = MOCK_ROSTER.filter(p => p.role === 'player').slice(0, 3); // Mock: first 3 players
          setSendReminderData({ drill, assignedPlayers });
          setShowSendReminder(true);
        }}
        onViewMessages={() => {
          setMessagesViewed(true);
          setActiveTab('messages');
        }}
        onAttachPlan={() => {
          // Mock Thursday practice event
          const thursdayPractice = { 
            id: 'thursday-practice', 
            title: 'Thursday Practice', 
            starts_at: '2026-02-26T17:00:00' 
          };
          setAttachPlanData({ event: thursdayPractice });
          setShowAttachPlan(true);
        }}
      />;
      case "schedule": return <ScheduleTab events={events} rsvps={rsvps} isCoach={isCoach} role={role} onEvent={e => goSub("event-detail", e)} onCreateEvent={() => setShowCreateEvent(true)} />;
      case "plans": return <PracticeTab isPro={isPro} role={role} setShowPaywall={setShowPaywall} plans={MOCK_PLANS} onPlan={p => goSub("plan-detail", p)} onUsePlan={(plan) => { setSelectedPlanForEvent(plan); setShowCreateEvent(true); }} />;
      case "drills": return <DrillsTab isCoach={isCoach} role={role} isPro={isPro} setShowPaywall={setShowPaywall} drills={MOCK_DRILLS} coachDrills={MOCK_COACH_DRILLS} drillCompletion={drillCompletion} setDrillCompletion={setDrillCompletion} drillVideos={drillVideos} setDrillVideos={setDrillVideos} onFeedback={d => { setFeedbackTarget(d); setShowFeedback(true); }} onCreateDrill={(drill) => { if (triggerPro()) { setPreselectedDrill(drill || null); setShowCreateDrill(true); } }} />;
      case "messages": return <MessagesTab convs={convList} setConvList={setConvList} isCoach={isCoach} roster={MOCK_ROSTER} onConv={c => goSub("chat", c)} role={role} messages={messages} setMessages={setMessages} displayName={displayName} />;
      case "roster": return <RosterTab roster={MOCK_ROSTER} isCoach={isCoach} onPlayer={p => goSub("player-detail", p)} onAddPlayer={() => setShowAddPlayer(true)} playerPhotos={playerPhotos} />;
      case "settings": return <SettingsTab isCoach={isCoach} role={role} isPro={isPro} setIsPro={setIsPro} settings={settings} setSettings={setSettings} setShowPaywall={setShowPaywall} displayName={displayName} onSignOut={() => setScreen("signin")} teamLogo={teamLogo} setTeamLogo={setTeamLogo} playerPhotos={playerPhotos} setPlayerPhotos={setPlayerPhotos} />;
      default: return null;
    }
  };

  return (
    <div className="app-shell">
      <div className="page-content">{renderTab()}</div>
      <div className="bottom-nav">
        {TABS.map(t => (
          <div key={t.key} className={`tab-item ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key)}>
            <div className="tab-icon-wrap">
              <span className="tab-icon">{t.icon}</span>
              {t.key === "messages" && unread > 0 && <span className="badge">{unread}</span>}
              {t.key === "inbox" && isCoach && !isPro && <span className="badge" style={{ background: "var(--gold)", color: "var(--navy)" }}>★</span>}
            </div>
            <span className="tab-label">{t.label}</span>
          </div>
        ))}
      </div>
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} onUpgrade={() => { setIsPro(true); setShowPaywall(false); }} role={role} />}
      {showCreateEvent && <CreateEventModal isPro={isPro} setShowPaywall={setShowPaywall} preselectedPlan={selectedPlanForEvent} onClose={() => { setShowCreateEvent(false); setSelectedPlanForEvent(null); }} onSave={ev => { setEvents(p => [...p, ev]); setShowCreateEvent(false); setSelectedPlanForEvent(null); }} />}
      {showCreateDrill && <CreateDrillModal preselectedDrill={preselectedDrill} onClose={() => { setShowCreateDrill(false); setPreselectedDrill(null); }} roster={MOCK_ROSTER} setDrillVideos={setDrillVideos} />}
      {showAddPlayer && <AddPlayerModal onClose={() => setShowAddPlayer(false)} onSave={(player) => { alert(`✅ ${player.name} added to roster!`); setShowAddPlayer(false); }} />}
      {showFeedback && feedbackTarget && <FeedbackModal drill={feedbackTarget} onClose={() => setShowFeedback(false)} />}
      
      {/* Inbox Modals */}
      {showMessageNonResponders && messageNonRespondersData && (
        <MessageNonRespondersModal 
          event={messageNonRespondersData.event}
          nonResponders={messageNonRespondersData.nonResponders}
          onClose={() => setShowMessageNonResponders(false)}
          onSend={(message) => {
            // Mark this event as handled
            setHandledRsvpEvents(prev => new Set([...prev, messageNonRespondersData.event.id]));
            alert(`✅ Message sent to ${messageNonRespondersData.nonResponders.length} parents!`);
          }}
        />
      )}
      {showSendReminder && sendReminderData && (
        <SendReminderModal 
          drill={sendReminderData.drill}
          assignedPlayers={sendReminderData.assignedPlayers}
          onClose={() => setShowSendReminder(false)}
          onSend={(message) => {
            // Mark this drill as handled
            setHandledDrills(prev => new Set([...prev, sendReminderData.drill.id]));
            alert(`✅ Reminder sent to ${sendReminderData.assignedPlayers.length} players!`);
          }}
        />
      )}
      {showAttachPlan && attachPlanData && (
        <AttachPlanModal 
          event={attachPlanData.event}
          plans={MOCK_PLANS}
          onClose={() => setShowAttachPlan(false)}
          onAttach={(planId) => {
            const plan = MOCK_PLANS.find(p => p.id === planId);
            setPlanAttached(true);
            alert(`✅ "${plan.title}" attached to ${attachPlanData.event.title}!`);
          }}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════
   AUTH SCREENS
════════════════════════════════ */
function Logo() {
  return (
    <div className="auth-logo">
      <img 
        src="data:image/jpeg;base64,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" 
        alt="CoachConnectPro" 
        style={{ width: 200, height: 200, marginBottom: 20, display: "block", marginLeft: "auto", marginRight: "auto" }} 
      />
      <h1>Coach Connect Pro</h1>
      <p>Youth Baseball Platform</p>
    </div>
  );
}

/* ════════════════════════════════
   AUTH SCREENS
════════════════════════════════ */

/* ════════════════════════════════
   LAUNCH SCREEN
════════════════════════════════ */
function LaunchScreen({ onDone }) {
  const [phase, setPhase] = React.useState("in");

  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 200);
    const t2 = setTimeout(() => setPhase("out"), 2800);
    const t3 = setTimeout(() => onDone(), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const leaving = phase === "out";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#070e1c",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
      transition: "opacity 0.6s ease",
      opacity: leaving ? 0 : 1,
    }}>
      {/* Background decorations */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 340, height: 340,
          transform: "translate(-50%, -52%) rotate(45deg)",
          border: "1px solid rgba(244,128,26,0.10)",
          borderRadius: 8,
          animation: "launchDiamondPulse 3s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 480, height: 480,
          transform: "translate(-50%, -52%) rotate(45deg)",
          border: "1px solid rgba(244,128,26,0.06)",
          borderRadius: 8,
          animation: "launchDiamondPulse 3s ease-in-out infinite 0.4s",
        }} />
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            top: "-10%", left: "50%",
            width: 1,
            height: "70%",
            background: `linear-gradient(to bottom, rgba(244,128,26,${0.04 + (i % 3) * 0.02}), transparent)`,
            transform: `translateX(-50%) rotate(${-35 + i * 10}deg)`,
            transformOrigin: "top center",
            animation: `launchRay 4s ease-in-out infinite ${i * 0.3}s`,
          }} />
        ))}
        <div style={{
          position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "140%", height: 220,
          background: "radial-gradient(ellipse at 50% 100%, rgba(26,61,46,0.5) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 200,
          background: "linear-gradient(to bottom, rgba(7,14,28,0.8), transparent)",
        }} />
      </div>

      {/* Spinning dashed ring */}
      <div style={{
        position: "absolute",
        width: 200, height: 200,
        borderRadius: "50%",
        border: "2px dashed rgba(244,128,26,0.15)",
        animation: "launchSpin 20s linear infinite",
        top: "50%", left: "50%",
        transform: "translate(-50%, -55%)",
      }} />

      {/* Main content */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        position: "relative", zIndex: 2,
        transform: phase === "in" ? "translateY(30px)" : "translateY(0)",
        opacity: phase === "in" ? 0 : 1,
        transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* Logo */}
        <div style={{
          marginBottom: 16,
          animation: "launchFloat 3s ease-in-out infinite",
          filter: "drop-shadow(0 0 30px rgba(244,128,26,0.4)) drop-shadow(0 0 60px rgba(37,99,235,0.3))",
        }}>
          <img
            src="data:image/jpeg;base64,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"
            alt="CoachConnectPro"
            style={{
              width: 140,
              height: 140,
              borderRadius: 32,
              objectFit: "cover",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          />
        </div>

        {/* Subtitle */}
        <div style={{
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 42,
          fontWeight: 900,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#ffffff",
          lineHeight: 1,
          textShadow: "0 0 40px rgba(244,128,26,0.4), 0 2px 20px rgba(0,0,0,0.8)",
          opacity: phase === "in" ? 0 : 1,
          transform: phase === "in" ? "translateY(10px)" : "translateY(0)",
          transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s",
        }}>
          Youth Baseball Platform
        </div>

        {/* PRO pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 10,
          opacity: phase === "in" ? 0 : 1,
          transition: "all 0.7s ease 0.3s",
        }}>
          <div style={{ height: 1, width: 40, background: "linear-gradient(to right, transparent, rgba(244,128,26,0.6))" }} />
          <div style={{
            background: "linear-gradient(135deg, #f5c518, #f4801a)",
            color: "#070e1c",
            fontSize: 11, fontWeight: 900,
            letterSpacing: 3,
            padding: "4px 14px",
            borderRadius: 20,
            textTransform: "uppercase",
            boxShadow: "0 0 20px rgba(244,128,26,0.5)",
          }}>Pro</div>
          <div style={{ height: 1, width: 40, background: "linear-gradient(to left, transparent, rgba(244,128,26,0.6))" }} />
        </div>

        {/* Tagline */}
        <div style={{
          marginTop: 16,
          fontSize: 13,
          color: "rgba(240,236,227,0.55)",
          letterSpacing: 3,
          textTransform: "uppercase",
          fontFamily: "Barlow Condensed, sans-serif",
          fontWeight: 600,
          opacity: phase === "in" ? 0 : 1,
          transition: "all 0.7s ease 0.45s",
        }}>
          Teach the Game · Coach the Heart
        </div>
      </div>

      {/* Loading bar */}
      <div style={{
        position: "absolute", bottom: 60,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        opacity: phase === "in" ? 0 : 1,
        transition: "opacity 0.5s ease 0.6s",
      }}>
        <div style={{ width: 120, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: "linear-gradient(90deg, #f4801a, #f5c518)",
            animation: "launchBar 2.4s ease-in-out forwards",
            boxShadow: "0 0 8px rgba(244,128,26,0.8)",
          }} />
        </div>
        <div style={{ fontSize: 10, color: "rgba(240,236,227,0.3)", letterSpacing: 3, textTransform: "uppercase", fontFamily: "Barlow Condensed, sans-serif" }}>
          Loading...
        </div>
      </div>

      <style>{`
        @keyframes launchFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes launchSpin {
          from { transform: translate(-50%, -55%) rotate(0deg); }
          to { transform: translate(-50%, -55%) rotate(360deg); }
        }
        @keyframes launchBar {
          0% { width: 0%; }
          30% { width: 40%; }
          70% { width: 75%; }
          100% { width: 100%; }
        }
        @keyframes launchDiamondPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes launchRay {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function SignInScreen({ email, setEmail, onNext }) {
  return (
    <div className="auth-outer">
    <div className="auth-screen">
      <Logo />
      <div className="auth-card">
        <h2>Welcome Back</h2>
        <p>Enter your email to receive a sign-in code</p>
        <div className="input-group">
          <label>Email Address</label>
          <input className="input-field" type="email" placeholder="coach@team.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={onNext}>Continue →</button>
        <p style={{ textAlign: "center", marginTop: 14, marginBottom: 0, fontSize: 11, color: "var(--gray1)" }}>By continuing, you agree to our{" "}
          <span style={{ color: "var(--orange)", cursor: "pointer", textDecoration: "underline" }} onClick={() => window.open("https://coachconnectpro.com/terms", "_blank")}>Terms of Service</span>
          {" "}&amp;{" "}
          <span style={{ color: "var(--orange)", cursor: "pointer", textDecoration: "underline" }} onClick={() => window.open("https://coachconnectpro.com/privacy", "_blank")}>Privacy Policy</span>
        </p>
      </div>
    </div>
    </div>
  );
}

function OTPScreen({ email, otp, setOtp, onVerify }) {
  return (
    <div className="auth-outer">
    <div className="auth-screen">
      <Logo />
      <div className="auth-card">
        <h2>Check Your Email</h2>
        <p>We sent a 6-digit code to <strong style={{ color: "var(--orange)" }}>{email}</strong></p>
        <div className="input-group">
          <label>Verification Code</label>
          <input className="input-field" type="number" placeholder="123456" value={otp} onChange={e => setOtp(e.target.value)} style={{ textAlign: "center", fontSize: 26, letterSpacing: 8, fontWeight: 900 }} />
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={onVerify}>Verify →</button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span style={{ fontSize: 13, color: "var(--orange)", cursor: "pointer" }}>Resend code</span>
        </div>
      </div>
    </div>
    </div>
  );
}

function RoleSelectScreen({ onSelect }) {
  const [sel, setSel] = useState(null);
  const [name, setName] = useState("");
  const roles = [
    { key: "head_coach", icon: "📋", label: "Head Coach", desc: "Lead the team" },
    { key: "assistant_coach", icon: "🧢", label: "Asst. Coach", desc: "Support staff" },
    { key: "parent", icon: "👨‍👦", label: "Parent", desc: "Track my player" },
    { key: "player", icon: "⚾", label: "Player", desc: "My drills & games" },
  ];
  return (
    <div className="auth-outer">
    <div className="auth-screen">
      <Logo />
      <div className="auth-card">
        <h2>Select Your Role</h2>
        <p>You can update this later in Settings</p>
        <div className="role-grid">
          {roles.map(r => (
            <div key={r.key} className={`role-card ${sel === r.key ? "selected" : ""}`} onClick={() => setSel(r.key)}>
              <div className="role-icon">{r.icon}</div>
              <h3>{r.label}</h3>
              <p>{r.desc}</p>
            </div>
          ))}
        </div>
        <div className="input-group" style={{ marginTop: 16 }}>
          <label>Your Name</label>
          <input className="input-field" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 4 }} disabled={!sel || !name} onClick={() => onSelect(sel, name)}>Continue →</button>
      </div>
    </div>
    </div>
  );
}

function JoinTeamScreen({ role, onJoin }) {
  const [mode, setMode] = useState("join");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const isCoach = role === "head_coach" || role === "assistant_coach";
  return (
    <div className="auth-outer">
    <div className="auth-screen">
      <Logo />
      <div className="auth-card">
        <h2>{mode === "create" ? "Create Your Team" : "Join a Team"}</h2>
        {isCoach && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button className={`btn btn-sm ${mode === "join" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setMode("join")}>Join Team</button>
            <button className={`btn btn-sm ${mode === "create" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setMode("create")}>Create Team</button>
          </div>
        )}
        {mode === "join" ? (
          <><p>Enter the invite code from your coach</p>
          <div className="input-group">
            <label>Invite Code</label>
            <input className="input-field" placeholder="HAWK-P-7F2X" value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ textAlign: "center", letterSpacing: 4, fontWeight: 700, fontSize: 18 }} />
          </div></>
        ) : (
          <><p>Start your team — invite players and parents after setup</p>
          <div className="input-group">
            <label>Team Name</label>
            <input className="input-field" placeholder="Riverside Hawks 12U" value={name} onChange={e => setName(e.target.value)} />
          </div></>
        )}
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={onJoin}>{mode === "create" ? "Create Team →" : "Join Team →"}</button>
      </div>
    </div>
    </div>
  );
}

/* ════════════════════════════════
   MAIN TABS
════════════════════════════════ */
function HomeTab({ role, displayName, isPro, isCoach, rsvps, events, drills, drillCompletion, setActiveTab, onEvent, onCreateEvent, onCreateDrill, onInvite, setIsPro, triggerPro, teamLogo, playerPhotos }) {
  const now = new Date();
  const upcoming = events.filter(e => new Date(e.starts_at) > now).slice(0, 2);
  const pending = drills.filter(d => (drillCompletion[d.id] ? "completed" : d.status) === "pending").length;
  const overdue = drills.filter(d => (drillCompletion[d.id] ? "completed" : d.status) === "overdue").length;
  const done = drills.filter(d => (drillCompletion[d.id] ? "completed" : d.status) === "completed").length;
  const noRsvp = events.filter(e => !rsvps[e.id] && new Date(e.starts_at) > now).length;
  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const headerStyle = teamLogo ? {
    backgroundImage: `linear-gradient(135deg, rgba(17, 31, 60, 0.75), rgba(26, 47, 82, 0.70)), url(${teamLogo})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  } : {};

  // PARENT VIEW - Show "My Players"
  if (role === "parent") {
    // Find players where this parent is parent1 or parent2
    // For demo: if displayName is "Sarah Rivera", show Jake Rivera
    const myPlayers = MOCK_ROSTER.filter(p => 
      p.role === "player" && 
      (p.parent1Name === displayName || p.parent2Name === displayName)
    );
    
    return (
      <div>
        <div className="home-header" style={headerStyle}>
          <div className="home-greeting">{greet}</div>
          <div className="home-name">{displayName.split(" ")[0]}</div>
          <div className="team-name">🦅 {MOCK_TEAM.name}</div>
        </div>
        
        {/* My Players Section */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">My Players</span>
            <span style={{ fontSize: 13, color: "var(--gray1)" }}>{myPlayers.length} {myPlayers.length === 1 ? 'player' : 'players'}</span>
          </div>
          
          {myPlayers.map(player => {
            const playerEvents = upcoming.filter(e => true); // All team events
            const playerDrills = drills.filter(d => true); // In production, filter by player
            const playerPending = playerDrills.filter(d => (drillCompletion[d.id] ? "completed" : d.status) === "pending").length;
            const playerOverdue = playerDrills.filter(d => (drillCompletion[d.id] ? "completed" : d.status) === "overdue").length;
            const playerNoRsvp = playerEvents.filter(e => !rsvps[e.id]).length;
            
            return (
              <div key={player.id} style={{ marginBottom: 16 }}>
                {/* Player Header Card */}
                <div className="card" style={{ marginBottom: 10, background: "var(--navy3)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    {playerPhotos?.[player.id] ? (
                      <img 
                        src={playerPhotos[player.id]} 
                        alt={player.name}
                        style={{ 
                          width: 48, 
                          height: 48, 
                          borderRadius: 12, 
                          objectFit: "cover",
                          border: "2px solid rgba(66,153,225,0.3)"
                        }} 
                      />
                    ) : (
                      <div style={{ fontSize: 48, lineHeight: 1 }}>{player.picture}</div>
                    )}
                    <div className="player-num" style={{ fontSize: 20 }}>#{player.number}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "Barlow Condensed", fontSize: 20, fontWeight: 900 }}>{player.name}</div>
                      <div style={{ fontSize: 12, color: "var(--gray1)" }}>
                        {player.positions.join(", ")} • Bats {player.bats} • Throws {player.throws}
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick Stats Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    <div style={{ background: playerNoRsvp > 0 ? "rgba(229,62,62,0.15)" : "rgba(56,161,105,0.15)", borderRadius: 8, padding: 8, textAlign: "center" }}>
                      <div style={{ fontFamily: "Barlow Condensed", fontSize: 22, fontWeight: 900, color: playerNoRsvp > 0 ? "var(--red)" : "var(--green)" }}>{playerNoRsvp}</div>
                      <div style={{ fontSize: 10, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 0.5 }}>RSVP Needed</div>
                    </div>
                    <div style={{ background: playerPending > 0 ? "rgba(244,128,26,0.15)" : "rgba(56,161,105,0.15)", borderRadius: 8, padding: 8, textAlign: "center" }}>
                      <div style={{ fontFamily: "Barlow Condensed", fontSize: 22, fontWeight: 900, color: playerPending > 0 ? "var(--orange)" : "var(--green)" }}>{playerPending}</div>
                      <div style={{ fontSize: 10, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 0.5 }}>Drills Pending</div>
                    </div>
                    <div style={{ background: playerOverdue > 0 ? "rgba(229,62,62,0.15)" : "rgba(56,161,105,0.15)", borderRadius: 8, padding: 8, textAlign: "center" }}>
                      <div style={{ fontFamily: "Barlow Condensed", fontSize: 22, fontWeight: 900, color: playerOverdue > 0 ? "var(--red)" : "var(--green)" }}>{playerOverdue}</div>
                      <div style={{ fontSize: 10, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 0.5 }}>Overdue</div>
                    </div>
                  </div>
                </div>
                
                {/* Upcoming Events for this player */}
                {playerEvents.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>Upcoming Events</div>
                    {playerEvents.slice(0, 2).map(e => (
                      <div key={e.id} className="card" style={{ marginBottom: 6, padding: 10, cursor: "pointer" }} onClick={() => onEvent(e)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ fontSize: 28 }}>{e.type === "game" ? "⚾" : "🏃"}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{e.title}</div>
                            <div style={{ fontSize: 12, color: "var(--gray1)" }}>
                              📅 {fmt(e.starts_at)} • {fmtT(e.starts_at)}
                            </div>
                          </div>
                          {rsvps[e.id] ? (
                            <span className={`status-pill pill-${rsvps[e.id]}`} style={{ fontSize: 10 }}>{rsvps[e.id].toUpperCase()}</span>
                          ) : (
                            <span className="status-pill pill-pending" style={{ fontSize: 10 }}>RSVP</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Assigned Drills */}
                {playerDrills.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>This Week's Drills</div>
                    {playerDrills.slice(0, 2).map(d => (
                      <div key={d.id} className="card" style={{ marginBottom: 6, padding: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{d.title}</div>
                            <div style={{ fontSize: 11, color: "var(--gray1)" }}>Due {d.due_at}</div>
                          </div>
                          <span className={`status-pill pill-${drillCompletion[d.id] ? "completed" : d.status}`} style={{ fontSize: 10 }}>{drillCompletion[d.id] ? "completed" : d.status}</span>
                        </div>
                      </div>
                    ))}
                    <div 
                      style={{ fontSize: 13, color: "var(--orange)", textAlign: "center", marginTop: 8, cursor: "pointer", fontWeight: 600 }}
                      onClick={() => setActiveTab("drills")}
                    >
                      View All Drills →
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {myPlayers.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">👨‍👩‍👧</div>
              <h3>No Players Found</h3>
              <p>Contact your coach to link your player(s) to your account.</p>
            </div>
          )}
        </div>
        
        {/* Quick Actions for Parents */}
        <div className="section">
          <div className="section-header"><span className="section-title">Quick Actions</span></div>
          <div className="quick-actions">
            <div className="quick-btn" onClick={() => setActiveTab("schedule")}><span className="qb-icon">📅</span><span className="qb-text">Full Schedule</span></div>
            <div className="quick-btn" onClick={() => setActiveTab("drills")}><span className="qb-icon">⚾</span><span className="qb-text">View Drills</span></div>
            <div className="quick-btn" onClick={() => setActiveTab("messages")}><span className="qb-icon">💬</span><span className="qb-text">Messages</span></div>
          </div>
        </div>
      </div>
    );
  }

  // COACH/PLAYER VIEW - Original view
  return (
    <div>
      <div className="home-header" style={headerStyle}>
        <div className="home-greeting">{greet}</div>
        <div className="home-name">{displayName.split(" ")[0]}</div>
        <div className="team-name">🦅 {MOCK_TEAM.name} {isPro && <span className="pro-badge">PRO</span>}</div>
      </div>
      <div className="stats-row">
        <div className={`stat-card ${noRsvp > 0 ? "alert" : "success"}`}><div className="stat-num">{noRsvp}</div><div className="stat-label">RSVPs</div></div>
        <div className={`stat-card ${pending > 0 ? "highlight" : "success"}`}><div className="stat-num">{pending}</div><div className="stat-label">Pending</div></div>
        <div className={`stat-card ${overdue > 0 ? "alert" : "success"}`}><div className="stat-num">{overdue}</div><div className="stat-label">Overdue</div></div>
        <div className="stat-card success"><div className="stat-num">{done}</div><div className="stat-label">Done ✓</div></div>
      </div>
      <div className="section">
        <div className="section-header"><span className="section-title">This Week</span><span style={{ fontSize: 13, color: "var(--orange)", cursor: "pointer" }} onClick={() => setActiveTab("schedule")}>All →</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {upcoming.map(e => (
            <div key={e.id} className={`event-card ${e.type}`} onClick={() => onEvent(e)} style={{ marginBottom: 0, padding: 10 }}>
              <span className={`event-type-tag tag-${e.type}`} style={{ fontSize: 10, padding: "2px 6px" }}>{e.type === "game" ? "⚾ Game" : "🏃 Practice"}</span>
              <div className="event-title" style={{ fontSize: 14, marginTop: 6, marginBottom: 6 }}>{e.title}</div>
              <div className="event-meta" style={{ fontSize: 11, marginBottom: 3 }}>📅 {fmt(e.starts_at)}</div>
              <div className="event-meta" style={{ fontSize: 11, marginBottom: 3 }}>⏰ {fmtT(e.starts_at)}</div>
              <div className="event-meta" style={{ fontSize: 11, marginBottom: 6 }}>📍 {e.location}</div>
              {!isCoach && (
                <div style={{ marginTop: 8 }}>
                  {rsvps[e.id] ? <span className={`status-pill pill-${rsvps[e.id]}`} style={{ fontSize: 10 }}>{rsvps[e.id].toUpperCase()}</span> : <span className="status-pill pill-pending" style={{ fontSize: 10 }}>RSVP</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="section">
        <div className="section-header"><span className="section-title">Quick Actions</span></div>
        <div className="quick-actions">
          <div className="quick-btn" onClick={onCreateEvent}><span className="qb-icon">📅</span><span className="qb-text">New Event</span></div>
          {isCoach ? (
            <>
              <div className="quick-btn pro-action" onClick={onCreateDrill}><span className="qb-icon">⚾</span><span className="qb-text">Assign Drills {!isPro && "⭐"}</span></div>
              <div className="quick-btn pro-action" onClick={onInvite}><span className="qb-icon">🔗</span><span className="qb-text">Invites {!isPro && !isCoach && "⭐"}</span></div>
            </>
          ) : (
            <>
              <div className="quick-btn" onClick={() => setActiveTab("drills")}><span className="qb-icon">⚾</span><span className="qb-text">My Drills</span></div>
            </>
          )}
        </div>
      </div>
      {!isPro && role === "head_coach" && (
        <div className="section">
          <div style={{ background: "linear-gradient(135deg, rgba(245,197,24,0.08), rgba(244,128,26,0.12))", border: "1.5px solid rgba(245,197,24,0.3)", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>⭐</span>
              <div><div style={{ fontFamily: "Barlow Condensed", fontSize: 18, fontWeight: 800 }}>Upgrade to Pro</div><div style={{ fontSize: 13, color: "var(--gray1)" }}>Drills, Practice Plans, Coach Inbox & more</div></div>
            </div>
            <button className="btn btn-pro" style={{ width: "100%" }} onClick={() => setIsPro(true)}>Start 7-Day Free Trial →</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InboxTab({ isPro, role, setShowPaywall, events, rsvps, drills, onMessageNonResponders, onSendReminder, onViewMessages, onAttachPlan, handledRsvpEvents, handledDrills, planAttached, messagesViewed, drillCompletion }) {
  if (!isPro) return (
    <div>
      <div className="top-header"><h2>Coach Inbox</h2></div>
      <div className="empty-state" style={{ paddingTop: 60 }}>
        <div className="empty-icon">📋</div>
        <h3>Coach Inbox</h3>
        <p style={{ marginBottom: 24 }}>Your to-do list: missing RSVPs, overdue drills, events needing a plan, and new DMs — all in one place.</p>
        <span className="pro-badge" style={{ fontSize: 13, padding: "4px 12px", margin: "0 auto 16px", display: "inline-flex" }}>PRO FEATURE</span><br />
        {role === "head_coach" && <button className="btn btn-pro" style={{ marginTop: 12 }} onClick={() => setShowPaywall(true)}>Upgrade to Pro</button>}
        {role === "assistant_coach" && <p style={{ fontSize: 13, color: "var(--gray1)", marginTop: 12 }}>Ask your Head Coach to upgrade</p>}
      </div>
    </div>
  );
  
  // Filter out handled items
  const noRsvp = events.filter(e => !rsvps[e.id] && new Date(e.starts_at) > new Date() && !handledRsvpEvents.has(e.id));
  const overdue = drills.filter(d => (drillCompletion[d.id] ? "completed" : d.status) === "overdue" && !handledDrills.has(d.id));
  const showNewMessages = !messagesViewed;
  const showPlanNeeded = !planAttached;
  
  // Calculate total items
  const totalItems = noRsvp.length + overdue.length + (showNewMessages ? 1 : 0) + (showPlanNeeded ? 1 : 0);
  
  return (
    <div>
      <div className="top-header"><h2>Coach Inbox</h2><span style={{ fontSize: 13, color: "var(--gray1)" }}>{totalItems} {totalItems === 1 ? 'item' : 'items'}</span></div>
      <div style={{ padding: 16 }}>
        {noRsvp.map(e => (
          <div key={e.id} className="inbox-item" onClick={() => onMessageNonResponders(e)} style={{ cursor: 'pointer' }}>
            <div className="inbox-icon orange">🗓️</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="inbox-title">RSVP Needed</div>
              <div className="inbox-sub">{e.title} · {fmt(e.starts_at)}</div>
              <div className="inbox-action">Message non-responders →</div>
            </div>
          </div>
        ))}
        {overdue.map(d => (
          <div key={d.id} className="inbox-item" onClick={() => onSendReminder(d)} style={{ cursor: 'pointer' }}>
            <div className="inbox-icon red">⚾</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="inbox-title">Overdue Drill</div>
              <div className="inbox-sub">{d.title} · Due {d.due_at}</div>
              <div className="inbox-action">Send reminder →</div>
            </div>
          </div>
        ))}
        {showNewMessages && (
          <div className="inbox-item" onClick={onViewMessages} style={{ cursor: 'pointer' }}>
            <div className="inbox-icon blue">💬</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="inbox-title">2 New Direct Messages</div>
              <div className="inbox-sub">Coach Davis, Sarah Rivera</div>
              <div className="inbox-action">View messages →</div>
            </div>
          </div>
        )}
        {showPlanNeeded && (
          <div className="inbox-item" onClick={onAttachPlan} style={{ cursor: 'pointer' }}>
            <div className="inbox-icon green">📝</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="inbox-title">Thursday Practice Needs a Plan</div>
              <div className="inbox-sub">Feb 23 · 5:00 PM — No plan attached</div>
              <div className="inbox-action">Attach practice plan →</div>
            </div>
          </div>
        )}
        
        {totalItems === 0 && (
          <div className="empty-state" style={{ paddingTop: 60 }}>
            <div className="empty-icon">✅</div>
            <h3>All Caught Up!</h3>
            <p>No pending items in your inbox.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleTab({ events, rsvps, isCoach, role, onEvent, onCreateEvent }) {
  return (
    <div>
      <div className="top-header">
        <h2>Schedule</h2>
        {isCoach && <button className="btn btn-primary btn-sm" onClick={onCreateEvent}>+ Event</button>}
      </div>
      <div style={{ padding: 16 }}>
        {events.map(e => (
          <div key={e.id} className={`event-card ${e.type}`} onClick={() => onEvent(e)}>
            <span className={`event-type-tag tag-${e.type}`}>{e.type === "game" ? "⚾ Game" : "🏃 Practice"}</span>
            <div className="event-title">{e.title}</div>
            {e.opponent && <div style={{ fontSize: 13, color: "var(--orange)", fontWeight: 600 }}>vs. {e.opponent}</div>}
            <div className="event-meta">📅 {fmt(e.starts_at)} · {fmtT(e.starts_at)}</div>
            <div className="event-meta">📍 {e.location}</div>
            <div className="event-footer">
              {!isCoach && (rsvps[e.id] ? <span className={`status-pill pill-${rsvps[e.id]}`}>{rsvps[e.id].toUpperCase()}</span> : <span className="status-pill pill-pending">RSVP Needed</span>)}
              <span style={{ fontSize: 13, color: "var(--orange)" }}>Details →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PracticeTab({ isPro, role, setShowPaywall, plans, onPlan, onUsePlan }) {
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  
  if (!isPro) return (
    <div>
      <div className="top-header"><h2>Practice Plans</h2></div>
      <div className="empty-state" style={{ paddingTop: 60 }}>
        <div className="empty-icon">📋</div>
        <h3>Practice Plan Library</h3>
        <p style={{ marginBottom: 24 }}>
          {role === "head_coach" || role === "assistant_coach"
            ? "Access 10 complete practice plans (85-95 minutes each) designed by coaches. Includes warm-ups, drills, competitions, and cool-downs with coaching notes."
            : "Your team's practice plans are available with a Pro team membership. Ask your coach to upgrade."}
        </p>
        {role === "head_coach" && <button className="btn btn-pro" onClick={() => setShowPaywall(true)}>Upgrade to Pro ⭐</button>}
        {role === "assistant_coach" && <p style={{ fontSize: 13, color: "var(--gray1)" }}>Ask your Head Coach to upgrade to Pro</p>}
        {(role === "parent" || role === "player") && (
          <div style={{ background: "rgba(244,128,26,0.08)", border: "1px solid rgba(244,128,26,0.2)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--gray1)" }}>
            🔒 Team membership required
          </div>
        )}
      </div>
    </div>
  );
  return (
    <div>
      <div className="top-header"><h2>Practice Plans</h2><button className="btn btn-primary btn-sm" onClick={() => setShowCreatePlan(true)}>+ New Plan</button></div>
      <div style={{ padding: 16 }}>
        {plans.map(p => (
          <div key={p.id} className="plan-template-card" onClick={() => onPlan(p)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div className="card-title">{p.title}</div>
              <span className="plan-duration">⏱ {p.duration}m</span>
            </div>
            {p.description && <div style={{ fontSize: 13, color: "var(--gray1)", marginBottom: 10, lineHeight: 1.4 }}>{p.description}</div>}
            <div className="card-sub" style={{ marginBottom: 10 }}>{p.segments.length} segments</div>
            {p.segments.slice(0, 3).map(s => (
              <div key={s.id} className="segment-item">
                <span className="segment-time">{s.minutes}m</span>
                <span style={{ flex: 1, fontSize: 13 }}>{s.title}</span>
                {s.drill && <span style={{ fontSize: 11, color: "var(--blue)" }}>🔗</span>}
              </div>
            ))}
            {p.segments.length > 3 && <div style={{ fontSize: 12, color: "var(--gray1)", marginTop: 6, textAlign: "center" }}>+ {p.segments.length - 3} more segments</div>}
            <button className="btn btn-primary btn-sm" style={{ width: "100%", marginTop: 12 }} onClick={(e) => { e.stopPropagation(); onUsePlan(p); }}>Use This Plan →</button>
          </div>
        ))}
      </div>
      {showCreatePlan && <CreatePlanModal onClose={() => setShowCreatePlan(false)} onSave={(plan) => { alert("Plan created!"); setShowCreatePlan(false); }} />}
    </div>
  );
}

function CreatePlanModal({ onClose, onSave }) {
  const [f, setF] = useState({ title: "", description: "", duration: 90 });
  const [segments, setSegments] = useState([
    { id: "seg1", title: "", minutes: 10, drill: null, notes: "" }
  ]);
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  
  const addSegment = () => {
    const newId = `seg${segments.length + 1}`;
    setSegments([...segments, { id: newId, title: "", minutes: 10, drill: null, notes: "" }]);
  };
  
  const updateSegment = (id, field, value) => {
    setSegments(segments.map(seg => seg.id === id ? { ...seg, [field]: value } : seg));
  };
  
  const removeSegment = (id) => {
    if (segments.length > 1) {
      setSegments(segments.filter(seg => seg.id !== id));
    }
  };
  
  const totalDuration = segments.reduce((sum, seg) => sum + (parseInt(seg.minutes) || 0), 0);
  
  const handleSave = () => {
    if (!f.title) return;
    const filledSegments = segments.filter(s => s.title);
    if (filledSegments.length === 0) return;
    
    const plan = {
      id: `custom${Date.now()}`,
      title: f.title,
      description: f.description,
      duration: totalDuration,
      segments: filledSegments
    };
    onSave(plan);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <div className="modal-title">Create Practice Plan</div>
        
        <div className="input-group">
          <label>Plan Title</label>
          <input 
            className="input-field" 
            placeholder="e.g., Hitting & Defense Day" 
            value={f.title} 
            onChange={e => s("title", e.target.value)} 
          />
        </div>
        
        <div className="input-group">
          <label>Description</label>
          <textarea 
            className="input-field" 
            placeholder="Brief overview of what this practice covers..." 
            value={f.description} 
            onChange={e => s("description", e.target.value)}
            rows={2}
          />
        </div>
        
        <div style={{ marginBottom: 16, padding: 10, background: "var(--navy3)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1 }}>Total Duration</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--orange)" }}>⏱ {totalDuration} minutes</div>
          </div>
          <div style={{ fontSize: 11, color: "var(--gray1)" }}>{segments.filter(s => s.title).length} segments</div>
        </div>
        
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Practice Segments</div>
          
          {segments.map((seg, idx) => (
            <div key={seg.id} style={{ marginBottom: 12, padding: 12, background: "var(--navy3)", borderRadius: 8, position: "relative" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <input 
                    className="input-field" 
                    placeholder={`Segment ${idx + 1} title`} 
                    value={seg.title} 
                    onChange={e => updateSegment(seg.id, "title", e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                </div>
                <div style={{ width: 80 }}>
                  <input 
                    className="input-field" 
                    type="number" 
                    placeholder="Min" 
                    value={seg.minutes} 
                    onChange={e => updateSegment(seg.id, "minutes", e.target.value)}
                    style={{ marginBottom: 8, textAlign: "center" }}
                  />
                </div>
                {segments.length > 1 && (
                  <button 
                    onClick={() => removeSegment(seg.id)}
                    style={{ 
                      background: "transparent", 
                      border: "none", 
                      color: "var(--red)", 
                      cursor: "pointer",
                      fontSize: 18,
                      padding: "0 8px"
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <textarea 
                className="input-field" 
                placeholder="Coaching notes for this segment..." 
                value={seg.notes} 
                onChange={e => updateSegment(seg.id, "notes", e.target.value)}
                rows={2}
                style={{ fontSize: 13 }}
              />
            </div>
          ))}
          
          <button 
            className="btn btn-ghost" 
            style={{ width: "100%" }} 
            onClick={addSegment}
          >
            + Add Segment
          </button>
        </div>
        
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1 }} 
            disabled={!f.title || segments.filter(s => s.title).length === 0}
            onClick={handleSave}
          >
            Create Plan
          </button>
        </div>
      </div>
    </div>
  );
}


function DrillVideoUploader({ drillId, drillVideos, setDrillVideos, replace }) {
  const [mode, setMode] = React.useState("url");
  const [urlInput, setUrlInput] = React.useState("");

  const handleUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setDrillVideos(p => ({ ...p, [drillId]: trimmed }));
    setUrlInput("");
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setDrillVideos(p => ({ ...p, [drillId]: ev.target.result }));
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {replace && <div style={{ fontSize: 12, color: "var(--gray1)", marginBottom: 8, fontWeight: 700 }}>Replace Video</div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {[["url", "🔗 Link"], ["upload", "📁 Upload"]].map(([k, l]) => (
          <button key={k} className={`btn btn-sm ${mode === k ? "btn-primary" : "btn-ghost"}`}
            style={{ flex: 1, fontSize: 12 }} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      {mode === "url" ? (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            className="input-field"
            style={{ flex: 1, fontSize: 13 }}
            placeholder="YouTube or video URL..."
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleUrl()}
          />
          <button className="btn btn-primary btn-sm" onClick={handleUrl}>Add</button>
        </div>
      ) : (
        <label style={{ display: "block", border: "2px dashed rgba(255,255,255,0.2)", borderRadius: 8, padding: "14px", textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.03)" }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>📹</div>
          <div style={{ fontSize: 13, color: "var(--gray1)" }}>Tap to upload a video</div>
          <div style={{ fontSize: 11, color: "var(--gray2)", marginTop: 2 }}>MP4, MOV, AVI supported</div>
          <input type="file" accept="video/*" style={{ display: "none" }} onChange={handleFile} />
        </label>
      )}
    </div>
  );
}

function DrillAssignmentCard({ d, onFeedback }) {
  const [expanded, setExpanded] = useState(false);
  const players = MOCK_ROSTER.filter(p => p.role === "player");
  const drillPlayers = d.players || players.map(p => ({ playerId: p.id, completed: false }));
  const completed = drillPlayers.filter(p => p.completed);
  const notCompleted = drillPlayers.filter(p => !p.completed);
  const pct = Math.round((completed.length / drillPlayers.length) * 100);
  const isOverdue = d.due_at && new Date(d.due_at + ", 2026") < new Date();

  return (
    <div className="card" style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{d.category}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{d.title}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: pct === 100 ? "var(--green)" : pct >= 50 ? "var(--orange)" : "var(--red)", lineHeight: 1 }}>{pct}%</div>
            <div style={{ fontSize: 10, color: "var(--gray1)" }}>{completed.length}/{drillPlayers.length}</div>
          </div>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--green)" : pct >= 50 ? "var(--orange)" : "var(--red)", borderRadius: 3 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: isOverdue ? "var(--red)" : "var(--gray1)" }}>{isOverdue ? "⚠️ " : "📅 "}Due {d.due_at}</span>
          <span style={{ fontSize: 12, color: "var(--gray1)" }}>{expanded ? "▲ Hide" : "▼ Details"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {notCompleted.length > 0 && (
            <div style={{ padding: "10px 14px 6px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>✗ Not Completed ({notCompleted.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {notCompleted.map(p => {
                  const player = MOCK_ROSTER.find(r => r.id === p.playerId);
                  if (!player) return null;
                  return (
                    <div key={p.playerId} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,101,101,0.1)", border: "1px solid rgba(245,101,101,0.25)", borderRadius: 20, padding: "4px 10px 4px 6px" }}>
                      <span style={{ fontSize: 16 }}>{player.picture}</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{player.name.split(" ")[0]}</span>
                      <span style={{ fontSize: 10, color: "var(--gray1)" }}>#{player.number}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div style={{ padding: "10px 14px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>✓ Completed ({completed.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {completed.map(p => {
                  const player = MOCK_ROSTER.find(r => r.id === p.playerId);
                  if (!player) return null;
                  return (
                    <div key={p.playerId} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.25)", borderRadius: 20, padding: "4px 10px 4px 6px" }}>
                      <span style={{ fontSize: 16 }}>{player.picture}</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{player.name.split(" ")[0]}</span>
                      <span style={{ fontSize: 10, color: "var(--gray1)" }}>#{player.number}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {notCompleted.length > 0 && (
            <div style={{ padding: "0 14px 12px" }}>
              <button className="btn btn-secondary btn-sm" style={{ width: "100%" }}
                onClick={() => onFeedback({ ...d, nonCompleters: notCompleted.map(p => MOCK_ROSTER.find(r => r.id === p.playerId)).filter(Boolean) })}>
                📬 Message {notCompleted.length} who haven't completed
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DrillsTab({ isCoach, role, isPro, setShowPaywall, drills, coachDrills, drillCompletion, setDrillCompletion, drillVideos, setDrillVideos, onFeedback, onCreateDrill }) {
  const [tab, setTab] = useState("list");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDrill, setSelectedDrill] = useState(null);

  const categories = [
    { key: "all", label: "All Drills", count: ALL_DRILLS.length },
    { key: "pitching", label: "Pitching", count: DRILL_LIBRARY.pitching.length },
    { key: "hitting", label: "Hitting", count: DRILL_LIBRARY.hitting.length },
    { key: "fielding", label: "Fielding", count: DRILL_LIBRARY.fielding.length },
    { key: "catching", label: "Catching", count: DRILL_LIBRARY.catching.length },
    { key: "throwing", label: "Throwing", count: DRILL_LIBRARY.throwing.length },
    { key: "catcherSpecific", label: "Catcher", count: DRILL_LIBRARY.catcherSpecific.length },
    { key: "baserunning", label: "Baserunning", count: DRILL_LIBRARY.baserunning.length },
    { key: "conditioning", label: "Conditioning", count: DRILL_LIBRARY.conditioning.length },
    { key: "mental", label: "Mental Skills", count: DRILL_LIBRARY.mental.length },
  ];

  const filteredDrills = selectedCategory === "all" ? ALL_DRILLS : DRILL_LIBRARY[selectedCategory] || [];

  if (isCoach) {
    if (!isPro) return (
      <div>
        <div className="top-header"><h2>Drills</h2></div>
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <div className="empty-icon">⚾</div>
          <h3>Drill Library</h3>
          <p style={{ marginBottom: 24 }}>Access 60+ professional drills organized by category. Create custom drills, assign to players, track completion, and give personalized feedback.</p>
          {role === "head_coach" && <button className="btn btn-pro" onClick={() => setShowPaywall(true)}>Upgrade to Pro ⭐</button>}
          {role === "assistant_coach" && <p style={{ fontSize: 13, color: "var(--gray1)" }}>Ask your Head Coach to upgrade to Pro</p>}
        </div>
      </div>
    );

    if (selectedDrill) {
      const vid = drillVideos[selectedDrill.id];
      const isYoutube = vid && (vid.includes("youtube.com") || vid.includes("youtu.be"));
      const getYoutubeId = (url) => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
      };
      return (
        <div>
          <div className="top-header">
            <div className="back-btn" onClick={() => setSelectedDrill(null)}>← Back</div>
            <h2>Drill Details</h2>
          </div>
          <div style={{ padding: 16, paddingBottom: 40 }}>
            <div className="drill-category" style={{ marginBottom: 4 }}>{selectedDrill.category}</div>
            <div style={{ fontFamily: "Barlow Condensed", fontSize: 24, fontWeight: 900, marginBottom: 12 }}>{selectedDrill.title}</div>

            {/* Video Section */}
            <div className="card" style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1 }}>🎥 Demo Video</div>
                {vid && (
                  <button onClick={() => setDrillVideos(p => { const n = {...p}; delete n[selectedDrill.id]; return n; })}
                    style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Remove</button>
                )}
              </div>
              {vid ? (
                isYoutube ? (
                  <a href={vid} target="_blank" rel="noreferrer" style={{ display: "block", cursor: "pointer", textDecoration: "none" }}>
                    <div style={{ width: "100%", height: 180, background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, position: "relative" }}>
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 24px rgba(255,0,0,0.4)" }}>
                        <div style={{ width: 0, height: 0, borderTop: "13px solid transparent", borderBottom: "13px solid transparent", borderLeft: "22px solid white", marginLeft: 5 }} />
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>Watch on YouTube</div>
                      <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,0,0,0.9)", borderRadius: 4, padding: "2px 6px" }}>
                        <span style={{ color: "white", fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>▶ YouTube</span>
                      </div>
                    </div>
                  </a>
                ) : vid.startsWith("data:video") ? (
                  <video src={vid} controls style={{ width: "100%", maxHeight: 220, display: "block", background: "#000" }} />
                ) : (
                  <div style={{ padding: "8px 14px 12px" }}>
                    <a href={vid} target="_blank" rel="noreferrer" style={{ color: "var(--blue)", fontSize: 13, wordBreak: "break-all" }}>🔗 {vid}</a>
                  </div>
                )
              ) : (
                <div style={{ padding: "8px 14px 12px" }}>
                  <DrillVideoUploader drillId={selectedDrill.id} drillVideos={drillVideos} setDrillVideos={setDrillVideos} />
                </div>
              )}
              {vid && (
                <div style={{ padding: "0 14px 12px" }}>
                  <DrillVideoUploader drillId={selectedDrill.id} drillVideos={drillVideos} setDrillVideos={setDrillVideos} replace />
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Instructions</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{selectedDrill.description}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginTop: 12, marginBottom: 8 }}>Desired Results</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--gray1)" }}>{selectedDrill.details}</div>
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => onCreateDrill(selectedDrill)}>Assign This Drill →</button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="top-header"><h2>Drills</h2><button className="btn btn-primary btn-sm" onClick={onCreateDrill}>+ Custom</button></div>
        <div style={{ display: "flex", gap: 8, padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {[["list", "Library"], ["assignments", "Assignments"]].map(([k, l]) => (
            <button key={k} className={`btn btn-sm ${tab === k ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab === "list" ? (
          <>
            <div style={{ overflowX: "auto", whiteSpace: "nowrap", padding: "12px 14px 8px", display: "flex", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {categories.map(cat => (
                <div key={cat.key} onClick={() => setSelectedCategory(cat.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: selectedCategory === cat.key ? "var(--orange)" : "var(--navy3)", color: selectedCategory === cat.key ? "white" : "var(--chalk)", fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${selectedCategory === cat.key ? "var(--orange)" : "rgba(255,255,255,0.1)"}`, flexShrink: 0 }}>
                  {cat.label} <span style={{ opacity: 0.7 }}>({cat.count})</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "8px 14px 14px" }}>
              {filteredDrills.map(d => (
                <div key={d.id} className="drill-card" onClick={() => setSelectedDrill(d)} style={{ cursor: "pointer" }}>
                  <div className="drill-category">{d.category}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div className="drill-title" style={{ flex: 1 }}>{d.title}</div>
                    <span style={{ color: "var(--orange)", fontSize: 20 }}>›</span>
                  </div>
                  <div className="drill-desc">{d.description}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ padding: "0 14px 14px" }}>
            {coachDrills.map(d => (
              <DrillAssignmentCard key={d.id} d={d} onFeedback={onFeedback} />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Parent/Player view
  const [selectedPlayerDrill, setSelectedPlayerDrill] = React.useState(null);
  const [playerTab, setPlayerTab] = React.useState("assigned");
  const [libCategory, setLibCategory] = React.useState("all");

  // Lock parent/player behind Pro
  if (!isPro) return (
    <div>
      <div className="top-header"><h2>Drills</h2></div>
      <div className="empty-state" style={{ paddingTop: 60 }}>
        <div className="empty-icon">⚾</div>
        <h3>Drill Library</h3>
        <p style={{ marginBottom: 24 }}>
          {role === "player"
            ? "Access your assigned drills and the full 60+ drill library with a team Pro membership."
            : "View assigned drills and the full drill library when your team has a Pro membership."}
        </p>
        <div style={{ background: "rgba(244,128,26,0.08)", border: "1px solid rgba(244,128,26,0.2)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--gray1)" }}>
          🔒 Team membership required — ask your coach to upgrade
        </div>
      </div>
    </div>
  );

  const libCategories = [
    { key: "all", label: "All" },
    { key: "pitching", label: "Pitching" },
    { key: "hitting", label: "Hitting" },
    { key: "fielding", label: "Fielding" },
    { key: "catching", label: "Catching" },
    { key: "throwing", label: "Throwing" },
    { key: "catcherSpecific", label: "Catcher" },
    { key: "baserunning", label: "Baserunning" },
    { key: "conditioning", label: "Conditioning" },
    { key: "mental", label: "Mental" },
  ];
  const libDrills = libCategory === "all" ? ALL_DRILLS : (DRILL_LIBRARY[libCategory] || []);

  if (selectedPlayerDrill) {
    const d = selectedPlayerDrill;
    const vid = drillVideos[d.id];
    const isYoutube = vid && (vid.includes("youtube.com") || vid.includes("youtu.be"));
    const getYoutubeId = (url) => {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    };
    return (
      <div>
        <div className="top-header">
          <div className="back-btn" onClick={() => setSelectedPlayerDrill(null)}>← Back</div>
          <h2>Drill Details</h2>
        </div>
        <div style={{ padding: 16, paddingBottom: 40 }}>
          <div className="drill-category" style={{ marginBottom: 4 }}>{d.category}</div>
          <div style={{ fontFamily: "Barlow Condensed", fontSize: 24, fontWeight: 900, marginBottom: 12 }}>{d.title}</div>

          {/* Video */}
          <div className="card" style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px 8px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1 }}>🎥 Demo Video</div>
            </div>
            {vid ? (
              isYoutube ? (
                <a href={vid} target="_blank" rel="noreferrer" style={{ display: "block", position: "relative", cursor: "pointer" }}>
                  <img
                    src={`https://img.youtube.com/vi/${getYoutubeId(vid)}/hqdefault.jpg`}
                    alt="Video thumbnail"
                    style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
                  />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                    <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
                      <div style={{ width: 0, height: 0, borderTop: "12px solid transparent", borderBottom: "12px solid transparent", borderLeft: "20px solid white", marginLeft: 4 }} />
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.7)", color: "white", fontSize: 11, padding: "3px 8px", borderRadius: 4, fontWeight: 600 }}>▶ Watch on YouTube</div>
                </a>
              ) : vid.startsWith("data:video") ? (
                <video src={vid} controls style={{ width: "100%", maxHeight: 220, display: "block", background: "#000" }} />
              ) : (
                <div style={{ padding: "8px 14px 12px" }}>
                  <a href={vid} target="_blank" rel="noreferrer" style={{ color: "var(--blue)", fontSize: 13, wordBreak: "break-all" }}>🔗 {vid}</a>
                </div>
              )
            ) : (
              <div style={{ padding: "8px 14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>🎬</div>
                <div style={{ fontSize: 13, color: "var(--gray1)" }}>No demo video added yet</div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Instructions</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{d.description}</div>
            {d.due_at && <div style={{ fontSize: 12, color: "var(--gray1)", marginTop: 4 }}>Due: {d.due_at}{d.assigned_by ? ` · Assigned by ${d.assigned_by}` : ""}</div>}
          </div>

          {/* Feedback */}
          {d.feedback && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Coach Feedback</div>
              <span className={`status-pill ${d.feedback.status === "good" ? "pill-yes" : "pill-no"}`}>{d.feedback.status === "good" ? "👍 Good Work!" : "⚠️ Needs Work"}</span>
              <div style={{ fontSize: 14, color: "var(--gray1)", marginTop: 8 }}>{d.feedback.note}</div>
            </div>
          )}

          {d.status && !drillCompletion[d.id] && d.status !== "completed" && (
            <button className="btn btn-success" style={{ width: "100%" }} onClick={() => { setDrillCompletion(p => ({ ...p, [d.id]: true })); setSelectedPlayerDrill(null); }}>✓ Mark Complete</button>
          )}
          {d.status && (drillCompletion[d.id] || d.status === "completed") && (
            <div style={{ textAlign: "center", padding: 12, background: "rgba(56,161,105,0.1)", borderRadius: 10, border: "1px solid rgba(56,161,105,0.3)" }}>
              <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 15 }}>✅ Completed!</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="top-header"><h2>Drills</h2></div>
      <div style={{ display: "flex", gap: 8, padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {[["assigned", "My Assignments"], ["library", "Full Library"]].map(([k, l]) => (
          <button key={k} className={`btn btn-sm ${playerTab === k ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setPlayerTab(k)}>{l}</button>
        ))}
      </div>

      {playerTab === "assigned" ? (
        <div style={{ padding: 14 }}>
          {drills.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 40 }}>
              <div className="empty-icon">⚾</div>
              <h3>No Drills Assigned</h3>
              <p>Your coach hasn't assigned any drills yet. Check the Full Library to practice on your own!</p>
            </div>
          ) : drills.map(d => {
            const vid = drillVideos[d.id];
            return (
              <div key={d.id} className="drill-card" onClick={() => setSelectedPlayerDrill(d)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div className="drill-category" style={{ margin: 0 }}>{d.category}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {vid && <span style={{ fontSize: 11, color: "var(--blue)", fontWeight: 700 }}>🎥 Video</span>}
                    <span style={{ color: "var(--orange)", fontSize: 18 }}>›</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div className="drill-title" style={{ flex: 1, minWidth: 0 }}>{d.title}</div>
                  <span className={`status-pill pill-${drillCompletion[d.id] ? "completed" : d.status}`}>{drillCompletion[d.id] ? "completed" : d.status}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--gray1)", marginTop: 4 }}>Due: {d.due_at}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto", whiteSpace: "nowrap", padding: "10px 14px 8px", display: "flex", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {libCategories.map(cat => (
              <div key={cat.key} onClick={() => setLibCategory(cat.key)} style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 20, background: libCategory === cat.key ? "var(--orange)" : "var(--navy3)", color: libCategory === cat.key ? "white" : "var(--chalk)", fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${libCategory === cat.key ? "var(--orange)" : "rgba(255,255,255,0.1)"}`, flexShrink: 0 }}>
                {cat.label}
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 14px 14px" }}>
            {libDrills.map(d => {
              const vid = drillVideos[d.id];
              return (
                <div key={d.id} className="drill-card" onClick={() => setSelectedPlayerDrill(d)} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div className="drill-category" style={{ margin: 0 }}>{d.category}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {vid && <span style={{ fontSize: 11, color: "var(--blue)", fontWeight: 700 }}>🎥 Video</span>}
                      <span style={{ color: "var(--orange)", fontSize: 18 }}>›</span>
                    </div>
                  </div>
                  <div className="drill-title">{d.title}</div>
                  <div className="drill-desc" style={{ marginTop: 4 }}>{d.description.substring(0, 80)}...</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MessagesTab({ convs, setConvList, isCoach, roster, onConv, role, messages, setMessages, displayName }) {
  const [showNewConv, setShowNewConv] = useState(false);

  const handleOpenConv = (c) => {
    setConvList(p => p.map(x => x.id === c.id ? { ...x, unread: 0 } : x));
    onConv(c);
  };

  const getAvatar = (c) => {
    if (c.type === "group") return c.avatar || "⚾";
    return c.name ? c.name[0].toUpperCase() : "?";
  };

  return (
    <div>
      <div className="top-header">
        <h2>Messages</h2>
        {isCoach && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewConv(true)}>+ New</button>
        )}
      </div>

      {convs.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <div className="empty-icon">💬</div>
          <h3>No Messages Yet</h3>
          <p>Start a conversation with your team</p>
        </div>
      ) : convs.map(c => {
        const lastMsg = messages[c.id]?.slice(-1)[0];
        const preview = lastMsg ? `${lastMsg.sent ? "You" : lastMsg.sender.split(" ")[0]}: ${lastMsg.body}` : c.preview;
        return (
          <div key={c.id} onClick={() => handleOpenConv(c)} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            cursor: "pointer",
            background: c.unread > 0 ? "rgba(244,128,26,0.04)" : "transparent",
            transition: "background 0.15s",
          }}>
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: c.type === "group" ? 14 : "50%",
              background: c.type === "group" ? "linear-gradient(135deg, var(--orange), #d4601a)" : "linear-gradient(135deg, var(--blue), #2563eb)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: c.type === "group" ? 22 : 18, fontWeight: 700, color: "white",
              flexShrink: 0, position: "relative",
            }}>
              {getAvatar(c)}
              {c.unread > 0 && (
                <div style={{
                  position: "absolute", top: -4, right: -4,
                  background: "var(--red)", color: "white",
                  borderRadius: 10, minWidth: 18, height: 18,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, padding: "0 4px",
                  border: "2px solid var(--navy1)",
                }}>{c.unread}</div>
              )}
            </div>

            {/* Body */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                <div style={{ fontWeight: c.unread > 0 ? 700 : 600, fontSize: 15, color: "var(--white)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--gray2)", flexShrink: 0, marginLeft: 8 }}>{c.time}</div>
              </div>
              <div style={{
                fontSize: 13, color: c.unread > 0 ? "var(--chalk)" : "var(--gray1)",
                fontWeight: c.unread > 0 ? 500 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{preview}</div>
            </div>
          </div>
        );
      })}

      {/* Parent message coach button */}
      {role === "parent" && (
        <div style={{ padding: 16 }}>
          <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => {
            const headCoach = roster.find(p => p.role === "head_coach");
            if (headCoach) {
              const exists = convs.find(c => c.id === "cv_coach_dm");
              if (!exists) {
                setConvList(p => [...p, { id: "cv_coach_dm", type: "direct", name: headCoach.name, preview: "Start a conversation...", time: "Now", unread: 0 }]);
              }
              onConv({ id: "cv_coach_dm", type: "direct", name: headCoach.name });
            }
          }}>📬 Message Head Coach</button>
        </div>
      )}

      {role === "player" && (
        <div style={{ padding: "8px 16px" }}>
          <div style={{ background: "rgba(244,128,26,0.08)", border: "1px solid rgba(244,128,26,0.2)", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "var(--gray1)", textAlign: "center" }}>
            👁️ View only — your parents receive and reply to messages
          </div>
        </div>
      )}

      {showNewConv && (
        <NewConvModal
          roster={roster}
          convs={convs}
          setConvList={setConvList}
          setMessages={setMessages}
          displayName={displayName}
          onConv={onConv}
          onClose={() => setShowNewConv(false)}
        />
      )}
    </div>
  );
}

function NewConvModal({ roster, convs, setConvList, setMessages, displayName, onConv, onClose }) {
  const [tab, setTab] = useState("dm"); // "dm" or "group"
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const contacts = roster.filter(p => p.role !== "player");

  const toggle = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleCreate = () => {
    if (selected.length === 0) return;
    if (tab === "dm") {
      const person = contacts.find(p => p.id === selected[0]);
      const convId = `dm_${selected[0]}_${Date.now()}`;
      const existing = convs.find(c => c.name === person.name && c.type === "direct");
      if (existing) { onConv(existing); onClose(); return; }
      const newConv = { id: convId, type: "direct", name: person.name, preview: "Start a conversation...", time: "Now", unread: 0 };
      setConvList(p => [newConv, ...p]);
      setMessages(p => ({ ...p, [convId]: [] }));
      onConv(newConv);
    } else {
      const name = groupName.trim() || `Group (${selected.length})`;
      const convId = `grp_${Date.now()}`;
      const newConv = { id: convId, type: "group", name, preview: "Group created", time: "Now", unread: 0 };
      setConvList(p => [newConv, ...p]);
      setMessages(p => ({ ...p, [convId]: [{ id: Date.now(), sender: "System", body: `${displayName} created this group`, time: "Now", sent: false, system: true }] }));
      onConv(newConv);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "82vh", overflowY: "auto" }}>
        <div className="modal-title">New Message</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[["dm","Direct Message"],["group","Group Chat"]].map(([k,l]) => (
            <button key={k} className={`btn btn-sm ${tab===k?"btn-primary":"btn-ghost"}`} style={{ flex: 1 }} onClick={() => { setTab(k); setSelected([]); }}>{l}</button>
          ))}
        </div>
        {tab === "group" && (
          <div className="input-group" style={{ marginBottom: 12 }}>
            <label>Group Name</label>
            <input className="input-field" placeholder="e.g. Pitching Group, Infield..." value={groupName} onChange={e => setGroupName(e.target.value)} />
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          {tab === "dm" ? "Select 1 person" : "Add members"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
          {contacts.map(p => {
            const sel = selected.includes(p.id);
            return (
              <div key={p.id} onClick={() => tab === "dm" ? setSelected([p.id]) : toggle(p.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: sel ? "rgba(244,128,26,0.12)" : "var(--navy3)", border: `1.5px solid ${sel ? "var(--orange)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer" }}>
                <div style={{ width: 18, height: 18, borderRadius: tab==="dm" ? "50%" : 4, border: `2px solid ${sel?"var(--orange)":"rgba(255,255,255,0.2)"}`, background: sel?"var(--orange)":"transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "white", flexShrink: 0 }}>{sel && "✓"}</div>
                <div style={{ fontSize: 28 }}>{p.picture}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--gray1)" }}>{p.role.replace("_"," ")}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={selected.length === 0} onClick={handleCreate}>
            {tab === "dm" ? "Open Chat" : `Create Group (${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function RosterTab({ roster, isCoach, onPlayer, onAddPlayer, playerPhotos }) {
  const coaches = roster.filter(p => p.role.includes("coach"));
  const players = roster.filter(p => p.role === "player");
  return (
    <div>
      <div className="top-header">
        <h2>Roster</h2>
        {isCoach && <button className="btn btn-primary btn-sm" onClick={onAddPlayer}>+ Player</button>}
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontFamily: "Barlow Condensed", fontSize: 14, fontWeight: 700, textTransform: "uppercase", color: "var(--gray1)", marginBottom: 8, letterSpacing: 0.5 }}>Coaches</div>
        {coaches.map(p => (
          <div key={p.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div className="player-num" style={{ background: "var(--navy3)", color: "var(--gold)", fontSize: 13 }}>{p.role === "head_coach" ? "HC" : "AC"}</div>
              <div style={{ flex: 1 }}>
                <div className="player-name">{p.name}</div>
                <div className="player-meta">{p.role === "head_coach" ? "Head Coach" : "Assistant Coach"}</div>
              </div>
            </div>
            <div style={{ paddingLeft: 52, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <a href={`tel:${p.phone}`} style={{ color: "var(--blue)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <span>📞</span><span>{p.phone}</span>
              </a>
              <a href={`mailto:${p.email}`} style={{ color: "var(--blue)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <span>✉️</span><span>{p.email}</span>
              </a>
            </div>
          </div>
        ))}
        <div style={{ fontFamily: "Barlow Condensed", fontSize: 14, fontWeight: 700, textTransform: "uppercase", color: "var(--gray1)", margin: "14px 0 8px", letterSpacing: 0.5 }}>Players ({players.length})</div>
        {players.map(p => (
          <div key={p.id} className="player-card" style={{ cursor: isCoach ? "pointer" : "default" }} onClick={() => isCoach && onPlayer(p)}>
            {playerPhotos?.[p.id] ? (
              <img 
                src={playerPhotos[p.id]} 
                alt={p.name}
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 12, 
                  objectFit: "cover",
                  marginRight: 8,
                  border: "2px solid rgba(66,153,225,0.3)"
                }} 
              />
            ) : (
              <div style={{ fontSize: 48, lineHeight: 1, marginRight: 8 }}>{p.picture}</div>
            )}
            <div className="player-num">#{p.number}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="player-name">{p.name}</div>
              <div className="player-tags">
                {p.positions.map(pos => <span key={pos} className="mini-tag">{pos}</span>)}
                {p.bats && <span className="mini-tag">B:{p.bats}</span>}
                {p.throws && <span className="mini-tag">T:{p.throws}</span>}
              </div>
            </div>
            {isCoach && <span style={{ color: "var(--gray2)", fontSize: 20 }}>›</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ isCoach, role, isPro, setIsPro, settings, setSettings, setShowPaywall, displayName, onSignOut, teamLogo, setTeamLogo, playerPhotos, setPlayerPhotos }) {
  const tog = k => setSettings(p => ({ ...p, [k]: !p[k] }));
  const isHeadCoach = role === "head_coach";
  const roleLabel = role === "head_coach" ? "Head Coach" : role === "assistant_coach" ? "Assistant Coach" : role === "player" ? "Player" : "Parent";
  
  // Find player(s) for this parent/player
  const myPlayers = MOCK_ROSTER.filter(p => 
    p.role === "player" && 
    (role === "parent" && (p.parent1Name === displayName || p.parent2Name === displayName)) ||
    (role === "player" && p.name === displayName)
  );
  const myPlayer = myPlayers[0]; // For settings, we'll use the first player
  
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/') && myPlayer) {
      const reader = new FileReader();
      reader.onload = (event) => {
        // Update global state so photo persists across all views
        setPlayerPhotos(prev => ({
          ...prev,
          [myPlayer.id]: event.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleTeamLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTeamLogo(event.target.result);
        // In production, this would upload to cloud storage and save URL to team profile
      };
      reader.readAsDataURL(file);
    }
  };
  
  return (
    <div>
      <div className="top-header"><h2>Settings</h2></div>
      <div style={{ paddingTop: 8 }}>
        <div className="settings-section">
          <h3>Account</h3>
          <div style={{ margin: "0 16px 16px", background: "var(--navy2)", borderRadius: 12, padding: "14px", display: "flex", alignItems: "center", gap: 12 }}>
            <div className="avatar" style={{ width: 50, height: 50, borderRadius: 12, fontSize: 20 }}>{displayName[0]}</div>
            <div><div style={{ fontWeight: 700, fontSize: 16 }}>{displayName}</div><div style={{ fontSize: 13, color: "var(--gray1)" }}>{roleLabel}{isPro ? " · Pro" : " · Free"}</div><div style={{ marginTop: 4 }}>{isPro ? <span className="pro-badge">PRO ACTIVE</span> : <span style={{ fontSize: 11, color: "var(--gray1)" }}>Free Plan</span>}</div></div>
          </div>
        </div>
        {(role === "parent" || role === "player") && (
          <div className="settings-section">
            <h3>Player Profile</h3>
            <div className="settings-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span className="settings-item-icon">📸</span>
                <div style={{ flex: 1 }}>
                  <div className="settings-item-label">Player Photo</div>
                  <div className="settings-item-sub">Upload a profile picture</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: 12, 
                  background: "var(--navy3)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  overflow: "hidden"
                }}>
                  {myPlayer && playerPhotos?.[myPlayer.id] ? (
                    <img src={playerPhotos[myPlayer.id]} alt="Player" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 40 }}>{myPlayer?.picture || "👦"}</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: "none" }}
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" className="btn btn-secondary" style={{ cursor: "pointer", display: "inline-block", marginBottom: 6 }}>
                    Choose Photo
                  </label>
                  <div style={{ fontSize: 11, color: "var(--gray1)" }}>
                    JPG, PNG, or HEIC • Max 5MB
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {isHeadCoach && (
          <div className="settings-section">
            <h3>Subscription</h3>
            {isPro ? (
              <div className="settings-item">
                <div className="settings-item-left"><span className="settings-item-icon">⭐</span><div><div className="settings-item-label">Pro Plan Active</div><div className="settings-item-sub">Renews Mar 17, 2026</div></div></div>
                <button className="btn btn-ghost btn-xs" onClick={() => setIsPro(false)}>Manage</button>
              </div>
            ) : (
              <div style={{ padding: "0 16px 16px" }}><button className="btn btn-pro" style={{ width: "100%" }} onClick={() => setShowPaywall(true)}>Upgrade to Pro — $19.99/mo</button></div>
            )}
          </div>
        )}
        {isHeadCoach && isPro && (
          <div className="settings-section">
            <h3>Team Settings</h3>
            <div className="settings-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span className="settings-item-icon">🖼️</span>
                <div style={{ flex: 1 }}>
                  <div className="settings-item-label">Team Logo</div>
                  <div className="settings-item-sub">Background for home screen</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ 
                  width: 100, 
                  height: 100, 
                  borderRadius: 12, 
                  background: teamLogo ? `url(${teamLogo})` : "var(--navy3)", 
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  overflow: "hidden",
                  border: "2px solid rgba(255,255,255,0.1)"
                }}>
                  {!teamLogo && <span style={{ fontSize: 40 }}>🦅</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTeamLogoUpload}
                    style={{ display: "none" }}
                    id="team-logo-upload"
                  />
                  <label htmlFor="team-logo-upload" className="btn btn-secondary" style={{ cursor: "pointer", display: "inline-block", marginBottom: 6 }}>
                    Choose Logo
                  </label>
                  {teamLogo && (
                    <button 
                      className="btn btn-ghost btn-xs" 
                      style={{ marginLeft: 8 }}
                      onClick={() => setTeamLogo(null)}
                    >
                      Remove
                    </button>
                  )}
                  <div style={{ fontSize: 11, color: "var(--gray1)", marginTop: 6 }}>
                    JPG, PNG • Max 5MB
                  </div>
                </div>
              </div>
            </div>
            <div className="settings-item">
              <div className="settings-item-left"><span className="settings-item-icon">💬</span><div><div className="settings-item-label">Team Chat Posting</div><div className="settings-item-sub">{settings.groupChatPosting === "everyone" ? "Everyone can post" : "Coaches only"}</div></div></div>
              <div className={`toggle ${settings.groupChatPosting === "coaches_only" ? "on" : ""}`} onClick={() => setSettings(p => ({ ...p, groupChatPosting: p.groupChatPosting === "everyone" ? "coaches_only" : "everyone" }))} />
            </div>
            <div className="settings-item">
              <div className="settings-item-left"><span className="settings-item-icon">🔒</span><div><div className="settings-item-label">Parent-to-Parent DMs</div><div className="settings-item-sub">Allow parents to message each other</div></div></div>
              <div className={`toggle ${settings.allowParentDMs ? "on" : ""}`} onClick={() => tog("allowParentDMs")} />
            </div>
            <div className="settings-item">
              <div className="settings-item-left"><span className="settings-item-icon">🌙</span><div><div className="settings-item-label">Quiet Hours</div><div className="settings-item-sub">No push 9 PM – 7 AM</div></div></div>
              <div className={`toggle ${settings.quietHours ? "on" : ""}`} onClick={() => tog("quietHours")} />
            </div>
          </div>
        )}
        <div className="settings-section">
          <h3>Safety</h3>
          <div className="settings-item">
            <div className="settings-item-left"><span className="settings-item-icon">🚫</span><div><div className="settings-item-label">Blocked Users</div><div className="settings-item-sub">0 users blocked</div></div></div>
            <span style={{ color: "var(--orange)", fontSize: 20 }}>›</span>
          </div>
        </div>
        <div className="settings-section">
          <h3>Notifications</h3>
          <div className="settings-item">
            <div className="settings-item-left"><span className="settings-item-icon">🔔</span><div><div className="settings-item-label">Push Notifications</div><div className="settings-item-sub">RSVP & drill reminders</div></div></div>
            <div className="toggle on" />
          </div>
        </div>
        <div className="settings-section">
          <h3>Legal</h3>
          <div className="settings-item" style={{ cursor: "pointer" }} onClick={() => window.open("https://coachconnectpro.com/terms", "_blank")}>
            <div className="settings-item-left"><span className="settings-item-icon">📄</span><div><div className="settings-item-label">Terms of Service</div><div className="settings-item-sub">Usage policies &amp; your rights</div></div></div>
            <span style={{ color: "var(--orange)", fontSize: 20 }}>›</span>
          </div>
          <div className="settings-item" style={{ cursor: "pointer" }} onClick={() => window.open("https://coachconnectpro.com/privacy", "_blank")}>
            <div className="settings-item-left"><span className="settings-item-icon">🔒</span><div><div className="settings-item-label">Privacy Policy</div><div className="settings-item-sub">How we handle your data</div></div></div>
            <span style={{ color: "var(--orange)", fontSize: 20 }}>›</span>
          </div>
        </div>
        <div style={{ padding: "0 16px 40px" }}>
          <button className="btn btn-ghost" style={{ width: "100%" }} onClick={onSignOut}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   SUB SCREENS
════════════════════════════════ */
function EventDetailScreen({ event, rsvp, onRSVP, onBack, isCoach, isPro, triggerPro, role, displayName }) {
  const [myRsvp, setMyRsvp] = useState(rsvp);
  const [note, setNote] = useState("");
  const [showMessageModal, setShowMessageModal] = useState(false);
  const doRsvp = s => { setMyRsvp(s); onRSVP(s); };
  const isPlayer = role === "player";
  const isParent = role === "parent";
  
  // Find player(s) for this parent
  const myPlayers = isParent ? MOCK_ROSTER.filter(p => 
    p.role === "player" && 
    (p.parent1Name === displayName || p.parent2Name === displayName)
  ) : [];
  
  // Calculate non-responders (for coaches)
  const getNonResponders = () => {
    // Get all players
    const allPlayers = MOCK_ROSTER.filter(p => p.role === "player");
    // For demo, assume players who haven't RSVP'd are non-responders
    // In production, this would check actual RSVP data
    const nonResponders = allPlayers.slice(0, 2).map(p => p.parent1Name); // Demo: first 2 parents
    return nonResponders;
  };
  
  const handleMessageNonResponders = () => {
    if (isPro || triggerPro()) {
      setShowMessageModal(true);
    }
  };
  
  const getUniformLabel = (uniform) => {
    const labels = {
      home: "🏠 Home (White)",
      away: "✈️ Away (Gray)",
      alternate: "🌟 Alternate"
    };
    return labels[uniform] || uniform;
  };
  
  return (
    <div>
      <div className="top-header">
        <div className="back-btn" onClick={onBack}>← Back</div>
        <span className={`event-type-tag tag-${event.type}`}>{event.type === "game" ? "⚾ Game" : "🏃 Practice"}</span>
      </div>
      <div style={{ padding: 16, paddingBottom: 32 }}>
        <div style={{ fontFamily: "Barlow Condensed", fontSize: 26, fontWeight: 900, marginBottom: 4 }}>{event.title}</div>
        {event.opponent && <div style={{ fontSize: 15, color: "var(--orange)", fontWeight: 700, marginBottom: 8 }}>vs. {event.opponent}</div>}
        
        {event.type === "game" && event.uniform && (
          <div className="card" style={{ marginBottom: 12, background: "var(--navy3)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Uniform</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{getUniformLabel(event.uniform)}</div>
          </div>
        )}
        
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <span>📅</span><div><div style={{ fontWeight: 600 }}>{fmt(event.starts_at)}</div><div style={{ fontSize: 13, color: "var(--gray1)" }}>{fmtT(event.starts_at)}</div></div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span>📍</span><div style={{ fontWeight: 600 }}>{event.location}</div>
          </div>
          {event.address && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8, 
                  color: "var(--blue)", 
                  textDecoration: "none",
                  fontSize: 13
                }}
              >
                <span>🗺️</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{event.address}</div>
                  <div style={{ fontSize: 11, color: "var(--blue)", opacity: 0.8 }}>Tap for directions →</div>
                </div>
              </a>
            </div>
          )}
        </div>
        {event.notes && <div className="card" style={{ marginBottom: 12 }}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Notes</div><div style={{ fontSize: 14 }}>{event.notes}</div></div>}
        
        {event.practicePlan && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Practice Plan</div>
            <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--orange)" }}>📋 {event.practicePlan.title}</div>
            <div style={{ fontSize: 13, color: "var(--gray1)", marginBottom: 10 }}>{event.practicePlan.description}</div>
            <div style={{ fontSize: 12, color: "var(--gray1)", marginBottom: 12 }}>⏱️ {event.practicePlan.duration} minutes • {event.practicePlan.segments.length} segments</div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {event.practicePlan.segments.map((seg, idx) => (
                <div key={seg.id} style={{ background: "var(--navy3)", borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{idx + 1}. {seg.title}</div>
                    <div style={{ fontSize: 12, color: "var(--orange)" }}>{seg.minutes} min</div>
                  </div>
                  {seg.drill && <div style={{ fontSize: 11, color: "var(--blue)", marginBottom: 4 }}>Drill: {seg.drill}</div>}
                  <div style={{ fontSize: 12, color: "var(--gray1)" }}>{seg.notes}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {!isCoach && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              {isPlayer ? "RSVP Status" : "RSVP for Your Player"}
            </div>
            
            {isPlayer ? (
              // Player view-only
              <>
                {myRsvp ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "var(--navy3)", borderRadius: 10 }}>
                    <span className={`status-pill pill-${myRsvp}`} style={{ fontSize: 12 }}>{myRsvp.toUpperCase()}</span>
                    <div style={{ flex: 1, fontSize: 13, color: "var(--gray1)" }}>Your parent responded for you</div>
                  </div>
                ) : (
                  <div style={{ padding: 12, background: "rgba(244,128,26,0.1)", border: "1px solid rgba(244,128,26,0.3)", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--orange)", marginBottom: 4 }}>👨‍👩‍👧 Ask your parent to RSVP</div>
                    <div style={{ fontSize: 12, color: "var(--gray1)" }}>Parents can respond for you in their app</div>
                  </div>
                )}
              </>
            ) : (
              // Parent view - can RSVP
              <>
                {myPlayers.length > 0 && (
                  <div style={{ marginBottom: 12, padding: 10, background: "rgba(244,128,26,0.05)", borderRadius: 8, border: "1px solid rgba(244,128,26,0.2)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Responding for:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {myPlayers.map(p => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                          <span>{p.picture}</span>
                          <span style={{ fontWeight: 600 }}>{p.name}</span>
                          <span style={{ color: "var(--gray1)" }}>#{p.number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="rsvp-row">
                  <div className={`rsvp-btn ${myRsvp === "yes" ? "yes" : ""}`} onClick={() => doRsvp("yes")}>✓ Yes</div>
                  <div className={`rsvp-btn ${myRsvp === "no" ? "no" : ""}`} onClick={() => doRsvp("no")}>✗ No</div>
                  <div className={`rsvp-btn ${myRsvp === "maybe" ? "maybe" : ""}`} onClick={() => doRsvp("maybe")}>? Maybe</div>
                </div>
                
                <div className="input-group" style={{ marginTop: 12, marginBottom: 0 }}>
                  <label>Note (optional)</label>
                  <input className="input-field" placeholder="Running late, bringing snacks…" value={note} onChange={e => setNote(e.target.value)} />
                </div>
                
                <div style={{ marginTop: 10, padding: 8, background: "rgba(66,153,225,0.1)", borderRadius: 8, fontSize: 11, color: "var(--gray1)", textAlign: "center" }}>
                  👨‍👩‍👧 Both parents will be notified of this RSVP
                </div>
              </>
            )}
          </div>
        )}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Team RSVP</div>
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            {[["5", "YES", "var(--green)"], ["1", "NO", "var(--red)"], ["2", "MAYBE", "var(--gold)"], ["2", "PENDING", "var(--gray1)"]].map(([n, l, c]) => (
              <div key={l}><div style={{ fontFamily: "Barlow Condensed", fontSize: 26, fontWeight: 900, color: c }}>{n}</div><div style={{ fontSize: 10, color: "var(--gray1)" }}>{l}</div></div>
            ))}
          </div>
        </div>
        {isCoach && (
          <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handleMessageNonResponders}>
            📢 Message Non-Responders {!isPro && "⭐"}
          </button>
        )}
      </div>
      
      {showMessageModal && (
        <MessageNonRespondersModal 
          event={event}
          nonResponders={getNonResponders()}
          onClose={() => setShowMessageModal(false)}
          onSend={(message) => {
            alert(`✅ Message sent to ${getNonResponders().length} parents: "${message}"`);
          }}
        />
      )}
    </div>
  );
}

function ChatScreen({ conv, msgs, reactions, setReactions, canPost, onSend, onOpen, onBack, onReport, role, isCoach, displayName }) {
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(null); // msgId
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [imgPreview, setImgPreview] = useState(null);
  const bottomRef = React.useRef(null);
  const fileRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => { onOpen && onOpen(); }, []);
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = () => {
    if (imgPreview) { onSend(imgPreview, "image"); setImgPreview(null); return; }
    if (input.trim()) { onSend(input.trim(), "text"); setInput(""); }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const toggleReaction = (msgId, emoji) => {
    setReactions(p => {
      const key = `${msgId}_${emoji}`;
      const existing = p[key] || [];
      const hasMe = existing.includes("me");
      return { ...p, [key]: hasMe ? existing.filter(x => x !== "me") : [...existing, "me"] };
    });
    setShowEmoji(null);
  };

  const getReactionsFor = (msgId) => {
    const emojis = ["👍","❤️","😂","🔥","⚾"];
    return emojis.map(e => ({ emoji: e, count: (reactions[`${msgId}_${e}`] || []).length, hasMe: (reactions[`${msgId}_${e}`] || []).includes("me") })).filter(r => r.count > 0);
  };

  // Group messages: same sender within 3 min = grouped
  const grouped = msgs.map((m, i) => {
    const prev = msgs[i-1];
    const isGrouped = prev && prev.sender === m.sender && !m.system && !prev.system && prev.sent === m.sent;
    // Date divider
    const showDate = i === 0 || (prev && prev.time?.includes("day") !== m.time?.includes("day"));
    return { ...m, isGrouped, showDate };
  });

  const EMOJIS = ["👍","❤️","😂","🔥","⚾","💪"];
  const inputAreaHeight = canPost ? 64 : 46;

  return (
    <>
      {/* Header */}
      <div className="top-header" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <div className="back-btn" onClick={onBack}>← Back</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Barlow Condensed", fontSize: 17, fontWeight: 800 }}>{conv.name}</div>
          <div style={{ fontSize: 11, color: "var(--gray1)" }}>{conv.type === "group" ? `Team Chat` : "Direct Message"}</div>
        </div>
        {isCoach && conv.type === "group" && (
          <button className="btn btn-sm btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setShowAnnounce(true)}>📢</button>
        )}
        <div style={{ fontSize: 18, cursor: "pointer", padding: "0 4px" }} onClick={onReport}>🚩</div>
      </div>

      {/* Messages */}
      <div onClick={() => setShowEmoji(null)} style={{ position: "absolute", top: 58, left: 0, right: 0, bottom: inputAreaHeight, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
        {grouped.map((m) => {
          const isMine = m.sent;
          const rxns = getReactionsFor(m.id);

          if (m.system) return (
            <div key={m.id} style={{ textAlign: "center", margin: "8px 0" }}>
              <span style={{ fontSize: 12, color: "var(--gray2)", background: "var(--navy3)", padding: "3px 10px", borderRadius: 10 }}>{m.body}</span>
            </div>
          );

          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: rxns.length > 0 ? 18 : (m.isGrouped ? 2 : 8) }}>
              {/* Sender name */}
              {!isMine && !m.isGrouped && (
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", marginBottom: 3, marginLeft: 4 }}>{m.sender}</div>
              )}

              {/* Bubble row */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isMine ? "row-reverse" : "row", maxWidth: "85%" }}>
                {/* Avatar for grouped */}
                {!isMine && (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--navy3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, visibility: m.isGrouped ? "hidden" : "visible" }}>
                    {m.sender?.[0]?.toUpperCase() || "?"}
                  </div>
                )}

                <div style={{ position: "relative" }}>
                  {/* Announcement badge */}
                  {m.type === "announcement" && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, marginLeft: 2 }}>📢 Announcement</div>
                  )}

                  {/* Bubble */}
                  <div
                    onLongPress={() => setShowEmoji(m.id)}
                    onClick={(e) => { e.stopPropagation(); setShowEmoji(showEmoji === m.id ? null : m.id); }}
                    style={{
                      padding: m.type === "image" ? 3 : "9px 13px",
                      borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      background: m.type === "announcement"
                        ? "linear-gradient(135deg, rgba(244,128,26,0.25), rgba(244,128,26,0.1))"
                        : isMine ? "var(--orange)" : "var(--navy3)",
                      border: m.type === "announcement" ? "1px solid rgba(244,128,26,0.4)" : "none",
                      maxWidth: "100%",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    {m.type === "image" ? (
                      <img src={m.body} alt="shared" style={{ maxWidth: 220, maxHeight: 200, borderRadius: 14, display: "block" }} />
                    ) : (
                      <span style={{ fontSize: 14, lineHeight: 1.4, color: "var(--white)", wordBreak: "break-word" }}>{m.body}</span>
                    )}
                    <div style={{ fontSize: 10, color: isMine ? "rgba(255,255,255,0.6)" : "var(--gray2)", marginTop: m.type === "image" ? 4 : 3, textAlign: "right" }}>{m.time}</div>
                  </div>

                  {/* Emoji picker popup */}
                  {showEmoji === m.id && (
                    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", [isMine ? "right" : "left"]: 0, bottom: "calc(100% + 6px)", background: "var(--navy1)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: "6px 8px", display: "flex", gap: 4, zIndex: 50, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => toggleReaction(m.id, e)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: "2px 3px", borderRadius: 8, transition: "transform 0.1s" }}>{e}</button>
                      ))}
                    </div>
                  )}

                  {/* Reaction chips */}
                  {rxns.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                      {rxns.map(r => (
                        <button key={r.emoji} onClick={() => toggleReaction(m.id, r.emoji)} style={{ background: r.hasMe ? "rgba(244,128,26,0.2)" : "var(--navy3)", border: `1px solid ${r.hasMe ? "var(--orange)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "2px 7px", fontSize: 12, cursor: "pointer", color: "var(--white)", display: "flex", alignItems: "center", gap: 3 }}>
                          {r.emoji} <span style={{ fontSize: 11 }}>{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Image preview bar */}
      {imgPreview && (
        <div style={{ position: "absolute", bottom: inputAreaHeight, left: 0, right: 0, background: "var(--navy2)", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, zIndex: 11 }}>
          <img src={imgPreview} alt="preview" style={{ height: 52, width: 52, objectFit: "cover", borderRadius: 8 }} />
          <div style={{ flex: 1, fontSize: 13, color: "var(--gray1)" }}>Image ready to send</div>
          <button onClick={() => setImgPreview(null)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Input bar */}
      {canPost ? (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--navy2)", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, zIndex: 10 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--gray1)", flexShrink: 0, padding: "0 2px" }}>📷</button>
          <input
            ref={inputRef}
            className="chat-input"
            placeholder="Message…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            style={{ flex: 1 }}
          />
          <button
            onClick={send}
            disabled={!input.trim() && !imgPreview}
            style={{ width: 36, height: 36, borderRadius: "50%", background: (input.trim() || imgPreview) ? "var(--orange)" : "var(--navy3)", border: "none", color: "white", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
          >➤</button>
        </div>
      ) : (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 16px", textAlign: "center", fontSize: 13, color: "var(--gray1)", borderTop: "1px solid rgba(255,255,255,0.07)", background: "var(--navy2)", zIndex: 10 }}>
          {role === "player" ? "👁️ View only — your parents receive and reply" : "Only coaches can post here"}
        </div>
      )}

      {/* Announcement modal */}
      {showAnnounce && (
        <div className="modal-overlay" onClick={() => setShowAnnounce(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📢 Send Announcement</div>
            <div style={{ fontSize: 13, color: "var(--gray1)", marginBottom: 12 }}>Highlighted message sent to all members</div>
            <textarea
              className="input-field"
              placeholder="e.g. Practice moved to Field B this Thursday!"
              value={announceText}
              onChange={e => setAnnounceText(e.target.value)}
              style={{ minHeight: 80 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAnnounce(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!announceText.trim()} onClick={() => {
                onSend(announceText.trim(), "announcement");
                setAnnounceText("");
                setShowAnnounce(false);
              }}>Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlayerDetailScreen({ player, isCoach, onBack, drillCompletion, role, displayName, playerPhotos, setPlayerPhotos }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Check if current user is a parent of this player
  const isParentOfPlayer = role === "parent" && (
    player.parent1Name === displayName || 
    player.parent2Name === displayName
  );
  
  // Get photo from global state
  const uploadedPhoto = playerPhotos[player.id];
  
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        // Update global state so photo persists across all views
        setPlayerPhotos(prev => ({
          ...prev,
          [player.id]: event.target.result
        }));
        setUploading(false);
      };
      reader.onerror = () => {
        setUploading(false);
        alert('Error uploading photo. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  };
  
  const displayPhoto = uploadedPhoto || player.picture;
  
  return (
    <div>
      <div className="top-header">
        <div className="back-btn" onClick={onBack}>← Back</div>
        <h2>Player Profile</h2>
        {isCoach && <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(true)}>✏️ Edit</button>}
      </div>
      <div style={{ padding: 16, paddingBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ position: "relative", width: 70, height: 70 }}>
            {uploading ? (
              <div style={{ 
                width: "100%", 
                height: "100%", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                border: "2px solid rgba(66,153,225,0.5)"
              }}>
                <div style={{ 
                  width: 24, 
                  height: 24, 
                  border: "3px solid rgba(66,153,225,0.2)", 
                  borderTop: "3px solid var(--blue)", 
                  borderRadius: "50%", 
                  animation: "spin 1s linear infinite" 
                }} />
              </div>
            ) : uploadedPhoto ? (
              <img 
                src={uploadedPhoto} 
                alt={player.name} 
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  borderRadius: 12, 
                  objectFit: "cover",
                  border: "2px solid rgba(66,153,225,0.3)"
                }} 
              />
            ) : (
              <div style={{ 
                width: "100%", 
                height: "100%", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                fontSize: 48, 
                borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                border: "2px solid rgba(255,255,255,0.1)"
              }}>
                {player.picture}
              </div>
            )}
            {isParentOfPlayer && !uploading && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ display: "none" }}
                  id={`photo-upload-${player.id}`}
                />
                <label 
                  htmlFor={`photo-upload-${player.id}`}
                  style={{ 
                    position: "absolute", 
                    bottom: -4, 
                    right: -4, 
                    width: 28, 
                    height: 28, 
                    borderRadius: 8, 
                    background: "var(--blue)", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    cursor: "pointer",
                    fontSize: 14,
                    border: "2px solid var(--navy1)"
                  }}
                  title="Upload photo"
                >
                  📸
                </label>
              </>
            )}
          </div>
          <div className="player-num" style={{ width: 60, height: 60, borderRadius: 14, fontSize: 24 }}>#{player.number}</div>
          <div><div style={{ fontFamily: "Barlow Condensed", fontSize: 24, fontWeight: 900 }}>{player.name}</div><div className="player-tags"><span className="mini-tag">{player.bats === "B" ? "Bats Both" : `Bats ${player.bats}`}</span><span className="mini-tag">Throws {player.throws}</span></div></div>
        </div>
        
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Positions</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {player.positions.map(p => <span key={p} className="mini-tag" style={{ fontSize: 14, padding: "4px 12px" }}>{p}</span>)}
          </div>
        </div>
        
        {isCoach && player.skillNotes && (
          <div className="card" style={{ marginBottom: 12, background: "var(--navy3)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Skill Notes</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--white)" }}>{player.skillNotes}</div>
          </div>
        )}
        
        {/* Parent 1 Section */}
        {isCoach && player.parent1Name && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Parent/Guardian 1</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{player.parent1Name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <a href={`tel:${player.parent1Phone}`} style={{ color: "var(--blue)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <span>📞</span><span>{player.parent1Phone}</span>
              </a>
              <a href={`mailto:${player.parent1Email}`} style={{ color: "var(--blue)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <span>✉️</span><span>{player.parent1Email}</span>
              </a>
            </div>
          </div>
        )}
        
        {/* Parent 2 Section */}
        {isCoach && player.parent2Name && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Parent/Guardian 2</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{player.parent2Name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <a href={`tel:${player.parent2Phone}`} style={{ color: "var(--blue)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <span>📞</span><span>{player.parent2Phone}</span>
              </a>
              <a href={`mailto:${player.parent2Email}`} style={{ color: "var(--blue)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <span>✉️</span><span>{player.parent2Email}</span>
              </a>
            </div>
          </div>
        )}
        
      </div>
      
      {showEditModal && <EditPlayerModal player={player} onClose={() => setShowEditModal(false)} onSave={(updatedPlayer) => { alert('Player updated!'); setShowEditModal(false); }} />}
    </div>
  );
}

function PlanDetailScreen({ plan, onBack, onUsePlan }) {
  return (
    <div>
      <div className="top-header"><div className="back-btn" onClick={onBack}>← Back</div><h2>Practice Plan</h2></div>
      <div style={{ padding: 16, paddingBottom: 32 }}>
        <div style={{ fontFamily: "Barlow Condensed", fontSize: 24, fontWeight: 900, marginBottom: 4 }}>{plan.title}</div>
        <div style={{ color: "var(--orange)", fontWeight: 600, marginBottom: 4 }}>⏱ {plan.duration} minutes total</div>
        {plan.description && <div style={{ fontSize: 14, color: "var(--gray1)", marginBottom: 16, lineHeight: 1.5 }}>{plan.description}</div>}
        {plan.segments.map((s, i) => (
          <div key={s.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--navy3)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed", fontWeight: 900, color: "var(--orange)", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "var(--orange)", marginBottom: 4 }}>{s.minutes} minutes{s.drill ? ` · 🔗 ${s.drill}` : ""}</div>
                {s.notes && <div style={{ fontSize: 13, color: "var(--gray1)", lineHeight: 1.5, marginTop: 6 }}>{s.notes}</div>}
              </div>
            </div>
          </div>
        ))}
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => onUsePlan(plan)}>Use This Plan →</button>
      </div>
    </div>
  );
}

function InviteScreen({ invites, onBack }) {
  const [copied, setCopied] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const copy = code => { try { navigator.clipboard.writeText(code); } catch(e) {} setCopied(code); setTimeout(() => setCopied(null), 2000); };
  
  return (
    <div>
      <div className="top-header"><div className="back-btn" onClick={onBack}>← Back</div><h2>Invite Management</h2></div>
      <div style={{ padding: 16, paddingBottom: 32 }}>
        <button className="btn btn-primary" style={{ width: "100%", marginBottom: 14 }} onClick={() => setShowCreateModal(true)}>+ Create New Invite</button>
        {invites.map(inv => (
          <div key={inv.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--gray1)" }}>Role: {inv.role}</span>
              <span style={{ fontSize: 11, color: "var(--gray1)" }}>Expires {inv.expires_at}</span>
            </div>
            <div className="invite-code-box">
              <div className="invite-code-label">Invite Code</div>
              <div className="invite-code">{inv.code}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--gray1)" }}>Used: {inv.uses_count}/{inv.max_uses}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-xs" onClick={() => copy(inv.code)}>{copied === inv.code ? "✓ Copied!" : "Copy Code"}</button>
                <button className="btn btn-ghost btn-xs">Revoke</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {showCreateModal && <CreateInviteModal onClose={() => setShowCreateModal(false)} onCreate={(invite) => { alert(`✅ Invite created: ${invite.code}`); setShowCreateModal(false); }} />}
    </div>
  );
}

function CreateInviteModal({ onClose, onCreate }) {
  const [f, setF] = useState({
    role: "parent",
    maxUses: "20",
    expiresIn: "7" // days
  });
  
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  
  const generateCode = (role) => {
    const roleLetters = {
      parent: "P",
      player: "PL",
      assistant_coach: "A",
      head_coach: "HC"
    };
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const random = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `HAWK-${roleLetters[role]}-${random}`;
  };
  
  const handleCreate = () => {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + parseInt(f.expiresIn));
    
    const newInvite = {
      id: `inv${Date.now()}`,
      code: generateCode(f.role),
      role: f.role,
      uses_count: 0,
      max_uses: parseInt(f.maxUses),
      expires_at: expirationDate.toISOString().split('T')[0],
      is_revoked: false
    };
    
    onCreate(newInvite);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-title">🔗 Create New Invite</div>
        
        <div className="input-group">
          <label>Role</label>
          <select className="input-field" value={f.role} onChange={e => s("role", e.target.value)} style={{ background: "var(--navy3)", color: "var(--white)" }}>
            <option value="parent">👨‍👩‍👧 Parent</option>
            <option value="player">⚾ Player</option>
            <option value="assistant_coach">🧢 Assistant Coach</option>
          </select>
          <div style={{ fontSize: 12, color: "var(--gray1)", marginTop: 4 }}>Who can join with this invite code</div>
        </div>
        
        <div className="input-group">
          <label>Max Uses</label>
          <select className="input-field" value={f.maxUses} onChange={e => s("maxUses", e.target.value)} style={{ background: "var(--navy3)", color: "var(--white)" }}>
            <option value="1">1 person</option>
            <option value="5">5 people</option>
            <option value="10">10 people</option>
            <option value="20">20 people</option>
            <option value="50">50 people</option>
            <option value="999">Unlimited</option>
          </select>
          <div style={{ fontSize: 12, color: "var(--gray1)", marginTop: 4 }}>How many times this code can be used</div>
        </div>
        
        <div className="input-group">
          <label>Expires In</label>
          <select className="input-field" value={f.expiresIn} onChange={e => s("expiresIn", e.target.value)} style={{ background: "var(--navy3)", color: "var(--white)" }}>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </select>
          <div style={{ fontSize: 12, color: "var(--gray1)", marginTop: 4 }}>When this invite code will expire</div>
        </div>
        
        <div style={{ padding: 14, background: "rgba(66,153,225,0.1)", borderRadius: 10, marginBottom: 16, border: "1px solid rgba(66,153,225,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📋 Preview</div>
          <div style={{ fontSize: 11, color: "var(--gray1)", marginBottom: 8 }}>Generated invite code:</div>
          <div className="invite-code-box" style={{ marginBottom: 0 }}>
            <div className="invite-code" style={{ fontSize: 18 }}>{generateCode(f.role)}</div>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate}>Create Invite</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   MODALS
════════════════════════════════ */
function PaywallModal({ onClose, onUpgrade, role }) {
  const [plan, setPlan] = useState("yearly");
  const features = ["Drill library & assignments", "Completion tracking + coach feedback", "Practice plan builder & templates", "Coach Inbox (to-do list)", "Smart RSVP & drill reminders", "Invite link management", "Team chat & DM settings"];
  
  // Assistant coach view - can't upgrade
  if (role === "assistant_coach") {
    return (
      <div className="paywall-overlay" onClick={onClose}>
        <div className="paywall-sheet" onClick={e => e.stopPropagation()}>
          <div className="paywall-handle" />
          <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>⭐</div>
          <div style={{ fontFamily: "Barlow Condensed", fontSize: 28, fontWeight: 900, textTransform: "uppercase", textAlign: "center" }}>Pro Features</div>
          <div style={{ fontSize: 14, color: "var(--gray1)", textAlign: "center", margin: "6px 0 24px" }}>Everything you need for elite team development</div>
          
          <div className="feature-list">
            {features.map(f => <div key={f} className="feature-item"><span className="feature-check">✓</span>{f}</div>)}
          </div>
          
          <div style={{ padding: 16, background: "rgba(244,128,26,0.1)", border: "1px solid rgba(244,128,26,0.3)", borderRadius: 12, marginTop: 20, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>👨‍🏫 Ask Your Head Coach</div>
            <div style={{ fontSize: 14, color: "var(--gray1)" }}>Only the Head Coach can upgrade the team to Pro. Ask them to enable these features for everyone!</div>
          </div>
          
          <button className="btn btn-ghost" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }
  
  // Head coach view - can upgrade
  return (
    <div className="paywall-overlay" onClick={onClose}>
      <div className="paywall-sheet" onClick={e => e.stopPropagation()}>
        <div className="paywall-handle" />
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>⭐</div>
        <div style={{ fontFamily: "Barlow Condensed", fontSize: 28, fontWeight: 900, textTransform: "uppercase", textAlign: "center" }}>Upgrade to Pro</div>
        <div style={{ fontSize: 14, color: "var(--gray1)", textAlign: "center", margin: "6px 0 24px" }}>Everything you need for elite team development</div>
        <div className="plan-cards">
          <div className={`plan-card ${plan === "monthly" ? "selected" : ""}`} onClick={() => setPlan("monthly")}>
            <div className="plan-period">Monthly</div>
            <div className="plan-price">$19.99</div>
            <div className="plan-per">/month</div>
          </div>
          <div className={`plan-card ${plan === "yearly" ? "selected" : ""}`} onClick={() => setPlan("yearly")}>
            <div className="plan-best-tag">Best Value</div>
            <div className="plan-period">Yearly</div>
            <div className="plan-price">$199</div>
            <div className="plan-per">/year</div>
            <div className="plan-save">Save $40</div>
          </div>
        </div>
        <div className="feature-list">
          {features.map(f => <div key={f} className="feature-item"><span className="feature-check">✓</span>{f}</div>)}
        </div>
        <button className="btn btn-pro" style={{ width: "100%" }} onClick={onUpgrade}>Start 7-Day Free Trial →</button>
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "var(--gray1)" }}>Cancel anytime · {plan === "yearly" ? "$199/yr" : "$19.99/mo"} after trial</div>
      </div>
    </div>
  );
}

function CreateEventModal({ onClose, onSave, preselectedPlan, isPro, setShowPaywall }) {
  const [mode, setMode] = useState(preselectedPlan ? "plan" : "custom");
  const [selectedPlan, setSelectedPlan] = useState(preselectedPlan || null);
  const [f, setF] = useState({ 
    title: preselectedPlan?.title || "", 
    type: "practice", 
    date: "", 
    time: "17:00", 
    location: "", 
    notes: preselectedPlan?.description || "", 
    opponent: "", 
    uniform: "home", 
    address: "" 
  });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  
  const handlePlanSelect = (planId) => {
    const plan = MOCK_PLANS.find(p => p.id === planId);
    setSelectedPlan(plan);
    if (plan) {
      s("title", plan.title);
      s("notes", plan.description);
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <div className="modal-title">Create Event</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["practice", "game"].map(t => <button key={t} className={`btn btn-sm ${f.type === t ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => { s("type", t); if (t === "game") setMode("custom"); }}>{t === "practice" ? "🏃 Practice" : "⚾ Game"}</button>)}
        </div>
        
        {f.type === "practice" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              className={`btn btn-sm ${mode === "plan" ? "btn-primary" : "btn-ghost"}`}
              style={{ flex: 1, position: "relative" }}
              onClick={() => {
                if (!isPro) { setShowPaywall(true); return; }
                setMode("plan");
              }}
            >
              📋 From Plan
              {!isPro && <span style={{ marginLeft: 5, fontSize: 10, background: "var(--gold)", color: "#000", borderRadius: 6, padding: "1px 5px", fontWeight: 800, verticalAlign: "middle" }}>PRO</span>}
            </button>
            <button className={`btn btn-sm ${mode === "custom" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setMode("custom")}>✏️ Custom</button>
          </div>
        )}
        
        {mode === "plan" && f.type === "practice" && (
          <>
            <div className="input-group">
              <label>Select Practice Plan</label>
              <select className="input-field" value={selectedPlan?.id || ""} onChange={e => handlePlanSelect(e.target.value)} style={{ background: "var(--navy3)", color: "var(--white)" }}>
                <option value="">Choose a practice plan...</option>
                {MOCK_PLANS.map(p => <option key={p.id} value={p.id}>{p.title} ({p.duration} min)</option>)}
              </select>
            </div>
            {selectedPlan && (
              <div style={{ marginBottom: 12, padding: 12, background: "var(--navy3)", borderRadius: 8, fontSize: 13, color: "var(--gray1)" }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--white)" }}>{selectedPlan.title}</div>
                <div style={{ marginBottom: 8 }}>{selectedPlan.description}</div>
                <div style={{ fontSize: 12, color: "var(--orange)" }}>⏱️ {selectedPlan.duration} minutes • {selectedPlan.segments.length} segments</div>
              </div>
            )}
          </>
        )}
        
        {f.type === "practice" && (
          <div className="input-group"><label>Title</label><input className="input-field" placeholder="Tuesday Practice" value={f.title} onChange={e => s("title", e.target.value)} /></div>
        )}
        
        {f.type === "game" && (
          <div className="input-group"><label>Opponent</label><input className="input-field" placeholder="Team name" value={f.opponent} onChange={e => s("opponent", e.target.value)} /></div>
        )}
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="input-group"><label>Date</label><input className="input-field" type="date" value={f.date} onChange={e => s("date", e.target.value)} /></div>
          <div className="input-group"><label>Time</label><input className="input-field" type="time" value={f.time} onChange={e => s("time", e.target.value)} /></div>
        </div>
        
        {f.type === "game" && (
          <div className="input-group">
            <label>Uniform</label>
            <select className="input-field" value={f.uniform} onChange={e => s("uniform", e.target.value)} style={{ background: "var(--navy3)", color: "var(--white)" }}>
              <option value="home">Home (White)</option>
              <option value="away">Away (Gray)</option>
              <option value="alternate">Alternate</option>
            </select>
          </div>
        )}
        
        <div className="input-group"><label>Location</label><input className="input-field" placeholder="Field name" value={f.location} onChange={e => s("location", e.target.value)} /></div>
        
        {f.type === "game" && (
          <div className="input-group"><label>Address</label><input className="input-field" placeholder="123 Main St, City, State 12345" value={f.address} onChange={e => s("address", e.target.value)} /></div>
        )}
        
        <div className="input-group"><label>Notes</label><textarea className="input-field" placeholder="What to focus on, what to bring…" value={f.notes} onChange={e => s("notes", e.target.value)} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1 }} 
            disabled={f.type === "game" ? !f.opponent || !f.date : !f.title || !f.date} 
            onClick={() => {
              const gameTitle = f.type === "game" ? `vs. ${f.opponent}` : f.title;
              onSave({ ...f, title: gameTitle, id: Date.now().toString(), starts_at: `${f.date}T${f.time}:00`, rsvp: null, practicePlan: selectedPlan });
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateDrillModal({ onClose, roster, preselectedDrill, setDrillVideos }) {
  const players = roster.filter(p => p.role === "player");
  const [mode, setMode] = useState(preselectedDrill ? "library" : "library");
  const [selectedLibraryDrill, setSelectedLibraryDrill] = useState(preselectedDrill || null);
  const [f, setF] = useState({ title: "", category: "Hitting", description: "", dueDate: "", videoUrl: "" });
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedPlayers([]);
      setSelectAll(false);
    } else {
      setSelectedPlayers(players.map(p => p.id));
      setSelectAll(true);
    }
  };
  
  const togglePlayer = (playerId) => {
    if (selectedPlayers.includes(playerId)) {
      const newSelected = selectedPlayers.filter(id => id !== playerId);
      setSelectedPlayers(newSelected);
      setSelectAll(false);
    } else {
      const newSelected = [...selectedPlayers, playerId];
      setSelectedPlayers(newSelected);
      if (newSelected.length === players.length) {
        setSelectAll(true);
      }
    }
  };
  
  const handleAssign = () => {
    if (selectedPlayers.length === 0) return;
    if (mode === "library" && !selectedLibraryDrill) return;
    if (mode === "custom" && !f.title) return;
    
    // Save video URL if provided for custom drills
    if (mode === "custom" && f.videoUrl.trim() && setDrillVideos) {
      const customId = `custom_${Date.now()}`;
      setDrillVideos(p => ({ ...p, [customId]: f.videoUrl.trim() }));
    }
    // Save video URL for library drills too if provided
    if (mode === "library" && f.videoUrl.trim() && selectedLibraryDrill && setDrillVideos) {
      setDrillVideos(p => ({ ...p, [selectedLibraryDrill.id]: f.videoUrl.trim() }));
    }
    
    alert(`Drill assigned to ${selectedPlayers.length} player${selectedPlayers.length > 1 ? 's' : ''}`);
    onClose();
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <div className="modal-title">Assign Drill</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button className={`btn btn-sm ${mode === "library" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setMode("library")}>From Library</button>
          <button className={`btn btn-sm ${mode === "custom" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setMode("custom")}>Custom</button>
        </div>
        
        {mode === "library" ? (
          <>
            <div className="input-group">
              <label>Select Drill</label>
              <select className="input-field" value={selectedLibraryDrill?.id || ""} onChange={e => setSelectedLibraryDrill(ALL_DRILLS.find(d => d.id === e.target.value))} style={{ background: "var(--navy3)", color: "var(--white)" }}>
                <option value="">Choose a drill...</option>
                {ALL_DRILLS.map(d => <option key={d.id} value={d.id}>{d.category}: {d.title}</option>)}
              </select>
            </div>
            {selectedLibraryDrill && (
              <div style={{ marginBottom: 12, padding: 10, background: "var(--navy3)", borderRadius: 8, fontSize: 13, color: "var(--gray1)", maxHeight: 120, overflowY: "auto" }}>
                {selectedLibraryDrill.description}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="input-group"><label>Title</label><input className="input-field" placeholder="Tee Work – Inside Pitch" value={f.title} onChange={e => s("title", e.target.value)} /></div>
            <div className="input-group"><label>Category</label><select className="input-field" value={f.category} onChange={e => s("category", e.target.value)} style={{ background: "var(--navy3)", color: "var(--white)" }}>{["Hitting", "Pitching", "Fielding", "Baserunning", "Catching", "Throwing", "Conditioning", "Mental Skills"].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="input-group"><label>Instructions</label><textarea className="input-field" placeholder="Step by step drill instructions…" value={f.description} onChange={e => s("description", e.target.value)} /></div>
          </>
        )}

        {/* Video URL — available for both library and custom */}
        <div className="input-group">
          <label>🎥 Demo Video URL <span style={{ fontWeight: 400, color: "var(--gray1)", fontSize: 11 }}>(optional)</span></label>
          <input
            className="input-field"
            placeholder="YouTube or video link..."
            value={f.videoUrl}
            onChange={e => s("videoUrl", e.target.value)}
          />
          {f.videoUrl.trim() && (f.videoUrl.includes("youtube.com") || f.videoUrl.includes("youtu.be")) && (
            <div style={{ fontSize: 11, color: "var(--green)", marginTop: 4 }}>✓ YouTube link detected — will embed in drill</div>
          )}
        </div>

        <div className="input-group">
          <label>Assign To</label>
          <div 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 12, 
              padding: 12, 
              background: "var(--navy3)", 
              borderRadius: 8, 
              marginBottom: 8,
              cursor: "pointer"
            }}
            onClick={handleSelectAll}
          >
            <div style={{ 
              width: 20, 
              height: 20, 
              borderRadius: 4, 
              border: "2px solid var(--orange)", 
              background: selectAll ? "var(--orange)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "white"
            }}>
              {selectAll && "✓"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Entire Team</div>
              <div style={{ fontSize: 12, color: "var(--gray1)" }}>{players.length} players</div>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {players.map(player => {
              const isSelected = selectedPlayers.includes(player.id);
              return (
                <div 
                  key={player.id}
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 10, 
                    padding: 8, 
                    background: isSelected ? "rgba(244, 128, 26, 0.1)" : "var(--navy2)", 
                    borderRadius: 6,
                    border: isSelected ? "1px solid var(--orange)" : "1px solid rgba(255,255,255,0.05)",
                    cursor: "pointer"
                  }}
                  onClick={() => togglePlayer(player.id)}
                >
                  <div style={{ 
                    width: 18, 
                    height: 18, 
                    borderRadius: 4, 
                    border: `2px solid ${isSelected ? "var(--orange)" : "rgba(255,255,255,0.2)"}`, 
                    background: isSelected ? "var(--orange)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "white"
                  }}>
                    {isSelected && "✓"}
                  </div>
                  <div style={{ fontSize: 24 }}>{player.picture}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{player.name}</div>
                    <div style={{ fontSize: 11, color: "var(--gray1)" }}>#{player.number} • {player.positions.join(", ")}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="input-group"><label>Due Date</label><input className="input-field" type="date" value={f.dueDate} onChange={e => s("dueDate", e.target.value)} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1 }} 
            disabled={(mode === "library" ? !selectedLibraryDrill : !f.title) || selectedPlayers.length === 0}
            onClick={handleAssign}
          >
            Assign ({selectedPlayers.length})
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   INBOX ACTION MODALS
════════════════════════════════ */

function MessageNonRespondersModal({ event, nonResponders, onClose, onSend }) {
  const [message, setMessage] = useState("");
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">📢 Message Non-Responders</div>
        <div style={{ fontSize: 13, color: "var(--gray1)", marginBottom: 14 }}>
          Sending to {nonResponders.length} {nonResponders.length === 1 ? 'parent' : 'parents'} who haven't RSVP'd for:
        </div>
        
        {/* Event Info */}
        <div style={{ background: "var(--navy3)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{event.title}</div>
          <div style={{ fontSize: 13, color: "var(--orange)" }}>📅 {fmt(event.starts_at)} • {fmtT(event.starts_at)}</div>
        </div>
        
        {/* Non-Responder List */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Recipients</div>
          <div style={{ background: "var(--navy3)", borderRadius: 10, padding: 12, maxHeight: 150, overflowY: "auto" }}>
            {nonResponders.map((name, i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--chalk)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--orange)" }}>•</span> {name}
              </div>
            ))}
          </div>
        </div>
        
        {/* Message */}
        <div className="input-group">
          <label>Message</label>
          <textarea 
            className="input-field" 
            placeholder="Type your message..." 
            value={message} 
            onChange={e => setMessage(e.target.value)}
            rows={4}
            style={{ minHeight: 100 }}
          />
        </div>
        
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1 }} 
            onClick={() => { onSend(message); onClose(); }}
            disabled={!message.trim()}
          >
            Send ({nonResponders.length})
          </button>
        </div>
      </div>
    </div>
  );
}

function SendReminderModal({ drill, assignedPlayers, onClose, onSend }) {
  const [message, setMessage] = useState("");
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">⏰ Send Drill Reminder</div>
        
        {/* Drill Info */}
        <div style={{ background: "var(--navy3)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{drill.title}</div>
          <div style={{ fontSize: 13, color: "var(--red)" }}>⚠️ Overdue: {drill.due_at}</div>
        </div>
        
        {/* Assigned Players */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Assigned To ({assignedPlayers.length} {assignedPlayers.length === 1 ? 'player' : 'players'})
          </div>
          <div style={{ background: "var(--navy3)", borderRadius: 10, padding: 12, maxHeight: 120, overflowY: "auto" }}>
            {assignedPlayers.map((player, i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--chalk)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{player.picture}</span> {player.name} #{player.number}
              </div>
            ))}
          </div>
        </div>
        
        {/* Reminder Message */}
        <div className="input-group">
          <label>Reminder Message</label>
          <textarea 
            className="input-field" 
            placeholder="Type reminder message..." 
            value={message} 
            onChange={e => setMessage(e.target.value)}
            rows={4}
          />
        </div>
        
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1 }} 
            onClick={() => { onSend(message); onClose(); }}
            disabled={!message.trim()}
          >
            Send Reminder
          </button>
        </div>
      </div>
    </div>
  );
}

function AttachPlanModal({ event, plans, onClose, onAttach }) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-title">📝 Attach Practice Plan</div>
        
        {/* Event Info */}
        <div style={{ fontSize: 13, color: "var(--gray1)", marginBottom: 14 }}>
          Select a practice plan to attach to:
        </div>
        <div style={{ background: "var(--navy3)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{event.title}</div>
          <div style={{ fontSize: 13, color: "var(--orange)" }}>📅 {fmt(event.starts_at)} • {fmtT(event.starts_at)}</div>
        </div>
        
        {/* Plan Selector */}
        <div style={{ marginBottom: 16, maxHeight: 300, overflowY: "auto" }}>
          {plans.map(plan => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              style={{
                background: selectedPlan === plan.id ? "rgba(244,128,26,0.15)" : "var(--navy3)",
                border: `1.5px solid ${selectedPlan === plan.id ? "var(--orange)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 10,
                padding: 12,
                marginBottom: 8,
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{plan.title}</div>
                <span style={{ 
                  background: "rgba(66,153,225,0.15)", 
                  color: "var(--blue)", 
                  fontSize: 11, 
                  fontWeight: 700, 
                  padding: "3px 8px", 
                  borderRadius: 6 
                }}>
                  ⏱ {plan.duration}m
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--gray1)", marginBottom: 6 }}>
                {plan.segments.length} segments
              </div>
              {plan.description && (
                <div style={{ fontSize: 11, color: "var(--gray1)", lineHeight: 1.4 }}>
                  {plan.description}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1 }}
            disabled={!selectedPlan}
            onClick={() => { onAttach(selectedPlan); onClose(); }}
          >
            Attach Plan
          </button>
        </div>
      </div>
    </div>
  );
}

function AddPlayerModal({ onClose, onSave }) {
  const [f, setF] = useState({
    name: "",
    number: "",
    positions: [],
    bats: "R",
    throws: "R",
    skillNotes: "",
    parent1Name: "",
    parent1Phone: "",
    parent1Email: "",
    parent2Name: "",
    parent2Phone: "",
    parent2Email: ""
  });
  
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  
  const positionOptions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  
  const togglePosition = (pos) => {
    if (f.positions.includes(pos)) {
      s("positions", f.positions.filter(p => p !== pos));
    } else {
      s("positions", [...f.positions, pos]);
    }
  };
  
  const handleSave = () => {
    if (!f.name || !f.number) {
      alert("Player name and number are required");
      return;
    }
    if (f.positions.length === 0) {
      alert("Please select at least one position");
      return;
    }
    // Create new player object
    const newPlayer = {
      id: `p${Date.now()}`,
      role: "player",
      picture: "👦",
      ...f
    };
    onSave(newPlayer);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-title">➕ Add New Player</div>
        
        {/* Player Info Section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Player Information</div>
          
          <div className="input-group">
            <label>Player Name *</label>
            <input className="input-field" placeholder="Jake Rivera" value={f.name} onChange={e => s("name", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Jersey Number *</label>
            <input className="input-field" placeholder="12" value={f.number} onChange={e => s("number", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Positions *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {positionOptions.map(pos => (
                <div
                  key={pos}
                  onClick={() => togglePosition(pos)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: f.positions.includes(pos) ? "var(--orange)" : "var(--navy3)",
                    border: `1.5px solid ${f.positions.includes(pos) ? "var(--orange)" : "rgba(255,255,255,0.1)"}`,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    color: f.positions.includes(pos) ? "var(--white)" : "var(--gray1)",
                    transition: "all 0.15s"
                  }}
                >
                  {pos}
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="input-group">
              <label>Bats</label>
              <select className="input-field" value={f.bats} onChange={e => s("bats", e.target.value)} style={{ background: "var(--navy3)", color: "var(--white)" }}>
                <option value="R">Right</option>
                <option value="L">Left</option>
                <option value="B">Both</option>
              </select>
            </div>
            <div className="input-group">
              <label>Throws</label>
              <select className="input-field" value={f.throws} onChange={e => s("throws", e.target.value)} style={{ background: "var(--navy3)", color: "var(--white)" }}>
                <option value="R">Right</option>
                <option value="L">Left</option>
              </select>
            </div>
          </div>
          
          <div className="input-group">
            <label>Skill Notes</label>
            <textarea className="input-field" placeholder="Coaching notes about player's skills..." value={f.skillNotes} onChange={e => s("skillNotes", e.target.value)} rows={3} />
          </div>
        </div>
        
        {/* Parent 1 Section */}
        <div style={{ marginBottom: 16, padding: 14, background: "rgba(244,128,26,0.05)", borderRadius: 10, border: "1px solid rgba(244,128,26,0.2)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Parent/Guardian 1</div>
          
          <div className="input-group">
            <label>Full Name</label>
            <input className="input-field" placeholder="Sarah Rivera" value={f.parent1Name} onChange={e => s("parent1Name", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Phone Number</label>
            <input className="input-field" type="tel" placeholder="(816) 555-0123" value={f.parent1Phone} onChange={e => s("parent1Phone", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Email Address</label>
            <input className="input-field" type="email" placeholder="sarah.rivera@email.com" value={f.parent1Email} onChange={e => s("parent1Email", e.target.value)} />
          </div>
        </div>
        
        {/* Parent 2 Section */}
        <div style={{ marginBottom: 16, padding: 14, background: "rgba(244,128,26,0.05)", borderRadius: 10, border: "1px solid rgba(244,128,26,0.2)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Parent/Guardian 2 (Optional)</div>
          
          <div className="input-group">
            <label>Full Name</label>
            <input className="input-field" placeholder="Carlos Rivera" value={f.parent2Name} onChange={e => s("parent2Name", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Phone Number</label>
            <input className="input-field" type="tel" placeholder="(816) 555-0223" value={f.parent2Phone} onChange={e => s("parent2Phone", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Email Address</label>
            <input className="input-field" type="email" placeholder="carlos.rivera@email.com" value={f.parent2Email} onChange={e => s("parent2Email", e.target.value)} />
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Add Player</button>
        </div>
      </div>
    </div>
  );
}

function EditPlayerModal({ player, onClose, onSave }) {
  const [f, setF] = useState({
    name: player.name || "",
    number: player.number || "",
    positions: player.positions || [],
    bats: player.bats || "R",
    throws: player.throws || "R",
    skillNotes: player.skillNotes || "",
    parent1Name: player.parent1Name || "",
    parent1Phone: player.parent1Phone || "",
    parent1Email: player.parent1Email || "",
    parent2Name: player.parent2Name || "",
    parent2Phone: player.parent2Phone || "",
    parent2Email: player.parent2Email || ""
  });
  
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  
  const positionOptions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  
  const togglePosition = (pos) => {
    if (f.positions.includes(pos)) {
      s("positions", f.positions.filter(p => p !== pos));
    } else {
      s("positions", [...f.positions, pos]);
    }
  };
  
  const handleSave = () => {
    if (!f.name || !f.number) {
      alert("Player name and number are required");
      return;
    }
    onSave({ ...player, ...f });
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-title">✏️ Edit Player</div>
        
        {/* Player Info Section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gray1)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Player Information</div>
          
          <div className="input-group">
            <label>Player Name</label>
            <input className="input-field" placeholder="Jake Rivera" value={f.name} onChange={e => s("name", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Jersey Number</label>
            <input className="input-field" placeholder="12" value={f.number} onChange={e => s("number", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Positions</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {positionOptions.map(pos => (
                <div
                  key={pos}
                  onClick={() => togglePosition(pos)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: f.positions.includes(pos) ? "var(--orange)" : "var(--navy3)",
                    border: `1.5px solid ${f.positions.includes(pos) ? "var(--orange)" : "rgba(255,255,255,0.1)"}`,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    color: f.positions.includes(pos) ? "var(--white)" : "var(--gray1)",
                    transition: "all 0.15s"
                  }}
                >
                  {pos}
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="input-group">
              <label>Bats</label>
              <select className="input-field" value={f.bats} onChange={e => s("bats", e.target.value)} style={{ background: "var(--navy3)", color: "var(--white)" }}>
                <option value="R">Right</option>
                <option value="L">Left</option>
                <option value="B">Both</option>
              </select>
            </div>
            <div className="input-group">
              <label>Throws</label>
              <select className="input-field" value={f.throws} onChange={e => s("throws", e.target.value)} style={{ background: "var(--navy3)", color: "var(--white)" }}>
                <option value="R">Right</option>
                <option value="L">Left</option>
              </select>
            </div>
          </div>
          
          <div className="input-group">
            <label>Skill Notes</label>
            <textarea className="input-field" placeholder="Coaching notes about player's skills..." value={f.skillNotes} onChange={e => s("skillNotes", e.target.value)} rows={3} />
          </div>
        </div>
        
        {/* Parent 1 Section */}
        <div style={{ marginBottom: 16, padding: 14, background: "rgba(244,128,26,0.05)", borderRadius: 10, border: "1px solid rgba(244,128,26,0.2)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Parent/Guardian 1</div>
          
          <div className="input-group">
            <label>Full Name</label>
            <input className="input-field" placeholder="Sarah Rivera" value={f.parent1Name} onChange={e => s("parent1Name", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Phone Number</label>
            <input className="input-field" type="tel" placeholder="(816) 555-0123" value={f.parent1Phone} onChange={e => s("parent1Phone", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Email Address</label>
            <input className="input-field" type="email" placeholder="sarah.rivera@email.com" value={f.parent1Email} onChange={e => s("parent1Email", e.target.value)} />
          </div>
        </div>
        
        {/* Parent 2 Section */}
        <div style={{ marginBottom: 16, padding: 14, background: "rgba(244,128,26,0.05)", borderRadius: 10, border: "1px solid rgba(244,128,26,0.2)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Parent/Guardian 2</div>
          
          <div className="input-group">
            <label>Full Name</label>
            <input className="input-field" placeholder="Carlos Rivera" value={f.parent2Name} onChange={e => s("parent2Name", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Phone Number</label>
            <input className="input-field" type="tel" placeholder="(816) 555-0223" value={f.parent2Phone} onChange={e => s("parent2Phone", e.target.value)} />
          </div>
          
          <div className="input-group">
            <label>Email Address</label>
            <input className="input-field" type="email" placeholder="carlos.rivera@email.com" value={f.parent2Email} onChange={e => s("parent2Email", e.target.value)} />
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function ReportModal({ onClose }) {
  const [sel, setSel] = useState(null);
  const [notes, setNotes] = useState("");
  
  const handleSubmit = () => {
    // Determine who receives this report
    const seriousIssues = ["Harassment", "Inappropriate for kids"];
    const isSeriousIssue = seriousIssues.includes(sel);
    
    if (isSeriousIssue) {
      // Serious issues go to both Platform Support and Head Coach
      alert("✅ Report submitted to:\n• Coach Connect Pro Support Team\n• Your Head Coach\n\nOur team will review this within 24 hours.");
    } else {
      // Minor issues go to Head Coach only
      alert("✅ Report submitted to your Head Coach.\n\nThey will review and address this issue.");
    }
    
    onClose();
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">🚩 Report Message</div>
        <div style={{ fontSize: 13, color: "var(--gray1)", marginBottom: 14 }}>Select a reason:</div>
        {["Harassment", "Spam", "Inappropriate for kids", "Other"].map(r => (
          <div key={r} className={`report-reason ${sel === r ? "selected" : ""}`} onClick={() => setSel(r)}>{r}</div>
        ))}
        
        {sel && (
          <div style={{ 
            marginTop: 14, 
            padding: 12, 
            background: "rgba(66,153,225,0.1)", 
            border: "1px solid rgba(66,153,225,0.3)", 
            borderRadius: 10 
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", marginBottom: 6 }}>
              📬 Report will be sent to:
            </div>
            <div style={{ fontSize: 12, color: "var(--gray1)" }}>
              {sel === "Harassment" || sel === "Inappropriate for kids" ? (
                <>
                  • <strong>Coach Connect Pro Support Team</strong> (priority review)<br/>
                  • Your Head Coach
                </>
              ) : (
                <>• Your Head Coach</>
              )}
            </div>
          </div>
        )}
        
        {sel === "Other" && (
          <div className="input-group" style={{ marginTop: 8 }}>
            <label>Additional Notes</label>
            <textarea 
              className="input-field" 
              placeholder="Describe the issue…" 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
            />
          </div>
        )}
        
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" style={{ flex: 1 }} disabled={!sel} onClick={handleSubmit}>Submit Report</button>
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ drill, onClose }) {
  const [status, setStatus] = useState(null);
  const [note, setNote] = useState("");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Coach Feedback</div>
        <div style={{ fontSize: 13, color: "var(--gray1)", marginBottom: 16 }}>{drill.title}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[["good", "👍", "GOOD WORK", "var(--green)", "rgba(56,161,105,0.15)"], ["needs_work", "⚠️", "NEEDS WORK", "var(--red)", "rgba(229,62,62,0.15)"]].map(([k, icon, label, color, bg]) => (
            <div key={k} style={{ flex: 1, background: status === k ? bg : "var(--navy3)", border: `2px solid ${status === k ? color : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "14px 10px", textAlign: "center", cursor: "pointer" }} onClick={() => setStatus(k)}>
              <div style={{ fontSize: 28 }}>{icon}</div>
              <div style={{ fontFamily: "Barlow Condensed", fontSize: 14, fontWeight: 800, color: status === k ? color : "var(--chalk)" }}>{label}</div>
            </div>
          ))}
        </div>
        <div className="input-group"><label>Note</label><textarea className="input-field" placeholder="Great hip rotation! Keep the elbow up…" value={note} onChange={e => setNote(e.target.value)} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!status} onClick={onClose}>Send Feedback</button>
        </div>
      </div>
    </div>
  );
}
