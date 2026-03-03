import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

/* ━━━ UTILITIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const uid = () => Math.random().toString(36).slice(2,10);
const fmt = n => typeof n==="number"? (Number.isInteger(n)?n.toString():n.toFixed(2)) : "—";
const avg = a => a.length? a.reduce((s,v)=>s+v,0)/a.length : 0;
const today = () => new Date().toISOString().slice(0,10);
const isQuarterClosed = (cycle) => {
  const m = cycle.match(/^(\d{4})\s*Q([1-4])$/);
  if (!m) return true; // non-quarter cycles always open
  const [, yr, q] = m;
  const endDates = { 1: `${yr}-03-31`, 2: `${yr}-06-30`, 3: `${yr}-09-30`, 4: `${yr}-12-31` };
  return today() > endDates[q];
};
const ageAt = (dob, d) => { const x=new Date(d),b=new Date(dob); let a=x.getFullYear()-b.getFullYear(); if(x.getMonth()<b.getMonth()||(x.getMonth()===b.getMonth()&&x.getDate()<b.getDate()))a--; return a; };
const ageCat = a => a<8?"U8":a<10?"U10":a<12?"U12":"U14";
const weightCat = (w, ac, rules) => { const r=rules[ac]; if(!r)return"Medium"; for(const[cat,[lo,hi]] of Object.entries(r)){if(w>=lo&&w<hi)return cat;} return"Heavy"; };

const BELT_HEX = {White:"#e0e0e0","Grey-White":"#b8b8b8",Grey:"#808080","Grey-Black":"#505050","Yellow-White":"#e8d888",Yellow:"#d4a818","Yellow-Black":"#a07808"};
const CATEGORY_COLORS = {BJJ:"#C41E3A",Athletic:"#2196F3",Commitment:"#4CAF50",Competition:"#FF9800"};

const coachName = (c) => typeof c === "string" ? c : c.name;
const coachGym = (c) => typeof c === "string" ? "" : (c.gym || "");
const kidGymsStr = (k) => k ? (Array.isArray(k.gyms) ? k.gyms.join(", ") : (k.gym || "")) : "";
const kidInGym = (k, gym) => Array.isArray(k.gyms) ? k.gyms.includes(gym) : k.gym === gym;
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ━━━ DEFAULT CONFIG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const DEFAULT_CONFIG = {
  coaches:[{name:"Saulo",gym:"Jing'An",pin:"bushido"},{name:"Ahmet",gym:"Xuhui",pin:"bushido"},{name:"Gui",gym:"Minhang",pin:"bushido"},{name:"Jadson",gym:"Jing'An",pin:"bushido"}],
  gyms:["Jing'An","Xuhui","Minhang"],
  belts:["White","Grey-White","Grey","Grey-Black","Yellow-White","Yellow","Yellow-Black"],
  cycles:["2025 Q1","2025 Q2","2025 Q3","2025 Q4","2026 Q1","2026 Q2","2026 Q3","2026 Q4","2027 Q1","2027 Q2","2027 Q3","2027 Q4"],
  scoringWeights:{BJJ:0.4,Athletic:0.2,Commitment:0.2,Competition:0.2},
  promotionRules: { stripeClasses: 10, beltClasses: 40, beltMonths: 9, stripesForBelt: 4 },
  classTypes:[
    {id:"group1",name:"Kids Fundamentals",category:"group",color:"#4CAF50"},
    {id:"group2",name:"Kids Advanced",category:"group",color:"#2196F3"},
    {id:"comp",name:"Competition Training",category:"competition",color:"#FF9800"},
    {id:"pt",name:"Private / PT",category:"private",color:"#9C27B0"},
  ],
  weeklySchedule:[],
  criteria:{
    BJJ:["Standup","Top Game","Bottom Game","Submission","Defense"],
    Athletic:["Strength","Cardio","Mobility"],
    Commitment:["Attendance","Attitude"],
    Competition:["Participation","Performance"],
  },
  weightRules:{
    U8:{Light:[0,23],Medium:[23,28],Heavy:[28,999]},
    U10:{Light:[0,28],Medium:[28,34],Heavy:[34,999]},
    U12:{Light:[0,32],Medium:[32,40],Heavy:[40,999]},
    U14:{Light:[0,38],Medium:[38,48],Heavy:[48,999]},
  },
};

/* ━━━ SCORING RUBRIC HINTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const RUBRIC_HINTS = {
  "Standup": [
    "Cannot initiate any takedown. No grip fighting awareness. Falls when pulled.",
    "Knows 1 basic takedown but rarely completes it. Minimal grip fighting. Off-balance easily.",
    "Can execute 2\u20133 takedowns with moderate success. Beginning to grip fight. Maintains balance under light pressure.",
    "Chains takedowns together. Active grip fighting with purpose. Defends most takedown attempts. Works from both sides.",
    "Initiates and completes takedowns at will. Dominant grip fighting. Seamless transitions standing to ground.",
  ],
  "Top Game": [
    "Cannot maintain any top position. Gets reversed immediately. No pressure.",
    "Holds mount or side control briefly against passive opponents. No transitions. Minimal pressure.",
    "Maintains top positions under moderate resistance. Knows 2\u20133 passes. Beginning to chain positions.",
    "Heavy pressure. Passes guard consistently. Fluid transitions between top positions. Starts attacking from top.",
    "Suffocating top game. Multiple passing styles. Reads and reacts to escapes. Controls pace entirely.",
  ],
  "Bottom Game": [
    "Flat on back with no guard retention. No frames. Gets passed immediately.",
    "Can hold closed guard but does nothing from it. Minimal hip movement. Easily flattened.",
    "Active guard with 2\u20133 sweeps or attacks. Uses frames and hip escapes. Recovers guard sometimes.",
    "Dangerous from bottom. Multiple guard types. Chains sweeps into attacks. Difficult to pass.",
    "Prefers bottom game. Attacks constantly from guard. Immediately recovers any lost position.",
  ],
  "Submission": [
    "Cannot identify or attempt any submission. No finishing mechanics.",
    "Knows 1\u20132 submissions but cannot finish them live. Poor control before attempting. Telegraphs attacks.",
    "Finishes submissions against similar-level opponents. Knows 3\u20134 techniques from different positions.",
    "Attacks submissions in combinations. Transitions between attempts. Good control and finishing mechanics.",
    "Submits from anywhere. Reads defensive reactions and counters into new attacks. Competition finisher.",
  ],
  "Defense": [
    "Panics under pressure. No escapes. Taps to positions rather than submissions.",
    "Knows 1 basic escape but timing is poor. Survives briefly but doesn\u2019t improve position.",
    "Escapes most bad positions against similar-level opponents. Recognizes submission danger early. Stays calm.",
    "Very hard to submit. Escapes and immediately counters. Comfortable in bad positions.",
    "Nearly unsubmittable at this level. Turns defense into offense. Uses opponent\u2019s attacks as opportunities.",
  ],
  "Strength": [
    "Significantly weaker than peers. Cannot resist any pressure. Overwhelmed in every exchange.",
    "Below average strength for age/weight. Struggles to maintain frames or hold positions.",
    "Average strength for age and weight. Can hold positions and apply decent pressure.",
    "Above average. Creates problems with physicality. Strong frames, heavy hips, difficult to move.",
    "Exceptionally strong for age/weight class. Physical advantage in most exchanges. Explosive when needed.",
  ],
  "Cardio": [
    "Gasses out within 1 minute of rolling. Cannot sustain any intensity. Stops participating when tired.",
    "Fades significantly in second half of a round. Technique disappears when tired.",
    "Maintains pace for a full round. Moderate drop-off in second or third round.",
    "Strong throughout multiple rounds. Maintains technique when fatigued. Pushes the pace on others.",
    "Outlasts everyone. No visible fatigue across full sessions. Can increase intensity late in rounds.",
  ],
  "Mobility": [
    "Very stiff. Cannot shrimp, invert, or use hips effectively. Range of motion restricts all technique.",
    "Below average flexibility. Basic shrimping but slow. Cannot play inverted or open guard.",
    "Good functional mobility. Shrimps well, can play basic open guard. Adequate for fundamentals.",
    "Very mobile. Plays multiple guard styles. Smooth inversions. Uses flexibility as a weapon.",
    "Exceptional movement quality. Fluid in every position. Creates angles others cannot.",
  ],
  "Attendance": [
    "Attends less than 25% of classes. Frequently absent without communication.",
    "Attends roughly 25\u201350% of classes. Inconsistent pattern. Misses many weeks entirely.",
    "Attends 50\u201375% of classes. Generally regular with occasional gaps.",
    "Attends 75\u201390% of classes. Rarely misses without reason. Consistent week-to-week.",
    "90%+ attendance. Present at virtually every class. Attends extra sessions when available.",
  ],
  "Attitude": [
    "Disruptive or disengaged. Doesn\u2019t listen. Negative influence on training partners.",
    "Passive participation. Follows instructions minimally. Low energy. Needs constant reminders.",
    "Good training partner. Listens and applies corrections. Positive attitude. Engages in drills and rolls.",
    "Enthusiastic and focused. Asks questions. Encourages teammates. Applies feedback immediately.",
    "Model student. Infectious energy. Helps newer students. Embodies martial arts values on and off the mat.",
  ],
  "Participation": [
    "Refuses to compete or shows extreme distress. No competition experience.",
    "Has competed once or twice but reluctantly. Needs significant encouragement.",
    "Willing to compete when asked. Has done 3\u20135 competitions. Manages nerves adequately.",
    "Actively wants to compete. Signs up independently. Competes regularly (6+ events).",
    "Competition-driven. Seeks out tournaments. Treats competition as a priority. Mentally prepared every time.",
  ],
  "Performance": [
    "Freezes during matches. Cannot execute any trained technique under pressure.",
    "Competes but reverts to survival mode. Forgets technique. Big gap between training and competition.",
    "Executes basic gameplan. Wins some, loses some. Performs at ~60\u201370% of training ability.",
    "Performs near training level. Executes gameplan consistently. Wins most matches. Handles adversity.",
    "Elevates under pressure. Advanced strategy. Podiums consistently. Adapts mid-match to opponent.",
  ],
};

/* ━━━ MOCK DATA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const SEED_ROSTER = [];

function generateSeedAssessments(){ return []; }

/* ━━━ SCORING ENGINE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function computeSubtotals(scores, config) {
  const cr = config.criteria;
  const bjj = avg(cr.BJJ.map(c => scores[c] || 0));
  const ath = avg(cr.Athletic.map(c => scores[c] || 0));
  const com = avg(cr.Commitment.map(c => scores[c] || 0));
  const comp = avg(cr.Competition.map(c => scores[c] || 0));
  const w = config.scoringWeights;
  const final = bjj * w.BJJ + ath * w.Athletic + com * w.Commitment + comp * w.Competition;
  return { BJJ: bjj, Athletic: ath, Commitment: com, Competition: comp, final };
}

function computeRankings(assessments, roster, config) {
  const latest = {};
  assessments.forEach(a => {
    const key = `${a.kidId}_${a.cycle}`;
    if (!latest[key] || a.date > latest[key].date) latest[key] = a;
  });
  const entries = Object.values(latest).map(a => {
    const kid = roster.find(k => k.id === a.kidId);
    if (!kid || !kid.active) return null;
    const age = ageAt(kid.dob, a.date);
    const ac = ageCat(age);
    const wc = weightCat(kid.weight, ac, config.weightRules);
    const sub = computeSubtotals(a.scores, config);
    return { ...a, kid, age, ageCat: ac, weightCat: wc, ...sub };
  }).filter(Boolean);
  const grouped = {};
  entries.forEach(e => {
    const key = `${e.cycle}|${e.ageCat}|${e.weightCat}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });
  Object.values(grouped).forEach(g => {
    g.sort((a, b) => b.final - a.final);
    g.forEach((e, i) => e.rank = i + 1);
  });
  return entries;
}

/* ━━━ STORAGE HOOK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ━━━ JSONBIN CONFIG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const JSONBIN_KEY = "$2a$10$MyeP14NXV2Sb2juLdlMwOey8DKwTs8PJEYsUrgI.etARfDcle7ReK";
const BIN_IDS = {
  "bushido:config": "69a2839943b1c97be9a59cba",
  "bushido:roster": "69a28371ae596e708f516ab3",
  "bushido:assessments": "69a2834a43b1c97be9a59c35",
  "bushido:selections": "69a282fd43b1c97be9a59baa",
  "bushido:attendance": "69a326fe43b1c97be9a7016b",
};

async function binRead(key) {
  const id = BIN_IDS[key];
  if (!id) return null;
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${id}/latest`, {
      headers: { "X-Master-Key": JSONBIN_KEY }
    });
    const data = await r.json();
    const rec = data?.record;
    if (!rec) return null;
    // Skip init placeholders
    if (Array.isArray(rec)) {
      if (rec.length === 1 && rec[0]?.init) return null;
      if (rec.length === 0) return null;
      return rec;
    }
    if (rec.init && Object.keys(rec).length === 1) return null;
    return rec;
  } catch { return null; }
}

let saveTimers = {};
async function binWrite(key, value) {
  const id = BIN_IDS[key];
  if (!id) return;
  // Debounce writes to avoid rate limits (JSONBin free: ~30 req/min)
  clearTimeout(saveTimers[key]);
  saveTimers[key] = setTimeout(async () => {
    try {
      await fetch(`https://api.jsonbin.io/v3/b/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_KEY },
        body: JSON.stringify(value),
      });
    } catch (e) { console.warn("JSONBin write failed:", key, e); }
  }, 1000);
}

function useStorage(key, fallback) {
  const [val, setVal] = useState(fallback);
  const [loaded, setLoaded] = useState(false);
  const valRef = useRef(val);
  valRef.current = val;
  useEffect(() => {
    (async () => {
      const remote = await binRead(key);
      if (remote !== null) { setVal(remote); valRef.current = remote; }
      setLoaded(true);
    })();
  }, [key]);
  const save = useCallback((v) => {
    const next = typeof v === "function" ? v(valRef.current) : v;
    setVal(next);
    valRef.current = next;
    binWrite(key, next);
    return next;
  }, [key]);
  return [val, save, loaded];
}

/* ━━━ STYLE SYSTEM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const C = {
  bg:"#0a0a0a",card:"#141414",card2:"#1c1c1c",border:"#2a2a2a",
  red:"#C41E3A",text:"#e8e8e8",textDim:"#888",textMuted:"#555",
  green:"#4CAF50",blue:"#2196F3",orange:"#FF9800",
};

const s = {
  page:{padding:"16px 16px 100px",maxWidth:800,margin:"0 auto"},
  h1:{fontSize:22,fontWeight:800,color:C.text,letterSpacing:"0.5px",margin:"0 0 16px",fontFamily:"'Bebas Neue',sans-serif",textTransform:"uppercase"},
  h2:{fontSize:15,fontWeight:700,color:C.red,letterSpacing:"1px",textTransform:"uppercase",margin:"20px 0 10px",fontFamily:"'Bebas Neue',sans-serif"},
  card:{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,padding:14,marginBottom:10},
  input:{background:C.card2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"8px 10px",fontSize:14,width:"100%",boxSizing:"border-box",outline:"none"},
  select:{background:C.card2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"8px 10px",fontSize:14,width:"100%",boxSizing:"border-box",outline:"none",appearance:"none"},
  btn:{background:C.red,color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer",letterSpacing:"0.5px"},
  btnSm:{background:C.card2,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer"},
  btnDanger:{background:"transparent",color:"#e74c3c",border:"1px solid #e74c3c",borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer"},
  badge:c=>({display:"inline-block",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700,background:c+"22",color:c,letterSpacing:"0.5px"}),
  grid2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8},
  label:{fontSize:11,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:4,display:"block"},
};

/* ━━━ SHARED COMPONENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function BeltBadge({belt}){
  const hex=BELT_HEX[belt]||"#888";
  const dark=["White","Grey-White","Yellow-White","Yellow"].includes(belt);
  return <span style={{display:"inline-block",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700,background:hex,color:dark?"#111":"#fff",letterSpacing:"0.3px"}}>{belt}</span>;
}

function ScoreBar({value,max=5,color=C.red}){
  const pct=(value/max)*100;
  return(<div style={{height:6,background:C.card2,borderRadius:3,overflow:"hidden",flex:1}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width 0.4s ease"}}/></div>);
}

function Modal({open,onClose,title,children}){
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20,width:"100%",maxWidth:480,maxHeight:"85vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 style={{...s.h1,margin:0,fontSize:18}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.textDim,fontSize:22,cursor:"pointer"}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Tabs({items,active,onChange}){
  return(
    <div style={{display:"flex",gap:4,background:C.card,borderRadius:8,padding:3}}>
      {items.map(t=>(
        <button key={t} onClick={()=>onChange(t)} style={{flex:1,padding:"6px 4px",borderRadius:6,border:"none",fontSize:12,fontWeight:600,background:active===t?C.red:"transparent",color:active===t?"#fff":C.textDim,cursor:"pointer",transition:"all 0.2s"}}>{t}</button>
      ))}
    </div>
  );
}

function RadarChart({data,size=200,compareData=null,compareColor="#64B5F6"}){
  const cats=Object.keys(data);const n=cats.length;if(n<3)return null;
  const cx=size/2,cy=size/2,r=size*0.38;
  const angle=i=>(Math.PI*2*i)/n-Math.PI/2;
  const pt=(i,v)=>({x:cx+r*(v/5)*Math.cos(angle(i)),y:cy+r*(v/5)*Math.sin(angle(i))});
  const points=cats.map((c,i)=>pt(i,data[c]));
  const path=points.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ")+"Z";
  const cmpPoints=compareData?cats.map((c,i)=>pt(i,compareData[c])):null;
  const cmpPath=cmpPoints?cmpPoints.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ")+"Z":null;
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[1,2,3,4,5].map(rv=>{const pts=cats.map((_,i)=>pt(i,rv));const d=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ")+"Z";return (<path key={rv} d={d} fill="none" stroke={C.border} strokeWidth={0.5}/>);})}
      {cats.map((_,i)=>{const p=pt(i,5);return (<line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={C.border} strokeWidth={0.5}/>);})}
      {cmpPath && <path d={cmpPath} fill={compareColor+"22"} stroke={compareColor} strokeWidth={1.5} strokeDasharray="4,3"/>}
      {cmpPoints && cmpPoints.map((p,i)=><circle key={"c"+i} cx={p.x} cy={p.y} r={2.5} fill={compareColor}/>)}
      <path d={path} fill={C.red+"33"} stroke={C.red} strokeWidth={2}/>
      {cats.map((c,i)=>{const p=pt(i,5.8);return (<text key={c} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill={C.textDim} fontSize={10} fontWeight={600}>{c}</text>);})}
      {points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={3} fill={C.red}/>)}
    </svg>
  );
}

/* ━━━ PAGE HELP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const PAGE_HELP = {
  home: {
    en: "Your daily dashboard. Shows yesterday's classes with attendance, key roster and attendance metrics for the last 30 days, action items (overdue assessments, promotion-ready kids, at-risk attendance), and recent activity feed.",
    zh: "每日仪表盘。显示昨日课程出勤、过去30天关键指标、待办事项（逾期评估、晋级就绪、出勤风险）及近期活动。",
  },
  roster: {
    en: "Manage all kids in the academy. Add kids manually or bulk import from CSV. Edit belt, weight, gym, or set inactive. Cards show last assessment date, score trend (↑↓→), and overdue status. Gym filter: admins can toggle between gyms or view all; coaches/community see their assigned gym only.",
    zh: "管理学院所有学员。可手动添加或CSV批量导入。编辑腰带、体重、道馆或设为不活跃。卡片显示上次评估日期、趋势及逾期状态。道馆筛选：管理员可切换或查看全部，教练/社区仅显示所属道馆。",
  },
  score: {
    en: "Score assessments across 12 criteria in 4 categories: BJJ (40%), Athletic (20%), Commitment (20%), Competition (20%). Tap ? next to each criterion for guidelines. Score one kid or use 'Score multiple kids' to queue them. Kid list is filtered to the selected coach's gym.",
    zh: "12项标准评分，4个类别：柔术(40%)、体能(20%)、投入度(20%)、比赛(20%)。点击?查看评分指南。可逐个或批量评分。学员列表按教练所属道馆筛选。",
  },
  rankings: {
    en: "Ranked kids by cycle, age, weight, and gym. Based on latest assessment score per kid per cycle. Tap circle to select for competition team. Admin can filter across all gyms; coaches see their gym. Export as CSV for Excel.",
    zh: "按周期、年龄、体重和道馆排名。基于每周期最新评估成绩。点击圆圈选择参赛队员。管理员可跨道馆筛选，教练仅查看本道馆。可导出CSV。",
  },
  reports: {
    en: "Dashboard of academy performance for the selected cycle. Assessment coverage by gym, coach workload, score distribution by age, and overdue kids list. Admin sees all gyms or filters; coaches/community see their gym only.",
    zh: "所选周期学院表现仪表盘。各道馆评估覆盖率、教练工作量、年龄组成绩分布及逾期名单。管理员可查看全部或筛选，教练/社区仅显示本道馆。",
  },
  profile: {
    en: "Full kid profile: info, belt & stripes, latest assessment radar chart, score trend, goals, attendance stats, promotion history, and assessment comparison overlay. Use 'Export PDF' for printable parent progress report (includes stripes & promotion history). Admin can switch gyms; coaches/community search within their gym.",
    zh: "完整学员档案：信息、腰带与条纹、雷达图、趋势、目标、出勤统计、晋级记录及评估对比。PDF报告可打印（含条纹和晋级记录）。管理员可切换道馆，教练/社区在本道馆内搜索。",
  },
  settings: {
    en: "Configure coaches, community members, gyms, belts, cycles, scoring weights, weight brackets, and promotion rules (classes for stripe/belt, months required). Admin pin and settings pin. Factory Reset returns to demo data.",
    zh: "配置教练、社区成员、道馆、腰带、周期、评分权重、体重分级及晋级规则（条纹/腰带所需课时、月数）。管理员密码和设置密码。恢复出厂设置将还原演示数据。",
  },
  attendance: {
    en: "Manage class attendance with 3 sub-tabs. RECORD: Select date and gym, see scheduled classes auto-populated from weekly schedule. Tap a class card to expand and mark attendance. Group: tap to toggle Absent ↔ Present. Competition (comp team only): Absent → Present → Missed. Use 'Quick Class' for PT sessions or one-off classes. HISTORY: Browse past class sessions (coming soon). ANALYTICS: Attendance trends and metrics (coming soon).",
    zh: "管理课程出勤，包含3个子标签。记录：选择日期和道馆，查看根据每周课表自动填充的课程。点击课程卡展开标记出勤。小组课：点击切换缺席↔出勤。竞赛课（仅竞赛队）：缺席→出勤→缺课。使用「快速课程」添加私教或临时课程。历史：浏览过去的课程（即将推出）。分析：出勤趋势和指标（即将推出）。",
  },
  promotion: {
    en: "View kids eligible for stripe or belt promotion. Stripe: requires configured number of classes since last promotion. Belt: requires all stripes + class count + time at current belt. Only eligible kids are shown, grouped by belt and stripe sections (collapsible). Admin toggles gyms; coaches/community see their gym. Tap to award — logged with date and coach name.",
    zh: "查看符合条纹或腰带晋级条件的学员。条纹：需达到上次晋级后的规定课时。腰带：需满条纹+课时+在当前腰带的时间。仅显示符合条件的学员，按腰带和条纹分组（可折叠）。管理员切换道馆，教练/社区查看本馆。点击授予——记录日期和教练姓名。",
  },
  admin: {
    en: "Admin dashboard: activity log showing all logins, assessments, and data changes with timestamps. Visible to admin only.",
    zh: "管理员仪表盘：活动日志，显示所有登录、评估和数据变更的时间记录。仅管理员可见。",
  },
};

function PageHelp({ page }) {
  const [open, setOpen] = useState(false);
  const help = PAGE_HELP[page];
  if (!help) return null;
  return (
    <>
      <button onClick={() => setOpen(!open)} style={{
        background: open ? C.red + "22" : "transparent", border: `1px solid ${open ? C.red : C.border}`,
        borderRadius: 20, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 14, color: open ? C.red : C.textDim, flexShrink: 0, fontWeight: 700,
      }}>{open ? "✕" : "?"}</button>
      {open && (
        <div style={{
          background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 12, marginBottom: 12, marginTop: 8, width: "100%",
        }}>
          <div style={{ fontSize: 12, lineHeight: "18px", color: C.text, marginBottom: 10 }}>{help.en}</div>
          <div style={{ fontSize: 12, lineHeight: "18px", color: C.textDim }}>{help.zh}</div>
        </div>
      )}
    </>
  );
}

/* ━━━ ROSTER SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* HomeScreen */
function HomeScreen({ roster, attendance, assessments, config, selections, loggedCoach, loggedGym, isAdmin, isCommunity, onNavigate }) {
  const gymFilter = isAdmin ? "" : (loggedGym || "");
  const activeKids = roster.filter(k => k.active && (!gymFilter || kidInGym(k, gymFilter)));
  const schedule = config.weeklySchedule || [];
  const classTypes = config.classTypes || [];

  const yDate = new Date(); yDate.setDate(yDate.getDate() - 1);
  const yesterdayStr = yDate.toISOString().slice(0, 10);
  const yesterdayDow = yDate.getDay();
  const yesterdayDayName = DAY_NAMES[yesterdayDow];

  const yesterdaySlots = schedule.filter(sl => sl.day === yesterdayDow && (!gymFilter || sl.gym === gymFilter))
    .sort((a, b) => a.time.localeCompare(b.time));
  const yesterdayRecords = (attendance || []).filter(r => r.date === yesterdayStr);
  const yesterdayCards = yesterdaySlots.map(slot => {
    const ct = classTypes.find(c => c.id === slot.classTypeId);
    const recKey = `${yesterdayStr}|${slot.time}|${slot.classTypeId}|${slot.gym}`;
    const record = yesterdayRecords.find(r => r.key === recKey);
    const attendCount = record ? Object.values(record.records || {}).filter(v => v === "attend").length : 0;
    return { slot, ct, attendCount, capacity: slot.capacity || 20 };
  });

  const d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const cutoff30 = d30.toISOString().slice(0, 10);
  const recent30 = (attendance || []).filter(r => r.date >= cutoff30);

  const activeKidIds = new Set(activeKids.map(k => k.id));
  const kidsAttended30 = new Set();
  recent30.forEach(r => {
    Object.entries(r.records || {}).forEach(([kidId, status]) => {
      if (status === "attend" && activeKidIds.has(kidId)) kidsAttended30.add(kidId);
    });
  });
  const activePct30 = activeKids.length > 0 ? Math.round((kidsAttended30.size / activeKids.length) * 100) : 0;

  const classAttendances30 = recent30.map(r => Object.values(r.records || {}).filter(v => v === "attend").length);
  const avgClassAtt30 = classAttendances30.length > 0 ? (classAttendances30.reduce((s, v) => s + v, 0) / classAttendances30.length).toFixed(1) : "\u2014";

  const slotStats = {};
  recent30.forEach(r => {
    if (!r.scheduleId && !r.key) return;
    const slotId = r.scheduleId || (r.key ? r.key.split("|").slice(1).join("|") : "");
    const att = Object.values(r.records || {}).filter(v => v === "attend").length;
    if (!slotStats[slotId]) slotStats[slotId] = { total: 0, count: 0, classTypeId: r.classTypeId, time: r.time || (r.key ? r.key.split("|")[1] : ""), gym: r.gym };
    slotStats[slotId].total += att;
    slotStats[slotId].count++;
  });
  let topClass = null; let topAvg = 0;
  Object.entries(slotStats).forEach(([slotId, st]) => {
    const av = st.count > 0 ? st.total / st.count : 0;
    if (av > topAvg) {
      topAvg = av;
      const schedSlot = schedule.find(ss => ss.id === slotId) || schedule.find(ss => `${ss.time}|${ss.classTypeId}|${ss.gym}` === slotId);
      const ct = classTypes.find(c => c.id === st.classTypeId);
      topClass = { name: ct ? ct.name : st.classTypeId, day: schedSlot ? DAY_SHORT[schedSlot.day] : "", time: st.time, avg: av };
    }
  });
  const topClassDisplay = topClass ? topClass.name : "\u2014";
  const topClassSub = topClass ? `${topClass.day} ${topClass.time} \u00b7 avg ${topClass.avg.toFixed(1)}` : "";

  const currentCycle = config.cycles.filter(c => isQuarterClosed(c)).slice(-1)[0] || config.cycles[0] || "";
  const cycleAss = assessments.filter(a => a.cycle === currentCycle);
  const assessedIds = new Set();
  const latestByKid = {};
  cycleAss.forEach(a => { if (!latestByKid[a.kidId] || a.date > latestByKid[a.kidId].date) latestByKid[a.kidId] = a; });
  Object.keys(latestByKid).forEach(id => assessedIds.add(id));
  const overdueKids = activeKids.filter(k => !assessedIds.has(k.id));

  const rules = config.promotionRules || { stripeClasses: 10, beltClasses: 40, beltMonths: 9, stripesForBelt: 4 };
  const nowDate = new Date();
  const promoReady = activeKids.map(kid => {
    const stripes = kid.stripes || 0;
    const lastPromo = kid.lastPromotionDate || kid.joinDate || "2020-01-01";
    const classes = (attendance || []).filter(r => r.date > lastPromo && r.records && r.records[kid.id] === "attend").length + (kid.classCountOffset || 0);
    const beltIdx = config.belts.indexOf(kid.belt);
    const hasNextBelt = beltIdx < config.belts.length - 1;
    const dp = new Date(lastPromo);
    const months = (nowDate.getFullYear() - dp.getFullYear()) * 12 + nowDate.getMonth() - dp.getMonth();
    const stripeReady = stripes < (rules.stripesForBelt || 4) && classes >= (rules.stripeClasses || 10);
    const beltReady = hasNextBelt && stripes >= (rules.stripesForBelt || 4) && classes >= (rules.beltClasses || 40) && months >= (rules.beltMonths || 9);
    if (!stripeReady && !beltReady) return null;
    return { kid, stripeReady, beltReady, lastPromo, classes };
  }).filter(Boolean).sort((a, b) => b.lastPromo.localeCompare(a.lastPromo));

  const kidClasses30 = {};
  activeKids.forEach(k => { kidClasses30[k.id] = 0; });
  recent30.forEach(r => {
    Object.entries(r.records || {}).forEach(([kidId, status]) => {
      if (status === "attend" && kidId in kidClasses30) kidClasses30[kidId]++;
    });
  });
  const atRisk = activeKids.map(k => ({ kid: k, classes30d: kidClasses30[k.id] || 0 }))
    .sort((a, b) => a.classes30d - b.classes30d).slice(0, 10);

  const recentEvents = [];
  (attendance || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 20).forEach(r => {
    const ct = classTypes.find(c => c.id === r.classTypeId);
    const count = Object.values(r.records || {}).filter(v => v === "attend").length;
    if (count > 0) recentEvents.push({ date: r.date, type: "attendance", text: `${count} kids attended ${ct ? ct.name : r.classTypeId}`, icon: "\ud83d\udccb" });
  });
  assessments.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 20).forEach(a => {
    const kid = roster.find(k => k.id === a.kidId);
    const sc = computeSubtotals(a.scores, config).final;
    if (kid) recentEvents.push({ date: a.date, type: "score", text: `${a.coach} scored ${kid.name} \u2014 ${fmt(sc)}`, icon: "\ud83d\udcdd" });
  });
  recentEvents.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const recentFive = recentEvents.slice(0, 5);

  const daysSince = (dateStr) => {
    if (!dateStr) return "";
    const d = Math.floor((new Date() - new Date(dateStr)) / 86400000);
    if (d === 0) return "Today"; if (d === 1) return "Yesterday"; return `${d}d ago`;
  };

  const CTABtn = ({ label, color, onClick }) => (
    <button onClick={onClick} style={{
      marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${color}44`,
      background: color + "15", color, fontSize: 12, fontWeight: 700, cursor: "pointer",
      letterSpacing: "0.3px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    }}>{label} \u203a</button>
  );

  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h1 style={{ ...s.h1, margin: 0, fontSize: 26 }}>
          {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}, {loggedCoach || "Coach"}
        </h1>
        <PageHelp page="home" />
      </div>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
        {DAY_NAMES[new Date().getDay()]}, {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        {!isAdmin && loggedGym && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: C.red + "20", color: C.red }}>{"\ud83d\udccd"} {loggedGym}</span>}
      </div>
      {isAdmin && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Showing all gyms</div>}

      <h2 style={s.h2}>Yesterday{"\u2019"}s Classes {"\u2014"} {yesterdayDayName}</h2>
      {yesterdayCards.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", color: C.textDim, fontSize: 13 }}>No classes scheduled yesterday</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 6 }}>
          {yesterdayCards.map((c, i) => (
            <div key={i} style={{ ...s.card, marginBottom: 0, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, borderLeft: `3px solid ${c.ct ? c.ct.color : C.textDim}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{c.ct ? c.ct.name : c.slot.classTypeId}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>{c.slot.time}</span>
                  {isAdmin && <span style={{ fontSize: 10, color: C.textMuted }}>{"\u00b7"} {c.slot.gym}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ height: 4, background: C.card2, borderRadius: 2, overflow: "hidden", flex: 1 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (c.attendCount / c.capacity) * 100)}%`, background: c.ct ? c.ct.color : C.textDim, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, color: c.attendCount > 0 ? (c.ct ? c.ct.color : C.text) : C.textDim, fontWeight: 600, flexShrink: 0 }}>{c.attendCount}/{c.capacity}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={s.h2}>Overview</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
        {[
          { label: "Total Active Kids", value: activeKids.length, sub: gymFilter || "All Gyms" },
          { label: "Active Last 30d", value: activePct30 + "%", sub: `${kidsAttended30.size} of ${activeKids.length} trained`, color: activePct30 >= 80 ? C.green : activePct30 >= 50 ? C.orange : C.red },
          { label: "Avg Class Attendance", value: avgClassAtt30, sub: "last 30 days" },
          { label: "Top Class (30d)", value: topClassDisplay, sub: topClassSub, color: topClass ? C.green : undefined, small: true },
        ].map((card, i) => (
          <div key={i} style={{ ...s.card, textAlign: "center", padding: "12px 10px", marginBottom: 0 }}>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: card.small ? 18 : 28, fontWeight: 900, color: card.color || C.text, fontFamily: "'Bebas Neue', sans-serif", lineHeight: 1 }}>{card.value}</div>
            {card.sub && <div style={{ fontSize: 10, color: C.red, fontWeight: 600, marginTop: 2 }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      {!isCommunity && <>
        <h2 style={s.h2}>Action Items</h2>
        {overdueKids.length > 0 && (
          <div style={{ ...s.card, borderLeft: `3px solid ${C.orange}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>{"\ud83d\udd34"}</span><span style={{ fontSize: 13, fontWeight: 700 }}>Overdue Assessments</span></div>
              <div style={{ background: C.orange + "20", color: C.orange, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>{overdueKids.length}</div>
            </div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>{overdueKids.length} kids not yet scored {"\u00b7"} {currentCycle}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {overdueKids.slice(0, 4).map(k => (
                <span key={k.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: C.orange + "11", border: `1px solid ${C.orange}33`, color: C.text }}>{k.name}</span>
              ))}
              {overdueKids.length > 4 && <span style={{ fontSize: 11, padding: "3px 8px", color: C.orange, fontWeight: 600 }}>+{overdueKids.length - 4} more</span>}
            </div>
            <CTABtn label="Go to Score" color={C.orange} onClick={() => onNavigate("score")} />
          </div>
        )}
        {promoReady.length > 0 && (
          <div style={{ ...s.card, borderLeft: `3px solid ${C.green}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>{"\u2b50"}</span><span style={{ fontSize: 13, fontWeight: 700 }}>Promotion Ready</span></div>
              <div style={{ background: C.green + "20", color: C.green, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>{promoReady.length}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {promoReady.slice(0, 5).map(p => (
                <div key={p.kid.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0, background: BELT_HEX[p.kid.belt] || "#888", border: p.kid.belt === "White" ? "1px solid #555" : "none" }} />
                  <span>{p.kid.name}</span>
                  <span style={{ color: C.textDim, fontSize: 11 }}>{p.kid.belt} {"\u00b7"} {p.beltReady ? "belt ready" : `${p.kid.stripes || 0} \u2192 ${(p.kid.stripes || 0) + 1} stripes`}</span>
                </div>
              ))}
              {promoReady.length > 5 && <div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>+{promoReady.length - 5} more</div>}
            </div>
            <CTABtn label="Go to Promotions" color={C.green} onClick={() => onNavigate("promotion")} />
          </div>
        )}
        {atRisk.length > 0 && atRisk[0].classes30d < 3 && (
          <div style={{ ...s.card, borderLeft: `3px solid ${C.red}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>{"\u26a0\ufe0f"}</span><span style={{ fontSize: 13, fontWeight: 700 }}>At-Risk Attendance</span></div>
              <div style={{ background: C.red + "20", color: C.red, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>{atRisk.filter(a => a.classes30d < 3).length}</div>
            </div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Lowest training frequency in last 30 days</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {atRisk.map((a, i) => (
                <div key={a.kid.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: i < atRisk.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, width: 16 }}>{i + 1}.</span>
                    <span>{a.kid.name}</span>
                  </div>
                  <span style={{ color: a.classes30d === 0 ? C.red : C.orange, fontSize: 11, fontWeight: 600 }}>
                    {a.classes30d === 0 ? "0 classes" : `${a.classes30d} class${a.classes30d > 1 ? "es" : ""}`}
                  </span>
                </div>
              ))}
            </div>
            <CTABtn label="View Roster by Training" color={C.red} onClick={() => onNavigate("roster_training")} />
          </div>
        )}
        {overdueKids.length === 0 && promoReady.length === 0 && (atRisk.length === 0 || atRisk[0].classes30d >= 3) && (
          <div style={{ ...s.card, textAlign: "center", color: C.green, fontSize: 13 }}>{"\u2713"} No action items {"\u2014"} looking good!</div>
        )}
      </>}

      <h2 style={s.h2}>Recent Activity</h2>
      {recentFive.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", color: C.textDim, fontSize: 13 }}>No recent activity</div>
      ) : (
        <div style={s.card}>
          {recentFive.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < recentFive.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.text}</div></div>
              <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>{daysSince(item.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RosterScreen({ roster, setRoster, config, assessments, onViewProfile, defaultGym, isAdmin, selections, attendance, defaultSort }) {
  const [search, setSearch] = useState("");
  const [filterGym, setFilterGym] = useState(defaultGym || "");
  const [filterActive, setFilterActive] = useState("active");
  const [filterAge, setFilterAge] = useState("");
  const [filterWeight, setFilterWeight] = useState("");
  const [filterComp, setFilterComp] = useState("");
  const [sortBy, setSortBy] = useState("name");
  useEffect(() => { if (defaultSort) setSortBy(defaultSort); }, [defaultSort]);
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState(null); // null | "add" | kid object
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const currentCycle = config.cycles.filter(c => isQuarterClosed(c)).slice(-1)[0] || config.cycles[0] || "";

  // Comp team kid IDs
  const compIds = useMemo(() => {
    const ids = new Set();
    Object.values(selections || {}).forEach(arr => arr.forEach(id => ids.add(id)));
    return ids;
  }, [selections]);

  // Weekly training avg per kid (last 90 days)
  const weeklyAvg = useMemo(() => {
    const d90 = new Date(); d90.setDate(d90.getDate() - 90);
    const cutoff = d90.toISOString().slice(0, 10);
    const recent = (attendance || []).filter(r => r.date >= cutoff);
    const weeks = Math.max(1, Math.round(90 / 7));
    const map = {};
    roster.forEach(k => {
      const attended = recent.filter(r => r.records?.[k.id] === "attend").length;
      map[k.id] = parseFloat((attended / weeks).toFixed(1));
    });
    return map;
  }, [attendance, roster]);

  // Assessment status per kid
  const kidStatus = useMemo(() => {
    const status = {};
    roster.forEach(k => {
      const kidAss = assessments.filter(a => a.kidId === k.id).sort((a, b) => b.date.localeCompare(a.date));
      const latest = kidAss[0];
      const hasCurrent = kidAss.some(a => a.cycle === currentCycle);
      let trend = null;
      if (kidAss.length >= 2) {
        const s1 = computeSubtotals(kidAss[0].scores, config).final;
        const s0 = computeSubtotals(kidAss[1].scores, config).final;
        trend = s1 > s0 + 0.1 ? "↑" : s1 < s0 - 0.1 ? "↓" : "→";
      }
      const score = latest ? computeSubtotals(latest.scores, config).final : 0;
      status[k.id] = { latest, hasCurrent, trend, count: kidAss.length, score };
    });
    return status;
  }, [roster, assessments, config, currentCycle]);

  const filtered = useMemo(() => {
    return roster.filter(k => {
      if (search && !k.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGym && !kidInGym(k, filterGym)) return false;
      if (filterActive === "active" && !k.active) return false;
      if (filterActive === "inactive" && k.active) return false;
      if (filterActive === "overdue" && (!k.active || kidStatus[k.id]?.hasCurrent)) return false;
      if (filterAge) {
        const ac = ageCat(ageAt(k.dob, today()));
        if (ac !== filterAge) return false;
      }
      if (filterWeight) {
        const ac = ageCat(ageAt(k.dob, today()));
        const wc = weightCat(k.weight, ac, config.weightRules || {});
        if (wc !== filterWeight) return false;
      }
      if (filterComp === "yes" && !compIds.has(k.id)) return false;
      if (filterComp === "no" && compIds.has(k.id)) return false;
      return true;
    }).sort((a, b) => {
      const dir = sortBy.endsWith("_asc") ? 1 : -1;
      const field = sortBy.replace(/_asc|_desc/, "");
      switch (field) {
        case "name": {
          const cmp = a.name.localeCompare(b.name);
          return sortBy === "name" ? cmp : sortBy === "name_asc" ? -cmp : cmp;
        }
        case "age": return dir * (ageAt(a.dob, today()) - ageAt(b.dob, today()));
        case "weight": return dir * ((a.weight || 0) - (b.weight || 0));
        case "score": return dir * ((kidStatus[a.id]?.score || 0) - (kidStatus[b.id]?.score || 0));
        case "training": return dir * ((weeklyAvg[a.id] || 0) - (weeklyAvg[b.id] || 0));
        case "belt": {
          const bi = (config.belts || []).indexOf(a.belt) - (config.belts || []).indexOf(b.belt);
          const cmp = bi !== 0 ? bi : (a.stripes || 0) - (b.stripes || 0);
          return dir * cmp;
        }
        default: return 0;
      }
    });
  }, [roster, search, filterGym, filterActive, filterAge, filterWeight, filterComp, sortBy, kidStatus, compIds, weeklyAvg, config]);

  const hasFilters = filterAge || filterWeight || filterComp || sortBy !== "name";
  const clearFilters = () => { setFilterAge(""); setFilterWeight(""); setFilterComp(""); setSortBy("name"); };

  const nextId = () => {
    const nums = roster.map(k => parseInt(k.id.slice(1))).filter(n => !isNaN(n));
    const next = Math.max(0, ...nums) + 1;
    return "K" + String(next).padStart(3, "0");
  };

  const saveKid = (kid) => {
    setRoster(prev => {
      const exists = prev.find(k => k.id === kid.id);
      if (exists) return prev.map(k => k.id === kid.id ? kid : k);
      return [...prev, kid];
    });
    setModal(null);
  };

  const parseImport = () => {
    if (!importText.trim()) return;
    const lines = importText.trim().split("\n").filter(l => l.trim());
    const newKids = [];
    let nextNum = Math.max(0, ...roster.map(k => parseInt(k.id.slice(1))).filter(n => !isNaN(n))) + 1;
    lines.forEach(line => {
      const cols = line.split(/\t|,/).map(c => c.trim());
      if (cols.length < 2) return;
      // Expected: Name, DOB, Belt (opt), Weight (opt), Gym (opt), Stripes (opt), ClassOffset (opt)
      const name = cols[0];
      if (!name || name.toLowerCase() === "name") return; // skip header
      const dob = cols[1] || "";
      const belt = cols[2] || "White";
      const weight = parseFloat(cols[3]) || 25;
      const gym = cols[4] || config.gyms[0] || "";
      const stripes = parseInt(cols[5]) || 0;
      const classCountOffset = parseInt(cols[6]) || 0;
      const gyms = gym.includes("+") ? gym.split("+").map(g => g.trim()) : [gym];
      newKids.push({ id: "K" + String(nextNum++).padStart(3, "0"), name, dob, belt, weight, gyms, active: true, stripes, classCountOffset });
    });
    if (newKids.length > 0) {
      setRoster(prev => [...prev, ...newKids]);
      setImportText("");
      setShowImport(false);
    }
  };

  const overdueCount = roster.filter(k => k.active && !kidStatus[k.id]?.hasCurrent).length;

  return (
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ ...s.h1, margin: 0 }}>Roster</h1>
          <PageHelp page="roster" />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={s.btnSm} onClick={() => setShowImport(!showImport)}>📋 Import</button>
          <button style={s.btn} onClick={() => setModal("add")}>+ Add Kid</button>
        </div>
      </div>

      {/* Bulk Import */}
      {showImport && (
        <div style={{ ...s.card, marginBottom: 14, border: `1px solid ${C.red}33` }}>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>
            Paste rows: <b>Name, DOB, Belt, Weight, Gym, Stripes, ClassOffset</b> (tab or comma separated). Stripes &amp; ClassOffset optional (default 0). First row can be a header.
          </div>
          <textarea style={{ ...s.input, height: 100, fontFamily: "monospace", fontSize: 11 }} placeholder={"John Doe\t2017-03-15\tWhite\t28\tJing'An\t2\t5\nJane Smith\t2016-05-20\tGrey\t32\tXuhui\t3\t0"} value={importText} onChange={e => setImportText(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            <button style={s.btnSm} onClick={() => { setShowImport(false); setImportText(""); }}>Cancel</button>
            <button style={s.btn} onClick={parseImport}>Import {importText.trim().split("\n").filter(l => l.trim() && !l.toLowerCase().startsWith("name")).length} kids</button>
          </div>
        </div>
      )}

      <input style={{ ...s.input, marginBottom: 10 }} placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} />

      {isAdmin ? (
        <div style={{ display: "flex", marginBottom: 10, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <button onClick={() => setFilterGym("")} style={{
            padding: "7px 10px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
            background: !filterGym ? C.red + "18" : "transparent",
            borderBottom: !filterGym ? `2px solid ${C.red}` : "2px solid transparent",
            color: !filterGym ? C.red : C.textDim, transition: "all 0.15s",
          }}>All</button>
          {config.gyms.map(g => (
            <button key={g} onClick={() => setFilterGym(g)} style={{
              flex: 1, padding: "7px 6px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: filterGym === g ? C.red + "18" : "transparent",
              borderBottom: filterGym === g ? `2px solid ${C.red}` : "2px solid transparent",
              color: filterGym === g ? C.red : C.textDim, transition: "all 0.15s",
            }}>{g}</button>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>📍 {filterGym}</div>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Tabs items={["all", "active", "inactive", "overdue"]} active={filterActive} onChange={setFilterActive} />
        <button onClick={() => setShowFilters(!showFilters)} style={{
          ...s.btnSm, marginLeft: "auto", fontSize: 11, padding: "4px 10px",
          background: hasFilters ? C.red + "22" : "transparent", color: hasFilters ? C.red : C.textDim,
          border: `1px solid ${hasFilters ? C.red : C.border}`,
        }}>⚙ Filter{hasFilters ? " ●" : ""}</button>
      </div>

      {showFilters && (
        <div style={{ ...s.card, marginBottom: 12, padding: 12, border: `1px solid ${C.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", marginBottom: 3, fontWeight: 700 }}>Age</div>
              <select style={{ ...s.select, fontSize: 12 }} value={filterAge} onChange={e => setFilterAge(e.target.value)}>
                <option value="">All ages</option>
                {["U8", "U10", "U12", "U14"].map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", marginBottom: 3, fontWeight: 700 }}>Weight</div>
              <select style={{ ...s.select, fontSize: 12 }} value={filterWeight} onChange={e => setFilterWeight(e.target.value)}>
                <option value="">All weights</option>
                {["Light", "Medium", "Heavy"].map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", marginBottom: 3, fontWeight: 700 }}>Comp Team</div>
              <select style={{ ...s.select, fontSize: 12 }} value={filterComp} onChange={e => setFilterComp(e.target.value)}>
                <option value="">All</option>
                <option value="yes">🏆 Selected</option>
                <option value="no">Not selected</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", marginTop: 10, marginBottom: 5, fontWeight: 700 }}>Sort by</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { field: "name", label: "Name" },
              { field: "age", label: "Age" },
              { field: "weight", label: "Weight" },
              { field: "belt", label: "Belt" },
              { field: "score", label: "Score" },
              { field: "training", label: "Training" },
            ].map(({ field, label }) => {
              const base = sortBy.replace(/_asc|_desc/, "");
              const isActive = base === field || sortBy === field;
              const isDesc = sortBy === `${field}_desc` || (sortBy === field && field === "name");
              const arrow = isActive ? (isDesc ? " ↓" : " ↑") : "";
              return (
                <button key={field} onClick={() => {
                  if (!isActive) {
                    // Default direction per field
                    const defaultDesc = ["score", "training", "belt"].includes(field);
                    setSortBy(defaultDesc ? `${field}_desc` : (field === "name" ? "name" : `${field}_asc`));
                  } else {
                    // Toggle direction
                    if (sortBy.endsWith("_desc")) setSortBy(`${field}_asc`);
                    else if (sortBy.endsWith("_asc")) setSortBy(`${field}_desc`);
                    else if (field === "name") setSortBy("name_asc");
                    else setSortBy(`${field}_desc`);
                  }
                }} style={{
                  padding: "5px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${isActive ? C.red : C.border}`,
                  background: isActive ? C.red + "22" : "transparent",
                  color: isActive ? C.red : C.textDim,
                }}>{label}{arrow}</button>
              );
            })}
          </div>
          {hasFilters && (
            <button onClick={clearFilters} style={{ ...s.btnSm, marginTop: 8, fontSize: 11, color: C.red }}>✕ Clear filters</button>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>
        {filtered.length} kids{overdueCount > 0 && filterActive !== "overdue" ? ` · ${overdueCount} overdue` : ""}
      </div>

      {filtered.map(kid => {
        const age = ageAt(kid.dob, today());
        const st = kidStatus[kid.id] || {};
        const wk = weeklyAvg[kid.id] || 0;
        const isComp = compIds.has(kid.id);
        return (
          <div key={kid.id} style={{ ...s.card, opacity: kid.active ? 1 : 0.5, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            onClick={() => onViewProfile(kid.id)}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: C.red + "22", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.red, fontSize: 14, flexShrink: 0 }}>
              {kid.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
                {kid.name}
                {isComp && <span style={{ fontSize: 10 }}>🏆</span>}
                <span style={{ color: C.textDim, fontWeight: 400, fontSize: 12 }}>{kid.id}</span>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                {age}y · {kid.weight}kg · {kidGymsStr(kid)}
              </div>
              <div style={{ fontSize: 11, marginTop: 2, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {st.score > 0 && <span style={{ fontWeight: 700, color: st.score >= 4 ? "#4CAF50" : st.score >= 3 ? "#ff9800" : C.red }}>{fmt(st.score)}</span>}
                <span style={{ color: wk >= 3 ? "#4CAF50" : wk >= 2 ? "#ff9800" : C.textDim, fontWeight: 600, fontSize: 10 }}>{wk}/wk</span>
                {st.trend && <span style={{ color: st.trend === "↑" ? C.green : st.trend === "↓" ? "#f44" : C.textDim, fontWeight: 700 }}>{st.trend}</span>}
                {!st.hasCurrent && kid.active && <span style={{ color: "#f44", fontWeight: 600, fontSize: 10, background: "#f4422a22", padding: "1px 5px", borderRadius: 4 }}>OVERDUE</span>}
                {!st.latest && <span style={{ color: "#f44", fontSize: 10, fontWeight: 600 }}>No assessments</span>}
              </div>
            </div>
            <BeltBadge belt={kid.belt} />
            <button style={{ ...s.btnSm, padding: "4px 8px" }} onClick={e => { e.stopPropagation(); setModal(kid); }}>Edit</button>
            <button style={{ ...s.btnSm, padding: "4px 8px", fontSize: 11, color: kid.active ? C.textDim : "#4CAF50" }} onClick={e => {
              e.stopPropagation();
              setRoster(prev => prev.map(k => k.id === kid.id ? { ...k, active: !k.active } : k));
            }}>{kid.active ? "⏸" : "▶"}</button>
            <button style={{ ...s.btnSm, padding: "4px 8px", fontSize: 11, color: "#f44" }} onClick={e => {
              e.stopPropagation();
              if (confirm(`Delete ${kid.name}? This will also remove all their assessments.`)) {
                setRoster(prev => prev.filter(k => k.id !== kid.id));
              }
            }}>🗑</button>
          </div>
        );
      })}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add Kid" : "Edit Kid"}>
        {modal && <KidForm kid={modal === "add" ? { id: nextId(), name: "", dob: "", belt: "White", weight: 25, gyms: [defaultGym || config.gyms[0] || ""], active: true, stripes: 0, classCountOffset: 0, isNew: true } : modal} config={config} onSave={saveKid} onCancel={() => setModal(null)} />}
      </Modal>
    </div>
  );
}

function KidForm({ kid, config, onSave, onCancel }) {
  const [form, setForm] = useState({ ...kid });
  const up = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div>
      <div style={s.grid2}>
        <div><label style={s.label}>Name</label><input style={s.input} value={form.name} onChange={e => up("name", e.target.value)} /></div>
        <div><label style={s.label}>Date of Birth</label><input style={s.input} type="date" value={form.dob} onChange={e => up("dob", e.target.value)} /></div>
        <div><label style={s.label}>Belt</label>
          <select style={s.select} value={form.belt} onChange={e => up("belt", e.target.value)}>
            {config.belts.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div><label style={s.label}>Weight (kg)</label><input style={s.input} type="number" value={form.weight} onChange={e => up("weight", +e.target.value)} /></div>
        <div><label style={s.label}>Stripes</label>
          <select style={s.select} value={form.stripes || 0} onChange={e => up("stripes", +e.target.value)}>
            {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div><label style={s.label}>Class count in cycle</label>
          <select style={s.select} value={form.classCountOffset || 0} onChange={e => up("classCountOffset", +e.target.value)}>
            {[0,1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Prior classes within current stripe cycle (0-9)</div>
        </div>
        <div><label style={s.label}>Gym{form.isNew ? "" : "(s)"}</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {config.gyms.map(g => {
              const current = (form.gyms || [form.gym]).filter(Boolean);
              const selected = current.includes(g);
              return (
                <button key={g} type="button" onClick={() => {
                  if (form.isNew) {
                    up("gyms", [g]);
                  } else {
                    const next = selected ? current.filter(x => x !== g) : [...current, g];
                    if (next.length > 0) up("gyms", next);
                  }
                }} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: selected ? 700 : 400, cursor: "pointer",
                  background: selected ? C.red + "22" : C.card2, border: selected ? `2px solid ${C.red}` : `1px solid ${C.border}`,
                  color: selected ? C.red : C.text,
                }}>{selected ? "✓ " : ""}{g}</button>
              );
            })}
          </div>
        </div>
        <div><label style={s.label}>Status</label>
          <select style={s.select} value={form.active ? "active" : "inactive"} onChange={e => up("active", e.target.value === "active")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button style={s.btnSm} onClick={onCancel}>Cancel</button>
        <button style={s.btn} onClick={() => { if (form.name && form.dob && (form.gyms || []).filter(Boolean).length > 0) { const { isNew, ...data } = form; onSave(data); } }}>Save</button>
      </div>
    </div>
  );
}
/* ━━━ SCORING SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ScoringScreen({ roster, assessments, setAssessments, config, editingAssessment, setEditingAssessment, loggedCoach, isAdmin, loggedGym, logActivity }) {
  const [step, setStep] = useState(1);
  const [coach, setCoach] = useState((loggedCoach && loggedCoach !== "Admin") ? loggedCoach : coachName(config.coaches[0]) || "");
  const closedCycles = config.cycles.filter(c => isQuarterClosed(c));
  const [cycle, setCycle] = useState(closedCycles[closedCycles.length - 1] || config.cycles[0] || "");
  const [kidId, setKidId] = useState("");
  const [scores, setScores] = useState({});
  const [date, setDate] = useState(today());
  const [queue, setQueue] = useState([]); // multi-kid queue
  const [queueIdx, setQueueIdx] = useState(0);

  // If editing, load the assessment
  useEffect(() => {
    if (editingAssessment) {
      setCoach(editingAssessment.coach || coachName(config.coaches[0]));
      setCycle(editingAssessment.cycle);
      setKidId(editingAssessment.kidId);
      setScores({ ...editingAssessment.scores });
      setDate(editingAssessment.date);
      setStep(2);
      setQueue([]);
    }
  }, [editingAssessment]);

  const activeKids = roster.filter(k => k.active);
  const currentCoachObj = config.coaches.find(c => coachName(c) === coach);
  const coachGymFilter = coachGym(currentCoachObj);
  const gymFilteredKids = coachGymFilter ? activeKids.filter(k => kidInGym(k, coachGymFilter)) : activeKids;
  const assessedThisCycle = new Set(assessments.filter(a => a.cycle === cycle).map(a => a.kidId));
  const unassessedKids = gymFilteredKids.filter(k => !assessedThisCycle.has(k.id));
  const alreadyAssessedKids = gymFilteredKids.filter(k => assessedThisCycle.has(k.id));
  const kid = roster.find(k => k.id === kidId);
  const allCriteria = Object.values(config.criteria).flat();

  const setScore = (c, v) => setScores(p => ({ ...p, [c]: v }));

  const subtotals = useMemo(() => computeSubtotals(scores, config), [scores, config]);

  const submit = () => {
    const kid = roster.find(k => k.id === kidId);
    if (editingAssessment) {
      setAssessments(prev => prev.map(a => a.id === editingAssessment.id ? { ...a, date, coach, cycle, kidId, scores: { ...scores } } : a));
      logActivity({ type: "assessment_edit", coach, kidId, kidName: kid?.name || kidId, cycle });
      reset();
    } else {
      setAssessments(prev => [...prev, { id: uid(), date, coach, cycle, kidId, scores: { ...scores } }]);
      logActivity({ type: "assessment_new", coach, kidId, kidName: kid?.name || kidId, cycle });
      // If queue mode, advance to next kid
      if (queue.length > 0 && queueIdx < queue.length - 1) {
        const nextIdx = queueIdx + 1;
        setQueueIdx(nextIdx);
        setKidId(queue[nextIdx]);
        setScores({});
        setStep(2);
      } else {
        reset();
      }
    }
  };

  const reset = () => {
    setStep(1); setScores({}); setKidId(""); setEditingAssessment(null); setQueue([]); setQueueIdx(0);
  };

  const [expandedHint, setExpandedHint] = useState(null);

  const ScoreSelector = ({ criterion, value }) => {
    const hints = RUBRIC_HINTS[criterion];
    const isOpen = expandedHint === criterion;
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: C.text, fontWeight: 500, flex: 1 }}>{criterion}</div>
          {hints && (
            <button onClick={() => setExpandedHint(isOpen ? null : criterion)} style={{
              background: isOpen ? C.red : C.red + "22", border: "none",
              borderRadius: 20, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 14, color: isOpen ? "#fff" : C.red, flexShrink: 0, transition: "all 0.15s",
              fontWeight: 700,
            }}>{isOpen ? "✕" : "?"}</button>
          )}
        </div>
        {isOpen && hints && (
          <div style={{
            background: C.card2, borderRadius: 10, padding: 10, marginBottom: 8,
            border: `1px solid ${C.border}`, animation: "fadeIn 0.15s ease"
          }}>
            {hints.map((h, i) => (
              <div key={i} onClick={() => { setScore(criterion, i + 1); setExpandedHint(null); }} style={{
                display: "flex", gap: 8, padding: "7px 8px", borderRadius: 7, cursor: "pointer",
                background: value === i + 1 ? C.red + "22" : (i % 2 === 0 ? "transparent" : C.bg + "66"),
                border: value === i + 1 ? `1px solid ${C.red}44` : "1px solid transparent",
                marginBottom: 2, transition: "all 0.1s",
              }}>
                <span style={{
                  fontWeight: 800, fontSize: 14, color: value === i + 1 ? C.red : C.textDim,
                  minWidth: 18, textAlign: "center", lineHeight: "20px",
                }}>{i + 1}</span>
                <span style={{ fontSize: 11.5, color: C.text, lineHeight: "17px", opacity: 0.85 }}>{h}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4, 5].map(v => (
            <button key={v} onClick={() => setScore(criterion, v)} style={{
              flex: 1, height: 44, borderRadius: 8, border: value === v ? `2px solid ${C.red}` : `1px solid ${C.border}`,
              background: value === v ? C.red + "33" : C.card2, color: value === v ? C.red : C.textDim,
              fontSize: 16, fontWeight: 800, cursor: "pointer", transition: "all 0.15s"
            }}>{v}</button>
          ))}
        </div>
      </div>
    );
  };

  if (step === 1) {
    const toggleQueue = (id) => {
      setQueue(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    return (
      <div style={s.page}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h1 style={{ ...s.h1, margin: 0 }}>{editingAssessment ? "Edit Assessment" : "New Assessment"}</h1>
          <PageHelp page="score" />
        </div>
        <div style={s.card}>
          <div style={s.grid2}>
            <div><label style={s.label}>Date</label><input style={s.input} type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label style={s.label}>Cycle</label>
              <select style={s.select} value={cycle} onChange={e => setCycle(e.target.value)}>
                {closedCycles.map(c => <option key={c}>{c}</option>)}
              </select>
              {closedCycles.length === 0 && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>No completed quarters yet</div>}
            </div>
            <div><label style={s.label}>Coach</label>
              {loggedCoach === "Admin" ? (
                <select style={s.select} value={coach} onChange={e => setCoach(e.target.value)}>
                  {config.coaches.map(c => <option key={coachName(c)} value={coachName(c)}>{coachName(c)} ({coachGym(c)})</option>)}
                </select>
              ) : (
                <div style={{ ...s.input, background: C.card2, color: C.text, display: "flex", alignItems: "center" }}>{coach} ({coachGym(config.coaches.find(c => coachName(c) === coach)) || ""})</div>
              )}
            </div>
            {!queue.length && (
              <div><label style={s.label}>Kid</label>
                <select style={s.select} value={kidId} onChange={e => setKidId(e.target.value)}>
                  <option value="">Select kid…</option>
                  {unassessedKids.length > 0 && <option disabled>── Not assessed yet ──</option>}
                  {unassessedKids.map(k => <option key={k.id} value={k.id}>{k.name} ({kidGymsStr(k)})</option>)}
                  {alreadyAssessedKids.length > 0 && <option disabled>── Already assessed ──</option>}
                  {alreadyAssessedKids.map(k => <option key={k.id} value={k.id}>{k.name} ({kidGymsStr(k)}) ✓</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Multi-kid mode toggle */}
          {!editingAssessment && (
            <div style={{ marginTop: 12 }}>
              <button style={{ ...s.btnSm, fontSize: 11, width: "100%" }} onClick={() => { if (queue.length) { setQueue([]); } else { setKidId(""); setQueue([]); } }}>
                {queue.length > 0 ? "← Back to single kid" : "⚡ Score multiple kids"}
              </button>
            </div>
          )}

          {/* Multi-kid selector */}
          {queue.length > 0 || (!editingAssessment && !kidId && queue.length === 0) ? null : null}
          {!editingAssessment && !kidId && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>Tap kids to add to queue ({unassessedKids.length} not yet assessed):</div>
              <div style={{ maxHeight: 180, overflowY: "auto", padding: 2, border: `1px solid ${C.border}`, borderRadius: 10, background: C.card2 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8 }}>
                  {unassessedKids.map(k => {
                    const inQ = queue.includes(k.id);
                    return (
                      <button key={k.id} onClick={() => toggleQueue(k.id)} style={{
                        padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: inQ ? 700 : 400, cursor: "pointer",
                        background: inQ ? C.red + "22" : C.bg, border: inQ ? `2px solid ${C.red}` : `1px solid ${C.border}`,
                        color: inQ ? C.red : C.text, transition: "all 0.1s",
                      }}>
                        {inQ && <span style={{ marginRight: 4 }}>{queue.indexOf(k.id) + 1}.</span>}{k.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {alreadyAssessedKids.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>Already assessed this cycle:</div>
                  <div style={{ maxHeight: 100, overflowY: "auto", padding: 2, border: `1px solid ${C.border}33`, borderRadius: 10 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8 }}>
                      {alreadyAssessedKids.map(k => {
                        const inQ = queue.includes(k.id);
                        return (
                          <button key={k.id} onClick={() => toggleQueue(k.id)} style={{
                            padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: inQ ? 700 : 400, cursor: "pointer",
                            background: inQ ? C.red + "22" : "transparent", border: inQ ? `2px solid ${C.red}` : `1px solid ${C.border}33`,
                            color: inQ ? C.red : C.textDim, transition: "all 0.1s", opacity: 0.5,
                          }}>
                            {inQ && <span style={{ marginRight: 4 }}>{queue.indexOf(k.id) + 1}.</span>}✓ {k.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {kid && !queue.length && (
            <div style={{ marginTop: 12, padding: 10, background: C.card2, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <BeltBadge belt={kid.belt} />
              <span style={{ color: C.text, fontSize: 13 }}>{kid.name} · {ageAt(kid.dob, date)}y · {kid.weight}kg</span>
            </div>
          )}

          {queue.length > 0 && (
            <div style={{ marginTop: 12, padding: 10, background: C.red + "11", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: C.red, fontWeight: 700, marginBottom: 4 }}>Queue: {queue.length} kids</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{queue.map(id => roster.find(k => k.id === id)?.name).join(" → ")}</div>
            </div>
          )}

          <button style={{ ...s.btn, width: "100%", marginTop: 14, opacity: (kidId || queue.length > 0) ? 1 : 0.4 }}
            disabled={!kidId && queue.length === 0}
            onClick={() => {
              if (queue.length > 0) {
                setQueueIdx(0);
                setKidId(queue[0]);
                setScores({});
              }
              setStep(2);
            }}>
            {queue.length > 0 ? `Start Scoring (${queue.length} kids) →` : "Start Scoring →"}
          </button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    const filled = allCriteria.filter(c => scores[c]).length;
    const total = allCriteria.length;
    return (
      <div style={s.page}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h1 style={{ ...s.h1, margin: 0 }}>Score: {kid?.name}</h1>
          <button style={s.btnSm} onClick={reset}>← Back</button>
        </div>
        {queue.length > 1 && (
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>Kid {queueIdx + 1} of {queue.length}</div>
        )}
        <div style={{ height: 4, background: C.card2, borderRadius: 2, marginBottom: 16 }}>
          <div style={{ height: "100%", width: `${(filled / total) * 100}%`, background: C.red, borderRadius: 2, transition: "width 0.3s" }} />
        </div>

        {Object.entries(config.criteria).map(([cat, crits]) => (
          <div key={cat}>
            <h2 style={{ ...s.h2, color: CATEGORY_COLORS[cat] || C.red }}>{cat} <span style={{ fontWeight: 400, fontSize: 11 }}>({(config.scoringWeights[cat] * 100).toFixed(0)}%)</span></h2>
            <div style={s.card}>
              {crits.map(c => <ScoreSelector key={c} criterion={c} value={scores[c] || 0} />)}
            </div>
          </div>
        ))}

        <button style={{ ...s.btn, width: "100%", marginTop: 8, opacity: filled === total ? 1 : 0.4 }} disabled={filled < total} onClick={() => setStep(3)}>
          Review ({filled}/{total}) →
        </button>
      </div>
    );
  }

  // Step 3: Review
  return (
    <div style={s.page}>
      <h1 style={s.h1}>Review Assessment</h1>
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: C.text, fontWeight: 700 }}>{kid?.name}</span>
          <span style={{ color: C.textDim, fontSize: 12 }}>{date} · {cycle}</span>
        </div>
        <div style={{ textAlign: "center", margin: "12px 0" }}>
          <RadarChart data={{ BJJ: subtotals.BJJ, Athletic: subtotals.Athletic, Commitment: subtotals.Commitment, Competition: subtotals.Competition }} size={200} />
        </div>
        {Object.entries(config.criteria).map(([cat, crits]) => (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: CATEGORY_COLORS[cat] }}>{cat}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{fmt(subtotals[cat])}</span>
            </div>
            <ScoreBar value={subtotals[cat]} color={CATEGORY_COLORS[cat]} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
              {crits.map(c => (
                <span key={c} style={{ fontSize: 11, color: C.textDim }}>{c}: <b style={{ color: C.text }}>{scores[c]}</b></span>
              ))}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12, padding: 10, background: C.red + "11", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Final Score</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.red, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(subtotals.final)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={{ ...s.btnSm, flex: 1 }} onClick={() => setStep(2)}>← Edit</button>
        <button style={{ ...s.btn, flex: 2 }} onClick={submit}>
          {editingAssessment ? "Update" : queue.length > 0 && queueIdx < queue.length - 1 ? `Submit & Next Kid (${queueIdx + 2}/${queue.length}) →` : "Submit"} ✓
        </button>
      </div>
    </div>
  );
}


/* ━━━ RANKINGS SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function RankingsScreen({ roster, assessments, config, selections, setSelections, readOnly, isAdmin, loggedGym }) {
  const [filterCycle, setFilterCycle] = useState(config.cycles.filter(c => isQuarterClosed(c)).slice(-1)[0] || config.cycles[0] || "");
  const [filterAge, setFilterAge] = useState("");
  const [filterWeight, setFilterWeight] = useState("");
  const [filterGym, setFilterGym] = useState(isAdmin ? "" : (loggedGym || ""));

  const ranked = useMemo(() => computeRankings(assessments, roster, config), [assessments, roster, config]);

  const filtered = ranked.filter(e => {
    if (filterCycle && e.cycle !== filterCycle) return false;
    if (filterAge && e.ageCat !== filterAge) return false;
    if (filterWeight && e.weightCat !== filterWeight) return false;
    if (filterGym && !kidInGym(e.kid, filterGym)) return false;
    return true;
  });

  // Group by bracket
  const brackets = {};
  filtered.forEach(e => {
    const key = `${e.ageCat} · ${e.weightCat}`;
    if (!brackets[key]) brackets[key] = [];
    brackets[key].push(e);
  });
  // Sort each bracket by score and assign rank
  Object.values(brackets).forEach(group => {
    group.sort((a, b) => b.final - a.final);
    group.forEach((e, i) => e.rank = i + 1);
  });

  const toggleSelection = (kidId, cycle, bracket) => {
    const key = `${cycle}|${bracket}`;
    setSelections(prev => {
      const next = { ...prev };
      if (!next[key]) next[key] = [];
      if (next[key].includes(kidId)) next[key] = next[key].filter(id => id !== kidId);
      else next[key] = [...next[key], kidId];
      return next;
    });
  };

  const isSelected = (kidId, cycle, bracket) => {
    const key = `${cycle}|${bracket}`;
    return (selections[key] || []).includes(kidId);
  };

  const totalSelected = useMemo(() => {
    const ids = new Set();
    Object.entries(selections).forEach(([key, arr]) => {
      if (key.startsWith(filterCycle + "|")) {
        (arr || []).forEach(id => {
          const kid = roster.find(k => k.id === id);
          if (kid && kid.active && (!filterGym || kidInGym(kid, filterGym))) ids.add(id);
        });
      }
    });
    return ids.size;
  }, [selections, filterCycle, filterGym, roster]);

  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Rankings</h1>
        <PageHelp page="rankings" />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <select style={{ ...s.select, width: "auto", minWidth: 90 }} value={filterCycle} onChange={e => setFilterCycle(e.target.value)}>
          {config.cycles.map(c => <option key={c}>{c}</option>)}
        </select>
        <select style={{ ...s.select, width: "auto", minWidth: 70 }} value={filterAge} onChange={e => setFilterAge(e.target.value)}>
          <option value="">All Ages</option>
          {["U8", "U10", "U12", "U14"].map(a => <option key={a}>{a}</option>)}
        </select>
        <select style={{ ...s.select, width: "auto", minWidth: 80 }} value={filterWeight} onChange={e => setFilterWeight(e.target.value)}>
          <option value="">All Weights</option>
          {["Light", "Medium", "Heavy"].map(w => <option key={w}>{w}</option>)}
        </select>
        {isAdmin ? (
          <select style={{ ...s.select, width: "auto", minWidth: 80 }} value={filterGym} onChange={e => setFilterGym(e.target.value)}>
            <option value="">All Gyms</option>
            {config.gyms.map(g => <option key={g}>{g}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600, padding: "6px 0" }}>📍 {filterGym}</span>
        )}
      </div>

      {totalSelected > 0 && (
        <div style={{ ...s.card, background: C.red + "11", border: `1px solid ${C.red}33`, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>🥋 {totalSelected} selected for competition</span>
        </div>
      )}

      <button style={{ ...s.btnSm, marginBottom: 14 }} onClick={() => {
        const rows = [["Rank","Name","ID","Gym","Age Cat","Weight Cat","Belt","Cycle","Coach","BJJ","Athletic","Commitment","Competition","Final"]];
        filtered.forEach(e => {
          const sub = computeSubtotals(e.scores, config);
          rows.push([e.rank, e.kid.name, e.kidId, kidGymsStr(e.kid), e.ageCat, e.weightCat, e.kid.belt, e.cycle, e.coach,
            fmt(sub.BJJ), fmt(sub.Athletic), fmt(sub.Commitment), fmt(sub.Competition), fmt(sub.final)]);
        });
        const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `rankings_${filterCycle}.csv`; a.click();
        URL.revokeObjectURL(url);
      }}>📥 Export Rankings (CSV)</button>

      {Object.keys(brackets).length === 0 && (
        <div style={{ ...s.card, textAlign: "center", color: C.textDim }}>No assessments found for this cycle.</div>
      )}

      {Object.entries(brackets).sort().map(([bracket, entries]) => (
        <div key={bracket} style={{ marginBottom: 20 }}>
          <h2 style={s.h2}>{bracket}</h2>
          {entries.map((e, i) => {
            const sel = isSelected(e.kidId, e.cycle, bracket);
            return (
              <div key={e.id + i} style={{ ...s.card, display: "flex", alignItems: "center", gap: 10, borderLeft: sel ? `3px solid ${C.green}` : `3px solid transparent` }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, background: e.rank === 1 ? C.red : C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: e.rank === 1 ? "#fff" : C.textDim, fontSize: 13, flexShrink: 0 }}>
                  {e.rank}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{e.kid.name}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>{kidGymsStr(e.kid)} · {e.coach}</div>
                </div>
                <div style={{ textAlign: "right", marginRight: 6 }}>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>{fmt(e.final)}</div>
                  <ScoreBar value={e.final} color={C.red} />
                </div>
                <button onClick={() => toggleSelection(e.kidId, e.cycle, bracket)} style={{
                  padding: "6px 10px", borderRadius: 8, border: sel ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                  background: sel ? C.green + "22" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 700, color: sel ? C.green : C.textDim, flexShrink: 0, whiteSpace: "nowrap",
                }}>
                  {sel ? "✓ Selected" : "Select"}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}


/* ━━━ PROFILE SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ━━━ ATTENDANCE STATS (Profile) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AttendanceStats({ kidId, attendance, selections, config }) {
  const isCompKid = Object.values(selections || {}).some(arr => arr.includes(kidId));
  const classTypes = config?.classTypes || [];

  // Helper: determine category from attendance record (handles both old and new format)
  const recCategory = (r) => {
    if (r.classTypeId) {
      const ct = classTypes.find(c => c.id === r.classTypeId);
      return ct?.category || "group";
    }
    return r.type === "competition" ? "competition" : "group";
  };

  const stats = useMemo(() => {
    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const qStartStr = qStart.toISOString().slice(0, 10);
    const d90 = new Date(); d90.setDate(d90.getDate() - 90);
    const cutoff90 = d90.toISOString().slice(0, 10);

    const weeksBetween = (from, to) => Math.max(1, Math.round((to - from) / (7 * 86400000)));

    // All non-competition classes (group + private)
    const groupAll = (attendance || []).filter(r => recCategory(r) !== "competition");
    const groupQ = groupAll.filter(r => r.date >= qStartStr);
    const group90 = groupAll.filter(r => r.date >= cutoff90);

    const countAttend = (days) => days.filter(r => r.records?.[kidId] === "attend").length;
    const countAll = (days) => days.filter(r => r.records?.[kidId] !== undefined).length;

    const groupQAttend = countAttend(groupQ);
    const group90Attend = countAttend(group90);
    const group90Total = countAll(group90);

    // Competition classes
    const compAll = (attendance || []).filter(r => recCategory(r) === "competition");
    const compQ = compAll.filter(r => r.date >= qStartStr);
    const comp90 = compAll.filter(r => r.date >= cutoff90);
    const compQAttend = countAttend(compQ);
    const comp90Attend = countAttend(comp90);

    // Weekly avg = ALL classes (group + competition)
    const weeksQ = weeksBetween(qStart, now);
    const weeks90 = weeksBetween(d90, now);
    const avgWeeklyQ = ((groupQAttend + compQAttend) / weeksQ).toFixed(1);
    const avgWeekly90 = ((group90Attend + comp90Attend) / weeks90).toFixed(1);

    // Competition class % (only for selected kids)
    let compStats = null;
    if (isCompKid) {
      const compQTotal = compQ.filter(r => r.records?.[kidId] !== undefined).length;
      const comp90Total = comp90.filter(r => r.records?.[kidId] !== undefined).length;
      compStats = {
        qAttend: compQAttend, qTotal: compQTotal, qPct: compQTotal ? Math.round(compQAttend / compQTotal * 100) : 0,
        d90Attend: comp90Attend, d90Total: comp90Total, d90Pct: comp90Total ? Math.round(comp90Attend / comp90Total * 100) : 0,
      };
    }

    return {
      avgWeeklyQ, avgWeekly90,
      groupQAttend, group90Attend, group90Total,
      compStats,
      hasData: group90Total > 0 || comp90.length > 0,
    };
  }, [attendance, kidId, isCompKid]);

  if (!stats.hasData) return null;

  const MetricRow = ({ label, value, sub, color }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.textDim }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: color || C.text, fontFamily: "'Bebas Neue', sans-serif" }}>{value}</span>
        {sub && <span style={{ fontSize: 10, color: C.textDim }}>{sub}</span>}
      </div>
    </div>
  );

  const weeklyColor = (v) => parseFloat(v) >= 3 ? "#4CAF50" : parseFloat(v) >= 2 ? "#ff9800" : C.red;
  const pctColor = (v) => v >= 80 ? "#4CAF50" : v >= 60 ? "#ff9800" : C.red;

  return (
    <>
      <h2 style={s.h2}>Attendance 出勤</h2>
      <div style={s.card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>📈 Weekly Training Avg</div>
        <MetricRow label="This quarter" value={stats.avgWeeklyQ} sub="classes/week" color={weeklyColor(stats.avgWeeklyQ)} />
        <MetricRow label="Last 90 days" value={stats.avgWeekly90} sub="classes/week" color={weeklyColor(stats.avgWeekly90)} />
        <MetricRow label="Total this quarter" value={stats.groupQAttend + (stats.compStats?.qAttend || 0)} sub="classes" />

        {stats.compStats && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginTop: 14, marginBottom: 6 }}>🏆 Competition Classes</div>
            <MetricRow label="Attendance % (quarter)" value={`${stats.compStats.qPct}%`} sub={`${stats.compStats.qAttend}/${stats.compStats.qTotal}`} color={pctColor(stats.compStats.qPct)} />
            <MetricRow label="Attendance % (90 days)" value={`${stats.compStats.d90Pct}%`} sub={`${stats.compStats.d90Attend}/${stats.compStats.d90Total}`} color={pctColor(stats.compStats.d90Pct)} />
          </>
        )}
      </div>
    </>
  );
}

/* ━━━ TRAINING LOG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function TrainingLog({ kidId, attendance, config }) {
  const [expanded, setExpanded] = useState(false);
  const [filterType, setFilterType] = useState("");
  const classTypes = config?.classTypes || [];

  const log = useMemo(() => {
    const entries = [];
    (attendance || []).forEach(r => {
      const status = r.records?.[kidId];
      if (!status) return;
      const ct = r.classTypeId ? classTypes.find(c => c.id === r.classTypeId) : null;
      const category = ct?.category || (r.type === "competition" ? "competition" : "group");
      if (category !== "competition" && status !== "attend") return;
      entries.push({ date: r.date, time: r.time || "", type: r.classTypeId || r.type, typeName: ct?.name || (r.type === "competition" ? "Competition" : "Group"), typeColor: ct?.color || (category === "competition" ? "#FF9800" : "#4CAF50"), category, gym: r.gym, status, coach: r.coach || "" });
    });
    return entries.sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : b.time.localeCompare(a.time));
  }, [attendance, kidId, classTypes]);

  const filtered = filterType ? log.filter(e => e.type === filterType) : log;
  const shown = expanded ? filtered : filtered.slice(0, 15);

  // Weekly summary for header
  const now = new Date();
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay());
  const thisWeekStr = thisWeekStart.toISOString().slice(0, 10);
  const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekStr = lastWeekStart.toISOString().slice(0, 10);
  const thisWeek = log.filter(e => e.date >= thisWeekStr && e.status === "attend").length;
  const lastWeek = log.filter(e => e.date >= lastWeekStr && e.date < thisWeekStr && e.status === "attend").length;

  if (log.length === 0) return null;

  // Get unique types for filter buttons
  const uniqueTypes = [...new Set(log.map(e => e.type))];
  const getTypeMeta = (t) => {
    const ct = classTypes.find(c => c.id === t);
    if (ct) return { name: ct.name.length > 8 ? ct.name.slice(0, 8) : ct.name, color: ct.color };
    return { name: t === "competition" ? "Comp" : "Group", color: t === "competition" ? "#FF9800" : "#4CAF50" };
  };

  const statusStyle = (st) => st === "attend"
    ? { color: "#4CAF50", label: "✓" }
    : { color: "#f44336", label: "✗ missed" };

  // Group by month for visual separation
  let lastMonth = "";

  return (
    <>
      <h2 style={s.h2}>Training Log 训练日志</h2>
      <div style={s.card}>
        {/* Week summary */}
        <div style={{ display: "flex", gap: 12, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>This week</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: thisWeek >= 3 ? "#4CAF50" : thisWeek >= 2 ? "#ff9800" : C.red, fontFamily: "'Bebas Neue', sans-serif" }}>{thisWeek}</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Last week</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text, fontFamily: "'Bebas Neue', sans-serif" }}>{lastWeek}</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Total</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text, fontFamily: "'Bebas Neue', sans-serif" }}>{log.filter(e => e.status === "attend").length}</div>
          </div>
        </div>

        {/* Filter pills */}
        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <button onClick={() => setFilterType("")} style={{
            padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
            background: filterType === "" ? C.red : C.card2, color: filterType === "" ? "#fff" : C.textDim,
          }}>All ({log.length})</button>
          {uniqueTypes.map(t => {
            const meta = getTypeMeta(t);
            return (
              <button key={t} onClick={() => setFilterType(t)} style={{
                padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
                background: filterType === t ? meta.color + "33" : C.card2, color: filterType === t ? meta.color : C.textDim,
              }}>● {meta.name}</button>
            );
          })}
        </div>

        {/* Entries */}
        {shown.map((e, i) => {
          const month = e.date.slice(0, 7);
          const showMonth = month !== lastMonth;
          lastMonth = month;
          const ss = statusStyle(e.status);
          const d = new Date(e.date + "T00:00:00");
          const dayName = d.toLocaleDateString("en", { weekday: "short" });
          const dayNum = d.getDate();
          const monthName = d.toLocaleDateString("en", { month: "short" });
          return (
            <React.Fragment key={i}>
              {showMonth && (
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, padding: "8px 0 4px", marginTop: i > 0 ? 6 : 0 }}>
                  {d.toLocaleDateString("en", { month: "long", year: "numeric" })}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.border}22` }}>
                <div style={{ width: 36, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1 }}>{dayName}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{dayNum}</div>
                </div>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.typeColor, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{e.typeName}</span>
                  {e.time && <span style={{ fontSize: 10, color: C.textDim, marginLeft: 6 }}>{e.time}</span>}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: ss.color }}>{ss.label}</div>
              </div>
            </React.Fragment>
          );
        })}

        {filtered.length > 15 && (
          <button onClick={() => setExpanded(!expanded)} style={{
            width: "100%", marginTop: 8, padding: "8px 0", fontSize: 12, fontWeight: 700,
            background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.red, cursor: "pointer",
          }}>{expanded ? "Show less" : `Show all ${filtered.length} entries`}</button>
        )}
      </div>
    </>
  );
}

/* ━━━ GOALS SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function GoalsSection({ kidId, config, setConfig, readOnly }) {
  const goals = (config.goals || {})[kidId] || [];
  const [adding, setAdding] = useState(false);
  const [newGoal, setNewGoal] = useState("");

  const saveGoals = (updatedGoals) => {
    setConfig(p => ({ ...p, goals: { ...(p.goals || {}), [kidId]: updatedGoals } }));
  };

  const addGoal = () => {
    if (!newGoal.trim()) return;
    saveGoals([...goals, { text: newGoal.trim(), done: false, date: today() }]);
    setNewGoal(""); setAdding(false);
  };

  const toggleGoal = (idx) => {
    const next = [...goals]; next[idx] = { ...next[idx], done: !next[idx].done }; saveGoals(next);
  };

  const removeGoal = (idx) => {
    saveGoals(goals.filter((_, i) => i !== idx));
  };

  return (
    <>
      <h2 style={s.h2}>Goals 目标 {!readOnly && <span onClick={() => setAdding(!adding)} style={{ cursor: "pointer", fontSize: 14, float: "right" }}>{adding ? "✕" : "+ Add"}</span>}</h2>
      <div style={s.card}>
        {goals.length === 0 && !adding && (
          <div style={{ color: C.textDim, fontSize: 12, textAlign: "center", padding: "8px 0" }}>No goals set. {!readOnly && "Tap + Add to set focus areas for this kid."}</div>
        )}
        {goals.map((g, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: i < goals.length - 1 ? `1px solid ${C.border}` : "none" }}>
            {!readOnly && (
              <div onClick={() => toggleGoal(i)} style={{
                width: 22, height: 22, borderRadius: 6, marginTop: 1, flexShrink: 0, cursor: "pointer",
                border: g.done ? `2px solid ${C.green}` : `2px solid ${C.border}`,
                background: g.done ? C.green : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff",
              }}>{g.done ? "✓" : ""}</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: g.done ? C.textDim : C.text, textDecoration: g.done ? "line-through" : "none" }}>{g.text}</div>
              <div style={{ fontSize: 10, color: C.textDim }}>Set {g.date}</div>
            </div>
            {!readOnly && <button onClick={() => removeGoal(i)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 12, padding: 4 }}>✕</button>}
          </div>
        ))}
        {adding && (
          <div style={{ display: "flex", gap: 6, marginTop: goals.length ? 8 : 0 }}>
            <input style={{ ...s.input, flex: 1, fontSize: 13 }} placeholder="e.g. Improve guard retention…" value={newGoal}
              onChange={e => setNewGoal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addGoal(); }} autoFocus />
            <button style={s.btn} onClick={addGoal}>Save</button>
          </div>
        )}
      </div>
    </>
  );
}

/* ━━━ COMPARISON SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ComparisonSection({ assessments, config }) {
  const [open, setOpen] = useState(false);
  const [idxA, setIdxA] = useState(0); // latest
  const [idxB, setIdxB] = useState(1); // previous

  if (assessments.length < 2) return null;

  const a = assessments[idxA];
  const b = assessments[idxB];
  const subA = computeSubtotals(a.scores, config);
  const subB = computeSubtotals(b.scores, config);
  const cats = Object.keys(config.criteria);
  const dataA = {}; const dataB = {};
  cats.forEach(c => { dataA[c] = subA[c]; dataB[c] = subB[c]; });

  return (
    <>
      <h2 style={s.h2}>
        Compare 对比
        <span onClick={() => setOpen(!open)} style={{ cursor: "pointer", fontSize: 12, float: "right", color: C.textDim }}>{open ? "▲ Close" : "▼ Open"}</span>
      </h2>
      {open && (
        <div style={s.card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>● Current</label>
              <select style={{ ...s.select, fontSize: 12 }} value={idxA} onChange={e => setIdxA(Number(e.target.value))}>
                {assessments.map((a, i) => <option key={i} value={i}>{a.date} ({a.cycle})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#64B5F6", fontWeight: 700 }}>◆ Compare</label>
              <select style={{ ...s.select, fontSize: 12 }} value={idxB} onChange={e => setIdxB(Number(e.target.value))}>
                {assessments.map((a, i) => <option key={i} value={i}>{a.date} ({a.cycle})</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
            <RadarChart data={dataA} compareData={dataB} size={200} />
          </div>

          <div style={{ marginTop: 8 }}>
            {cats.map(c => {
              const diff = subA[c] - subB[c];
              const diffColor = diff > 0.05 ? C.green : diff < -0.05 ? C.red : C.textDim;
              return (
                <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: C.text, minWidth: 80 }}>{c}</span>
                  <span style={{ color: C.red, fontWeight: 600, minWidth: 36 }}>{fmt(subA[c])}</span>
                  <span style={{ color: "#64B5F6", fontWeight: 600, minWidth: 36 }}>{fmt(subB[c])}</span>
                  <span style={{ fontWeight: 700, color: diffColor }}>
                    {diff > 0.05 ? `↑ +${fmt(diff)}` : diff < -0.05 ? `↓ ${fmt(diff)}` : "= same"}
                  </span>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13, borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
              <span style={{ fontWeight: 800, color: C.text, minWidth: 80 }}>Final</span>
              <span style={{ color: C.red, fontWeight: 800, minWidth: 36 }}>{fmt(subA.final)}</span>
              <span style={{ color: "#64B5F6", fontWeight: 800, minWidth: 36 }}>{fmt(subB.final)}</span>
              <span style={{ fontWeight: 800, color: subA.final - subB.final > 0.05 ? C.green : subA.final - subB.final < -0.05 ? C.red : C.textDim }}>
                {subA.final - subB.final > 0.05 ? `↑ +${fmt(subA.final - subB.final)}` : subA.final - subB.final < -0.05 ? `↓ ${fmt(subA.final - subB.final)}` : "= same"}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProfileKidSelector({ roster, selectedKidId, setSelectedKidId, isAdmin, loggedGym, config }) {
  const [search, setSearch] = useState("");
  const [gym, setGym] = useState(loggedGym || (config?.gyms || [])[0] || "");
  const activeKids = roster.filter(k => k.active).sort((a, b) => a.name.localeCompare(b.name));
  const gymKids = isAdmin && !gym ? activeKids : activeKids.filter(k => kidInGym(k, gym));
  const filtered = search ? gymKids.filter(k => k.name.toLowerCase().includes(search.toLowerCase())) : [];
  const showList = search.length > 0 && filtered.length > 0 && !gymKids.find(k => k.id === selectedKidId && k.name.toLowerCase() === search.toLowerCase());

  return (
    <div style={{ ...s.card, marginBottom: 14 }}>
      <label style={s.label}>Select a kid</label>
      {isAdmin ? (
        <div style={{ display: "flex", marginBottom: 8, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
          {(config?.gyms || []).map(g => (
            <button key={g} onClick={() => { setGym(g); setSearch(""); }} style={{
              flex: 1, padding: "6px 4px", border: "none", cursor: "pointer",
              background: gym === g ? C.red + "18" : "transparent",
              borderBottom: gym === g ? `2px solid ${C.red}` : "2px solid transparent",
              color: gym === g ? C.red : C.textDim, fontWeight: 700, fontSize: 11, transition: "all 0.15s",
            }}>{g}</button>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>📍 {gym}</div>
      )}
      <input style={{ ...s.input, marginBottom: 6 }} type="text" placeholder="🔍 Search by name…" value={search}
        onChange={e => { setSearch(e.target.value); }} />
      {showList && (
        <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 6, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          {filtered.map(k => (
            <button key={k.id} onClick={() => { setSelectedKidId(k.id); setSearch(""); }} style={{
              display: "block", width: "100%", padding: "8px 12px", background: selectedKidId === k.id ? C.red + "18" : "transparent", border: "none",
              borderBottom: `1px solid ${C.border}`, textAlign: "left", cursor: "pointer", fontSize: 13, color: C.text,
            }}>
              <span style={{ fontWeight: 600 }}>{k.name}</span>
              <span style={{ color: C.textDim, fontSize: 11, marginLeft: 8 }}>{kidGymsStr(k)} · {k.belt}</span>
            </button>
          ))}
        </div>
      )}
      {search && filtered.length === 0 && (
        <div style={{ padding: "4px 0 6px", fontSize: 12, color: C.textDim }}>No kids matching "{search}"</div>
      )}
      <select style={s.select} value={selectedKidId || ""} onChange={e => { setSelectedKidId(e.target.value); setSearch(""); }}>
        <option value="">Choose…</option>
        {gymKids.map(k => (
          <option key={k.id} value={k.id}>{k.name} ({kidGymsStr(k)})</option>
        ))}
      </select>
    </div>
  );
}

function ProfileScreen({ roster, assessments, setAssessments, config, setConfig, selectedKidId, setSelectedKidId, onEditAssessment, isCommunity, isAdmin, loggedGym, attendance, selections }) {
  const kid = roster.find(k => k.id === selectedKidId);
  const kidAssessments = useMemo(() =>
    assessments.filter(a => a.kidId === selectedKidId).sort((a, b) => b.date.localeCompare(a.date)),
    [assessments, selectedKidId]
  );
  const latest = kidAssessments[0];
  const latestSub = latest ? computeSubtotals(latest.scores, config) : null;

  const deleteAssessment = (id) => {
    setAssessments(prev => prev.filter(a => a.id !== id));
  };

  const copyForAI = (a) => {
    const kid2 = roster.find(k => k.id === a.kidId);
    const sub = computeSubtotals(a.scores, config);
    const lines = [
      `Assessment: ${a.date} | ${a.cycle} | Coach: ${a.coach}`,
      `Kid: ${kid2?.name} (${a.kidId}) | Age: ${ageAt(kid2?.dob, a.date)} | ${kid2?.weight}kg | ${kidGymsStr(kid2)}`,
      ``,
      ...Object.entries(config.criteria).map(([cat, crits]) =>
        `${cat}: ${crits.map(c => `${c}=${a.scores[c]}`).join(", ")} → ${fmt(sub[cat])}`
      ),
      ``,
      `Final Score: ${fmt(sub.final)}`,
    ];
    navigator.clipboard?.writeText(lines.join("\n"));
  };

  const age = kid ? ageAt(kid.dob, today()) : 0;
  const ac = kid ? ageCat(age) : "";
  const wc = kid ? weightCat(kid.weight, ac, config.weightRules) : "";

  return (
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ ...s.h1, margin: 0 }}>Profile</h1>
          <PageHelp page="profile" />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {kid && <button style={s.btnSm} onClick={() => {
            const sub = latestSub;
            const prevAssessment = kidAssessments.length > 1 ? kidAssessments[1] : null;
            const prevSub = prevAssessment ? computeSubtotals(prevAssessment.scores, config) : null;
            const trend = prevSub ? sub.final - prevSub.final : 0;
            const trendIcon = trend > 0.1 ? "📈" : trend < -0.1 ? "📉" : "➡️";
            const trendWord = trend > 0.1 ? "improved" : trend < -0.1 ? "declined slightly" : "remained stable";
            const trendWordZh = trend > 0.1 ? "有所提升" : trend < -0.1 ? "略有下降" : "保持稳定";
            const pct = sub ? ((sub.final / 5) * 100).toFixed(0) : 0;

            // Find strongest and weakest categories
            const catScores = sub ? Object.entries(config.criteria).map(([cat, crits]) => ({
              cat, score: sub[cat], crits
            })).sort((a, b) => b.score - a.score) : [];
            const strongest = catScores[0];
            const weakest = catScores[catScores.length - 1];

            // Score bar helper
            const scoreBar = (val, max = 5) => {
              const p = (val / max) * 100;
              const color = val >= 4 ? "#4CAF50" : val >= 3 ? "#FFA726" : "#E53935";
              return `<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden"><div style="width:${p}%;height:100%;background:${color};border-radius:4px"></div></div><span style="font-weight:700;min-width:36px;text-align:right">${fmt(val)}</span></div>`;
            };

            const w = window.open("", "_blank");
            w.document.write(`<!DOCTYPE html><html><head><title>${kid.name} - Bushido BJJ Progress Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',-apple-system,sans-serif;max-width:680px;margin:0 auto;padding:32px 24px;color:#2a2a2a;line-height:1.5}
.header{text-align:center;padding:24px 0 20px;border-bottom:3px solid #C41E3A;margin-bottom:24px}
.header h1{font-size:28px;color:#C41E3A;letter-spacing:2px;margin-bottom:2px}
.header .subtitle{font-size:12px;color:#888;letter-spacing:1px}
.kid-name{font-size:22px;font-weight:800;margin-bottom:4px}
.kid-meta{font-size:13px;color:#666;margin-bottom:20px}
.kid-meta span{display:inline-block;padding:2px 10px;background:#f5f5f5;border-radius:10px;margin:2px 4px 2px 0;font-size:11px;font-weight:600}
.section{margin-bottom:22px}
.section h2{font-size:15px;font-weight:700;color:#C41E3A;margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid #eee}
.score-big{text-align:center;padding:16px;background:#fafafa;border-radius:12px;margin-bottom:16px}
.score-big .number{font-size:36px;font-weight:900;color:#C41E3A}
.score-big .label{font-size:12px;color:#888;margin-top:2px}
.score-big .trend{font-size:13px;margin-top:6px;color:#555}
.summary{font-size:13px;color:#444;padding:12px 16px;background:#f9f9f9;border-radius:8px;border-left:3px solid #C41E3A;margin-bottom:16px}
.summary .zh{color:#999;font-size:12px;margin-top:6px}
.cat-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f0f0f0}
.cat-row:last-child{border-bottom:none}
.cat-name{min-width:100px;font-weight:700;font-size:13px}
.cat-weight{font-size:10px;color:#999;font-weight:400}
.cat-bar{flex:1}
.criteria{font-size:11px;color:#888;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
th{background:#f5f5f5;font-weight:700;text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase;color:#666}
td{padding:8px 10px;border-bottom:1px solid #f0f0f0}
.footer{margin-top:32px;padding-top:16px;border-top:2px solid #C41E3A;text-align:center}
.footer .logo{font-size:16px;font-weight:800;color:#C41E3A;letter-spacing:2px}
.footer .meta{font-size:10px;color:#999;margin-top:4px}
.page-break{page-break-after:always}
@media print{body{padding:16px}@page{margin:15mm}}
</style></head><body>

<div class="header">
  <div style="font-size:28px;margin-bottom:4px">🥋</div>
  <h1>BUSHIDO</h1>
  <div class="subtitle">BJJ ACADEMY · PROGRESS REPORT · 进步报告</div>
</div>

<div class="kid-name">${kid.name}</div>
<div class="kid-meta">
  <span>🥋 ${kid.belt} Belt</span>
  <span>🎖 ${kid.stripes || 0}/${(config.promotionRules?.stripesForBelt || 4)} stripes</span>
  <span>📅 Age ${ageAt(kid.dob, today())}</span>
  <span>⚖️ ${kid.weight}kg</span>
  <span>🏠 ${kidGymsStr(kid)}</span>
  <span>📊 ${ac} · ${wc}</span>
</div>

${sub ? `
<div class="section">
  <h2>Overall Score 综合评分</h2>
  <div class="score-big">
    <div class="number">${fmt(sub.final)}<span style="font-size:16px;color:#888"> / 5.00</span></div>
    <div class="label">${pct}% of maximum · ${latest.cycle} · Assessed ${latest.date}</div>
    ${prevSub ? `<div class="trend">${trendIcon} Score has ${trendWord} since last assessment (${fmt(prevSub.final)} → ${fmt(sub.final)})</div>` : ""}
  </div>
</div>

<div class="section">
  <h2>Summary 评语</h2>
  <div class="summary">
    <strong>${kid.name}</strong> achieved an overall score of <strong>${fmt(sub.final)}/5.00</strong> in the ${latest.cycle} assessment cycle.
    ${strongest && weakest && strongest.cat !== weakest.cat ?
      `Their strongest area is <strong>${strongest.cat}</strong> (${fmt(strongest.score)}), while <strong>${weakest.cat}</strong> (${fmt(weakest.score)}) offers the most room for growth.` : ""}
    ${prevSub ? `Compared to the previous assessment, performance has ${trendWord} (${trend > 0 ? "+" : ""}${fmt(trend)}).` : "This is their first assessment on record."}
    <div class="zh">
      <strong>${kid.name}</strong> 在${latest.cycle}评估周期中获得了 <strong>${fmt(sub.final)}/5.00</strong> 的综合评分。
      ${strongest && weakest && strongest.cat !== weakest.cat ?
        `最强项是<strong>${strongest.cat}</strong>（${fmt(strongest.score)}），<strong>${weakest.cat}</strong>（${fmt(weakest.score)}）是最有提升空间的领域。` : ""}
      ${prevSub ? `与上次评估相比，表现${trendWordZh}（${trend > 0 ? "+" : ""}${fmt(trend)}）。` : "这是该学员的首次评估记录。"}
    </div>
  </div>
</div>

<div class="section">
  <h2>Category Breakdown 分项评分</h2>
  ${Object.entries(config.criteria).map(([cat, crits]) => `
    <div class="cat-row">
      <div class="cat-name">${cat} <span class="cat-weight">${(config.scoringWeights[cat]*100).toFixed(0)}%</span></div>
      <div class="cat-bar">
        ${scoreBar(sub[cat])}
        <div class="criteria">${crits.map(c => `${c}: ${latest.scores[c] || 0}/5`).join(" · ")}</div>
      </div>
    </div>
  `).join("")}
</div>
` : "<div class='section'><p style='color:#888'>No assessments recorded yet. 暂无评估记录。</p></div>"}

${(() => {
  const kidGoals = (config.goals || {})[kid.id] || [];
  if (!kidGoals.length) return "";
  return `<div class="section">
  <h2>Development Goals 发展目标</h2>
  <div style="padding:8px 0">
  ${kidGoals.map(g => `<div style="padding:6px 0;border-bottom:1px solid #f0f0f0;display:flex;gap:8px;align-items:flex-start">
    <span style="font-size:14px">${g.done ? "✅" : "🎯"}</span>
    <div><span style="font-size:13px;${g.done ? "text-decoration:line-through;color:#999" : ""}">${g.text}</span>
    <span style="font-size:10px;color:#999;margin-left:6px">Set ${g.date}</span></div>
  </div>`).join("")}
  </div></div>`;
})()}

${(() => {
  const kidAtt = (attendance || []).filter(r => r.records?.[kid.id]);
  if (!kidAtt.length) return "";
  const attend = kidAtt.filter(r => r.records[kid.id] === "attend").length;
  const cts = config.classTypes || [];
  const getCategory = (r) => { const ct = r.classTypeId ? cts.find(c => c.id === r.classTypeId) : null; return ct?.category || (r.type === "competition" ? "competition" : "group"); };
  const compAtt = kidAtt.filter(r => getCategory(r) === "competition" && r.records[kid.id] === "attend").length;
  const compMissed = kidAtt.filter(r => getCategory(r) === "competition" && r.records[kid.id] === "excused").length;
  // Per class type counts
  const typeCounts = {};
  kidAtt.filter(r => r.records[kid.id] === "attend").forEach(r => {
    const ct = r.classTypeId ? cts.find(c => c.id === r.classTypeId) : null;
    const name = ct?.name || (r.type === "competition" ? "Competition" : "Group");
    typeCounts[name] = (typeCounts[name] || 0) + 1;
  });
  const d90 = new Date(); d90.setDate(d90.getDate() - 90);
  const cutoff90 = d90.toISOString().slice(0, 10);
  const att90 = kidAtt.filter(r => r.date >= cutoff90 && r.records[kid.id] === "attend").length;
  const weeks90 = Math.max(1, Math.round((new Date() - d90) / (7 * 86400000)));
  const weeklyAvg = (att90 / weeks90).toFixed(1);
  return `<div class="section">
  <h2>Attendance Summary 出勤统计</h2>
  <table>
    <thead><tr><th>Metric 指标</th><th>Value 数值</th></tr></thead>
    <tbody>
    <tr><td>Avg weekly training (90d) 周均训练</td><td><strong>${weeklyAvg} classes/week</strong></td></tr>
    <tr><td>Total classes attended 出勤总数</td><td>${attend}</td></tr>
    ${Object.entries(typeCounts).map(([name, count]) => `<tr><td>${name}</td><td>${count}</td></tr>`).join("")}
    ${compMissed ? `<tr><td>Competition missed 竞赛缺席</td><td>${compMissed}</td></tr>` : ""}
    </tbody>
  </table></div>`;
})()}

${(() => {
  const promoLog = (config.promotionLog || []).filter(p => p.kidId === kid.id);
  if (!promoLog.length) return "";
  return `<div class="section">
  <h2>Promotion History 晋级记录</h2>
  <table>
    <thead><tr><th>Date 日期</th><th>Type 类型</th><th>Details 详情</th><th>By 授予</th></tr></thead>
    <tbody>
    ${promoLog.slice().reverse().map(p =>
      `<tr><td>${p.date}</td><td>${p.type === "belt" ? "🥋 Belt" : "🎖 Stripe"}</td><td>${p.type === "belt" ? `${p.from} → ${p.to}` : `Stripe ${p.to}${p.belt ? ` (${p.belt})` : ""}`}</td><td>${p.by}</td></tr>`
    ).join("")}
    </tbody>
  </table></div>`;
})()}

${kidAssessments.length > 1 ? `
<div class="section">
  <h2>Assessment History 评估历史</h2>
  <table>
    <thead><tr><th>Date 日期</th><th>Cycle 周期</th><th>Coach 教练</th><th>Score 分数</th><th>vs Prev</th></tr></thead>
    <tbody>
    ${kidAssessments.map((a, i) => {
      const s2 = computeSubtotals(a.scores, config);
      const prev = kidAssessments[i + 1] ? computeSubtotals(kidAssessments[i + 1].scores, config) : null;
      const diff = prev ? s2.final - prev.final : 0;
      const diffStr = prev ? (diff > 0 ? `<span style="color:#4CAF50">+${fmt(diff)}</span>` : diff < 0 ? `<span style="color:#E53935">${fmt(diff)}</span>` : `<span style="color:#888">—</span>`) : "—";
      return `<tr><td>${a.date}</td><td>${a.cycle}</td><td>${a.coach}</td><td style="font-weight:700">${fmt(s2.final)}</td><td>${diffStr}</td></tr>`;
    }).join("")}
    </tbody>
  </table>
</div>
` : ""}

<div class="footer">
  <div class="logo">🥋 BUSHIDO BJJ ACADEMY</div>
  <div class="meta">Progress Report generated on ${today()} · This report reflects the coach's professional assessment · 本报告由教练专业评估生成</div>
</div>

<script>window.print();</script>
</body></html>`);
            w.document.close();
          }}>📄 Parent Report</button>}
          {kid && <button style={s.btnSm} onClick={() => setSelectedKidId("")}>← Back</button>}
        </div>
      </div>

      {/* Kid Selector - search + list */}
      <ProfileKidSelector roster={roster} selectedKidId={selectedKidId} setSelectedKidId={setSelectedKidId} isAdmin={isAdmin} loggedGym={loggedGym} config={config} />

      {!kid && !selectedKidId && (
        <div style={{ ...s.card, color: C.textDim, textAlign: "center" }}>Select a kid above to view their profile</div>
      )}

      {/* Header Card */}
      {kid && (
        <div style={{ ...s.card, background: `linear-gradient(135deg, ${C.card} 0%, ${C.red}11 100%)` }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: C.red + "22", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: C.red, fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", flexShrink: 0, border: `2px solid ${C.red}44` }}>
              {kid.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{kid.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{kid.id} · {kidGymsStr(kid)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <BeltBadge belt={kid.belt} />
            {(kid.stripes > 0) && <span style={s.badge(C.red)}>{"🎖".repeat(kid.stripes || 0)}</span>}
            <span style={s.badge(C.blue)}>{age}y · {ac}</span>
            <span style={s.badge(C.orange)}>{kid.weight}kg · {wc}</span>
            <span style={s.badge(kid.active ? C.green : "#e74c3c")}>{kid.active ? "Active" : "Inactive"}</span>
            {(() => {
              const isCompKid = Object.values(selections || {}).some(arr => arr.includes(kid.id));
              if (isCompKid) return <span style={s.badge(C.red)}>🏆 Competition</span>;
              return null;
            })()}
          </div>
        </div>
      )}

      {/* Attendance Stats */}
      {kid && <AttendanceStats kidId={kid.id} attendance={attendance} selections={selections} config={config} />}

      {/* Training Log */}
      {kid && <TrainingLog kidId={kid.id} attendance={attendance} config={config} />}

      {/* Latest Assessment */}
      {kid && latestSub && (
        <>
          <h2 style={s.h2}>Latest Assessment</h2>
          <div style={s.card}>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>{latest.date} · {latest.cycle} · Coach: {latest.coach}</div>
            <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
              <RadarChart data={{ BJJ: latestSub.BJJ, Athletic: latestSub.Athletic, Commitment: latestSub.Commitment, Competition: latestSub.Competition }} size={180} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {Object.entries({ BJJ: latestSub.BJJ, Athletic: latestSub.Athletic, Commitment: latestSub.Commitment, Competition: latestSub.Competition }).map(([cat, val]) => (
                <div key={cat} style={{ padding: 8, background: C.card2, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: CATEGORY_COLORS[cat], fontWeight: 700, textTransform: "uppercase" }}>{cat}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{fmt(val)}</div>
                  <ScoreBar value={val} color={CATEGORY_COLORS[cat]} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: 10, background: C.red + "11", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Final</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.red, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(latestSub.final)}</div>
            </div>
          </div>
        </>
      )}

      {/* Goals */}
      {kid && <GoalsSection kidId={kid.id} config={config} setConfig={setConfig} readOnly={isCommunity} />}

      {/* Promotion History */}
      {kid && (() => {
        const log = (config.promotionLog || []).filter(p => p.kidId === kid.id);
        const rules = config.promotionRules || { stripeClasses: 10, stripesForBelt: 4 };
        if (!log.length && !(kid.stripes > 0)) return null;
        return (
          <>
            <h2 style={s.h2}>Promotions 晋级</h2>
            <div style={s.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: log.length ? 10 : 0 }}>
                <div style={{ display: "flex", gap: 3 }}>
                  {Array.from({ length: rules.stripesForBelt || 4 }).map((_, i) => (
                    <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: i < (kid.stripes || 0) ? C.red : C.border }} />
                  ))}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{kid.stripes || 0}/{rules.stripesForBelt || 4} stripes</span>
              </div>
              {log.slice().reverse().map((p, i) => (
                <div key={i} style={{ padding: "6px 0", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: p.type === "belt" ? C.orange : C.green }}>
                      {p.type === "belt" ? `🥋 ${p.from} → ${p.to}` : `🎖 Stripe ${p.to}`}
                    </span>
                    <span style={{ fontSize: 10, color: C.textDim }}> · {p.by}</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.textDim }}>{p.date}</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* Assessment Comparison */}
      {kid && kidAssessments.length >= 2 && (
        <ComparisonSection assessments={kidAssessments} config={config} />
      )}

      {/* Score Trend */}
      {kid && kidAssessments.length > 1 && (
        <>
          <h2 style={s.h2}>Score Trend</h2>
          <div style={s.card}>
            <TrendChart assessments={kidAssessments} config={config} />
          </div>
        </>
      )}

      {/* History */}
      {kid && (
        <>
          <h2 style={s.h2}>Assessment History ({kidAssessments.length})</h2>
          {kidAssessments.length === 0 && <div style={{ ...s.card, color: C.textDim, textAlign: "center" }}>No assessments yet</div>}
          {kidAssessments.map(a => {
            const sub = computeSubtotals(a.scores, config);
            return (
              <AssessmentCard key={a.id} a={a} sub={sub} config={config} onEdit={() => onEditAssessment(a)} onDelete={() => deleteAssessment(a.id)} onCopy={() => copyForAI(a)} />
            );
          })}
        </>
      )}
    </div>
  );
}

function AssessmentCard({ a, sub, config, onEdit, onDelete, onCopy }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={s.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{a.date} <span style={{ color: C.textDim, fontWeight: 400 }}>· {a.cycle}</span></div>
          <div style={{ fontSize: 11, color: C.textDim }}>Coach: {a.coach}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{fmt(sub.final)}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          {Object.entries(config.criteria).map(([cat, crits]) => (
            <div key={cat} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: CATEGORY_COLORS[cat] }}>{cat}: {fmt(sub[cat])}</div>
              <div style={{ fontSize: 11, color: C.textDim, marginLeft: 8 }}>
                {crits.map(c => `${c}: ${a.scores[c] || "—"}`).join(" · ")}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button style={s.btnSm} onClick={onEdit}>✏️ Edit</button>
            <button style={s.btnSm} onClick={onCopy}>📋 Copy for AI</button>
            <button style={s.btnDanger} onClick={onDelete}>🗑 Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendChart({ assessments, config }) {
  const sorted = [...assessments].sort((a, b) => a.date.localeCompare(b.date));
  const data = sorted.map(a => ({ date: a.date, ...computeSubtotals(a.scores, config) }));
  if (data.length < 2) return null;
  const w = 320, h = 140, pad = { t: 10, r: 10, b: 24, l: 30 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const maxVal = 5;
  const x = (i) => pad.l + (i / (data.length - 1)) * iw;
  const y = (v) => pad.t + ih - (v / maxVal) * ih;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {[1, 2, 3, 4, 5].map(v => (
        <g key={v}>
          <line x1={pad.l} y1={y(v)} x2={w - pad.r} y2={y(v)} stroke={C.border} strokeWidth={0.5} />
          <text x={pad.l - 4} y={y(v)} textAnchor="end" dominantBaseline="middle" fill={C.textDim} fontSize={9}>{v}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={h - 4} textAnchor="middle" fill={C.textDim} fontSize={8}>{d.date.slice(5)}</text>
      ))}
      {/* Final score line */}
      <polyline fill="none" stroke={C.red} strokeWidth={2}
        points={data.map((d, i) => `${x(i)},${y(d.final)}`).join(" ")} />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.final)} r={3.5} fill={C.red} />)}
    </svg>
  );
}


/* ━━━ REPORTING SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ReportingScreen({ roster, assessments, config, onViewProfile, onScore, readOnly, isAdmin, loggedGym, selections, attendance }) {
  const [filterCycle, setFilterCycle] = useState(config.cycles.filter(c => isQuarterClosed(c)).slice(-1)[0] || config.cycles[0] || "");
  const [filterGym, setFilterGym] = useState(isAdmin ? "" : (loggedGym || ""));
  const [reportView, setReportView] = useState("dashboard");

  const activeKids = roster.filter(k => k.active && (!filterGym || kidInGym(k, filterGym)));
  const cycleAss = assessments.filter(a => a.cycle === filterCycle);

  // Deduplicate: latest assessment per kid this cycle
  const latestByKid = {};
  cycleAss.forEach(a => {
    if (!latestByKid[a.kidId] || a.date > latestByKid[a.kidId].date) latestByKid[a.kidId] = a;
  });
  const uniqueAssessed = Object.values(latestByKid);

  // Overview
  const assessedIds = new Set(uniqueAssessed.map(a => a.kidId));
  const assessedCount = activeKids.filter(k => assessedIds.has(k.id)).length;
  const allScores = uniqueAssessed.map(a => computeSubtotals(a.scores, config).final);
  const avgScore = allScores.length ? allScores.reduce((s, v) => s + v, 0) / allScores.length : 0;
  const totalAssThisCycle = cycleAss.length;

  // By Gym
  const gymList = filterGym ? [filterGym] : config.gyms;
  const gyms = gymList.map(gym => {
    const gKids = activeKids.filter(k => kidInGym(k, gym));
    const gKidIds = new Set(gKids.map(k => k.id));
    const gAssessedIds = new Set(uniqueAssessed.filter(a => gKidIds.has(a.kidId)).map(a => a.kidId));
    const gScores = uniqueAssessed.filter(a => gKidIds.has(a.kidId)).map(a => computeSubtotals(a.scores, config).final);
    const avg = gScores.length ? gScores.reduce((s, v) => s + v, 0) / gScores.length : 0;
    const top = gScores.length ? Math.max(...gScores) : 0;
    return { gym, total: gKids.length, assessed: gAssessedIds.size, pct: gKids.length ? (gAssessedIds.size / gKids.length * 100) : 0, avg, top };
  });

  // By Coach
  const coachMap = {};
  cycleAss.forEach(a => {
    if (!coachMap[a.coach]) coachMap[a.coach] = { count: 0, kids: new Set(), scores: [], lastDate: "" };
    coachMap[a.coach].count++;
    coachMap[a.coach].kids.add(a.kidId);
    coachMap[a.coach].scores.push(computeSubtotals(a.scores, config).final);
    if (a.date > coachMap[a.coach].lastDate) coachMap[a.coach].lastDate = a.date;
  });
  const coaches = Object.entries(coachMap).map(([name, d]) => ({
    name, count: d.count, kids: d.kids.size,
    avg: d.scores.reduce((s, v) => s + v, 0) / d.scores.length,
    lastDate: d.lastDate,
  })).sort((a, b) => b.count - a.count);

  // By Age Category
  const ageCats = ["U8", "U10", "U12", "U14"].map(ac => {
    const kids = activeKids.filter(k => ageCat(ageAt(k.dob, today())) === ac);
    const ass = uniqueAssessed.filter(a => { const k = roster.find(x => x.id === a.kidId); return k && ageCat(ageAt(k.dob, today())) === ac; });
    const subs = ass.map(a => computeSubtotals(a.scores, config));
    const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    return {
      ac, total: kids.length, assessed: ass.length,
      avgFinal: avg(subs.map(s => s.final)),
      avgBJJ: avg(subs.map(s => s.BJJ)),
      avgAthletic: avg(subs.map(s => s.Athletic)),
      avgCommitment: avg(subs.map(s => s.Commitment)),
      avgCompetition: avg(subs.map(s => s.Competition)),
    };
  }).filter(a => a.total > 0);

  // Score Distribution
  const buckets = [
    { label: "1.0–2.0", min: 0, max: 2, count: 0, color: "#f44336" },
    { label: "2.0–3.0", min: 2, max: 3, count: 0, color: "#ff9800" },
    { label: "3.0–4.0", min: 3, max: 4, count: 0, color: "#2196f3" },
    { label: "4.0–5.0", min: 4, max: 5.01, count: 0, color: "#4CAF50" },
  ];
  allScores.forEach(sc => {
    const b = buckets.find(b => sc >= b.min && sc < b.max);
    if (b) b.count++;
  });
  const maxBucket = Math.max(1, ...buckets.map(b => b.count));

  // Overdue
  const overdueKids = activeKids.filter(k => !assessedIds.has(k.id));
  const overdueByGym = {};
  overdueKids.forEach(k => {
    const kGyms = Array.isArray(k.gyms) ? k.gyms : [k.gym || "Unknown"];
    kGyms.forEach(g => { if (!overdueByGym[g]) overdueByGym[g] = []; overdueByGym[g].push(k); });
  });

  const TableRow = ({ cells, header }) => (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: header ? "6px 0" : "8px 0" }}>
      {cells.map((cell, i) => (
        <div key={i} style={{
          flex: i === 0 ? 2 : 1, fontSize: header ? 10 : 12, fontWeight: header ? 700 : 400,
          color: header ? C.textDim : C.text, textTransform: header ? "uppercase" : "none",
          letterSpacing: header ? 0.5 : 0, textAlign: i === 0 ? "left" : "center",
        }}>{cell}</div>
      ))}
    </div>
  );

  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Reports</h1>
        <PageHelp page="reports" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select style={{ ...s.select, width: "auto", minWidth: 120 }} value={filterCycle} onChange={e => setFilterCycle(e.target.value)}>
          {config.cycles.map(c => <option key={c}>{c}</option>)}
        </select>
        {isAdmin ? (
          <select style={{ ...s.select, width: "auto", minWidth: 100 }} value={filterGym} onChange={e => setFilterGym(e.target.value)}>
            <option value="">All Gyms</option>
            {config.gyms.map(g => <option key={g}>{g}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>📍 {filterGym}</span>
        )}
      </div>

      {/* View Toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {[{ key: "dashboard", label: "📊 Dashboard" }, { key: "team", label: "🏆 Competition Team" }].map(v => (
          <button key={v.key} onClick={() => setReportView(v.key)} style={{
            flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
            background: reportView === v.key ? C.red : C.card, color: reportView === v.key ? "#fff" : C.textDim,
          }}>{v.label}</button>
        ))}
      </div>

      {reportView === "team" && <CompetitionTeamView roster={roster} assessments={assessments} config={config} selections={selections} attendance={attendance} filterCycle={filterCycle} filterGym={filterGym} onViewProfile={onViewProfile} />}

      {reportView === "dashboard" && <>
      {/* Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Active Kids", value: activeKids.length, sub: null },
          { label: "Assessed", value: assessedCount, sub: activeKids.length ? `${(assessedCount / activeKids.length * 100).toFixed(0)}%` : "—" },
          { label: "Avg Score", value: avgScore ? fmt(avgScore) : "—", sub: "this cycle" },
          { label: "Total Assessments", value: totalAssThisCycle, sub: uniqueAssessed.length !== totalAssThisCycle ? `${uniqueAssessed.length} unique` : "this cycle" },
        ].map((card, i) => (
          <div key={i} style={{ ...s.card, textAlign: "center", padding: 14 }}>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.text, fontFamily: "'Bebas Neue', sans-serif" }}>{card.value}</div>
            {card.sub && <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* By Gym */}
      <h2 style={s.h2}>By Gym</h2>
      <div style={s.card}>
        <TableRow header cells={["Gym", "Kids", "Done", "%", "Avg", "Top"]} />
        {gyms.map(g => (
          <TableRow key={g.gym} cells={[
            g.gym,
            g.total,
            g.assessed,
            <span style={{ color: g.pct < 50 ? "#f44" : g.pct < 80 ? "#ff9800" : C.green, fontWeight: 700 }}>{g.pct.toFixed(0)}%</span>,
            g.avg ? fmt(g.avg) : "—",
            g.top ? fmt(g.top) : "—",
          ]} />
        ))}
      </div>

      {/* By Coach */}
      <h2 style={s.h2}>By Coach</h2>
      <div style={s.card}>
        <TableRow header cells={["Coach", "Done", "Kids", "Avg", "Last"]} />
        {coaches.length === 0 && <div style={{ padding: 10, textAlign: "center", color: C.textDim, fontSize: 12 }}>No assessments this cycle</div>}
        {coaches.map(c => (
          <TableRow key={c.name} cells={[c.name, c.count, c.kids, fmt(c.avg), c.lastDate.slice(5)]} />
        ))}
      </div>

      {/* By Age Category */}
      <h2 style={s.h2}>By Age Category</h2>
      <div style={s.card}>
        <TableRow header cells={["Age", "Kids", "Done", "Final", "BJJ", "Ath", "Com", "Comp"]} />
        {ageCats.map(a => (
          <TableRow key={a.ac} cells={[
            a.ac, a.total, a.assessed, fmt(a.avgFinal),
            fmt(a.avgBJJ), fmt(a.avgAthletic), fmt(a.avgCommitment), fmt(a.avgCompetition),
          ]} />
        ))}
      </div>

      {/* Score Distribution */}
      <h2 style={s.h2}>Score Distribution</h2>
      <div style={s.card}>
        {buckets.map(b => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 55, fontSize: 11, color: C.textDim, textAlign: "right", flexShrink: 0 }}>{b.label}</div>
            <div style={{ flex: 1, height: 22, background: C.card2, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(b.count / maxBucket) * 100}%`, background: b.color, borderRadius: 4, transition: "width 0.3s", minWidth: b.count > 0 ? 20 : 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {b.count > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{b.count}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overdue */}
      <h2 style={s.h2}>Overdue ({overdueKids.length})</h2>
      {overdueKids.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", color: C.green }}>✓ All active kids assessed this cycle</div>
      ) : (
        Object.entries(overdueByGym).sort().map(([gym, kids]) => (
          <div key={gym} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 4 }}>{gym} ({kids.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {kids.map(k => (
                <button key={k.id} onClick={() => onViewProfile(k.id)} style={{
                  padding: "5px 10px", borderRadius: 8, fontSize: 12, background: "#f4422a11", border: "1px solid #f4422a33",
                  color: C.text, cursor: "pointer",
                }}>
                  {k.name}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      </>}
    </div>
  );
}

/* ━━━ COMPETITION TEAM VIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function CompetitionTeamView({ roster, assessments, config, selections, attendance, filterCycle, filterGym, onViewProfile }) {
  // Gather all selected kid IDs across all selection keys
  const selectedIds = new Set();
  Object.entries(selections || {}).forEach(([key, ids]) => {
    if (key.startsWith(filterCycle + "|")) ids.forEach(id => selectedIds.add(id));
  });
  // If no cycle-specific selections, fall back to all selections
  if (selectedIds.size === 0) {
    Object.values(selections || {}).forEach(arr => arr.forEach(id => selectedIds.add(id)));
  }

  const teamKids = roster.filter(k => k.active && selectedIds.has(k.id) && (!filterGym || kidInGym(k, filterGym)));

  // Get latest assessment per kid for the selected cycle
  const latestAss = {};
  assessments.filter(a => a.cycle === filterCycle).forEach(a => {
    if (!latestAss[a.kidId] || a.date > latestAss[a.kidId].date) latestAss[a.kidId] = a;
  });

  // Attendance: avg weekly (all classes) + competition class %
  const att90 = (attendance || []).filter(r => {
    const d = new Date(r.date);
    return d >= new Date(Date.now() - 90 * 86400000);
  });
  const weeks90 = Math.max(1, Math.round(90 / 7));
  const kidAttendance = (kidId) => {
    // Weekly avg = group + competition combined
    const allAttend = att90.filter(r => r.records?.[kidId] === "attend").length;
    const avgWeekly = parseFloat((allAttend / weeks90).toFixed(1));
    // Competition class attendance %
    const compDays = att90.filter(r => {
      if (r.classTypeId) { const ct = (config.classTypes || []).find(c => c.id === r.classTypeId); return ct?.category === "competition"; }
      return r.type === "competition";
    });
    const compTotal = compDays.filter(r => r.records?.[kidId] !== undefined).length;
    const compAttend = compDays.filter(r => r.records?.[kidId] === "attend").length;
    const compPct = compTotal ? Math.round(compAttend / compTotal * 100) : null;
    return { avgWeekly, compPct };
  };

  // Build enriched team data
  const teamData = teamKids.map(k => {
    const age = ageAt(k.dob, today());
    const ac = ageCat(age);
    const wc = weightCat(k.weight, ac, config.weightRules || {});
    const ass = latestAss[k.id];
    const sub = ass ? computeSubtotals(ass.scores, config) : null;
    const att = kidAttendance(k.id);
    return { kid: k, age, ac, wc, sub, att, score: sub ? sub.final : 0 };
  });

  // Group by age category, then weight class
  const grouped = {};
  teamData.forEach(d => {
    const key = `${d.ac}|${d.wc}`;
    if (!grouped[key]) grouped[key] = { ac: d.ac, wc: d.wc, kids: [] };
    grouped[key].kids.push(d);
  });
  // Sort groups by age category then weight
  const wcOrder = { Light: 0, Medium: 1, Heavy: 2 };
  const groups = Object.values(grouped).sort((a, b) => {
    const acA = parseInt(a.ac.slice(1)), acB = parseInt(b.ac.slice(1));
    if (acA !== acB) return acA - acB;
    return (wcOrder[a.wc] || 1) - (wcOrder[b.wc] || 1);
  });
  // Sort kids within each group by score descending
  groups.forEach(g => g.kids.sort((a, b) => b.score - a.score));

  const totalTeam = teamData.length;
  const avgScore = totalTeam ? teamData.reduce((s, d) => s + d.score, 0) / totalTeam : 0;
  const avgWeekly = totalTeam ? teamData.reduce((s, d) => s + d.att.avgWeekly, 0) / totalTeam : 0;
  const compPcts = teamData.filter(d => d.att.compPct !== null);
  const avgCompPct = compPcts.length ? Math.round(compPcts.reduce((s, d) => s + d.att.compPct, 0) / compPcts.length) : null;
  const assessed = teamData.filter(d => d.sub).length;

  if (totalTeam === 0) {
    return (
      <div style={{ ...s.card, textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
        <div style={{ color: C.textDim, fontSize: 14 }}>No competition team selected yet.</div>
        <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Go to Rankings → tap the circle next to kids to select them.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        {[
          { label: "Team Size", value: totalTeam, color: C.text },
          { label: "Assessed", value: `${assessed}/${totalTeam}`, color: assessed === totalTeam ? "#4CAF50" : C.red },
          { label: "Avg Score", value: avgScore ? fmt(avgScore) : "—", color: "#ff9800" },
        ].map((c, i) => (
          <div key={i} style={{ ...s.card, textAlign: "center", padding: 10 }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: c.color, fontFamily: "'Bebas Neue', sans-serif" }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Avg Weekly Training", value: avgWeekly.toFixed(1), sub: "classes/week", color: avgWeekly >= 3 ? "#4CAF50" : avgWeekly >= 2 ? "#ff9800" : C.red },
          { label: "Avg Comp Attendance", value: avgCompPct !== null ? `${avgCompPct}%` : "—", sub: avgCompPct !== null ? "of comp classes" : "", color: avgCompPct !== null ? (avgCompPct >= 80 ? "#4CAF50" : avgCompPct >= 60 ? "#ff9800" : C.red) : C.textDim },
        ].map((c, i) => (
          <div key={i} style={{ ...s.card, textAlign: "center", padding: 10 }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: c.color, fontFamily: "'Bebas Neue', sans-serif" }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 9, color: C.textDim }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Grouped by Category */}
      {groups.map(g => (
        <div key={`${g.ac}|${g.wc}`} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{g.ac}</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: `${C.red}33`, color: C.red, fontWeight: 700 }}>{g.wc}</span>
            <span style={{ fontSize: 11, color: C.textDim, marginLeft: "auto" }}>{g.kids.length} athlete{g.kids.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={s.card}>
            {/* Header */}
            <div style={{ display: "flex", padding: "6px 0", borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
              <div style={{ flex: 3, fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: "uppercase" }}>Athlete</div>
              <div style={{ flex: 1, fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>Score</div>
              <div style={{ flex: 1, fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>BJJ</div>
              <div style={{ flex: 1, fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>Comp</div>
              <div style={{ flex: 1, fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>Wkly</div>
              <div style={{ flex: 1, fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>Comp%</div>
            </div>
            {g.kids.map((d, i) => {
              const scoreColor = d.score >= 4 ? "#4CAF50" : d.score >= 3 ? "#ff9800" : d.score > 0 ? C.red : C.textDim;
              const wklyColor = d.att.avgWeekly >= 3 ? "#4CAF50" : d.att.avgWeekly >= 2 ? "#ff9800" : C.red;
              const compColor = d.att.compPct !== null ? (d.att.compPct >= 80 ? "#4CAF50" : d.att.compPct >= 60 ? "#ff9800" : C.red) : C.textDim;
              return (
                <div key={d.kid.id} onClick={() => onViewProfile(d.kid.id)} style={{
                  display: "flex", alignItems: "center", padding: "8px 0", cursor: "pointer",
                  borderBottom: i < g.kids.length - 1 ? `1px solid ${C.border}33` : "none",
                }}>
                  <div style={{ flex: 3 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{d.kid.name}</div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
                      <BeltBadge belt={d.kid.belt} />
                      <span style={{ fontSize: 10, color: C.textDim }}>{d.age}y · {d.kid.weight}kg</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 900, color: scoreColor, fontFamily: "'Bebas Neue', sans-serif" }}>
                    {d.score ? fmt(d.score) : "—"}
                  </div>
                  <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: d.sub ? "#2196f3" : C.textDim }}>
                    {d.sub ? fmt(d.sub.BJJ) : "—"}
                  </div>
                  <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: d.sub ? "#ff9800" : C.textDim }}>
                    {d.sub ? fmt(d.sub.Competition) : "—"}
                  </div>
                  <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: wklyColor }}>
                    {d.att.avgWeekly}
                  </div>
                  <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: compColor }}>
                    {d.att.compPct !== null ? `${d.att.compPct}%` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ━━━ CLASSES SETTINGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ClassesSettingsSection({ config, setConfig }) {
  const classTypes = config.classTypes || [];
  const schedule = config.weeklySchedule || [];
  const [editCT, setEditCT] = useState(null); // class type being edited
  const [editSlot, setEditSlot] = useState(null); // schedule slot being edited
  const [schedGym, setSchedGym] = useState(config.gyms[0] || "");

  // Class Type editor
  const saveCT = (ct) => {
    const existing = classTypes.findIndex(c => c.id === ct.id);
    const next = existing >= 0 ? classTypes.map((c, i) => i === existing ? ct : c) : [...classTypes, ct];
    setConfig(p => ({ ...p, classTypes: next }));
    setEditCT(null);
  };
  const removeCT = (id) => {
    if (["comp", "pt"].includes(id)) return; // built-in
    setConfig(p => ({ ...p, classTypes: (p.classTypes || []).filter(c => c.id !== id) }));
  };

  // Schedule slot editor
  const saveSlot = (slot) => {
    const existing = schedule.findIndex(s => s.id === slot.id);
    const next = existing >= 0 ? schedule.map((s, i) => i === existing ? slot : s) : [...schedule, slot];
    setConfig(p => ({ ...p, weeklySchedule: next }));
    setEditSlot(null);
  };
  const removeSlot = (id) => {
    setConfig(p => ({ ...p, weeklySchedule: (p.weeklySchedule || []).filter(s => s.id !== id) }));
  };

  const groupTypes = classTypes.filter(ct => ct.category !== "private");
  const gymSchedule = schedule.filter(s => s.gym === schedGym).sort((a, b) => a.day !== b.day ? a.day - b.day : a.time.localeCompare(b.time));
  const grouped = {};
  gymSchedule.forEach(s => { (grouped[s.day] = grouped[s.day] || []).push(s); });

  const COLORS = ["#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#E91E63", "#00BCD4", "#FF5722", "#8BC34A"];

  return (
    <div>
      <h2 style={s.h2}>Class Types</h2>
      <div style={s.card}>
        {classTypes.map(ct => (
          <div key={ct.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: ct.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text }}>{ct.name}</span>
            <span style={{ ...s.badge(ct.category === "competition" ? C.orange : ct.category === "private" ? "#9C27B0" : C.green), fontSize: 9 }}>
              {ct.category}
            </span>
            {["comp", "pt"].includes(ct.id) ? (
              <span style={{ fontSize: 9, color: C.textDim }}>🔒</span>
            ) : (
              <>
                <button style={s.btnSm} onClick={() => setEditCT({ ...ct })}>✏️</button>
                <button style={s.btnDanger} onClick={() => removeCT(ct.id)}>✕</button>
              </>
            )}
          </div>
        ))}
        <button style={{ ...s.btnSm, width: "100%", marginTop: 10, textAlign: "center" }}
          onClick={() => setEditCT({ id: uid(), name: "", category: "group", color: COLORS[classTypes.length % COLORS.length] })}>
          + Add class type
        </button>
      </div>

      {/* Edit class type modal */}
      <Modal open={!!editCT} onClose={() => setEditCT(null)} title={editCT?.name ? "Edit Class Type" : "New Class Type"}>
        {editCT && (
          <div>
            <label style={s.label}>Name</label>
            <input style={{ ...s.input, marginBottom: 10 }} value={editCT.name} onChange={e => setEditCT({ ...editCT, name: e.target.value })} placeholder="e.g. Kids Beginner" />
            <label style={s.label}>Category</label>
            <select style={{ ...s.select, marginBottom: 10 }} value={editCT.category} onChange={e => setEditCT({ ...editCT, category: e.target.value })}>
              <option value="group">Group</option>
              <option value="competition">Competition</option>
            </select>
            <label style={s.label}>Color</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setEditCT({ ...editCT, color: c })} style={{
                  width: 28, height: 28, borderRadius: 6, background: c, border: editCT.color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer"
                }} />
              ))}
            </div>
            <button style={{ ...s.btn, width: "100%" }} onClick={() => { if (editCT.name.trim()) saveCT(editCT); }}>Save</button>
          </div>
        )}
      </Modal>

      <h2 style={s.h2}>Weekly Schedule</h2>
      {config.gyms.length > 1 && (
        <div style={{ display: "flex", marginBottom: 10, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
          {config.gyms.map(g => (
            <button key={g} onClick={() => setSchedGym(g)} style={{
              flex: 1, padding: "6px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11,
              background: schedGym === g ? C.red + "18" : "transparent",
              borderBottom: schedGym === g ? `2px solid ${C.red}` : "2px solid transparent",
              color: schedGym === g ? C.red : C.textDim, transition: "all 0.15s",
            }}>{g}</button>
          ))}
        </div>
      )}

      <div style={s.card}>
        {Object.keys(grouped).length === 0 && (
          <div style={{ textAlign: "center", color: C.textDim, fontSize: 12, padding: 14 }}>No classes scheduled for {schedGym}</div>
        )}
        {Object.entries(grouped).map(([dayNum, slots]) => (
          <div key={dayNum} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {DAY_NAMES[dayNum]}
            </div>
            {slots.map(slot => {
              const ct = classTypes.find(c => c.id === slot.classTypeId);
              const endMin = parseInt(slot.time.split(":")[0]) * 60 + parseInt(slot.time.split(":")[1]) + (slot.durationMin || 60);
              const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
              return (
                <div key={slot.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{ width: 55, fontSize: 12, fontWeight: 700, color: C.text, flexShrink: 0 }}>{slot.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ct?.name || slot.classTypeId}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>{slot.durationMin} min · {slot.coach} · {slot.capacity || 20} cap · ends {endTime}</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: ct?.color || "#888", flexShrink: 0 }} />
                  <button style={s.btnSm} onClick={() => setEditSlot({ ...slot })}>✏️</button>
                  <button style={s.btnDanger} onClick={() => removeSlot(slot.id)}>✕</button>
                </div>
              );
            })}
          </div>
        ))}
        <button style={{ ...s.btnSm, width: "100%", marginTop: 8, textAlign: "center" }}
          onClick={() => setEditSlot({ id: uid(), gym: schedGym, day: 1, time: "10:00", durationMin: 60, capacity: 20, classTypeId: groupTypes[0]?.id || "", coach: coachName(config.coaches[0]) || "" })}>
          + Add class slot
        </button>
      </div>

      {/* Edit schedule slot modal */}
      <Modal open={!!editSlot} onClose={() => setEditSlot(null)} title={editSlot && schedule.find(s => s.id === editSlot.id) ? "Edit Class Slot" : "New Class Slot"}>
        {editSlot && (
          <div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Day</label>
                <select style={{ ...s.select, marginBottom: 10 }} value={editSlot.day} onChange={e => setEditSlot({ ...editSlot, day: parseInt(e.target.value) })}>
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Time</label>
                <input style={{ ...s.input, marginBottom: 10 }} type="time" value={editSlot.time} onChange={e => setEditSlot({ ...editSlot, time: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Duration (min)</label>
                <input style={{ ...s.input, marginBottom: 10 }} type="number" value={editSlot.durationMin} onChange={e => setEditSlot({ ...editSlot, durationMin: parseInt(e.target.value) || 60 })} />
              </div>
              <div>
                <label style={s.label}>Capacity</label>
                <input style={{ ...s.input, marginBottom: 10 }} type="number" value={editSlot.capacity || 20} onChange={e => setEditSlot({ ...editSlot, capacity: parseInt(e.target.value) || 20 })} />
              </div>
              <div>
                <label style={s.label}>Class type</label>
                <select style={{ ...s.select, marginBottom: 10 }} value={editSlot.classTypeId} onChange={e => setEditSlot({ ...editSlot, classTypeId: e.target.value })}>
                  {groupTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                </select>
              </div>
            </div>
            <label style={s.label}>Coach</label>
            <select style={{ ...s.select, marginBottom: 14 }} value={editSlot.coach} onChange={e => setEditSlot({ ...editSlot, coach: e.target.value })}>
              {config.coaches.map(c => <option key={coachName(c)} value={coachName(c)}>{coachName(c)} ({coachGym(c)})</option>)}
            </select>
            <button style={{ ...s.btn, width: "100%" }} onClick={() => { if (editSlot.classTypeId) saveSlot({ ...editSlot, gym: schedGym }); }}>Save</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ━━━ SETTINGS SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function SettingsScreen({ config, setConfig, roster, assessments, setRoster, setAssessments, setSelections, setAttendance, isAdmin }) {
  const [unlocked, setUnlocked] = useState(isAdmin || false);
  const [pin, setPin] = useState("");
  const [section, setSection] = useState("coaches");
  const currentPin = config.settingsPin || "pablo1981";

  const ListEditor = ({ title, items, onChange }) => {
    const [newItem, setNewItem] = useState("");
    return (
      <div>
        <h2 style={s.h2}>{title}</h2>
        <div style={s.card}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ color: C.text, fontSize: 14 }}>{item}</span>
              <button style={s.btnDanger} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <input style={{ ...s.input, flex: 1 }} placeholder={`New ${title.toLowerCase().slice(0, -1)}…`} value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newItem.trim()) { onChange([...items, newItem.trim()]); setNewItem(""); }}} />
            <button style={s.btn} onClick={() => { if (newItem.trim()) { onChange([...items, newItem.trim()]); setNewItem(""); }}}>Add</button>
          </div>
        </div>
      </div>
    );
  };

  const WeightRulesEditor = () => (
    <div>
      <h2 style={s.h2}>Weight Classification Rules</h2>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Define weight ranges (kg) for each age × weight bracket. "To" value is exclusive.</div>
      {["U8", "U10", "U12", "U14"].map(ac => (
        <div key={ac} style={s.card}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 8 }}>{ac}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {["Light", "Medium", "Heavy"].map(wc => {
              const rule = config.weightRules[ac]?.[wc] || [0, 999];
              return (
                <div key={wc}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{wc}</div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input style={{ ...s.input, width: 50, textAlign: "center", padding: "4px" }} type="number" value={rule[0]}
                      onChange={e => {
                        const v = +e.target.value;
                        setConfig(prev => ({
                          ...prev,
                          weightRules: { ...prev.weightRules, [ac]: { ...prev.weightRules[ac], [wc]: [v, rule[1]] } }
                        }));
                      }} />
                    <span style={{ color: C.textDim, fontSize: 11 }}>to</span>
                    <input style={{ ...s.input, width: 50, textAlign: "center", padding: "4px" }} type="number" value={rule[1] === 999 ? "" : rule[1]}
                      placeholder="∞"
                      onChange={e => {
                        const v = e.target.value === "" ? 999 : +e.target.value;
                        setConfig(prev => ({
                          ...prev,
                          weightRules: { ...prev.weightRules, [ac]: { ...prev.weightRules[ac], [wc]: [rule[0], v] } }
                        }));
                      }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const ScoringWeightsEditor = () => (
    <div>
      <h2 style={s.h2}>Scoring Category Weights</h2>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Must total 100%</div>
      <div style={s.card}>
        {Object.entries(config.scoringWeights).map(([cat, w]) => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 90, fontSize: 13, fontWeight: 600, color: CATEGORY_COLORS[cat] || C.text }}>{cat}</span>
            <input style={{ ...s.input, width: 70, textAlign: "center" }} type="number" step="0.05" min="0" max="1" value={w}
              onChange={e => setConfig(prev => ({ ...prev, scoringWeights: { ...prev.scoringWeights, [cat]: +e.target.value } }))} />
            <span style={{ color: C.textDim, fontSize: 12 }}>{(w * 100).toFixed(0)}%</span>
          </div>
        ))}
        <div style={{ fontSize: 12, color: Object.values(config.scoringWeights).reduce((a, b) => a + b, 0).toFixed(2) === "1.00" ? C.green : "#e74c3c", fontWeight: 600 }}>
          Total: {(Object.values(config.scoringWeights).reduce((a, b) => a + b, 0) * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );

  const [confirmReset, setConfirmReset] = useState(false);
  const resetAll = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setConfig(DEFAULT_CONFIG);
    setRoster(SEED_ROSTER);
    setAssessments(generateSeedAssessments());
    setSelections({});
    setAttendance([]);
    setConfirmReset(false);
  };
  const sections = { coaches: "Coaches", community: "Community", gyms: "Gyms", classes: "Classes", belts: "Belts", cycles: "Cycles", weights: "Weight Rules", scoring: "Scoring Weights", promotion: "Promotion", admin: "Admin", reset: "Reset" };

  if (!unlocked) return (
    <div style={{ padding: 16, maxWidth: 400, margin: "60px auto", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <h2 style={{ ...s.h2, marginBottom: 4 }}>Settings Locked</h2>
      <p style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>Enter password to access settings / 输入密码访问设置</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <input style={{ ...s.input, width: 200, textAlign: "center", fontSize: 16 }} type="password" placeholder="Password"
          value={pin} onChange={e => setPin(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && pin === currentPin) setUnlocked(true); }} autoFocus />
        <button style={s.btn} onClick={() => { if (pin === currentPin) setUnlocked(true); else { setPin(""); }}}>Unlock</button>
      </div>
      {pin.length > 0 && pin !== currentPin && pin.length >= currentPin.length && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>Wrong password</div>}
    </div>
  );

  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Settings</h1>
        <PageHelp page="settings" />
      </div>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
        {Object.entries(sections).map(([key, label]) => (
          <button key={key} onClick={() => setSection(key)} style={{
            padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap",
            background: section === key ? C.red : C.card2, color: section === key ? "#fff" : C.textDim, cursor: "pointer"
          }}>{label}</button>
        ))}
      </div>

      {section === "coaches" && (
        <div>
          <h2 style={s.h2}>Coaches</h2>
          <div style={s.card}>
            {config.coaches.map((c, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: i < config.coaches.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.text, fontSize: 14, fontWeight: 700, flex: 1 }}>{coachName(c)}</span>
                  <select style={{ ...s.select, width: "auto", minWidth: 90, padding: "4px 8px" }} value={coachGym(c)}
                    onChange={e => { const next = [...config.coaches]; next[i] = { ...next[i], name: coachName(c), gym: e.target.value }; setConfig(p => ({ ...p, coaches: next })); }}>
                    <option value="">No gym</option>
                    {config.gyms.map(g => <option key={g}>{g}</option>)}
                  </select>
                  <button style={s.btnDanger} onClick={() => setConfig(p => ({ ...p, coaches: p.coaches.filter((_, j) => j !== i) }))}>Remove</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: C.textDim, width: 50 }}>Password:</span>
                  <input style={{ ...s.input, flex: 1, fontSize: 12, padding: "4px 8px" }} type="text" value={c.pin || "bushido"}
                    onChange={e => { const next = [...config.coaches]; next[i] = { ...next[i], name: coachName(c), gym: coachGym(c), pin: e.target.value }; setConfig(p => ({ ...p, coaches: next })); }} />
                  <button onClick={() => { const next = [...config.coaches]; next[i] = { ...next[i], master: !c.master }; setConfig(p => ({ ...p, coaches: next })); }} style={{
                    padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "none",
                    background: c.master ? C.red + "22" : C.card2, color: c.master ? C.red : C.textDim,
                  }}>{c.master ? "👑 Master" : "Master"}</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input style={{ ...s.input, flex: 1 }} placeholder="New coach name…" id="newCoachInput"
                onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { setConfig(p => ({ ...p, coaches: [...p.coaches, { name: e.target.value.trim(), gym: config.gyms[0] || "", pin: "bushido" }] })); e.target.value = ""; }}} />
              <button style={s.btn} onClick={() => { const inp = document.getElementById("newCoachInput"); if (inp.value.trim()) { setConfig(p => ({ ...p, coaches: [...p.coaches, { name: inp.value.trim(), gym: config.gyms[0] || "", pin: "bushido" }] })); inp.value = ""; }}}>Add</button>
            </div>
          </div>
        </div>
      )}
      {section === "community" && (
        <div>
          <h2 style={s.h2}>Community Members 🤝</h2>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10 }}>Community members can manage the roster (kids auto-assigned to their gym) but cannot score. All other pages are read-only.</div>
          <div style={s.card}>
            {(config.communityMembers || []).map((m, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: i < (config.communityMembers || []).length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.text, fontSize: 14, fontWeight: 700, flex: 1 }}>{m.name}</span>
                  <select style={{ ...s.select, width: "auto", minWidth: 90, padding: "4px 8px" }} value={m.gym || ""}
                    onChange={e => { const next = [...(config.communityMembers || [])]; next[i] = { ...next[i], gym: e.target.value }; setConfig(p => ({ ...p, communityMembers: next })); }}>
                    <option value="">No gym</option>
                    {config.gyms.map(g => <option key={g}>{g}</option>)}
                  </select>
                  <button style={s.btnDanger} onClick={() => setConfig(p => ({ ...p, communityMembers: (p.communityMembers || []).filter((_, j) => j !== i) }))}>Remove</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: C.textDim, width: 50 }}>Password:</span>
                  <input style={{ ...s.input, flex: 1, fontSize: 12, padding: "4px 8px" }} type="text" value={m.pin || "bushido"}
                    onChange={e => { const next = [...(config.communityMembers || [])]; next[i] = { ...next[i], pin: e.target.value }; setConfig(p => ({ ...p, communityMembers: next })); }} />
                </div>
              </div>
            ))}
            {(config.communityMembers || []).length === 0 && <div style={{ color: C.textDim, fontSize: 12, padding: "8px 0" }}>No community members yet</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <input style={{ ...s.input, flex: 1, minWidth: 100 }} placeholder="New member name…" id="newCommunityInput" />
              <select style={{ ...s.select, width: "auto", minWidth: 90 }} id="newCommunityGym">
                {config.gyms.map(g => <option key={g}>{g}</option>)}
              </select>
              <button style={s.btn} onClick={() => {
                const inp = document.getElementById("newCommunityInput");
                const gymSel = document.getElementById("newCommunityGym");
                if (inp.value.trim()) {
                  setConfig(p => ({ ...p, communityMembers: [...(p.communityMembers || []), { name: inp.value.trim(), gym: gymSel.value || config.gyms[0] || "", pin: "bushido" }] }));
                  inp.value = "";
                }
              }}>Add</button>
            </div>
          </div>
        </div>
      )}
      {section === "gyms" && <ListEditor title="Gyms" items={config.gyms} onChange={v => setConfig(p => ({ ...p, gyms: v }))} />}

      {section === "classes" && <ClassesSettingsSection config={config} setConfig={setConfig} />}

      {section === "belts" && <ListEditor title="Belts" items={config.belts} onChange={v => setConfig(p => ({ ...p, belts: v }))} />}
      {section === "cycles" && <ListEditor title="Cycles" items={config.cycles} onChange={v => setConfig(p => ({ ...p, cycles: v }))} />}
      {section === "weights" && <WeightRulesEditor />}
      {section === "scoring" && <ScoringWeightsEditor />}
      {section === "promotion" && (
        <div>
          <h2 style={s.h2}>Promotion Rules</h2>
          <div style={s.card}>
            <label style={s.label}>Classes for Stripe</label>
            <input style={s.input} type="number" min={1} value={config.promotionRules?.stripeClasses || 10}
              onChange={e => setConfig(p => ({ ...p, promotionRules: { ...(p.promotionRules || {}), stripeClasses: parseInt(e.target.value) || 10 } }))} />
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Total classes (group + competition) since last promotion</div>

            <label style={s.label}>Stripes Required for Belt</label>
            <input style={s.input} type="number" min={1} max={10} value={config.promotionRules?.stripesForBelt || 4}
              onChange={e => setConfig(p => ({ ...p, promotionRules: { ...(p.promotionRules || {}), stripesForBelt: parseInt(e.target.value) || 4 } }))} />

            <label style={s.label}>Classes for Belt Promotion</label>
            <input style={s.input} type="number" min={1} value={config.promotionRules?.beltClasses || 40}
              onChange={e => setConfig(p => ({ ...p, promotionRules: { ...(p.promotionRules || {}), beltClasses: parseInt(e.target.value) || 40 } }))} />
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Total classes since last promotion (in addition to stripes)</div>

            <label style={s.label}>Months at Current Belt</label>
            <input style={s.input} type="number" min={1} value={config.promotionRules?.beltMonths || 9}
              onChange={e => setConfig(p => ({ ...p, promotionRules: { ...(p.promotionRules || {}), beltMonths: parseInt(e.target.value) || 9 } }))} />
            <div style={{ fontSize: 11, color: C.textDim }}>Minimum time at current belt before promotion</div>
          </div>
        </div>
      )}
      {section === "admin" && (
        <div>
          <h2 style={s.h2}>Admin Password 管理员密码</h2>
          <div style={s.card}>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10 }}>The admin password bypasses coach login and skips the settings lock.</div>
            <label style={s.label}>Admin Password</label>
            <input style={s.input} type="text" value={config.adminPin || "pablo1981"}
              onChange={e => setConfig(p => ({ ...p, adminPin: e.target.value }))} />
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>Login as any coach using this password to get admin access.</div>
          </div>
          <h2 style={{ ...s.h2, marginTop: 20 }}>Settings Lock Password</h2>
          <div style={s.card}>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10 }}>Required for non-admin users to access settings.</div>
            <label style={s.label}>Settings Password</label>
            <input style={s.input} type="text" value={config.settingsPin || "pablo1981"}
              onChange={e => setConfig(p => ({ ...p, settingsPin: e.target.value }))} />
          </div>
        </div>
      )}
      {section === "reset" && (
        <div>
          <h2 style={s.h2}>Data Management</h2>
          <div style={s.card}>
            <p style={{ fontWeight: 600, marginBottom: 4, color: "#e74c3c" }}>⚠ Factory Reset</p>
            <p style={{ color: C.textDim, fontSize: 13, marginBottom: 12 }}>Reset ALL data (roster, assessments, selections, settings) back to factory defaults. This wipes everything including settings.</p>
            <button style={{ ...s.btn, background: confirmReset ? "#ff0000" : "#e74c3c" }} onClick={resetAll}>{confirmReset ? "⚠ TAP AGAIN TO CONFIRM" : "⚠ Factory Reset"}</button>
          </div>
          <div style={{ ...s.card, marginTop: 10 }}>
            <p style={{ color: C.textDim, fontSize: 13, marginBottom: 4 }}>Stats</p>
            <div style={{ fontSize: 13, color: C.text }}>
              {roster.length} kids · {assessments.length} assessments · {Object.values(config.criteria).flat().length} criteria
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ━━━ LOGIN SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ━━━ PROMOTION SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PromotionScreen({ roster, setRoster, attendance, config, setConfig, loggedCoach, isCommunity, isAdmin, loggedGym, onViewProfile }) {
  const rules = config.promotionRules || { stripeClasses: 10, beltClasses: 40, beltMonths: 9, stripesForBelt: 4 };
  const promotedBy = isCommunity ? "Community" : loggedCoach || "Admin";
  const [gym, setGym] = useState(isAdmin ? "" : (loggedGym || config.gyms[0] || ""));
  const [showStripes, setShowStripes] = useState(true);
  const [showBelts, setShowBelts] = useState(true);
  const [showLog, setShowLog] = useState(false);

  const classesSince = (kidId, sinceDate) => {
    return (attendance || []).filter(r =>
      r.date > sinceDate && r.records?.[kidId] === "attend"
    ).length;
  };

  const monthsSince = (dateStr) => {
    if (!dateStr) return 999;
    const d = new Date(dateStr);
    const now = new Date();
    return (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
  };

  const eligibility = useMemo(() => {
    return roster.filter(k => k.active && (!gym || kidInGym(k, gym))).map(kid => {
      const stripes = kid.stripes || 0;
      const lastPromo = kid.lastPromotionDate || kid.joinDate || "2020-01-01";
      const classes = classesSince(kid.id, lastPromo) + (kid.classCountOffset || 0);
      const months = monthsSince(lastPromo);
      const beltIdx = config.belts.indexOf(kid.belt);
      const hasNextBelt = beltIdx < config.belts.length - 1;

      const stripeReady = stripes < (rules.stripesForBelt || 4) && classes >= (rules.stripeClasses || 10);
      const beltReady = hasNextBelt && stripes >= (rules.stripesForBelt || 4)
        && classes >= (rules.beltClasses || 40)
        && months >= (rules.beltMonths || 9);

      return { kid, stripes, classes, months, lastPromo, stripeReady, beltReady, beltIdx, hasNextBelt };
    });
  }, [roster, attendance, config, rules, gym]);

  const stripeEligible = eligibility.filter(e => e.stripeReady && !e.beltReady).sort((a, b) => b.classes - a.classes);
  const beltEligible = eligibility.filter(e => e.beltReady).sort((a, b) => b.classes - a.classes);

  const awardStripe = (kid) => {
    const newStripes = (kid.stripes || 0) + 1;
    setRoster(prev => prev.map(k => k.id === kid.id ? { ...k, stripes: newStripes, lastPromotionDate: today(), classCountOffset: 0 } : k));
    setConfig(p => ({
      ...p, promotionLog: [...(p.promotionLog || []), {
        kidId: kid.id, type: "stripe", from: kid.stripes || 0, to: newStripes,
        belt: kid.belt, date: today(), by: promotedBy
      }]
    }));
  };

  const awardBelt = (kid) => {
    const beltIdx = config.belts.indexOf(kid.belt);
    const nextBelt = config.belts[beltIdx + 1];
    if (!nextBelt) return;
    setRoster(prev => prev.map(k => k.id === kid.id ? { ...k, belt: nextBelt, stripes: 0, lastPromotionDate: today(), classCountOffset: 0 } : k));
    setConfig(p => ({
      ...p, promotionLog: [...(p.promotionLog || []), {
        kidId: kid.id, type: "belt", from: kid.belt, to: nextBelt,
        date: today(), by: promotedBy
      }]
    }));
  };

  const StripeDots = ({ count, max = 4 }) => (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: i < count ? C.red : C.border }} />
      ))}
    </div>
  );

  const renderCard = (e, actionBtn) => (
    <div key={e.kid.id} style={{ ...s.card, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onViewProfile(e.kid.id)}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{e.kid.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <BeltBadge belt={e.kid.belt} />
            <StripeDots count={e.stripes} max={rules.stripesForBelt || 4} />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{e.classes}</div>
          <div style={{ fontSize: 9, color: C.textDim }}>classes</div>
        </div>
      </div>
      {actionBtn}
    </div>
  );

  const SectionHeader = ({ icon, label, count, color, open, toggle }) => (
    <button onClick={toggle} style={{
      display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 0",
      background: "transparent", border: "none", cursor: "pointer", marginTop: 8,
    }}>
      <span style={{ fontSize: 14 }}>{open ? "▼" : "▶"}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color }}>{icon} {label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, background: color + "18", padding: "2px 8px", borderRadius: 10 }}>{count}</span>
    </button>
  );

  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Promotions</h1>
        <PageHelp page="promotion" />
      </div>
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>
        Stripe: {rules.stripeClasses} classes · Belt: {rules.stripesForBelt} stripes + {rules.beltClasses} classes + {rules.beltMonths} months
      </div>

      {/* Gym filter — toggle for admin, fixed for coach/community */}
      {isAdmin ? (
        <div style={{ display: "flex", marginBottom: 12, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <button onClick={() => setGym("")} style={{
            flex: 1, padding: "8px 6px", border: "none", cursor: "pointer",
            background: gym === "" ? C.red + "18" : "transparent",
            borderBottom: gym === "" ? `2px solid ${C.red}` : "2px solid transparent",
            color: gym === "" ? C.red : C.textDim, fontWeight: 700, fontSize: 12, transition: "all 0.15s",
          }}>All</button>
          {config.gyms.map(g => (
            <button key={g} onClick={() => setGym(g)} style={{
              flex: 1, padding: "8px 6px", border: "none", cursor: "pointer",
              background: gym === g ? C.red + "18" : "transparent",
              borderBottom: gym === g ? `2px solid ${C.red}` : "2px solid transparent",
              color: gym === g ? C.red : C.textDim, fontWeight: 700, fontSize: 12, transition: "all 0.15s",
            }}>{g}</button>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12, fontWeight: 600 }}>📍 {gym}</div>
      )}

      {beltEligible.length === 0 && stripeEligible.length === 0 && (
        <div style={{ ...s.card, textAlign: "center", color: C.textDim }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🎖</div>
          <div style={{ fontSize: 13 }}>No kids eligible for promotion at {gym}.</div>
        </div>
      )}

      {/* Belt Promotions */}
      {beltEligible.length > 0 && (
        <>
          <SectionHeader icon="🥋" label="Belt Promotions" count={beltEligible.length} color={C.orange} open={showBelts} toggle={() => setShowBelts(!showBelts)} />
          {showBelts && beltEligible.map(e => renderCard(e,
            <button style={{ ...s.btn, width: "100%", marginTop: 10, background: C.orange }} onClick={() => awardBelt(e.kid)}>
              🥋 Promote to {config.belts[e.beltIdx + 1]}
            </button>
          ))}
        </>
      )}

      {/* Stripe Promotions */}
      {stripeEligible.length > 0 && (
        <>
          <SectionHeader icon="🎖" label="Stripe Promotions" count={stripeEligible.length} color={C.green} open={showStripes} toggle={() => setShowStripes(!showStripes)} />
          {showStripes && stripeEligible.map(e => renderCard(e,
            <button style={{ ...s.btn, width: "100%", marginTop: 10, background: C.green }} onClick={() => awardStripe(e.kid)}>
              🎖 Award Stripe {e.stripes + 1}
            </button>
          ))}
        </>
      )}

      {/* Recent Promotions */}
      {(config.promotionLog || []).length > 0 && (
        <>
          <SectionHeader icon="📜" label="Recent Promotions" count={(config.promotionLog || []).length} color={C.textDim} open={showLog} toggle={() => setShowLog(!showLog)} />
          {showLog && [...(config.promotionLog || [])].reverse().slice(0, 15).map((p, i) => {
            const kid = roster.find(k => k.id === p.kidId);
            return (
              <div key={i} style={{ ...s.card, marginBottom: 6, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{kid?.name || p.kidId}</span>
                    <span style={{ fontSize: 10, color: C.textDim }}> · {p.date}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: p.type === "belt" ? C.orange : C.green }}>
                    {p.type === "belt" ? `🥋 ${p.from} → ${p.to}` : `🎖 Stripe ${p.to}`}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: C.textDim }}>by {p.by}{p.belt ? ` · ${p.belt}` : ""}</div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ━━━ ATTENDANCE SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ClassesScreen({ roster, attendance, setAttendance, config, loggedGym, isAdmin, selections }) {
  const [subTab, setSubTab] = useState("schedule");
  const [date, setDate] = useState(today());
  const [gym, setGym] = useState(loggedGym || config.gyms[0] || "");
  const [expanded, setExpanded] = useState(null); // scheduleId or "quick"
  const [quickClass, setQuickClass] = useState(null); // ad-hoc class being created
  const [search, setSearch] = useState("");
  const [searchCross, setSearchCross] = useState("");

  const classTypes = config.classTypes || [];
  const schedule = config.weeklySchedule || [];

  // Competition team kid IDs
  const selectedKidIds = useMemo(() => {
    const ids = new Set();
    Object.values(selections || {}).forEach(arr => arr.forEach(id => ids.add(id)));
    return ids;
  }, [selections]);

  const activeKids = roster.filter(k => k.active).sort((a, b) => a.name.localeCompare(b.name));
  const dayOfWeek = new Date(date + "T12:00:00").getDay();

  // Scheduled classes for this date + gym
  const todaySlots = schedule.filter(s => s.gym === gym && s.day === dayOfWeek);

  // Find ad-hoc classes (attendance records for this date+gym without a scheduleId or with ad-hoc flag)
  const todayRecords = (attendance || []).filter(r => r.date === date && r.gym === gym);
  const adhocRecords = todayRecords.filter(r => r.adhoc);

  // Build class cards: scheduled + ad-hoc
  const classCards = useMemo(() => {
    const cards = [];
    todaySlots.forEach(slot => {
      const ct = classTypes.find(c => c.id === slot.classTypeId);
      const endMin = parseInt(slot.time.split(":")[0]) * 60 + parseInt(slot.time.split(":")[1]) + (slot.durationMin || 60);
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
      const recKey = `${date}|${slot.time}|${slot.classTypeId}|${gym}`;
      const record = todayRecords.find(r => r.key === recKey);
      const markedCount = record ? Object.keys(record.records || {}).length : 0;
      const attendCount = record ? Object.values(record.records || {}).filter(v => v === "attend").length : 0;
      cards.push({ type: "scheduled", slot, ct, endTime, recKey, record, markedCount, attendCount, sortKey: slot.time });
    });
    adhocRecords.forEach(r => {
      const ct = classTypes.find(c => c.id === r.classTypeId);
      cards.push({ type: "adhoc", record: r, ct, recKey: r.key, markedCount: Object.keys(r.records || {}).length, attendCount: Object.values(r.records || {}).filter(v => v === "attend").length, sortKey: r.time || "99:99" });
    });
    return cards.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [todaySlots, todayRecords, adhocRecords, classTypes, date, gym]);

  // Get kids for a class
  const getClassKids = (card) => {
    const ct = card.ct;
    if (!ct) return { home: [], cross: [] };
    if (ct.category === "competition") {
      const compKids = activeKids.filter(k => selectedKidIds.has(k.id));
      return { home: compKids.filter(k => kidInGym(k, gym)), cross: compKids.filter(k => !kidInGym(k, gym)) };
    }
    if (ct.category === "private") {
      // PT: show all kids, marked ones first
      return { home: activeKids.filter(k => kidInGym(k, gym)), cross: activeKids.filter(k => !kidInGym(k, gym)) };
    }
    return { home: activeKids.filter(k => kidInGym(k, gym)), cross: activeKids.filter(k => !kidInGym(k, gym)) };
  };

  // Attendance helpers
  const getStatus = (recKey, kidId) => {
    const rec = (attendance || []).find(r => r.key === recKey);
    return rec?.records?.[kidId] || null;
  };

  const updateRecord = (card, newRecords) => {
    const recKey = card.recKey;
    setAttendance(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      const existing = arr.findIndex(r => r.key === recKey);
      const base = card.type === "scheduled" ? {
        key: recKey, date, time: card.slot.time, classTypeId: card.slot.classTypeId,
        scheduleId: card.slot.id, gym, coach: card.slot.coach, durationMin: card.slot.durationMin,
      } : {
        key: recKey, date, time: card.record?.time || "00:00", classTypeId: card.record?.classTypeId || card.ct?.id,
        scheduleId: null, gym, coach: card.record?.coach || "", durationMin: card.record?.durationMin || 60, adhoc: true,
      };
      const rec = { ...base, records: newRecords };
      if (existing >= 0) { const next = [...arr]; next[existing] = rec; return next; }
      return [...arr, rec];
    });
  };

  const cycleStatus = (card, kidId) => {
    const current = getStatus(card.recKey, kidId);
    const isComp = card.ct?.category === "competition";
    const order = isComp ? [null, "attend", "excused"] : [null, "attend"];
    const next = order[(order.indexOf(current) + 1) % order.length];
    const rec = (attendance || []).find(r => r.key === card.recKey);
    const records = { ...(rec?.records || {}) };
    if (next === null) delete records[kidId];
    else records[kidId] = next;
    updateRecord(card, records);
  };

  const statusConfig = {
    attend: { icon: "✅", label: "Present", color: C.green, bg: C.green + "11" },
    excused: { icon: "🟡", label: "Missed", color: C.orange, bg: C.orange + "11" },
  };

  // Quick class creation
  const startQuickClass = () => {
    const nonPrivateTypes = classTypes.filter(ct => ct.category !== "private");
    const ptType = classTypes.find(ct => ct.category === "private");
    setQuickClass({
      classTypeId: ptType?.id || nonPrivateTypes[0]?.id || "",
      time: new Date().toTimeString().slice(0, 5),
      durationMin: 60,
      coach: coachName(config.coaches.find(c => coachGym(c) === gym) || config.coaches[0]) || "",
    });
  };

  const saveQuickClass = () => {
    if (!quickClass) return;
    const recKey = `${date}|${quickClass.time}|${quickClass.classTypeId}|${gym}`;
    // Check if already exists
    if ((attendance || []).find(r => r.key === recKey)) { setQuickClass(null); setExpanded(recKey); return; }
    setAttendance(prev => [...(Array.isArray(prev) ? prev : []), {
      key: recKey, date, time: quickClass.time, classTypeId: quickClass.classTypeId,
      scheduleId: null, gym, coach: quickClass.coach, durationMin: quickClass.durationMin, adhoc: true, records: {},
    }]);
    setQuickClass(null);
    setExpanded(recKey);
  };

  const renderKid = (card, k, isLast) => {
    const st = getStatus(card.recKey, k.id);
    const cfg = st ? statusConfig[st] : null;
    return (
      <button key={k.id} onClick={() => cycleStatus(card, k.id)} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", width: "100%",
        background: cfg ? cfg.bg : "transparent",
        border: "none", borderBottom: !isLast ? `1px solid ${C.border}` : "none",
        cursor: "pointer", textAlign: "left", color: C.text, transition: "background 0.1s",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          background: cfg ? cfg.color + "22" : C.card2,
        }}>{cfg ? cfg.icon : "—"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{k.name}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>{k.belt}</div>
        </div>
        <span style={{ fontSize: 10, color: cfg ? cfg.color : C.textDim, fontWeight: 700 }}>{cfg ? cfg.label : "Absent"}</span>
      </button>
    );
  };

  // ── SCHEDULE TAB ──
  const ScheduleTab = () => {
    const gymSlots = schedule.filter(sl => sl.gym === gym).sort((a, b) => a.day !== b.day ? a.day - b.day : a.time.localeCompare(b.time));
    const grouped = {};
    gymSlots.forEach(sl => { (grouped[sl.day] = grouped[sl.day] || []).push(sl); });
    // Order: Mon(1) Tue(2) Wed(3) Thu(4) Fri(5) Sat(6) Sun(0)
    const dayOrder = [1, 2, 3, 4, 5, 6, 0];

    const goToRecord = (sl) => {
      // Find next occurrence of this day
      const now = new Date();
      const todayDow = now.getDay();
      let diff = sl.day - todayDow;
      if (diff < 0) diff += 7;
      const target = new Date(now);
      target.setDate(now.getDate() + diff);
      const targetStr = target.toISOString().slice(0, 10);
      setDate(targetStr);
      const recKey = `${targetStr}|${sl.time}|${sl.classTypeId}|${gym}`;
      setExpanded(recKey);
      setSubTab("record");
    };

    return (
      <>
        {/* Gym toggle */}
        {isAdmin && config.gyms.length > 1 && (
          <div style={{ display: "flex", marginBottom: 10, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {config.gyms.map(g => (
              <button key={g} onClick={() => setGym(g)} style={{
                flex: 1, padding: "6px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11,
                background: gym === g ? C.red + "18" : "transparent",
                borderBottom: gym === g ? `2px solid ${C.red}` : "2px solid transparent",
                color: gym === g ? C.red : C.textDim, transition: "all 0.15s",
              }}>{g}</button>
            ))}
          </div>
        )}
        {!isAdmin && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>📍 {gym}</div>}

        {gymSlots.length === 0 && (
          <div style={{ ...s.card, textAlign: "center", padding: 24, color: C.textDim }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 13 }}>No weekly schedule configured for {gym}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Set up classes in Settings → Classes</div>
          </div>
        )}

        {dayOrder.map(dayNum => {
          const slots = grouped[dayNum];
          if (!slots) return null;
          return (
            <div key={dayNum} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.red, textTransform: "uppercase", letterSpacing: 1, padding: "10px 0 6px" }}>
                {DAY_NAMES[dayNum]}
              </div>
              {slots.map(sl => {
                const ct = classTypes.find(c => c.id === sl.classTypeId);
                const catColor = ct?.color || "#888";
                const endMin = parseInt(sl.time.split(":")[0]) * 60 + parseInt(sl.time.split(":")[1]) + (sl.durationMin || 60);
                const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
                return (
                  <div key={sl.id} onClick={() => goToRecord(sl)} style={{
                    ...s.card, borderLeft: `3px solid ${catColor}`, cursor: "pointer", padding: "10px 12px",
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 2,
                  }}>
                    <div style={{ width: 50, flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{sl.time}</div>
                      <div style={{ fontSize: 9, color: C.textDim }}>{endTime}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ct?.name || sl.classTypeId}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>{sl.coach} · {sl.durationMin} min · {sl.capacity || 20} spots</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>▶</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </>
    );
  };

  // ── RECORD TAB ──
  const RecordTab = () => (
    <>
      {/* Gym toggle */}
      {isAdmin && config.gyms.length > 1 && (
        <div style={{ display: "flex", marginBottom: 10, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
          {config.gyms.map(g => (
            <button key={g} onClick={() => { setGym(g); setExpanded(null); setSearch(""); }} style={{
              flex: 1, padding: "6px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11,
              background: gym === g ? C.red + "18" : "transparent",
              borderBottom: gym === g ? `2px solid ${C.red}` : "2px solid transparent",
              color: gym === g ? C.red : C.textDim, transition: "all 0.15s",
            }}>{g}</button>
          ))}
        </div>
      )}
      {!isAdmin && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>📍 {gym}</div>}

      {/* Date picker */}
      <div style={s.card}>
        <div style={s.grid2}>
          <div>
            <label style={s.label}>Date</label>
            <input style={s.input} type="date" value={date} onChange={e => { setDate(e.target.value); setExpanded(null); }} />
          </div>
          <div>
            <label style={s.label}>Day</label>
            <div style={{ padding: "8px 0", fontSize: 14, fontWeight: 700, color: C.text }}>{DAY_NAMES[dayOfWeek]}</div>
          </div>
        </div>
      </div>

      {/* Scheduled classes */}
      {classCards.length === 0 && !quickClass && (
        <div style={{ ...s.card, textAlign: "center", padding: 24, color: C.textDim }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
          <div style={{ fontSize: 13 }}>No classes scheduled for {DAY_NAMES[dayOfWeek]} at {gym}</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Add classes in Settings → Classes, or use Quick Class below</div>
        </div>
      )}

      {classCards.map(card => {
        const isExpanded = expanded === card.recKey;
        const ct = card.ct;
        const catColor = ct?.color || "#888";
        const { home, cross } = getClassKids(card);
        const totalKids = home.length + cross.length;
        const capacity = card.type === "scheduled" ? (card.slot.capacity || 20) : 20;
        const isMarked = card.markedCount > 0;
        const filteredHome = search ? home.filter(k => k.name.toLowerCase().includes(search.toLowerCase())) : home;
        const filteredCross = searchCross ? cross.filter(k => k.name.toLowerCase().includes(searchCross.toLowerCase())) : cross;

        return (
          <div key={card.recKey}>
            <div style={{ ...s.card, borderLeft: `3px solid ${catColor}`, cursor: "pointer" }} onClick={() => { setExpanded(isExpanded ? null : card.recKey); setSearch(""); setSearchCross(""); }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ ...s.badge(catColor), fontSize: 9 }}>{ct?.category || "group"}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ct?.name || "Class"}</span>
                <span style={{ fontSize: 11, color: C.textDim, marginLeft: "auto" }}>
                  {card.type === "scheduled" ? `${card.slot.time} – ${card.endTime}` : card.record?.time || ""}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.textDim }}>
                {card.type === "scheduled" ? `Coach: ${card.slot.coach}` : card.record?.coach ? `Coach: ${card.record.coach}` : ""}
                {isMarked ? (
                  <b style={{ color: card.attendCount > capacity ? "#e74c3c" : card.attendCount === capacity ? C.orange : C.green, marginLeft: 6 }}>{card.attendCount}/{capacity}</b>
                ) : (
                  <span style={{ color: C.orange, marginLeft: 6 }}>0/{capacity} ⏳</span>
                )}
                {card.type === "adhoc" && <span style={{ marginLeft: 6, color: "#9C27B0" }}>· ad-hoc</span>}
              </div>
              {!isExpanded && (
                <div style={{ fontSize: 10, color: C.red, marginTop: 6, fontWeight: 600 }}>{isExpanded ? "▲ Collapse" : "▼ Tap to mark attendance"}</div>
              )}
            </div>

            {isExpanded && (
              <div style={{ ...s.card, marginTop: -2, borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0, borderLeft: `3px solid ${catColor}` }}>
                <div style={{ display: "flex", gap: 12, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
                  <span style={{ color: C.green }}>✅ {card.attendCount}</span>
                  {ct?.category === "competition" && <span style={{ color: C.orange }}>🟡 {Object.values((attendance || []).find(r => r.key === card.recKey)?.records || {}).filter(v => v === "excused").length}</span>}
                  <span style={{ color: C.textDim }}>— {totalKids - card.markedCount} unmarked</span>
                </div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, textAlign: "center" }}>
                  {ct?.category === "competition" ? "Tap to cycle: — → ✅ Present → 🟡 Missed" : "Tap to toggle: — Absent ↔ ✅ Present"}
                </div>

                {/* Home gym kids */}
                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>{gym} ({home.length})</div>
                <input style={{ ...s.input, marginBottom: 6, fontSize: 12 }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", maxHeight: 350, overflowY: "auto" }}>
                  {filteredHome.map((k, i) => renderKid(card, k, i === filteredHome.length - 1))}
                  {filteredHome.length === 0 && <div style={{ padding: 12, color: C.textDim, fontSize: 11, textAlign: "center" }}>No match</div>}
                </div>

                {/* Cross-training */}
                {cross.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, marginTop: 12, marginBottom: 4, textTransform: "uppercase" }}>Cross-training ({cross.length})</div>
                    <input style={{ ...s.input, marginBottom: 6, fontSize: 12 }} placeholder="Search cross…" value={searchCross} onChange={e => setSearchCross(e.target.value)} />
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", maxHeight: 250, overflowY: "auto" }}>
                      {filteredCross.map((k, i) => renderKid(card, k, i === filteredCross.length - 1))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Quick Class button / form */}
      {!quickClass ? (
        <button onClick={startQuickClass} style={{
          ...s.btnSm, width: "100%", padding: 12, fontSize: 12, marginTop: 8,
          borderStyle: "dashed", textAlign: "center", color: C.textDim,
        }}>+ Quick Class (PT / one-off)</button>
      ) : (
        <div style={{ ...s.card, marginTop: 8, borderLeft: `3px solid #9C27B0` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Quick Class</div>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Class type</label>
              <select style={{ ...s.select, marginBottom: 8 }} value={quickClass.classTypeId} onChange={e => setQuickClass({ ...quickClass, classTypeId: e.target.value })}>
                {classTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Time</label>
              <input style={{ ...s.input, marginBottom: 8 }} type="time" value={quickClass.time} onChange={e => setQuickClass({ ...quickClass, time: e.target.value })} />
            </div>
            <div>
              <label style={s.label}>Duration (min)</label>
              <input style={{ ...s.input, marginBottom: 8 }} type="number" value={quickClass.durationMin} onChange={e => setQuickClass({ ...quickClass, durationMin: parseInt(e.target.value) || 60 })} />
            </div>
            <div>
              <label style={s.label}>Coach</label>
              <select style={{ ...s.select, marginBottom: 8 }} value={quickClass.coach} onChange={e => setQuickClass({ ...quickClass, coach: e.target.value })}>
                {config.coaches.map(c => <option key={coachName(c)} value={coachName(c)}>{coachName(c)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...s.btn, flex: 1 }} onClick={saveQuickClass}>Create & Mark</button>
            <button style={{ ...s.btnSm, flex: 0 }} onClick={() => setQuickClass(null)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );

  // ── HISTORY TAB ──
  const [histFrom, setHistFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [histTo, setHistTo] = useState(today());
  const [histType, setHistType] = useState(""); // "" = all
  const [histExpanded, setHistExpanded] = useState(null); // recKey

  const HistoryTab = () => {
    const records = useMemo(() => {
      return (attendance || [])
        .filter(r => r.gym === gym && r.date >= histFrom && r.date <= histTo)
        .filter(r => !histType || r.classTypeId === histType || (!r.classTypeId && ((histType === "group1" && r.type === "group") || (histType === "comp" && r.type === "competition"))))
        .sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : (b.time || "").localeCompare(a.time || ""));
    }, [attendance, gym, histFrom, histTo, histType]);

    // Group by month
    let lastMonth = "";

    return (
      <>
        {/* Gym toggle */}
        {isAdmin && config.gyms.length > 1 && (
          <div style={{ display: "flex", marginBottom: 10, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {config.gyms.map(g => (
              <button key={g} onClick={() => { setGym(g); setHistExpanded(null); }} style={{
                flex: 1, padding: "6px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11,
                background: gym === g ? C.red + "18" : "transparent",
                borderBottom: gym === g ? `2px solid ${C.red}` : "2px solid transparent",
                color: gym === g ? C.red : C.textDim, transition: "all 0.15s",
              }}>{g}</button>
            ))}
          </div>
        )}
        {!isAdmin && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>📍 {gym}</div>}

        {/* Filters */}
        <div style={s.card}>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>From</label>
              <input style={s.input} type="date" value={histFrom} onChange={e => setHistFrom(e.target.value)} />
            </div>
            <div>
              <label style={s.label}>To</label>
              <input style={s.input} type="date" value={histTo} onChange={e => setHistTo(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <button onClick={() => setHistType("")} style={{
              padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
              background: !histType ? C.red : C.card2, color: !histType ? "#fff" : C.textDim,
            }}>All types</button>
            {classTypes.filter(ct => ct.category !== "private").map(ct => (
              <button key={ct.id} onClick={() => setHistType(ct.id)} style={{
                padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
                background: histType === ct.id ? ct.color + "33" : C.card2, color: histType === ct.id ? ct.color : C.textDim,
              }}>● {ct.name.length > 10 ? ct.name.slice(0, 10) : ct.name}</button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {records.length} session{records.length !== 1 ? "s" : ""} found
        </div>

        {records.length === 0 && (
          <div style={{ ...s.card, textAlign: "center", padding: 24, color: C.textDim }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📖</div>
            <div style={{ fontSize: 13 }}>No class records for this period</div>
          </div>
        )}

        {/* Session list */}
        {records.map(r => {
          const ct = classTypes.find(c => c.id === r.classTypeId);
          const catColor = ct?.color || (r.type === "competition" ? "#FF9800" : "#4CAF50");
          const typeName = ct?.name || (r.type === "competition" ? "Competition" : "Group");
          const recs = r.records || {};
          const attendCount = Object.values(recs).filter(v => v === "attend").length;
          const totalCount = Object.keys(recs).length;
          const missedCount = Object.values(recs).filter(v => v === "excused").length;
          const isExp = histExpanded === r.key;
          const d = new Date(r.date + "T12:00:00");

          // Month separator
          const month = r.date.slice(0, 7);
          const showMonth = month !== lastMonth;
          lastMonth = month;

          return (
            <React.Fragment key={r.key}>
              {showMonth && (
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, padding: "8px 0 4px" }}>
                  {d.toLocaleDateString("en", { month: "long", year: "numeric" })}
                </div>
              )}
              <div style={{ ...s.card, borderLeft: `3px solid ${catColor}`, cursor: "pointer", padding: 10 }}
                onClick={() => setHistExpanded(isExp ? null : r.key)}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: catColor }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{typeName}</span>
                  <span style={{ fontSize: 11, color: C.textDim, marginLeft: "auto" }}>
                    {DAY_SHORT[d.getDay()]} {d.toLocaleDateString("en", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 3, paddingLeft: 14 }}>
                  {r.time || ""}{r.time ? " · " : ""}{r.coach || ""}{r.coach ? " · " : ""}
                  <b style={{ color: attendCount > 0 ? C.green : C.textDim }}>{attendCount}/{totalCount > 0 ? totalCount : "?"}</b> present
                  {missedCount > 0 && <span style={{ color: C.orange }}> · {missedCount} missed</span>}
                  {r.adhoc && <span style={{ color: "#9C27B0" }}> · ad-hoc</span>}
                </div>

                {/* Expanded: full roster */}
                {isExp && totalCount > 0 && (
                  <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                    {Object.entries(recs).sort((a, b) => {
                      const ka = roster.find(k => k.id === a[0]);
                      const kb = roster.find(k => k.id === b[0]);
                      return (ka?.name || "").localeCompare(kb?.name || "");
                    }).map(([kidId, status]) => {
                      const kid = roster.find(k => k.id === kidId);
                      if (!kid) return null;
                      const icon = status === "attend" ? "✅" : status === "excused" ? "🟡" : "—";
                      const label = status === "attend" ? "Present" : status === "excused" ? "Missed" : "Absent";
                      const color = status === "attend" ? C.green : status === "excused" ? C.orange : C.textDim;
                      return (
                        <div key={kidId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${C.border}22` }}>
                          <span style={{ fontSize: 12 }}>{icon}</span>
                          <span style={{ flex: 1, fontSize: 12, color: C.text }}>{kid.name}</span>
                          <span style={{ fontSize: 10, color, fontWeight: 600 }}>{label}</span>
                        </div>
                      );
                    })}
                    <button onClick={(e) => { e.stopPropagation(); setDate(r.date); setExpanded(r.key); setSubTab("record"); }} style={{
                      ...s.btnSm, width: "100%", marginTop: 8, textAlign: "center", color: C.red, borderColor: C.red,
                    }}>Edit in Record tab</button>
                  </div>
                )}
                {isExp && totalCount === 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: C.textDim, textAlign: "center" }}>No attendance recorded</div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </>
    );
  };

  // ── ANALYTICS TAB ──
  const [analyticsPeriod, setAnalyticsPeriod] = useState("90");
  const [analyticsType, setAnalyticsType] = useState("");

  const AnalyticsTab = () => {
    const periodDays = parseInt(analyticsPeriod);
    const cutoff = useMemo(() => {
      const d = new Date(); d.setDate(d.getDate() - periodDays);
      return d.toISOString().slice(0, 10);
    }, [periodDays]);

    const filtered = useMemo(() => {
      return (attendance || []).filter(r =>
        (!gym || r.gym === gym) && r.date >= cutoff &&
        (!analyticsType || r.classTypeId === analyticsType || (!r.classTypeId && ((analyticsType === "group1" && r.type === "group") || (analyticsType === "comp" && r.type === "competition"))))
      );
    }, [attendance, gym, cutoff, analyticsType]);

    // Summary stats
    const totalClasses = filtered.length;
    const totalAttendances = filtered.reduce((sum, r) => sum + Object.values(r.records || {}).filter(v => v === "attend").length, 0);
    const avgAttendance = totalClasses ? (totalAttendances / totalClasses).toFixed(1) : "0";
    const weeks = Math.max(1, Math.round(periodDays / 7));
    // Avg classes per kid per week
    const kidClassCounts = {};
    filtered.forEach(r => {
      Object.entries(r.records || {}).forEach(([kidId, status]) => {
        if (status === "attend") kidClassCounts[kidId] = (kidClassCounts[kidId] || 0) + 1;
      });
    });
    const activeKidCount = Object.keys(kidClassCounts).length;
    const avgPerKidPerWeek = activeKidCount ? (Object.values(kidClassCounts).reduce((s, v) => s + v, 0) / activeKidCount / weeks).toFixed(1) : "0";

    // Avg participants by class type
    const byType = {};
    filtered.forEach(r => {
      const ctId = r.classTypeId || (r.type === "competition" ? "comp" : "group1");
      if (!byType[ctId]) byType[ctId] = { total: 0, count: 0 };
      byType[ctId].count++;
      byType[ctId].total += Object.values(r.records || {}).filter(v => v === "attend").length;
    });
    const typeStats = Object.entries(byType).map(([ctId, data]) => {
      const ct = classTypes.find(c => c.id === ctId);
      return { id: ctId, name: ct?.name || ctId, color: ct?.color || "#888", avg: (data.total / data.count).toFixed(1), count: data.count };
    }).sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg));
    const maxAvg = Math.max(...typeStats.map(t => parseFloat(t.avg)), 1);

    // Busiest days
    const dayCount = [0, 0, 0, 0, 0, 0, 0];
    const dayAttend = [0, 0, 0, 0, 0, 0, 0];
    filtered.forEach(r => {
      const dow = new Date(r.date + "T12:00:00").getDay();
      dayCount[dow]++;
      dayAttend[dow] += Object.values(r.records || {}).filter(v => v === "attend").length;
    });
    const maxDayCount = Math.max(...dayCount, 1);

    // Weekly attendance trend (last N weeks)
    const weeklyTrend = useMemo(() => {
      const trend = [];
      const now = new Date();
      for (let w = 0; w < Math.min(weeks, 12); w++) {
        const wEnd = new Date(now); wEnd.setDate(now.getDate() - w * 7);
        const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 7);
        const startStr = wStart.toISOString().slice(0, 10);
        const endStr = wEnd.toISOString().slice(0, 10);
        const weekRecs = filtered.filter(r => r.date > startStr && r.date <= endStr);
        const att = weekRecs.reduce((s, r) => s + Object.values(r.records || {}).filter(v => v === "attend").length, 0);
        const classes = weekRecs.length;
        trend.unshift({ week: `W${Math.min(weeks, 12) - w}`, avg: classes ? parseFloat((att / classes).toFixed(1)) : 0, classes });
      }
      return trend;
    }, [filtered, weeks]);
    const maxTrend = Math.max(...weeklyTrend.map(w => w.avg), 1);

    // Least active kids (bottom 10)
    const kidWeeklyAvg = Object.entries(kidClassCounts).map(([kidId, count]) => {
      const kid = roster.find(k => k.id === kidId);
      return { kidId, name: kid?.name || kidId, belt: kid?.belt || "", avg: parseFloat((count / weeks).toFixed(1)), total: count };
    }).sort((a, b) => a.avg - b.avg).slice(0, 10);

    return (
      <>
        {/* Gym toggle */}
        {isAdmin && config.gyms.length > 1 && (
          <div style={{ display: "flex", marginBottom: 10, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {["All", ...config.gyms].map(g => (
              <button key={g} onClick={() => setGym(g === "All" ? "" : g)} style={{
                flex: 1, padding: "6px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11,
                background: (g === "All" ? !gym : gym === g) ? C.red + "18" : "transparent",
                borderBottom: (g === "All" ? !gym : gym === g) ? `2px solid ${C.red}` : "2px solid transparent",
                color: (g === "All" ? !gym : gym === g) ? C.red : C.textDim, transition: "all 0.15s",
              }}>{g}</button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={s.card}>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Period</label>
              <select style={s.select} value={analyticsPeriod} onChange={e => setAnalyticsPeriod(e.target.value)}>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 6 months</option>
                <option value="365">Last year</option>
              </select>
            </div>
            <div>
              <label style={s.label}>Class type</label>
              <select style={s.select} value={analyticsType} onChange={e => setAnalyticsType(e.target.value)}>
                <option value="">All types</option>
                {classTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div style={{ ...s.card, textAlign: "center", padding: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{totalClasses}</div>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase" }}>Classes held</div>
          </div>
          <div style={{ ...s.card, textAlign: "center", padding: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{avgAttendance}</div>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase" }}>Avg participants</div>
          </div>
          <div style={{ ...s.card, textAlign: "center", padding: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{avgPerKidPerWeek}</div>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase" }}>Avg / kid / wk</div>
          </div>
        </div>

        {/* Weekly trend */}
        {weeklyTrend.length > 1 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px" }}>Avg Participants / Week</div>
            <div style={s.card}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
                {weeklyTrend.map((w, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: 8, color: C.textDim, marginBottom: 2 }}>{w.avg || ""}</div>
                    <div style={{
                      width: "100%", borderRadius: 3, background: w.classes > 0 ? C.green : C.card2,
                      height: `${Math.max(2, (w.avg / maxTrend) * 60)}px`, transition: "height 0.3s",
                    }} />
                    <div style={{ fontSize: 7, color: C.textDim, marginTop: 2 }}>{w.week}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Avg participants by class */}
        {typeStats.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px" }}>Avg Participants by Class</div>
            <div style={s.card}>
              {typeStats.map(t => (
                <div key={t.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>{t.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.avg} kids</span>
                    <span style={{ fontSize: 9, color: C.textDim }}>({t.count} classes)</span>
                  </div>
                  <div style={{ height: 6, background: C.card2, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(parseFloat(t.avg) / maxAvg) * 100}%`, background: t.color, borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Busiest days */}
        {totalClasses > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px" }}>Classes by Day</div>
            <div style={s.card}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
                {DAY_SHORT.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>{dayCount[i] || ""}</div>
                    <div style={{
                      width: "100%", borderRadius: 3,
                      background: dayCount[i] > 0 ? C.blue : C.card2,
                      height: `${Math.max(2, (dayCount[i] / maxDayCount) * 50)}px`,
                      transition: "height 0.3s",
                    }} />
                    <div style={{ fontSize: 9, color: dayCount[i] > 0 ? C.text : C.textDim, marginTop: 3, fontWeight: 600 }}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Least active kids */}
        {kidWeeklyAvg.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px" }}>Least Active Kids</div>
            <div style={s.card}>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8 }}>Bottom 10 by avg classes/week — dropoff risk</div>
              {kidWeeklyAvg.map(k => {
                const color = k.avg < 1 ? "#e74c3c" : k.avg < 2 ? C.orange : C.green;
                return (
                  <div key={k.kidId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.border}22` }}>
                    <span style={{ fontSize: 12, flex: 1, color: C.text }}>{k.name}</span>
                    <span style={{ ...s.badge(color), fontSize: 10 }}>{k.avg}x/wk</span>
                    <span style={{ fontSize: 9, color: C.textDim }}>{k.total} classes</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {totalClasses === 0 && (
          <div style={{ ...s.card, textAlign: "center", padding: 24, color: C.textDim }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 13 }}>No data for this period</div>
          </div>
        )}
      </>
    );
  };

  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Classes</h1>
        <PageHelp page="attendance" />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", marginBottom: 12, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {[{ key: "schedule", label: "📅 Schedule" }, { key: "record", label: "📋 Record" }, { key: "history", label: "📖 History" }, { key: "analytics", label: "📊 Analytics" }].map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{
            flex: 1, padding: "8px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
            background: subTab === t.key ? C.red + "18" : "transparent",
            borderBottom: subTab === t.key ? `2px solid ${C.red}` : "2px solid transparent",
            color: subTab === t.key ? C.red : C.textDim, transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {subTab === "schedule" && <ScheduleTab />}
      {subTab === "record" && <RecordTab />}
      {subTab === "history" && <HistoryTab />}
      {subTab === "analytics" && <AnalyticsTab />}
    </div>
  );
}

function LoginScreen({ config, onLogin }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // {name, type, gym}
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);

  // Build unified user list
  const allUsers = useMemo(() => {
    const users = [];
    config.coaches.forEach(c => users.push({ name: coachName(c), type: "coach", gym: c.master ? "All Gyms" : coachGym(c), icon: c.master ? "👑" : "🥋", color: C.red }));
    (config.communityMembers || []).forEach(m => users.push({ name: m.name, type: "community", gym: m.gym || "No gym", icon: "🤝", color: "#64B5F6" }));
    return users;
  }, [config]);

  const filtered = search.trim()
    ? allUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : allUsers;

  const handleLogin = () => {
    const adminPin = config.adminPin || "pablo1981";
    // Admin login
    if (showAdmin) {
      if (pw === adminPin) { onLogin("Admin", "admin"); return; }
      setError("Wrong admin password"); setPw(""); return;
    }
    if (!selected) { setError("Select a user"); return; }
    // Admin bypass: any coach + admin password
    if (selected.type === "coach" && pw === adminPin) { onLogin(selected.name, "admin"); return; }
    // Coach login
    if (selected.type === "coach") {
      const coachObj = config.coaches.find(c => coachName(c) === selected.name);
      if (!coachObj) { setError("Coach not found"); return; }
      if (pw !== (coachObj.pin || "bushido")) { setError("Wrong password"); setPw(""); return; }
      onLogin(selected.name, coachObj.master ? "master" : "coach"); return;
    }
    // Community login
    if (selected.type === "community") {
      const cm = (config.communityMembers || []).find(m => m.name === selected.name);
      if (!cm) { setError("Member not found"); return; }
      if (pw !== (cm.pin || "bushido")) { setError("Wrong password"); setPw(""); return; }
      onLogin(selected.name, "community"); return;
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 340, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🥋</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, fontWeight: 800, color: C.red, letterSpacing: 3 }}>BUSHIDO</div>
          <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>BJJ Academy Management</div>
        </div>

        {!showAdmin && !selected && (
          <>
            <input style={{ ...s.input, width: "100%", boxSizing: "border-box", fontSize: 15, padding: "12px 14px", marginBottom: 8 }}
              type="text" placeholder="🔍 Your name…" value={search}
              onChange={e => { setSearch(e.target.value); setError(""); }} autoFocus />
            <div style={{ maxHeight: 280, overflowY: "auto", borderRadius: 10, border: `1px solid ${C.border}` }}>
              {filtered.length === 0 && (
                <div style={{ padding: 16, textAlign: "center", color: C.textDim, fontSize: 13 }}>No users matching "{search}"</div>
              )}
              {filtered.map(u => (
                <button key={`${u.type}:${u.name}`} onClick={() => { setSelected(u); setError(""); }} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", width: "100%",
                  background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`,
                  cursor: "pointer", textAlign: "left", color: C.text, transition: "background 0.1s",
                }}>
                  <div style={{ width: 34, height: 34, borderRadius: 17, background: u.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{u.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{u.gym} · {u.type === "coach" ? "Coach" : "Community"}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {(selected || showAdmin) && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 20px", background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>{showAdmin ? "👑" : selected.icon}</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{showAdmin ? "Admin" : selected.name}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{showAdmin ? "All gyms · Full access" : `${selected.gym} · ${selected.type === "coach" ? "Coach" : "Community"}`}</div>
              </div>
            </div>
            <button onClick={() => { setSelected(null); setShowAdmin(false); setPw(""); setError(""); setSearch(""); }} style={{
              background: "transparent", border: "none", color: C.textDim, fontSize: 11, cursor: "pointer", display: "block", margin: "0 auto", textDecoration: "underline",
            }}>← Change user</button>
          </div>
        )}

        {(selected || showAdmin) && (
          <div style={{ marginBottom: 16 }}>
            <input style={{ ...s.input, width: "100%", boxSizing: "border-box", fontSize: 16, padding: "12px 14px" }}
              type="password" placeholder="Password 密码" value={pw}
              onChange={e => { setPw(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
              autoFocus />
          </div>
        )}

        {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}

        {(selected || showAdmin) && (
          <button onClick={handleLogin} style={{
            ...s.btn, width: "100%", padding: "14px 0", fontSize: 16, fontWeight: 800,
          }}>Log In 登录</button>
        )}

        {!showAdmin && !selected && (
          <button onClick={() => { setShowAdmin(true); setSearch(""); setError(""); }} style={{
            background: "transparent", border: `1px solid ${C.border}33`, color: C.textDim, fontSize: 12,
            padding: "10px 0", width: "100%", borderRadius: 10, cursor: "pointer", marginTop: 12,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>👑 Admin Login</button>
        )}
      </div>
    </div>
  );
}


/* ━━━ USER GUIDE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function UserGuide({ onClose }) {
  const [activeSection, setActiveSection] = useState(0);
  const sections = [
    { icon: "🥋", title: "Overview", titleZh: "概述",
      steps: [
        { en: "Bushido is a BJJ academy management app for coaches to assess kids, track progress, and build competition teams.", zh: "Bushido是一款柔术学院管理应用，教练可以评估学员、追踪进度并组建比赛团队。" },
        { en: "All data syncs across devices automatically via cloud storage. Multiple coaches can use the app simultaneously.", zh: "所有数据通过云端自动同步。多位教练可同时使用该应用。" },
        { en: "Each coach is assigned to a gym. When scoring, coaches only see kids from their gym.", zh: "每位教练分配到一个道馆。评分时，教练只能看到自己道馆的学员。" },
        { en: "Kids can belong to multiple gyms if they train at different locations.", zh: "如果学员在不同地点训练，可以同时属于多个道馆。" },
      ],
      visual: { type: "flow", items: ["Roster → Attend → Promo → Score → Rank → Reports"] },
    },
    { icon: "👥", title: "Roster", titleZh: "学员名册",
      steps: [
        { en: "View all kids in the academy. Use the search bar to find kids by name.", zh: "查看学院所有学员。使用搜索栏按姓名查找。" },
        { en: "Tap '+ Add Kid' to add a new kid manually. Fill in name, DOB, belt, weight, and select one or more gyms.", zh: "点击「+ Add Kid」手动添加学员。填写姓名、出生日期、腰带、体重，并选择一个或多个道馆。" },
        { en: "Tap 'Import' to bulk import from a spreadsheet. Paste rows: Name, DOB, Belt, Weight, Gym, Stripes, ClassOffset (tab or comma separated). Stripes and ClassOffset are optional (default 0).", zh: "点击「Import」从表格批量导入。粘贴行数据：姓名、出生日期、腰带、体重、道馆、条纹数、课程偏移量（制表符或逗号分隔）。条纹和课程偏移可选（默认0）。" },
        { en: "Each kid card shows: last assessment date, score trend (↑↓→), and a red OVERDUE badge if not assessed this cycle.", zh: "每张学员卡显示：上次评估日期、成绩趋势（↑↓→），以及未评估时显示红色OVERDUE标签。" },
        { en: "Use ⏸ to deactivate a kid, ▶ to reactivate, 🗑 to delete. Use the overdue filter to find kids needing assessment.", zh: "使用⏸暂停学员，▶重新激活，🗑删除。使用overdue筛选查找需要评估的学员。" },
      ],
      visual: { type: "card", label: "Kid Card", items: ["Avatar + Name", "Age · Weight · Gym", "Last: 2026-02-15  ↑  OVERDUE", "Edit | ⏸ | 🗑"] },
    },
    { icon: "📝", title: "Score", titleZh: "评分",
      steps: [
        { en: "Step 1: Select date, cycle, and coach. The kid list is filtered to your gym.", zh: "第1步：选择日期、周期和教练。学员列表按您的道馆筛选。" },
        { en: "Kids not yet assessed this cycle appear first. Already-assessed kids are shown dimmed below.", zh: "本周期未评估的学员优先显示。已评估的学员在下方灰色显示。" },
        { en: "Use 'Score multiple kids' to build a queue — tap kids in order, then start.", zh: "使用「Score multiple kids」建立队列——按顺序点击学员，然后开始。" },
        { en: "Step 2: Score 12 criteria (1-5). Tap ? next to each for scoring guidelines.", zh: "第2步：对12项标准打分（1-5）。点击?查看评分指南。" },
        { en: "Categories: BJJ 40%, Athletic 20%, Commitment 20%, Competition 20%.", zh: "类别：柔术40%、体能20%、投入度20%、比赛20%。" },
        { en: "Step 3: Review radar chart and scores, then submit. Queue mode auto-advances to the next kid.", zh: "第3步：查看雷达图和分数，然后提交。队列模式自动切换到下一位学员。" },
      ],
      visual: { type: "scores", items: [
        { label: "BJJ", pct: "40%", color: "#C41E3A" },
        { label: "Athletic", pct: "20%", color: "#2196f3" },
        { label: "Commitment", pct: "20%", color: "#4CAF50" },
        { label: "Competition", pct: "20%", color: "#ff9800" },
      ]},
    },
    { icon: "🏆", title: "Rankings", titleZh: "排名",
      steps: [
        { en: "View kids ranked by final score within each age + weight bracket.", zh: "查看每个年龄+体重组别内按最终成绩排名的学员。" },
        { en: "Filter by cycle, age (U8-U14), weight (Light/Medium/Heavy), and gym.", zh: "按周期、年龄（U8-U14）、体重（轻/中/重量）和道馆筛选。" },
        { en: "Tap 'Select' to mark kids for competition. Selected kids show green badge.", zh: "点击「Select」选择参赛学员。已选学员显示绿色标签。" },
        { en: "Tap 'Export Rankings (CSV)' to download the table for Excel.", zh: "点击「Export Rankings」下载排名表格到Excel。" },
      ],
      visual: { type: "ranking", items: [
        { rank: 1, name: "Leo M.", score: "4.59", selected: true },
        { rank: 2, name: "Mia C.", score: "4.12", selected: false },
        { rank: 3, name: "Noah W.", score: "3.85", selected: true },
      ]},
    },
    { icon: "📊", title: "Reports", titleZh: "报告",
      steps: [
        { en: "Dashboard overview scoped to the selected cycle.", zh: "仪表盘概览以所选周期为范围。" },
        { en: "Overview cards: active kids, assessed count/%, average score, total assessments.", zh: "概览卡：活跃学员、已评估人数/%、平均分、总评估数。" },
        { en: "By Gym: assessment coverage per gym. Red = low (<50%), green = good (>80%).", zh: "按道馆：评估覆盖率。红色=低（<50%），绿色=良好（>80%）。" },
        { en: "By Coach: assessments done, unique kids, average score per coach.", zh: "按教练：评估数量、学员人数、平均分。" },
        { en: "Score Distribution: bar chart showing kids in each score range.", zh: "成绩分布：柱状图显示各分数段的学员数量。" },
        { en: "Overdue: active kids not yet assessed, grouped by gym. Tap to go to profile.", zh: "逾期：未评估的活跃学员，按道馆分组。点击跳转到档案。" },
      ],
      visual: { type: "stats", items: [
        { label: "Active", value: "45" },
        { label: "Assessed", value: "38", sub: "84%" },
        { label: "Avg Score", value: "3.72" },
        { label: "Total", value: "42" },
      ]},
    },
    { icon: "👤", title: "Profile", titleZh: "学员档案",
      steps: [
        { en: "Select a kid from the dropdown, or tap any kid's name in the app.", zh: "从下拉菜单选择学员，或在应用中点击任意学员姓名。" },
        { en: "Header: name, ID, gym(s), belt, age, weight, active status.", zh: "顶部：姓名、ID、道馆、腰带、年龄、体重、活跃状态。" },
        { en: "Latest Assessment: radar chart + category scores + final score.", zh: "最新评估：雷达图+各类分数+最终分。" },
        { en: "Score Trend: line chart of final scores over time.", zh: "成绩趋势：历次最终分数折线图。" },
        { en: "History: expandable cards for each assessment. Edit, delete, or copy.", zh: "历史记录：每次评估的可展开卡片。可编辑、删除或复制。" },
        { en: "Export PDF: generates printable progress report in new tab.", zh: "导出PDF：在新标签页生成可打印的进度报告。" },
      ],
      visual: { type: "radar" },
    },
    { icon: "📋", title: "Classes", titleZh: "课程",
      steps: [
        { en: "Manage class attendance with 3 sub-tabs: Record, History, and Analytics.", zh: "通过3个子标签管理课程出勤：记录、历史和分析。" },
        { en: "Record tab: select date and gym, see scheduled classes from weekly schedule. Tap a class to expand and mark attendance.", zh: "记录标签：选择日期和道馆，查看每周课表中的课程。点击课程展开标记出勤。" },
        { en: "Group classes: tap to toggle Absent ↔ Present. Competition classes: Absent → Present → Missed.", zh: "小组课：点击切换缺席↔出勤。竞赛课：缺席→出勤→缺课。" },
        { en: "Use 'Quick Class' button for PT sessions or one-off unscheduled classes.", zh: "使用「快速课程」按钮添加私教或临时课程。" },
        { en: "Weekly schedule and class types are configured in Settings → Classes.", zh: "每周课表和课程类型在设置→课程中配置。" },
        { en: "Attendance data feeds into promotion eligibility (class count since last promotion).", zh: "出勤数据用于晋级资格计算（上次晋级后的课时数）。" },
      ],
      visual: { type: "card", label: "Status Cycle", items: ["Group: — Absent ↔ ✅ Present", "Competition: — Absent → ✅ Present → 🟡 Missed"] },
    },
    { icon: "🎖", title: "Promotion", titleZh: "晋级",
      steps: [
        { en: "Shows kids eligible for stripe or belt promotion at the selected gym.", zh: "显示所选道馆中符合条纹或腰带晋级条件的学员。" },
        { en: "Stripe eligibility: required number of classes since last promotion (default 10).", zh: "条纹资格：上次晋级后需达到的课时数（默认10节）。" },
        { en: "Belt eligibility: all stripes earned + class count + months at current belt (defaults: 4 stripes, 40 classes, 9 months).", zh: "腰带资格：满条纹+课时+在当前腰带的时间（默认：4条纹、40节课、9个月）。" },
        { en: "Only eligible kids are shown, grouped into Belt Promotions and Stripe Promotions (collapsible sections).", zh: "仅显示符合条件的学员，分为腰带晋级和条纹晋级两组（可折叠）。" },
        { en: "Tap the action button to award. Promotion is logged with date and coach name.", zh: "点击操作按钮授予晋级。记录日期和教练姓名。" },
        { en: "Recent Promotions section shows the audit trail of all awarded promotions.", zh: "近期晋级记录显示所有已授予晋级的审计日志。" },
        { en: "Rules are configurable in Settings → Promotion.", zh: "规则可在设置 → 晋级中配置。" },
      ],
      visual: { type: "card", label: "Promotion Rules", items: ["🎖 Stripe: 10 classes", "🥋 Belt: 4 stripes + 40 classes + 9 months", "All rules configurable in Settings"] },
    },
    { icon: "⚙️", title: "Settings", titleZh: "设置",
      steps: [
        { en: "Coaches: add/remove coaches and assign each to a gym.", zh: "教练：添加/删除教练并分配道馆。" },
        { en: "Community: add parent/volunteer accounts with gym assignment and read-only access.", zh: "社区：添加家长/志愿者帐户，分配道馆，只读权限。" },
        { en: "Gyms: add/remove gym locations.", zh: "道馆：添加/删除道馆。" },
        { en: "Belts: manage belt progression order.", zh: "腰带：管理腰带进阶顺序。" },
        { en: "Cycles: define assessment periods (e.g. 2026 Q1).", zh: "周期：定义评估周期。" },
        { en: "Scoring Weights: adjust category weights (must total 100%).", zh: "评分权重：调整类别权重（总和100%）。" },
        { en: "Promotion Rules: configure classes for stripe, stripes/classes/months for belt.", zh: "晋级规则：配置条纹所需课时、腰带所需条纹/课时/月数。" },
        { en: "Weight Rules: set brackets per age category.", zh: "体重规则：为每个年龄组设置分级。" },
        { en: "Factory Reset: returns to demo data. Deletes everything.", zh: "恢复出厂：还原演示数据。删除所有内容。" },
      ],
      visual: { type: "settings", items: ["Coaches", "Community", "Gyms", "Belts", "Cycles", "Scoring", "Promotion", "Weights", "Reset"] },
    },
  ];
  const sec = sections[activeSection];
  const renderVisual = (v) => {
    if (!v) return null;
    if (v.type === "flow") return (<div style={{ display: "flex", justifyContent: "center", padding: 16, background: C.card2, borderRadius: 10, margin: "12px 0" }}><div style={{ fontSize: 14, fontWeight: 700, color: C.red, letterSpacing: 1 }}>{v.items[0]}</div></div>);
    if (v.type === "card") return (<div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, margin: "12px 0" }}><div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", marginBottom: 8 }}>{v.label}</div>{v.items.map((item, i) => (<div key={i} style={{ fontSize: 12, color: i === 2 ? C.red : C.text, padding: "3px 0", borderBottom: i < v.items.length - 1 ? `1px solid ${C.border}` : "none" }}>{item}</div>))}</div>);
    if (v.type === "scores") return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "12px 0" }}>{v.items.map((item, i) => (<div key={i} style={{ background: item.color + "22", border: `1px solid ${item.color}44`, borderRadius: 8, padding: 10, textAlign: "center" }}><div style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{item.label}</div><div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.pct}</div></div>))}</div>);
    if (v.type === "ranking") return (<div style={{ margin: "12px 0" }}>{v.items.map((item, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}><div style={{ width: 24, height: 24, borderRadius: 12, background: item.rank === 1 ? C.red : C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: item.rank === 1 ? "#fff" : C.textDim, fontSize: 12 }}>{item.rank}</div><span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 600 }}>{item.name}</span><span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{item.score}</span><span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, fontWeight: 700, background: item.selected ? "#4CAF5022" : "transparent", border: item.selected ? "1px solid #4CAF5044" : `1px solid ${C.border}`, color: item.selected ? "#4CAF50" : C.textDim }}>{item.selected ? "✓ Selected" : "Select"}</span></div>))}</div>);
    if (v.type === "stats") return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "12px 0" }}>{v.items.map((item, i) => (<div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, textAlign: "center" }}><div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase" }}>{item.label}</div><div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{item.value}</div>{item.sub && <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{item.sub}</div>}</div>))}</div>);
    if (v.type === "radar") return (<div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}><svg width="160" height="160" viewBox="0 0 160 160">{[80, 60, 40, 20].map(r => <circle key={r} cx="80" cy="80" r={r} fill="none" stroke={C.border} strokeWidth="0.5" />)}<polygon points="80,25 130,65 115,130 45,130 30,65" fill={C.red + "33"} stroke={C.red} strokeWidth="2" />{[["BJJ", 80, 18], ["Ath", 138, 62], ["Com", 122, 140], ["Comp", 38, 140], ["Def", 22, 62]].map(([l, x, y]) => (<text key={l} x={x} y={y} textAnchor="middle" fill={C.textDim} fontSize="9" fontWeight="700">{l}</text>))}</svg></div>);
    if (v.type === "settings") return (<div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>{v.items.map((item, i) => (<span key={i} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, background: C.card, border: `1px solid ${C.border}`, color: C.text }}>{item}</span>))}</div>);
    return null;
  };
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, background: C.bg, overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 201, background: C.card, borderBottom: `1px solid ${C.border}`, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><span style={{ fontSize: 18, fontWeight: 800, color: C.red, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>📖 USER GUIDE</span><span style={{ fontSize: 11, color: C.textDim, marginLeft: 8 }}>使用指南</span></div>
        <button onClick={onClose} style={{ background: C.red, border: "none", borderRadius: 8, padding: "6px 16px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✕ Close</button>
      </div>
      <div style={{ display: "flex", overflowX: "auto", gap: 4, padding: "10px 16px", background: C.card2, borderBottom: `1px solid ${C.border}` }}>
        {sections.map((s2, i) => (
          <button key={i} onClick={() => setActiveSection(i)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: activeSection === i ? 700 : 400, background: activeSection === i ? C.red + "22" : "transparent", border: activeSection === i ? `2px solid ${C.red}` : `1px solid ${C.border}`, color: activeSection === i ? C.red : C.textDim, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{s2.icon} {s2.title}</button>
        ))}
      </div>
      <div style={{ padding: 16, maxWidth: 600, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: "8px 0 4px", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{sec.icon} {sec.title} <span style={{ fontWeight: 400, fontSize: 16, color: C.textDim }}>{sec.titleZh}</span></h2>
        {renderVisual(sec.visual)}
        <div style={{ marginTop: 16 }}>
          {sec.steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
              <div style={{ width: 24, height: 24, borderRadius: 12, background: C.red + "22", border: `1px solid ${C.red}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: C.red, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: C.text, lineHeight: "20px", marginBottom: 4 }}>{step.en}</div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: "18px" }}>{step.zh}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 24, paddingBottom: 40 }}>
          {activeSection > 0 && <button onClick={() => setActiveSection(activeSection - 1)} style={{ ...s.btnSm, flex: 1 }}>← {sections[activeSection - 1].title}</button>}
          {activeSection < sections.length - 1 && <button onClick={() => setActiveSection(activeSection + 1)} style={{ ...s.btn, flex: 1 }}>{sections[activeSection + 1].title} →</button>}
        </div>
      </div>
    </div>
  );
}


/* ━━━ ADMIN SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AdminScreen({ assessments, roster, config }) {
  const [filterCoach, setFilterCoach] = useState("");
  const [filterCycle, setFilterCycle] = useState("");

  // Build activity log from assessments
  const log = useMemo(() => {
    const entries = assessments.map(a => {
      const kid = roster.find(k => k.id === a.kidId);
      const sub = computeSubtotals(a.scores, config);
      return { ...a, kidName: kid?.name || a.kidId, gym: kidGymsStr(kid), belt: kid?.belt || "?", score: sub.final };
    });
    let filtered = entries;
    if (filterCoach) filtered = filtered.filter(e => e.coach === filterCoach);
    if (filterCycle) filtered = filtered.filter(e => e.cycle === filterCycle);
    filtered.sort((a, b) => b.date.localeCompare(a.date));
    return filtered;
  }, [assessments, roster, config, filterCoach, filterCycle]);

  // Coach usage stats
  const coachStats = useMemo(() => {
    const map = {};
    config.coaches.forEach(c => {
      const name = coachName(c);
      map[name] = { name, gym: coachGym(c), total: 0, kids: new Set(), cycles: new Set(), dates: [], avgScore: 0, scores: [] };
    });
    assessments.forEach(a => {
      if (!map[a.coach]) map[a.coach] = { name: a.coach, gym: "?", total: 0, kids: new Set(), cycles: new Set(), dates: [], avgScore: 0, scores: [] };
      const m = map[a.coach];
      m.total++;
      m.kids.add(a.kidId);
      m.cycles.add(a.cycle);
      m.dates.push(a.date);
      const sub = computeSubtotals(a.scores, config);
      m.scores.push(sub.final);
    });
    return Object.values(map).map(m => ({
      ...m,
      kidCount: m.kids.size,
      cycleCount: m.cycles.size,
      avgScore: m.scores.length ? (m.scores.reduce((a, b) => a + b, 0) / m.scores.length) : 0,
      firstDate: m.dates.length ? m.dates.sort()[0] : "—",
      lastDate: m.dates.length ? m.dates.sort().pop() : "—",
      activeDays: new Set(m.dates).size,
    })).sort((a, b) => b.total - a.total);
  }, [assessments, config]);

  // Activity by month
  const monthlyActivity = useMemo(() => {
    const map = {};
    assessments.forEach(a => {
      const month = a.date.slice(0, 7);
      if (!map[month]) map[month] = { month, total: 0, coaches: new Set() };
      map[month].total++;
      map[month].coaches.add(a.coach);
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [assessments]);

  const fmt = (n) => n ? n.toFixed(2) : "—";
  const allCoaches = [...new Set([...config.coaches.map(c => coachName(c)), ...assessments.map(a => a.coach)])].sort();
  const maxMonthly = Math.max(...monthlyActivity.map(m => m.total), 1);

  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>👑 Admin Dashboard</h1>
        <PageHelp page="admin" />
      </div>

      {/* ── Coach Usage Stats ── */}
      <h2 style={s.h2}>Coach Activity Summary</h2>
      <div style={{ overflowX: "auto", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {["Coach", "Gym", "Total", "Kids", "Days", "First", "Last", "Avg"].map(h => (
                <th key={h} style={{ padding: "8px 6px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coachStats.map(cs => (
              <tr key={cs.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "8px 6px", fontWeight: 700, color: C.text }}>{cs.name}</td>
                <td style={{ padding: "8px 6px", color: C.textDim }}>{cs.gym}</td>
                <td style={{ padding: "8px 6px", fontWeight: 700, color: C.text }}>{cs.total}</td>
                <td style={{ padding: "8px 6px", color: C.text }}>{cs.kidCount}</td>
                <td style={{ padding: "8px 6px", color: C.text }}>{cs.activeDays}</td>
                <td style={{ padding: "8px 6px", color: C.textDim, fontSize: 11 }}>{cs.firstDate}</td>
                <td style={{ padding: "8px 6px", color: C.textDim, fontSize: 11 }}>{cs.lastDate}</td>
                <td style={{ padding: "8px 6px", fontWeight: 700, color: cs.avgScore >= 4 ? "#4CAF50" : cs.avgScore >= 3 ? C.text : C.red }}>{fmt(cs.avgScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Monthly Activity ── */}
      <h2 style={s.h2}>Monthly Activity</h2>
      <div style={{ marginBottom: 20 }}>
        {monthlyActivity.map(m => (
          <div key={m.month} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 60, fontSize: 11, color: C.textDim, flexShrink: 0 }}>{m.month}</span>
            <div style={{ flex: 1, height: 20, background: C.card2, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${(m.total / maxMonthly) * 100}%`, height: "100%", background: C.red + "88", borderRadius: 4, minWidth: 2 }} />
            </div>
            <span style={{ fontSize: 11, color: C.text, fontWeight: 700, width: 28, textAlign: "right" }}>{m.total}</span>
            <span style={{ fontSize: 10, color: C.textDim, width: 60 }}>{m.coaches.size} coach{m.coaches.size > 1 ? "es" : ""}</span>
          </div>
        ))}
      </div>

      {/* ── Assessment Log ── */}
      <h2 style={s.h2}>Assessment Log ({log.length})</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <select style={{ ...s.select, width: "auto", minWidth: 90 }} value={filterCoach} onChange={e => setFilterCoach(e.target.value)}>
          <option value="">All Coaches</option>
          {allCoaches.map(c => <option key={c}>{c}</option>)}
        </select>
        <select style={{ ...s.select, width: "auto", minWidth: 90 }} value={filterCycle} onChange={e => setFilterCycle(e.target.value)}>
          <option value="">All Cycles</option>
          {config.cycles.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ maxHeight: 500, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
        {log.map((entry, i) => (
          <div key={entry.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.card : "transparent" }}>
            <div style={{ width: 32, height: 32, borderRadius: 16, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: C.textDim, flexShrink: 0 }}>{entry.coach[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{entry.kidName}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{entry.coach} · {entry.gym} · {entry.belt}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: entry.score >= 4 ? "#4CAF50" : entry.score >= 3 ? C.text : C.red }}>{fmt(entry.score)}</div>
              <div style={{ fontSize: 10, color: C.textDim }}>{entry.date}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>{entry.cycle}</div>
            </div>
          </div>
        ))}
        {log.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.textDim, fontSize: 13 }}>No assessments found</div>}
      </div>

      {/* ── Export ── */}
      <button style={{ ...s.btnSm, marginTop: 14 }} onClick={() => {
        const rows = [["Date", "Cycle", "Coach", "Kid", "Kid ID", "Gym", "Belt", "Score"]];
        log.forEach(e => rows.push([e.date, e.cycle, e.coach, e.kidName, e.kidId, e.gym, e.belt, fmt(e.score)]));
        const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `bushido-admin-log-${today()}.csv`; a.click();
      }}>📥 Export Assessments (CSV)</button>

      {/* ── Activity Log (logins + actions) ── */}
      <h2 style={{ ...s.h2, marginTop: 24 }}>Activity Log</h2>
      {(() => {
        const actLog = (config.activityLog || []).slice().reverse();
        const typeLabels = { login: "🔑 Login", assessment_new: "📝 New Assessment", assessment_edit: "✏️ Edit Assessment" };
        const typeColors = { login: "#64B5F6", assessment_new: "#4CAF50", assessment_edit: "#FFA726" };
        return (
          <>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>{actLog.length} events</div>
            <div style={{ maxHeight: 400, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
              {actLog.map((e, i) => {
                const d = new Date(e.time);
                const timeStr = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                const isMobile = (e.ua || "").match(/Mobile|Android|iPhone/i);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.card : "transparent" }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: typeColors[e.type] || C.textDim, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                        {typeLabels[e.type] || e.type} — {e.coach}{e.role === "admin" || e.admin ? " 👑" : e.role === "community" ? " 🤝" : ""}
                      </div>
                      {e.kidName && <div style={{ fontSize: 11, color: C.textDim }}>Kid: {e.kidName}{e.cycle ? ` · ${e.cycle}` : ""}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 10, color: C.textDim }}>{timeStr}</div>
                      <div style={{ fontSize: 9, color: C.textDim }}>{isMobile ? "📱" : "💻"}</div>
                    </div>
                  </div>
                );
              })}
              {actLog.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.textDim, fontSize: 13 }}>No activity yet</div>}
            </div>
            {actLog.length > 0 && (
              <button style={{ ...s.btnSm, marginTop: 10 }} onClick={() => {
                const rows = [["Time", "Type", "Coach", "Admin", "Kid", "Cycle", "Device"]];
                actLog.forEach(e => {
                  const isMobile = (e.ua || "").match(/Mobile|Android|iPhone/i);
                  rows.push([e.time, e.type, e.coach, e.admin ? "Yes" : "No", e.kidName || "", e.cycle || "", isMobile ? "Mobile" : "Desktop"]);
                });
                const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                a.download = `bushido-activity-log-${today()}.csv`; a.click();
              }}>📥 Export Activity (CSV)</button>
            )}
          </>
        );
      })()}
    </div>
  );
}


/* ━━━ MAIN APP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const NAV_PRIMARY = [
    { key: "home", icon: "🏠", label: "Home" },
{ key: "roster", icon: "👥", label: "Roster" },
  { key: "classes", icon: "📋", label: "Classes" },
  { key: "score", icon: "📝", label: "Score" },
  { key: "more", icon: "☰", label: "More" },
];
const NAV_MORE = [
    { key: "profile", icon: "👤", label: "Profile" },
{ key: "rankings", icon: "🏆", label: "Rankings & Teams" },
  { key: "promotion", icon: "⭐", label: "Promotions" },
  { key: "reports", icon: "📊", label: "Reports" },
  { key: "settings", icon: "🔧", label: "Settings", adminOnly: true },
  { key: "admin", icon: "👑", label: "Admin Log", adminOnly: true },
];

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ background: "#0a0a0a", color: "#e8e8e8", minHeight: "100vh", padding: 24, fontFamily: "monospace" }}>
        <h1 style={{ color: "#C41E3A" }}>⚠️ App Error</h1>
        <p style={{ color: "#ff9800" }}>{this.state.error.message}</p>
        <pre style={{ fontSize: 11, color: "#888", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{this.state.error.stack}</pre>
        <button onClick={() => { this.setState({ error: null }); }} style={{ marginTop: 16, padding: "8px 16px", background: "#C41E3A", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Try Again</button>
      </div>
    );
    return this.props.children;
  }
}

function AppInner() {
  const [config, setConfig, configLoaded] = useStorage("bushido:config", DEFAULT_CONFIG);
  const [roster, setRoster, rosterLoaded] = useStorage("bushido:roster", SEED_ROSTER);
  const [assessments, setAssessments, assLoaded] = useStorage("bushido:assessments", null);
  const [selections, setSelections, selLoaded] = useStorage("bushido:selections", {});
  const [attendance, setAttendance, attLoaded] = useStorage("bushido:attendance", []);
  const [tab, setTab] = useState("home");
  const [rosterDefaultSort, setRosterDefaultSort] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedKidId, setSelectedKidId] = useState("");
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [loggedCoach, setLoggedCoach] = useState(null);
  const [role, setRole] = useState(null); // "admin" | "coach" | "community"
  const [loggedGym, setLoggedGym] = useState(null);
  const isAdmin = role === "admin";
  const isCommunity = role === "community";
  const isMasterCoach = role === "master";
  const canToggleGyms = isAdmin || isMasterCoach;

  const handleLogin = (name, loginRole) => {
    setLoggedCoach(name); setRole(loginRole);
    // Resolve gym for the logged-in user
    if (loginRole === "community") {
      const cm = (config?.communityMembers || []).find(m => m.name === name);
      setLoggedGym(cm?.gym || null);
    } else if (loginRole === "coach") {
      const co = (config?.coaches || []).find(c => coachName(c) === name);
      setLoggedGym(co ? coachGym(co) : null);
    } else if (loginRole === "master") {
      setLoggedGym(null);
    } else {
      setLoggedGym(null);
    }
    const entry = { type: "login", coach: name, role: loginRole, time: new Date().toISOString(), ua: navigator.userAgent.slice(0, 100) };
    setConfig(p => ({ ...p, activityLog: [...(p.activityLog || []), entry] }));
  };

  // Initialize seed assessments after load
  useEffect(() => {
    if (assLoaded && assessments === null) {
      setAssessments(generateSeedAssessments());
    }
  }, [assLoaded, assessments]);

  // Migrate old attendance records (type:"group"/"competition") to new format (classTypeId)
  useEffect(() => {
    if (!attLoaded || !attendance || !Array.isArray(attendance)) return;
    const needsMigration = attendance.some(r => r.type && !r.classTypeId);
    if (!needsMigration) return;
    const migrated = attendance.map(r => {
      if (r.classTypeId) return r; // already new format
      const classTypeId = r.type === "competition" ? "comp" : "group1";
      const time = r.time || "00:00";
      return { ...r, classTypeId, time, scheduleId: null };
    });
    setAttendance(migrated);
  }, [attLoaded]);

  // Sanitize placeholder records from empty JSONBin writes
  const safeAttendance = useMemo(() => {
    if (!Array.isArray(attendance)) return [];
    return attendance.filter(r => r && r.key && r.records);
  }, [attendance]);
  const safeSelections = useMemo(() => {
    if (!selections || typeof selections !== "object") return {};
    const s = { ...selections };
    delete s._empty;
    return s;
  }, [selections]);
  const safeAssessments = useMemo(() => {
    if (!Array.isArray(assessments)) return [];
    return assessments.filter(a => a && a.id && a.kidId && a.id !== "_empty" && a.kidId !== "_empty");
  }, [assessments]);

  // Cleanup orphaned data when roster changes (e.g. kids deleted)
  useEffect(() => {
    if (!roster || !Array.isArray(roster) || roster.length === 0) return;
    const rosterIds = new Set(roster.map(k => k.id));

    // Clean promotionLog
    const pLog = config?.promotionLog;
    if (Array.isArray(pLog) && pLog.some(e => !rosterIds.has(e.kidId))) {
      setConfig(prev => ({ ...prev, promotionLog: (prev.promotionLog || []).filter(e => rosterIds.has(e.kidId)) }));
    }

    // Clean goals
    const goals = config?.goals;
    if (goals && typeof goals === "object") {
      const orphanGoalKeys = Object.keys(goals).filter(k => !rosterIds.has(k));
      if (orphanGoalKeys.length > 0) {
        setConfig(prev => {
          const g = { ...(prev.goals || {}) };
          orphanGoalKeys.forEach(k => delete g[k]);
          return { ...prev, goals: g };
        });
      }
    }

    // Clean selections
    if (selections && typeof selections === "object") {
      let changed = false;
      const cleaned = {};
      Object.entries(selections).forEach(([key, ids]) => {
        const filtered = (ids || []).filter(id => rosterIds.has(id));
        if (filtered.length !== (ids || []).length) changed = true;
        if (filtered.length > 0) cleaned[key] = filtered;
      });
      if (changed) setSelections(cleaned);
    }

    // Clean attendance records (remove kid entries from records, drop empty sessions)
    if (Array.isArray(attendance) && attendance.length > 0) {
      let changed = false;
      const cleaned = attendance.map(r => {
        if (!r.records) return r;
        const orphanKeys = Object.keys(r.records).filter(id => !rosterIds.has(id));
        if (orphanKeys.length === 0) return r;
        changed = true;
        const newRecs = { ...r.records };
        orphanKeys.forEach(k => delete newRecs[k]);
        return { ...r, records: newRecs };
      }).filter(r => Object.keys(r.records || {}).length > 0 || !r.records);
      if (changed) setAttendance(cleaned);
    }

    // Clean assessments
    if (Array.isArray(assessments) && assessments.some(a => !rosterIds.has(a.kidId))) {
      setAssessments(prev => (prev || []).filter(a => rosterIds.has(a.kidId)));
    }
  }, [roster]);

  // Ensure config has all required fields (in case of partial storage)
  const safeConfig = useMemo(() => {
    const merged = {
      ...DEFAULT_CONFIG,
      ...config,
      criteria: { ...DEFAULT_CONFIG.criteria, ...(config?.criteria || {}) },
      scoringWeights: { ...DEFAULT_CONFIG.scoringWeights, ...(config?.scoringWeights || {}) },
      weightRules: { ...DEFAULT_CONFIG.weightRules, ...(config?.weightRules || {}) },
      classTypes: config?.classTypes || DEFAULT_CONFIG.classTypes,
      weeklySchedule: config?.weeklySchedule || DEFAULT_CONFIG.weeklySchedule,
    };
    // Migrate string coaches to objects
    if (merged.coaches && merged.coaches.length > 0 && typeof merged.coaches[0] === "string") {
      merged.coaches = merged.coaches.map(c => ({ name: c, gym: "" }));
    }
    return merged;
  }, [config]);

  const promoCount = useMemo(() => {
    const rules = safeConfig.promotionRules || { stripeClasses: 10, beltClasses: 40, beltMonths: 9, stripesForBelt: 4 };
    const gymFilter = isAdmin ? null : loggedGym;
    const now = new Date();
    return roster.filter(k => k.active && (!gymFilter || kidInGym(k, gymFilter))).filter(kid => {
      const stripes = kid.stripes || 0;
      const lastPromo = kid.lastPromotionDate || kid.joinDate || "2020-01-01";
      const classes = safeAttendance.filter(r => r.date > lastPromo && r.records?.[kid.id] === "attend").length;
      const beltIdx = safeConfig.belts.indexOf(kid.belt);
      const hasNextBelt = beltIdx < safeConfig.belts.length - 1;
      const d = new Date(lastPromo);
      const months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      const stripeReady = stripes < (rules.stripesForBelt || 4) && classes >= (rules.stripeClasses || 10);
      const beltReady = hasNextBelt && stripes >= (rules.stripesForBelt || 4)
        && classes >= (rules.beltClasses || 40) && months >= (rules.beltMonths || 9);
      return stripeReady || beltReady;
    }).length;
  }, [roster, safeAttendance, safeConfig, isAdmin, loggedGym]);

  const loaded = configLoaded && rosterLoaded && assLoaded && selLoaded && attLoaded;

  const viewProfile = (kidId) => {
    setSelectedKidId(kidId);
    setTab("profile");
  };

  const editAssessment = (a) => {
    setEditingAssessment(a);
    setTab("score");
  };

  if (!loaded) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🥋</div>
          <div style={{ color: C.red, fontWeight: 800, fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>BUSHIDO</div>
          <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!loggedCoach) {
    return <LoginScreen config={safeConfig} onLogin={handleLogin} />;
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", WebkitFontSmoothing: "antialiased" }}>

      {/* Top Bar */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 100 }}>
        <span style={{ fontSize: 22 }}>🥋</span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, fontWeight: 800, color: C.red, letterSpacing: 2 }}>BUSHIDO</span>
        <span style={{ fontSize: 11, color: C.textDim, marginLeft: "auto" }}>{loggedCoach}{isAdmin ? " 👑" : isCommunity ? " 🤝" : ""}{!isAdmin && !isCommunity && loggedCoach !== "Admin" ? ` · ${coachGym(safeConfig.coaches.find(c => coachName(c) === loggedCoach)) || ""}` : ""}</span>
        <button onClick={() => setShowGuide(true)} style={{
          background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "4px 10px", cursor: "pointer", fontSize: 13, color: C.textDim,
        }}>📖</button>
        <button onClick={() => { setLoggedCoach(null); setRole(null); setLoggedGym(null); }} style={{
          background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "4px 10px", cursor: "pointer", fontSize: 13, color: C.textDim,
        }}>🚪</button>
      </div>

      {showGuide && <UserGuide onClose={() => setShowGuide(false)} />}

      {/* Content */}
      {tab === "home" && <HomeScreen roster={roster} attendance={safeAttendance} assessments={safeAssessments} config={safeConfig} selections={safeSelections} loggedCoach={loggedCoach} loggedGym={loggedGym} isAdmin={canToggleGyms} isCommunity={isCommunity} onNavigate={(target) => {
        if (target === "roster_training") { setRosterDefaultSort("training_asc"); setTab("roster"); }
        else { setTab(target); }
      }} />}
      {tab === "roster" && <RosterScreen roster={roster} setRoster={setRoster} config={safeConfig} assessments={safeAssessments} onViewProfile={viewProfile} defaultGym={loggedGym} isAdmin={canToggleGyms} selections={safeSelections} attendance={safeAttendance} defaultSort={rosterDefaultSort} />}
      {tab === "classes" && <ClassesScreen roster={roster} attendance={safeAttendance} setAttendance={setAttendance} config={safeConfig} loggedGym={loggedGym} isAdmin={canToggleGyms} selections={safeSelections} />}
      {tab === "promotion" && <PromotionScreen roster={roster} setRoster={setRoster} attendance={safeAttendance} config={safeConfig} setConfig={setConfig} loggedCoach={loggedCoach} isCommunity={isCommunity} isAdmin={canToggleGyms} loggedGym={loggedGym} onViewProfile={viewProfile} />}
      {tab === "score" && !isCommunity && <ScoringScreen roster={roster} assessments={safeAssessments} setAssessments={setAssessments} config={safeConfig} editingAssessment={editingAssessment} setEditingAssessment={setEditingAssessment} loggedCoach={loggedCoach} isAdmin={canToggleGyms} loggedGym={loggedGym} logActivity={entry => setConfig(p => ({ ...p, activityLog: [...(p.activityLog || []), { ...entry, time: new Date().toISOString() }] }))} />}
      {tab === "score" && isCommunity && <div style={s.page}><h1 style={s.h1}>Score</h1><div style={{ ...s.card, padding: 24, textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div><div style={{ color: C.textDim, fontSize: 13 }}>Scoring is restricted to coaches only.<br/>社区成员无法进行评分。</div></div></div>}
      {tab === "rankings" && <RankingsScreen roster={roster} assessments={safeAssessments} config={safeConfig} selections={safeSelections} setSelections={isCommunity ? () => {} : setSelections} readOnly={isCommunity} isAdmin={canToggleGyms} loggedGym={loggedGym} />}
      {tab === "reports" && <ReportingScreen roster={roster} assessments={safeAssessments} config={safeConfig} onViewProfile={viewProfile} onScore={isCommunity ? () => {} : (kidId) => { setTab("score"); }} readOnly={isCommunity} isAdmin={canToggleGyms} loggedGym={loggedGym} selections={safeSelections} attendance={safeAttendance} />}
      {tab === "profile" && <ProfileScreen roster={roster} assessments={safeAssessments} setAssessments={setAssessments} config={safeConfig} setConfig={setConfig} selectedKidId={selectedKidId} setSelectedKidId={setSelectedKidId} onEditAssessment={editAssessment} isCommunity={isCommunity} isAdmin={canToggleGyms} loggedGym={loggedGym} attendance={safeAttendance} selections={safeSelections} />}
      {tab === "admin" && isAdmin && <AdminScreen assessments={safeAssessments} roster={roster} config={safeConfig} />}
      {tab === "settings" && <SettingsScreen config={safeConfig} setConfig={setConfig} roster={roster} assessments={safeAssessments} setRoster={setRoster} setAssessments={setAssessments} setSelections={setSelections} setAttendance={setAttendance} isAdmin={isAdmin} />}

      {/* More Menu Overlay */}
      {showMore && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setShowMore(false)}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: C.card, borderTop: `1px solid ${C.border}`,
            borderRadius: "16px 16px 0 0", padding: "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 16px" }} />
            {NAV_MORE.filter(n => !n.adminOnly || isAdmin).filter(n => !(isCommunity && n.key === "settings")).map(n => {
              const isActive = tab === n.key;
              return (
                <button key={n.key} onClick={() => {
                  setTab(n.key);
                  setShowMore(false);
                  if (n.key !== "profile") setSelectedKidId("");
                  if (n.key !== "score") setEditingAssessment(null);
                  if (n.key !== "roster") setRosterDefaultSort(null);
                }} style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  padding: "14px 12px", background: isActive ? C.red + "15" : "transparent",
                  border: "none", borderRadius: 10, cursor: "pointer", marginBottom: 4,
                }}>
                  <span style={{ fontSize: 22, position: "relative" }}>{n.icon}
                    {n.key === "promotion" && promoCount > 0 && (
                      <span style={{ position: "absolute", top: -4, right: -8, background: C.red, color: "#fff", fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{promoCount}</span>
                    )}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: isActive ? C.red : C.text }}>{n.label}</span>
                  {isActive && <span style={{ marginLeft: "auto", fontSize: 11, color: C.red, fontWeight: 700 }}>●</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: C.card,
        borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100,
        paddingBottom: "env(safe-area-inset-bottom, 0px)"
      }}>
        {NAV_PRIMARY.filter(n => !(isCommunity && n.key === "classes")).map(n => {
          const isMoreActive = n.key === "more" && NAV_MORE.some(m => m.key === tab);
          const isActive = n.key === "more" ? isMoreActive : tab === n.key;
          const hasBadge = n.key === "more" && promoCount > 0 && !NAV_PRIMARY.some(p => p.key === "promotion");
          return (
            <button key={n.key} onClick={() => {
              if (n.key === "more") {
                setShowMore(!showMore);
              } else {
                setTab(n.key);
                setShowMore(false);
                if (n.key !== "profile") setSelectedKidId("");
                if (n.key !== "score") setEditingAssessment(null);
                if (n.key !== "roster") setRosterDefaultSort(null);
              }
            }}
              style={{
                flex: 1, padding: "8px 0 6px", background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                color: isActive ? C.red : C.textDim, transition: "color 0.2s"
              }}>
              <span style={{ fontSize: 18, position: "relative" }}>{n.icon}
                {hasBadge && (
                  <span style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: 4, background: C.red }} />
                )}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.3px" }}>{n.label}</span>
              {isActive && <div style={{ width: 16, height: 2, background: C.red, borderRadius: 1, marginTop: 1 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}
