import React, { useState, useEffect } from "react";
import { C, inp, FONTS, LOGO, supabase } from "../App";

// ─── LANDING PAGE — clean, emoji-free design ─────────────────────────────────
function LandingPage({onAuth}) {
  const [showLogin, setShowLogin] = useState(false);

  // Capture referral code from URL
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if(ref) { try{localStorage.setItem('ccp_ref',ref)}catch(e){} }
  },[]);

  if (showLogin) return <LoginScreen onAuth={onAuth} onBack={()=>setShowLogin(false)}/>;

  // Reusable section wrapper
  const Section = ({children, style={}, narrow=false}) => (
    <div style={{padding:"72px 20px",maxWidth:narrow?720:880,margin:"0 auto",...style}}>{children}</div>
  );

  // Small label/eyebrow component
  const Eyebrow = ({color=C.red, children}) => (
    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:11,letterSpacing:4,color,textTransform:"uppercase",marginBottom:14}}>{children}</div>
  );

  const SectionTitle = ({children, color=C.text}) => (
    <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:42,letterSpacing:1.5,color,lineHeight:1.05,marginBottom:18}}>{children}</div>
  );

  // Feature data — short, marketing-driven copy
  const features = [
    {label:"Live Game Scoring", body:"Score every at-bat in real time. Parents and family watch the score and your kid's stats update live, from anywhere."},
    {label:"Per-Player Stats", body:"AVG, OBP, SLG, OPS — automatically tracked. Each parent sees their kid's stats per game and across the season."},
    {label:"Practice Plans + 70 Drills", body:"Pre-built practice templates and a full drill library. Plan a 90-minute practice in under 5 minutes."},
    {label:"Schedule + Roster Scanner", body:"Snap a photo of your league schedule or sign-up sheet. AI extracts every event or player. Saves hours."},
    {label:"Lineups & Field Positions", body:"Drag-and-drop batting orders. Visual field assignments. Everything parents need to know shared instantly."},
    {label:"Team Chat with Reactions", body:"One thread for everyone, plus DMs with each parent. Photos, reactions, quick messages — no more group texts."},
  ];

  // Pain points (solves what other apps ignore)
  const painPoints = [
    "Spending two hours every week planning practice from scratch?",
    "Sending the same schedule update over and over to a 30-person group text?",
    "Tracking lineups, drills, and parent contacts across five different apps?",
    "Tired of expensive software that treats coaches like an afterthought?",
  ];

  // Pricing tiers
  const tiers = [
    { name:"Free Trial", price:"Free", period:"14 days", best:false, color:C.textMid, features:[
      "Full access to everything",
      "Up to 30 players",
      "Live game scoring",
      "All AI features included",
      "No credit card required",
    ]},
    { name:"Founding Coach", price:"$14.99", period:"per month", best:true, color:C.gold, features:[
      "Limited to first 100 founders",
      "Locked-in price forever",
      "All future features included",
      "Direct line to the founder",
      "Cancel anytime",
    ]},
    { name:"Pro Monthly", price:"$24.99", period:"per month", best:false, color:C.teal, features:[
      "Full feature access",
      "AI practice plan generator",
      "AI schedule + roster scanner",
      "Billed monthly — cancel anytime",
      "No long-term commitment",
    ]},
    { name:"Pro Annual", price:"$249.99", period:"per year", best:false, color:C.red, features:[
      "Save $50/year vs. monthly",
      "Works out to $20.83/month",
      "Full feature access",
      "AI practice plan generator",
      "AI schedule + roster scanner",
    ]},
  ];

  // ─── PAGE ──────────────────────────────────────────────────────────────────
  return (
    <div style={{background:C.bg,color:C.text,minHeight:"100vh"}}>
      <style>{FONTS}</style>

      {/* Top nav */}
      <div style={{padding:"18px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:`${C.bg}f0`,backdropFilter:"blur(10px)",zIndex:100}}>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,letterSpacing:2.5,color:"#fff"}}>CoachConnect Pro</div>
        <button onClick={()=>setShowLogin(true)} style={{padding:"8px 18px",borderRadius:8,background:"transparent",border:`1px solid ${C.gold}80`,color:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:12,letterSpacing:1.5,cursor:"pointer",textTransform:"uppercase"}}>Sign In</button>
      </div>

      {/* HERO — image with text overlay */}
      <div style={{position:"relative",overflow:"hidden",borderBottom:`1px solid ${C.border}`}}>
        {/* Decorative top bar */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${C.red},${C.gold},${C.red},transparent)`,zIndex:3}}/>
        {/* Background image */}
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,zIndex:0}}>
          <img src="/batter.jpg" alt="Young baseball player at the plate" className="ken-burns" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top",display:"block"}}/>
          {/* Dark overlay for text legibility */}
          <div style={{position:"absolute",inset:0,background:`linear-gradient(180deg, rgba(8,15,30,0.45) 0%, rgba(8,15,30,0.55) 40%, rgba(8,15,30,0.92) 85%, ${C.bg} 100%)`}}/>
        </div>
        {/* Content overlay */}
        <div style={{position:"relative",zIndex:2,padding:"60px 20px 56px",maxWidth:880,margin:"0 auto",minHeight:520,display:"flex",flexDirection:"column",justifyContent:"flex-end",textAlign:"center"}}>
          <div className="fade-up-1" style={{marginBottom:16}}>
            <img src="/logo-full.webp" alt="CoachConnect Pro" style={{width:"min(60vw, 280px)",height:"auto",display:"block",margin:"0 auto",filter:"drop-shadow(0 12px 32px rgba(0,0,0,0.6))"}}/>
          </div>
          <div className="fade-up-1"><Eyebrow color={C.gold}>Built for Youth Baseball Coaches</Eyebrow></div>
          <div className="fade-up-2" style={{fontFamily:"Bebas Neue, sans-serif",fontSize:56,letterSpacing:1,color:"#fff",lineHeight:1,marginBottom:20,textShadow:"0 4px 24px rgba(0,0,0,0.7)"}}>
            One App.<br/>
            <span style={{background:`linear-gradient(90deg,${C.gold},#f7d672)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>The Whole Season.</span>
          </div>
          <div className="fade-up-3" style={{fontSize:16,color:"#e8edf5",lineHeight:1.6,maxWidth:560,margin:"0 auto 28px",textShadow:"0 2px 12px rgba(0,0,0,0.8)"}}>
            Score live games, track player stats, plan practices, communicate with parents — all in one place. Built by a coach, for coaches.
          </div>
          <div className="fade-up-4" style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setShowLogin(true)} className="hero-cta-glow" style={{padding:"15px 32px",borderRadius:12,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:14,letterSpacing:2.5,cursor:"pointer",textTransform:"uppercase",boxShadow:`0 8px 32px ${C.red}80`,minWidth:200}}>Start Free Trial</button>
            <button onClick={()=>setShowLogin(true)} style={{padding:"15px 32px",borderRadius:12,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(8px)",border:`1px solid ${C.gold}`,color:C.gold,fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:14,letterSpacing:2.5,cursor:"pointer",textTransform:"uppercase",minWidth:200}}>Sign In</button>
          </div>
          <div className="fade-up-5" style={{fontSize:12,color:"#c9d2e0",marginTop:18,letterSpacing:0.5,textShadow:"0 2px 8px rgba(0,0,0,0.8)"}}>14-day free trial · No credit card required</div>
        </div>
      </div>

      {/* PAIN POINTS — "Sound Familiar?" */}
      <div style={{background:`${C.card}80`,borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}>
        <Section narrow>
          <div style={{textAlign:"center",marginBottom:36}}>
            <div style={{maxWidth:480,margin:"0 auto 28px",borderRadius:14,overflow:"hidden",boxShadow:`0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px ${C.border}`}}>
              <img src="/coach-with-phone.jpg" alt="Coach using CoachConnect Pro on the field" style={{width:"100%",height:"auto",display:"block",objectFit:"cover"}}/>
            </div>
            <Eyebrow color={C.red}>Sound Familiar?</Eyebrow>
            <SectionTitle>Coaching shouldn't feel like a second job.</SectionTitle>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {painPoints.map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:14,padding:"16px 20px",background:C.card,border:`1px solid ${C.border}`,borderRadius:12}}>
                <div style={{flexShrink:0,width:6,alignSelf:"stretch",background:`linear-gradient(180deg,${C.red},${C.redDim})`,borderRadius:3,minHeight:24}}/>
                <div style={{fontSize:15,color:C.text,lineHeight:1.5}}>{p}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:32,textAlign:"center",fontSize:14,color:C.textMid,fontStyle:"italic"}}>That's exactly what CoachConnect Pro fixes.</div>
        </Section>
      </div>

      {/* FEATURES */}
      <Section>
        <div style={{textAlign:"center",marginBottom:48}}>
          <Eyebrow color={C.gold}>What's Inside</Eyebrow>
          <SectionTitle>Everything a coach actually needs.</SectionTitle>
          <div style={{fontSize:14,color:C.textMid,maxWidth:520,margin:"0 auto",lineHeight:1.6}}>No half-baked features. No paywalls hiding the basics. Every tool below is included from day one.</div>
        </div>
        {/* Action shots — every play, every position */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:36,maxWidth:900,marginLeft:"auto",marginRight:"auto"}}>
          <div style={{borderRadius:10,overflow:"hidden",aspectRatio:"1/1",boxShadow:`0 6px 20px rgba(0,0,0,0.4)`}}>
            <img src="/pitcher.jpg" alt="Pitcher in motion" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </div>
          <div style={{borderRadius:10,overflow:"hidden",aspectRatio:"1/1",boxShadow:`0 6px 20px rgba(0,0,0,0.4)`}}>
            <img src="/fielder.jpg" alt="Fielder in ready position" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </div>
          <div style={{borderRadius:10,overflow:"hidden",aspectRatio:"1/1",boxShadow:`0 6px 20px rgba(0,0,0,0.4)`}}>
            <img src="/catch.jpg" alt="Outfielder catching fly ball" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </div>
          <div style={{borderRadius:10,overflow:"hidden",aspectRatio:"1/1",boxShadow:`0 6px 20px rgba(0,0,0,0.4)`}}>
            <img src="/diving.jpg" alt="Player diving back to base" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
          {features.map((f,i)=>(
            <div key={i} style={{padding:"22px 22px 24px",background:C.card,border:`1px solid ${C.border}`,borderRadius:14,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.red}80,${C.gold}40,transparent)`}}/>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:11,letterSpacing:2,color:C.gold,textTransform:"uppercase",marginBottom:6}}>0{i+1}</div>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:1,color:"#fff",marginBottom:10,lineHeight:1.1}}>{f.label}</div>
              <div style={{fontSize:13,color:C.textMid,lineHeight:1.6}}>{f.body}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* MENTAL GAME — DIFFERENTIATOR */}
      <div style={{background:`linear-gradient(180deg,${C.bg},#0a1525,${C.bg})`,borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,bottom:0,left:0,width:"35%",background:`radial-gradient(circle at left,${C.red}15,transparent 60%)`,pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:0,bottom:0,right:0,width:"35%",background:`radial-gradient(circle at right,${C.gold}10,transparent 60%)`,pointerEvents:"none"}}/>
        <Section narrow style={{position:"relative"}}>
          <div style={{maxWidth:560,margin:"0 auto 32px",borderRadius:14,overflow:"hidden",boxShadow:`0 16px 50px rgba(0,0,0,0.5), 0 0 0 1px ${C.border}`}}>
            <img src="/team-dugout.jpg" alt="Team watching the game from the dugout" style={{width:"100%",height:"auto",display:"block",objectFit:"cover"}}/>
          </div>
          <div style={{textAlign:"center"}}>
            <Eyebrow color={C.gold}>Our Differentiator</Eyebrow>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:38,letterSpacing:1.5,color:"#fff",lineHeight:1.1,marginBottom:22,maxWidth:600,margin:"0 auto 22px"}}>
              Other apps track <span style={{color:C.textDim}}>numbers.</span><br/>
              <span style={{background:`linear-gradient(90deg,${C.gold},#f7d672)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>We build players.</span>
            </div>
            <div style={{fontSize:15,color:C.textMid,lineHeight:1.7,maxWidth:580,margin:"0 auto"}}>
              Youth baseball is failure-heavy. Strikeouts. Errors. Tough losses. CoachConnect Pro is the only app that takes the emotional and mental game seriously — with parent guides, coaching scripts, and tools designed to build confident young players, not just better stat lines.
            </div>
          </div>
        </Section>
      </div>

      {/* KIDS USE IT TOO — bridge between mental game and pricing */}
      <Section narrow style={{paddingTop:64,paddingBottom:64}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:36,alignItems:"center"}}>
          <div style={{borderRadius:14,overflow:"hidden",boxShadow:`0 16px 50px rgba(0,0,0,0.5), 0 0 0 1px ${C.border}`}}>
            <img src="/boy-using-app.jpg" alt="Young player using the Positioning Trainer at home on the couch" style={{width:"100%",height:"auto",display:"block",objectFit:"cover"}}/>
          </div>
          <div>
            <Eyebrow color={C.teal}>For Players, Too</Eyebrow>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:34,letterSpacing:1.2,color:"#fff",lineHeight:1.1,marginBottom:16}}>
              Training that follows them <span style={{color:C.gold}}>home.</span>
            </div>
            <div style={{fontSize:15,color:C.textMid,lineHeight:1.6}}>
              While you plan practices and run games, your players sharpen their baseball IQ on the couch. The Positioning Trainer turns 10 minutes of screen time into smarter defensive instincts — 73 animated plays, quiz mode, badges to earn. Parents love it. Kids actually use it.
            </div>
          </div>
        </div>
      </Section>

      {/* PRICING */}
      <Section>
        <div style={{textAlign:"center",marginBottom:48}}>
          <Eyebrow color={C.red}>Pricing</Eyebrow>
          <SectionTitle>Simple. No surprises.</SectionTitle>
          <div style={{fontSize:14,color:C.textMid,maxWidth:520,margin:"0 auto",lineHeight:1.6}}>Try everything free for 14 days. Pick a plan that fits when you're ready.</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:16,maxWidth:1100,margin:"0 auto"}}>
          {tiers.map((t,i)=>(
            <div key={i} style={{padding:"28px 22px 26px",background:t.best?`linear-gradient(160deg,${C.gold}12,${C.card})`:C.card,border:`${t.best?2:1}px solid ${t.best?C.gold:C.border}`,borderRadius:18,position:"relative",overflow:"hidden",transform:t.best?"scale(1.02)":"none"}}>
              {t.best && <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.gold},${C.red},${C.gold})`}}/>}
              {t.best && <div style={{position:"absolute",top:14,right:14,padding:"3px 10px",borderRadius:6,background:C.gold,color:"#1a1200",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:9,letterSpacing:2,textTransform:"uppercase"}}>Best Value</div>}
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:11,letterSpacing:2.5,color:t.color,textTransform:"uppercase",marginBottom:10}}>{t.name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:6}}>
                <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:46,color:"#fff",lineHeight:1}}>{t.price}</div>
                <div style={{fontSize:13,color:C.textDim}}>{t.period}</div>
              </div>
              <div style={{height:1,background:C.border,margin:"18px 0"}}/>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {t.features.map((f,j)=>(
                  <div key={j} style={{display:"flex",alignItems:"flex-start",gap:10,fontSize:13,color:C.textMid,lineHeight:1.5}}>
                    <div style={{flexShrink:0,marginTop:6,width:5,height:5,borderRadius:"50%",background:t.color}}/>
                    <div>{f}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setShowLogin(true)} style={{marginTop:22,width:"100%",padding:"12px 0",borderRadius:10,background:t.best?`linear-gradient(135deg,${C.gold},#c89500)`:"transparent",border:t.best?"none":`1px solid ${t.color}`,color:t.best?"#1a1200":t.color,fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:12,letterSpacing:2,cursor:"pointer",textTransform:"uppercase"}}>{t.best?"Get Founding Pricing":"Start Free"}</button>
            </div>
          ))}
        </div>
      </Section>

      {/* FREE RESOURCES */}
      <div style={{background:`${C.card}50`,borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}>
        <Section>
          <div style={{textAlign:"center",marginBottom:36}}>
            <Eyebrow color={C.teal}>Free for Everyone</Eyebrow>
            <SectionTitle>Tools you can use right now — no signup.</SectionTitle>
            <div style={{fontSize:14,color:C.textMid,maxWidth:520,margin:"0 auto",lineHeight:1.6}}>Even if you never sign up, these are yours.</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>
            <a href="/The_Emotional_Game_Plan.pdf" download="" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",background:C.card,border:`1px solid ${C.gold}40`,borderRadius:14,padding:"22px 20px",display:"block",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.gold},#f7d672)`}}/>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:10,letterSpacing:2,color:C.gold,textTransform:"uppercase",marginBottom:8}}>Free PDF</div>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,letterSpacing:1,color:"#fff",marginBottom:10,lineHeight:1.1}}>The Emotional Game Plan</div>
              <div style={{fontSize:12,color:C.textMid,lineHeight:1.6,marginBottom:14}}>16-page coaching guide for the mental side of youth baseball — failure recovery, confidence building, parent communication.</div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,color:C.gold,textTransform:"uppercase"}}>Download →</div>
            </a>
            <a href="/positioning.html" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",background:C.card,border:`1px solid ${C.teal}40`,borderRadius:14,padding:"22px 20px",display:"block",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.teal},${C.blue})`}}/>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:10,letterSpacing:2,color:C.teal,textTransform:"uppercase"}}>Free Tool</div>
                <div style={{padding:"2px 7px",borderRadius:5,background:`${C.gold}20`,border:`1px solid ${C.gold}50`,fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:8,letterSpacing:1.5,color:C.gold,textTransform:"uppercase"}}>New</div>
              </div>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,letterSpacing:1,color:"#fff",marginBottom:10,lineHeight:1.1}}>Positioning Trainer</div>
              <div style={{fontSize:12,color:C.textMid,lineHeight:1.6,marginBottom:14}}>Watch all nine defenders move through 73 real plays, then test yourself before the answer shows. Earn XP, level up, unlock badges. Built for players ages 8-14.</div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,color:C.teal,textTransform:"uppercase"}}>Play Free →</div>
            </a>
            <a href="/Youth_Baseball_Parent_Guide.pdf" download="" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",background:C.card,border:`1px solid ${C.red}40`,borderRadius:14,padding:"22px 20px",display:"block",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.red},${C.gold})`}}/>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:10,letterSpacing:2,color:C.red,textTransform:"uppercase",marginBottom:8}}>Free PDF</div>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,letterSpacing:1,color:"#fff",marginBottom:10,lineHeight:1.1}}>The Parent's Survival Guide</div>
              <div style={{fontSize:12,color:C.textMid,lineHeight:1.6,marginBottom:14}}>Before, during, and after the game. What to say. What NOT to say. Why "I love watching you play" is the most powerful sentence in youth sports.</div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,color:C.red,textTransform:"uppercase"}}>Download →</div>
            </a>
            <a href="/Coach_Connect_Pro_Sign_Up_Sheet.pdf" download="" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",background:C.card,border:`1px solid ${C.blue}40`,borderRadius:14,padding:"22px 20px",display:"block",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.blue},${C.teal})`}}/>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:10,letterSpacing:2,color:C.blue,textTransform:"uppercase",marginBottom:8}}>Printable PDF</div>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,letterSpacing:1,color:"#fff",marginBottom:10,lineHeight:1.1}}>Team Sign-Up Sheet</div>
              <div style={{fontSize:12,color:C.textMid,lineHeight:1.6,marginBottom:14}}>Print and bring to your first practice. Collect player and parent contact info on one clean page — then scan it back into the app with our AI roster scanner to build your team in seconds.</div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,color:C.blue,textTransform:"uppercase"}}>Download Free →</div>
            </a>
          </div>
        </Section>
      </div>

      {/* FINAL CTA */}
      <Section narrow style={{textAlign:"center",paddingTop:80,paddingBottom:80}}>
        <Eyebrow color={C.red}>Get Started</Eyebrow>
        <SectionTitle>Your season starts here.</SectionTitle>
        <div style={{fontSize:14,color:C.textMid,maxWidth:480,margin:"0 auto 28px",lineHeight:1.6}}>14-day free trial. No credit card. Add your roster in 30 seconds with the photo scanner.</div>
        <button onClick={()=>setShowLogin(true)} style={{padding:"16px 38px",borderRadius:12,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:14,letterSpacing:2.5,cursor:"pointer",textTransform:"uppercase",boxShadow:`0 8px 32px ${C.red}50`,minWidth:220}}>Start Free Trial</button>
      </Section>

      {/* FOOTER */}
      <div style={{borderTop:`1px solid ${C.border}`,padding:"32px 20px",textAlign:"center"}}>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:18,letterSpacing:3,color:"#fff",marginBottom:6}}>CoachConnect Pro</div>
        <div style={{fontSize:11,color:C.textDim,marginBottom:16,letterSpacing:1}}>Built by a coach, for coaches.</div>
        <div style={{display:"flex",gap:24,justifyContent:"center",marginBottom:14}}>
          <a href="/terms.html" target="_blank" style={{color:C.textDim,fontSize:11,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",textDecoration:"none"}}>Terms</a>
          <a href="/privacy.html" target="_blank" style={{color:C.textDim,fontSize:11,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",textDecoration:"none"}}>Privacy</a>
          <a href="mailto:coachconnectpro@yahoo.com" style={{color:C.textDim,fontSize:11,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",textDecoration:"none"}}>Contact</a>
        </div>
        <div style={{fontSize:11,color:C.textDim}}>© 2026 CoachConnect Pro. All rights reserved.</div>
      </div>
    </div>
  );
}


// ─── LOGIN ────────────────────────────────────────────────────────────────────
const PRIVACY_POLICY_VERSION = "1.1";
function LoginScreen({onAuth, onBack=null}) {
  const [mode,    setMode]    = useState("login"); // "login" | "signup" | "forgot"
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [name,    setName]    = useState("");
  const [role,    setRole]    = useState("coach"); // "coach" | "parent"
  const [teamName,setTeamName]= useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [showPass,setShowPass]= useState(false);
  const [consent, setConsent] = useState(false); // COPPA parental consent (parent signup)
  const [resetSent, setResetSent] = useState(false); // forgot-password email sent

  const handleLogin = async () => {
    setError(""); setLoading(true);
    const {data,error} = await supabase.auth.signInWithPassword({email,password:pass});
    if(error){ setError("Login error: " + error.message); setLoading(false); return; }
    const {data:profile} = await supabase.from("profiles").select("*").eq("id",data.user.id).single();
    if(!profile){
      setError("Account setup incomplete. Please create a new account.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }
    onAuth(data.user, profile);
    setLoading(false);
  };

  // ── Forgot password: send the reset email ──
  const handleForgot = async () => {
    setError("");
    const em = email.trim();
    if(!em){ setError("Enter your email address first."); return; }
    setLoading(true);
    const {error:err} = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if(err){ setError("Couldn't send reset email: " + err.message); return; }
    setResetSent(true);
  };

  const handleSignup = async () => {
    setError(""); setLoading(true);
    if(!name.trim()){ setError("Please enter your name."); setLoading(false); return; }
    if(role==="coach"&&!teamName.trim()){ setError("Please enter your team name."); setLoading(false); return; }
    if(role==="parent"&&!consent){ setError("Please confirm parental consent to continue."); setLoading(false); return; }
    const {data,error} = await supabase.auth.signUp({email,password:pass});
    if(error){ setError("Signup error: " + error.message); setLoading(false); return; }
    const userId = data.user?.id;
    if(!userId){ setError("No user returned. Try again."); setLoading(false); return; }
    if(!data.session){ setError("Please turn OFF 'Confirm email' in Supabase → Auth → Sign In / Providers, then try again."); setLoading(false); return; }
    if(role==="coach"){
      const {error:rpcErr} = await supabase.rpc("create_coach_account", {
        user_id: userId,
        user_name: name,
        team_name: teamName
      });
      if(rpcErr){ setError("Setup error: " + rpcErr.message); setLoading(false); return; }
    } else {
      // Parent signup — create profile, then check for pending invites
      const {error:profErr} = await supabase.from("profiles").insert({id:userId,team_id:null,role,full_name:name});
      if(profErr){ setError("Profile error: " + profErr.message); setLoading(false); return; }
      // Check for invite by this email and auto-link to team + player
      const {data:invites} = await supabase.from("parent_invites").select("*").eq("email",email.toLowerCase().trim());
      if(invites && invites.length > 0) {
        const inv = invites[0];
        // Link profile to team AND store player_id directly on profile
        await supabase.from("profiles").update({team_id: inv.team_id, player_id: inv.player_id}).eq("id", userId);
        // Also link via parent_players table
        await supabase.from("parent_players").insert({
          parent_id: userId, player_id: inv.player_id, label: inv.label || "Parent"
        });
        for(let i=1; i<invites.length; i++) {
          await supabase.from("parent_players").insert({
            parent_id: userId, player_id: invites[i].player_id, label: invites[i].label || "Parent"
          });
        }
      }
      // COPPA: record dated parental consent for this parent
      await supabase.from("parental_consents").insert({
        parent_id: userId,
        parent_email: email.toLowerCase().trim(),
        parent_name: name,
        consented: true,
        consented_at: new Date().toISOString(),
        policy_version: PRIVACY_POLICY_VERSION,
        user_agent: (typeof navigator!=="undefined" ? navigator.userAgent : null),
      });
    }
    const {data:profile} = await supabase.from("profiles").select("*").eq("id",userId).single();
    // Track referral if present
    try{
      const refCode = localStorage.getItem('ccp_ref');
      if(refCode){
        await supabase.from("referrals").insert({
          id: Date.now().toString(36)+Math.random().toString(36).slice(2),
          ref_code: refCode,
          user_id: userId,
          user_email: email,
          signed_up: true,
          signed_up_at: new Date().toISOString(),
        });
        localStorage.removeItem('ccp_ref');
      }
    }catch(e){}
    onAuth(data.user, profile);
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",position:"relative",overflow:"hidden"}}>
      <style>{FONTS}</style>
      <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(ellipse 80% 60% at 50% 0%,#1a0a0a 0%,transparent 60%),${C.stripe}`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",top:-80,left:-80,width:300,height:300,borderRadius:"50%",background:`radial-gradient(circle,${C.red}18 0%,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-60,right:-60,width:260,height:260,borderRadius:"50%",background:`radial-gradient(circle,${C.blue}15 0%,transparent 70%)`,pointerEvents:"none"}}/>

      {/* Logo */}
      {onBack && (
        <button onClick={onBack} className="fade-up" style={{position:"relative",zIndex:2,background:"none",border:"none",color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer",padding:"8px 4px",marginBottom:12,display:"flex",alignItems:"center",gap:4}}>‹ Back to Home</button>
      )}
      <div className="fade-up" style={{textAlign:"center",marginBottom:32,position:"relative",zIndex:1}}>
        <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",background:"#fff",borderRadius:28,padding:"20px 28px 14px",boxShadow:"0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(30,123,212,0.3)",marginBottom:16}}>
          <img src={LOGO} alt="CoachConnect Pro" style={{width:120,height:120,objectFit:"contain",display:"block"}}/>
        </div>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,letterSpacing:3,color:C.text}}>CoachConnect Pro</div>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:11,letterSpacing:4,color:C.red,textTransform:"uppercase",marginTop:2}}>Youth Baseball Development</div>
      </div>

      {/* Card */}
      <div className="fade-up-1" style={{background:C.card,borderRadius:20,border:`1px solid ${C.border}`,padding:"28px 24px",width:"100%",maxWidth:380,position:"relative",zIndex:1,boxShadow:`0 24px 60px #00000088`}}>
        <div style={{position:"absolute",top:0,left:24,right:24,height:2,background:`linear-gradient(90deg,transparent,${C.red},${C.gold},transparent)`,borderRadius:2}}/>

        {/* ── FORGOT PASSWORD MODE ── */}
        {mode==="forgot" ? (
          <>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:2,color:C.text,marginBottom:6}}>Reset Your Password</div>
            {resetSent ? (
              <>
                <div style={{padding:"14px 16px",borderRadius:10,background:`${C.teal}15`,border:`1px solid ${C.teal}50`,fontSize:13,color:C.teal,lineHeight:1.6,marginBottom:16}}>
                  ✓ Check your email — if an account exists for <b>{email.trim()}</b>, a reset link is on its way. Open it on this device and you'll be asked to set a new password.
                </div>
                <div style={{fontSize:12,color:C.textDim,lineHeight:1.6,marginBottom:16}}>Nothing after a few minutes? Check your spam folder, or make sure the email matches the one you signed up with.</div>
              </>
            ) : (
              <>
                <div style={{fontSize:13,color:C.textMid,lineHeight:1.6,marginBottom:18}}>Enter the email you signed up with and we'll send you a link to set a new password.</div>
                <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" type="email" style={inp}
                  onKeyDown={e=>e.key==="Enter"&&handleForgot()}/>
                {error&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:9,background:`${C.red}15`,border:`1px solid ${C.red}40`,fontSize:12,color:"#ff8080"}}>{error}</div>}
                <button onClick={handleForgot} disabled={loading||!email.trim()} style={{width:"100%",marginTop:18,padding:"15px 0",borderRadius:12,background:loading?C.card:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:loading?C.textDim:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:2,textTransform:"uppercase",cursor:loading?"not-allowed":"pointer",minHeight:52}}>
                  {loading?"Sending…":"Send Reset Link →"}
                </button>
              </>
            )}
            <div style={{textAlign:"center",marginTop:16}}>
              <button onClick={()=>{setMode("login");setError("");setResetSent(false);}} style={{background:"none",border:"none",color:C.blue,cursor:"pointer",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,padding:0}}>‹ Back to Sign In</button>
            </div>
          </>
        ) : (
          <>
            {/* Mode toggle */}
            <div style={{display:"flex",background:`${C.bg}`,borderRadius:10,padding:3,marginBottom:24,gap:2}}>
              {["login","signup"].map(m=>(
                <button key={m} onClick={()=>{setMode(m);setError("");}} style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",background:mode===m?C.red:"transparent",color:mode===m?"#fff":C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s"}}>
                  {m==="login"?"Sign In":"Create Account"}
                </button>
              ))}
            </div>

            {/* Role selector (signup only) */}
            {mode==="signup"&&(
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                {["coach","parent"].map(r=>(
                  <button key={r} onClick={()=>setRole(r)} style={{flex:1,padding:"10px 0",borderRadius:10,border:`2px solid ${role===r?(r==="coach"?C.blue:C.gold):C.border}`,background:role===r?(r==="coach"?`${C.blue}15`:`${C.gold}15`):"transparent",color:role===r?(r==="coach"?C.blue:C.gold):C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s"}}>
                    {r==="coach"?"⚙️ Coach":"👨‍👩‍👦 Parent"}
                  </button>
                ))}
              </div>
            )}

            {/* Fields */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {mode==="signup"&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" style={inp}/>}
              {mode==="signup"&&role==="coach"&&<input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="Team name (e.g. River Dogs 12U)" style={inp}/>}
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" type="email" style={inp}/>
              <div style={{position:"relative"}}>
                <input value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" type={showPass?"text":"password"} style={{...inp,paddingRight:44}}
                  onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleSignup())}/>
                <button onClick={()=>setShowPass(x=>!x)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:14,padding:4}}>{showPass?"🙈":"👁"}</button>
              </div>
            </div>

            {/* Forgot password link (login mode only) */}
            {mode==="login"&&(
              <div style={{textAlign:"right",marginTop:8}}>
                <button onClick={()=>{setMode("forgot");setError("");setResetSent(false);}} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:0.5,padding:0}}>Forgot password?</button>
              </div>
            )}

            {/* COPPA parental consent (parent signup only) */}
            {mode==="signup"&&role==="parent"&&(
              <label style={{display:"flex",alignItems:"flex-start",gap:10,marginTop:16,padding:"12px 14px",borderRadius:10,background:`${C.gold}10`,border:`1px solid ${consent?C.gold:C.border}`,cursor:"pointer",transition:"all 0.2s"}}>
                <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} style={{marginTop:2,width:18,height:18,accentColor:C.gold,cursor:"pointer",flexShrink:0}}/>
                <span style={{fontSize:12,lineHeight:1.5,color:C.textMid}}>
                  I am the parent or legal guardian of the player(s) on this account. I have read the{" "}
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{color:C.gold,textDecoration:"underline"}}>Privacy Policy</a>{" "}
                  and consent to CoachConnect Pro collecting and using my child&apos;s information — including name, age, photos, videos, and performance data — as described there, so my child&apos;s coach and I can manage their participation and development.
                </span>
              </label>
            )}

            {error&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:9,background:`${C.red}15`,border:`1px solid ${C.red}40`,fontSize:12,color:"#ff8080"}}>{error}</div>}

            <button onClick={mode==="login"?handleLogin:handleSignup} disabled={loading||!email||!pass||(mode==="signup"&&role==="parent"&&!consent)} style={{width:"100%",marginTop:20,padding:"15px 0",borderRadius:12,background:loading?C.card:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:loading?C.textDim:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:2,textTransform:"uppercase",cursor:loading?"not-allowed":"pointer",boxShadow:loading?"none":`0 6px 20px ${C.red}40`,transition:"all 0.2s",minHeight:52}}>
              {loading?"Please wait…":mode==="login"?"Sign In →":"Create Account →"}
            </button>

            {mode==="login"&&(
              <div style={{textAlign:"center",marginTop:14,fontSize:12,color:C.textDim}}>
                No account?{" "}
                <button onClick={()=>{setMode("signup");setError("");}} style={{background:"none",border:"none",color:C.blue,cursor:"pointer",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,padding:0}}>Create one free →</button>
              </div>
            )}
          </>
        )}

        <div style={{textAlign:"center",marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"center",gap:20}}>
          <a href="/terms.html" target="_blank" style={{color:C.textDim,fontSize:11,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase",textDecoration:"none"}}>Terms of Service</a>
          <a href="/privacy.html" target="_blank" style={{color:C.textDim,fontSize:11,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase",textDecoration:"none"}}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
