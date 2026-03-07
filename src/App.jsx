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
  // Scorable once the last month of the quarter begins (March, June, Sep, Dec)
  const lastMonthStart = { 1: `${yr}-03-01`, 2: `${yr}-06-01`, 3: `${yr}-09-01`, 4: `${yr}-12-01` };
  return today() >= lastMonthStart[q];
};
const getActiveScoringCycle = (cycles) => {
  const now = new Date();
  const m = now.getMonth(); // 0-based
  const y = now.getFullYear();
  // Early window: last month of quarter (scoring just opened)
  const earlyMap = { 2: [1, 0], 5: [2, 0], 8: [3, 0], 11: [4, 0] };
  // Due window: two months after quarter ended
  const dueMap = { 3: [1, 0], 4: [1, 0], 6: [2, 0], 7: [2, 0], 9: [3, 0], 10: [3, 0], 0: [4, -1], 1: [4, -1] };
  if (earlyMap[m] !== undefined) {
    const [q, yo] = earlyMap[m];
    const c = `${y + yo} Q${q}`;
    if (cycles.includes(c)) return { cycle: c, phase: "early" };
  }
  if (dueMap[m] !== undefined) {
    const [q, yo] = dueMap[m];
    const c = `${y + yo} Q${q}`;
    if (cycles.includes(c)) return { cycle: c, phase: "due" };
  }
  return null;
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
  retentionRules: { coldAfterDays: 14, churnAfterDays: 60, coolingFromWeekly: 2, coolingToWeekly: 1, newWindowDays: 60, newMinWeekly: 2, contactSnoozeDays: 14 },
  contactLog: [],
  classTypes:[
    {id:"group1",name:"Kids Fundamentals",category:"group",color:"#4CAF50"},
    {id:"group2",name:"Kids Advanced",category:"group",color:"#2196F3"},
    {id:"comp",name:"Competition Training",category:"competition",color:"#FF9800"},
    {id:"pt",name:"Private / PT",category:"private",color:"#9C27B0"},
  ],
  weeklySchedule:[],
  criteria:{
    BJJ:["Standup","Top Game","Bottom Game","Submission","Defense"],
    Athletic:["Strength","Cardio","Coordination"],
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
    "Knows 1 takedown but only works with a partner who doesn\u2019t resist. No grip fighting. Loses balance easily.",
    "Can do 1\u20132 takedowns in sparring sometimes. Starts to use grips but doesn\u2019t fight for them. Keeps balance under light pressure. Easy to predict.",
    "Does 2\u20133 takedowns with one clear favorite. Fights for grips and breaks opponent\u2019s grips. Keeps balance under pressure. Starts to read opponent\u2019s movement.",
    "Connects 2+ takedowns together (if first one fails, goes to the next). Good grip fighting both ways. Hard to take down. Works from both sides.",
    "Controls the standup. Uses grips to create openings. Chains 3+ attacks. Defends takedowns and counters right away. Best standup in their bracket.",
  ],
  "Top Game": [
    "Can hold side control or mount if partner stays still. No guard passing. No pressure. Gets reversed easily.",
    "Holds top positions under some resistance. Knows 1 guard pass but doesn\u2019t finish it often. Starting to use body weight.",
    "Can finish 1\u20132 guard passes regularly. Holds top positions under resistance. Moves to a better position when the chance is there (e.g. side control \u2192 mount).",
    "Passes guard consistently with 2\u20133 techniques. Moves between positions smoothly. Uses pressure well. Starts attacking from top.",
    "Very hard to escape from. Reacts to escapes quickly. Multiple ways to pass. Controls the pace from top. Best top game in their bracket.",
  ],
  "Bottom Game": [
    "Lies flat with no movement. No frames, no guard. Gets passed and held down with no response.",
    "Can hold closed guard. Starting to use hips to move. Knows 1 sweep or submission from bottom but rarely finishes. Tries to recover guard when passed but usually too late.",
    "Has 1\u20132 sweeps and 1\u20132 submissions from guard. Uses frames and hip escapes. Recovers guard sometimes after being passed.",
    "Has a preferred guard with 2\u20133 options (sweeps and submissions). Recovers guard quickly when passed. Starting to chain attacks together.",
    "Plays 2\u20133 guards well. Chains attacks constantly. Strong guard retention. Dangerous with both sweeps and submissions, attacks both sides. Best bottom game in their bracket.",
  ],
  "Submission": [
    "Knows 1\u20132 submissions but can\u2019t finish them in sparring. No control before attacking. Telegraphs everything.",
    "Can finish 1\u20132 submissions against similar-level partners. Needs a good position first. Doesn\u2019t try again if the first attempt fails.",
    "Finishes 2\u20133 submissions from different positions. Starting to recognize when a submission is available. Tries again if the first attempt fails.",
    "Attacks submissions in combinations. Good control before finishing. Moves to the next option when one fails.",
    "Submits from anywhere (top, bottom, back). Reads opponent\u2019s reactions and adjusts. Chains 3+ attacks together. Best finisher in their bracket.",
  ],
  "Defense": [
    "Panics under pressure. No escapes. Taps to positions instead of submissions. Doesn\u2019t try to improve position.",
    "Knows 1 escape but timing is usually wrong. Stays calm enough to try but rarely gets out. Recognizes bad positions.",
    "Escapes most bad positions against similar-level partners. Recognizes submission danger early. Stays calm under pressure.",
    "Hard to submit. Escapes and moves to a better position right away. Comfortable even in bad spots. Rarely makes the same mistake twice.",
    "Turns defense into offense. Escapes lead directly into attacks or better positions. Very hard to hold down or submit. Best defensive game in their bracket.",
  ],
  "Strength": [
    "Much weaker than others in their age/weight. Can\u2019t hold frames or resist pressure. Gets moved around easily.",
    "Below average for their age/weight. Holds positions briefly but loses them under pressure. Struggles to create space.",
    "Average strength for their age/weight. Can hold positions and apply decent pressure. Holds frames when needed.",
    "Above average. Strong frames, heavy pressure, hard to move. Creates problems with physicality.",
    "Strongest in their age/weight bracket. Clear physical advantage in most exchanges. Explosive when needed.",
  ],
  "Cardio": [
    "Gets tired in the first minute. Stops trying when tired. Technique disappears quickly.",
    "Can keep going for one round but slows down a lot. Technique gets worse when tired. Needs long breaks between rounds.",
    "Keeps a good pace for a full round. Some drop-off in the second or third round but still tries.",
    "Strong across multiple rounds. Technique stays solid when tired. Can push the pace on others.",
    "Outlasts everyone. No visible drop-off across a full session. Can increase intensity late in rounds. Best engine in their bracket.",
  ],
  "Coordination": [
    "Movements are awkward and disconnected. Poor balance. Can\u2019t combine two movements together (e.g. shrimp then turn to knees). Falls over easily during transitions.",
    "Basic movements are okay but slow. Can follow a technique step by step but not smoothly. Loses balance during fast exchanges.",
    "Moves well for their age. Connects movements together without stopping. Good balance during sparring. Learns new techniques at a normal pace.",
    "Smooth and controlled movements. Good body awareness \u2014 knows where they are in space. Picks up new techniques quickly. Rarely off-balance.",
    "Moves like a natural athlete. Everything looks effortless. Excellent balance and body awareness. Learns new movements faster than anyone in their bracket.",
  ],
  "Attendance": [
    "Comes less than once a week. Misses many weeks entirely. No consistency.",
    "Comes about once a week. Often skips weeks. Hard to build on previous classes.",
    "Comes 2 times a week consistently. Rarely misses without a reason.",
    "Comes 3+ times a week. Very consistent. Does PT sessions on top of group classes.",
    "Never misses. Comes to everything \u2014 group classes, PT, extra sessions, open mats. Best attendance in the team.",
  ],
  "Attitude": [
    "Doesn\u2019t listen. Distracted or disruptive during class. Negative energy that affects training partners.",
    "Listens but passive. Low energy. Needs to be reminded often to focus. Does the minimum.",
    "Good training partner. Follows instructions. Positive attitude. Tries hard during drills and sparring.",
    "Enthusiastic and focused. Asks questions. Encourages teammates. Applies corrections right away.",
    "Model student. Helps younger or newer kids. Brings energy to every session. Embodies martial arts values on and off the mat.",
  ],
  "Participation": [
    "Refuses to compete or gets very upset about it. No competition experience.",
    "Has competed 1\u20132 times but needs a lot of encouragement. Very nervous before and during matches.",
    "Willing to compete when asked. Has done 3\u20135 competitions. Manages nerves okay.",
    "Wants to compete. Signs up without being asked. Competes regularly. Handles the pressure well.",
    "Loves competing. Seeks out tournaments and travels to compete. Always ready mentally. Best competitor mindset in the team.",
  ],
  "Performance": [
    "Freezes during matches. Can\u2019t do any of the techniques they know in training. Big gap between training and competition.",
    "Competes but goes into survival mode. Forgets gameplan. Only uses strength or instinct, not technique.",
    "Can execute a basic gameplan. Wins some, loses some. Performs at about 60\u201370% of their training level.",
    "Performs close to training level. Follows gameplan consistently. Wins most matches. Stays composed when losing.",
    "Elevates under pressure. Adapts mid-match to the opponent. Podiums consistently. Best performer in their bracket.",
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
      if (key === "bushido:assessments" && _deletedKidIds.size > 0) {
        const filtered = rec.filter(a => !a.kidId || !_deletedKidIds.has(a.kidId));
        return filtered.length > 0 ? filtered : null;
      }
      return rec;
    }
    if (rec.init && Object.keys(rec).length === 1) return null;
    return rec;
  } catch { return null; }
}

let saveTimers = {};
const _deletedKidIds = new Set();

/* ━━━ CLOUDINARY IMAGE UPLOAD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const CLOUDINARY_CLOUD = "dzghquzxw";
const CLOUDINARY_PRESET = "bushido";
async function uploadPhoto(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url;
}
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

async function binWriteNow(key, value) {
  const id = BIN_IDS[key];
  if (!id) return;
  clearTimeout(saveTimers[key]);
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_KEY },
      body: JSON.stringify(value),
    });
  } catch (e) { console.warn("JSONBin immediate write failed:", key, e); }
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
  const saveNow = useCallback((v) => {
    const next = typeof v === "function" ? v(valRef.current) : v;
    setVal(next);
    valRef.current = next;
    binWriteNow(key, next);
    return next;
  }, [key]);
  return [val, save, loaded, saveNow];
}

/* ━━━ PROMOTION PROJECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function computePromoProjection(kid, attendance, config) {
  const rules = config.promotionRules || { stripeClasses: 10, beltClasses: 40, beltMonths: 9, stripesForBelt: 4 };
  const lastPromo = kid.lastPromotionDate || kid.joinDate || "2020-01-01";
  const stripes = kid.stripes || 0;
  const classesDone = (attendance || []).filter(r => r.date > lastPromo && r.records?.[kid.id] === "attend").length + (kid.classCountOffset || 0);

  // Weekly avg from 90-day window
  const d90 = new Date(); d90.setDate(d90.getDate() - 90);
  const cutoff90 = d90.toISOString().slice(0, 10);
  const att90 = (attendance || []).filter(r => r.date >= cutoff90 && r.records?.[kid.id] === "attend").length;
  const weeks90 = Math.max(1, Math.round(90 / 7));
  const weeklyAvg = att90 / weeks90;

  const monthsSince = () => {
    const d = new Date(lastPromo);
    const now = new Date();
    return (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
  };

  const addWeeks = (w) => { const d = new Date(); d.setDate(d.getDate() + Math.ceil(w * 7)); return d.toISOString().slice(0, 10); };
  const addMonths = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };

  const beltIdx = (config.belts || []).indexOf(kid.belt);
  const hasNextBelt = beltIdx >= 0 && beltIdx < (config.belts || []).length - 1;
  const nextBelt = hasNextBelt ? config.belts[beltIdx + 1] : null;
  const maxStripes = rules.stripesForBelt || 4;

  const months = monthsSince();

  // No next belt — at highest rank
  if (!hasNextBelt) {
    return { type: "complete", gates: [], projectedDate: null, weeklyAvg, classesDone, lastPromo, stripes, nextBelt: null };
  }

  // Always project toward belt promotion
  const classesNeeded = Math.max(0, (rules.beltClasses || 40) - classesDone);
  const monthsNeeded = Math.max(0, (rules.beltMonths || 9) - months);
  const stripesNeeded = Math.max(0, maxStripes - stripes);

  // Project stripe completion: remaining stripes × stripeClasses, minus surplus classes beyond current stripe threshold
  const classesForAllStripes = maxStripes * (rules.stripeClasses || 10);
  const stripeClassesRemaining = Math.max(0, classesForAllStripes - classesDone);
  const stripeDate = weeklyAvg > 0 && stripeClassesRemaining > 0 ? addWeeks(stripeClassesRemaining / weeklyAvg) : (stripeClassesRemaining <= 0 ? today() : null);

  const classDate = weeklyAvg > 0 && classesNeeded > 0 ? addWeeks(classesNeeded / weeklyAvg) : (classesNeeded <= 0 ? today() : null);
  const monthDate = monthsNeeded > 0 ? addMonths(monthsNeeded) : today();

  // Hide "Time at belt" if no real promotion date on record
  const hasRealPromoDate = kid.lastPromotionDate && kid.lastPromotionDate !== "2020-01-01" && kid.lastPromotionDate !== kid.joinDate;
  const gates = [
    { label: "Classes", labelZh: "课时", current: classesDone, required: rules.beltClasses || 40, done: classesNeeded <= 0 },
    ...(hasRealPromoDate ? [{ label: "Time at belt", labelZh: "腰带时间", current: months, required: rules.beltMonths || 9, unit: "mo", done: monthsNeeded <= 0 }] : []),
    { label: "Stripes", labelZh: "条纹", current: stripes, required: maxStripes, done: stripesNeeded <= 0 },
  ];

  // Projected date = latest of all gates. If can't project any class-based gate, return null.
  const canProject = weeklyAvg > 0 || (classesNeeded <= 0 && stripeClassesRemaining <= 0);
  const dates = canProject ? [classDate, ...(hasRealPromoDate ? [monthDate] : []), stripeDate].filter(Boolean) : [];
  const projectedDate = dates.length > 0 ? dates.sort().pop() : null;

  return { type: "belt", gates, projectedDate, weeklyAvg, classesDone, lastPromo, stripes, nextBelt, maxStripes };
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

function KidAvatar({ kid, size = 40, rounded = true }) {
  const beltColor = BELT_HEX[kid.belt] || "#888";
  const isLight = ["White", "Yellow-White", "Yellow", "Grey-White"].some(b => (kid.belt || "").includes(b));
  const parts = (kid.name || "").split(/\s+/).filter(p => /^[A-Za-z]/.test(p));
  const initials = parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0]?.[0] || "?";
  const radius = rounded ? "50%" : 10;
  if (kid.photoUrl) {
    return <img src={kid.photoUrl} alt="" style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: `linear-gradient(135deg, ${beltColor}cc, ${beltColor}88)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 800, color: isLight ? "#333" : "#fff",
      textTransform: "uppercase", letterSpacing: 1,
    }}>{initials}</div>
  );
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
    en: "Your launchpad. Tile shortcuts to every module with live badges showing pending actions (unrecorded classes, overdue assessments, promotion-ready kids, outreach needed). Below: quick pulse metrics and recent activity feed.",
    zh: "快捷入口。每个模块的磁贴显示待处理事项（未记录的课程、逾期评估、可晋级学员、需联系家长）。下方：关键指标概览及近期活动。",
  },
  roster: {
    en: "Manage all kids in the academy. Add kids manually or bulk import from CSV. Edit belt, weight, gym, or set inactive. Cards show last assessment date, score trend (↑↓→), and overdue status. Gym filter: admins can toggle between gyms or view all; coaches/community see their assigned gym only.",
    zh: "管理学院所有学员。可手动添加或CSV批量导入。编辑腰带、体重、道馆或设为不活跃。卡片显示上次评估日期、趋势及逾期状态。道馆筛选：管理员可切换或查看全部，教练/社区仅显示所属道馆。",
  },
  score: {
    en: "Score assessments across 12 criteria in 4 categories: BJJ (40%), Athletic (20%), Commitment (20%), Competition (20%). Tap ? next to each criterion for guidelines. Score one kid or use 'Score multiple kids' to queue them. Kid list is filtered to the selected coach's gym. Coach assessments are submitted as 'Pending' for Master Coach/Admin approval before appearing in rankings and reports. Master Coach and Admin assessments are auto-approved.",
    zh: "12项标准评分，4个类别：柔术(40%)、体能(20%)、投入度(20%)、比赛(20%)。点击?查看评分指南。可逐个或批量评分。学员列表按教练所属道馆筛选。教练评估需主教练/管理员审批后才会显示在排名和报告中。主教练和管理员评估自动通过。",
  },
  rankings: {
    en: "Ranked kids by cycle, age, weight, and gym. Based on latest assessment score per kid per cycle. Tap circle to select for competition team. Admin can filter across all gyms; coaches see their gym. Export as CSV for Excel.",
    zh: "按周期、年龄、体重和道馆排名。基于每周期最新评估成绩。点击圆圈选择参赛队员。管理员可跨道馆筛选，教练仅查看本道馆。可导出CSV。",
  },
  reports: {
    en: "Three report views. OVERVIEW: academy-wide KPIs, gym comparison table, and weekly attendance trend. GYM: deep dive into one location — roster composition, class fill rates, score distribution, category strengths, assessment coverage, and competition team. OUTREACH: actionable retention lists — gone cold (14+ days), cooling off (declining attendance), new & fragile (recent joiners not yet consistent), plus positive outreach triggers (promotions ready, big score jumps).",
    zh: "三个报告视图。概览：全校关键指标、道馆对比表、每周出勤趋势。道馆：单个校区深度分析——学员构成、课程出勤率、成绩分布、类别优劣势、评估覆盖率及竞赛队。外展：可操作的留存清单——流失风险（14天以上未到）、降温（出勤下降）、新生脆弱期（近期加入但不稳定），以及正面沟通触发（晋级就绪、成绩大幅提升）。",
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
    en: "Manage class attendance with 3 sub-tabs. SCHEDULE: View the weekly class timetable. RECORD: Select date and gym, see scheduled classes auto-populated. Tap a class card to mark attendance. Group: tap to toggle Absent ↔ Present. Competition: Absent → Present → Missed. Use '+ PT' for ad-hoc sessions. HISTORY: Browse past sessions with creator/editor info. Class analytics are in the Reports tab.",
    zh: "管理课程出勤，包含3个子标签。课表：查看每周课程安排。记录：选择日期和道馆，查看自动填充的课程。点击课程卡标记出勤。小组课：切换缺席↔出勤。竞赛课：缺席→出勤→缺课。使用「+ PT」添加临时课程。历史：浏览历史记录及创建/编辑者信息。课程分析在报告标签中。",
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

/* ━━━ HOME SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function HomeScreen({ roster, attendance, assessments, config, selections, loggedCoach, loggedGym, isAdmin, isCommunity, pendingCount, onNavigate }) {
  const [pressed, setPressed] = useState(null);
  const [gymFilter, setGymFilter] = useState(isAdmin ? null : (loggedGym || null));
  const activeKids = roster.filter(k => k.active);
  const gymKids = activeKids.filter(k => !gymFilter || kidInGym(k, gymFilter));
  const schedule = config.weeklySchedule || [];
  const classTypes = config.classTypes || [];
  const nowDate = new Date();

  // ── Badge computations ──

  // Classes: yesterday's scheduled classes not yet recorded
  const todayStr = today();
  const yDate = new Date(nowDate); yDate.setDate(yDate.getDate() - 1);
  const yesterdayStr = yDate.toISOString().slice(0, 10);
  const yesterdayDow = yDate.getDay();
  const yesterdaySlots = schedule.filter(sl => sl.day === yesterdayDow && (!gymFilter || sl.gym === gymFilter));
  const yesterdayRecords = (attendance || []).filter(r => r.date === yesterdayStr);
  const unrecordedClasses = yesterdaySlots.filter(slot => {
    const recKey = `${yesterdayStr}|${slot.time}|${slot.classTypeId}|${slot.gym}`;
    const record = yesterdayRecords.find(r => r.key === recKey);
    return !record || Object.keys(record.records || {}).length === 0;
  }).length;

  // Score: overdue assessments
  const currentCycle = (getActiveScoringCycle(config.cycles)?.cycle) || config.cycles.filter(c => isQuarterClosed(c)).slice(-1)[0] || config.cycles[0] || "";
  const cycleAss = assessments.filter(a => a.cycle === currentCycle);
  const assessedIds = new Set();
  cycleAss.forEach(a => assessedIds.add(a.kidId));
  const overdueCount = gymKids.filter(k => !assessedIds.has(k.id)).length;

  // Promotions: ready count
  const rules = config.promotionRules || { stripeClasses: 10, beltClasses: 40, beltMonths: 9, stripesForBelt: 4 };
  const promoCount = gymKids.filter(kid => {
    const stripes = kid.stripes || 0;
    const lastPromo = kid.lastPromotionDate || kid.joinDate || "2020-01-01";
    const classes = (attendance || []).filter(r => r.date > lastPromo && r.records?.[kid.id] === "attend").length + (kid.classCountOffset || 0);
    const beltIdx = config.belts.indexOf(kid.belt);
    const hasNextBelt = beltIdx < config.belts.length - 1;
    const dp = new Date(lastPromo);
    const months = (nowDate.getFullYear() - dp.getFullYear()) * 12 + nowDate.getMonth() - dp.getMonth();
    const stripeReady = stripes < (rules.stripesForBelt || 4) && classes >= (rules.stripeClasses || 10);
    const beltReady = hasNextBelt && stripes >= (rules.stripesForBelt || 4) && classes >= (rules.beltClasses || 40) && months >= (rules.beltMonths || 9);
    return stripeReady || beltReady;
  }).length;

  // Reports outreach: gone cold + cooling off
  const ret = config.retentionRules || { coldAfterDays: 14, churnAfterDays: 60, coolingFromWeekly: 2, coolingToWeekly: 1 };
  const d90 = new Date(); d90.setDate(d90.getDate() - 90);
  const cutoff90 = d90.toISOString().slice(0, 10);
  const att90 = (attendance || []).filter(r => r.date >= cutoff90);
  const weeks90 = Math.max(1, Math.round(90 / 7));
  const lastAtt = {};
  (attendance || []).filter(r => !gymFilter || r.gym === gymFilter).forEach(r => {
    Object.entries(r.records || {}).forEach(([kidId, status]) => {
      if (status === "attend" && (!lastAtt[kidId] || r.date > lastAtt[kidId])) lastAtt[kidId] = r.date;
    });
  });
  const dCold = new Date(); dCold.setDate(dCold.getDate() - (ret.coldAfterDays || 14));
  const cutoffCold = dCold.toISOString().slice(0, 10);
  const dChurn = new Date(); dChurn.setDate(dChurn.getDate() - (ret.churnAfterDays || 60));
  const cutoffChurn = dChurn.toISOString().slice(0, 10);
  const snoozeDays = ret.contactSnoozeDays || 14;
  const cLog = config.contactLog || [];
  const daysSinceDate = (dateStr) => dateStr ? Math.floor((nowDate - new Date(dateStr)) / 86400000) : 999;
  const isSnoozed = (kidId, reason) => cLog.some(c => c.kidId === kidId && c.reason === reason && daysSinceDate(c.date) < snoozeDays);
  const coldCount = gymKids.filter(k => { const la = lastAtt[k.id]; return la && la < cutoffCold && la >= cutoffChurn && !isSnoozed(k.id, "cold"); }).length;
  const d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const cutoff30 = d30.toISOString().slice(0, 10);
  const prevMonth = new Date(d30); prevMonth.setDate(prevMonth.getDate() - 30);
  const cutoffPrev = prevMonth.toISOString().slice(0, 10);
  const coolingCount = gymKids.filter(k => {
    const la = lastAtt[k.id];
    if (la && la < cutoffCold && la >= cutoffChurn) return false; // already cold
    if (isSnoozed(k.id, "cooling")) return false;
    const prevRecs = (attendance || []).filter(r => r.date >= cutoffPrev && r.date < cutoff30 && (!gymFilter || r.gym === gymFilter) && r.records?.[k.id] === "attend").length;
    const currRecs = (attendance || []).filter(r => r.date >= cutoff30 && (!gymFilter || r.gym === gymFilter) && r.records?.[k.id] === "attend").length;
    return (prevRecs / 4) >= (ret.coolingFromWeekly || 2) && (currRecs / 4) < (ret.coolingToWeekly || 1);
  }).length;
  const outreachCount = coldCount + coolingCount;

  // Quick pulse metrics
  // 1. Newly enrolled (joined last 30 days)
  const newKidsCount = gymKids.filter(k => {
    const firstAtt = (attendance || []).filter(r => (!gymFilter || r.gym === gymFilter) && r.records?.[k.id] === "attend").map(r => r.date).sort()[0];
    return (k.joinDate && k.joinDate >= cutoff30) || (firstAtt && firstAtt >= cutoff30);
  }).length;

  // 2. Avg attendance per class per week (90d)
  const gymAtt90 = gymFilter ? att90.filter(r => r.gym === gymFilter) : att90;
  const totalClassAtt = gymAtt90.reduce((s2, r) => s2 + Object.values(r.records || {}).filter(v => v === "attend").length, 0);
  const avgAttPerClass = gymAtt90.length > 0 ? (totalClassAtt / gymAtt90.length).toFixed(1) : "\u2014";

  // 3. At risk (<1 cls/wk)
  const atRiskCount = gymKids.filter(k => {
    const recs = gymFilter ? att90.filter(r => r.gym === gymFilter) : att90;
    const ct = recs.filter(r => r.records?.[k.id] === "attend").length;
    return (ct / weeks90) < 1;
  }).length;

  // 4. Competition team attendance %
  const compTeamKids = gymKids.filter(k => {
    const cIds = new Set();
    Object.values(selections || {}).forEach(arr => arr.forEach(id => cIds.add(id)));
    return cIds.has(k.id);
  });
  const compClassRecs = gymAtt90.filter(r => {
    const ct2 = classTypes.find(c => c.id === r.classTypeId);
    return ct2?.category === "competition";
  });
  const compTeamAttPct = (() => {
    if (compTeamKids.length === 0 || compClassRecs.length === 0) return null;
    let totalSlots = 0, totalPresent = 0;
    compClassRecs.forEach(r => {
      compTeamKids.forEach(k => {
        if (r.records?.[k.id] !== undefined) { totalSlots++; if (r.records[k.id] === "attend") totalPresent++; }
      });
    });
    return totalSlots > 0 ? Math.round((totalPresent / totalSlots) * 100) : null;
  })();

  // Recent events
  const recentEvents = [];
  (attendance || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 15).forEach(r => {
    const ct = classTypes.find(c => c.id === r.classTypeId);
    const count = Object.values(r.records || {}).filter(v => v === "attend").length;
    if (count > 0) recentEvents.push({ date: r.date, text: `${count} kids attended ${ct ? ct.name : r.classTypeId}`, icon: "\ud83d\udccb" });
  });
  assessments.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 15).forEach(a => {
    const kid = roster.find(k => k.id === a.kidId);
    if (kid) recentEvents.push({ date: a.date, text: `${a.coach} scored ${kid.name} \u2014 ${fmt(computeSubtotals(a.scores, config).final)}`, icon: "\ud83d\udcdd" });
  });
  recentEvents.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const recentFour = recentEvents.slice(0, 4);

  const daysSince = (dateStr) => {
    if (!dateStr) return "";
    const d = Math.floor((nowDate - new Date(dateStr)) / 86400000);
    if (d === 0) return "Today"; if (d === 1) return "Yesterday"; return `${d}d ago`;
  };

  // ── Notification banner (priority-based, top 1 only) ──
  const asc = getActiveScoringCycle(config.cycles);
  const notification = (() => {
    const n = [];
    // P1 🔴 — Blocking
    if (!isCommunity && asc?.phase === "due" && overdueCount > 0)
      n.push({ p: 1, msg: `${asc.cycle} assessment due — ${overdueCount} kids left`, color: "#E53935", bg: "#E5393512", border: "#E5393533", nav: "score", btn: "Score" });
    if (isAdmin && pendingCount > 0)
      n.push({ p: 1, msg: `${pendingCount} assessment${pendingCount > 1 ? "s" : ""} waiting for approval`, color: "#E53935", bg: "#E5393512", border: "#E5393533", nav: "score", btn: "Review" });
    // P2 🟠 — Action opportunities
    if (!isCommunity && asc?.phase === "early" && overdueCount > 0)
      n.push({ p: 2, msg: `${asc.cycle} scoring is open — ${overdueCount} to assess`, color: "#FF9800", bg: "#FF980012", border: "#FF980033", nav: "score", btn: "Score" });
    if (!isCommunity && promoCount > 0)
      n.push({ p: 2, msg: `${promoCount} kid${promoCount > 1 ? "s" : ""} ready for promotion`, color: "#FF9800", bg: "#FF980012", border: "#FF980033", nav: "promotion", btn: "View" });
    if (outreachCount > 0)
      n.push({ p: 2, msg: `${outreachCount} kid${outreachCount > 1 ? "s" : ""} need follow-up`, color: "#FF9800", bg: "#FF980012", border: "#FF980033", nav: "reports", btn: "Outreach" });
    if (unrecordedClasses > 0)
      n.push({ p: 2, msg: `${unrecordedClasses} class${unrecordedClasses > 1 ? "es" : ""} yesterday — not recorded`, color: "#FF9800", bg: "#FF980012", border: "#FF980033", nav: "classes", btn: "Record" });
    // P3 🟢 — Positive
    if (!isCommunity && asc && overdueCount === 0)
      n.push({ p: 3, msg: `${asc.cycle} — all kids assessed ✓`, color: "#4CAF50", bg: "#4CAF5012", border: "#4CAF5033", nav: null, btn: null });
    // Fallback
    n.push({ p: 4, msg: "Everything on track — no actions needed", color: "#4CAF50", bg: "#4CAF5012", border: "#4CAF5033", nav: null, btn: null });
    return n.sort((a, b) => a.p - b.p)[0];
  })();

  // ── Tiles ──
  const tiles = [
    { key: "classes", icon: "\ud83d\udccb", label: "Classes", desc: "Record attendance", badge: unrecordedClasses || null, badgeColor: C.orange, badgeLabel: "yesterday" },
    { key: "roster", icon: "\ud83d\udc65", label: "Students", desc: "Manage kids & profiles", badge: gymKids.length, badgeColor: C.blue, badgeLabel: "active" },
    { key: "score", icon: "\ud83d\udcdd", label: "Score", desc: "Assess kid performance", badge: overdueCount || null, badgeColor: C.red, badgeLabel: "overdue", hidden: isCommunity },
    { key: "rankings", icon: "\ud83c\udfc6", label: "Rankings", desc: "Leaderboards & teams", badge: null, hidden: isCommunity },
    { key: "promotion", icon: "\u2b50", label: "Promotions", desc: "Award stripes & belts", badge: promoCount || null, badgeColor: C.green, badgeLabel: "ready" },
    { key: "reports", icon: "\ud83d\udcca", label: "Reports", desc: "Analytics & outreach", badge: outreachCount || null, badgeColor: "#e74c3c", badgeLabel: "outreach" },
  ].filter(t => !t.hidden);

  const Tile = ({ t }) => (
    <div
      onPointerDown={() => setPressed(t.key)}
      onPointerUp={() => { setPressed(null); onNavigate(t.key); }}
      onPointerLeave={() => setPressed(null)}
      style={{
        background: pressed === t.key ? C.card2 : C.card,
        borderRadius: 16, border: `1px solid ${C.border}`,
        padding: "16px 10px 14px",
        display: "flex", flexDirection: "column", alignItems: "center",
        cursor: "pointer", transition: "all 0.15s",
        transform: pressed === t.key ? "scale(0.96)" : "scale(1)",
        position: "relative",
      }}
    >
      {t.badge !== null && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: t.badgeColor || C.red, color: "#fff",
          fontSize: 9, fontWeight: 800,
          minWidth: 18, height: 18, borderRadius: 9,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 4px", boxShadow: `0 2px 8px ${t.badgeColor || C.red}44`,
        }}>{t.badge}</div>
      )}
      <div style={{ fontSize: 28, marginBottom: 8, lineHeight: 1 }}>{t.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3, textAlign: "center" }}>{t.label}</div>
      <div style={{ fontSize: 9, color: C.textDim, textAlign: "center", lineHeight: 1.3 }}>{t.desc}</div>
      {t.badge !== null && t.badgeLabel && (
        <div style={{ marginTop: 6, fontSize: 9, fontWeight: 700, color: t.badgeColor || C.red, opacity: 0.8 }}>
          {t.badge} {t.badgeLabel}
        </div>
      )}
    </div>
  );

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ ...s.h1, margin: 0, fontSize: 22 }}>
            {nowDate.getHours() < 12 ? "Good morning" : nowDate.getHours() < 18 ? "Good afternoon" : "Good evening"}, {loggedCoach || "Coach"}
          </h1>
          <PageHelp page="home" />
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
          {DAY_NAMES[nowDate.getDay()]}, {nowDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {!isAdmin && loggedGym && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, background: C.red + "20", color: C.red }}>{"\ud83d\udccd"} {loggedGym}</span>}
        </div>
      </div>

      {/* Gym toggle (admin / master coach) */}
      {isAdmin && config.gyms.length > 1 && (
        <div style={{ display: "flex", marginTop: 8, marginBottom: 4, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <button onClick={() => setGymFilter(null)} style={{
            flex: 1, padding: "7px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11,
            background: !gymFilter ? C.red + "18" : "transparent",
            borderBottom: !gymFilter ? `2px solid ${C.red}` : "2px solid transparent",
            color: !gymFilter ? C.red : C.textDim, transition: "all 0.15s",
          }}>All</button>
          {config.gyms.map(g => (
            <button key={g} onClick={() => setGymFilter(g)} style={{
              flex: 1, padding: "7px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11,
              background: gymFilter === g ? C.red + "18" : "transparent",
              borderBottom: gymFilter === g ? `2px solid ${C.red}` : "2px solid transparent",
              color: gymFilter === g ? C.red : C.textDim, transition: "all 0.15s",
            }}>{g}</button>
          ))}
        </div>
      )}

      {/* Notification banner */}
      {notification && (
        <div onClick={notification.nav ? () => onNavigate(notification.nav) : undefined} style={{
          padding: "10px 14px", borderRadius: 10, marginBottom: 4, marginTop: 12, fontSize: 12, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: notification.bg, border: `1px solid ${notification.border}`, color: notification.color,
          cursor: notification.nav ? "pointer" : "default",
        }}>
          <span>{notification.msg}</span>
          {notification.btn && (
            <span style={{
              marginLeft: 12, padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: notification.color + "22", border: `1px solid ${notification.color}55`,
              color: notification.color, whiteSpace: "nowrap", flexShrink: 0,
            }}>{notification.btn} ›</span>
          )}
        </div>
      )}

      {/* Tile Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
        {tiles.map(t => <Tile key={t.key} t={t} />)}
      </div>

      {/* ═══ BELOW THE FOLD ═══ */}

      {/* Quick Pulse */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Quick Pulse</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "New Enrollments", sub: "last 30 days", value: newKidsCount, color: newKidsCount > 0 ? C.green : C.textDim, nav: "roster" },
            { label: "Avg per Class", sub: "last 90 days", value: avgAttPerClass, color: parseFloat(avgAttPerClass) >= 8 ? C.green : parseFloat(avgAttPerClass) >= 5 ? C.orange : C.red, nav: "reports" },
            { label: "At Risk", sub: "<1 class/week", value: atRiskCount, color: atRiskCount === 0 ? C.green : "#e74c3c", nav: "reports" },
            { label: "Comp Attendance", sub: "team avg", value: compTeamAttPct !== null ? `${compTeamAttPct}%` : "\u2014", color: compTeamAttPct !== null ? (compTeamAttPct >= 80 ? C.green : compTeamAttPct >= 60 ? C.orange : C.red) : C.textDim, nav: "reports" },
          ].map((m, i) => (
            <div key={i} onClick={() => onNavigate(m.nav)} style={{
              background: C.card, borderRadius: 12, padding: "14px 12px",
              border: `1px solid ${C.border}`, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 12,
              transition: "border-color 0.15s",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: m.color, fontFamily: "'Bebas Neue', sans-serif", lineHeight: 1 }}>{m.value}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.text, marginTop: 4 }}>{m.label}</div>
                <div style={{ fontSize: 9, color: C.textDim }}>{m.sub}</div>
              </div>
              <span style={{ fontSize: 14, color: C.textDim, flexShrink: 0 }}>›</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Recent Activity</div>
        {recentFour.length === 0 ? (
          <div style={{ ...s.card, textAlign: "center", color: C.textDim, fontSize: 13 }}>No recent activity</div>
        ) : (
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {recentFour.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < recentFour.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.text}</div>
                </div>
                <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>{daysSince(item.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}




/* ━━━ ROSTER SCREEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function RosterScreen({ roster, setRoster, config, setConfig, assessments, setAssessments, defaultGym, isAdmin, isCommunity, isMasterCoach, loggedCoach, selections, attendance, selectedKidId, setSelectedKidId, onEditAssessment, onScore }) {
  const [search, setSearch] = useState("");
  const [filterGym, setFilterGym] = useState(defaultGym || "");
  const [filterActive, setFilterActive] = useState("active");
  const [filterAge, setFilterAge] = useState("");
  const [filterWeight, setFilterWeight] = useState("");
  const [filterComp, setFilterComp] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [rosterView, setRosterView] = useState("list");
  const [detailKid, setDetailKid] = useState(null);
  const [galleryMenu, setGalleryMenu] = useState(null);

  const currentCycle = (getActiveScoringCycle(config.cycles)?.cycle) || config.cycles.filter(c => isQuarterClosed(c)).slice(-1)[0] || config.cycles[0] || "";

  const compIds = useMemo(() => {
    const ids = new Set();
    Object.values(selections || {}).forEach(arr => arr.forEach(id => ids.add(id)));
    return ids;
  }, [selections]);

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

  const kidStatus = useMemo(() => {
    const status = {};
    roster.forEach(k => {
      const kidAss = assessments.filter(a => a.kidId === k.id && a.status !== "pending").sort((a, b) => b.date.localeCompare(a.date));
      const hasPending = assessments.some(a => a.kidId === k.id && a.status === "pending");
      const latest = kidAss[0];
      const hasCurrent = kidAss.some(a => a.cycle === currentCycle);
      let trend = null;
      if (kidAss.length >= 2) {
        const s1 = computeSubtotals(kidAss[0].scores, config).final;
        const s0 = computeSubtotals(kidAss[1].scores, config).final;
        trend = s1 > s0 + 0.1 ? "\u2191" : s1 < s0 - 0.1 ? "\u2193" : "\u2192";
      }
      const score = latest ? computeSubtotals(latest.scores, config).final : 0;
      status[k.id] = { latest, hasCurrent, trend, count: kidAss.length, score, hasPending };
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
      const name = cols[0];
      if (!name || name.toLowerCase() === "name") return;
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

  // ── Profile view data ──
  const kid = roster.find(k => k.id === selectedKidId);
  const kidAssessments = useMemo(() =>
    assessments.filter(a => a.kidId === selectedKidId).sort((a, b) => b.date.localeCompare(a.date)),
    [assessments, selectedKidId]
  );
  const approvedKidAssessments = useMemo(() => kidAssessments.filter(a => a.status !== "pending"), [kidAssessments]);
  const latest = approvedKidAssessments[0];
  const latestSub = latest ? computeSubtotals(latest.scores, config) : null;

  const deleteAssessment = (id) => {
    setAssessments(prev => prev.filter(a => a.id !== id));
  };
  const copyForAI = (a) => {
    const kid2 = roster.find(k => k.id === a.kidId);
    const sub = computeSubtotals(a.scores, config);
    const lines2 = [
      `Assessment: ${a.date} | ${a.cycle} | Coach: ${a.coach}`,
      `Kid: ${kid2?.name} (${a.kidId}) | Age: ${ageAt(kid2?.dob, a.date)} | ${kid2?.weight}kg | ${kidGymsStr(kid2)}`,
      ``,
      ...Object.entries(config.criteria).map(([cat, crits]) =>
        `${cat}: ${crits.map(c => `${c}=${a.scores[c]}`).join(", ")} \u2192 ${fmt(sub[cat])}`
      ),
      ``,
      `Final Score: ${fmt(sub.final)}`,
    ];
    navigator.clipboard?.writeText(lines2.join("\n"));
  };

  const kidAge = kid ? ageAt(kid.dob, today()) : 0;
  const ac = kid ? ageCat(kidAge) : "";
  const wc = kid ? weightCat(kid.weight, ac, config.weightRules) : "";

  // ══════════════════════════════════════════════════════════════════════
  // PROFILE VIEW — when a kid is selected
  // ══════════════════════════════════════════════════════════════════════
  if (selectedKidId && kid) {
    return (
      <div style={s.page}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ ...s.h1, margin: 0 }}>Students</h1>
            <PageHelp page="roster" />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
          {kid && <button style={s.btnSm} onClick={() => {
            const sub = latestSub;
            const prevAssessment = approvedKidAssessments.length > 1 ? approvedKidAssessments[1] : null;
            const prevSub = prevAssessment ? computeSubtotals(prevAssessment.scores, config) : null;
            const trend = prevSub ? sub.final - prevSub.final : 0;
            const trendIcon = trend > 0.1 ? "↑" : trend < -0.1 ? "↓" : "→";
            const trendColor = trend > 0.1 ? "#4CAF50" : trend < -0.1 ? "#E53935" : "#888";
            const trendWord = trend > 0.1 ? "improved" : trend < -0.1 ? "declined slightly" : "remained stable";
            const trendWordZh = trend > 0.1 ? "有所提升" : trend < -0.1 ? "略有下降" : "保持稳定";
            const pct = sub ? ((sub.final / 5) * 100).toFixed(0) : 0;

            const catScores = sub ? Object.entries(config.criteria).map(([cat, crits]) => ({
              cat, score: sub[cat], crits
            })).sort((a, b) => b.score - a.score) : [];
            const strongest = catScores[0];
            const weakest = catScores[catScores.length - 1];

            // ── SVG Radar Chart ──
            const radarSvg = (() => {
              if (!sub || catScores.length === 0) return "";
              const cats = catScores.map(c => c.cat);
              const vals = catScores.map(c => c.score);
              const n = cats.length;
              const cx = 120, cy = 110, maxR = 85;
              const angleStep = (2 * Math.PI) / n;
              const startAngle = -Math.PI / 2;

              const polar = (i, r) => {
                const a = startAngle + i * angleStep;
                return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
              };

              // Grid rings
              let grid = "";
              [1, 2, 3, 4, 5].forEach(level => {
                const r = (level / 5) * maxR;
                const pts = Array.from({length: n}, (_, i) => polar(i, r).join(",")).join(" ");
                grid += '<polygon points="' + pts + '" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>';
              });

              // Axis lines + labels
              let axes = "";
              cats.forEach((cat, i) => {
                const [lx, ly] = polar(i, maxR);
                axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + lx + '" y2="' + ly + '" stroke="#ddd" stroke-width="0.5"/>';
                const [tx, ty] = polar(i, maxR + 16);
                const anchor = tx < cx - 10 ? "end" : tx > cx + 10 ? "start" : "middle";
                axes += '<text x="' + tx + '" y="' + (ty + 3) + '" text-anchor="' + anchor + '" font-size="9" font-weight="600" fill="#555">' + cat + '</text>';
              });

              // Data polygon
              const dataPts = vals.map((v, i) => polar(i, (v / 5) * maxR).join(",")).join(" ");
              const dataShape = '<polygon points="' + dataPts + '" fill="rgba(196,30,58,0.15)" stroke="#C41E3A" stroke-width="2"/>';

              // Data dots + values
              let dots = "";
              vals.forEach((v, i) => {
                const [dx, dy] = polar(i, (v / 5) * maxR);
                dots += '<circle cx="' + dx + '" cy="' + dy + '" r="3" fill="#C41E3A"/>';
                const [vx, vy] = polar(i, (v / 5) * maxR + 10);
                dots += '<text x="' + vx + '" y="' + (vy + 3) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#C41E3A">' + v.toFixed(1) + '</text>';
              });

              // Previous assessment overlay
              let prevShape = "";
              if (prevSub) {
                const prevVals = catScores.map(c => prevSub[c.cat] || 0);
                const prevPts = prevVals.map((v, i) => polar(i, (v / 5) * maxR).join(",")).join(" ");
                prevShape = '<polygon points="' + prevPts + '" fill="none" stroke="#999" stroke-width="1" stroke-dasharray="4,3"/>';
              }

              return '<svg viewBox="0 0 240 230" style="width:100%;max-width:240px">' + grid + axes + prevShape + dataShape + dots + '</svg>';
            })();

            // ── Attendance data ──
            const attData = (() => {
              const kidAtt = (attendance || []).filter(r => r.records?.[kid.id] === "attend");
              const total = kidAtt.length;
              // Previous quarter bounds
              const now = new Date();
              const curQ = Math.floor(now.getMonth() / 3);
              const prevQStart = new Date(now.getFullYear(), curQ * 3 - 3, 1);
              if (curQ === 0) { prevQStart.setFullYear(prevQStart.getFullYear() - 1); prevQStart.setMonth(9); }
              const prevQEnd = new Date(prevQStart.getFullYear(), prevQStart.getMonth() + 3, 0);
              const qStart = prevQStart.toISOString().slice(0, 10);
              const qEnd = prevQEnd.toISOString().slice(0, 10);
              const qAtt = kidAtt.filter(r => r.date >= qStart && r.date <= qEnd);
              const qWeeks = Math.max(1, Math.round((prevQEnd - prevQStart) / (7 * 86400000)));
              const weeklyAvg = (qAtt.length / qWeeks).toFixed(1);
              const qLabel = ["Q1","Q2","Q3","Q4"][prevQStart.getMonth() / 3] + " " + prevQStart.getFullYear();

              // Sparkline — weeks of previous quarter
              const getMonday = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = day === 0 ? -6 : 1 - day; dt.setDate(dt.getDate() + diff); dt.setHours(0,0,0,0); return dt; };
              const firstMon = getMonday(prevQStart);
              const lastMon = getMonday(prevQEnd);
              const wks = [];
              const dd = new Date(firstMon);
              while (dd <= lastMon) { wks.push({ start: new Date(dd), count: 0 }); dd.setDate(dd.getDate() + 7); }
              qAtt.forEach(r => {
                const mon = getMonday(new Date(r.date + "T00:00:00"));
                const w = wks.find(w => w.start.getTime() === mon.getTime());
                if (w) w.count++;
              });
              const maxWk = Math.max(1, ...wks.map(w => w.count));

              let bars = "";
              const bw = 14, bh = 32, gap = 2;
              wks.forEach((w, i) => {
                const x = i * (bw + gap);
                const h = w.count > 0 ? Math.max(2, (w.count / maxWk) * bh) : 1;
                bars += '<rect x="' + x + '" y="' + (bh - h) + '" width="' + bw + '" height="' + h + '" rx="1" fill="' + (w.count === 0 ? "#e8e8e8" : "#C41E3A") + '" opacity="' + (w.count === 0 ? "0.4" : "0.8") + '"/>';
              });
              const sparkW = wks.length * (bw + gap);
              const sparkSvg = wks.length > 0 ? '<svg viewBox="0 0 ' + sparkW + ' ' + bh + '" style="width:100%;height:32px;margin-top:6px">' + bars + '</svg>' : '';

              return { total, qCount: qAtt.length, weeklyAvg, sparkSvg, qLabel };
            })();

            // ── Promotion data ──
            const promoData = (() => {
              const p = computePromoProjection(kid, attendance, config);
              if (p.type === "complete") return null;
              const targetDt = (config.promoTargets || {})[kid.id] || "";
              const displayDt = targetDt || p.projectedDate;
              return { ...p, targetDt, displayDt };
            })();

            // ── Top goal ──
            const topGoal = ((config.goals || {})[kid.id] || []).find(g => !g.done);

            // ── Stripe dots ──
            const maxStripes = config.promotionRules?.stripesForBelt || 4;
            const stripeDots = Array.from({length: maxStripes}, (_, i) =>
              '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 2px;background:' + (i < (kid.stripes || 0) ? "#C41E3A" : "#ddd") + '"></span>'
            ).join("");

            const w = window.open("", "_blank");
            w.document.write(`<!DOCTYPE html><html><head><title>${kid.name} - Bushido BJJ Progress Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#2a2a2a;line-height:1.4;font-size:12px}
.header{display:flex;align-items:center;gap:16px;padding-bottom:14px;border-bottom:3px solid #C41E3A;margin-bottom:14px}
.header .brand{text-align:center}
.header .brand h1{font-size:22px;color:#C41E3A;letter-spacing:3px;margin:0;line-height:1}
.header .brand .sub{font-size:8px;color:#888;letter-spacing:1.5px;text-transform:uppercase}
.header .kid{flex:1}
.header .kid .name{font-size:20px;font-weight:800;color:#1a1a1a;margin-bottom:2px}
.header .kid .meta{display:flex;flex-wrap:wrap;gap:4px}
.header .kid .meta .tag{display:inline-flex;align-items:center;padding:2px 8px;background:#f5f5f5;border-radius:10px;font-size:10px;font-weight:600;color:#555}
.cols{display:flex;gap:16px;min-height:0}
.col-l{flex:3}
.col-r{flex:2}
.card{background:#fafafa;border-radius:8px;padding:12px;margin-bottom:10px}
.card-title{font-size:10px;font-weight:700;color:#C41E3A;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
.score-hero{text-align:center;padding:10px 0}
.score-hero .num{font-size:40px;font-weight:900;color:#C41E3A;line-height:1}
.score-hero .of{font-size:14px;color:#aaa;font-weight:400}
.score-hero .trend{font-size:11px;margin-top:2px}
.score-hero .cycle{font-size:9px;color:#999;margin-top:2px}
.summary{font-size:11px;color:#444;padding:8px 10px;background:#fff;border-radius:6px;border-left:3px solid #C41E3A;margin-top:8px}
.summary .zh{color:#999;font-size:10px;margin-top:4px}
.metric-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f0f0f0}
.metric-row:last-child{border-bottom:none}
.metric-label{font-size:10px;color:#888}
.metric-val{font-size:14px;font-weight:800;color:#1a1a1a}
.metric-sub{font-size:9px;color:#aaa;margin-left:4px}
.gate{margin-bottom:6px}
.gate-header{display:flex;justify-content:space-between;font-size:9px;margin-bottom:2px}
.gate-label{color:#888}
.gate-val{font-weight:700;color:#333}
.gate-bar{height:5px;background:#e8e8e8;border-radius:3px;overflow:hidden}
.gate-fill{height:100%;border-radius:3px}
.promo-date{margin-top:8px;padding:6px 10px;background:#fff;border-radius:6px;display:flex;justify-content:space-between;align-items:center}
.promo-date .lbl{font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px}
.promo-date .dt{font-size:16px;font-weight:800;color:#C41E3A}
.footer{margin-top:12px;padding-top:10px;border-top:2px solid #C41E3A;text-align:center}
.footer .logo{font-size:13px;font-weight:800;color:#C41E3A;letter-spacing:2px}
.footer .fmeta{font-size:8px;color:#999;margin-top:2px}
@media print{body{padding:12px}@page{margin:12mm;size:A4}}
</style></head><body>

<div class="header">
  <div class="brand">
    <div style="font-size:24px;margin-bottom:2px">🥋</div>
    <h1>BUSHIDO</h1>
    <div class="sub">Progress Report · 进步报告</div>
  </div>
  <div class="kid">
    <div class="name">${kid.name}</div>
    <div class="meta">
      <span class="tag">🥋 ${kid.belt} Belt ${stripeDots}</span>
      <span class="tag">📅 Age ${ageAt(kid.dob, today())}</span>
      <span class="tag">⚖️ ${kid.weight}kg</span>
      <span class="tag">🏠 ${kidGymsStr(kid)}</span>
    </div>
  </div>
</div>

<div class="cols">
<div class="col-l">

${sub ? `
  <div class="card">
    <div class="card-title">Assessment Score 评估分数</div>
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="flex:1">
        <div class="score-hero">
          <div class="num">${fmt(sub.final)}<span class="of"> / 5</span></div>
          <div class="trend" style="color:${trendColor}">${trendIcon} ${prevSub ? fmt(prevSub.final) + " → " + fmt(sub.final) : "First assessment"}</div>
          <div class="cycle">${latest.cycle} · ${latest.date}</div>
        </div>
      </div>
      <div style="flex:1;text-align:center">
        ${radarSvg}
        ${prevSub ? '<div style="font-size:8px;color:#999;text-align:center;margin-top:2px">Dashed = previous · 虚线=上次</div>' : ""}
      </div>
    </div>
    <div class="summary">
      <strong>${kid.name}</strong> scored <strong>${fmt(sub.final)}/5</strong> in the ${latest.cycle} cycle.
      ${strongest && weakest && strongest.cat !== weakest.cat ?
        `Strongest: <strong>${strongest.cat}</strong> (${fmt(strongest.score)}). Growth area: <strong>${weakest.cat}</strong> (${fmt(weakest.score)}).` : ""}
      ${prevSub ? `Performance has ${trendWord} (${trend > 0 ? "+" : ""}${fmt(trend)}).` : ""}
      <div class="zh">
        <strong>${kid.name}</strong> 在${latest.cycle}周期获得 <strong>${fmt(sub.final)}/5</strong>。
        ${strongest && weakest && strongest.cat !== weakest.cat ?
          `最强：<strong>${strongest.cat}</strong>（${fmt(strongest.score)}）。提升空间：<strong>${weakest.cat}</strong>（${fmt(weakest.score)}）。` : ""}
        ${prevSub ? `表现${trendWordZh}（${trend > 0 ? "+" : ""}${fmt(trend)}）。` : ""}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Skill Breakdown 分项详情</div>
    ${Object.entries(config.criteria).map(([cat, crits]) => {
      const score = sub[cat];
      const p = (score / 5) * 100;
      const color = score >= 4 ? "#4CAF50" : score >= 3 ? "#FFA726" : "#E53935";
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f0f0f0">
        <div style="min-width:70px;font-weight:700;font-size:11px">${cat}</div>
        <div style="flex:1">
          <div style="height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden"><div style="width:${p}%;height:100%;background:${color};border-radius:3px"></div></div>
          <div style="font-size:8px;color:#999;margin-top:2px">${crits.map(c => c + ": " + (latest.scores[c] || 0)).join(" · ")}</div>
        </div>
        <div style="min-width:30px;text-align:right;font-weight:700;font-size:11px;color:${color}">${fmt(score)}</div>
      </div>`;
    }).join("")}
  </div>
` : '<div class="card"><div class="card-title">Assessment</div><div style="color:#999;font-size:11px">No assessments recorded yet · 暂无评估记录</div></div>'}

</div>
<div class="col-r">

  <div class="card">
    <div class="card-title">Attendance 出勤 (${attData.qLabel})</div>
    <div class="metric-row">
      <span class="metric-label">Weekly avg 周均</span>
      <span><span class="metric-val" style="color:${parseFloat(attData.weeklyAvg) >= 3 ? "#4CAF50" : parseFloat(attData.weeklyAvg) >= 2 ? "#FF9800" : "#E53935"}">${attData.weeklyAvg}</span><span class="metric-sub">classes/wk</span></span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Quarter total 季度出勤</span>
      <span><span class="metric-val">${attData.qCount}</span><span class="metric-sub">classes</span></span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Total all-time 总数</span>
      <span><span class="metric-val">${attData.total}</span><span class="metric-sub">classes</span></span>
    </div>
    <div style="margin-top:6px;font-size:8px;color:#aaa;text-align:center">${attData.qLabel} weekly breakdown · 每周明细</div>
    ${attData.sparkSvg}
  </div>

${promoData ? `
  <div class="card">
    <div class="card-title">Next Belt 下次腰带晋级</div>
    <div style="font-weight:700;font-size:12px;margin-bottom:8px">🥋 ${kid.belt} → ${promoData.nextBelt}</div>
    ${promoData.gates.map(g => {
      const pct = Math.min(100, g.required > 0 ? (g.current / g.required) * 100 : 100);
      const color = g.done ? "#4CAF50" : "#FF9800";
      return `<div class="gate">
        <div class="gate-header">
          <span class="gate-label">${g.label} ${g.labelZh}</span>
          <span class="gate-val" style="color:${g.done ? '#4CAF50' : '#333'}">${g.current}${g.unit || ''} / ${g.required}${g.unit || ''} ${g.done ? '✓' : ''}</span>
        </div>
        <div class="gate-bar"><div class="gate-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
    }).join("")}
    <div class="promo-date">
      <div>
        <div class="lbl">${promoData.targetDt ? 'Target 目标' : 'Projected 预计'}</div>
        <div class="dt">${promoData.displayDt || 'TBD'}</div>
        ${promoData.targetDt && promoData.projectedDate && promoData.targetDt !== promoData.projectedDate ? '<div style="font-size:8px;color:#999">Projected: ' + promoData.projectedDate + '</div>' : ''}
      </div>
      <div style="font-size:9px;color:#888">${promoData.weeklyAvg > 0 ? promoData.weeklyAvg.toFixed(1) + '/wk' : ''}</div>
    </div>
  </div>
` : '<div class="card"><div class="card-title">Belt Promotion</div><div style="color:#4CAF50;font-size:11px;text-align:center">✓ Highest belt achieved · 已达最高腰带</div></div>'}

${topGoal ? `
  <div class="card">
    <div class="card-title">Current Goal 当前目标</div>
    <div style="display:flex;gap:6px;align-items:flex-start">
      <span style="font-size:12px">🎯</span>
      <span style="font-size:11px;color:#333">${topGoal.text}</span>
    </div>
  </div>
` : ""}

</div>
</div>

<div class="footer">
  <div class="logo">🥋 BUSHIDO BJJ ACADEMY</div>
  <div class="fmeta">Progress Report · ${today()} · Based on coach assessment · 教练专业评估 · ${kidGymsStr(kid)}</div>
</div>

<script>window.print();</script>
</body></html>`);
            w.document.close();
          }}>📄 Parent Report</button>}
            {kid && !isCommunity && <button style={{ ...s.btnSm, background: C.red, color: "#fff" }} onClick={() => onScore(kid.id)}>📝 Score</button>}
            {kid && <button style={s.btnSm} onClick={() => setSelectedKidId("")}>← Back</button>}
          </div>
        </div>
      {/* Header Card */}
      {kid && (
        <div style={{ ...s.card, background: `linear-gradient(135deg, ${C.card} 0%, ${C.red}11 100%)` }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 80, height: 107, borderRadius: 10, overflow: "hidden", border: `2px solid ${BELT_HEX[kid.belt] || "#888"}`, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {kid.photoUrl ? <img src={kid.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <KidAvatar kid={kid} size={52} />}
              </div>
              {<button onClick={() => setModal(kid)} style={{ position: "absolute", bottom: -4, right: -4, width: 24, height: 24, borderRadius: "50%", background: C.red, border: `2px solid ${C.card}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, padding: 0 }}>📷</button>}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{kid.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{kid.id} · {kidGymsStr(kid)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <BeltBadge belt={kid.belt} />
            {(kid.stripes > 0) && <span style={s.badge(C.red)}>{"🎖".repeat(kid.stripes || 0)}</span>}
            <span style={s.badge(C.blue)}>{kidAge}y · {ac}</span>
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

      {/* Weekly Attendance Chart */}
      {kid && <WeeklyAttendanceChart kidId={kid.id} attendance={attendance} />}

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

      {/* Promotion Progress */}
      {kid && <PromotionProgress kid={kid} attendance={attendance} config={config} setConfig={setConfig} readOnly={isCommunity} />}

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
      {kid && approvedKidAssessments.length >= 2 && (
        <ComparisonSection assessments={approvedKidAssessments} config={config} />
      )}

      {/* Score Trend */}
      {kid && approvedKidAssessments.length > 1 && (
        <>
          <h2 style={s.h2}>Score Trend</h2>
          <div style={s.card}>
            <TrendChart assessments={approvedKidAssessments} config={config} />
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
            const canApproveHere = isAdmin || isMasterCoach;
            return (
              <AssessmentCard key={a.id} a={a} sub={sub} config={config} onEdit={() => onEditAssessment(a)} onDelete={() => deleteAssessment(a.id)} onCopy={() => copyForAI(a)}
                canApprove={canApproveHere}
                onApprove={() => { setAssessments(prev => prev.map(x => x.id === a.id ? { ...x, status: "approved", approvedBy: loggedCoach } : x)); }}
                onReject={() => { if (confirm(`Reject this assessment by ${a.coach}?`)) deleteAssessment(a.id); }}
              />
            );
          })}
        </>
      )}
 
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add Kid" : "Edit Kid"}>
        {modal && <KidForm kid={modal === "add" ? { id: nextId(), name: "", dob: "", belt: "White", weight: 25, gyms: [defaultGym || config.gyms[0] || ""], active: true, stripes: 0, classCountOffset: 0, isNew: true } : modal} config={config} onSave={saveKid} onCancel={() => setModal(null)} />}
      </Modal>
    </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ ...s.h1, margin: 0 }}>Students</h1>
          <PageHelp page="roster" />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 2, marginRight: 4 }}>
            <button onClick={() => setRosterView("list")} style={{ padding: "5px 8px", borderRadius: 5, border: `1px solid ${C.border}`, cursor: "pointer", background: rosterView === "list" ? C.red + "20" : C.card2, color: rosterView === "list" ? C.red : C.textDim, fontSize: 14, lineHeight: 1 }}>☰</button>
            <button onClick={() => setRosterView("gallery")} style={{ padding: "5px 8px", borderRadius: 5, border: `1px solid ${C.border}`, cursor: "pointer", background: rosterView === "gallery" ? C.red + "20" : C.card2, color: rosterView === "gallery" ? C.red : C.textDim, fontSize: 14, lineHeight: 1 }}>⊞</button>
          </div>
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
            <button style={s.btnSm} onClick={() => setShowImport(false)}>Cancel</button>
            <button style={{ ...s.btn, fontSize: 12 }} onClick={parseImport}>Import {importText.trim().split("\n").filter(l => l.trim()).length} rows</button>
          </div>
        </div>
      )}

      <input style={{ ...s.input, marginBottom: 10 }} type="text" placeholder="🔍 Search by name…" value={search}
        onChange={e => setSearch(e.target.value)} />

      {isAdmin ? (
        <div style={{ display: "flex", marginBottom: 10, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <button onClick={() => setFilterGym("")} style={{
            flex: 1, padding: "7px 10px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
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
                    const defaultDesc = ["score", "training", "belt"].includes(field);
                    setSortBy(defaultDesc ? `${field}_desc` : (field === "name" ? "name" : `${field}_asc`));
                  } else {
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

      {/* ── LIST VIEW ── */}
      {rosterView === "list" && filtered.map(kid => {
        const age = ageAt(kid.dob, today());
        const st = kidStatus[kid.id] || {};
        const wk = weeklyAvg[kid.id] || 0;
        const isComp = compIds.has(kid.id);
        return (
          <div key={kid.id} style={{ ...s.card, opacity: kid.active ? 1 : 0.5, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            onClick={() => setSelectedKidId(kid.id)}>
            <KidAvatar kid={kid} size={40} />
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
                {st.trend && <span style={{ color: st.trend === "\u2191" ? C.green : st.trend === "\u2193" ? "#f44" : C.textDim, fontWeight: 700 }}>{st.trend}</span>}
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

      {/* ── GALLERY VIEW ── */}
      {rosterView === "gallery" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {filtered.map(kid => (
            <div key={kid.id} onClick={() => setDetailKid(kid)} style={{
              background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
              overflow: "hidden", cursor: "pointer", opacity: kid.active ? 1 : 0.5,
              position: "relative", transition: "border-color 0.15s",
            }}>
              <div style={{ width: "100%", aspectRatio: "1", background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {kid.photoUrl
                  ? <img src={kid.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <KidAvatar kid={kid} size={56} rounded={true} />
                }
                <button onClick={e => { e.stopPropagation(); setGalleryMenu(galleryMenu === kid.id ? null : kid.id); }} style={{
                  position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", border: "none",
                  borderRadius: 4, color: "#fff", fontSize: 14, cursor: "pointer", padding: "1px 5px", lineHeight: 1,
                }}>⋮</button>
                {galleryMenu === kid.id && (
                  <div style={{ position: "absolute", top: 24, right: 4, zIndex: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 4, minWidth: 110, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setGalleryMenu(null); setModal(kid); }} style={{ display: "block", width: "100%", padding: "8px 10px", background: "none", border: "none", color: C.text, fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer", borderRadius: 4 }}>✏️ Edit</button>
                    <button onClick={() => { setGalleryMenu(null); setRoster(prev => prev.map(k => k.id === kid.id ? { ...k, active: !k.active } : k)); }} style={{ display: "block", width: "100%", padding: "8px 10px", background: "none", border: "none", color: C.orange, fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer", borderRadius: 4 }}>{kid.active ? "⏸ Pause" : "▶ Activate"}</button>
                    <button onClick={() => { setGalleryMenu(null); if (confirm(`Delete ${kid.name}?`)) setRoster(prev => prev.filter(k => k.id !== kid.id)); }} style={{ display: "block", width: "100%", padding: "8px 10px", background: "none", border: "none", color: "#e74c3c", fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer", borderRadius: 4 }}>🗑 Delete</button>
                  </div>
                )}
              </div>
              <div style={{ padding: "8px 8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{kid.name.split(/\s(?=[^\s]*$)/)[0]}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 20, height: 6, borderRadius: 2, background: BELT_HEX[kid.belt] || "#888", border: kid.belt === "White" ? "1px solid #555" : "none" }} />
                    {[...Array(4)].map((_, i) => <div key={i} style={{ width: 3, height: 3, borderRadius: 1, background: i < (kid.stripes || 0) ? "#fff" : "#333" }} />)}
                  </div>
                  <span style={{ fontSize: 9, color: C.textDim, fontWeight: 600 }}>{kidGymsStr(kid)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gallery click-away */}
      {galleryMenu && <div onClick={() => setGalleryMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 5 }} />}

      {/* ── DETAIL POPUP (gallery tap) ── */}
      {detailKid && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 24 }} onClick={() => setDetailKid(null)}>
          <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, maxWidth: 380, width: "92%", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: "100%", aspectRatio: "3/4", background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `3px solid ${BELT_HEX[detailKid.belt] || "#888"}` }}>
              {detailKid.photoUrl
                ? <img src={detailKid.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <KidAvatar kid={detailKid} size={90} rounded={true} />
              }
            </div>
            <div style={{ padding: "16px 20px 20px" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 6 }}>{detailKid.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 28, height: 8, borderRadius: 2, background: BELT_HEX[detailKid.belt] || "#888", border: detailKid.belt === "White" ? "1px solid #555" : "none" }} />
                  {[...Array(4)].map((_, i) => <div key={i} style={{ width: 4, height: 4, borderRadius: 1, background: i < (detailKid.stripes || 0) ? "#fff" : "#333" }} />)}
                </div>
                <span style={{ fontSize: 11, color: C.textDim }}>{detailKid.belt}</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Gym", value: kidGymsStr(detailKid) },
                  { label: "Weight", value: `${detailKid.weight}kg` },
                  { label: "Age", value: detailKid.dob ? `${ageAt(detailKid.dob, today())}y · ${ageCat(ageAt(detailKid.dob, today()))}` : "—" },
                ].map(item => (
                  <div key={item.label} style={{ flex: 1, background: C.card2, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.value}</div>
                    <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setSelectedKidId(detailKid.id); setDetailKid(null); }} style={{
                width: "100%", padding: "11px 0", background: C.red, color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
              }}>View Full Profile</button>
              <button onClick={() => setDetailKid(null)} style={{
                width: "100%", padding: "9px 0", background: "none", color: C.textDim,
                border: "none", fontSize: 12, cursor: "pointer", marginTop: 6,
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add Kid" : "Edit Kid"}>
        {modal && <KidForm kid={modal === "add" ? { id: nextId(), name: "", dob: "", belt: "White", weight: 25, gyms: [defaultGym || config.gyms[0] || ""], active: true, stripes: 0, classCountOffset: 0, isNew: true } : modal} config={config} onSave={saveKid} onCancel={() => setModal(null)} />}
      </Modal>
    </div>
  );
}

function KidForm({ kid, config, onSave, onCancel }) {
  const [form, setForm] = useState({ ...kid });
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef(null);
  const up = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handlePhoto = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try { const url = await uploadPhoto(file); up("photoUrl", url); }
    catch (e) { alert("Photo upload failed: " + e.message); }
    finally { setUploading(false); }
  };
  return (
    <div>
      {/* Photo upload */}
      <div style={{ marginBottom: 14 }}>
        <label style={s.label}>Photo</label>
        {form.photoUrl ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img src={form.photoUrl} alt="" style={{ width: 90, height: 120, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}` }} />
              {uploading && <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 22, height: 22, border: "3px solid #fff3", borderTop: `3px solid ${C.red}`, borderRadius: "50%", animation: "bushido-spin 0.8s linear infinite" }} /></div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ ...s.btnSm, fontSize: 11 }}>📷 Change</button>
              <button type="button" onClick={() => up("photoUrl", null)} style={{ ...s.btnSm, fontSize: 11, color: "#e74c3c", borderColor: "#e74c3c44" }}>🗑 Remove</button>
              <div style={{ fontSize: 10, color: C.textMuted }}>JPG / PNG · max 5MB</div>
            </div>
          </div>
        ) : (
          <div onClick={() => !uploading && fileRef.current?.click()} style={{
            border: `2px dashed ${C.border}`, borderRadius: 10, padding: "20px 16px", textAlign: "center", cursor: "pointer", background: C.card2,
          }}>
            {uploading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 24, height: 24, border: "3px solid #fff1", borderTop: `3px solid ${C.red}`, borderRadius: "50%", animation: "bushido-spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 12, color: C.textDim }}>Uploading…</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 4, opacity: 0.5 }}>📷</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Tap to add photo</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>JPG / PNG · max 5MB</div>
              </>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handlePhoto(e.target.files[0]); e.target.value = ""; }} />
      </div>
      <style>{`@keyframes bushido-spin { to { transform: rotate(360deg); } }`}</style>
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
function ScoringScreen({ roster, assessments, allAssessments, setAssessments, config, editingAssessment, setEditingAssessment, loggedCoach, isAdmin, isMasterCoach, loggedGym, logActivity }) {
  const [step, setStep] = useState(1);
  const [coach, setCoach] = useState((loggedCoach && loggedCoach !== "Admin") ? loggedCoach : coachName(config.coaches[0]) || "");
  const closedCycles = config.cycles.filter(c => isQuarterClosed(c));
  const activeSc = getActiveScoringCycle(config.cycles);
  const scorableCycles = activeSc && !isQuarterClosed(activeSc.cycle)
    ? [...closedCycles, activeSc.cycle]
    : closedCycles;
  const [cycle, setCycle] = useState(activeSc?.cycle || scorableCycles[scorableCycles.length - 1] || config.cycles[0] || "");
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
    const autoApprove = isAdmin || isMasterCoach;
    const status = autoApprove ? "approved" : "pending";
    if (editingAssessment) {
      setAssessments(prev => prev.map(a => a.id === editingAssessment.id ? { ...a, date, coach, cycle, kidId, scores: { ...scores }, status: autoApprove ? "approved" : "pending", approvedBy: autoApprove ? loggedCoach : null } : a));
      logActivity({ type: "assessment_edit", coach, kidId, kidName: kid?.name || kidId, cycle });
      reset();
    } else {
      setAssessments(prev => [...prev, { id: uid(), date, coach, cycle, kidId, scores: { ...scores }, status, approvedBy: autoApprove ? loggedCoach : null }]);
      logActivity({ type: autoApprove ? "assessment_new" : "assessment_pending", coach, kidId, kidName: kid?.name || kidId, cycle });
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

        {/* ── Pending Approvals (admin/master only) ── */}
        {(isAdmin || isMasterCoach) && (() => {
          const pending = (allAssessments || []).filter(a => a.status === "pending");
          if (pending.length === 0) return null;
          return (
            <div style={{ ...s.card, marginBottom: 14, border: `1px solid #FF980044`, background: "#FF980008" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>⏳</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#FF9800" }}>Pending Approvals ({pending.length})</span>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {pending.map(a => {
                  const kid2 = roster.find(k => k.id === a.kidId);
                  const sub2 = computeSubtotals(a.scores, config);
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: `1px solid ${C.border}44` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{kid2?.name || "?"}</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>{a.coach} · {a.date} · {a.cycle} · <span style={{ fontWeight: 700, color: C.red }}>{fmt(sub2.final)}</span></div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => {
                          setAssessments(prev => prev.map(x => x.id === a.id ? { ...x, status: "approved", approvedBy: loggedCoach } : x));
                          logActivity({ type: "assessment_approved", coach: loggedCoach, kidId: a.kidId, kidName: kid2?.name || a.kidId, cycle: a.cycle, originalCoach: a.coach });
                        }} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#4CAF5022", color: "#4CAF50", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>✓ Approve</button>
                        <button onClick={() => {
                          setEditingAssessment(a);
                        }} style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, fontSize: 11, cursor: "pointer" }}>✏️</button>
                        <button onClick={() => {
                          if (confirm(`Reject ${kid2?.name}'s assessment by ${a.coach}?`)) {
                            setAssessments(prev => prev.filter(x => x.id !== a.id));
                            logActivity({ type: "assessment_rejected", coach: loggedCoach, kidId: a.kidId, kidName: kid2?.name || a.kidId, cycle: a.cycle, originalCoach: a.coach });
                          }
                        }} style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: "#E5393522", color: "#E53935", fontSize: 11, cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        <div style={s.card}>
          <div style={s.grid2}>
            <div><label style={s.label}>Date</label><input style={s.input} type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label style={s.label}>Cycle</label>
              <select style={s.select} value={cycle} onChange={e => setCycle(e.target.value)}>
                {scorableCycles.map(c => <option key={c}>{c}</option>)}
              </select>
              {scorableCycles.length === 0 && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>No completed quarters yet</div>}
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
      {!isAdmin && !isMasterCoach && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: "#FF980011", borderRadius: 8, fontSize: 11, color: "#FF9800", textAlign: "center" }}>
          ⏳ This assessment will be submitted for Master Coach approval before appearing in rankings and reports.
        </div>
      )}
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

      {(() => {
        const AGE_ORDER = ["U8","U10","U12","U14"];
        const WEIGHT_ORDER = ["Light","Medium","Heavy"];
        const bracketOrder = (key) => {
          const [ac, wc] = key.split(" · ");
          return AGE_ORDER.indexOf(ac) * 10 + WEIGHT_ORDER.indexOf(wc);
        };
        return Object.entries(brackets).sort((a, b) => bracketOrder(a[0]) - bracketOrder(b[0])).map(([bracket, entries]) => (
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
      ));
      })()}
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
function WeeklyAttendanceChart({ kidId, attendance }) {
  const [range, setRange] = useState("3m");
  const ranges = { "1m": 30, "3m": 90, "6m": 180, "12m": 365 };

  const data = useMemo(() => {
    const days = ranges[range];
    const now = new Date();
    const start = new Date(); start.setDate(start.getDate() - days);
    const cutoff = start.toISOString().slice(0, 10);

    const attendDates = (attendance || [])
      .filter(r => r.date >= cutoff && r.records?.[kidId] === "attend")
      .map(r => new Date(r.date + "T00:00:00"));

    const getMonday = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = day === 0 ? -6 : 1 - day; dt.setDate(dt.getDate() + diff); dt.setHours(0,0,0,0); return dt; };

    const firstMonday = getMonday(start);
    const lastMonday = getMonday(now);
    const weeks = [];
    const d = new Date(firstMonday);
    while (d <= lastMonday) {
      weeks.push({ start: new Date(d), count: 0 });
      d.setDate(d.getDate() + 7);
    }

    attendDates.forEach(dt => {
      const mon = getMonday(dt);
      const w = weeks.find(w => w.start.getTime() === mon.getTime());
      if (w) w.count++;
    });

    return weeks;
  }, [attendance, kidId, range]);

  const maxCount = Math.max(1, ...data.map(w => w.count));
  const n = data.length || 1;
  // Use a logical coordinate system — viewBox scales to fill container
  const vW = 400;
  const chartH = 100;
  const labelH = 16;
  const vH = chartH + labelH;
  const barGap = Math.max(1, Math.round(vW * 0.01));
  const barW = Math.max(2, (vW - (n - 1) * barGap) / n);

  const avgPerWeek = data.length > 0 ? (data.reduce((s, w) => s + w.count, 0) / data.length).toFixed(1) : "0";

  const formatWeek = (d) => { const m = d.getMonth() + 1; const day = d.getDate(); return `${m}/${day}`; };

  // Show ~6-8 labels max regardless of range
  const labelEvery = Math.max(1, Math.ceil(n / 7));

  return (
    <>
      <h2 style={s.h2}>Weekly Classes 每周课时</h2>
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: C.textDim }}>Avg <strong style={{ color: C.text }}>{avgPerWeek}</strong> classes/wk</span>
          <div style={{ display: "flex", gap: 0, background: C.card2, borderRadius: 6, overflow: "hidden" }}>
            {Object.keys(ranges).map(k => (
              <button key={k} onClick={() => setRange(k)} style={{
                padding: "4px 10px", fontSize: 11, fontWeight: range === k ? 700 : 400, border: "none", cursor: "pointer",
                background: range === k ? C.red : "transparent", color: range === k ? "#fff" : C.textDim,
              }}>{k}</button>
            ))}
          </div>
        </div>
        {data.length === 0 ? (
          <div style={{ textAlign: "center", color: C.textDim, fontSize: 12, padding: "20px 0" }}>No attendance data for this period</div>
        ) : (
          <svg viewBox={`0 0 ${vW} ${vH}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="xMidYMid meet">
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map(pct => (
              <line key={pct} x1={0} x2={vW} y1={chartH * (1 - pct)} y2={chartH * (1 - pct)} stroke={C.border} strokeWidth={0.5} />
            ))}
            {/* Bars */}
            {data.map((w, i) => {
              const h = maxCount > 0 ? (w.count / maxCount) * chartH : 0;
              const x = i * (barW + barGap);
              const isCurrentWeek = i === data.length - 1;
              return (
                <g key={i}>
                  <rect x={x} y={chartH - Math.max(h, 1)} width={barW} height={Math.max(h, 1)} rx={barW > 6 ? 2 : 1}
                    fill={w.count === 0 ? C.card2 : isCurrentWeek ? C.orange : C.red} opacity={w.count === 0 ? 0.3 : 0.85} />
                  {w.count > 0 && barW >= 12 && (
                    <text x={x + barW / 2} y={chartH - h - 3} textAnchor="middle" fontSize={7} fill={C.textDim}>{w.count}</text>
                  )}
                  {i % labelEvery === 0 && (
                    <text x={x + barW / 2} y={chartH + 11} textAnchor="middle" fontSize={7} fill={C.textMuted}>{formatWeek(w.start)}</text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </>
  );
}

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


/* ━━━ PROMOTION PROGRESS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PromotionProgress({ kid, attendance, config, setConfig, readOnly }) {
  const promo = useMemo(() => computePromoProjection(kid, attendance, config), [kid, attendance, config]);
  const targetDate = (config.promoTargets || {})[kid.id] || "";
  const [editing, setEditing] = useState(false);

  if (promo.type === "complete") {
    return (
      <>
        <h2 style={s.h2}>Next Belt 下次腰带晋级</h2>
        <div style={{ ...s.card, textAlign: "center", color: C.green, fontSize: 13 }}>✓ Highest belt achieved · 已达最高腰带</div>
      </>
    );
  }

  const setTarget = (date) => {
    setConfig(p => ({ ...p, promoTargets: { ...(p.promoTargets || {}), [kid.id]: date } }));
  };
  const clearTarget = () => {
    setConfig(p => {
      const t = { ...(p.promoTargets || {}) };
      delete t[kid.id];
      return { ...p, promoTargets: t };
    });
  };

  const typeLabel = `🥋 Next Belt → ${promo.nextBelt}`;
  const displayDate = targetDate || promo.projectedDate;
  const isOverride = targetDate && promo.projectedDate && targetDate !== promo.projectedDate;

  return (
    <>
      <h2 style={s.h2}>Next Belt 下次腰带晋级</h2>
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{typeLabel}</span>
          <span style={{ fontSize: 11, color: C.textDim }}>
            {promo.weeklyAvg > 0 ? `${promo.weeklyAvg.toFixed(1)} classes/wk` : "No recent training"}
          </span>
        </div>

        {/* Progress bars */}
        {promo.gates.map((g, i) => {
          const pct = Math.min(100, g.required > 0 ? (g.current / g.required) * 100 : 100);
          const color = g.done ? C.green : C.orange;
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: C.textDim }}>{g.label} {g.labelZh}</span>
                <span style={{ fontWeight: 700, color: g.done ? C.green : C.text }}>
                  {g.current}{g.unit ? g.unit : ""} / {g.required}{g.unit ? g.unit : ""} {g.done ? "✓" : ""}
                </span>
              </div>
              <div style={{ height: 6, background: C.card2, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
              </div>
            </div>
          );
        })}

        {/* Target date */}
        <div style={{ marginTop: 12, padding: 10, background: C.card2, borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {targetDate ? "Target Date 目标日期" : "Projected Date 预计日期"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: displayDate ? C.text : C.textDim, fontFamily: "'Bebas Neue', sans-serif", marginTop: 2 }}>
                {displayDate || "Insufficient data"}
              </div>
              {isOverride && (
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                  Projected: {promo.projectedDate}
                </div>
              )}
            </div>
            {!readOnly && (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {editing ? (
                  <>
                    <input type="date" style={{ ...s.input, width: 140, fontSize: 12, padding: "4px 6px" }}
                      value={targetDate || promo.projectedDate || ""}
                      onChange={e => { setTarget(e.target.value); setEditing(false); }}
                    />
                    {targetDate && (
                      <button style={{ ...s.btnSm, fontSize: 10, padding: "4px 8px" }} onClick={() => { clearTarget(); setEditing(false); }}>Reset</button>
                    )}
                    <button style={{ ...s.btnSm, fontSize: 10, padding: "4px 8px" }} onClick={() => setEditing(false)}>✕</button>
                  </>
                ) : (
                  <button style={{ ...s.btnSm, fontSize: 11 }} onClick={() => setEditing(true)}>
                    {targetDate ? "✏️ Edit" : "🎯 Set Target"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
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

function AssessmentCard({ a, sub, config, onEdit, onDelete, onCopy, onApprove, onReject, canApprove }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = a.status === "pending";
  return (
    <div style={{ ...s.card, ...(isPending ? { border: `1px solid #FF980044`, background: "#FF980006" } : {}) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {a.date} <span style={{ color: C.textDim, fontWeight: 400 }}>· {a.cycle}</span>
            {isPending && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: "#FF980022", color: "#FF9800", fontSize: 10, fontWeight: 700 }}>⏳ Pending</span>}
            {a.status === "approved" && a.approvedBy && <span style={{ marginLeft: 6, fontSize: 10, color: "#4CAF50" }}>✓ {a.approvedBy}</span>}
          </div>
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
            {isPending && canApprove && onApprove && <button onClick={onApprove} style={{ ...s.btnSm, background: "#4CAF5022", color: "#4CAF50", fontWeight: 700 }}>✓ Approve</button>}
            {isPending && canApprove && onReject && <button onClick={onReject} style={{ ...s.btnSm, background: "#E5393522", color: "#E53935", fontWeight: 700 }}>✕ Reject</button>}
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
function ReportingScreen({ roster, assessments, config, setConfig, onViewProfile, onScore, readOnly, isAdmin, loggedGym, loggedCoach, selections, attendance }) {
  const [reportTab, setReportTab] = useState("overview");
  const [filterCycle, setFilterCycle] = useState(config.cycles.filter(c => isQuarterClosed(c)).slice(-1)[0] || config.cycles[0] || "");
  const [filterGym, setFilterGym] = useState(isAdmin ? "" : (loggedGym || ""));
  const [deepGym, setDeepGym] = useState(loggedGym || config.gyms[0] || "");

  // ── Shared data computations ──
  const allActive = roster.filter(k => k.active);
  const activeKids = allActive.filter(k => !filterGym || kidInGym(k, filterGym));
  const inactiveKids = roster.filter(k => !k.active && (!filterGym || kidInGym(k, filterGym)));

  const d90 = new Date(); d90.setDate(d90.getDate() - 90);
  const cutoff90 = d90.toISOString().slice(0, 10);
  const att90 = (attendance || []).filter(r => r.date >= cutoff90);
  const weeks90 = Math.max(1, Math.round(90 / 7));

  const kidWeeklyAvg = (kidId, gymFilter) => {
    const recs = gymFilter ? att90.filter(r => r.gym === gymFilter) : att90;
    const ct = recs.filter(r => r.records?.[kidId] === "attend").length;
    return parseFloat((ct / weeks90).toFixed(1));
  };

  // Assessment data for selected cycle
  const cycleAss = assessments.filter(a => a.cycle === filterCycle);
  const latestByKid = {};
  cycleAss.forEach(a => { if (!latestByKid[a.kidId] || a.date > latestByKid[a.kidId].date) latestByKid[a.kidId] = a; });
  const uniqueAssessed = Object.values(latestByKid);
  const assessedIds = new Set(uniqueAssessed.map(a => a.kidId));

  // Competition team
  const compTeamIds = new Set();
  Object.entries(selections || {}).forEach(([key, ids]) => {
    if (key.startsWith(filterCycle + "|")) ids.forEach(id => compTeamIds.add(id));
  });
  if (compTeamIds.size === 0) Object.values(selections || {}).forEach(arr => arr.forEach(id => compTeamIds.add(id)));

  // ── SVG Helpers ──
  const Ring = ({ pct, size = 64, stroke = 6, color, children }) => {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const p = Math.min(100, Math.max(0, pct));
    return (
      <svg width={size} height={size} style={{ display: "block" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.card2} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - p / 100)}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          fontSize={size * 0.22} fontWeight="900" fill={C.text} fontFamily="'Bebas Neue', sans-serif">
          {children}
        </text>
      </svg>
    );
  };

  const SectionHead = ({ icon, title }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 24 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'Bebas Neue', sans-serif" }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: C.border, marginLeft: 8 }} />
    </div>
  );

  const KidRow = ({ kid, right, sub, onClick }) => (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: onClick ? "pointer" : "default", borderBottom: `1px solid ${C.border}22` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kid.name}</div>
        {sub && <div style={{ fontSize: 10, color: C.textDim }}>{sub}</div>}
      </div>
      {right}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // TAB 1: OVERVIEW
  // ══════════════════════════════════════════════════════════════════
  const OverviewTab = () => {
    const gymList = config.gyms;

    // Per-gym stats
    const gymStats = gymList.map(gym => {
      const gKids = allActive.filter(k => kidInGym(k, gym));
      const gInactive = roster.filter(k => !k.active && kidInGym(k, gym));
      const gAvgWeekly = gKids.length ? gKids.reduce((s2, k) => s2 + kidWeeklyAvg(k.id, gym), 0) / gKids.length : 0;
      const gAssessed = gKids.filter(k => assessedIds.has(k.id)).length;
      const gScores = uniqueAssessed.filter(a => { const k2 = roster.find(x => x.id === a.kidId); return k2 && kidInGym(k2, gym); }).map(a => computeSubtotals(a.scores, config).final);
      const gAvgScore = gScores.length ? gScores.reduce((s2, v) => s2 + v, 0) / gScores.length : 0;
      const gAtRisk = gKids.filter(k => kidWeeklyAvg(k.id, gym) < 1).length;
      const gCompTeam = gKids.filter(k => compTeamIds.has(k.id)).length;
      return { gym, active: gKids.length, inactive: gInactive.length, avgWeekly: gAvgWeekly, assessed: gAssessed, avgScore: gAvgScore, atRisk: gAtRisk, compTeam: gCompTeam };
    });

    // Totals (scoped to filterGym when set — coaches/community see their gym only)
    const scopedKids = filterGym ? allActive.filter(k => kidInGym(k, filterGym)) : allActive;
    const totalActive = scopedKids.length;
    const totalAvgWeekly = totalActive ? scopedKids.reduce((s2, k) => s2 + kidWeeklyAvg(k.id, filterGym || null), 0) / totalActive : 0;
    const scopedAssessed = uniqueAssessed.filter(a => { const k2 = roster.find(x => x.id === a.kidId); return k2 && (!filterGym || kidInGym(k2, filterGym)); });
    const allScores = scopedAssessed.map(a => computeSubtotals(a.scores, config).final);
    const totalAvgScore = allScores.length ? allScores.reduce((s2, v) => s2 + v, 0) / allScores.length : 0;
    const totalAssessed = scopedKids.filter(k => assessedIds.has(k.id)).length;
    const totalAtRisk = scopedKids.filter(k => kidWeeklyAvg(k.id, filterGym || null) < 1).length;

    // Weekly trend (scoped to filterGym when set)
    const now = new Date();
    const weeklyTrend = [];
    for (let w = 0; w < 12; w++) {
      const wEnd = new Date(now); wEnd.setDate(now.getDate() - w * 7);
      const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 7);
      const startStr = wStart.toISOString().slice(0, 10);
      const endStr = wEnd.toISOString().slice(0, 10);
      const weekRecs = att90.filter(r => r.date > startStr && r.date <= endStr && (!filterGym || r.gym === filterGym));
      const att = weekRecs.reduce((s2, r) => s2 + Object.values(r.records || {}).filter(v => v === "attend").length, 0);
      const cls = weekRecs.length;
      weeklyTrend.unshift({ week: `W${12 - w}`, avg: cls ? parseFloat((att / cls).toFixed(1)) : 0, total: att, classes: cls });
    }
    const maxTrend = Math.max(...weeklyTrend.map(w => w.avg), 1);

    return (
      <>
        {/* Hero KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div style={{ ...s.card, padding: 16, background: `linear-gradient(135deg, ${C.card} 60%, ${C.red}08 100%)` }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Active Roster</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: C.text, fontFamily: "'Bebas Neue', sans-serif", lineHeight: 1 }}>{totalActive}</span>
              <span style={{ fontSize: 12, color: C.textDim }}>kids</span>
            </div>
            {totalAtRisk > 0 && <div style={{ fontSize: 10, color: C.red, marginTop: 4 }}>⚠ {totalAtRisk} at risk</div>}
          </div>
          <div style={{ ...s.card, padding: 16, background: `linear-gradient(135deg, ${C.card} 60%, ${C.green}08 100%)` }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Avg Attendance (90d)</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: totalAvgWeekly >= 3 ? C.green : totalAvgWeekly >= 2 ? C.orange : C.red, fontFamily: "'Bebas Neue', sans-serif", lineHeight: 1 }}>{totalAvgWeekly.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: C.textDim }}>cls/kid/wk</span>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 0 }}>
          <div style={{ ...s.card, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <Ring pct={totalActive ? (totalAssessed / totalActive * 100) : 0} size={56} stroke={5} color={totalAssessed === totalActive ? C.green : C.red}>
              {totalActive ? Math.round(totalAssessed / totalActive * 100) : 0}%
            </Ring>
            <div>
              <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.2 }}>Assessed</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{totalAssessed}/{totalActive}</div>
              <div style={{ fontSize: 10, color: C.textDim }}>{filterCycle}</div>
            </div>
          </div>
          <div style={{ ...s.card, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: totalAvgScore >= 3 ? `${C.green}18` : `${C.orange}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: totalAvgScore >= 4 ? C.green : totalAvgScore >= 3 ? C.orange : (totalAvgScore > 0 ? C.red : C.textDim), fontFamily: "'Bebas Neue', sans-serif", flexShrink: 0 }}>
              {totalAvgScore ? fmt(totalAvgScore) : "—"}
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.2 }}>Avg Score</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{totalAvgScore ? `${fmt(totalAvgScore)} / 5` : "No data"}</div>
              <div style={{ fontSize: 10, color: C.textDim }}>{filterCycle}</div>
            </div>
          </div>
        </div>

        {/* Gym Comparison Table (admin/master coach only) */}
        {isAdmin && gymList.length > 1 && (
          <>
            <SectionHead icon="🏢" title="Gym Comparison" />
            <div style={{ ...s.card, overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${gymList.length}, 1fr)`, gap: 0, fontSize: 11 }}>
                {/* Header */}
                <div style={{ padding: "8px 4px", fontWeight: 700, color: C.textDim, fontSize: 10, textTransform: "uppercase" }}></div>
                {gymStats.map(g => <div key={g.gym} style={{ padding: "8px 4px", fontWeight: 800, color: C.text, textAlign: "center", fontSize: 12 }}>{g.gym}</div>)}
                {/* Rows */}
                {[
                  { label: "Active", key: "active", fmt: v => v, color: v => C.text },
                  { label: "Avg cls/wk", key: "avgWeekly", fmt: v => v.toFixed(1), color: v => v >= 3 ? C.green : v >= 2 ? C.orange : C.red },
                  { label: "Avg Score", key: "avgScore", fmt: v => v ? fmt(v) : "—", color: v => v >= 4 ? C.green : v >= 3 ? C.orange : (v > 0 ? C.red : C.textDim) },
                  { label: "Assessed %", key: "assessed", fmt: (v, g) => g.active ? `${Math.round(v / g.active * 100)}%` : "—", color: (v, g) => g.active && v === g.active ? C.green : C.red },
                  { label: "At Risk", key: "atRisk", fmt: v => v, color: v => v === 0 ? C.green : v <= 2 ? C.orange : C.red },
                  { label: "Comp Team", key: "compTeam", fmt: v => v, color: v => C.text },
                ].map(row => (
                  <React.Fragment key={row.label}>
                    <div style={{ padding: "8px 4px", fontWeight: 600, color: C.textDim, fontSize: 10, borderTop: `1px solid ${C.border}22` }}>{row.label}</div>
                    {gymStats.map(g => (
                      <div key={g.gym} style={{ padding: "8px 4px", textAlign: "center", fontWeight: 800, fontSize: 14, color: row.color(g[row.key], g), fontFamily: "'Bebas Neue', sans-serif", borderTop: `1px solid ${C.border}22` }}>
                        {row.fmt(g[row.key], g)}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Weekly Attendance Trend */}
        <SectionHead icon="📈" title="Weekly Attendance (12wk)" />
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
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // TAB 2: GYM DEEP DIVE
  // ══════════════════════════════════════════════════════════════════
  const GymTab = () => {
    const gym = isAdmin ? deepGym : (loggedGym || config.gyms[0] || "");
    const gKids = allActive.filter(k => kidInGym(k, gym));
    const gAtt90 = att90.filter(r => r.gym === gym);
    const classTypes = config.classTypes || [];

    // ── Roster composition ──
    const beltOrder = config.belts || Object.keys(BELT_HEX);
    const beltCounts = {};
    beltOrder.forEach(b => beltCounts[b] = 0);
    gKids.forEach(k => { if (beltCounts[k.belt] !== undefined) beltCounts[k.belt]++; else beltCounts[k.belt] = 1; });
    const totalBelts = gKids.length;

    const AGE_CATS = ["U8","U10","U12","U14"];
    const AGE_COLORS = { U8: "#9C27B0", U10: "#2196F3", U12: "#FF9800", U14: "#E53935" };
    const ageDist = {};
    AGE_CATS.forEach(ac => ageDist[ac] = 0);
    gKids.forEach(k => { const ac = ageCat(ageAt(k.dob, today())); ageDist[ac] = (ageDist[ac] || 0) + 1; });
    const maxAge = Math.max(1, ...Object.values(ageDist));

    const WEIGHT_RANGES = [
      { label: "<18kg", min: 0, max: 18, color: "#26A69A" },
      { label: "18–22", min: 18, max: 22, color: "#42A5F5" },
      { label: "22–28", min: 22, max: 28, color: "#FFA726" },
      { label: "28–35", min: 28, max: 35, color: "#EF5350" },
      { label: "35+", min: 35, max: 999, color: "#AB47BC" },
    ];
    WEIGHT_RANGES.forEach(r => r.count = 0);
    gKids.forEach(k => { const wr = WEIGHT_RANGES.find(r => k.weight >= r.min && k.weight < r.max); if (wr) wr.count++; });
    const maxW = Math.max(1, ...WEIGHT_RANGES.map(r => r.count));

    // ── Classes ──
    const gymClassStats = {};
    gAtt90.forEach(r => {
      const ctId = r.classTypeId || "_unknown";
      if (!gymClassStats[ctId]) gymClassStats[ctId] = { sessions: 0, totalAttend: 0 };
      gymClassStats[ctId].sessions++;
      gymClassStats[ctId].totalAttend += Object.values(r.records || {}).filter(v => v === "attend").length;
    });
    const classRows = Object.entries(gymClassStats).map(([ctId, st]) => {
      const ct = classTypes.find(c => c.id === ctId);
      const cap = ct?.capacity || 25;
      const avgAtt = st.sessions > 0 ? st.totalAttend / st.sessions : 0;
      const fillPct = cap > 0 ? (avgAtt / cap) * 100 : 0;
      return { ctId, name: ct?.name || ctId, sessions: st.sessions, avgAtt, cap, fillPct, color: ct?.color || "#888", category: ct?.category || "group" };
    }).sort((a, b) => b.sessions - a.sessions);

    const dayCount = [0, 0, 0, 0, 0, 0, 0];
    gAtt90.forEach(r => { dayCount[new Date(r.date + "T12:00:00").getDay()]++; });
    const maxDayCount = Math.max(...dayCount, 1);

    // Weekly trend (gym-scoped)
    const now = new Date();
    const weeklyTrend = [];
    for (let w = 0; w < 12; w++) {
      const wEnd = new Date(now); wEnd.setDate(now.getDate() - w * 7);
      const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 7);
      const startStr = wStart.toISOString().slice(0, 10);
      const endStr = wEnd.toISOString().slice(0, 10);
      const weekRecs = gAtt90.filter(r => r.date > startStr && r.date <= endStr);
      const att2 = weekRecs.reduce((s2, r) => s2 + Object.values(r.records || {}).filter(v => v === "attend").length, 0);
      weeklyTrend.unshift({ week: `W${12 - w}`, avg: weekRecs.length ? parseFloat((att2 / weekRecs.length).toFixed(1)) : 0, classes: weekRecs.length });
    }
    const maxTrend = Math.max(...weeklyTrend.map(w => w.avg), 1);

    // ── Assessment ──
    const gAssessed = gKids.filter(k => assessedIds.has(k.id));
    const gOverdue = gKids.filter(k => !assessedIds.has(k.id));
    const gScores = gAssessed.map(k => latestByKid[k.id]).filter(Boolean).map(a => computeSubtotals(a.scores, config));
    const gAvgScore = gScores.length ? gScores.reduce((s2, v) => s2 + v.final, 0) / gScores.length : 0;

    // Category averages
    const catAvgs = {};
    Object.keys(config.criteria).forEach(cat => {
      const vals = gScores.map(sc => sc[cat]).filter(v => v > 0);
      catAvgs[cat] = vals.length ? vals.reduce((s2, v) => s2 + v, 0) / vals.length : 0;
    });
    const weakest = Object.entries(catAvgs).filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1])[0];
    const strongest = Object.entries(catAvgs).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];

    // Score distribution
    const buckets = [
      { label: "1–2", min: 0, max: 2, count: 0, color: "#e74c3c" },
      { label: "2–3", min: 2, max: 3, count: 0, color: "#ff9800" },
      { label: "3–4", min: 3, max: 4, count: 0, color: "#2196f3" },
      { label: "4–5", min: 4, max: 5.01, count: 0, color: "#4CAF50" },
    ];
    gScores.forEach(sc => { const b = buckets.find(b2 => sc.final >= b2.min && sc.final < b2.max); if (b) b.count++; });
    const maxBucket = Math.max(1, ...buckets.map(b => b.count));

    // Comp team
    const gCompTeam = gKids.filter(k => compTeamIds.has(k.id)).length;

    return (
      <>
        {/* Gym selector (admin only) */}
        {isAdmin && config.gyms.length > 1 && (
          <div style={{ display: "flex", marginBottom: 12, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {config.gyms.map(g => (
              <button key={g} onClick={() => setDeepGym(g)} style={{
                flex: 1, padding: "8px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
                background: gym === g ? C.red + "18" : "transparent",
                borderBottom: gym === g ? `2px solid ${C.red}` : "2px solid transparent",
                color: gym === g ? C.red : C.textDim, transition: "all 0.15s",
              }}>{g}</button>
            ))}
          </div>
        )}
        {!isAdmin && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8, fontWeight: 600 }}>📍 {gym}</div>}

        {/* Summary row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
          {[
            { label: "Active", value: gKids.length, color: C.text },
            { label: "Avg/wk", value: gKids.length ? (gKids.reduce((s2, k) => s2 + kidWeeklyAvg(k.id, gym), 0) / gKids.length).toFixed(1) : "0", color: C.green },
            { label: "Avg Score", value: gAvgScore ? fmt(gAvgScore) : "—", color: C.orange },
            { label: "Comp", value: gCompTeam, color: C.red },
          ].map((m, i) => (
            <div key={i} style={{ ...s.card, textAlign: "center", padding: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: m.color, fontFamily: "'Bebas Neue', sans-serif" }}>{m.value}</div>
              <div style={{ fontSize: 8, color: C.textDim, textTransform: "uppercase" }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Roster Composition */}
        <SectionHead icon="👥" title="Roster" />
        {totalBelts > 0 && (
          <div style={s.card}>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Belt Distribution</div>
            <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
              {beltOrder.filter(b => beltCounts[b] > 0).map(b => (
                <div key={b} title={`${b}: ${beltCounts[b]}`} style={{
                  width: `${(beltCounts[b] / totalBelts) * 100}%`, background: BELT_HEX[b] || "#888",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "width 0.4s",
                  minWidth: beltCounts[b] > 0 ? 16 : 0,
                }}>
                  {beltCounts[b] >= 2 && <span style={{ fontSize: 10, fontWeight: 800, color: b === "White" || b === "Yellow-White" || b === "Yellow" ? "#222" : "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>{beltCounts[b]}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {beltOrder.filter(b => beltCounts[b] > 0).map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.textDim }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: BELT_HEX[b] || "#888" }} />
                  {b} ({beltCounts[b]})
                </div>
              ))}
            </div>
          </div>
        )}
        {gKids.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={s.card}>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Age Distribution</div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70, marginBottom: 8 }}>
                {AGE_CATS.map(ac => (
                  <div key={ac} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {ageDist[ac] > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: AGE_COLORS[ac], marginBottom: 3 }}>{ageDist[ac]}</div>}
                    <div style={{ width: "100%", height: Math.max((ageDist[ac] / maxAge) * 60, 2), background: AGE_COLORS[ac], borderRadius: 4, opacity: ageDist[ac] > 0 ? 0.85 : 0.15, transition: "height 0.4s" }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>{AGE_CATS.map(ac => <div key={ac} style={{ flex: 1, textAlign: "center", fontSize: 10, color: C.textDim, fontWeight: 600 }}>{ac}</div>)}</div>
            </div>
            <div style={s.card}>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Weight Distribution</div>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 70, marginBottom: 8 }}>
                {WEIGHT_RANGES.map(wr => (
                  <div key={wr.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {wr.count > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: wr.color, marginBottom: 3 }}>{wr.count}</div>}
                    <div style={{ width: "100%", height: Math.max((wr.count / maxW) * 60, 2), background: wr.color, borderRadius: 4, opacity: wr.count > 0 ? 0.85 : 0.15, transition: "height 0.4s" }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4 }}>{WEIGHT_RANGES.map(wr => <div key={wr.label} style={{ flex: 1, textAlign: "center", fontSize: 9, color: C.textDim }}>{wr.label}</div>)}</div>
            </div>
          </div>
        )}

        {/* Classes */}
        <SectionHead icon="📋" title="Classes (90 days)" />
        {classRows.length > 0 ? (
          <>
            <div style={s.card}>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Fill Rates</div>
              {classRows.map((cr, i) => (
                <div key={cr.ctId} style={{ padding: "10px 0", borderBottom: i < classRows.length - 1 ? `1px solid ${C.border}22` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 4, height: 28, borderRadius: 2, background: cr.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{cr.name}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>{cr.sessions} sessions</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: cr.fillPct >= 80 ? C.green : cr.fillPct >= 50 ? C.orange : C.textDim, fontFamily: "'Bebas Neue', sans-serif" }}>{cr.avgAtt.toFixed(1)}</div>
                      <div style={{ fontSize: 9, color: C.textDim }}>avg / {cr.cap} cap</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: C.card2, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, cr.fillPct)}%`, height: "100%", background: cr.fillPct >= 80 ? C.green : cr.fillPct >= 50 ? C.orange : C.red, borderRadius: 4, transition: "width 0.4s" }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cr.fillPct >= 80 ? C.green : cr.fillPct >= 50 ? C.orange : C.red, minWidth: 36, textAlign: "right" }}>{Math.round(cr.fillPct)}%</span>
                  </div>
                </div>
              ))}
            </div>
            {weeklyTrend.some(w => w.classes > 0) && (
              <div style={s.card}>
                <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Avg Participants / Week</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
                  {weeklyTrend.map((w, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ fontSize: 8, color: C.textDim, marginBottom: 2 }}>{w.avg || ""}</div>
                      <div style={{ width: "100%", borderRadius: 3, background: w.classes > 0 ? C.green : C.card2, height: `${Math.max(2, (w.avg / maxTrend) * 60)}px`, transition: "height 0.3s" }} />
                      <div style={{ fontSize: 7, color: C.textDim, marginTop: 2 }}>{w.week}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={s.card}>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Classes by Day</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
                {DAY_SHORT.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>{dayCount[i] || ""}</div>
                    <div style={{ width: "100%", borderRadius: 3, background: dayCount[i] > 0 ? C.blue : C.card2, height: `${Math.max(2, (dayCount[i] / maxDayCount) * 50)}px`, transition: "height 0.3s" }} />
                    <div style={{ fontSize: 9, color: dayCount[i] > 0 ? C.text : C.textDim, marginTop: 3, fontWeight: 600 }}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ ...s.card, textAlign: "center", color: C.textDim, fontSize: 12 }}>No class data</div>
        )}

        {/* Assessments */}
        <SectionHead icon="📝" title={`Assessment · ${filterCycle}`} />
        {gScores.length > 0 && (
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Score Distribution</div>
              <div style={{ fontSize: 11, color: C.textDim }}>Avg: <span style={{ fontWeight: 800, color: gAvgScore >= 4 ? C.green : gAvgScore >= 3 ? C.orange : C.red, fontSize: 14 }}>{fmt(gAvgScore)}</span></div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70, marginBottom: 8 }}>
              {buckets.map(b => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {b.count > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: b.color, marginBottom: 3 }}>{b.count}</div>}
                  <div style={{ width: "100%", height: Math.max((b.count / maxBucket) * 60, 2), background: b.color, borderRadius: 4, opacity: b.count > 0 ? 0.85 : 0.2, transition: "height 0.4s" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>{buckets.map(b => <div key={b.label} style={{ flex: 1, textAlign: "center", fontSize: 9, color: C.textDim }}>{b.label}</div>)}</div>
          </div>
        )}

        {/* Category strengths */}
        {gScores.length > 0 && (
          <div style={s.card}>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Category Averages</div>
            {Object.entries(catAvgs).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([cat, avg]) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: CATEGORY_COLORS[cat] || C.text, width: 90 }}>{cat}</span>
                <div style={{ flex: 1, height: 8, background: C.card2, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(avg / 5) * 100}%`, height: "100%", background: CATEGORY_COLORS[cat] || C.red, borderRadius: 4, transition: "width 0.4s" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: CATEGORY_COLORS[cat] || C.text, minWidth: 30, textAlign: "right" }}>{fmt(avg)}</span>
              </div>
            ))}
            {weakest && strongest && weakest[0] !== strongest[0] && (
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 8, padding: "8px 10px", background: C.card2, borderRadius: 8 }}>
                💪 Strongest: <b style={{ color: CATEGORY_COLORS[strongest[0]] }}>{strongest[0]}</b> ({fmt(strongest[1])}) · 📉 Growth area: <b style={{ color: CATEGORY_COLORS[weakest[0]] }}>{weakest[0]}</b> ({fmt(weakest[1])})
              </div>
            )}
          </div>
        )}

        {/* Overdue */}
        <div style={{ ...s.card, borderLeft: gOverdue.length > 0 ? `3px solid ${C.red}` : `3px solid ${C.green}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: gOverdue.length > 0 ? 10 : 0 }}>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
              {gOverdue.length > 0 ? `⏰ Not Yet Assessed (${gOverdue.length})` : "✓ All Assessed"}
            </div>
            {gOverdue.length > 0 && !readOnly && (
              <button style={{ ...s.btnSm, background: C.red, color: "#fff", fontSize: 10, padding: "4px 10px" }} onClick={() => onScore()}>Score Now</button>
            )}
          </div>
          {gOverdue.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {gOverdue.map(k => (
                <button key={k.id} onClick={() => onViewProfile(k.id)} style={{
                  padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: `${C.red}11`, border: `1px solid ${C.red}33`, color: C.text, cursor: "pointer",
                }}>{k.name}</button>
              ))}
            </div>
          )}
        </div>

        {/* Comp Team */}
        <SectionHead icon="🏆" title="Competition Team" />
        <CompetitionTeamView roster={roster} assessments={assessments} config={config} selections={selections} attendance={attendance} filterCycle={filterCycle} filterGym={gym} onViewProfile={onViewProfile} />
      </>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // TAB 3: RETENTION & OUTREACH
  // ══════════════════════════════════════════════════════════════════
  const RetentionTab = () => {
    const gym = filterGym;
    const kids = allActive.filter(k => !gym || kidInGym(k, gym));
    const ret = config.retentionRules || { coldAfterDays: 14, churnAfterDays: 60, coolingFromWeekly: 2, coolingToWeekly: 1, newWindowDays: 60, newMinWeekly: 2, contactSnoozeDays: 14 };
    const cLog = config.contactLog || [];

    const now = new Date();
    const dCold = new Date(now); dCold.setDate(dCold.getDate() - (ret.coldAfterDays || 14));
    const cutoffCold = dCold.toISOString().slice(0, 10);
    const dChurn = new Date(now); dChurn.setDate(dChurn.getDate() - (ret.churnAfterDays || 60));
    const cutoffChurn = dChurn.toISOString().slice(0, 10);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const cutoff30 = d30.toISOString().slice(0, 10);
    const prevMonth = new Date(d30); prevMonth.setDate(prevMonth.getDate() - 30);
    const cutoffPrev = prevMonth.toISOString().slice(0, 10);
    const dNew = new Date(now); dNew.setDate(dNew.getDate() - (ret.newWindowDays || 60));
    const cutoffNew = dNew.toISOString().slice(0, 10);
    const snoozeDays = ret.contactSnoozeDays || 14;

    // Last attendance date per kid
    const lastAtt = {};
    (attendance || []).filter(r => !gym || r.gym === gym).forEach(r => {
      Object.entries(r.records || {}).forEach(([kidId, status]) => {
        if (status === "attend" && (!lastAtt[kidId] || r.date > lastAtt[kidId])) lastAtt[kidId] = r.date;
      });
    });

    const daysSince = (dateStr) => dateStr ? Math.floor((now - new Date(dateStr)) / 86400000) : 999;

    // Snoozed kid check: was contacted within snoozeDays for this reason?
    const isSnoozed = (kidId, reason) => {
      return cLog.some(c => c.kidId === kidId && c.reason === reason && daysSince(c.date) < snoozeDays);
    };

    const markContacted = (kidId, reason) => {
      setConfig(p => ({
        ...p,
        contactLog: [...(p.contactLog || []), { kidId, reason, date: today(), by: loggedCoach || "Unknown" }],
      }));
    };

    // ── 🔴 Gone Cold: no attendance in coldAfterDays–churnAfterDays range ──
    const goneCold = kids.filter(k => {
      const la = lastAtt[k.id];
      return la && la < cutoffCold && la >= cutoffChurn;
    }).filter(k => !isSnoozed(k.id, "cold"))
      .map(k => ({ kid: k, lastDate: lastAtt[k.id], days: daysSince(lastAtt[k.id]) }))
      .sort((a, b) => b.days - a.days);

    // Churned: past churnAfterDays — shown separately as "should be set inactive"
    const churned = kids.filter(k => {
      const la = lastAtt[k.id];
      return la && la < cutoffChurn;
    }).map(k => ({ kid: k, lastDate: lastAtt[k.id], days: daysSince(lastAtt[k.id]) }))
      .sort((a, b) => b.days - a.days);

    // ── 🟡 Cooling Off ──
    const coolingOff = kids.filter(k => {
      if (goneCold.some(g => g.kid.id === k.id) || churned.some(g => g.kid.id === k.id)) return false;
      if (isSnoozed(k.id, "cooling")) return false;
      const prevRecs = (attendance || []).filter(r => r.date >= cutoffPrev && r.date < cutoff30 && (!gym || r.gym === gym) && r.records?.[k.id] === "attend").length;
      const currRecs = (attendance || []).filter(r => r.date >= cutoff30 && (!gym || r.gym === gym) && r.records?.[k.id] === "attend").length;
      const prevAvg = prevRecs / 4;
      const currAvg = currRecs / 4;
      return prevAvg >= (ret.coolingFromWeekly || 2) && currAvg < (ret.coolingToWeekly || 1);
    }).map(k => {
      const prevRecs = (attendance || []).filter(r => r.date >= cutoffPrev && r.date < cutoff30 && (!gym || r.gym === gym) && r.records?.[k.id] === "attend").length;
      const currRecs = (attendance || []).filter(r => r.date >= cutoff30 && (!gym || r.gym === gym) && r.records?.[k.id] === "attend").length;
      return { kid: k, prevAvg: (prevRecs / 4).toFixed(1), currAvg: (currRecs / 4).toFixed(1), lastDate: lastAtt[k.id], days: daysSince(lastAtt[k.id]) };
    }).sort((a, b) => b.days - a.days);

    // ── 🟢 New & Fragile ──
    const newFragile = kids.filter(k => {
      if (goneCold.some(g => g.kid.id === k.id) || churned.some(g => g.kid.id === k.id) || coolingOff.some(g => g.kid.id === k.id)) return false;
      if (isSnoozed(k.id, "new")) return false;
      const firstAtt = (attendance || []).filter(r => (!gym || r.gym === gym) && r.records?.[k.id] === "attend").map(r => r.date).sort()[0];
      const isNew = (k.joinDate && k.joinDate >= cutoffNew) || (firstAtt && firstAtt >= cutoffNew);
      if (!isNew) return false;
      const avg = kidWeeklyAvg(k.id, gym || null);
      return avg < (ret.newMinWeekly || 2);
    }).map(k => ({ kid: k, avg: kidWeeklyAvg(k.id, gym || null), lastDate: lastAtt[k.id], days: daysSince(lastAtt[k.id]) }))
      .sort((a, b) => a.avg - b.avg);

    // ── ⭐ Promotion Ready ──
    const rules = config.promotionRules || { stripeClasses: 10, beltClasses: 40, beltMonths: 9, stripesForBelt: 4 };
    const promoReady = kids.map(kid => {
      const stripes = kid.stripes || 0;
      const lastPromo = kid.lastPromotionDate || kid.joinDate || "2020-01-01";
      const classes = (attendance || []).filter(r => r.date > lastPromo && r.records?.[kid.id] === "attend").length + (kid.classCountOffset || 0);
      const beltIdx = config.belts.indexOf(kid.belt);
      const hasNextBelt = beltIdx < config.belts.length - 1;
      const dp = new Date(lastPromo);
      const months = (now.getFullYear() - dp.getFullYear()) * 12 + now.getMonth() - dp.getMonth();
      const stripeReady = stripes < (rules.stripesForBelt || 4) && classes >= (rules.stripeClasses || 10);
      const beltReady = hasNextBelt && stripes >= (rules.stripesForBelt || 4) && classes >= (rules.beltClasses || 40) && months >= (rules.beltMonths || 9);
      if (!stripeReady && !beltReady) return null;
      return { kid, stripeReady, beltReady };
    }).filter(Boolean);

    // ── 📈 Big Score Jump ──
    const prevCycleIdx = config.cycles.indexOf(filterCycle) - 1;
    const prevCycle = prevCycleIdx >= 0 ? config.cycles[prevCycleIdx] : null;
    const bigJumps = prevCycle ? kids.map(k => {
      const curr = latestByKid[k.id];
      if (!curr) return null;
      const prev = assessments.filter(a => a.cycle === prevCycle && a.kidId === k.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!prev) return null;
      const currScore = computeSubtotals(curr.scores, config).final;
      const prevScore = computeSubtotals(prev.scores, config).final;
      const delta = currScore - prevScore;
      if (delta < 0.3) return null;
      return { kid: k, currScore, prevScore, delta };
    }).filter(Boolean).sort((a, b) => b.delta - a.delta) : [];

    const totalActions = goneCold.length + coolingOff.length + newFragile.length;

    const DaysAgo = ({ days }) => (
      <span style={{ fontSize: 10, fontWeight: 700, color: days > 21 ? "#e74c3c" : days > 14 ? C.orange : C.textDim }}>
        {days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`}
      </span>
    );

    const ContactBtn = ({ kidId, reason }) => (
      <button onClick={(e) => { e.stopPropagation(); markContacted(kidId, reason); }} title="Mark as contacted" style={{
        padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent",
        color: C.textDim, fontSize: 10, cursor: "pointer", flexShrink: 0, marginLeft: 6,
      }}>✓ Contacted</button>
    );

    return (
      <>
        {/* Gym filter */}
        {isAdmin && config.gyms.length > 1 && (
          <div style={{ display: "flex", marginBottom: 12, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
            <button onClick={() => setFilterGym("")} style={{
              flex: 1, padding: "8px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
              background: !filterGym ? C.red + "18" : "transparent",
              borderBottom: !filterGym ? `2px solid ${C.red}` : "2px solid transparent",
              color: !filterGym ? C.red : C.textDim,
            }}>All</button>
            {config.gyms.map(g => (
              <button key={g} onClick={() => setFilterGym(g)} style={{
                flex: 1, padding: "8px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
                background: filterGym === g ? C.red + "18" : "transparent",
                borderBottom: filterGym === g ? `2px solid ${C.red}` : "2px solid transparent",
                color: filterGym === g ? C.red : C.textDim,
              }}>{g}</button>
            ))}
          </div>
        )}

        {/* Action summary */}
        <div style={{ ...s.card, padding: 16, marginBottom: 8, background: totalActions > 0 ? `linear-gradient(135deg, ${C.card} 60%, #e74c3c08 100%)` : `linear-gradient(135deg, ${C.card} 60%, ${C.green}08 100%)` }}>
          <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Action Items</div>
          {totalActions > 0 ? (
            <div style={{ display: "flex", gap: 16 }}>
              {goneCold.length > 0 && <div><span style={{ fontSize: 20, fontWeight: 900, color: "#e74c3c", fontFamily: "'Bebas Neue', sans-serif" }}>{goneCold.length}</span><span style={{ fontSize: 10, color: C.textDim, marginLeft: 4 }}>gone cold</span></div>}
              {coolingOff.length > 0 && <div><span style={{ fontSize: 20, fontWeight: 900, color: C.orange, fontFamily: "'Bebas Neue', sans-serif" }}>{coolingOff.length}</span><span style={{ fontSize: 10, color: C.textDim, marginLeft: 4 }}>cooling off</span></div>}
              {newFragile.length > 0 && <div><span style={{ fontSize: 20, fontWeight: 900, color: C.blue, fontFamily: "'Bebas Neue', sans-serif" }}>{newFragile.length}</span><span style={{ fontSize: 10, color: C.textDim, marginLeft: 4 }}>new & fragile</span></div>}
            </div>
          ) : (
            <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>✓ No urgent outreach needed</div>
          )}
        </div>

        {/* 🔴 Gone Cold */}
        <SectionHead icon="🔴" title={`Gone Cold · ${goneCold.length}`} />
        {goneCold.length === 0 ? (
          <div style={{ ...s.card, textAlign: "center", color: C.green, fontSize: 12, padding: 16 }}>✓ No kids gone cold</div>
        ) : (
          <div style={s.card}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8 }}>No attendance in {ret.coldAfterDays}–{ret.churnAfterDays} days — reach out now</div>
            {goneCold.map(g => (
              <KidRow key={g.kid.id} kid={g.kid} onClick={() => onViewProfile(g.kid.id)}
                sub={`${kidGymsStr(g.kid)} · ${g.kid.belt} · Last: ${g.lastDate}`}
                right={<><DaysAgo days={g.days} /><ContactBtn kidId={g.kid.id} reason="cold" /></>} />
            ))}
          </div>
        )}

        {/* ⚫ Churned */}
        {churned.length > 0 && (
          <>
            <SectionHead icon="⚫" title={`Likely Churned · ${churned.length}`} />
            <div style={s.card}>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8 }}>No attendance in {ret.churnAfterDays}+ days — consider setting inactive</div>
              {churned.map(g => (
                <KidRow key={g.kid.id} kid={g.kid} onClick={() => onViewProfile(g.kid.id)}
                  sub={`${kidGymsStr(g.kid)} · ${g.kid.belt} · Last: ${g.lastDate}`}
                  right={<DaysAgo days={g.days} />} />
              ))}
            </div>
          </>
        )}

        {/* 🟡 Cooling Off */}
        <SectionHead icon="🟡" title={`Cooling Off · ${coolingOff.length}`} />
        {coolingOff.length === 0 ? (
          <div style={{ ...s.card, textAlign: "center", color: C.green, fontSize: 12, padding: 16 }}>✓ No one cooling off</div>
        ) : (
          <div style={s.card}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8 }}>Was {ret.coolingFromWeekly}+/wk last month → &lt;{ret.coolingToWeekly}/wk now — check in</div>
            {coolingOff.map(g => (
              <KidRow key={g.kid.id} kid={g.kid} onClick={() => onViewProfile(g.kid.id)}
                sub={`${kidGymsStr(g.kid)} · ${g.prevAvg}→${g.currAvg}/wk`}
                right={<><DaysAgo days={g.days} /><ContactBtn kidId={g.kid.id} reason="cooling" /></>} />
            ))}
          </div>
        )}

        {/* 🟢 New & Fragile */}
        <SectionHead icon="🟢" title={`New & Fragile · ${newFragile.length}`} />
        {newFragile.length === 0 ? (
          <div style={{ ...s.card, textAlign: "center", color: C.green, fontSize: 12, padding: 16 }}>✓ All new kids on track</div>
        ) : (
          <div style={s.card}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8 }}>Joined in last {ret.newWindowDays} days, attending &lt;{ret.newMinWeekly}/wk — encourage consistency</div>
            {newFragile.map(g => (
              <KidRow key={g.kid.id} kid={g.kid} onClick={() => onViewProfile(g.kid.id)}
                sub={`${kidGymsStr(g.kid)} · ${g.kid.belt} · ${g.avg}/wk`}
                right={<><DaysAgo days={g.days} /><ContactBtn kidId={g.kid.id} reason="new" /></>} />
            ))}
          </div>
        )}

        {/* ⭐ Positive: Promotion Ready */}
        {promoReady.length > 0 && (
          <>
            <SectionHead icon="⭐" title={`Promotion Ready · ${promoReady.length}`} />
            <div style={s.card}>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8 }}>Great news to share with parents</div>
              {promoReady.map(p => (
                <KidRow key={p.kid.id} kid={p.kid} onClick={() => onViewProfile(p.kid.id)}
                  sub={`${kidGymsStr(p.kid)} · ${p.kid.belt} · ${p.kid.stripes || 0} stripes`}
                  right={<span style={{ fontSize: 10, fontWeight: 700, color: p.beltReady ? C.red : C.green }}>{p.beltReady ? "🥋 Belt" : "⭐ Stripe"}</span>} />
              ))}
            </div>
          </>
        )}

        {/* 📈 Big Score Jumps */}
        {bigJumps.length > 0 && (
          <>
            <SectionHead icon="📈" title={`Score Improvement · ${bigJumps.length}`} />
            <div style={s.card}>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8 }}>Significant improvement vs {prevCycle} — share the progress</div>
              {bigJumps.map(j => (
                <KidRow key={j.kid.id} kid={j.kid} onClick={() => onViewProfile(j.kid.id)}
                  sub={`${kidGymsStr(j.kid)} · ${fmt(j.prevScore)} → ${fmt(j.currScore)}`}
                  right={<span style={{ fontSize: 12, fontWeight: 800, color: C.green }}>+{fmt(j.delta)}</span>} />
              ))}
            </div>
          </>
        )}
      </>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Reports</h1>
        <PageHelp page="reports" />
      </div>

      {/* Report sub-tabs */}
      <div style={{ display: "flex", marginBottom: 12, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {[{ key: "overview", label: "🏢 Overview" }, { key: "gym", label: "📍 Gym" }, { key: "retention", label: "📞 Outreach" }].map(t => (
          <button key={t.key} onClick={() => setReportTab(t.key)} style={{
            flex: 1, padding: "8px 4px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
            background: reportTab === t.key ? C.red + "18" : "transparent",
            borderBottom: reportTab === t.key ? `2px solid ${C.red}` : "2px solid transparent",
            color: reportTab === t.key ? C.red : C.textDim, transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Cycle filter (shared) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <select style={{ ...s.select, width: "auto", minWidth: 120 }} value={filterCycle} onChange={e => setFilterCycle(e.target.value)}>
          {config.cycles.filter(c => isQuarterClosed(c)).map(c => <option key={c}>{c}</option>)}
        </select>
        {reportTab !== "gym" && isAdmin && config.gyms.length > 1 && (
          <select style={{ ...s.select, width: "auto", minWidth: 100 }} value={filterGym} onChange={e => setFilterGym(e.target.value)}>
            <option value="">All Gyms</option>
            {config.gyms.map(g => <option key={g}>{g}</option>)}
          </select>
        )}
        {!isAdmin && <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>📍 {loggedGym}</span>}
      </div>

      {reportTab === "overview" && <OverviewTab />}
      {reportTab === "gym" && <GymTab />}
      {reportTab === "retention" && <RetentionTab />}
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
  const sections = { coaches: "Coaches", community: "Community", gyms: "Gyms", classes: "Classes", belts: "Belts", cycles: "Cycles", weights: "Weight Rules", scoring: "Scoring Weights", promotion: "Promotion", retention: "Retention", admin: "Admin", reset: "Reset" };

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
      {section === "retention" && (
        <div>
          <h2 style={s.h2}>Retention & Outreach Rules</h2>
          <div style={s.card}>
            <label style={s.label}>Gone Cold After (days)</label>
            <input style={s.input} type="number" min={1} value={config.retentionRules?.coldAfterDays || 14}
              onChange={e => setConfig(p => ({ ...p, retentionRules: { ...(p.retentionRules || {}), coldAfterDays: parseInt(e.target.value) || 14 } }))} />
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Days without attendance before kid appears in "Gone Cold" list</div>

            <label style={s.label}>Churned After (days)</label>
            <input style={s.input} type="number" min={1} value={config.retentionRules?.churnAfterDays || 60}
              onChange={e => setConfig(p => ({ ...p, retentionRules: { ...(p.retentionRules || {}), churnAfterDays: parseInt(e.target.value) || 60 } }))} />
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Days without attendance → "Likely Churned" (should be set inactive)</div>

            <label style={s.label}>Cooling Off: Was Training (cls/wk)</label>
            <input style={s.input} type="number" min={1} step={0.5} value={config.retentionRules?.coolingFromWeekly || 2}
              onChange={e => setConfig(p => ({ ...p, retentionRules: { ...(p.retentionRules || {}), coolingFromWeekly: parseFloat(e.target.value) || 2 } }))} />
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Previous month threshold — was attending at least this many classes/week</div>

            <label style={s.label}>Cooling Off: Dropped Below (cls/wk)</label>
            <input style={s.input} type="number" min={0} step={0.5} value={config.retentionRules?.coolingToWeekly || 1}
              onChange={e => setConfig(p => ({ ...p, retentionRules: { ...(p.retentionRules || {}), coolingToWeekly: parseFloat(e.target.value) || 1 } }))} />
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Current month threshold — now attending less than this</div>

            <label style={s.label}>New Kid Window (days)</label>
            <input style={s.input} type="number" min={1} value={config.retentionRules?.newWindowDays || 60}
              onChange={e => setConfig(p => ({ ...p, retentionRules: { ...(p.retentionRules || {}), newWindowDays: parseInt(e.target.value) || 60 } }))} />
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Kids who joined within this many days are flagged if fragile</div>

            <label style={s.label}>New Kid Min Attendance (cls/wk)</label>
            <input style={s.input} type="number" min={0} step={0.5} value={config.retentionRules?.newMinWeekly || 2}
              onChange={e => setConfig(p => ({ ...p, retentionRules: { ...(p.retentionRules || {}), newMinWeekly: parseFloat(e.target.value) || 2 } }))} />
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>New kids attending below this are flagged as "fragile"</div>

            <label style={s.label}>Contact Snooze (days)</label>
            <input style={s.input} type="number" min={1} value={config.retentionRules?.contactSnoozeDays || 14}
              onChange={e => setConfig(p => ({ ...p, retentionRules: { ...(p.retentionRules || {}), contactSnoozeDays: parseInt(e.target.value) || 14 } }))} />
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>After marking "Contacted", kid is hidden from that list for this many days</div>
          </div>

          {/* Contact Log */}
          {(config.contactLog || []).length > 0 && (
            <>
              <h2 style={{ ...s.h2, marginTop: 20 }}>Contact Log</h2>
              <div style={s.card}>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>{(config.contactLog || []).length} entries</div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {(config.contactLog || []).slice().reverse().slice(0, 50).map((c, i) => {
                    const kid = roster.find(k => k.id === c.kidId);
                    return (
                      <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 11 }}>
                        <span style={{ color: C.textDim }}>{c.date}</span>
                        <span style={{ color: C.text, fontWeight: 600 }}>{kid?.name || c.kidId}</span>
                        <span style={{ color: C.textDim }}>{c.reason}</span>
                        <span style={{ color: C.textDim, marginLeft: "auto" }}>by {c.by}</span>
                      </div>
                    );
                  })}
                </div>
                <button style={{ ...s.btnDanger, marginTop: 10, width: "100%", fontSize: 11 }} onClick={() => {
                  if (confirm("Clear all contact log entries?")) setConfig(p => ({ ...p, contactLog: [] }));
                }}>Clear Contact Log</button>
              </div>
            </>
          )}
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
            !isCommunity && <button style={{ ...s.btn, width: "100%", marginTop: 10, background: C.orange }} onClick={() => awardBelt(e.kid)}>
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
            !isCommunity && <button style={{ ...s.btn, width: "100%", marginTop: 10, background: C.green }} onClick={() => awardStripe(e.kid)}>
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
function ClassesScreen({ roster, attendance, setAttendance, config, loggedGym, isAdmin, selections, loggedCoach }) {
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
    const now = new Date().toISOString();
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
      if (existing >= 0) {
        const prev2 = arr[existing];
        const rec = { ...prev2, ...base, records: newRecords, updatedBy: loggedCoach || "Unknown", updatedAt: now };
        const next = [...arr]; next[existing] = rec; return next;
      }
      const rec = { ...base, records: newRecords, createdBy: loggedCoach || "Unknown", createdAt: now };
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
      createdBy: loggedCoach || "Unknown", createdAt: new Date().toISOString(),
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
          <div style={{ fontSize: 11, marginTop: 4 }}>Add classes in Settings, or add a PT below</div>
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
                {card.type === "adhoc" && <button onClick={e => { e.stopPropagation(); if (confirm("Delete this PT session?")) { setAttendance(prev => (prev || []).filter(r => r.key !== card.recKey)); setExpanded(null); } }} style={{ marginLeft: "auto", background: "none", border: "1px solid #e74c3c44", borderRadius: 4, color: "#e74c3c", fontSize: 10, padding: "2px 8px", cursor: "pointer" }}>Delete PT</button>}
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

      {/* PT button / form */}
      {!quickClass ? (
        <button onClick={startQuickClass} style={{
          ...s.btnSm, width: "100%", padding: 12, fontSize: 12, marginTop: 8,
          borderStyle: "dashed", textAlign: "center", color: C.textDim,
        }}>+ PT</button>
      ) : (
        <div style={{ ...s.card, marginTop: 8, borderLeft: `3px solid #9C27B0` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>PT Session</div>
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
              }}>● {ct.name}</button>
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
                  {r.adhoc && <span style={{ color: "#9C27B0" }}> · PT</span>}
                </div>
                {(r.createdBy || r.updatedBy) && (
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, paddingLeft: 14, opacity: 0.7 }}>
                    {r.createdBy && <>📝 {r.createdBy}{r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })} ${new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</>}
                    {r.updatedBy && <>{r.createdBy ? " · " : ""}✏️ {r.updatedBy}{r.updatedAt ? ` · ${new Date(r.updatedAt).toLocaleDateString("en", { month: "short", day: "numeric" })} ${new Date(r.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</>}
                  </div>
                )}

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

  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h1 style={{ ...s.h1, margin: 0 }}>Classes</h1>
        <PageHelp page="attendance" />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", marginBottom: 12, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {[{ key: "schedule", label: "📅 Schedule" }, { key: "record", label: "📋 Record" }, { key: "history", label: "📖 History" }].map(t => (
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
        { en: "Academy dashboard filtered by cycle and gym. Hero cards show active roster, avg attendance, assessment coverage, and comp team size.", zh: "学院仪表盘，按周期和道馆筛选。顶部卡片显示活跃学员、平均出勤、评估覆盖率和竞赛队规模。" },
        { en: "Roster Health: belt, age (U8–U14), and weight distribution charts. Per-gym breakdown with attendance and score averages.", zh: "学员健康：腰带、年龄（U8–U14）和体重分布图。各道馆出勤和成绩平均值。" },
        { en: "Attendance: top 5 most consistent kids and at-risk kids (below 1 class/week).", zh: "出勤：最稳定的前5名学员和需关注学员（每周不足1节课）。" },
        { en: "Classes: average attendance per class type with fill rate bars (green ≥80%, orange ≥50%, red <50%).", zh: "课程：每种课程类型的平均出勤率，填充率条形图（绿色≥80%，橙色≥50%，红色<50%）。" },
        { en: "Assessment: score distribution chart and overdue kids list with Score Now shortcut.", zh: "评估：成绩分布图和未评估学员名单，可直接跳转评分。" },
        { en: "Competition Team: athletes grouped by bracket with scores and attendance stats.", zh: "竞赛队：按组别分组的运动员及其成绩和出勤统计。" },
      ],
      visual: { type: "stats", items: [
        { label: "Active", value: "45" },
        { label: "Avg Att.", value: "2.8", sub: "cls/wk" },
        { label: "Assessed", value: "84%", sub: "38/45" },
        { label: "Comp", value: "12" },
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
        { en: "Use the + PT button to create ad-hoc PT sessions.", zh: "使用「快速课程」按钮添加私教或临时课程。" },
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
        const typeLabels = { login: "🔑 Login", assessment_new: "📝 New Assessment", assessment_edit: "✏️ Edit Assessment", assessment_pending: "⏳ Pending Assessment", assessment_approved: "✅ Approved Assessment", assessment_rejected: "❌ Rejected Assessment" };
        const typeColors = { login: "#64B5F6", assessment_new: "#4CAF50", assessment_edit: "#FFA726", assessment_pending: "#FF9800", assessment_approved: "#4CAF50", assessment_rejected: "#E53935" };
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
  { key: "roster", icon: "👥", label: "Students" },
  { key: "classes", icon: "📋", label: "Classes" },
  { key: "score", icon: "📝", label: "Score" },
  { key: "more", icon: "☰", label: "More" },
];
const NAV_MORE = [
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
  const [assessments, setAssessments, assLoaded, setAssessmentsNow] = useStorage("bushido:assessments", null);
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

  // Migrate "Mobility" → "Coordination" in assessment scores and config criteria
  useEffect(() => {
    if (!assLoaded || !Array.isArray(assessments)) return;
    const needsMigration = assessments.some(a => a.scores && ("Mobility" in a.scores) && !("Coordination" in a.scores));
    if (!needsMigration) return;
    const migrated = assessments.map(a => {
      if (!a.scores || !("Mobility" in a.scores) || ("Coordination" in a.scores)) return a;
      const { Mobility, ...rest } = a.scores;
      return { ...a, scores: { ...rest, Coordination: Mobility } };
    });
    setAssessments(migrated);
  }, [assLoaded]);

  useEffect(() => {
    if (!configLoaded || !config?.criteria?.Athletic) return;
    if (config.criteria.Athletic.includes("Mobility") && !config.criteria.Athletic.includes("Coordination")) {
      setConfig(p => ({
        ...p,
        criteria: {
          ...p.criteria,
          Athletic: p.criteria.Athletic.map(c => c === "Mobility" ? "Coordination" : c),
        }
      }));
    }
  }, [configLoaded]);

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
    return assessments.filter(a => a && a.id && a.kidId && a.id !== "_empty" && a.kidId !== "_empty")
      .map(a => a.status ? a : { ...a, status: "approved" }); // backward compat
  }, [assessments]);
  const approvedAssessments = useMemo(() => safeAssessments.filter(a => a.status !== "pending"), [safeAssessments]);
  const pendingAssessments = useMemo(() => safeAssessments.filter(a => a.status === "pending"), [safeAssessments]);

  // Cleanup orphaned data when roster changes (e.g. kids deleted)
  // CRITICAL: only run after ALL bins are loaded to avoid DEFAULT_CONFIG leaking into JSONBin
  useEffect(() => {
    if (!rosterLoaded || !configLoaded || !assLoaded || !selLoaded || !attLoaded) return;
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

    // Clean promoTargets
    const targets = config?.promoTargets;
    if (targets && typeof targets === "object") {
      const orphanTargetKeys = Object.keys(targets).filter(k => !rosterIds.has(k));
      if (orphanTargetKeys.length > 0) {
        setConfig(prev => {
          const t = { ...(prev.promoTargets || {}) };
          orphanTargetKeys.forEach(k => delete t[k]);
          return { ...prev, promoTargets: t };
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

    // Clean assessments — immediate write, bypass debounce
    if (Array.isArray(assessments) && assessments.some(a => !rosterIds.has(a.kidId))) {
      assessments.filter(a => !rosterIds.has(a.kidId)).forEach(a => _deletedKidIds.add(a.kidId));
      setAssessmentsNow(prev => (prev || []).filter(a => rosterIds.has(a.kidId)));
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
      classTypes: config?.classTypes != null ? config.classTypes : DEFAULT_CONFIG.classTypes,
      weeklySchedule: config?.weeklySchedule != null ? config.weeklySchedule : DEFAULT_CONFIG.weeklySchedule,
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

  const pendingCount = (isAdmin || isMasterCoach) ? pendingAssessments.length : 0;

  const loaded = configLoaded && rosterLoaded && assLoaded && selLoaded && attLoaded;

  const viewProfile = (kidId) => {
    setSelectedKidId(kidId);
    setTab("roster");
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
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", WebkitFontSmoothing: "antialiased" }}>

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
      {tab === "home" && <HomeScreen roster={roster} attendance={safeAttendance} assessments={approvedAssessments} config={safeConfig} selections={safeSelections} loggedCoach={loggedCoach} loggedGym={loggedGym} isAdmin={canToggleGyms} isCommunity={isCommunity} pendingCount={pendingCount} onNavigate={(target) => {
        if (target === "roster_training") { setRosterDefaultSort("training_asc"); setTab("roster"); }
        else { setTab(target); }
      }} />}
      {tab === "roster" && <RosterScreen roster={roster} setRoster={setRoster} config={safeConfig} setConfig={setConfig} assessments={safeAssessments} setAssessments={setAssessments} defaultGym={loggedGym} isAdmin={canToggleGyms} isCommunity={isCommunity} isMasterCoach={isMasterCoach} loggedCoach={loggedCoach} selections={safeSelections} attendance={safeAttendance} selectedKidId={selectedKidId} setSelectedKidId={setSelectedKidId} onEditAssessment={editAssessment} onScore={() => setTab("score")} />}
      {tab === "classes" && <ClassesScreen roster={roster} attendance={safeAttendance} setAttendance={setAttendance} config={safeConfig} loggedGym={loggedGym} isAdmin={canToggleGyms} selections={safeSelections} loggedCoach={loggedCoach} />}
      {tab === "promotion" && <PromotionScreen roster={roster} setRoster={setRoster} attendance={safeAttendance} config={safeConfig} setConfig={setConfig} loggedCoach={loggedCoach} isCommunity={isCommunity} isAdmin={canToggleGyms} loggedGym={loggedGym} onViewProfile={viewProfile} />}
      {tab === "score" && !isCommunity && <ScoringScreen roster={roster} assessments={approvedAssessments} allAssessments={safeAssessments} setAssessments={setAssessments} config={safeConfig} editingAssessment={editingAssessment} setEditingAssessment={setEditingAssessment} loggedCoach={loggedCoach} isAdmin={canToggleGyms} isMasterCoach={isMasterCoach} loggedGym={loggedGym} logActivity={entry => setConfig(p => ({ ...p, activityLog: [...(p.activityLog || []), { ...entry, time: new Date().toISOString() }] }))} />}
      {tab === "score" && isCommunity && <div style={s.page}><h1 style={s.h1}>Score</h1><div style={{ ...s.card, padding: 24, textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div><div style={{ color: C.textDim, fontSize: 13 }}>Scoring is restricted to coaches only.<br/>社区成员无法进行评分。</div></div></div>}
      {tab === "rankings" && <RankingsScreen roster={roster} assessments={approvedAssessments} config={safeConfig} selections={safeSelections} setSelections={isCommunity ? () => {} : setSelections} readOnly={isCommunity} isAdmin={canToggleGyms} loggedGym={loggedGym} />}
      {tab === "reports" && <ReportingScreen roster={roster} assessments={approvedAssessments} config={safeConfig} setConfig={setConfig} onViewProfile={viewProfile} onScore={isCommunity ? () => {} : (kidId) => { setTab("score"); }} readOnly={isCommunity} isAdmin={canToggleGyms} loggedGym={loggedGym} loggedCoach={loggedCoach} selections={safeSelections} attendance={safeAttendance} />}

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
            {NAV_MORE.filter(n => !n.adminOnly || isAdmin).filter(n => !(isCommunity && n.key === "settings")).filter(n => !(isCommunity && n.key === "rankings")).map(n => {
              const isActive = tab === n.key;
              return (
                <button key={n.key} onClick={() => {
                  setTab(n.key);
                  setShowMore(false);
                  if (n.key !== "roster") setSelectedKidId("");
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
        {NAV_PRIMARY.filter(n => !(isCommunity && n.key === "score")).map(n => {
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
                if (n.key !== "roster") setSelectedKidId("");
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
                {n.key === "score" && pendingCount > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -10, background: "#FF9800", color: "#fff", fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{pendingCount}</span>
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