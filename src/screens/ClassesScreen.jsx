import React, { useState, useMemo } from "react";
import { today, toDateStr, coachName, coachGym, kidInGym, DAY_NAMES, DAY_SHORT } from "../utils.js";
import { C, s } from "../styles.js";
import { PageHelp } from "../components.jsx";

export function ClassesScreen({ roster, attendance, setAttendance, config, loggedGym, isAdmin, selections, loggedCoach }) {
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
      const targetStr = toDateStr(target);
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
  const [histFrom, setHistFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return toDateStr(d); });
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
