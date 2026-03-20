import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { uid, fmt, avg, toDateStr, today, isQuarterClosed, getActiveScoringCycle, ageAt, ageCat, weightCat, coachName, coachGym, kidGymsStr, kidInGym, DAY_NAMES, DAY_SHORT, computeSubtotals, computeRankings, computePromoProjection } from "./utils.js";
import { BELT_HEX, CATEGORY_COLORS, DEFAULT_CONFIG, RUBRIC_HINTS, SEED_ROSTER, generateSeedAssessments, PAGE_HELP, NAV_PRIMARY, NAV_MORE } from "./constants.js";
import { binRead, binWrite, binWriteNow, useStorage, uploadPhoto, _deletedKidIds } from "./storage.js";
import { C, s } from "./styles.js";
import { BeltBadge, ScoreBar, KidAvatar, Modal, Tabs, RadarChart, PageHelp, RosterHealthCharts } from "./components.jsx";
import { HomeScreen } from "./screens/HomeScreen.jsx";
import { RosterScreen } from "./screens/RosterScreen.jsx";
import { ScoringScreen } from "./screens/ScoringScreen.jsx";
import { ClassesScreen } from "./screens/ClassesScreen.jsx";



/* ━━━ SHARED REPORT PAGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function SharedReportPage({ kid, latest, prevAssessment, config, attendance }) {
  const sub = computeSubtotals(latest.scores, config);
  const prevSub = prevAssessment ? computeSubtotals(prevAssessment.scores, config) : null;
  const trend = prevSub ? sub.final - prevSub.final : 0;
  const trendIcon = trend > 0.1 ? "↑" : trend < -0.1 ? "↓" : "→";
  const trendColor = trend > 0.1 ? "#4CAF50" : trend < -0.1 ? "#E53935" : "#666";

  const kidAge = ageAt(kid.dob, today());
  const ac = ageCat(kidAge);
  const wc = weightCat(kid.weight, ac, config.weightRules || {});

  // Attendance
  const kidAtt = (attendance || []).filter(r => r.records?.[kid.id] === "attend");
  const d90 = new Date(); d90.setDate(d90.getDate() - 90);
  const att90 = kidAtt.filter(r => new Date(r.date) >= d90).length;
  const weeklyAvg = (att90 / (90 / 7)).toFixed(1);

  // Promo
  const promo = computePromoProjection(kid, attendance, config);
  const targetDt = (config.promoTargets || {})[kid.id] || "";

  const maxStripes = config.promotionRules?.stripesForBelt || 4;

  const R = { bg: "#0a0a0a", card: "#141414", card2: "#1a1a1a", border: "#2a2a2a", text: "#e8e8e8", dim: "#888", red: "#C41E3A", green: "#4CAF50", orange: "#FF9800", blue: "#2196F3" };

  const card = { background: R.card, borderRadius: 12, border: `1px solid ${R.border}`, padding: 16, marginBottom: 12 };
  const label = { fontSize: 10, fontWeight: 700, color: R.red, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 };

  // Radar
  const cats = Object.keys(config.criteria);
  const vals = cats.map(c => sub[c]);
  const n = cats.length;
  const rcx = 90, rcy = 85, rR = 65;
  const polar = (i, r) => { const a = -Math.PI / 2 + (2 * Math.PI / n) * i; return [rcx + r * Math.cos(a), rcy + r * Math.sin(a)]; };
  const gridSvg = [1,2,3,4,5].map(lv => {
    const pts = Array.from({length:n},(_,i)=>polar(i,(lv/5)*rR).join(",")).join(" ");
    return <polygon key={lv} points={pts} fill="none" stroke={R.border} strokeWidth={0.5} />;
  });
  const dataPts = vals.map((v,i) => polar(i,(v/5)*rR).join(",")).join(" ");

  return (
    <div style={{ background: R.bg, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: R.text, WebkitFontSmoothing: "antialiased" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px 40px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
          <div style={{ fontSize: 28 }}>🥋</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: R.red, letterSpacing: 3, marginTop: 4 }}>BUSHIDO</div>
          <div style={{ fontSize: 10, color: R.dim, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>Progress Report · 进步报告</div>
        </div>

        {/* Kid Card */}
        <div style={{ ...card, background: `linear-gradient(135deg, ${R.card} 0%, ${R.red}11 100%)` }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{kid.name}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ padding: "3px 10px", borderRadius: 20, background: (BELT_HEX[kid.belt] || "#888") + "22", color: BELT_HEX[kid.belt] || "#888", fontSize: 11, fontWeight: 700 }}>
              🥋 {kid.belt}
            </span>
            <span style={{ padding: "3px 10px", borderRadius: 20, background: R.card2, fontSize: 11, color: R.dim }}>
              {kidAge}y · {ac}
            </span>
            <span style={{ padding: "3px 10px", borderRadius: 20, background: R.card2, fontSize: 11, color: R.dim }}>
              {kid.weight}kg · {wc}
            </span>
            <span style={{ padding: "3px 10px", borderRadius: 20, background: R.card2, fontSize: 11, color: R.dim }}>
              {kidGymsStr(kid)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {Array.from({ length: maxStripes }).map((_, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: i < (kid.stripes || 0) ? R.red : R.border }} />
            ))}
          </div>
        </div>

        {/* Date stamp */}
        <div style={{ ...card, padding: "10px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: R.dim, textTransform: "uppercase" }}>Assessment Date 评估日期</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: R.text }}>{latest.date}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: R.dim, textTransform: "uppercase" }}>Cycle 周期</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: R.red }}>{latest.cycle}</div>
            </div>
          </div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${R.border}`, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: R.green, flexShrink: 0 }} />
            <div style={{ fontSize: 10, color: R.dim }}>Live data · 实时数据 · Updated 更新: {today()}</div>
          </div>
        </div>

        {/* Score Hero + Radar */}
        <div style={card}>
          <div style={label}>Assessment Score 评估分数</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: R.red, fontFamily: "'Bebas Neue', sans-serif", lineHeight: 1 }}>{fmt(sub.final)}</div>
              <div style={{ fontSize: 14, color: R.dim }}>/ 5</div>
              <div style={{ fontSize: 12, color: trendColor, marginTop: 4 }}>
                {trendIcon} {prevSub ? `${fmt(prevSub.final)} → ${fmt(sub.final)}` : "First assessment · 首次评估"}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <svg viewBox="0 0 180 175" style={{ width: "100%" }}>
                {gridSvg}
                {cats.map((cat, i) => {
                  const [tx, ty] = polar(i, rR + 14);
                  return <text key={cat} x={tx} y={ty + 3} textAnchor="middle" fontSize={8} fontWeight="600" fill={R.dim}>{cat}</text>;
                })}
                <polygon points={dataPts} fill="rgba(196,30,58,0.2)" stroke={R.red} strokeWidth={2} />
                {vals.map((v, i) => { const [dx, dy] = polar(i, (v/5)*rR); return <circle key={i} cx={dx} cy={dy} r={3} fill={R.red} />; })}
                {prevSub && (() => {
                  const pp = cats.map((c,i) => polar(i,((prevSub[c]||0)/5)*rR).join(",")).join(" ");
                  return <polygon points={pp} fill="none" stroke={R.dim} strokeWidth={1} strokeDasharray="3,3" />;
                })()}
              </svg>
            </div>
          </div>
        </div>

        {/* Category Scores */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {cats.map(cat => {
            const val = sub[cat];
            const color = CATEGORY_COLORS[cat] || R.dim;
            return (
              <div key={cat} style={{ ...card, marginBottom: 0, padding: 12 }}>
                <div style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase" }}>{cat}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{fmt(val)}</div>
                <div style={{ height: 4, background: R.card2, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(val / 5) * 100}%`, background: color, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* AI Comment */}
        {latest.aiComment?.en && (
          <div style={card}>
            <div style={label}>Coach Commentary 教练评语</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: R.text }}>{latest.aiComment.en}</div>
            {latest.aiComment.cn && (
              <div style={{ fontSize: 13, lineHeight: 1.6, color: R.dim, borderTop: `1px solid ${R.border}`, paddingTop: 10, marginTop: 10 }}>{latest.aiComment.cn}</div>
            )}
          </div>
        )}

        {/* Goals */}
        {(() => {
          const goals = (config.goals || {})[kid.id] || [];
          const activeGoals = goals.filter(g => !g.done);
          const doneGoals = goals.filter(g => g.done);
          if (goals.length === 0) return null;
          return (
            <div style={card}>
              <div style={label}>Goals 目标</div>
              {activeGoals.map((g, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderBottom: i < activeGoals.length - 1 ? `1px solid ${R.border}` : "none" }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>🎯</span>
                  <span style={{ fontSize: 13, color: R.text, lineHeight: 1.5 }}>{g.text}</span>
                </div>
              ))}
              {doneGoals.length > 0 && (
                <div style={{ marginTop: activeGoals.length > 0 ? 8 : 0, paddingTop: activeGoals.length > 0 ? 8 : 0, borderTop: activeGoals.length > 0 ? `1px solid ${R.border}` : "none" }}>
                  {doneGoals.map((g, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0", opacity: 0.5 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>✅</span>
                      <span style={{ fontSize: 12, color: R.dim, lineHeight: 1.5, textDecoration: "line-through" }}>{g.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Attendance */}
        <div style={card}>
          <div style={label}>Training 训练</div>
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: parseFloat(weeklyAvg) >= 3 ? R.green : parseFloat(weeklyAvg) >= 2 ? R.orange : R.red, fontFamily: "'Bebas Neue', sans-serif" }}>{weeklyAvg}</div>
              <div style={{ fontSize: 10, color: R.dim }}>classes/wk</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "'Bebas Neue', sans-serif" }}>{kidAtt.length}</div>
              <div style={{ fontSize: 10, color: R.dim }}>total classes</div>
            </div>
          </div>
        </div>

        {/* Promotion */}
        {promo.type !== "complete" && promo.nextBelt && (
          <div style={card}>
            <div style={label}>Next Belt 下次腰带晋级</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🥋 {kid.belt} → {promo.nextBelt}</div>
            {promo.gates.map((g, i) => {
              const pct = Math.min(100, g.required > 0 ? (g.current / g.required) * 100 : 100);
              return (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: R.dim, marginBottom: 2 }}>
                    <span>{g.label} {g.labelZh}</span>
                    <span style={{ color: g.done ? R.green : R.text, fontWeight: 700 }}>{g.current}{g.unit || ""} / {g.required}{g.unit || ""} {g.done ? "✓" : ""}</span>
                  </div>
                  <div style={{ height: 5, background: R.card2, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: g.done ? R.green : R.orange, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, padding: "6px 10px", background: R.card2, borderRadius: 6 }}>
              <div>
                <div style={{ fontSize: 8, color: R.dim, textTransform: "uppercase" }}>{targetDt ? "Target 目标" : "Projected 预计"}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: R.red }}>{targetDt || promo.projectedDate || "TBD"}</div>
              </div>
              {promo.weeklyAvg > 0 && <div style={{ fontSize: 10, color: R.dim }}>{promo.weeklyAvg.toFixed(1)}/wk</div>}
            </div>
          </div>
        )}

        {/* Detailed Rubric */}
        <div style={card}>
          <div style={label}>Detailed Assessment 详细评估</div>
          {Object.entries(config.criteria).map(([cat, crits]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: CATEGORY_COLORS[cat], textTransform: "uppercase", letterSpacing: 0.5, paddingBottom: 4, borderBottom: `2px solid ${CATEGORY_COLORS[cat]}33`, marginBottom: 6 }}>{cat} — {fmt(sub[cat])}/5</div>
              {crits.map(c => {
                const score = latest.scores[c] || 0;
                const current = RUBRIC_HINTS[c]?.[score - 1] || "—";
                const next = score < 5 ? (RUBRIC_HINTS[c]?.[score] || null) : null;
                const color = score >= 4 ? R.green : score >= 3 ? R.orange : R.red;
                return (
                  <div key={c} style={{ padding: "6px 0", borderBottom: `1px solid ${R.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{c}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color, background: color + "15", padding: "2px 8px", borderRadius: 6 }}>{score}/5</span>
                    </div>
                    <div style={{ fontSize: 11, color: R.text, lineHeight: 1.5, padding: "3px 0 3px 8px", borderLeft: `3px solid ${color}`, opacity: 0.85 }}>{current}</div>
                    {next && (
                      <div style={{ fontSize: 11, color: R.dim, lineHeight: 1.5, padding: "3px 0 3px 8px", borderLeft: `3px solid ${R.blue}44`, background: `${R.blue}08`, marginTop: 3, borderRadius: "0 4px 4px 0" }}>
                        <span style={{ fontWeight: 700, color: R.blue, fontSize: 9 }}>NEXT 下一步 → </span>{next}
                      </div>
                    )}
                    {score >= 5 && <div style={{ fontSize: 10, color: R.green, fontWeight: 700, marginTop: 2, paddingLeft: 8 }}>✓ Top level 已达最高</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "16px 0", borderTop: `2px solid ${R.red}` }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: R.red, letterSpacing: 2 }}>🥋 BUSHIDO BJJ ACADEMY</div>
          <div style={{ fontSize: 9, color: R.dim, marginTop: 4 }}>
            Assessment 评估: {latest.date} · Coach: {latest.coach} · Data updated 数据更新: {today()} · {kidGymsStr(kid)}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ━━━ ROSTER HEALTH CHARTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */


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
  const cutoff90 = toDateStr(d90);
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
      const startStr = toDateStr(wStart);
      const endStr = toDateStr(wEnd);
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

        {/* ── Retention Charts ── */}
        {<RosterHealthCharts kids={scopedKids} gymFilter={filterGym} attendance={attendance} config={config} />}
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
      const startStr = toDateStr(wStart);
      const endStr = toDateStr(wEnd);
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
        <RosterHealthCharts kids={gKids} gymFilter={gym} attendance={attendance} config={config} />

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
    const cutoffCold = toDateStr(dCold);
    const dChurn = new Date(now); dChurn.setDate(dChurn.getDate() - (ret.churnAfterDays || 60));
    const cutoffChurn = toDateStr(dChurn);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const cutoff30 = toDateStr(d30);
    const prevMonth = new Date(d30); prevMonth.setDate(prevMonth.getDate() - 30);
    const cutoffPrev = toDateStr(prevMonth);
    const dNew = new Date(now); dNew.setDate(dNew.getDate() - (ret.newWindowDays || 60));
    const cutoffNew = toDateStr(dNew);
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
        { en: "Tap 'Import' to bulk import from a spreadsheet. Paste rows: Name, DOB, Belt, Weight, Gym, Stripes, ClassOffset, ParentName, ParentPhone, ParentLang (tab or comma separated). Columns 6–10 are optional. ParentLang: 'en' or 'zh' (default en).", zh: "点击「Import」从表格批量导入。粘贴行数据：姓名、出生日期、腰带、体重、道馆、条纹数、课程偏移量、家长姓名、家长电话、家长语言（制表符或逗号分隔）。第6–10列可选。家长语言：en或zh（默认en）。" },
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
  const [registrations, setRegistrationsLocal] = useState([]);
  const regRef = useRef(registrations);
  regRef.current = registrations;
  const setRegistrations = useCallback((v) => {
    const next = typeof v === "function" ? v(regRef.current) : v;
    setRegistrationsLocal(next);
    regRef.current = next;
    // JSONBin v3 rejects empty arrays — use init placeholder
    const toWrite = (Array.isArray(next) && next.length === 0) ? [{ init: true }] : next;
    binWriteNow("bushido:registrations", toWrite);
    return next;
  }, []);
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

  // Load registrations with delay to avoid JSONBin 429 rate limit
  useEffect(() => {
    if (!role || role === "community" || role === "coach") return;
    const timer = setTimeout(() => {
      binRead("bushido:registrations").then(data => {
        if (Array.isArray(data)) { setRegistrationsLocal(data); regRef.current = data; }
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [role]);

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

  const pendingRegCount = useMemo(() => {
    if (!isAdmin && !isMasterCoach) return 0;
    const coachObj = config?.coaches?.find(c => coachName(c) === loggedCoach);
    const masterGym = isMasterCoach && coachObj ? coachGym(coachObj) : null;
    return (registrations || []).filter(r => {
      if (!r || r._init || r.init || r.status !== "pending") return false;
      if (isAdmin) return true;
      if (isMasterCoach && masterGym) return r.gym === masterGym;
      return false;
    }).length;
  }, [registrations, isAdmin, isMasterCoach, loggedCoach, config]);

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

  // ── Shared Report Route ──
  const hashMatch = window.location.hash.match(/^#\/report\/(\w+)$/);
  if (hashMatch && loaded) {
    const token = hashMatch[1];
    const tokenData = (safeConfig.shareTokens || {})[token];
    if (tokenData) {
      const reportKid = roster.find(k => k.id === tokenData.kidId);
      const kidAss = safeAssessments.filter(a => a.kidId === tokenData.kidId && a.status !== "pending").sort((a, b) => b.date.localeCompare(a.date));
      const reportLatest = kidAss[0];
      const reportPrev = kidAss.length > 1 ? kidAss[1] : null;
      if (reportKid && reportLatest) {
        return <SharedReportPage kid={reportKid} latest={reportLatest} prevAssessment={reportPrev} config={safeConfig} attendance={safeAttendance} />;
      }
    }
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🥋</div>
          <div style={{ color: C.red, fontWeight: 800, fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>BUSHIDO</div>
          <div style={{ color: C.textDim, fontSize: 13, marginTop: 8 }}>{loaded ? "Report not found · 报告未找到" : "Loading… 加载中…"}</div>
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
      {tab === "home" && <HomeScreen roster={roster} attendance={safeAttendance} assessments={approvedAssessments} config={safeConfig} selections={safeSelections} loggedCoach={loggedCoach} loggedGym={loggedGym} isAdmin={canToggleGyms} isCommunity={isCommunity} pendingCount={pendingCount} pendingRegCount={pendingRegCount} onNavigate={(target) => {
        if (target === "roster_training") { setRosterDefaultSort("training_asc"); setTab("roster"); }
        else { setTab(target); }
      }} />}
      {tab === "roster" && <RosterScreen roster={roster} setRoster={setRoster} config={safeConfig} setConfig={setConfig} assessments={safeAssessments} setAssessments={setAssessments} defaultGym={loggedGym} isAdmin={canToggleGyms} isCommunity={isCommunity} isMasterCoach={isMasterCoach} loggedCoach={loggedCoach} selections={safeSelections} attendance={safeAttendance} selectedKidId={selectedKidId} setSelectedKidId={setSelectedKidId} onEditAssessment={editAssessment} onScore={() => setTab("score")} registrations={registrations} setRegistrations={setRegistrations} />}
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
                {n.key === "roster" && pendingRegCount > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -10, background: "#FF9800", color: "#fff", fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{pendingRegCount}</span>
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
