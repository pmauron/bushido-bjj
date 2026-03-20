/* ━━━ PURE UTILITY FUNCTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* No React, no side effects — safe to import anywhere                      */

export const uid = () => Math.random().toString(36).slice(2,10);
export const fmt = n => typeof n==="number"? (Number.isInteger(n)?n.toString():n.toFixed(2)) : "—";
export const avg = a => a.length? a.reduce((s,v)=>s+v,0)/a.length : 0;
export const toDateStr = (d) => { const o = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Shanghai" })); return o.getFullYear() + "-" + String(o.getMonth()+1).padStart(2,"0") + "-" + String(o.getDate()).padStart(2,"0"); };
export const today = () => toDateStr(new Date());
export const isQuarterClosed = (cycle) => {
  const m = cycle.match(/^(\d{4})\s*Q([1-4])$/);
  if (!m) return true; // non-quarter cycles always open
  const [, yr, q] = m;
  // Scorable once the last month of the quarter begins (March, June, Sep, Dec)
  const lastMonthStart = { 1: `${yr}-03-01`, 2: `${yr}-06-01`, 3: `${yr}-09-01`, 4: `${yr}-12-01` };
  return today() >= lastMonthStart[q];
};
export const getActiveScoringCycle = (cycles) => {
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
export const ageAt = (dob, d) => { const x=new Date(d),b=new Date(dob); let a=x.getFullYear()-b.getFullYear(); if(x.getMonth()<b.getMonth()||(x.getMonth()===b.getMonth()&&x.getDate()<b.getDate()))a--; return a; };
export const ageCat = a => a<8?"U8":a<10?"U10":a<12?"U12":"U14";
export const weightCat = (w, ac, rules) => { const r=rules[ac]; if(!r)return"Medium"; for(const[cat,[lo,hi]] of Object.entries(r)){if(w>=lo&&w<hi)return cat;} return"Heavy"; };

export const coachName = (c) => typeof c === "string" ? c : c.name;
export const coachGym = (c) => typeof c === "string" ? "" : (c.gym || "");
export const kidGymsStr = (k) => k ? (Array.isArray(k.gyms) ? k.gyms.join(", ") : (k.gym || "")) : "";
export const kidInGym = (k, gym) => Array.isArray(k.gyms) ? k.gyms.includes(gym) : k.gym === gym;
export const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ━━━ SCORING ENGINE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function computeSubtotals(scores, config) {
  const cr = config.criteria;
  const bjj = avg(cr.BJJ.map(c => scores[c] || 0));
  const ath = avg(cr.Athletic.map(c => scores[c] || 0));
  const com = avg(cr.Commitment.map(c => scores[c] || 0));
  const comp = avg(cr.Competition.map(c => scores[c] || 0));
  const w = config.scoringWeights;
  const final = bjj * w.BJJ + ath * w.Athletic + com * w.Commitment + comp * w.Competition;
  return { BJJ: bjj, Athletic: ath, Commitment: com, Competition: comp, final };
}

export function computeRankings(assessments, roster, config) {
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

/* ━━━ PROMOTION PROJECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function computePromoProjection(kid, attendance, config) {
  const rules = config.promotionRules || { stripeClasses: 10, beltClasses: 40, beltMonths: 9, stripesForBelt: 4 };
  const lastPromo = kid.lastPromotionDate || kid.joinDate || "2020-01-01";
  const stripes = kid.stripes || 0;
  const classesDone = (attendance || []).filter(r => r.date > lastPromo && r.records?.[kid.id] === "attend").length + (kid.classCountOffset || 0);

  // Weekly avg from 90-day window
  const d90 = new Date(); d90.setDate(d90.getDate() - 90);
  const cutoff90 = toDateStr(d90);
  const att90 = (attendance || []).filter(r => r.date >= cutoff90 && r.records?.[kid.id] === "attend").length;
  const weeks90 = Math.max(1, Math.round(90 / 7));
  const weeklyAvg = att90 / weeks90;

  const monthsSince = () => {
    const d = new Date(lastPromo);
    const now = new Date();
    return (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
  };

  const addWeeks = (w) => { const d = new Date(); d.setDate(d.getDate() + Math.ceil(w * 7)); return toDateStr(d); };
  const addMonths = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return toDateStr(d); };

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
