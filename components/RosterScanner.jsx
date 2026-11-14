import React, { useState, useRef } from "react";
import { C } from "../theme";
import { uid, supabase, AGE_GROUPS, scanAuthHeaders } from "../App";

// ─── ROSTER SCANNER ──────────────────────────────────────────────────────────
// Shared by the Roster screen and the onboarding flow. This used to be two
// near-identical ~150-line copies; they had already drifted (the onboarding
// copy was missing the createdAt stamp, so scanned players sorted to the bottom
// of Recent Activity forever). One implementation now, two callers.
//
// Props:
//   defaultAgeGroup  age group applied to scanned players
//   onImport(players) called with the finished player objects
//   onClose()         dismiss without importing
function RosterScanner({ defaultAgeGroup, onImport, onClose }) {
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scannedPlayers, setScannedPlayers] = useState([]);
  const scanFileRef = useRef(null);

  const close = () => { setScannedPlayers([]); setScanError(""); onClose(); };

  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    setScanError("");
    setScanLoading(true);
    setScannedPlayers([]);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve,reject)=>{
        reader.onload = ()=>resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`https://hcadlkmejdekhbgfvyaq.supabase.co/functions/v1/scan-roster`, {
        method: "POST",
        headers: await scanAuthHeaders(),
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type || "image/jpeg" }),
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      if(!data.players || data.players.length===0) {
        setScanError("No players could be detected in this image. Try a clearer photo or a different section of the roster.");
      } else {
        setScannedPlayers(data.players.map((p,i)=>({...p, _localId:`scan_${Date.now()}_${i}`, _include:true})));
      }
    } catch(err) {
      setScanError("Scan failed: " + (err.message||String(err)));
    } finally {
      setScanLoading(false);
      if(scanFileRef.current) scanFileRef.current.value = "";
    }
  };

  const updateScannedPlayer = (localId, field, value) =>
    setScannedPlayers(prev => prev.map(p => p._localId===localId ? {...p, [field]:value} : p));
  const toggleScannedPlayer = (localId) =>
    setScannedPlayers(prev => prev.map(p => p._localId===localId ? {...p, _include:!p._include} : p));
  const removeScannedPlayer = (localId) =>
    setScannedPlayers(prev => prev.filter(p => p._localId!==localId));

  const importScannedPlayers = () => {
    const toAdd = scannedPlayers.filter(p => p._include && p.name && p.name.trim());
    if(toAdd.length===0) return;
    const newPlayers = toAdd.map(p => {
      const pid = uid();
      const parents = [];
      if(p.parent1 && p.parent1.trim())
        parents.push({id:pid+"a", name:p.parent1.trim(), phone:(p.parent1phone||"").trim(), email:(p.parent1email||"").trim()});
      return {
        id: pid,
        name: p.name.trim(),
        age: parseInt(p.age)||0,
        ageGroup: defaultAgeGroup || AGE_GROUPS[1],
        position: p.position||"SS",
        number: p.number||"",
        bats: p.bats||"R",
        throws: p.throws||"R",
        parents,
        goals: [],
        createdAt: Date.now(),   // keeps Recent Activity ordering correct
      };
    });
    setScannedPlayers([]);
    setScanError("");
    onImport(newPlayers);
  };

  return (
    <>
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{width:"100%",maxWidth:560,boxSizing:"border-box",background:C.bg,borderRadius:"20px 20px 0 0",padding:"20px 16px 32px",boxShadow:"0 -8px 40px #000",maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:26,letterSpacing:2,color:"#fff",lineHeight:1}}>📸 Scan Roster</div>
                <div style={{fontSize:12,color:C.textDim,marginTop:4}}>Upload a photo, let AI extract the players</div>
              </div>
              <button onClick={close} style={{width:36,height:36,borderRadius:10,background:"#ffffff10",border:`1px solid #ffffff20`,color:"#fff",fontSize:16,cursor:"pointer"}}>✕</button>
            </div>

            {scannedPlayers.length===0 && !scanLoading && (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <button onClick={()=>scanFileRef.current?.click()} style={{padding:"40px 20px",borderRadius:16,background:`${C.teal}10`,border:`2px dashed ${C.teal}60`,color:C.teal,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                  <div style={{fontSize:36}}>📷</div>
                  <div>Tap to upload roster photo</div>
                  <div style={{fontSize:11,color:C.textDim,fontFamily:"Plus Jakarta Sans, sans-serif",fontWeight:400,letterSpacing:0,textTransform:"none"}}>Team sign-up sheet, spreadsheet screenshot, email list, or handwritten list</div>
                </button>
                <input ref={scanFileRef} type="file" accept="image/*" onChange={handleScanFile} style={{display:"none"}}/>
                {scanError && <div style={{padding:"12px 14px",borderRadius:10,background:`${C.red}15`,border:`1px solid ${C.red}40`,color:C.red,fontSize:13,lineHeight:1.5}}>⚠️ {scanError}</div>}
                <div style={{padding:"14px 16px",background:C.card,borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.textMid,lineHeight:1.6}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:11,letterSpacing:2,color:C.gold,textTransform:"uppercase",marginBottom:6}}>💡 Tips</div>
                  • Clear, well-lit photos work best<br/>
                  • Names and parent contacts detected automatically<br/>
                  • You can review and edit everyone before adding
                </div>
              </div>
            )}

            {scanLoading && (
              <div style={{padding:"60px 20px",textAlign:"center"}}>
                <div style={{display:"inline-block",width:36,height:36,border:`3px solid ${C.teal}30`,borderTopColor:C.teal,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,color:C.textMid,letterSpacing:2,textTransform:"uppercase",marginTop:14}}>Reading roster...</div>
                <div style={{fontSize:12,color:C.textDim,marginTop:6}}>This usually takes 5-10 seconds</div>
              </div>
            )}

            {scannedPlayers.length>0 && !scanLoading && (
              <div>
                <div style={{padding:"12px 14px",borderRadius:10,background:`${C.teal}15`,border:`1px solid ${C.teal}40`,color:C.teal,fontSize:13,marginBottom:14,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1}}>✓ Found {scannedPlayers.length} player{scannedPlayers.length!==1?'s':''} — review and edit below</div>
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                  {scannedPlayers.map(p=>(
                    <div key={p._localId} style={{background:p._include?C.card:"#0a1525",border:`1px solid ${p._include?C.red+"40":C.border}`,borderRadius:12,padding:"12px 14px",opacity:p._include?1:0.5,transition:"all 0.2s"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <button onClick={()=>toggleScannedPlayer(p._localId)} style={{width:22,height:22,borderRadius:6,background:p._include?C.teal:"transparent",border:`1.5px solid ${p._include?C.teal:C.border}`,cursor:"pointer",color:"#fff",fontSize:13,flexShrink:0}}>{p._include?"✓":""}</button>
                        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>Player</div>
                        <button onClick={()=>removeScannedPlayer(p._localId)} style={{marginLeft:"auto",background:"transparent",border:"none",color:C.red+"99",fontSize:16,cursor:"pointer",padding:4}}>🗑</button>
                      </div>
                      <input value={p.name||""} onChange={e=>updateScannedPlayer(p._localId,"name",e.target.value)} placeholder="Player name" style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",borderRadius:8,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13,marginBottom:8,outline:"none"}}/>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
                        <input value={p.number||""} onChange={e=>updateScannedPlayer(p._localId,"number",e.target.value)} placeholder="#" style={{boxSizing:"border-box",minWidth:0,padding:"8px 10px",borderRadius:8,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13,outline:"none"}}/>
                        <input value={p.position||""} onChange={e=>updateScannedPlayer(p._localId,"position",e.target.value)} placeholder="Pos" style={{boxSizing:"border-box",minWidth:0,padding:"8px 10px",borderRadius:8,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13,outline:"none"}}/>
                        <input value={p.age||""} onChange={e=>updateScannedPlayer(p._localId,"age",e.target.value)} placeholder="Age" type="number" style={{boxSizing:"border-box",minWidth:0,padding:"8px 10px",borderRadius:8,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13,outline:"none"}}/>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                        <select value={p.bats||"R"} onChange={e=>updateScannedPlayer(p._localId,"bats",e.target.value)} style={{boxSizing:"border-box",minWidth:0,padding:"8px 10px",borderRadius:8,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13,outline:"none"}}>
                          <option value="R">Bats R</option>
                          <option value="L">Bats L</option>
                          <option value="S">Bats S</option>
                        </select>
                        <select value={p.throws||"R"} onChange={e=>updateScannedPlayer(p._localId,"throws",e.target.value)} style={{boxSizing:"border-box",minWidth:0,padding:"8px 10px",borderRadius:8,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13,outline:"none"}}>
                          <option value="R">Throws R</option>
                          <option value="L">Throws L</option>
                        </select>
                      </div>
                      <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}20`,borderRadius:8,padding:"8px 10px",display:"flex",flexDirection:"column",gap:6}}>
                        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:1.5,color:C.blue,textTransform:"uppercase"}}>Parent / Guardian</div>
                        <input value={p.parent1||""} onChange={e=>updateScannedPlayer(p._localId,"parent1",e.target.value)} placeholder="Parent name" style={{boxSizing:"border-box",minWidth:0,padding:"7px 9px",borderRadius:6,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:12,outline:"none"}}/>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                          <input value={p.parent1phone||""} onChange={e=>updateScannedPlayer(p._localId,"parent1phone",e.target.value)} placeholder="Phone" style={{boxSizing:"border-box",minWidth:0,padding:"7px 9px",borderRadius:6,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:12,outline:"none"}}/>
                          <input value={p.parent1email||""} onChange={e=>updateScannedPlayer(p._localId,"parent1email",e.target.value)} placeholder="Email" style={{boxSizing:"border-box",minWidth:0,padding:"7px 9px",borderRadius:6,background:"#0a1525",border:`1px solid ${C.border}`,color:C.text,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:12,outline:"none"}}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={importScannedPlayers} disabled={scannedPlayers.filter(p=>p._include && p.name && p.name.trim()).length===0} style={{flex:1,padding:"14px 0",borderRadius:12,background:scannedPlayers.filter(p=>p._include && p.name && p.name.trim()).length>0?`linear-gradient(135deg,${C.teal},#0a8a72)`:"#1a2a2a",border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:scannedPlayers.filter(p=>p._include && p.name && p.name.trim()).length>0?"pointer":"default",minHeight:50,boxShadow:scannedPlayers.filter(p=>p._include && p.name && p.name.trim()).length>0?`0 4px 20px ${C.teal}40`:"none"}}>
                    ✓ Add {scannedPlayers.filter(p=>p._include && p.name && p.name.trim()).length} Player{scannedPlayers.filter(p=>p._include && p.name && p.name.trim()).length!==1?'s':''}
                  </button>
                  <button onClick={()=>{setScannedPlayers([]);setScanError("");}} style={{padding:"14px 20px",borderRadius:12,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",minHeight:50}}>Start Over</button>
                </div>
              </div>
            )}
          </div>
        </div>
    </>
  );
}

export default RosterScanner;
