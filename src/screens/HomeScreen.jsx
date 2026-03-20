import React, { useState } from "react";
import { fmt, today, toDateStr, isQuarterClosed, getActiveScoringCycle, computeSubtotals, kidInGym, DAY_NAMES } from "../utils.js";
import { C, s } from "../styles.js";
import { PageHelp, RosterHealthCharts } from "../components.jsx";

export function HomeScreen({ roster, attendance, assessments, config, selections, loggedCoach, loggedGym, isAdmin, isCommunity, pendingCount, pendingRegCount, onNavigate }) {
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
  const yesterdayStr = toDateStr(yDate);
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
  const cutoff90 = toDateStr(d90);
  const att90 = (attendance || []).filter(r => r.date >= cutoff90);
  const weeks90 = Math.max(1, Math.round(90 / 7));
  const lastAtt = {};
  (attendance || []).filter(r => !gymFilter || r.gym === gymFilter).forEach(r => {
    Object.entries(r.records || {}).forEach(([kidId, status]) => {
      if (status === "attend" && (!lastAtt[kidId] || r.date > lastAtt[kidId])) lastAtt[kidId] = r.date;
    });
  });
  const dCold = new Date(); dCold.setDate(dCold.getDate() - (ret.coldAfterDays || 14));
  const cutoffCold = toDateStr(dCold);
  const dChurn = new Date(); dChurn.setDate(dChurn.getDate() - (ret.churnAfterDays || 60));
  const cutoffChurn = toDateStr(dChurn);
  const snoozeDays = ret.contactSnoozeDays || 14;
  const cLog = config.contactLog || [];
  const daysSinceDate = (dateStr) => dateStr ? Math.floor((nowDate - new Date(dateStr)) / 86400000) : 999;
  const isSnoozed = (kidId, reason) => cLog.some(c => c.kidId === kidId && c.reason === reason && daysSinceDate(c.date) < snoozeDays);
  const coldCount = gymKids.filter(k => { const la = lastAtt[k.id]; return la && la < cutoffCold && la >= cutoffChurn && !isSnoozed(k.id, "cold"); }).length;
  const d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const cutoff30 = toDateStr(d30);
  const prevMonth = new Date(d30); prevMonth.setDate(prevMonth.getDate() - 30);
  const cutoffPrev = toDateStr(prevMonth);
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
    if (pendingRegCount > 0)
      n.push({ p: 1, msg: `${pendingRegCount} new registration${pendingRegCount > 1 ? "s" : ""} pending approval`, color: "#FF9800", bg: "#FF980012", border: "#FF980033", nav: "roster", btn: "Review" });
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

      {/* Roster Health Charts — admin/master coach only */}
      {isAdmin && <RosterHealthCharts kids={gymKids} gymFilter={gymFilter} attendance={attendance} config={config} />}

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
