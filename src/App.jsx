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
    if (rec && !rec.init) return rec;
    return null;
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

/* ━━━ ROSTER SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function RosterScreen({ roster, setRoster, config, onViewProfile }) {
  const [search, setSearch] = useState("");
  const [filterGym, setFilterGym] = useState("");
  const [filterActive, setFilterActive] = useState("active");
  const [modal, setModal] = useState(null); // null | "add" | kid object

  const filtered = useMemo(() => {
    return roster.filter(k => {
      if (search && !k.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGym && k.gym !== filterGym) return false;
      if (filterActive === "active" && !k.active) return false;
      if (filterActive === "inactive" && k.active) return false;
      return true;
    });
  }, [roster, search, filterGym, filterActive]);

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

  return (
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Roster</h1>
        <button style={s.btn} onClick={() => setModal("add")}>+ Add Kid</button>
      </div>

      <input style={{ ...s.input, marginBottom: 10 }} placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <select style={{ ...s.select, width: "auto", minWidth: 100 }} value={filterGym} onChange={e => setFilterGym(e.target.value)}>
          <option value="">All Gyms</option>
          {config.gyms.map(g => <option key={g}>{g}</option>)}
        </select>
        <Tabs items={["all", "active", "inactive"]} active={filterActive} onChange={setFilterActive} />
      </div>

      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>{filtered.length} kids</div>

      {filtered.map(kid => {
        const age = ageAt(kid.dob, today());
        return (
          <div key={kid.id} style={{ ...s.card, opacity: kid.active ? 1 : 0.5, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            onClick={() => onViewProfile(kid.id)}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: C.red + "22", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.red, fontSize: 14, flexShrink: 0 }}>
              {kid.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{kid.name} <span style={{ color: C.textDim, fontWeight: 400, fontSize: 12 }}>{kid.id}</span></div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                {age}y · {kid.weight}kg · {kid.gym}
              </div>
            </div>
            <BeltBadge belt={kid.belt} />
            <button style={{ ...s.btnSm, padding: "4px 8px" }} onClick={e => { e.stopPropagation(); setModal(kid); }}>Edit</button>
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

  // If editing, load the assessment
  useEffect(() => {
    if (editingAssessment) {
      setCoach(editingAssessment.coach);
      setCycle(editingAssessment.cycle);
      setKidId(editingAssessment.kidId);
      setScores({ ...editingAssessment.scores });
      setDate(editingAssessment.date);
      setStep(2);
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
    } else {
      setAssessments(prev => [...prev, { id: uid(), date, coach, cycle, kidId, scores: { ...scores } }]);
    }
    reset();
  };

  const reset = () => {
    setStep(1); setScores({}); setKidId(""); setEditingAssessment(null);
  };

  const ScoreSelector = ({ criterion, value }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 13, color: C.text, marginBottom: 6, fontWeight: 500 }}>{criterion}</div>
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

  if (step === 1) {
    return (
      <div style={s.page}>
        <h1 style={s.h1}>{editingAssessment ? "Edit Assessment" : "New Assessment"}</h1>
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
            <div><label style={s.label}>Kid</label>
              <select style={s.select} value={kidId} onChange={e => setKidId(e.target.value)}>
                <option value="">Select kid…</option>
                {activeKids.map(k => <option key={k.id} value={k.id}>{k.name} ({k.gym})</option>)}
              </select>
            </div>
          </div>
          {kid && (
            <div style={{ marginTop: 12, padding: 10, background: C.card2, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <BeltBadge belt={kid.belt} />
              <span style={{ color: C.text, fontSize: 13 }}>{kid.name} · {ageAt(kid.dob, date)}y · {kid.weight}kg</span>
            </div>
          )}
          <button style={{ ...s.btn, width: "100%", marginTop: 14, opacity: kidId ? 1 : 0.4 }} disabled={!kidId} onClick={() => setStep(2)}>
            Start Scoring →
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
          {editingAssessment ? "Update" : "Submit"} ✓
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
      <h1 style={s.h1}>Rankings</h1>

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Profile</h1>
        {kid && <button style={s.btnSm} onClick={() => setSelectedKidId("")}>← Back</button>}
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
      <h1 style={s.h1}>Settings</h1>
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
  { key: "rankings", icon: "🏆", label: "Rankings" },
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
      {tab === "roster" && <RosterScreen roster={roster} setRoster={setRoster} config={safeConfig} onViewProfile={viewProfile} />}
      {tab === "score" && <ScoringScreen roster={roster} assessments={safeAssessments} setAssessments={setAssessments} config={safeConfig} editingAssessment={editingAssessment} setEditingAssessment={setEditingAssessment} />}
      {tab === "rankings" && <RankingsScreen roster={roster} assessments={safeAssessments} config={safeConfig} selections={selections} setSelections={setSelections} />}
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
