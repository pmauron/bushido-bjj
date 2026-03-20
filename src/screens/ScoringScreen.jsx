import React, { useState, useEffect, useMemo } from "react";
import { uid, fmt, today, isQuarterClosed, getActiveScoringCycle, ageAt, coachName, coachGym, kidGymsStr, kidInGym, computeSubtotals } from "../utils.js";
import { RUBRIC_HINTS, CATEGORY_COLORS } from "../constants.js";
import { C, s } from "../styles.js";
import { BeltBadge, ScoreBar, RadarChart, PageHelp } from "../components.jsx";

export function ScoringScreen({ roster, assessments, allAssessments, setAssessments, config, editingAssessment, setEditingAssessment, loggedCoach, isAdmin, isMasterCoach, loggedGym, logActivity }) {
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
