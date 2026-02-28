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

/* ━━━ DEFAULT CONFIG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const DEFAULT_CONFIG = {
  coaches:["Saulo","Ahmet","Gui","Jadson"],
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
  {id:"K001",name:"Moneyberg",dob:"2017-03-15",belt:"Grey-Black",weight:30,gym:"Jing'An",active:true},
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
      if (filterGym && k.gym !== filterGym) return false;
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
      newKids.push({ id: "K" + String(nextNum++).padStart(3, "0"), name, dob, belt, weight, gym, active: true });
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
                {age}y · {kid.weight}kg · {kid.gym}
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
        {modal && <KidForm kid={modal === "add" ? { id: nextId(), name: "", dob: "", belt: "White", weight: 25, gym: config.gyms[0], active: true } : modal} config={config} onSave={saveKid} onCancel={() => setModal(null)} />}
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
        <div><label style={s.label}>Gym</label>
          <select style={s.select} value={form.gym} onChange={e => up("gym", e.target.value)}>
            {config.gyms.map(g => <option key={g}>{g}</option>)}
          </select>
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
function ScoringScreen({ roster, assessments, setAssessments, config, editingAssessment, setEditingAssessment }) {
  const [step, setStep] = useState(1);
  const [coach, setCoach] = useState(config.coaches[0] || "");
  const [cycle, setCycle] = useState(config.cycles[1] || config.cycles[0] || "");
  const [kidId, setKidId] = useState("");
  const [scores, setScores] = useState({});
  const [date, setDate] = useState(today());
  const [queue, setQueue] = useState([]); // multi-kid queue
  const [queueIdx, setQueueIdx] = useState(0);

  // If editing, load the assessment
  useEffect(() => {
    if (editingAssessment) {
      setCoach(editingAssessment.coach);
      setCycle(editingAssessment.cycle);
      setKidId(editingAssessment.kidId);
      setScores({ ...editingAssessment.scores });
      setDate(editingAssessment.date);
      setStep(2);
      setQueue([]);
    }
  }, [editingAssessment]);

  const activeKids = roster.filter(k => k.active);
  const kid = roster.find(k => k.id === kidId);
  const allCriteria = Object.values(config.criteria).flat();

  const setScore = (c, v) => setScores(p => ({ ...p, [c]: v }));

  const subtotals = useMemo(() => computeSubtotals(scores, config), [scores, config]);

  const submit = () => {
    if (editingAssessment) {
      setAssessments(prev => prev.map(a => a.id === editingAssessment.id ? { ...a, date, coach, cycle, kidId, scores: { ...scores } } : a));
      reset();
    } else {
      setAssessments(prev => [...prev, { id: uid(), date, coach, cycle, kidId, scores: { ...scores } }]);
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
              <select style={s.select} value={coach} onChange={e => setCoach(e.target.value)}>
                {config.coaches.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {!queue.length && (
              <div><label style={s.label}>Kid</label>
                <select style={s.select} value={kidId} onChange={e => setKidId(e.target.value)}>
                  <option value="">Select kid…</option>
                  {activeKids.map(k => <option key={k.id} value={k.id}>{k.name} ({k.gym})</option>)}
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
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>Tap kids to add to queue:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {activeKids.map(k => {
                  const inQ = queue.includes(k.id);
                  return (
                    <button key={k.id} onClick={() => toggleQueue(k.id)} style={{
                      padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: inQ ? 700 : 400, cursor: "pointer",
                      background: inQ ? C.red + "22" : C.card2, border: inQ ? `2px solid ${C.red}` : `1px solid ${C.border}`,
                      color: inQ ? C.red : C.text, transition: "all 0.1s",
                    }}>
                      {inQ && <span style={{ marginRight: 4 }}>{queue.indexOf(k.id) + 1}.</span>}{k.name}
                    </button>
                  );
                })}
              </div>
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
    if (filterGym && e.kid.gym !== filterGym) return false;
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
          rows.push([e.rank, e.kid.name, e.kidId, e.kid.gym, e.ageCat, e.weightCat, e.kid.belt, e.cycle, e.coach,
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
                  <div style={{ fontSize: 11, color: C.textDim }}>{e.kid.gym} · {e.coach}</div>
                </div>
                <div style={{ textAlign: "right", marginRight: 6 }}>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>{fmt(e.final)}</div>
                  <ScoreBar value={e.final} color={C.red} />
                </div>
                <button onClick={() => toggleSelection(e.kidId, e.cycle, bracket)} style={{
                  width: 36, height: 36, borderRadius: 18, border: sel ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                  background: sel ? C.green + "22" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: sel ? C.green : C.textDim, flexShrink: 0
                }}>
                  {sel ? "✓" : "○"}
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
      `Kid: ${kid2?.name} (${a.kidId}) | Age: ${ageAt(kid2?.dob, a.date)} | ${kid2?.weight}kg | ${kid2?.gym}`,
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
            const w = window.open("", "_blank");
            w.document.write(`<!DOCTYPE html><html><head><title>${kid.name} - Progress Report</title>
<style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#1a1a1a}
h1{color:#C41E3A;font-size:24px;margin-bottom:4px}h2{font-size:16px;color:#C41E3A;margin-top:20px;border-bottom:2px solid #C41E3A;padding-bottom:4px}
.meta{color:#666;font-size:13px;margin-bottom:16px}.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;margin-right:6px}
table{width:100%;border-collapse:collapse;margin:10px 0}td,th{padding:8px 10px;text-align:left;border-bottom:1px solid #eee;font-size:13px}
th{background:#f5f5f5;font-weight:700}.score{font-size:20px;font-weight:900;color:#C41E3A;text-align:center;margin:10px 0}
.bar{height:6px;border-radius:3px;margin-top:4px}.footer{margin-top:30px;text-align:center;color:#999;font-size:11px}
@media print{body{padding:0}}</style></head><body>
<h1>🥋 ${kid.name}</h1>
<div class="meta">${kid.id} · ${kid.gym} · ${kid.belt} Belt · ${ageAt(kid.dob, today())}y · ${kid.weight}kg</div>
${sub ? `<h2>Latest Assessment — ${latest.date} (${latest.cycle})</h2>
<p class="meta">Coach: ${latest.coach}</p>
<div class="score">${fmt(sub.final)} / 5.00</div>
<table><tr><th>Category</th><th>Score</th><th>Details</th></tr>
${Object.entries(config.criteria).map(([cat, crits]) =>
  `<tr><td><b>${cat}</b> (${(config.scoringWeights[cat]*100).toFixed(0)}%)</td><td><b>${fmt(sub[cat])}</b></td><td>${crits.map(c => `${c}: ${latest.scores[c]}`).join(", ")}</td></tr>`
).join("")}</table>` : "<p>No assessments yet.</p>"}
${kidAssessments.length > 1 ? `<h2>History</h2><table><tr><th>Date</th><th>Cycle</th><th>Coach</th><th>Score</th></tr>
${kidAssessments.map(a => { const s2 = computeSubtotals(a.scores, config); return `<tr><td>${a.date}</td><td>${a.cycle}</td><td>${a.coach}</td><td><b>${fmt(s2.final)}</b></td></tr>`; }).join("")}</table>` : ""}
<div class="footer">Bushido BJJ Academy — Progress Report — Generated ${today()}</div>
<script>window.print();</script></body></html>`);
            w.document.close();
          }}>📄 Export PDF</button>}
          {kid && <button style={s.btnSm} onClick={() => setSelectedKidId("")}>← Back</button>}
        </div>
      </div>

      {/* Kid Selector - always visible */}
      <div style={{ ...s.card, marginBottom: 14 }}>
        <label style={s.label}>Select a kid</label>
        <select style={s.select} value={selectedKidId || ""} onChange={e => setSelectedKidId(e.target.value)}>
          <option value="">Choose…</option>
          {roster.filter(k => k.active).sort((a, b) => a.name.localeCompare(b.name)).map(k => (
            <option key={k.id} value={k.id}>{k.name} ({k.gym}) — {k.id}</option>
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
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{kid.id} · {kid.gym}</div>
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
    const gKids = activeKids.filter(k => k.gym === gym);
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
    if (!overdueByGym[k.gym]) overdueByGym[k.gym] = [];
    overdueByGym[k.gym].push(k);
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
function SettingsScreen({ config, setConfig, roster, assessments, setRoster, setAssessments, setSelections }) {
  const [section, setSection] = useState("coaches");

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

  const sections = { coaches: "Coaches", gyms: "Gyms", belts: "Belts", cycles: "Cycles", weights: "Weight Rules", scoring: "Scoring Weights", reset: "Reset" };

  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Settings</h1>
        <PageHelp page="settings" />
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
        {Object.entries(sections).map(([key, label]) => (
          <button key={key} onClick={() => setSection(key)} style={{
            padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600,
            background: section === key ? C.red : C.card2, color: section === key ? "#fff" : C.textDim, cursor: "pointer"
          }}>{label}</button>
        ))}
      </div>

      {section === "coaches" && <ListEditor title="Coaches" items={config.coaches} onChange={v => setConfig(p => ({ ...p, coaches: v }))} />}
      {section === "gyms" && <ListEditor title="Gyms" items={config.gyms} onChange={v => setConfig(p => ({ ...p, gyms: v }))} />}
      {section === "belts" && <ListEditor title="Belts" items={config.belts} onChange={v => setConfig(p => ({ ...p, belts: v }))} />}
      {section === "cycles" && <ListEditor title="Cycles" items={config.cycles} onChange={v => setConfig(p => ({ ...p, cycles: v }))} />}
      {section === "weights" && <WeightRulesEditor />}
      {section === "scoring" && <ScoringWeightsEditor />}
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
  const [selectedKidId, setSelectedKidId] = useState("");
  const [editingAssessment, setEditingAssessment] = useState(null);

  // Initialize seed assessments after load
  useEffect(() => {
    if (assLoaded && assessments === null) {
      setAssessments(generateSeedAssessments());
    }
  }, [assLoaded, assessments]);

  // Ensure config has all required fields (in case of partial storage)
  const safeConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...config,
    criteria: { ...DEFAULT_CONFIG.criteria, ...(config?.criteria || {}) },
    scoringWeights: { ...DEFAULT_CONFIG.scoringWeights, ...(config?.scoringWeights || {}) },
    weightRules: { ...DEFAULT_CONFIG.weightRules, ...(config?.weightRules || {}) },
  }), [config]);

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

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", WebkitFontSmoothing: "antialiased" }}>

      {/* Top Bar */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 100 }}>
        <span style={{ fontSize: 22 }}>🥋</span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, fontWeight: 800, color: C.red, letterSpacing: 2 }}>BUSHIDO</span>
        <span style={{ fontSize: 11, color: C.textDim, marginLeft: "auto" }}>BJJ Academy</span>
      </div>

      {/* Content */}
      {tab === "roster" && <RosterScreen roster={roster} setRoster={setRoster} config={safeConfig} assessments={safeAssessments} onViewProfile={viewProfile} />}
      {tab === "score" && <ScoringScreen roster={roster} assessments={safeAssessments} setAssessments={setAssessments} config={safeConfig} editingAssessment={editingAssessment} setEditingAssessment={setEditingAssessment} />}
      {tab === "rankings" && <RankingsScreen roster={roster} assessments={safeAssessments} config={safeConfig} selections={selections} setSelections={setSelections} />}
      {tab === "reports" && <ReportingScreen roster={roster} assessments={safeAssessments} config={safeConfig} onViewProfile={viewProfile} onScore={(kidId) => { setTab("score"); }} />}
      {tab === "profile" && <ProfileScreen roster={roster} assessments={safeAssessments} setAssessments={setAssessments} config={safeConfig} selectedKidId={selectedKidId} setSelectedKidId={setSelectedKidId} onEditAssessment={editAssessment} />}
      {tab === "settings" && <SettingsScreen config={safeConfig} setConfig={setConfig} roster={roster} assessments={safeAssessments} setRoster={setRoster} setAssessments={setAssessments} setSelections={setSelections} />}

      {/* Bottom Nav */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: C.card,
        borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100,
        paddingBottom: "env(safe-area-inset-bottom, 0px)"
      }}>
        {NAV_ITEMS.map(n => (
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
