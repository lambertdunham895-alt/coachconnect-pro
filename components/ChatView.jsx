import React, { useState, useEffect, useRef } from "react";
import { C, Avatar, supabase, fmtTime, avatarColor, toast, signedUrl, SignedMedia } from "../App";

// ─── CHAT VIEW ────────────────────────────────────────────────────────────────
function ChatView({channelId,messages,onSend,myId,onOpen,players,teamLogo,onTeamLogoChange,teamName,teamId,blockedUsers=[],onBlock=()=>{},onUnblock=()=>{},onReport=()=>{}}) {
  const [text,setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // {file, preview, type, name}
  const [msgMenu, setMsgMenu] = useState(null); // {msg, x, y} for context menu
  const [reportModal, setReportModal] = useState(null); // msg being reported
  const [reportReason, setReportReason] = useState("");
  const [reactions, setReactions] = useState({}); // {msgId: [{emoji,userId,userName}]}
  const [reactionPicker, setReactionPicker] = useState(null); // msgId to show picker for
  const [showQuickMsgs, setShowQuickMsgs] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const isTeam = channelId==="team";
  const isCoach = myId==="coach";
  const BASEBALL_EMOJIS = ["⚾","🔥","💪","👏","🏆","👍","👎"];
  const QUICK_MESSAGES = [
    {icon:"🚫",label:"Practice Canceled",text:"Practice is canceled today. Stay safe and we'll see you next time!"},
    {icon:"⏰",label:"Game Time Change",text:"Heads up — game time has changed. Check the schedule for updated details."},
    {icon:"💧",label:"Bring Water",text:"Reminder: bring plenty of water tomorrow. It's going to be a hot one!"},
    {icon:"⚾",label:"Great Job Today",text:"Great job out there today, team! Really proud of the effort. Keep it up! 🔥"},
    {icon:"📋",label:"Check Schedule",text:"Make sure to check the schedule — we have some upcoming events you don't want to miss."},
    {icon:"🧤",label:"Don't Forget Gear",text:"Reminder: make sure your player has all their gear ready for tomorrow. Glove, helmet, cleats!"},
  ];
  const teamInitials = teamName
    ? teamName.split(/\s+/).filter(Boolean).map(w=>w[0].toUpperCase()).slice(0,3).join("")
    : "TC";

  // Load reactions for this channel's messages
  useEffect(()=>{
    if(!teamId) return;
    const msgIds = messages.map(m=>m.id);
    if(msgIds.length===0) return;
    supabase.from("message_reactions").select("*").eq("team_id",teamId).in("message_id",msgIds).then(({data})=>{
      if(!data) return;
      const grouped = {};
      data.forEach(r=>{
        if(!grouped[r.message_id]) grouped[r.message_id]=[];
        grouped[r.message_id].push({emoji:r.emoji,userId:r.user_id,userName:r.user_name,id:r.id});
      });
      setReactions(grouped);
    });
  },[messages.length,teamId]);

  const toggleReaction = async (msgId, emoji) => {
    const myName = isCoach ? "Coach" : (players.find(p=>p.parent1email||p.parent2email)?.parent1||"Parent");
    const existing = (reactions[msgId]||[]).find(r=>r.emoji===emoji && r.userId===myId);
    if(existing) {
      // Remove reaction
      await supabase.from("message_reactions").delete().eq("id",existing.id);
      setReactions(prev=>({...prev,[msgId]:(prev[msgId]||[]).filter(r=>r.id!==existing.id)}));
    } else {
      // Add reaction
      const id = Date.now().toString(36)+Math.random().toString(36).slice(2);
      const row = {id,message_id:msgId,user_id:myId,user_name:myName,emoji,team_id:teamId};
      await supabase.from("message_reactions").insert(row);
      setReactions(prev=>({...prev,[msgId]:[...(prev[msgId]||[]),{emoji,userId:myId,userName:myName,id}]}));
    }
    setReactionPicker(null);
  };

  // Close reaction picker when tapping outside
  useEffect(()=>{
    if(!reactionPicker) return;
    const close = (e) => {
      // Don't close if tapping inside the picker itself
      if(e.target.closest && e.target.closest('[data-reaction-picker]')) return;
      setReactionPicker(null);
    };
    // Delay so the long-press touchend doesn't immediately close it
    const t = setTimeout(()=>{
      document.addEventListener('click', close);
      document.addEventListener('touchstart', close);
    }, 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
      document.removeEventListener('touchstart', close);
    };
  },[reactionPicker]);

  // Filter out messages from blocked users
  const myBlockedIds = blockedUsers.filter(b=>b.userId===myId).map(b=>b.blockedUserId);
  const filteredMessages = messages.filter(m=>!myBlockedIds.includes(m.senderId));

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onTeamLogoChange(ev.target.result);
    reader.readAsDataURL(file);
  };

  useEffect(()=>{
    onOpen();
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"auto"}),60);
  },[channelId]);

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[filteredMessages.length]);

  const send = async () => {
    if(!text.trim() && !pendingFile) return;
    let attachment = null;
    if(pendingFile) {
      setUploading(true);
      const ext = pendingFile.name.split('.').pop();
      const path = `${teamId||'local'}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('chat-attachments').upload(path, pendingFile.file);
      if(!error) {
        // Buckets are private and signed URLs expire, so the message stores the
        // storage PATH; every viewer signs it fresh at render time (SignedMedia).
        attachment = { path, name: pendingFile.name, type: pendingFile.type, size: pendingFile.file.size };
      }
      setUploading(false);
      setPendingFile(null);
    }
    onSend(text.trim(), attachment);
    setText("");
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const isImage = file.type.startsWith('image/');
    const preview = isImage ? URL.createObjectURL(file) : null;
    setPendingFile({ file, preview, type: isImage ? 'image' : 'document', name: file.name });
    e.target.value = '';
  };

  // Group messages into date buckets (using filtered messages)
  const grouped = [];
  let lastDate = null;
  filteredMessages.forEach(m=>{
    const d = new Date(m.ts).toDateString();
    if(d!==lastDate){ grouped.push({type:"date",label:d===new Date().toDateString()?"Today":new Date(m.ts).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}); lastDate=d; }
    grouped.push({type:"msg",...m});
  });

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 56px - 72px)"}}>
      {/* Channel info bar */}
      {isTeam&&(
        <div style={{padding:"10px 16px",background:`${C.card}`,borderBottom:`1px solid ${C.border}`,display:"flex",gap:12,alignItems:"center"}}>
          {/* Team logo — tappable for coach, display-only for others */}
          <div style={{position:"relative",flexShrink:0}}>
            {teamLogo
              ? <img src={teamLogo} alt="Team logo" style={{width:44,height:44,borderRadius:10,objectFit:"cover",border:`2px solid ${C.red}60`,boxShadow:`0 2px 10px ${C.red}30`}}/>
              : <div style={{width:44,height:44,borderRadius:10,background:`linear-gradient(135deg,#1a3a7a,#0a1f50)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 2px 10px ${C.blue}20`}}>
                  <span style={{fontFamily:"Bebas Neue, sans-serif",fontSize:16,letterSpacing:1,color:"#fff"}}>{teamInitials}</span>
                </div>
            }
            {isCoach&&(
              <label style={{position:"absolute",inset:0,cursor:"pointer",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.35)",opacity:0,transition:"opacity 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity=1}
                onMouseLeave={e=>e.currentTarget.style.opacity=0}
              >
                <span style={{fontSize:14}}>📷</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{display:"none"}}/>
              </label>
            )}
          </div>

          {/* Team info + member avatars */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:14,color:C.text,letterSpacing:0.5,marginBottom:4}}>
              Team Chat
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{display:"flex"}}>
                {players.slice(0,5).map((p,i)=>(
                  <div key={p.id} style={{marginLeft:i>0?-6:0,zIndex:5-i,position:"relative"}}>
                    <Avatar name={p.parents?.[0]?.name||p.name} size={22}/>
                  </div>
                ))}
              </div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:11,color:C.textMid,letterSpacing:0.8}}>
                Coach + {players.length} families
              </div>
            </div>
          </div>

          {/* Coach-only: change logo hint */}
          {isCoach&&(
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:10,color:C.textDim,letterSpacing:0.8,flexShrink:0,textAlign:"center"}}>
              Edit on<br/>Home tab
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="msg-list" style={{flex:1,overflowY:"auto",padding:"16px 12px",display:"flex",flexDirection:"column",gap:2}}>
        {grouped.map((item,idx)=>{
          if(item.type==="date") return (
            <div key={idx} style={{textAlign:"center",margin:"12px 0 8px",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>{item.label}</div>
          );

          const isMe = item.senderId===myId;
          const prevMsg = grouped[idx-1];
          const nextMsg = grouped[idx+1];
          const isSameAsPrev = prevMsg?.type==="msg" && prevMsg.senderId===item.senderId;
          const isSameAsNext = nextMsg?.type==="msg" && nextMsg.senderId===item.senderId;
          const showAvatar = !isMe && !isSameAsNext;
          const showName   = !isMe && !isSameAsPrev;

          return (
            <div key={item.id} className="pop-in" style={{display:"flex",flexDirection:isMe?"row-reverse":"row",gap:8,alignItems:"flex-end",marginBottom:isSameAsNext?2:8,userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none",MozUserSelect:"none",msUserSelect:"none"}}
              onContextMenu={(e)=>{e.preventDefault();setReactionPicker(item.id);setMsgMenu(null);}}
              onTouchStart={(e)=>{
                const el=e.currentTarget;
                el._lpFired=false;
                const t=setTimeout(()=>{
                  el._lpFired=true;
                  setReactionPicker(item.id);
                  setMsgMenu(null);
                  if(navigator.vibrate)navigator.vibrate(20);
                },500);
                el._lpt=t;
              }}
              onTouchEnd={(e)=>{
                clearTimeout(e.currentTarget._lpt);
                if(e.currentTarget._lpFired){e.preventDefault();e.currentTarget._lpFired=false;}
              }}
              onTouchMove={(e)=>{clearTimeout(e.currentTarget._lpt);}}
              onTouchCancel={(e)=>{clearTimeout(e.currentTarget._lpt);}}
            >
              {/* Avatar placeholder to keep alignment */}
              {!isMe&&(
                <div style={{width:32,flexShrink:0}}>
                  {showAvatar&&<Avatar name={item.senderName} size={32}/>}
                </div>
              )}
              <div style={{maxWidth:"72%",display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start"}}>
                {showName&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,color:avatarColor(item.senderName),letterSpacing:1,marginBottom:3,paddingLeft:4}}>{item.senderName}</div>}
                <div style={{
                  background:isMe?`linear-gradient(135deg,${C.msgMe},#162840)`:`${C.msgOther}`,
                  border:`1px solid ${isMe?C.blue+"50":C.border}`,
                  borderRadius: isMe
                    ? `16px 16px ${isSameAsNext?"16px":"4px"} 16px`
                    : `16px 16px 16px ${isSameAsNext?"16px":"4px"}`,
                  padding:"10px 14px",
                  boxShadow: isMe?`0 2px 12px ${C.blue}20`:`0 2px 8px #00000030`,
                  position:"relative",
                }}>
                  {item.text&&<div style={{fontSize:14,color:C.text,lineHeight:1.55}}>{item.text}</div>}
                  {item.attachment && item.attachment.type==='image' && (
                    <SignedMedia bucket="chat-attachments" pathOrUrl={item.attachment.path || item.attachment.url}>
                      {url=>(
                        <a href={url} target="_blank" rel="noopener noreferrer" style={{display:"block",marginTop:item.text?6:0}}>
                          <img src={url} alt={item.attachment.name||"Photo"} style={{maxWidth:"100%",maxHeight:240,borderRadius:10,objectFit:"cover",display:"block"}}/>
                        </a>
                      )}
                    </SignedMedia>
                  )}
                  {item.attachment && item.attachment.type==='document' && (
                    <SignedMedia bucket="chat-attachments" pathOrUrl={item.attachment.path || item.attachment.url}>
                      {url=>(
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:8,marginTop:item.text?6:0,padding:"8px 12px",borderRadius:10,background:`${C.blue}15`,border:`1px solid ${C.blue}30`,textDecoration:"none"}}>
                      <span style={{fontSize:22}}>📄</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,color:C.blue,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.attachment.name}</div>
                        {item.attachment.size&&<div style={{fontSize:10,color:C.textDim}}>{(item.attachment.size/1024).toFixed(0)} KB</div>}
                      </div>
                      <span style={{fontSize:12,color:C.textDim}}>↓</span>
                    </a>
                      )}
                    </SignedMedia>
                  )}
                </div>
                {/* Reaction emoji picker */}
                {reactionPicker===item.id&&(
                  <div data-reaction-picker className="pop-in" onClick={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} style={{display:"flex",gap:4,padding:"6px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:20,marginTop:4,boxShadow:`0 4px 20px #00000060`,zIndex:10,position:"relative"}}>
                    {BASEBALL_EMOJIS.map(em=>{
                      const myReaction = (reactions[item.id]||[]).find(r=>r.emoji===em&&r.userId===myId);
                      return <button key={em} onClick={(e)=>{e.stopPropagation();toggleReaction(item.id,em);}} style={{width:36,height:36,borderRadius:"50%",border:"none",background:myReaction?`${C.blue}30`:"transparent",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>{em}</button>;
                    })}
                    {!isMe&&<button onClick={(e)=>{e.stopPropagation();setReactionPicker(null);setMsgMenu({msg:item,x:0,y:0});}} style={{width:36,height:36,borderRadius:"50%",border:"none",background:"transparent",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:C.textDim}}>⋯</button>}
                  </div>
                )}
                {/* Reaction display */}
                {(reactions[item.id]||[]).length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4,paddingLeft:4}}>
                    {Object.entries((reactions[item.id]||[]).reduce((acc,r)=>{acc[r.emoji]=(acc[r.emoji]||0)+1;return acc;},{})).map(([emoji,count])=>{
                      const iMine = (reactions[item.id]||[]).some(r=>r.emoji===emoji&&r.userId===myId);
                      return <button key={emoji} onClick={()=>toggleReaction(item.id,emoji)} style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:12,background:iMine?`${C.blue}25`:`${C.card}`,border:`1px solid ${iMine?C.blue+"60":C.border}`,cursor:"pointer",fontSize:14,transition:"all 0.15s"}}><span>{emoji}</span><span style={{fontSize:11,color:iMine?C.blue:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700}}>{count}</span></button>;
                    })}
                  </div>
                )}
                {(!isSameAsNext)&&<div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:9,color:C.textDim,marginTop:4,paddingLeft:4,paddingRight:4}}>{fmtTime(item.ts)}</div>}
              </div>
            </div>
          );
        })}
        {filteredMessages.length===0&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:"32px 24px",textAlign:"center"}}>
            <div style={{fontSize:40}}>💬</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:C.textMid}}>Start the conversation</div>
            <div style={{fontSize:13,color:C.textDim,lineHeight:1.6,maxWidth:240}}>Send a message to the whole team, or reach out to a parent directly from the chat list.</div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Pending file preview */}
      {pendingFile && (
        <div style={{padding:"8px 12px",background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
          {pendingFile.type==='image' ? (
            <img src={pendingFile.preview} alt="Preview" style={{width:48,height:48,borderRadius:8,objectFit:"cover"}}/>
          ) : (
            <div style={{width:48,height:48,borderRadius:8,background:`${C.blue}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>📄</div>
          )}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pendingFile.name}</div>
            <div style={{fontSize:11,color:C.textDim}}>{pendingFile.type==='image'?'Photo':'Document'} ready to send</div>
          </div>
          <button onClick={()=>setPendingFile(null)} style={{background:`${C.red}20`,border:`1px solid ${C.red}40`,borderRadius:8,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:12,color:C.red,flexShrink:0}}>✕</button>
        </div>
      )}

      {/* Quick Messages Menu */}
      {showQuickMsgs&&isCoach&&(
        <div style={{padding:"8px 12px",background:`${C.card}`,borderTop:`1px solid ${C.border}`,maxHeight:220,overflowY:"auto"}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textDim,textTransform:"uppercase",marginBottom:8,paddingLeft:4}}>Quick Messages</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {QUICK_MESSAGES.map((qm,i)=>(
              <button key={i} onClick={()=>{onSend(channelId,qm.text,{senderId:myId,senderName:"Coach"});setShowQuickMsgs(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",background:`${C.bg}`,border:`1px solid ${C.border}`,borderRadius:12,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
                <span style={{fontSize:18,flexShrink:0}}>{qm.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.text,letterSpacing:0.5}}>{qm.label}</div>
                  <div style={{fontSize:11,color:C.textDim,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{qm.text}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{padding:"10px 12px 10px",background:`${C.bg}`,borderTop:`1px solid ${C.border}`,display:"flex",gap:8,alignItems:"flex-end"}}>
        {/* Attachment button */}
        <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{width:40,height:40,borderRadius:"50%",background:`${C.blue}15`,border:`1px solid ${C.blue}40`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16,color:C.blue}}>
          📎
        </button>
        {isCoach&&<button onClick={()=>setShowQuickMsgs(q=>!q)} style={{width:40,height:40,borderRadius:"50%",background:showQuickMsgs?`${C.gold}25`:`${C.gold}15`,border:`1px solid ${showQuickMsgs?C.gold:C.gold+"40"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>⚾</button>}
        <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={handleFilePick} style={{display:"none"}}/>

        <div style={{flex:1,background:"#0a1525",border:`1px solid ${C.border}`,borderRadius:22,padding:"10px 16px",display:"flex",alignItems:"center",minHeight:44,transition:"border-color 0.2s"}}
          onFocus={e=>e.currentTarget.style.borderColor=C.blue}
          onBlur={e=>e.currentTarget.style.borderColor=C.border}>
          <textarea
            value={text}
            onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder={uploading?"Uploading...":"Type a message..."}
            rows={1}
            disabled={uploading}
            style={{flex:1,background:"transparent",border:"none",outline:"none",color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:14,lineHeight:1.5,resize:"none",padding:0,maxHeight:100,overflow:"auto"}}
          />
        </div>
        <button onClick={send} disabled={(!text.trim()&&!pendingFile)||uploading} style={{width:44,height:44,borderRadius:"50%",background:(text.trim()||pendingFile)&&!uploading?`linear-gradient(135deg,${C.red},${C.redDim})`:"#1a2f52",border:"none",cursor:(text.trim()||pendingFile)&&!uploading?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s",boxShadow:(text.trim()||pendingFile)&&!uploading?`0 4px 16px ${C.red}50`:"none"}}>
          {uploading ? (
            <div style={{width:16,height:16,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          ) : (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="#fff" strokeWidth={2} strokeLinecap="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Message Context Menu (Report / Block) ──────────────────────────── */}
      {msgMenu&&(
        <div onClick={()=>setMsgMenu(null)} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.5)"}}>
          <div onClick={e=>e.stopPropagation()} style={{position:"fixed",left:Math.min(msgMenu.x,window.innerWidth-180),top:Math.min(msgMenu.y,window.innerHeight-140),background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:6,minWidth:170,boxShadow:`0 8px 32px rgba(0,0,0,0.6)`}}>
            <button onClick={()=>{setReportModal(msgMenu.msg);setMsgMenu(null);setReportReason("");}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 14px",background:"none",border:"none",cursor:"pointer",borderRadius:10,color:C.text,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:0.5,textAlign:"left"}}
              onMouseEnter={e=>e.currentTarget.style.background="#ffffff10"}
              onMouseLeave={e=>e.currentTarget.style.background="none"}
            >
              <span style={{fontSize:16}}>🚩</span> Report Message
            </button>
            {!myBlockedIds.includes(msgMenu.msg.senderId) ? (
              <button onClick={()=>{if(window.confirm(`Block ${msgMenu.msg.senderName}? Their messages will be hidden from you.`)){onBlock(msgMenu.msg.senderId);}setMsgMenu(null);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 14px",background:"none",border:"none",cursor:"pointer",borderRadius:10,color:C.red,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:0.5,textAlign:"left"}}
                onMouseEnter={e=>e.currentTarget.style.background="#ffffff10"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}
              >
                <span style={{fontSize:16}}>🚫</span> Block {msgMenu.msg.senderName}
              </button>
            ) : (
              <button onClick={()=>{onUnblock(msgMenu.msg.senderId);setMsgMenu(null);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 14px",background:"none",border:"none",cursor:"pointer",borderRadius:10,color:C.green||"#34d399",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:0.5,textAlign:"left"}}
                onMouseEnter={e=>e.currentTarget.style.background="#ffffff10"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}
              >
                <span style={{fontSize:16}}>✅</span> Unblock {msgMenu.msg.senderName}
              </button>
            )}
            <button onClick={()=>setMsgMenu(null)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 14px",background:"none",border:"none",cursor:"pointer",borderRadius:10,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:0.5,textAlign:"left"}}
              onMouseEnter={e=>e.currentTarget.style.background="#ffffff10"}
              onMouseLeave={e=>e.currentTarget.style.background="none"}
            >
              <span style={{fontSize:16}}>✕</span> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Report Modal ──────────────────────────────────────────────────── */}
      {reportModal&&(
        <div onClick={()=>setReportModal(null)} style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:24,width:"100%",maxWidth:360,boxShadow:`0 12px 48px rgba(0,0,0,0.5)`}}>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:2,color:C.text,marginBottom:4}}>Report Message</div>
            <div style={{fontSize:12,color:C.textDim,marginBottom:16,lineHeight:1.5}}>
              From <span style={{color:C.text,fontWeight:600}}>{reportModal.senderName}</span>: "{(reportModal.text||"[attachment]").substring(0,80)}{(reportModal.text||"").length>80?"...":""}"
            </div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,color:C.textMid,letterSpacing:1,marginBottom:8}}>SELECT A REASON</div>
            {["Inappropriate content","Harassment or bullying","Spam","Other"].map(r=>(
              <button key={r} onClick={()=>setReportReason(r)} style={{display:"block",width:"100%",padding:"10px 14px",marginBottom:6,background:reportReason===r?`${C.red}20`:"#ffffff08",border:`1px solid ${reportReason===r?C.red+"60":C.border}`,borderRadius:10,color:reportReason===r?C.red:C.text,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:0.5,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
                {r}
              </button>
            ))}
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button onClick={()=>setReportModal(null)} style={{flex:1,padding:"12px 0",borderRadius:10,border:`1px solid ${C.border}`,background:"none",color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:1,cursor:"pointer"}}>Cancel</button>
              <button onClick={()=>{if(reportReason){onReport(reportModal,reportReason);setReportModal(null);toast.success("Report submitted. Thank you.");}}} disabled={!reportReason} style={{flex:1,padding:"12px 0",borderRadius:10,border:"none",background:reportReason?`linear-gradient(135deg,${C.red},${C.redDim})`:"#333",color:reportReason?"#fff":"#666",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:1,cursor:reportReason?"pointer":"default",boxShadow:reportReason?`0 4px 16px ${C.red}40`:"none"}}>Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatView;
