import React, { useState } from "react";
import { C } from "../theme";
import { uid, inp, Tag, SectionHead, PrimaryBtn, GhostBtn, Inp, NewCoachCard } from "../App";

// ─── PRACTICE PLANS ───────────────────────────────────────────────────────────

const FOCUS_OPTIONS = ["Defense","Base Running","Teamwork","Fielding","Outfield","Infield","Throwing","IQ & Strategy","Speed","Game Simulation","Hitting","Custom"];
const FOCUS_COLORS = {
  "Defense":"#1e7bd4","Base Running":"#f5c518","Teamwork":"#00d4aa","Fielding":"#8b5cf6",
  "Outfield":"#06b6d4","Infield":"#f97316","Throwing":"#00d4aa","IQ & Strategy":"#ec4899",
  "Speed":"#e8192c","Game Simulation":"#f5c518","Hitting":"#e8192c","Custom":"#aaaaaa",
};

export const BLOCK_COLORS = {
  warmup:  { color:"#f97316", label:"Warm-Up" },
  drill:   { color:"#1e7bd4", label:"Drill" },
  station: { color:"#8b5cf6", label:"Station" },
  team:    { color:"#00d4aa", label:"Team Activity" },
  cooldown:{ color:"#f5c518", label:"Cool-Down" },
  game:    { color:"#e8192c", label:"Game / Scrimmage" },
};

const PRACTICE_PLANS = [
  {
    id:"pp1", title:"Defensive Foundation", focus:"Defense", duration:90,
    blocks:[
      { type:"warmup",   name:"Dynamic Stretching & Partner Toss", duration:10,
        setup:"Players pair up with gloves, spread 15–20 feet apart.",
        activity:"Jog in place while playing catch, gradually increase distance to 40 feet.",
        coachingPoints:"Proper throwing mechanics — step toward target, follow through.",
        result:"Arms warmed up, players focused and communicating." },
      { type:"station",  name:"Ground Ball Relay Races", duration:15,
        setup:"Divide into 3–4 teams, relay lines with cones 60 feet apart.",
        activity:"Coach rolls ground balls to first player who fields, throws to teammate, runs to back of line. Continue relay.",
        coachingPoints:"Get in front of the ball, field with two hands, quick transfer, accurate throws.",
        competition:"First team to rotate everyone through wins.",
        result:"Quick reactions, clean fielding, teamwork, conditioning." },
      { type:"station",  name:"Fly Ball Communication", duration:15,
        setup:"Groups of 3 in outfield, coach hits/throws fly balls.",
        activity:"Players must call 'I got it!' or 'You take it!' before catching. Rotate priority.",
        coachingPoints:"Loud communication, get under the ball early, use two hands.",
        result:"Clear communication habits, confidence catching fly balls, awareness of teammates." },
      { type:"station",  name:"Catcher Skills Circuit", duration:15,
        setup:"Home plate area with catchers rotating, infielders at bases.",
        activity:"Blocking drill (5 min) → Throw to 2nd base (5 min) → Simulated bunt throw to 3rd (5 min).",
        coachingPoints:"Stay low on blocks, quick feet on throws, hit the cutoff man's chest.",
        result:"Catchers develop fundamentals; other players practice receiving throws." },
      { type:"team",     name:"Defensive Situations", duration:25,
        setup:"Full team on field, coaches hit/place runners.",
        activity:"Runner on 1st – turn double play. Runner on 2nd – hit cutoff. Runner on 3rd – fly ball home. Bases loaded – get out at home. Run each 4–5 times.",
        coachingPoints:"Where should everyone be? Who backs up? Who's the cutoff?",
        result:"Players understand their role in every situation, develop baseball IQ." },
      { type:"cooldown", name:"Pickle/Rundown Competition", duration:10,
        setup:"Create 3 rundown areas between bases.",
        activity:"Defensive players practice running down baserunners. Keep score — runners vs defense.",
        coachingPoints:"Run the runner back to previous base, maximum 2 throws.",
        result:"Fun ending, practice important game skill, conditioning." },
    ]
  },
  {
    id:"pp2", title:"Base Running & Speed", focus:"Base Running", duration:90,
    blocks:[
      { type:"warmup",   name:"Tag Games", duration:10,
        setup:"Designate playing area, 2–3 players are 'it'.",
        activity:"Freeze tag or regular tag for 3 min, dynamic stretches for 7 min.",
        coachingPoints:"Change direction, acceleration, deceleration.",
        result:"Elevated heart rate, loose muscles, fun energy." },
      { type:"station",  name:"Home to First Sprints", duration:10,
        setup:"Home plate with left and right batter's boxes.",
        activity:"Players simulate swing, sprint to first. Coach times. 3 attempts from each side.",
        coachingPoints:"Don't watch the ball, run through the bag, hit the front of the base.",
        competition:"Post times, celebrate improvement.",
        result:"Proper running form, understand difference between left/right batter starts." },
      { type:"station",  name:"Rounding Bases Technique", duration:10,
        setup:"Full bases set up.",
        activity:"Practice rounding first on doubles, rounding second on triples. Relay races in groups of 4.",
        coachingPoints:"Wide turn, touch inside corner of bag, look for coach signals.",
        competition:"Time trials, team vs team races.",
        result:"Efficient base running, no wasted steps, proper technique." },
      { type:"station",  name:"Sliding Practice", duration:10,
        setup:"Slip-n-slide or mats at each base.",
        activity:"Each player practices bent-leg slide into each base 2–3 times.",
        coachingPoints:"Start slide 6–8 feet from base, hands up, contact with bent leg. Coach demonstrates first.",
        result:"Safe sliding technique, overcome fear of sliding." },
      { type:"station",  name:"Tag-Up Drills", duration:10,
        setup:"Runners at 2nd and 3rd, outfielders catching fly balls.",
        activity:"Runners practice tagging up, judging depth, running on catch.",
        coachingPoints:"One foot on bag, watch the ball, explode on contact.",
        result:"Understand when to tag and go, when to stay." },
      { type:"game",     name:"Defense vs. Runners Scrimmage", duration:30,
        setup:"Full defense, rotating runners on bases.",
        activity:"Coach hits balls in play — runners must run situations correctly (force plays, tag-ups, stealing).",
        coachingPoints:"Read the ball, aggressive but smart base running.",
        result:"Apply skills in game context, decision-making." },
      { type:"cooldown", name:"Stretch & Team Reflection", duration:10,
        activity:"Light stretching, hydration, walking. Each player shares one thing they learned.",
        result:"Recovery, reflection, team bonding." },
    ]
  },
  {
    id:"pp3", title:"Communication & Teamwork", focus:"Teamwork", duration:90,
    blocks:[
      { type:"warmup",   name:"Throwing Lines with Communication", duration:10,
        setup:"Two parallel lines 40 feet apart.",
        activity:"Partners throw while calling 'ready!' before throwing and 'got it!' when catching. Add distractions.",
        coachingPoints:"Loud, clear communication, eye contact before throwing.",
        result:"Communication becomes habit, not afterthought." },
      { type:"drill",    name:"Pop-Up Priority", duration:15,
        setup:"Full infield, coach hits pop-ups to areas where 2–3 players converge.",
        activity:"Players call for ball with priority rules: infield over outfield, center over corners.",
        coachingPoints:"Call it early and loud, everyone else yells 'take it!', wave arms.",
        competition:"Caught with communication = point, dropped or no communication = negative point.",
        result:"Eliminate confusion on pop-ups, establish verbal priority system." },
      { type:"drill",    name:"Bunt Defense Rotations", duration:15,
        setup:"Full infield with runners, coach bunts.",
        activity:"Sacrifice bunt → bunt for hit → squeeze play. Rotate positions every 5 attempts.",
        coachingPoints:"Catcher calls the play loudly 'THREE, THREE, THREE!', fielder calls 'I GOT IT!'",
        result:"Every player understands every position's responsibility, instant communication." },
      { type:"drill",    name:"First-and-Third Defensive Scenarios", duration:20,
        setup:"Runners on 1st and 3rd, full defense.",
        activity:"Throw through to 2nd, cut and catch runner off 3rd, fake to 3rd throw to 2nd, catcher pump fake.",
        coachingPoints:"Catcher calls the play, middle infielders communicate cut location, 3B ready.",
        competition:"Runners vs defense scorekeeping.",
        result:"Confidence in high-pressure situation, multiple defensive options learned." },
      { type:"drill",    name:"Outfield Relay Competitions", duration:15,
        setup:"Three teams: RF–2B–Home, CF–SS–Home, LF–3B–Home.",
        activity:"Coach hits to outfield, relay to home plate hitting cutoff man.",
        coachingPoints:"'RELAY! RELAY!' call from cutoff man, outfielder hits chest, cutoff pivots quickly.",
        competition:"Clean relay = 3 pts, cutoff hit but offline = 1 pt.",
        result:"Crisp relay throws, proper spacing, team chemistry." },
      { type:"game",     name:"Scrimmage with Communication Focus", duration:20,
        setup:"Coaches hit, defense must communicate every play.",
        activity:"Special rule: if coach doesn't hear communication, the play doesn't count (redo).",
        coachingPoints:"Backing up, calling off teammates, directing throws.",
        result:"Communication becomes automatic, not optional." },
      { type:"cooldown", name:"Trust Circle", duration:10,
        activity:"Players stand in circle and share one teammate who helped them today. Alternative: group plank challenge passing ball around circle.",
        result:"Build team bond, positive reinforcement culture." },
    ]
  },
  {
    id:"pp4", title:"Quick Hands & Reactions", focus:"Fielding", duration:90,
    blocks:[
      { type:"warmup",   name:"Reaction Ball Games", duration:10,
        setup:"Partners with reaction balls (six-sided rubber balls).",
        activity:"Bounce reaction balls to partner who must field them. Increase distance and intensity.",
        coachingPoints:"Stay low, quick feet, watch ball into glove.",
        result:"Reflexes engaged, ready for fast-paced practice." },
      { type:"station",  name:"Short-Hop Challenge", duration:15,
        setup:"Partners 20 feet apart with tennis balls or baseballs.",
        activity:"Intentionally throw short hops. Field from stationary, progress to moving laterally.",
        coachingPoints:"Get glove down early, let ball come to you, soft hands.",
        competition:"Count clean fields in 2 min, try to beat your record.",
        result:"Confidence fielding bad hops, improved glove work." },
      { type:"station",  name:"Tennis Ball Quick-Toss Reactions", duration:15,
        setup:"Lines of 4–5 players, coach 15 feet away with bucket of tennis balls.",
        activity:"Coach rapid-fires tennis balls (one every 2–3 sec). Player fields and tosses back immediately. Variations: backhand only, forehand only, alternating, two balls.",
        coachingPoints:"Quick feet, stay in athletic position, eyes on ball.",
        result:"Lightning-fast reactions, hand-eye coordination, stamina." },
      { type:"station",  name:"Barehand Fielding Competitions", duration:15,
        setup:"Tennis balls or softer balls, partners rolling.",
        activity:"Field ground balls barehanded, underhand flips to partner, add lateral movement.",
        coachingPoints:"Give with the ball, funnel to throwing position, accurate feeds.",
        competition:"Team vs team — most consecutive clean barehand fields.",
        result:"Soft hands, confidence handling ball, preparation for double plays." },
      { type:"team",     name:"Live Situational Defense", duration:25,
        setup:"Full defense, rotating runners, coach hits rapidly.",
        activity:"Fast-paced live ground balls and line drives. Double play turns, quick transfers, first-to-home plays, tag plays.",
        coachingPoints:"Quick hands from field to throw, crisp exchanges, fast feet.",
        competition:"Track team's successful quick plays.",
        result:"Apply quick hands in game-speed situations." },
      { type:"cooldown", name:"Relay Throw Accuracy Contest", duration:10,
        setup:"Three relay teams, targets set up.",
        activity:"Each team makes 10 relay throws to target. Hit target = 3 pts, within 5 feet = 1 pt.",
        coachingPoints:"Quick release, accuracy over velocity.",
        result:"Fun ending, application of quick hands, team bonding." },
    ]
  },
  {
    id:"pp5", title:"Outfield Emphasis", focus:"Outfield", duration:90,
    blocks:[
      { type:"warmup",   name:"Long Toss Progression", duration:10,
        setup:"Partners start 30 feet apart.",
        activity:"Gradually increase to max comfortable throw (60–90 feet for youth).",
        coachingPoints:"Proper crow hop, throw on line, full extension.",
        result:"Arms fully warmed up, ready for throwing-intensive practice." },
      { type:"drill",    name:"Do-or-Die Charging", duration:15,
        setup:"Outfielders in lines, coach hits ground balls toward them.",
        activity:"Sprint toward ball, field on run, throw immediately to target. Simulate runner trying to score.",
        coachingPoints:"Attack the ball, field on glove side, quick release, accurate throw.",
        result:"Aggressive play on balls, confidence charging, strong accurate throws." },
      { type:"drill",    name:"Going Back on Balls", duration:15,
        setup:"Outfielders facing coach, coach throws/hits over their head.",
        activity:"Drop step, turn and run back at angle, catch on the run.",
        coachingPoints:"Don't backpedal, get depth first, track ball in flight.",
        result:"Confident tracking fly balls, prevent extra bases." },
      { type:"drill",    name:"Throwing to Bases Relay Races", duration:20,
        setup:"Three outfield positions each with relay partner (infielder).",
        activity:"Coach hits to outfield. Outfielder fields and hits cutoff man. Cutoff relays to specific base. Rotate: 2nd, 3rd, home.",
        coachingPoints:"Get behind ball, crow hop toward target, hit cutoff chest-high.",
        competition:"Time from hit to ball reaching base, accuracy points.",
        result:"Proper relay mechanics, cutoff communication, preventing extra bases." },
      { type:"team",     name:"Fly Ball Communication — Full Field", duration:15,
        setup:"Full outfield and infield.",
        activity:"Coach hits fly balls to gaps requiring communication. Reinforce priority rules: CF over corners, outfield over infield.",
        coachingPoints:"Call early, call loud, wave off teammates.",
        result:"Zero collisions, every fly ball has one clear voice." },
      { type:"drill",    name:"Backing Up Bases", duration:10,
        setup:"Outfielders in position, runners on bases.",
        activity:"Coach hits to infield. Outfielders sprint to back up appropriate base.",
        coachingPoints:"Sprint immediately, position 30–40 feet behind base, ready position.",
        result:"Hustle mentality, understanding defensive support responsibilities." },
      { type:"cooldown", name:"Home Run Derby Defense", duration:10,
        setup:"Coach hits fly balls to fence.",
        activity:"Outfielders chase down balls, try to rob 'home runs'. Catching = save a home run.",
        coachingPoints:"Go all out, safety first (no crashing fences), celebrate effort.",
        result:"Fun ending, conditioning, fearless play." },
    ]
  },
  {
    id:"pp6", title:"Infield Precision", focus:"Infield", duration:90,
    blocks:[
      { type:"warmup",   name:"Agility Ladder & Partner Toss", duration:10,
        setup:"Agility ladders (or tape lines), then gloves for catch.",
        activity:"5 min quick feet through ladder (various patterns). 5 min play catch with focus on accurate throws.",
        coachingPoints:"Light on feet, precise throws to chest.",
        result:"Quick feet activated, throwing accuracy warmed up." },
      { type:"drill",    name:"Around the Horn", duration:15,
        setup:"Infielders at positions, speed rotation.",
        activity:"Standard: 3B→2B→1B→C→3B. Reverse direction. Skip throw: 3B→1B→2B→C. Try to beat team record.",
        coachingPoints:"Quick transfer, accurate throws, quick feet to receive, communication.",
        competition:"Count consecutive clean rotations.",
        result:"Fast hands, precise throws, team rhythm." },
      { type:"drill",    name:"Double Play Competitions", duration:15,
        setup:"Full infield with runners.",
        activity:"Coach hits: SS feeds 2B (turn two), 2B feeds SS (turn two), 3B–5-4-3, 1B–3-6-3.",
        coachingPoints:"Middle infielders: quick feet, chest-high feed, get out of way. 1B: stretch, stay on bag.",
        competition:"SS/2B teams compete for most DPs in 10 attempts.",
        result:"Smooth double play mechanics, timing, trust between middle infielders." },
      { type:"drill",    name:"Slow Rollers & Charging", duration:10,
        setup:"Infielders in position, coach rolls slow grounders.",
        activity:"Sprint and charge, barehand or glove field, throw on run to first.",
        coachingPoints:"Attack ball aggressively, field out front, accurate throw on run.",
        result:"Confidence on slow rollers, barehand skills, prevent infield hits." },
      { type:"drill",    name:"Backhand Plays", duration:10,
        setup:"Lines at SS and 3B.",
        activity:"Coach hits ground balls to backhand side. Fielder makes backhand play and throws to first.",
        coachingPoints:"Keep glove low, field ball out front, strong throw across body.",
        result:"Confidence on backhand, extend range, prevent hits." },
      { type:"drill",    name:"Tag Plays at Bases", duration:10,
        setup:"Infielders at 2B and 3B, runners simulate steals.",
        activity:"Catchers throw to bases. Infielders receive and apply tag (swipe, block, get out of baseline).",
        coachingPoints:"Straddle bag, quick tag, protect yourself.",
        competition:"Time from catch to tag application.",
        result:"Safe tagging technique, quick hands, outs on steals." },
      { type:"team",     name:"Live Infield/Outfield — Full Speed", duration:20,
        setup:"Full defense, coaches hit all varieties.",
        activity:"Rapid-fire ground balls and line drives. Runners on, DP opportunities, bases loaded infield in, bunt defense.",
        coachingPoints:"Quick everything — feet, hands, throws, decisions.",
        result:"Game-speed repetition, mental sharpness, precision under pressure." },
      { type:"cooldown", name:"Team Accomplishment Share", duration:10,
        activity:"Circle up — each player names one great play they saw a teammate make.",
        result:"Positive reinforcement, team culture building, end on high note." },
    ]
  },
  {
    id:"pp7", title:"Throwing Accuracy Day", focus:"Throwing", duration:90,
    blocks:[
      { type:"warmup",   name:"Progressive Throwing", duration:10,
        setup:"Partners at increasing distances.",
        activity:"30 ft (2 min) → 50 ft (3 min) → 70 ft (3 min) → long toss (2 min).",
        coachingPoints:"Step toward target, follow through, on-line throws.",
        result:"Arms fully prepared for throwing-intensive practice." },
      { type:"station",  name:"Target Practice Competitions", duration:10,
        setup:"Targets at 2nd, 3rd, home (buckets, cones, tires).",
        activity:"Throw from various positions to hit targets. Bullseye = 3 pts, close = 1 pt.",
        coachingPoints:"Focus on target, balanced throw, follow through.",
        competition:"Individual scoring, celebrate best accuracy.",
        result:"Improved accuracy under pressure, competitive fun." },
      { type:"station",  name:"Long Toss Partners", duration:10,
        setup:"Open field, partners at comfortable distance.",
        activity:"Gradually extend to max throw. Focus on arc and accuracy. Record personal best distance.",
        coachingPoints:"Full body involved, high arc on long throws, on-line on short throws.",
        result:"Arm strength development, throwing mechanics refinement." },
      { type:"station",  name:"Crow Hop Technique Races", duration:10,
        setup:"Outfielders in lines, cones marking fielding spot.",
        activity:"Field ground ball on run, execute crow hop, throw to target. Time from fielding to release.",
        coachingPoints:"Gather momentum, plant back foot, explosive throw.",
        competition:"Time trials + accuracy points.",
        result:"Proper outfield throwing mechanics, strong accurate throws." },
      { type:"station",  name:"Relay Throw Contests", duration:10,
        setup:"Four-person teams: OF → CF → IF → Base.",
        activity:"Ball starts with first player, each catches and releases as fast as possible to reach base.",
        coachingPoints:"Chest-high throws, quick exchange, communicate 'RELAY!'",
        competition:"Time + accuracy (penalties for offline throws).",
        result:"Team relay chemistry, quick accurate transfers." },
      { type:"team",     name:"Around the Bases Relay", duration:15,
        setup:"Four bases, players at each.",
        activity:"Home → 1B → 2B → 3B → Home. Continuous rotation. Variations: speed round, accuracy round, reverse.",
        coachingPoints:"Quick release, accuracy over velocity.",
        competition:"Team vs stopwatch, try to beat record.",
        result:"Throwing stamina, accuracy over time, team synchronization." },
      { type:"drill",    name:"Rundown Scenarios", duration:15,
        setup:"Runners between all bases, defensive players ready.",
        activity:"Practice running down baserunners — max 2 throws, run runner back to previous base.",
        coachingPoints:"Pump fake, run hard at runner, accurate throw.",
        competition:"Defense vs runners scoreboard.",
        result:"Rundown efficiency, aggressive baserunning practice." },
      { type:"cooldown", name:"Stretching & Arm Care", duration:10,
        activity:"Static stretching, arm circles, shoulder stretches. Discuss importance of arm care, rest, hydration.",
        result:"Proper recovery, injury prevention education." },
    ]
  },
  {
    id:"pp8", title:"Situational Mastery", focus:"IQ & Strategy", duration:90,
    blocks:[
      { type:"warmup",   name:"Dynamic Movement", duration:10,
        activity:"Jogging, high knees, butt kicks, shuffles, backpedaling, playing catch.",
        coachingPoints:"Full range of motion, light sweat.",
        result:"Ready for mental and physical challenge." },
      { type:"station",  name:"Runner on 3rd, Less Than 2 Outs", duration:12,
        setup:"Defense in position, runner on 3rd.",
        activity:"Ground ball (where to throw?), fly ball (tag up), passed ball (cover home), squeeze bunt attempt.",
        coachingPoints:"Urgency but don't rush and make errors. If play at home: make it. If not: get out at first.",
        result:"Everyone knows when to throw home vs. take the out." },
      { type:"station",  name:"Bases Loaded, Infield In", duration:12,
        setup:"All bases full, infield at DP depth or halfway.",
        activity:"Ground ball to each position (force at any base), pop-up (call it, no runs score), line drive (knock down).",
        coachingPoints:"Communicate force situation loudly, quick decisions.",
        result:"Composure in high-pressure situation, limit damage." },
      { type:"station",  name:"Nobody Out, Runner on 3rd", duration:12,
        setup:"Runner on 3rd only.",
        activity:"Bunt attempt, ground ball, fly ball to outfield, squeeze situation. Prevent run or get out.",
        coachingPoints:"Infield drawn in or at normal depth? Team decision.",
        result:"Strategic thinking — recognize when to concede run vs. risk." },
      { type:"station",  name:"Double Play Situations", duration:12,
        setup:"Runner on 1st (or 1st and 2nd).",
        activity:"Ground ball to each infield position, line drive to middle infielder, shallow pop-up (infield fly rule).",
        coachingPoints:"Get one out minimum, don't force DP if not there.",
        result:"Smooth DP turns, understand when to take the sure out." },
      { type:"station",  name:"Bunt Defense", duration:12,
        setup:"Various runners, bunt situations.",
        activity:"Sacrifice bunt, squeeze, safety squeeze, bunt for hit (corners crash). Catcher calls the throw.",
        coachingPoints:"Aggressive but controlled, quick decision on throw.",
        result:"Every player knows their responsibility on bunts." },
      { type:"game",     name:"Live Scrimmage — All Situations", duration:15,
        setup:"Full game speed — coaches call out situation before pitch.",
        activity:"'Runner on 2nd, nobody out — what's the play?' Hit ball, defense executes. Rotate quickly.",
        coachingPoints:"Think before ball is hit, communicate plan.",
        result:"Apply learning, instinctive reactions to situations." },
      { type:"cooldown", name:"Situational Quiz & Team Huddle", duration:5,
        activity:"Quick quiz: 'Runner on 3rd, one out, ground ball — where do you throw?' Celebrate good decision-making.",
        result:"Reinforce learning, mental preparation for games." },
    ]
  },
  {
    id:"pp9", title:"Speed & Competition Day", focus:"Speed", duration:90,
    blocks:[
      { type:"warmup",   name:"Sprint Relays", duration:10,
        setup:"Teams of 4, relay race to bases and back.",
        activity:"Home to first and back. First to second and back. Around all bases.",
        coachingPoints:"All-out effort, proper turns, competitive energy.",
        result:"Elevated heart rate, competitive mindset engaged." },
      { type:"drill",    name:"Base-to-Base Timed Races", duration:12,
        setup:"Stopwatch, recording sheet.",
        activity:"Home to first (both batter's boxes), first to third, home to home. 2 attempts each.",
        coachingPoints:"Proper technique, maximum effort.",
        competition:"Post leaderboard, celebrate improvement over season.",
        result:"Individual PR records, speed awareness, motivation." },
      { type:"drill",    name:"Fielding Accuracy Tournament", duration:12,
        setup:"Stations: ground ball fielding, fly ball catching, pop-up catching.",
        activity:"10 attempts per station, rotate through all three. Clean play = 1 pt, error = 0.",
        coachingPoints:"Quality over speed, proper technique.",
        competition:"Individual scores posted, team totals.",
        result:"Focus on fundamentals under competitive pressure." },
      { type:"drill",    name:"Throwing Accuracy Challenge", duration:13,
        setup:"3 stations: first base throws, relay throws, catcher throws.",
        activity:"10 throws per station. Hit target = 3 pts, within 2 ft = 2 pts, within 5 ft = 1 pt.",
        coachingPoints:"Accuracy over velocity.",
        competition:"Rotate all stations, post final scores.",
        result:"Pressure throwing — competition builds consistency." },
      { type:"drill",    name:"Position-Specific Challenges", duration:13,
        setup:"Players grouped by position preference.",
        activity:"Infielders: most clean GBs in 2 min. Outfielders: most accurate throws. Catchers: best pop time + accuracy. Pitchers: most strikes in 15 pitches.",
        coachingPoints:"Position-specific technique, celebrate different skills.",
        result:"Pride in position, specialty skill development." },
      { type:"game",     name:"Competitive Scrimmage with Bonus Scoring", duration:25,
        setup:"Two teams, keep actual score.",
        activity:"Hustle points (sprint to bases), communication points (loud fly ball calls), defense points (DPs, relay throws). Coaches pitch/hit.",
        coachingPoints:"Apply all skills, maximum effort.",
        competition:"Track bonus points alongside score.",
        result:"Game-like intensity, reward good baseball plays." },
      { type:"cooldown", name:"Awards & Wrap-Up", duration:5,
        activity:"Light stretching. Announce competition winners (creative awards). Emphasize effort and improvement over winning.",
        result:"Positive ending, motivation to improve, team celebration." },
    ]
  },
  {
    id:"pp10", title:"Full-Team Simulation", focus:"Game Simulation", duration:90,
    blocks:[
      { type:"warmup",   name:"Team Circle Throwing", duration:10,
        setup:"All players in large circle.",
        activity:"Pass ball around circle (clockwise, counterclockwise), call name before throwing, skip throws, multiple balls simultaneously.",
        coachingPoints:"Communication, awareness, quick hands.",
        result:"Team focus, readiness for game simulation." },
      { type:"team",     name:"Scrimmage Setup Explanation", duration:5,
        activity:"Coaches pitch/hit to keep pace quick. Each 'inning' = 5 outs. Players rotate every 3 innings to experience different positions.",
        coachingPoints:"Focus on defense, base running, and teamwork — not perfect batting.",
        result:"Players understand format and expectations." },
      { type:"game",     name:"Innings 1–3", duration:20,
        activity:"Full scrimmage format. Coach pauses play for teaching moments.",
        coachingPoints:"Backing up throws, cutoff man positioning, communication on every ball, hustle on/off field.",
        result:"Game awareness, position responsibilities, team support." },
      { type:"game",     name:"Innings 4–6", duration:20,
        activity:"Continue scrimmage with increased focus on base running decisions and relay throws from outfield.",
        coachingPoints:"When to advance, when to hold. Defensive positioning for different hitters. Force vs tag plays.",
        competition:"Keep score — emphasize good plays over winning.",
        result:"Strategic thinking, decision-making under pressure." },
      { type:"game",     name:"Innings 7–9 — Pressure Situations", duration:20,
        activity:"Final innings with increased pressure. Coach calls out situations mid-play.",
        coachingPoints:"Closing out close game. Handling pressure. Supporting teammates. Playing until final out.",
        result:"Mental toughness, clutch performance, team resilience." },
      { type:"cooldown", name:"Post-Scrimmage Wrap-Up", duration:10,
        activity:"Highlight great plays. Season goals discussion. Each player shares 'one thing I did well today.' Compliment the player to your left.",
        coachingPoints:"Emphasize effort, improvement, teamwork over results.",
        result:"Strong team culture, positive motivation, clear goals." },
    ]
  },
];

// ─── PRACTICE PLANS COMPONENT ────────────────────────────────────────────────
function PracticePlans({customPlans=[],setCustomPlans=()=>{}}) {
  const [view,     setView]    = useState("list");     // "list"|"view"|"build"
  const [selected, setSelected]= useState(null);       // plan object
  const [editing,  setEditing] = useState(null);       // custom plan id being edited

  const openPlan = (plan) => { setSelected(plan); setView("view"); };

  const startNew = () => {
    const blank = {id:uid(),title:"",focus:"Custom",duration:90,blocks:[],isCustom:true,_unsaved:true};
    setCustomPlans(prev=>[...prev,blank]);
    setEditing(blank.id);
    setSelected(blank);
    setView("build");
  };

  const clonePlan = (plan) => {
    const clone = {...plan, id:uid(), title:`${plan.title} (Copy)`, isCustom:true, _unsaved:true,
      blocks: plan.blocks.map(b=>({...b}))};
    setCustomPlans(prev=>[...prev,clone]);
    setEditing(clone.id);
    setSelected(clone);
    setView("build");
  };

  const deleteCustom = (id) => {
    setCustomPlans(prev=>prev.filter(p=>p.id!==id));
    if(selected?.id===id){ setSelected(null); setView("list"); }
  };

  const savePlan = (updated) => {
    setCustomPlans(prev=>prev.map(p=>p.id===updated.id?updated:p));
    setSelected(updated);
    setView("view");
    setEditing(null);
  };

  if(view==="build") {
    const plan = customPlans.find(p=>p.id===editing)||selected;
    return <PlanBuilder plan={plan} onSave={savePlan} onCancel={()=>{
      if(plan._unsaved) setCustomPlans(prev=>prev.filter(p=>p.id!==plan.id));
      setView("list"); setEditing(null);
    }}/>;
  }

  if(view==="view" && selected) {
    const isCustom = selected.isCustom;
    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:0}}>
          <button onClick={()=>{setSelected(null);setView("list");}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.red,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:1,cursor:"pointer",padding:"0 0 16px",minHeight:36}}>
            ‹ All Plans
          </button>
          {isCustom&&(
            <div style={{display:"flex",gap:8,paddingBottom:16}}>
              <button onClick={()=>{setEditing(selected.id);setView("build");}} style={{padding:"7px 14px",borderRadius:9,background:`${C.blue}20`,border:`1px solid ${C.blue}50`,color:C.blue,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,cursor:"pointer"}}>✏️ Edit</button>
              <button onClick={()=>{if(window.confirm(`Delete "${selected.title||"Untitled Plan"}"? This cannot be undone.`))deleteCustom(selected.id);}} style={{padding:"7px 14px",borderRadius:9,background:`${C.red}15`,border:`1px solid ${C.red}40`,color:C.red,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,cursor:"pointer"}}>🗑 Delete</button>
            </div>
          )}
          {!isCustom&&(
            <button onClick={()=>clonePlan(selected)} style={{padding:"7px 14px",borderRadius:9,background:`${C.teal}15`,border:`1px solid ${C.teal}40`,color:C.teal,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,cursor:"pointer",marginBottom:16}}>⎘ Duplicate & Edit</button>
          )}
        </div>
        <PlanDetailWithTimer plan={selected} onBack={()=>{setSelected(null);setView("list");}}/>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div>
      <NewCoachCard page="plans"/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <SectionHead accent>Practice Plans</SectionHead>
        <PrimaryBtn onClick={startNew}>+ New Plan</PrimaryBtn>
      </div>
      <div style={{fontSize:13,color:C.textDim,marginBottom:20,lineHeight:1.6}}>
        Build your own plans or use the pre-built library. Tap any plan to open it with the live timer.
      </div>

      {/* My Plans */}
      {customPlans.length>0&&(
        <div style={{marginBottom:24}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:3,color:C.gold,textTransform:"uppercase",marginBottom:10}}>⭐ My Plans</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {customPlans.map(p=>{
              const fc=FOCUS_COLORS[p.focus]||C.gold;
              const totalMins=p.blocks.reduce((a,b)=>a+b.duration,0);
              return (
                <div key={p.id} style={{position:"relative"}}>
                  <button onClick={()=>openPlan(p)} style={{background:`${C.gold}08`,border:`1px solid ${C.gold}30`,borderRadius:16,padding:"14px 16px",textAlign:"left",width:"100%",cursor:"pointer",position:"relative",overflow:"hidden",transition:"all 0.15s",boxShadow:"0 4px 16px #00000040"}}>
                    <div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:`linear-gradient(180deg,${C.gold},${C.gold}60)`}}/>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,letterSpacing:1,color:C.text,marginBottom:6,lineHeight:1.1}}>{p.title||"Untitled Plan"}</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          <Tag label={p.focus} color={fc} small/>
                          <Tag label={`${totalMins} min`} color={C.textDim} small/>
                          <Tag label={`${p.blocks.length} blocks`} color={C.textDim} small/>
                        </div>
                      </div>
                      <div style={{fontSize:20}}>›</div>
                    </div>
                  </button>
                  {/* Delete button */}
                  <button onClick={(e)=>{e.stopPropagation();if(window.confirm(`Delete "${p.title||"Untitled Plan"}"? This cannot be undone.`))deleteCustom(p.id);}}
                    style={{position:"absolute",top:10,right:10,width:30,height:30,borderRadius:8,background:`${C.red}15`,border:`1px solid ${C.red}30`,color:C.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer",zIndex:2}}>✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pre-built plans */}
      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:3,color:C.textMid,textTransform:"uppercase",marginBottom:10}}>📚 Pre-Built Plans</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {PRACTICE_PLANS.map((p,i)=>{
          const fc=FOCUS_COLORS[p.focus]||C.red;
          return (
            <button key={p.id} onClick={()=>openPlan(p)} className={`fade-up-${Math.min(i%4+1,5)}`}
              style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"14px 16px",textAlign:"left",width:"100%",cursor:"pointer",backgroundImage:C.stripe,position:"relative",overflow:"hidden",transition:"all 0.15s",boxShadow:"0 4px 16px #00000040"}}>
              <div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:`linear-gradient(180deg,${fc},${fc}80)`}}/>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase",marginBottom:3}}>Practice {i+1}</div>
                  <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,letterSpacing:1,color:C.text,marginBottom:6,lineHeight:1.1}}>{p.title}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <Tag label={p.focus} color={fc} small/>
                    <Tag label={`${p.duration} min`} color={C.textDim} small/>
                    <Tag label={`${p.blocks.length} blocks`} color={C.textDim} small/>
                  </div>
                </div>
                <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:34,color:fc,opacity:0.12,lineHeight:1,flexShrink:0}}>{i+1}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── CUSTOM PLAN BUILDER ──────────────────────────────────────────────────────
function PlanBuilder({plan, onSave, onCancel}) {
  const [title,    setTitle]   = useState(plan.title||"");
  const [focus,    setFocus]   = useState(plan.focus||"Custom");
  const [blocks,   setBlocks]  = useState(plan.blocks||[]);
  const [addingBlock, setAddingBlock] = useState(false);
  const [editBlockIdx, setEditBlockIdx] = useState(null);
  const [browsing, setBrowsing] = useState(false); // NEW: browse pre-made segments
  const [browseFilter, setBrowseFilter] = useState("All"); // NEW: filter by plan
  const blankBlock = {type:"drill",name:"",duration:10,coachingPoints:"",activity:"",result:"",stations:null,rotateEvery:10};
  const [blockForm, setBlockForm] = useState(blankBlock);
  const bf = (k,v) => setBlockForm(p=>({...p,[k]:v}));

  // ─── STATION HELPERS ───
  const useStations = Array.isArray(blockForm.stations);
  const toggleStations = () => {
    if(useStations){
      setBlockForm(p=>({...p,stations:null}));
    } else {
      // Default to 3 stations
      setBlockForm(p=>({...p,stations:[
        {name:"Station 1",activity:"",coachingPoints:""},
        {name:"Station 2",activity:"",coachingPoints:""},
        {name:"Station 3",activity:"",coachingPoints:""},
      ],rotateEvery:Math.max(1,Math.floor(p.duration/3))}));
    }
  };
  const addStation = () => {
    if(blockForm.stations.length>=4) return;
    setBlockForm(p=>({...p,stations:[...p.stations,{name:`Station ${p.stations.length+1}`,activity:"",coachingPoints:""}]}));
  };
  const removeStation = (i) => {
    if(blockForm.stations.length<=2) return;
    setBlockForm(p=>({...p,stations:p.stations.filter((_,j)=>j!==i)}));
  };
  const updateStation = (i,k,v) => {
    setBlockForm(p=>({...p,stations:p.stations.map((s,j)=>j===i?{...s,[k]:v}:s)}));
  };

  const totalMins = blocks.reduce((a,b)=>a+b.duration,0);

  const saveBlock = () => {
    if(!blockForm.name.trim()) return;
    if(editBlockIdx!==null){
      setBlocks(prev=>prev.map((b,i)=>i===editBlockIdx?{...blockForm}:b));
      setEditBlockIdx(null);
    } else {
      setBlocks(prev=>[...prev,{...blockForm}]);
    }
    setBlockForm(blankBlock);
    setAddingBlock(false);
  };

  const deleteBlock = (i) => setBlocks(prev=>prev.filter((_,j)=>j!==i));
  const moveBlock = (i, dir) => {
    const arr=[...blocks];
    const j=i+dir;
    if(j<0||j>=arr.length) return;
    [arr[i],arr[j]]=[arr[j],arr[i]];
    setBlocks(arr);
  };

  const editBlock = (i) => {
    setBlockForm({...blocks[i]});
    setEditBlockIdx(i);
    setAddingBlock(true);
    setBrowsing(false);
  };

  // NEW: add a segment from a pre-made plan
  const addPreMadeSegment = (block) => {
    setBlocks(prev=>[...prev,{...block}]);
  };

  const handleSave = () => {
    const {_unsaved, ...rest} = plan;
    onSave({...rest, title:title||"Untitled Plan", focus, blocks, duration:totalMins, isCustom:true});
  };

  return (
    <div>
      <button onClick={onCancel} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.red,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:1,cursor:"pointer",padding:"0 0 16px",minHeight:36}}>
        ‹ Cancel
      </button>

      <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:22,letterSpacing:2,color:C.text,marginBottom:16}}>{editBlockIdx!==null||addingBlock?"":"Build Your Plan"}</div>

      {/* Plan meta */}
      {!addingBlock&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:16}}>
          <Inp label="Plan Title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Opening Day Prep"/>
          <div style={{marginTop:12}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:8}}>Focus Area</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {FOCUS_OPTIONS.map(f=>(
                <button key={f} onClick={()=>setFocus(f)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${focus===f?(FOCUS_COLORS[f]||C.gold)+"80":C.border}`,background:focus===f?`${FOCUS_COLORS[f]||C.gold}20`:"transparent",color:focus===f?(FOCUS_COLORS[f]||C.gold):C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1,cursor:"pointer",minHeight:32}}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:16,marginTop:14}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,color:C.gold,lineHeight:1}}>{totalMins}</div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>Total Min</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,color:C.teal,lineHeight:1}}>{blocks.length}</div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>Blocks</div>
            </div>
          </div>
        </div>
      )}

      {/* Block editor form */}
      {addingBlock&&(
        <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}30`,borderRadius:14,padding:16,marginBottom:16}}>
          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:18,letterSpacing:2,color:C.blue,marginBottom:14}}>{editBlockIdx!==null?"EDIT BLOCK":"ADD BLOCK"}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {/* Block type */}
            <div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Block Type</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {Object.entries(BLOCK_COLORS).map(([type,{label,color}])=>(
                  <button key={type} onClick={()=>bf("type",type)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${blockForm.type===type?color+"80":C.border}`,background:blockForm.type===type?`${color}20`:"transparent",color:blockForm.type===type?color:C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,cursor:"pointer",minHeight:32}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Inp label="Block Name" value={blockForm.name} onChange={e=>bf("name",e.target.value)} placeholder="e.g. Ground Ball Relay Races"/>
            <div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Duration (minutes)</div>
              <input type="number" min="1" max="90" value={blockForm.duration} onChange={e=>bf("duration",Math.max(1,parseInt(e.target.value)||1))} style={{...inp,width:"100px"}}/>
            </div>

            {/* ─── STATION TOGGLE ─── */}
            <div style={{background:useStations?`${C.teal}10`:"transparent",border:`1px solid ${useStations?C.teal+"40":C.border}`,borderRadius:10,padding:"12px 14px",transition:"all 0.15s"}}>
              <button onClick={toggleStations} style={{display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",padding:0,width:"100%",textAlign:"left"}}>
                <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${useStations?C.teal:C.border}`,background:useStations?C.teal:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                  {useStations&&<div style={{color:"#fff",fontSize:14,fontWeight:800,lineHeight:1}}>✓</div>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:useStations?C.teal:C.text,letterSpacing:0.5}}>Use Stations (Parallel Groups)</div>
                  <div style={{fontSize:11,color:C.textDim,marginTop:2,lineHeight:1.4}}>Split team into groups doing different drills, with a rotation timer.</div>
                </div>
              </button>

              {useStations&&(
                <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.teal}20`}}>
                  {/* Rotation timing */}
                  <div style={{display:"flex",gap:14,alignItems:"flex-end",marginBottom:14,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Rotate Every (min)</div>
                      <input type="number" min="1" max={blockForm.duration} value={blockForm.rotateEvery||10} onChange={e=>bf("rotateEvery",Math.max(1,Math.min(blockForm.duration,parseInt(e.target.value)||1)))} style={{...inp,width:90}}/>
                    </div>
                    <div style={{fontSize:11,color:C.textDim,paddingBottom:8,lineHeight:1.4}}>
                      ≈ {Math.max(1,Math.floor(blockForm.duration/(blockForm.rotateEvery||10)))} rotation{Math.floor(blockForm.duration/(blockForm.rotateEvery||10))===1?"":"s"} in {blockForm.duration} min
                    </div>
                  </div>

                  {/* Station list */}
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.teal,textTransform:"uppercase",marginBottom:8}}>Stations ({blockForm.stations.length})</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:10}}>
                    {blockForm.stations.map((st,i)=>(
                      <div key={i} style={{background:"#0f1e38",border:`1px solid ${C.teal}25`,borderRadius:10,padding:"12px 12px 10px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          <div style={{width:24,height:24,borderRadius:6,background:`${C.teal}25`,border:`1px solid ${C.teal}60`,color:C.teal,fontFamily:"Bebas Neue, sans-serif",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                          <input value={st.name} onChange={e=>updateStation(i,"name",e.target.value)} placeholder={`Station ${i+1} name`} style={{...inp,flex:1,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,padding:"6px 10px"}}/>
                          {blockForm.stations.length>2&&(
                            <button onClick={()=>removeStation(i)} style={{background:`${C.red}12`,border:`1px solid ${C.red}30`,borderRadius:6,color:C.red,cursor:"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>✕</button>
                          )}
                        </div>
                        <textarea value={st.activity} onChange={e=>updateStation(i,"activity",e.target.value)} rows={2} placeholder="What happens at this station..." style={{...inp,resize:"vertical",fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:12,marginBottom:6}}/>
                        <input value={st.coachingPoints} onChange={e=>updateStation(i,"coachingPoints",e.target.value)} placeholder="Coaching cue (optional)" style={{...inp,fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:12}}/>
                      </div>
                    ))}
                  </div>
                  {blockForm.stations.length<4&&(
                    <button onClick={addStation} style={{width:"100%",padding:"8px 0",borderRadius:8,background:"transparent",border:`1px dashed ${C.teal}50`,color:C.teal,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>
                      + Add Station
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Standard fields — hidden when using stations */}
            {!useStations&&<>
            <div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Activity / Description</div>
              <textarea value={blockForm.activity} onChange={e=>bf("activity",e.target.value)} rows={2} placeholder="What players will be doing..." style={{...inp,resize:"vertical",fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13}}/>
            </div>
            <div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Coaching Points</div>
              <textarea value={blockForm.coachingPoints} onChange={e=>bf("coachingPoints",e.target.value)} rows={2} placeholder="Key things to emphasize..." style={{...inp,resize:"vertical",fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13}}/>
            </div>
            <div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.textMid,textTransform:"uppercase",marginBottom:6}}>Desired Result</div>
              <textarea value={blockForm.result} onChange={e=>bf("result",e.target.value)} rows={2} placeholder="What should players achieve..." style={{...inp,resize:"vertical",fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:13}}/>
            </div>
            </>}
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <PrimaryBtn onClick={saveBlock} disabled={!blockForm.name.trim()}>{editBlockIdx!==null?"Update Block":"Add Block"}</PrimaryBtn>
            <GhostBtn onClick={()=>{setAddingBlock(false);setEditBlockIdx(null);setBlockForm(blankBlock);}}>Cancel</GhostBtn>
          </div>
        </div>
      )}

      {/* Block list */}
      {!addingBlock&&(
        <div>
          {blocks.length===0&&(
            <div style={{textAlign:"center",padding:"24px 0",color:C.textDim,fontSize:13,border:`1px dashed ${C.border}`,borderRadius:14,marginBottom:14}}>
              No blocks yet — tap "+ Add Block" to start building your plan
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
            {blocks.map((block,i)=>{
              const bc=BLOCK_COLORS[block.type]||BLOCK_COLORS.drill;
              let elapsed=blocks.slice(0,i).reduce((a,b)=>a+b.duration,0);
              return (
                <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{textAlign:"center",minWidth:32,flexShrink:0}}>
                    <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:14,color:bc.color,lineHeight:1}}>{elapsed}</div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:7,color:C.textDim,textTransform:"uppercase"}}>min</div>
                  </div>
                  <div style={{width:3,height:30,borderRadius:2,background:bc.color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.text,marginBottom:2}}>{block.name}</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      <Tag label={bc.label} color={bc.color} small/>
                      <Tag label={`${block.duration} min`} color={C.textDim} small/>
                      {Array.isArray(block.stations)&&<Tag label={`🔀 ${block.stations.length} stations`} color={C.teal} small/>}
                    </div>
                  </div>
                  {/* Controls */}
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    <button onClick={()=>moveBlock(i,-1)} disabled={i===0} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:i===0?C.textDim:C.textMid,cursor:i===0?"default":"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>↑</button>
                    <button onClick={()=>moveBlock(i,1)} disabled={i===blocks.length-1} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:i===blocks.length-1?C.textDim:C.textMid,cursor:i===blocks.length-1?"default":"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>↓</button>
                    <button onClick={()=>editBlock(i)} style={{background:`${C.blue}15`,border:`1px solid ${C.blue}40`,borderRadius:6,color:C.blue,cursor:"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>✏</button>
                    <button onClick={()=>deleteBlock(i)} style={{background:`${C.red}12`,border:`1px solid ${C.red}30`,borderRadius:6,color:C.red,cursor:"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={()=>{setAddingBlock(true);setBlockForm(blankBlock);setEditBlockIdx(null);setBrowsing(false);}}
            style={{width:"100%",padding:"12px 0",borderRadius:12,background:"transparent",border:`1px dashed ${C.blue}50`,color:C.blue,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",marginBottom:8,minHeight:46}}>
            + Add Block
          </button>

          <button onClick={()=>{setBrowsing(!browsing);setAddingBlock(false);setEditBlockIdx(null);}}
            style={{width:"100%",padding:"12px 0",borderRadius:12,background:browsing?`${C.teal}15`:"transparent",border:`1px dashed ${C.teal}50`,color:C.teal,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:13,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",marginBottom:14,minHeight:46,transition:"all 0.15s"}}>
            {browsing?"▾ Close Segments":"📚 Browse Pre-Made Segments"}
          </button>

          {/* Pre-Made Segment Browser */}
          {browsing&&(
            <div className="fade-up" style={{background:`linear-gradient(135deg,#0a1929,#0f1e38)`,border:`1px solid ${C.teal}30`,borderRadius:16,padding:16,marginBottom:14}}>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:18,letterSpacing:3,color:C.teal,marginBottom:8}}>PRE-MADE SEGMENTS</div>
              <div style={{fontSize:13,color:"#8899b4",marginBottom:14,lineHeight:1.5}}>Tap any segment to add it to your plan. You can edit it after adding.</div>

              {/* Filter by plan */}
              <div className="pill-scroll" style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
                <button onClick={()=>setBrowseFilter("All")} style={{padding:"6px 12px",borderRadius:20,background:browseFilter==="All"?`linear-gradient(135deg,${C.teal},#00a882)`:"transparent",border:`1px solid ${browseFilter==="All"?C.teal:C.border}`,color:browseFilter==="All"?"#fff":C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                  All Plans
                </button>
                {PRACTICE_PLANS.map(pp=>(
                  <button key={pp.id} onClick={()=>setBrowseFilter(pp.id)} style={{padding:"6px 12px",borderRadius:20,background:browseFilter===pp.id?`linear-gradient(135deg,${FOCUS_COLORS[pp.focus]||C.red},${FOCUS_COLORS[pp.focus]||C.red}cc)`:"transparent",border:`1px solid ${browseFilter===pp.id?(FOCUS_COLORS[pp.focus]||C.red):C.border}`,color:browseFilter===pp.id?"#fff":C.textMid,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                    {pp.title}
                  </button>
                ))}
              </div>

              {/* Segment list */}
              <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:380,overflowY:"auto"}}>
                {PRACTICE_PLANS
                  .filter(pp=>browseFilter==="All"||pp.id===browseFilter)
                  .flatMap(pp=>pp.blocks.map((block,bi)=>({...block,_planTitle:pp.title,_planId:pp.id,_blockIdx:bi})))
                  .map((block,i)=>{
                    const bc=BLOCK_COLORS[block.type]||BLOCK_COLORS.drill;
                    return (
                      <button key={`${block._planId}-${block._blockIdx}`} className="btn-press" onClick={()=>addPreMadeSegment(block)}
                        style={{background:"#0f1e38",border:`1px solid ${bc.color}30`,borderRadius:12,padding:"12px 14px",textAlign:"left",cursor:"pointer",width:"100%",transition:"all 0.15s",position:"relative"}}>
                        <div style={{position:"absolute",top:0,left:0,bottom:0,width:4,borderRadius:"4px 0 0 4px",background:bc.color,boxShadow:`0 0 8px ${bc.color}60`}}/>
                        <div style={{display:"flex",gap:10,alignItems:"center",paddingLeft:8,paddingRight:2}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:"#fff",marginBottom:3,letterSpacing:0.5}}>{block.name}</div>
                            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                              <Tag label={bc.label} color={bc.color} small/>
                              <Tag label={`${block.duration} min`} color={C.textMid} small/>
                              {browseFilter==="All"&&<Tag label={block._planTitle} color={C.teal} small/>}
                            </div>
                          </div>
                          <div style={{flexShrink:0,width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${C.teal}30,${C.teal}15)`,border:`2px solid ${C.teal}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.teal,fontSize:22,fontWeight:800,boxShadow:`0 0 12px ${C.teal}30`}}>+</div>
                        </div>
                      </button>
                    );
                  })
                }
              </div>
            </div>
          )}

          <PrimaryBtn full onClick={handleSave} disabled={!title.trim()&&!blocks.length}>
            ✓ Save Plan
          </PrimaryBtn>
          {!title.trim()&&<div style={{fontSize:11,color:C.textDim,marginTop:6,textAlign:"center"}}>Add a title to save</div>}
        </div>
      )}
    </div>
  );
}

function PlanDetail({plan, onBack}) {
  const totalMins = plan.blocks.reduce((a,b)=>a+b.duration,0);
  const [openBlock, setOpenBlock] = useState(null);
  let elapsed = 0;

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.red,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:1,cursor:"pointer",padding:"0 0 16px",minHeight:36}}>
        ‹ All Plans
      </button>

      {/* Header */}
      <div style={{background:`linear-gradient(135deg,#100c1a,${C.card})`,borderRadius:18,border:`1px solid ${C.border}`,padding:"20px",marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.red},${C.gold},transparent)`}}/>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:3,color:C.red,textTransform:"uppercase",marginBottom:4}}>{plan.focus}</div>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:30,letterSpacing:2,color:C.text,lineHeight:1,marginBottom:12}}>{plan.title}</div>
        <div style={{display:"flex",gap:16}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,color:C.gold,lineHeight:1}}>{totalMins}</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>Minutes</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,color:C.teal,lineHeight:1}}>{plan.blocks.length}</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>Blocks</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {plan.blocks.map((block,i)=>{
          const bc = BLOCK_COLORS[block.type]||BLOCK_COLORS.drill;
          const start = elapsed;
          elapsed += block.duration;
          const isOpen = openBlock===i;
          return (
            <div key={i} style={{borderRadius:14,border:`1px solid ${isOpen?bc.color+"60":C.border}`,overflow:"hidden",transition:"all 0.2s",background:isOpen?`${bc.color}08`:C.card,boxShadow:isOpen?`0 0 20px ${bc.color}15`:"none"}}>
              {/* Block header — always visible */}
              <button onClick={()=>setOpenBlock(isOpen?null:i)} style={{width:"100%",background:"none",border:"none",padding:"14px 16px",cursor:"pointer",textAlign:"left",minHeight:60}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  {/* Time indicator */}
                  <div style={{textAlign:"center",minWidth:36,flexShrink:0}}>
                    <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:16,color:bc.color,lineHeight:1}}>{start}</div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:8,letterSpacing:1,color:C.textDim,textTransform:"uppercase"}}>min</div>
                  </div>
                  {/* Left accent bar */}
                  <div style={{width:3,height:36,borderRadius:2,background:bc.color,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:6,marginBottom:3}}>
                      <Tag label={bc.label} color={bc.color} small/>
                      <Tag label={`${block.duration} min`} color={C.textDim} small/>
                    </div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:C.text,lineHeight:1.2}}>{block.name}</div>
                  </div>
                  <div style={{color:C.textDim,fontSize:18,transition:"transform 0.2s",transform:isOpen?"rotate(90deg)":"none"}}>›</div>
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{padding:"0 16px 16px",borderTop:`1px solid ${bc.color}20`}}>
                  {block.setup&&<DetailRow icon="📐" label="Setup" text={block.setup} color={bc.color}/>}
                  {block.activity&&<DetailRow icon="⚡" label="Activity" text={block.activity} color={bc.color}/>}
                  {block.coachingPoints&&<DetailRow icon="🗣" label="Coaching Points" text={block.coachingPoints} color={bc.color}/>}
                  {block.competition&&<DetailRow icon="🏆" label="Competition" text={block.competition} color={bc.color}/>}
                  {block.result&&<DetailRow icon="✅" label="Desired Result" text={block.result} color={bc.color}/>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* General Tips */}
      <div style={{marginTop:24,background:`${C.gold}10`,border:`1px solid ${C.gold}30`,borderRadius:14,padding:"16px"}}>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.gold,textTransform:"uppercase",marginBottom:10}}>💡 General Coaching Tips</div>
        {[
          "Keep lines to 4–5 players max — run multiple stations simultaneously",
          "Water breaks built into transitions (30 sec max)",
          "Correct technique, not the player — 'that's a better way' vs 'you're doing it wrong'",
          "End every practice with something fun",
          "Keep explanations under 2 minutes — show, don't just tell",
        ].map((tip,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
            <div style={{color:C.gold,flexShrink:0,marginTop:1}}>▸</div>
            <div style={{fontSize:13,color:C.textMid,lineHeight:1.5}}>{tip}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailRow({icon, label, text, color}) {
  return (
    <div style={{marginTop:12}}>
      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,color:color,textTransform:"uppercase",marginBottom:4}}>{icon} {label}</div>
      <div style={{fontSize:13,color:C.textMid,lineHeight:1.65,paddingLeft:4}}>{text}</div>
    </div>
  );
}

// ─── PRACTICE TIMER (replaces PlanDetail) ────────────────────────────────────
// We override PlanDetail by redefining it after the original — React uses last definition.
// The original PlanDetail above still exists; this one takes over.

function PlanDetailWithTimer({plan, onBack}) {
  const totalMins = plan.blocks.reduce((a,b)=>a+b.duration,0);
  const [openBlock, setOpenBlock] = useState(null);

  // Timer
  const [timerRunning,  setTimerRunning]  = useState(false);
  const [timerStarted,  setTimerStarted]  = useState(false);
  const [timerBlock,    setTimerBlock]    = useState(0);
  const [secsLeft,      setSecsLeft]      = useState(0);
  const [timerDone,     setTimerDone]     = useState(false);
  const [isWaterBreak,  setIsWaterBreak]  = useState(false);
  // ─── STATION ROTATION ───
  const [rotationIdx,   setRotationIdx]   = useState(0);   // which rotation we're on (0-indexed)
  const [rotationFlash, setRotationFlash] = useState(false); // brief visual flash on rotation
  const iref = React.useRef(null);
  const lastRotationRef = React.useRef(0); // tracks last rotation index that fired beep

  const launchBlock = (idx) => {
    clearInterval(iref.current);
    setIsWaterBreak(false);
    setTimerBlock(idx);
    setSecsLeft(plan.blocks[idx].duration * 60);
    setTimerRunning(true);
    setTimerStarted(true);
    setTimerDone(false);
    setRotationIdx(0);
    lastRotationRef.current = 0;
  };

  const playBeep = (type="block") => {
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      let beeps;
      if(type==="water"){
        beeps = [{f:523,t:0,d:0.15},{f:659,t:0.18,d:0.15},{f:784,t:0.36,d:0.25}];   // ascending chirp — water break
      } else if(type==="rotate"){
        // Loud triple-beep rotation alert — distinct from block-done
        beeps = [{f:1320,t:0,d:0.2},{f:1320,t:0.25,d:0.2},{f:1760,t:0.5,d:0.5}];
      } else {
        beeps = [{f:880,t:0,d:0.12},{f:880,t:0.15,d:0.12},{f:1100,t:0.3,d:0.3}];   // double-beep + high — block done
      }
      beeps.forEach(({f,t,d})=>{
        const osc=ctx.createOscillator(); const gain=ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value=f; osc.type="sine";
        gain.gain.setValueAtTime(0,ctx.currentTime+t);
        gain.gain.linearRampToValueAtTime(type==="rotate"?0.6:0.4,ctx.currentTime+t+0.01);
        gain.gain.linearRampToValueAtTime(0,ctx.currentTime+t+d);
        osc.start(ctx.currentTime+t); osc.stop(ctx.currentTime+t+d+0.05);
      });
    } catch(e){}
  };

  const launchWaterBreak = (nextIdx) => {
    clearInterval(iref.current);
    setIsWaterBreak(true);
    setTimerBlock(nextIdx);
    setSecsLeft(60);
    setTimerRunning(true);
  };

  React.useEffect(()=>{
    if(!timerRunning) return;
    iref.current = setInterval(()=>{
      setSecsLeft(s=>{
        if(s<=1){
          clearInterval(iref.current);
          if(isWaterBreak){
            playBeep("block");
            setTimeout(()=>{ setIsWaterBreak(false); launchBlock(timerBlock); }, 400);
          } else {
            const next = timerBlock+1;
            if(next < plan.blocks.length){ playBeep("water"); setTimeout(()=>launchWaterBreak(next), 400); }
            else { playBeep("block"); setTimerRunning(false); setTimerDone(true); }
          }
          return 0;
        }
        // ─── ROTATION CHECK (station blocks only) ───
        const cur = plan.blocks[timerBlock];
        if(!isWaterBreak && cur && Array.isArray(cur.stations) && cur.rotateEvery){
          const totalSecs = cur.duration*60;
          const rotSecs = cur.rotateEvery*60;
          const elapsedSecs = totalSecs - (s-1);
          const newRotIdx = Math.floor(elapsedSecs / rotSecs);
          if(newRotIdx > lastRotationRef.current && newRotIdx < Math.ceil(totalSecs/rotSecs)){
            lastRotationRef.current = newRotIdx;
            setRotationIdx(newRotIdx);
            playBeep("rotate");
            setRotationFlash(true);
            setTimeout(()=>setRotationFlash(false), 1800);
          }
        }
        return s-1;
      });
    },1000);
    return ()=>clearInterval(iref.current);
  },[timerRunning, timerBlock, isWaterBreak]);

  const fmt = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
  const pct = isWaterBreak ? (secsLeft/60)*100 : (plan.blocks[timerBlock] ? (secsLeft/(plan.blocks[timerBlock].duration*60))*100 : 100);
  const activeBlock = !isWaterBreak ? plan.blocks[timerBlock] : null;
  const bc = isWaterBreak ? {color:C.blue,label:"Water Break"} : (activeBlock ? (BLOCK_COLORS[activeBlock.type]||BLOCK_COLORS.drill) : BLOCK_COLORS.drill);

  let elapsed = 0;

  return (
    <div>
      {/* Header card */}
      <div style={{background:`linear-gradient(135deg,#100c1a,${C.card})`,borderRadius:18,border:`1px solid ${C.border}`,padding:"20px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.red},${C.gold},transparent)`}}/>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:3,color:C.red,textTransform:"uppercase",marginBottom:4}}>{plan.focus}</div>
        <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:30,letterSpacing:2,color:C.text,lineHeight:1,marginBottom:12}}>{plan.title}</div>
        <div style={{display:"flex",gap:20,marginBottom:16}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,color:C.gold,lineHeight:1}}>{totalMins}</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>Minutes</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:28,color:C.teal,lineHeight:1}}>{plan.blocks.length}</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>Blocks</div>
          </div>
        </div>

        {/* Start Practice button */}
        {!timerStarted && (
          <button onClick={()=>launchBlock(0)} style={{width:"100%",padding:"13px 0",borderRadius:12,background:`linear-gradient(135deg,${C.red},${C.redDim})`,border:"none",color:"#fff",fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",boxShadow:`0 6px 20px ${C.red}40`}}>
            ▶ Start Practice Timer
          </button>
        )}
      </div>

      {/* ── ACTIVE TIMER WIDGET ── */}
      {timerStarted && !timerDone && (
        <div style={{background:`${bc.color}12`,border:`2px solid ${bc.color}50`,borderRadius:18,padding:"20px",marginBottom:16,textAlign:"center",boxShadow:`0 0 32px ${bc.color}20`,position:"relative",overflow:"hidden"}}>
          {/* Rotation flash overlay */}
          {rotationFlash && (
            <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${C.teal}cc,${C.gold}cc)`,zIndex:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"fade-up 0.3s ease-out"}}>
              <div style={{fontSize:72,marginBottom:8}}>🔄</div>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:48,color:"#fff",letterSpacing:4,textShadow:"0 4px 16px rgba(0,0,0,0.5)"}}>ROTATE!</div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:16,color:"#fff",letterSpacing:3,marginTop:6,textShadow:"0 2px 8px rgba(0,0,0,0.5)"}}>Rotation {rotationIdx+1}</div>
            </div>
          )}
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:3,color:bc.color,textTransform:"uppercase",marginBottom:4}}>
            {isWaterBreak ? "💧 Water Break" : `Block ${timerBlock+1} of ${plan.blocks.length}`}
          </div>
          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:18,letterSpacing:1,color:C.text,marginBottom:12}}>
            {isWaterBreak ? "Hydrate & Rest" : activeBlock?.name}
          </div>

          {/* Progress ring */}
          <div style={{position:"relative",width:140,height:140,margin:"0 auto 16px"}}>
            <svg width="140" height="140" style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
              <circle cx="70" cy="70" r="60" fill="none" stroke={`${bc.color}20`} strokeWidth="8"/>
              <circle cx="70" cy="70" r="60" fill="none" stroke={bc.color} strokeWidth="8"
                strokeDasharray={`${2*Math.PI*60}`}
                strokeDashoffset={`${2*Math.PI*60*(1-pct/100)}`}
                strokeLinecap="round"
                style={{transition:"stroke-dashoffset 0.9s linear"}}/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontSize:isWaterBreak?28:38,marginBottom:isWaterBreak?4:0}}>{isWaterBreak?"💧":""}</div>
              <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:isWaterBreak?28:38,color:C.text,lineHeight:1}}>{fmt(secsLeft)}</div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase"}}>remaining</div>
            </div>
          </div>

          {/* ─── STATION ROTATION SUB-WIDGET ─── */}
          {!isWaterBreak && activeBlock && Array.isArray(activeBlock.stations) && (() => {
            const rotSecs = (activeBlock.rotateEvery||10)*60;
            const totalSecs = activeBlock.duration*60;
            const elapsedSecs = totalSecs - secsLeft;
            const secsIntoRotation = elapsedSecs % rotSecs;
            const secsToNextRotation = rotSecs - secsIntoRotation;
            const totalRotations = Math.ceil(totalSecs / rotSecs);
            return (
              <div style={{background:`${C.teal}10`,border:`1px solid ${C.teal}40`,borderRadius:12,padding:"12px 14px",marginBottom:14,textAlign:"left"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:11,letterSpacing:2,color:C.teal,textTransform:"uppercase"}}>🔀 Rotation {Math.min(rotationIdx+1,totalRotations)} of {totalRotations}</div>
                  <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:20,color:C.gold,lineHeight:1}}>{fmt(secsToNextRotation)}</div>
                </div>
                <div style={{height:4,borderRadius:2,background:`${C.teal}20`,overflow:"hidden",marginBottom:12}}>
                  <div style={{height:"100%",width:`${(secsIntoRotation/rotSecs)*100}%`,background:`linear-gradient(90deg,${C.teal},${C.gold})`,transition:"width 0.9s linear"}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fit,minmax(${activeBlock.stations.length>=3?140:180}px,1fr))`,gap:6}}>
                  {activeBlock.stations.map((st,si)=>(
                    <div key={si} style={{background:"#0a1929",border:`1px solid ${C.teal}25`,borderRadius:8,padding:"8px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                        <div style={{width:18,height:18,borderRadius:5,background:`${C.teal}25`,border:`1px solid ${C.teal}60`,color:C.teal,fontFamily:"Bebas Neue, sans-serif",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{si+1}</div>
                        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:11,color:C.text,lineHeight:1.1}}>{st.name}</div>
                      </div>
                      {st.activity&&<div style={{fontSize:10,color:C.textMid,lineHeight:1.4}}>{st.activity}</div>}
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:C.textDim,marginTop:8,letterSpacing:0.5,textAlign:"center"}}>Loud beep + flash when it's time to rotate groups</div>
              </div>
            );
          })()}

          {/* Controls */}
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <button onClick={()=>setTimerRunning(r=>!r)} style={{padding:"10px 20px",borderRadius:10,background:timerRunning?`${C.gold}20`:`${C.teal}20`,border:`1px solid ${timerRunning?C.gold:C.teal}60`,color:timerRunning?C.gold:C.teal,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",minHeight:42}}>
              {timerRunning?"⏸ Pause":"▶ Resume"}
            </button>
            <button onClick={()=>{
              if(isWaterBreak){ launchBlock(timerBlock); }
              else { const n=timerBlock+1; if(n<plan.blocks.length) launchWaterBreak(n); else{setTimerRunning(false);setTimerDone(true);} }
            }} style={{padding:"10px 20px",borderRadius:10,background:`${C.blue}20`,border:`1px solid ${C.blue}60`,color:C.blue,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",minHeight:42}}>
              Skip ›
            </button>
            <button onClick={()=>{clearInterval(iref.current);setTimerStarted(false);setTimerRunning(false);setTimerDone(false);setIsWaterBreak(false);}} style={{padding:"10px 14px",borderRadius:10,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,cursor:"pointer",minHeight:42}}>
              ✕
            </button>
          </div>

          {/* Next block preview */}
          {!isWaterBreak && plan.blocks[timerBlock+1] && (
            <div style={{marginTop:12,fontSize:11,color:C.textDim}}>
              Up next: <span style={{color:C.blue,fontWeight:700}}>💧 Water Break · 1 min</span>
            </div>
          )}
          {isWaterBreak && plan.blocks[timerBlock] && (
            <div style={{marginTop:12,fontSize:11,color:C.textDim}}>
              Up next: <span style={{color:C.textMid,fontWeight:600}}>{plan.blocks[timerBlock].name}</span> ({plan.blocks[timerBlock].duration} min)
            </div>
          )}
        </div>
      )}

      {/* Done state */}
      {timerDone && (
        <div style={{background:`${C.teal}12`,border:`2px solid ${C.teal}50`,borderRadius:18,padding:"20px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:8}}>🏆</div>
          <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:26,color:C.teal,letterSpacing:2,marginBottom:6}}>Practice Complete!</div>
          <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>Great work — {totalMins} minutes well spent.</div>
          <button onClick={()=>{setTimerStarted(false);setTimerDone(false);}} style={{padding:"10px 24px",borderRadius:10,background:`${C.teal}25`,border:`1px solid ${C.teal}60`,color:C.teal,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:12,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>
            Restart Timer
          </button>
        </div>
      )}

      {/* Block timeline */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {plan.blocks.map((block,i)=>{
          const bcc = BLOCK_COLORS[block.type]||BLOCK_COLORS.drill;
          const start = elapsed;
          elapsed += block.duration;
          const isOpen    = openBlock===i;
          const isCurrent = timerStarted && !timerDone && timerBlock===i;
          return (
            <React.Fragment key={i}>
              <div style={{borderRadius:14,border:`${isCurrent?"2px":"1px"} solid ${isCurrent?bcc.color+"80":isOpen?bcc.color+"60":C.border}`,overflow:"hidden",transition:"all 0.2s",background:isCurrent?`${bcc.color}12`:isOpen?`${bcc.color}08`:C.card,boxShadow:isCurrent?`0 0 24px ${bcc.color}25`:isOpen?`0 0 16px ${bcc.color}15`:"none"}}>
                <button onClick={()=>setOpenBlock(isOpen?null:i)} style={{width:"100%",background:"none",border:"none",padding:"14px 16px",cursor:"pointer",textAlign:"left",minHeight:60}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{textAlign:"center",minWidth:36,flexShrink:0}}>
                      <div style={{fontFamily:"Bebas Neue, sans-serif",fontSize:16,color:bcc.color,lineHeight:1}}>{start}</div>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:8,letterSpacing:1,color:C.textDim,textTransform:"uppercase"}}>min</div>
                    </div>
                    <div style={{width:3,height:36,borderRadius:2,background:bcc.color,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                        <Tag label={bcc.label} color={bcc.color} small/>
                        <Tag label={`${block.duration} min`} color={C.textDim} small/>
                        {Array.isArray(block.stations)&&<Tag label={`🔀 ${block.stations.length} stations`} color={C.teal} small/>}
                        {isCurrent&&<Tag label="▶ Active" color={bcc.color} small/>}
                      </div>
                      <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:15,color:isCurrent?bcc.color:C.text,lineHeight:1.2}}>{block.name}</div>
                    </div>
                    <div style={{color:C.textDim,fontSize:18,transition:"transform 0.2s",transform:isOpen?"rotate(90deg)":"none"}}>›</div>
                  </div>
                </button>
                {isOpen && (
                  <div style={{padding:"0 16px 16px",borderTop:`1px solid ${bcc.color}20`}}>
                    {Array.isArray(block.stations)?(
                      <div style={{marginTop:12}}>
                        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:1.5,color:C.teal,textTransform:"uppercase",marginBottom:8}}>🔀 {block.stations.length} Stations · Rotate every {block.rotateEvery||10} min</div>
                        <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fit,minmax(${block.stations.length>=3?180:220}px,1fr))`,gap:8}}>
                          {block.stations.map((st,si)=>(
                            <div key={si} style={{background:`${C.teal}08`,border:`1px solid ${C.teal}30`,borderRadius:10,padding:"10px 12px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                <div style={{width:22,height:22,borderRadius:6,background:`${C.teal}25`,border:`1px solid ${C.teal}60`,color:C.teal,fontFamily:"Bebas Neue, sans-serif",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{si+1}</div>
                                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:13,color:C.text,lineHeight:1.2}}>{st.name}</div>
                              </div>
                              {st.activity&&<div style={{fontSize:12,color:C.textMid,lineHeight:1.5,marginBottom:st.coachingPoints?6:0}}>{st.activity}</div>}
                              {st.coachingPoints&&<div style={{fontSize:11,color:C.gold,lineHeight:1.5,fontStyle:"italic"}}>🗣 {st.coachingPoints}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ):(
                      <>
                        {block.setup&&<DetailRow icon="📐" label="Setup" text={block.setup} color={bcc.color}/>}
                        {block.activity&&<DetailRow icon="⚡" label="Activity" text={block.activity} color={bcc.color}/>}
                        {block.coachingPoints&&<DetailRow icon="🗣" label="Coaching Points" text={block.coachingPoints} color={bcc.color}/>}
                        {block.competition&&<DetailRow icon="🏆" label="Competition" text={block.competition} color={bcc.color}/>}
                        {block.result&&<DetailRow icon="✅" label="Desired Result" text={block.result} color={bcc.color}/>}
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* No water break divider here — handled in timer */}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{marginTop:24,background:`${C.gold}10`,border:`1px solid ${C.gold}30`,borderRadius:14,padding:"16px"}}>
        <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:10,letterSpacing:2,color:C.gold,textTransform:"uppercase",marginBottom:10}}>💡 General Coaching Tips</div>
        {["Keep lines to 4–5 players max — run multiple stations simultaneously","Water breaks built into transitions (30 sec max)","Correct technique, not the player","End every practice with something fun","Keep explanations under 2 minutes — show, don't just tell"].map((tip,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
            <div style={{color:C.gold,flexShrink:0}}>▸</div>
            <div style={{fontSize:13,color:C.textMid,lineHeight:1.5}}>{tip}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PracticePlans;
