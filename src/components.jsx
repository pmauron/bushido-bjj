import React, { useState } from "react";
import { toDateStr } from "./utils.js";
import { BELT_HEX, PAGE_HELP } from "./constants.js";
import { C, s } from "./styles.js";

/* ━━━ SHARED COMPONENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function BeltBadge({belt}){
  const hex=BELT_HEX[belt]||"#888";
  const dark=["White","Grey-White","Yellow-White","Yellow"].includes(belt);
  return <span style={{display:"inline-block",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700,background:hex,color:dark?"#111":"#fff",letterSpacing:"0.3px"}}>{belt}</span>;
}

export function ScoreBar({value,max=5,color=C.red}){
  const pct=(value/max)*100;
  return(<div style={{height:6,background:C.card2,borderRadius:3,overflow:"hidden",flex:1}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width 0.4s ease"}}/></div>);
}

export function KidAvatar({ kid, size = 40, rounded = true }) {
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

export function Modal({open,onClose,title,children}){
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

export function Tabs({items,active,onChange}){
  return(
    <div style={{display:"flex",gap:4,background:C.card,borderRadius:8,padding:3}}>
      {items.map(t=>(
        <button key={t} onClick={()=>onChange(t)} style={{flex:1,padding:"6px 4px",borderRadius:6,border:"none",fontSize:12,fontWeight:600,background:active===t?C.red:"transparent",color:active===t?"#fff":C.textDim,cursor:"pointer",transition:"all 0.2s"}}>{t}</button>
      ))}
    </div>
  );
}

export function RadarChart({data,size=200,compareData=null,compareColor="#64B5F6"}){
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

export function PageHelp({ page }) {
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

export function RosterHealthCharts({ kids, gymFilter, attendance, config }) {
  const ret = config.retentionRules || { coldAfterDays: 14, churnAfterDays: 60 };
  const nowDate = new Date();

  // Training frequency distribution (30 days)
  const d30f = new Date(nowDate); d30f.setDate(d30f.getDate() - 30);
  const cut30f = toDateStr(d30f);
  const att30 = (attendance || []).filter(r => r.date >= cut30f && (!gymFilter || r.gym === gymFilter));
  const weeks30 = 30 / 7;
  const freqBuckets = [
    { label: "Haven't trained", color: "#E53935", count: 0 },
    { label: "< 1x/wk", color: "#FF9800", count: 0 },
    { label: "1-2x/wk", color: "#FFC107", count: 0 },
    { label: "2-3x/wk", color: "#8BC34A", count: 0 },
    { label: "3+/wk", color: "#4CAF50", count: 0 },
  ];
  kids.forEach(k => {
    const ct = att30.filter(r => r.records?.[k.id] === "attend").length;
    const wa = ct / weeks30;
    if (wa === 0) freqBuckets[0].count++;
    else if (wa < 1) freqBuckets[1].count++;
    else if (wa < 2) freqBuckets[2].count++;
    else if (wa < 3) freqBuckets[3].count++;
    else freqBuckets[4].count++;
  });

  const pieData = freqBuckets.filter(d => d.count > 0);
  const pieTotal = kids.length;
  const pieSize = 140, pieCx = 70, pieCy = 70, pieR = 55;
  let cumulAngle = 0;
  const pieSlices = pieData.map(d => {
    const angle = pieTotal > 0 ? (d.count / pieTotal) * 360 : 0;
    const sa = cumulAngle; cumulAngle += angle; const ea = cumulAngle;
    const sr = (Math.PI / 180) * (sa - 90), er = (Math.PI / 180) * (ea - 90);
    const la = angle > 180 ? 1 : 0;
    const x1 = pieCx + pieR * Math.cos(sr), y1 = pieCy + pieR * Math.sin(sr);
    const x2 = pieCx + pieR * Math.cos(er), y2 = pieCy + pieR * Math.sin(er);
    const path = pieData.length === 1
      ? `M ${pieCx} ${pieCy - pieR} A ${pieR} ${pieR} 0 1 1 ${pieCx - 0.01} ${pieCy - pieR} Z`
      : `M ${pieCx} ${pieCy} L ${x1} ${y1} A ${pieR} ${pieR} 0 ${la} 1 ${x2} ${y2} Z`;
    return { ...d, path };
  });

  // Net growth bar chart (6 months)
  const monthData = [];
  for (let m = 5; m >= 0; m--) {
    const mDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - m, 1);
    const mEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0);
    const mStart = toDateStr(mDate), mEndStr = toDateStr(mEnd);
    const mLabel = mDate.toLocaleString("en", { month: "short" });
    const dColdM = new Date(mEnd); dColdM.setDate(dColdM.getDate() - (ret.coldAfterDays || 14));
    const cutColdM = toDateStr(dColdM);
    const dChurnM = new Date(mEnd); dChurnM.setDate(dChurnM.getDate() - (ret.churnAfterDays || 60));
    const cutChurnM = toDateStr(dChurnM);
    const newInMonth = kids.filter(k => {
      const firstAtt = (attendance || []).filter(r => (!gymFilter || r.gym === gymFilter) && r.records?.[k.id] === "attend").map(r => r.date).sort()[0];
      return (k.joinDate && k.joinDate >= mStart && k.joinDate <= mEndStr) || (firstAtt && firstAtt >= mStart && firstAtt <= mEndStr);
    }).length;
    const lastAttAsOf = {};
    (attendance || []).forEach(r => {
      if (r.date > mEndStr) return;
      if (gymFilter && r.gym !== gymFilter) return;
      Object.entries(r.records || {}).forEach(([kidId, status]) => {
        if (status === "attend" && (!lastAttAsOf[kidId] || r.date > lastAttAsOf[kidId])) lastAttAsOf[kidId] = r.date;
      });
    });
    const coldInMonth = kids.filter(k => { const la2 = lastAttAsOf[k.id]; return la2 && la2 < cutColdM && la2 >= cutChurnM; }).length;
    monthData.push({ label: mLabel, newE: newInMonth, cold: coldInMonth });
  }

  const netData = monthData.map(d => ({ ...d, net: d.newE - d.cold }));
  const maxBar = Math.max(1, ...netData.map(d => Math.abs(d.net)));
  const barW = 280, barH = 100, barPad = { t: 10, r: 10, b: 20, l: 28 };
  const biw = barW - barPad.l - barPad.r, bih = barH - barPad.t - barPad.b;
  const barMid = barPad.t + bih / 2;
  const bw = biw / netData.length * 0.6, bGap = biw / netData.length;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 24 }}>
        <span style={{ fontSize: 16 }}>🔄</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Roster Health</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={s.card}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Net Growth (6mo)</div>
          <svg width="100%" viewBox={`0 0 ${barW} ${barH}`} style={{ display: "block" }}>
            <line x1={barPad.l} y1={barMid} x2={barW - barPad.r} y2={barMid} stroke={C.border} strokeWidth={1} />
            <text x={barPad.l - 4} y={barMid} textAnchor="end" dominantBaseline="middle" fill={C.textDim} fontSize={8}>0</text>
            <text x={barPad.l - 4} y={barPad.t + 4} textAnchor="end" dominantBaseline="middle" fill={C.textDim} fontSize={7}>+{maxBar}</text>
            <text x={barPad.l - 4} y={barPad.t + bih - 2} textAnchor="end" dominantBaseline="middle" fill={C.textDim} fontSize={7}>-{maxBar}</text>
            {netData.map((d, i) => {
              const x = barPad.l + i * bGap + (bGap - bw) / 2;
              const h = maxBar > 0 ? (Math.abs(d.net) / maxBar) * (bih / 2) : 0;
              const y = d.net >= 0 ? barMid - h : barMid;
              const color = d.net > 0 ? "#4CAF50" : d.net < 0 ? "#E53935" : C.border;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={bw} height={Math.max(1, h)} rx={2} fill={color} opacity={0.85} />
                  {d.net !== 0 && <text x={x + bw / 2} y={d.net >= 0 ? y - 3 : y + h + 8} textAnchor="middle" fill={color} fontSize={8} fontWeight="700">{d.net > 0 ? "+" : ""}{d.net}</text>}
                  <text x={x + bw / 2} y={barH - 4} textAnchor="middle" fill={C.textDim} fontSize={7}>{d.label}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 6 }}>
            <span style={{ fontSize: 9, color: "#4CAF50" }}>▲ Growing</span>
            <span style={{ fontSize: 9, color: "#E53935" }}>▼ Shrinking</span>
          </div>
        </div>
        <div style={s.card}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Training Frequency (30d)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width={pieSize} height={pieSize} viewBox={`0 0 ${pieSize} ${pieSize}`} style={{ display: "block", flexShrink: 0 }}>
              {pieSlices.map((sl, i) => <path key={i} d={sl.path} fill={sl.color} />)}
              <circle cx={pieCx} cy={pieCy} r={30} fill={C.card} />
              <text x={pieCx} y={pieCy - 4} textAnchor="middle" dominantBaseline="central" fontSize={18} fontWeight="900" fill={C.text} fontFamily="'Bebas Neue', sans-serif">{pieTotal}</text>
              <text x={pieCx} y={pieCy + 12} textAnchor="middle" dominantBaseline="central" fontSize={7} fill={C.textDim}>kids</text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {pieData.map(d => (
                <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                  <span style={{ color: C.text, fontWeight: 600 }}>{d.count}</span>
                  <span style={{ color: C.textDim, fontSize: 10 }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
