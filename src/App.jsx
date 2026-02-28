import { useState, useEffect, useMemo, useCallback, useRef } from "react";

/* ━━━ UTILITIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const uid = () => Math.random().toString(36).slice(2,10);
const fmt = n => typeof n==="number"? (Number.isInteger(n)?n.toString():n.toFixed(2)) : "—";
const avg = a => a.length? a.reduce((s,v)=>s+v,0)/a.length : 0;
const today = () => new Date().toISOString().slice(0,10);
const ageAt = (dob, d) => { const x=new Date(d),b=new Date(dob); let a=x.getFullYear()-b.getFullYear(); if(x.getMonth()<b.getMonth()||(x.getMonth()===b.getMonth()&&x.getDate()<b.getDate()))a--; return a; };
const ageCat = a => a<8?"U8":a<10?"U10":a<12?"U12":"U14";
const weightCat = (w, ac, rules) => { const r=rules[ac]; if(!r)return"Medium"; for(const[cat,[lo,hi]] of Object.entries(r)){if(w>=lo&&w<hi)return cat;} return"Heavy"; };

const BELT_HEX = {White:"#e0e0e0","Grey-White":"#b8b8b8",Grey:"#808080","Grey-Black":"#505050","Yellow-White":"#e8d888",Yellow:"#d4a818","Yellow-Black":"#a07808"};
const CATEGORY_COLORS = {BJJ:"#C41E3A",Athletic:"#2196F3",Commitment:"#4CAF50",Competition:"#FF9800"};

const coachName = (c) => typeof c === "string" ? c : c.name;
const coachGym = (c) => typeof c === "string" ? "" : (c.gym || "");
const kidGymsStr = (k) => Array.isArray(k.gyms) ? k.gyms.join(", ") : (k.gym || "");
const kidInGym = (k, gym) => Array.isArray(k.gyms) ? k.gyms.includes(gym) : k.gym === gym;

/* ━━━ DEFAULT CONFIG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const DEFAULT_CONFIG = {
  coaches:[{name:"Saulo",gym:"Jing'An",pin:"bushido"},{name:"Ahmet",gym:"Xuhui",pin:"bushido"},{name:"Gui",gym:"Minhang",pin:"bushido"},{name:"Jadson",gym:"Jing'An",pin:"bushido"}],
  gyms:["Jing'An","Xuhui","Minhang"],
  belts:["White","Grey-White","Grey","Grey-Black","Yellow-White","Yellow","Yellow-Black"],
  cycles:["2025 H2","2026 H1","2026 H2","2027 H1"],
  scoringWeights:{BJJ:0.4,Athletic:0.2,Commitment:0.2,Competition:0.2},
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
const SEED_ROSTER = [
  {id:"K001",name:"Moneyberg",dob:"2017-03-15",belt:"Grey-Black",weight:30,gyms:["Jing'An"],active:true},
];

function generateSeedAssessments(){
  const a=[];
  const allCrit=[...DEFAULT_CONFIG.criteria.BJJ,...DEFAULT_CONFIG.criteria.Athletic,...DEFAULT_CONFIG.criteria.Commitment,...DEFAULT_CONFIG.criteria.Competition];
  const mk=(date,cycle,coach,overrides={})=>{
    const s={};
    allCrit.forEach(c=>{s[c]=overrides[c]||Math.floor(Math.random()*3)+3;});
    a.push({id:uid(),date,cycle,coach,kidId:"K001",scores:s});
  };
  mk("2025-06-01","2025 H2","Saulo",{Standup:3,"Top Game":3,"Bottom Game":2,Submission:2,Defense:3,Strength:3,Cardio:4,Mobility:3,Attendance:4,Attitude:3,Participation:3,Performance:2});
  mk("2025-12-05","2026 H1","Ahmet",{Standup:4,"Top Game":4,"Bottom Game":3,Submission:3,Defense:4,Strength:4,Cardio:5,Mobility:4,Attendance:5,Attitude:4,Participation:4,Performance:3});
  mk("2026-02-15","2026 H1","Saulo",{Standup:5,"Top Game":4,"Bottom Game":4,Submission:4,Defense:5,Strength:4,Cardio:5,Mobility:5,Attendance:5,Attitude:5,Participation:5,Performance:4});
  return a;
}

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

function RadarChart({data,size=200}){
  const cats=Object.keys(data);const n=cats.length;if(n<3)return null;
  const cx=size/2,cy=size/2,r=size*0.38;
  const angle=i=>(Math.PI*2*i)/n-Math.PI/2;
  const pt=(i,v)=>({x:cx+r*(v/5)*Math.cos(angle(i)),y:cy+r*(v/5)*Math.sin(angle(i))});
  const points=cats.map((c,i)=>pt(i,data[c]));
  const path=points.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ")+"Z";
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[1,2,3,4,5].map(rv=>{const pts=cats.map((_,i)=>pt(i,rv));const d=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ")+"Z";return (<path key={rv} d={d} fill="none" stroke={C.border} strokeWidth={0.5}/>);})}
      {cats.map((_,i)=>{const p=pt(i,5);return (<line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={C.border} strokeWidth={0.5}/>);})}
      <path d={path} fill={C.red+"33"} stroke={C.red} strokeWidth={2}/>
      {cats.map((c,i)=>{const p=pt(i,5.8);return (<text key={c} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill={C.textDim} fontSize={10} fontWeight={600}>{c}</text>);})}
      {points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={3} fill={C.red}/>)}
    </svg>
  );
}

/* ━━━ PAGE HELP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const PAGE_HELP = {
  roster: {
    en: "Manage all kids in the academy. Add kids manually or bulk import from a spreadsheet (CSV paste). Edit belt, weight, gym, or set a kid as inactive. Cards show last assessment date, score trend (↑↓→), and overdue status. Use the filter tabs to find kids who haven't been assessed this cycle.",
    zh: "管理学院所有学员。可手动添加或从表格批量导入（粘贴CSV）。编辑腰带、体重、道馆，或将学员设为不活跃。卡片显示上次评估日期、成绩趋势（↑↓→）及逾期状态。使用筛选标签查找本周期未评估的学员。",
  },
  score: {
    en: "Score a kid's assessment across 12 criteria in 4 categories: BJJ (40%), Athletic (20%), Commitment (20%), Competition (20%). Tap the ? button next to each criterion for scoring guidelines. You can score one kid at a time, or use 'Score multiple kids' to build a queue and score them in sequence with the same date/coach/cycle.",
    zh: "对学员进行12项标准的评分，涵盖4个类别：柔术（40%）、体能（20%）、投入度（20%）、比赛（20%）。点击每项标准旁的?按钮查看评分指南。可逐个评分，也可使用「批量评分」功能，按相同日期/教练/周期依次评分。",
  },
  rankings: {
    en: "View ranked kids by cycle, age category, weight class, and gym. Rankings are based on the latest assessment score per kid per cycle. Tap the circle button to select kids for competition teams. Use 'Export Rankings' to download the full table as CSV for Excel.",
    zh: "按周期、年龄组别、体重级别和道馆查看学员排名。排名基于每位学员每周期的最新评估成绩。点击圆圈按钮选择参赛队员。使用「导出排名」下载完整表格为CSV文件。",
  },
  reports: {
    en: "Dashboard overview of academy performance for the selected cycle. See assessment coverage by gym, coach workload, score distribution by age category, and a list of overdue kids who still need to be assessed. All data is scoped to the cycle selected at the top.",
    zh: "所选周期内学院表现的仪表盘概览。查看各道馆的评估覆盖率、教练工作量、各年龄组的成绩分布，以及仍需评估的逾期学员名单。所有数据以顶部选择的周期为范围。",
  },
  profile: {
    en: "View a kid's full profile: personal info, latest assessment with radar chart, score trend over time, and assessment history. Tap any assessment to expand details. Use 'Export PDF' to generate a printable progress report to share with parents.",
    zh: "查看学员完整档案：个人信息、最新评估雷达图、历史成绩趋势及评估记录。点击任意评估展开详情。使用「导出PDF」生成可打印的进度报告，分享给家长。",
  },
  settings: {
    en: "Configure coaches, gyms, belts, assessment cycles, scoring weights, and weight brackets. Changes apply immediately to all screens. Use 'Reset All Data' to return to demo data (this deletes everything).",
    zh: "配置教练、道馆、腰带、评估周期、评分权重及体重分级。更改立即应用于所有页面。使用「重置所有数据」恢复演示数据（将删除全部内容）。",
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
function RosterScreen({ roster, setRoster, config, assessments, onViewProfile }) {
  const [search, setSearch] = useState("");
  const [filterGym, setFilterGym] = useState("");
  const [filterActive, setFilterActive] = useState("active");
  const [modal, setModal] = useState(null); // null | "add" | kid object
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const currentCycle = config.cycles[1] || config.cycles[0] || "";

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
      status[k.id] = { latest, hasCurrent, trend, count: kidAss.length };
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
      return true;
    });
  }, [roster, search, filterGym, filterActive, kidStatus]);

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
      // Expected: Name, DOB, Belt (opt), Weight (opt), Gym (opt)
      const name = cols[0];
      if (!name || name.toLowerCase() === "name") return; // skip header
      const dob = cols[1] || "";
      const belt = cols[2] || "White";
      const weight = parseFloat(cols[3]) || 25;
      const gym = cols[4] || config.gyms[0] || "";
      const gyms = gym.includes("+") ? gym.split("+").map(g => g.trim()) : [gym];
      newKids.push({ id: "K" + String(nextNum++).padStart(3, "0"), name, dob, belt, weight, gyms, active: true });
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
            Paste rows: <b>Name, DOB, Belt, Weight, Gym</b> (tab or comma separated). First row can be a header.
          </div>
          <textarea style={{ ...s.input, height: 100, fontFamily: "monospace", fontSize: 11 }} placeholder={"John Doe\t2017-03-15\tWhite\t28\tJing'An\nJane Smith\t2016-05-20\tGrey\t32\tXuhui"} value={importText} onChange={e => setImportText(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            <button style={s.btnSm} onClick={() => { setShowImport(false); setImportText(""); }}>Cancel</button>
            <button style={s.btn} onClick={parseImport}>Import {importText.trim().split("\n").filter(l => l.trim() && !l.toLowerCase().startsWith("name")).length} kids</button>
          </div>
        </div>
      )}

      <input style={{ ...s.input, marginBottom: 10 }} placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <select style={{ ...s.select, width: "auto", minWidth: 100 }} value={filterGym} onChange={e => setFilterGym(e.target.value)}>
          <option value="">All Gyms</option>
          {config.gyms.map(g => <option key={g}>{g}</option>)}
        </select>
        <Tabs items={["all", "active", "inactive", "overdue"]} active={filterActive} onChange={setFilterActive} />
      </div>

      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>
        {filtered.length} kids{overdueCount > 0 && filterActive !== "overdue" ? ` · ${overdueCount} overdue` : ""}
      </div>

      {filtered.map(kid => {
        const age = ageAt(kid.dob, today());
        const st = kidStatus[kid.id] || {};
        return (
          <div key={kid.id} style={{ ...s.card, opacity: kid.active ? 1 : 0.5, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            onClick={() => onViewProfile(kid.id)}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: C.red + "22", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.red, fontSize: 14, flexShrink: 0 }}>
              {kid.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{kid.name} <span style={{ color: C.textDim, fontWeight: 400, fontSize: 12 }}>{kid.id}</span></div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                {age}y · {kid.weight}kg · {kidGymsStr(kid)}
              </div>
              <div style={{ fontSize: 11, marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                {st.latest ? (
                  <>
                    <span style={{ color: C.textDim }}>Last: {st.latest.date}</span>
                    {st.trend && <span style={{ color: st.trend === "↑" ? C.green : st.trend === "↓" ? "#f44" : C.textDim, fontWeight: 700 }}>{st.trend}</span>}
                    {!st.hasCurrent && kid.active && <span style={{ color: "#f44", fontWeight: 600, fontSize: 10, background: "#f4422a22", padding: "1px 5px", borderRadius: 4 }}>OVERDUE</span>}
                  </>
                ) : (
                  <span style={{ color: "#f44", fontSize: 10, fontWeight: 600 }}>No assessments</span>
                )}
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
        {modal && <KidForm kid={modal === "add" ? { id: nextId(), name: "", dob: "", belt: "White", weight: 25, gyms: [config.gyms[0]], active: true } : modal} config={config} onSave={saveKid} onCancel={() => setModal(null)} />}
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
        <div><label style={s.label}>Gym(s)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {config.gyms.map(g => {
              const selected = (form.gyms || [form.gym]).includes(g);
              return (
                <button key={g} type="button" onClick={() => {
                  const current = form.gyms || [form.gym].filter(Boolean);
                  const next = selected ? current.filter(x => x !== g) : [...current, g];
                  if (next.length > 0) up("gyms", next);
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
        <button style={s.btn} onClick={() => { if (form.name && form.dob) onSave(form); }}>Save</button>
      </div>
    </div>
  );
}
/* ━━━ SCORING SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ScoringScreen({ roster, assessments, setAssessments, config, editingAssessment, setEditingAssessment, loggedCoach, logActivity }) {
  const [step, setStep] = useState(1);
  const [coach, setCoach] = useState((loggedCoach && loggedCoach !== "Admin") ? loggedCoach : coachName(config.coaches[0]) || "");
  const [cycle, setCycle] = useState(config.cycles[1] || config.cycles[0] || "");
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
                {config.cycles.map(c => <option key={c}>{c}</option>)}
              </select>
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
function RankingsScreen({ roster, assessments, config, selections, setSelections }) {
  const [filterCycle, setFilterCycle] = useState(config.cycles[1] || config.cycles[0] || "");
  const [filterAge, setFilterAge] = useState("");
  const [filterWeight, setFilterWeight] = useState("");
  const [filterGym, setFilterGym] = useState("");

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

  const totalSelected = Object.values(selections).flat().length;

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
        <select style={{ ...s.select, width: "auto", minWidth: 80 }} value={filterGym} onChange={e => setFilterGym(e.target.value)}>
          <option value="">All Gyms</option>
          {config.gyms.map(g => <option key={g}>{g}</option>)}
        </select>
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
function ProfileScreen({ roster, assessments, setAssessments, config, selectedKidId, setSelectedKidId, onEditAssessment }) {
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

      {/* Kid Selector - always visible */}
      <div style={{ ...s.card, marginBottom: 14 }}>
        <label style={s.label}>Select a kid</label>
        <select style={s.select} value={selectedKidId || ""} onChange={e => setSelectedKidId(e.target.value)}>
          <option value="">Choose…</option>
          {roster.filter(k => k.active).sort((a, b) => a.name.localeCompare(b.name)).map(k => (
            <option key={k.id} value={k.id}>{k.name} ({kidGymsStr(k)}) — {k.id}</option>
          ))}
        </select>
      </div>

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
            <span style={s.badge(C.blue)}>{age}y · {ac}</span>
            <span style={s.badge(C.orange)}>{kid.weight}kg · {wc}</span>
            <span style={s.badge(kid.active ? C.green : "#e74c3c")}>{kid.active ? "Active" : "Inactive"}</span>
          </div>
        </div>
      )}

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
function ReportingScreen({ roster, assessments, config, onViewProfile, onScore }) {
  const [filterCycle, setFilterCycle] = useState(config.cycles[1] || config.cycles[0] || "");

  const activeKids = roster.filter(k => k.active);
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
  const gyms = config.gyms.map(gym => {
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

      <select style={{ ...s.select, marginBottom: 16, width: "auto", minWidth: 120 }} value={filterCycle} onChange={e => setFilterCycle(e.target.value)}>
        {config.cycles.map(c => <option key={c}>{c}</option>)}
      </select>

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
    </div>
  );
}

/* ━━━ SETTINGS SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function SettingsScreen({ config, setConfig, roster, assessments, setRoster, setAssessments, setSelections, isAdmin }) {
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
    setConfirmReset(false);
  };

  const sections = { coaches: "Coaches", community: "Community", gyms: "Gyms", belts: "Belts", cycles: "Cycles", weights: "Weight Rules", scoring: "Scoring Weights", admin: "Admin", reset: "Reset" };

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
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10 }}>Community members can manage the roster but cannot score kids. All other pages are read-only.</div>
          <div style={s.card}>
            {(config.communityMembers || []).map((m, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: i < (config.communityMembers || []).length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.text, fontSize: 14, fontWeight: 700, flex: 1 }}>{m.name}</span>
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
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input style={{ ...s.input, flex: 1 }} placeholder="New member name…" id="newCommunityInput"
                onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { setConfig(p => ({ ...p, communityMembers: [...(p.communityMembers || []), { name: e.target.value.trim(), pin: "bushido" }] })); e.target.value = ""; }}} />
              <button style={s.btn} onClick={() => { const inp = document.getElementById("newCommunityInput"); if (inp.value.trim()) { setConfig(p => ({ ...p, communityMembers: [...(p.communityMembers || []), { name: inp.value.trim(), pin: "bushido" }] })); inp.value = ""; }}}>Add</button>
            </div>
          </div>
        </div>
      )}
      {section === "gyms" && <ListEditor title="Gyms" items={config.gyms} onChange={v => setConfig(p => ({ ...p, gyms: v }))} />}
      {section === "belts" && <ListEditor title="Belts" items={config.belts} onChange={v => setConfig(p => ({ ...p, belts: v }))} />}
      {section === "cycles" && <ListEditor title="Cycles" items={config.cycles} onChange={v => setConfig(p => ({ ...p, cycles: v }))} />}
      {section === "weights" && <WeightRulesEditor />}
      {section === "scoring" && <ScoringWeightsEditor />}
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
            <p style={{ color: C.textDim, fontSize: 13, marginBottom: 12 }}>Reset all data (roster, assessments, selections, settings) back to the demo defaults.</p>
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
function LoginScreen({ config, onLogin }) {
  const [selectedCoach, setSelectedCoach] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const adminPin = config.adminPin || "pablo1981";
    // Admin entry
    if (selectedCoach === "__admin__") {
      if (pw === adminPin) { onLogin("Admin", "admin"); return; }
      setError("Wrong admin password"); setPw(""); return;
    }
    // Community entry
    if (selectedCoach.startsWith("__community__:")) {
      const cmName = selectedCoach.replace("__community__:", "");
      const cm = (config.communityMembers || []).find(m => m.name === cmName);
      if (!cm) { setError("Member not found"); return; }
      if (pw !== (cm.pin || "bushido")) { setError("Wrong password"); setPw(""); return; }
      onLogin(cmName, "community"); return;
    }
    // Admin bypass: any coach + admin password
    if (selectedCoach && pw === adminPin) { onLogin(selectedCoach, "admin"); return; }
    if (!selectedCoach) { setError("Select a coach"); return; }
    const coachObj = config.coaches.find(c => coachName(c) === selectedCoach);
    if (!coachObj) { setError("Coach not found"); return; }
    const coachPin = coachObj.pin || "bushido";
    if (pw !== coachPin) { setError("Wrong password"); setPw(""); return; }
    onLogin(selectedCoach, "coach");
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 340, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🥋</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, fontWeight: 800, color: C.red, letterSpacing: 3 }}>BUSHIDO</div>
          <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>BJJ Academy Management</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ ...s.label, marginBottom: 6, display: "block" }}>Coach 教练</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {config.coaches.map(c => {
              const name = coachName(c);
              const gym = coachGym(c);
              const active = selectedCoach === name;
              return (
                <button key={name} onClick={() => { setSelectedCoach(name); setError(""); }} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                  background: active ? C.red + "18" : C.card, border: active ? `2px solid ${C.red}` : `1px solid ${C.border}`,
                  color: active ? C.red : C.text, transition: "all 0.15s", textAlign: "left",
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: active ? C.red : C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: active ? "#fff" : C.textDim }}>{name[0]}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{gym}</div>
                  </div>
                  {active && <span style={{ marginLeft: "auto", fontSize: 16 }}>✓</span>}
                </button>
              );
            })}
            <button onClick={() => { setSelectedCoach("__admin__"); setError(""); }} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
              background: selectedCoach === "__admin__" ? C.red + "18" : C.card, border: selectedCoach === "__admin__" ? `2px solid ${C.red}` : `1px solid ${C.border}33`,
              color: selectedCoach === "__admin__" ? C.red : C.textDim, transition: "all 0.15s", textAlign: "left", marginTop: 6,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: selectedCoach === "__admin__" ? C.red : C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: selectedCoach === "__admin__" ? "#fff" : C.textDim }}>👑</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Admin</div>
                <div style={{ fontSize: 11, color: C.textDim }}>All gyms · Full access</div>
              </div>
              {selectedCoach === "__admin__" && <span style={{ marginLeft: "auto", fontSize: 16 }}>✓</span>}
            </button>
            {(config.communityMembers || []).map(m => {
              const key = `__community__:${m.name}`;
              const active = selectedCoach === key;
              return (
                <button key={key} onClick={() => { setSelectedCoach(key); setError(""); }} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                  background: active ? "#64B5F6" + "18" : C.card, border: active ? "2px solid #64B5F6" : `1px solid ${C.border}33`,
                  color: active ? "#64B5F6" : C.textDim, transition: "all 0.15s", textAlign: "left", marginTop: 2,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: active ? "#64B5F6" : C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: active ? "#fff" : C.textDim }}>🤝</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>Community · Roster + View</div>
                  </div>
                  {active && <span style={{ marginLeft: "auto", fontSize: 16 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {selectedCoach && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...s.label, marginBottom: 6, display: "block" }}>Password 密码</label>
            <input style={{ ...s.input, width: "100%", boxSizing: "border-box", fontSize: 16, padding: "12px 14px" }}
              type="password" placeholder="Enter password" value={pw}
              onChange={e => { setPw(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
              autoFocus />
          </div>
        )}

        {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}

        <button onClick={handleLogin} disabled={!selectedCoach} style={{
          ...s.btn, width: "100%", padding: "14px 0", fontSize: 16, fontWeight: 800,
          opacity: selectedCoach ? 1 : 0.4, cursor: selectedCoach ? "pointer" : "default",
        }}>Log In 登录</button>
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
      visual: { type: "flow", items: ["Roster → Score → Rankings → Reports"] },
    },
    { icon: "👥", title: "Roster", titleZh: "学员名册",
      steps: [
        { en: "View all kids in the academy. Use the search bar to find kids by name.", zh: "查看学院所有学员。使用搜索栏按姓名查找。" },
        { en: "Tap '+ Add Kid' to add a new kid manually. Fill in name, DOB, belt, weight, and select one or more gyms.", zh: "点击「+ Add Kid」手动添加学员。填写姓名、出生日期、腰带、体重，并选择一个或多个道馆。" },
        { en: "Tap 'Import' to bulk import from a spreadsheet. Paste rows: Name, DOB, Belt, Weight, Gym (tab or comma separated).", zh: "点击「Import」从表格批量导入。粘贴行数据：姓名、出生日期、腰带、体重、道馆。" },
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
    { icon: "⚙️", title: "Settings", titleZh: "设置",
      steps: [
        { en: "Coaches: add/remove coaches and assign each to a gym.", zh: "教练：添加/删除教练并分配道馆。" },
        { en: "Gyms: add/remove gym locations.", zh: "道馆：添加/删除道馆。" },
        { en: "Belts: manage belt progression order.", zh: "腰带：管理腰带进阶顺序。" },
        { en: "Cycles: define assessment periods (e.g. 2026 H1).", zh: "周期：定义评估周期。" },
        { en: "Scoring Weights: adjust category weights (must total 100%).", zh: "评分权重：调整类别权重（总和100%）。" },
        { en: "Weight Rules: set brackets per age category.", zh: "体重规则：为每个年龄组设置分级。" },
        { en: "Reset: returns to demo data. Deletes everything.", zh: "重置：恢复演示数据。删除所有内容。" },
      ],
      visual: { type: "settings", items: ["Coaches", "Gyms", "Belts", "Cycles", "Weights", "Scoring"] },
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
  const [sortBy, setSortBy] = useState("date"); // date | coach | kid

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
    if (sortBy === "date") filtered.sort((a, b) => b.date.localeCompare(a.date));
    if (sortBy === "coach") filtered.sort((a, b) => a.coach.localeCompare(b.coach) || b.date.localeCompare(a.date));
    if (sortBy === "kid") filtered.sort((a, b) => a.kidName.localeCompare(b.kidName));
    return filtered;
  }, [assessments, roster, config, filterCoach, filterCycle, sortBy]);

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
  const allCoaches = [...new Set(assessments.map(a => a.coach))].sort();
  const maxMonthly = Math.max(...monthlyActivity.map(m => m.total), 1);

  return (
    <div style={s.page}>
      <h1 style={s.h1}>👑 Admin Dashboard</h1>

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
        <select style={{ ...s.select, width: "auto", minWidth: 80 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date">Sort: Date</option>
          <option value="coach">Sort: Coach</option>
          <option value="kid">Sort: Kid</option>
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
const NAV_ITEMS = [
  { key: "roster", icon: "👥", label: "Roster" },
  { key: "score", icon: "📝", label: "Score" },
  { key: "rankings", icon: "🏆", label: "Rank" },
  { key: "reports", icon: "📊", label: "Reports" },
  { key: "profile", icon: "👤", label: "Profile" },
  { key: "settings", icon: "⚙", label: "Settings" },
];

export default function App() {
  const [config, setConfig, configLoaded] = useStorage("bushido:config", DEFAULT_CONFIG);
  const [roster, setRoster, rosterLoaded] = useStorage("bushido:roster", SEED_ROSTER);
  const [assessments, setAssessments, assLoaded] = useStorage("bushido:assessments", null);
  const [selections, setSelections, selLoaded] = useStorage("bushido:selections", {});
  const [tab, setTab] = useState("roster");
  const [showGuide, setShowGuide] = useState(false);
  const [selectedKidId, setSelectedKidId] = useState("");
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [loggedCoach, setLoggedCoach] = useState(null);
  const [role, setRole] = useState(null); // "admin" | "coach" | "community"
  const isAdmin = role === "admin";
  const isCommunity = role === "community";

  const handleLogin = (name, loginRole) => {
    setLoggedCoach(name); setRole(loginRole);
    const entry = { type: "login", coach: name, role: loginRole, time: new Date().toISOString(), ua: navigator.userAgent.slice(0, 100) };
    setConfig(p => ({ ...p, activityLog: [...(p.activityLog || []), entry] }));
  };

  // Initialize seed assessments after load
  useEffect(() => {
    if (assLoaded && assessments === null) {
      setAssessments(generateSeedAssessments());
    }
  }, [assLoaded, assessments]);

  // Ensure config has all required fields (in case of partial storage)
  const safeConfig = useMemo(() => {
    const merged = {
      ...DEFAULT_CONFIG,
      ...config,
      criteria: { ...DEFAULT_CONFIG.criteria, ...(config?.criteria || {}) },
      scoringWeights: { ...DEFAULT_CONFIG.scoringWeights, ...(config?.scoringWeights || {}) },
      weightRules: { ...DEFAULT_CONFIG.weightRules, ...(config?.weightRules || {}) },
    };
    // Migrate string coaches to objects
    if (merged.coaches && merged.coaches.length > 0 && typeof merged.coaches[0] === "string") {
      merged.coaches = merged.coaches.map(c => ({ name: c, gym: "" }));
    }
    return merged;
  }, [config]);

  const safeAssessments = assessments || [];

  const loaded = configLoaded && rosterLoaded && assLoaded && selLoaded;

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
        <button onClick={() => { setLoggedCoach(null); setRole(null); }} style={{
          background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "4px 10px", cursor: "pointer", fontSize: 13, color: C.textDim,
        }}>🚪</button>
      </div>

      {showGuide && <UserGuide onClose={() => setShowGuide(false)} />}

      {/* Content */}
      {tab === "roster" && <RosterScreen roster={roster} setRoster={setRoster} config={safeConfig} assessments={safeAssessments} onViewProfile={viewProfile} />}
      {tab === "score" && !isCommunity && <ScoringScreen roster={roster} assessments={safeAssessments} setAssessments={setAssessments} config={safeConfig} editingAssessment={editingAssessment} setEditingAssessment={setEditingAssessment} loggedCoach={loggedCoach} logActivity={entry => setConfig(p => ({ ...p, activityLog: [...(p.activityLog || []), { ...entry, time: new Date().toISOString() }] }))} />}
      {tab === "score" && isCommunity && <div style={s.page}><h1 style={s.h1}>Score</h1><div style={{ ...s.card, padding: 24, textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div><div style={{ color: C.textDim, fontSize: 13 }}>Scoring is restricted to coaches only.<br/>社区成员无法进行评分。</div></div></div>}
      {tab === "rankings" && <RankingsScreen roster={roster} assessments={safeAssessments} config={safeConfig} selections={selections} setSelections={isCommunity ? () => {} : setSelections} readOnly={isCommunity} />}
      {tab === "reports" && <ReportingScreen roster={roster} assessments={safeAssessments} config={safeConfig} onViewProfile={viewProfile} onScore={isCommunity ? () => {} : (kidId) => { setTab("score"); }} readOnly={isCommunity} />}
      {tab === "profile" && <ProfileScreen roster={roster} assessments={safeAssessments} setAssessments={setAssessments} config={safeConfig} selectedKidId={selectedKidId} setSelectedKidId={setSelectedKidId} onEditAssessment={editAssessment} />}
      {tab === "admin" && isAdmin && <AdminScreen assessments={safeAssessments} roster={roster} config={safeConfig} />}
      {tab === "settings" && <SettingsScreen config={safeConfig} setConfig={setConfig} roster={roster} assessments={safeAssessments} setRoster={setRoster} setAssessments={setAssessments} setSelections={setSelections} isAdmin={isAdmin} />}

      {/* Bottom Nav */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: C.card,
        borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100,
        paddingBottom: "env(safe-area-inset-bottom, 0px)"
      }}>
        {[...NAV_ITEMS.filter(n => !(isCommunity && n.key === "settings")), ...(isAdmin ? [{ key: "admin", icon: "👑", label: "Admin" }] : [])].map(n => (
          <button key={n.key} onClick={() => { setTab(n.key); if (n.key !== "profile") setSelectedKidId(""); if (n.key !== "score") setEditingAssessment(null); }}
            style={{
              flex: 1, padding: "8px 0 6px", background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              color: tab === n.key ? C.red : C.textDim, transition: "color 0.2s"
            }}>
            <span style={{ fontSize: 18 }}>{n.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.3px" }}>{n.label}</span>
            {tab === n.key && <div style={{ width: 16, height: 2, background: C.red, borderRadius: 1, marginTop: 1 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
