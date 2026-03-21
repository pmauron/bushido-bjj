import React, { useState } from "react";
import { C, s } from "../styles.js";
import { today } from "../utils.js";
import { uploadPhoto } from "../storage.js";

const TYPE_COLORS = { gym: C.red, competition: C.blue, promotion: C.green };
const TYPE_LABELS = { gym: "Gym Event", competition: "Competition", promotion: "Promotion" };
const TYPE_GRADIENTS = {
  gym: "linear-gradient(160deg, #C41E3A 0%, #7a0e1e 100%)",
  competition: "linear-gradient(160deg, #2196F3 0%, #0b4f8a 100%)",
  promotion: "linear-gradient(160deg, #4CAF50 0%, #1b5e20 100%)",
};

function buildFlyerHtml(event) {
  const tc = TYPE_COLORS[event.type] || C.red;
  const gradient = TYPE_GRADIENTS[event.type] || TYPE_GRADIENTS.gym;
  const label = TYPE_LABELS[event.type] || event.type;
  const portalUrl = "https://bushido-bjj.pages.dev";
  const dateStr = event.date
    ? new Date(event.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";
  const descBlock = [event.description, event.descriptionCn].filter(Boolean).join("<br><br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bushido BJJ — ${event.name || "Event"}</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;font-family:'Inter',sans-serif}
.hint{color:#555;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
.flyer{width:450px;height:800px;background:#0a0a0a;overflow:hidden;display:flex;flex-direction:column;position:relative;box-shadow:0 24px 80px rgba(0,0,0,.9)}
.photo{width:100%;height:270px;flex-shrink:0;position:relative;overflow:hidden}
.photo img{width:100%;height:100%;object-fit:cover}
.photo-placeholder{width:100%;height:100%;background:${gradient};display:flex;align-items:center;justify-content:center;font-size:80px}
.photo-overlay{position:absolute;bottom:0;left:0;right:0;height:120px;background:linear-gradient(to bottom,transparent,#0a0a0a)}
.type-badge{position:absolute;top:16px;left:16px;background:${tc}22;color:${tc};border:1px solid ${tc}66;border-radius:4px;padding:4px 12px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase}
.body{flex:1;padding:18px 24px 12px;display:flex;flex-direction:column;overflow:hidden}
.name{font-family:'Bebas Neue',sans-serif;font-size:44px;line-height:1;color:#e8e8e8;text-transform:uppercase;letter-spacing:1px}
.name-cn{font-size:20px;color:#aaa;font-weight:700;margin-top:4px;margin-bottom:14px}
.meta{display:flex;align-items:flex-start;gap:10px;margin-bottom:7px}
.meta-icon{font-size:14px;flex-shrink:0;margin-top:1px}
.meta-text{font-size:13px;color:#ccc;line-height:1.4}
.divider{height:1px;background:#1e1e1e;margin:10px 0}
.desc{font-size:12px;color:#888;line-height:1.65;flex:1;overflow:hidden}
.bottom{padding:0 24px 0;display:flex;align-items:flex-end;gap:16px;margin-bottom:14px}
.brand-name{font-family:'Bebas Neue',sans-serif;font-size:30px;color:${tc};letter-spacing:2px;line-height:1}
.brand-sub{font-size:10px;color:#444;letter-spacing:1px;text-transform:uppercase;margin-top:2px}
.qr-label{font-size:9px;color:#444;text-align:center;margin-top:4px;letter-spacing:.5px;text-transform:uppercase}
.red-bar{height:4px;background:${tc};width:100%;flex-shrink:0}
</style>
</head>
<body>
<div class="hint">Right-click image or take a screenshot to save this flyer</div>
<div class="flyer">
  <div class="photo">
    ${event.imageUrl ? `<img src="${event.imageUrl}" alt="">` : `<div class="photo-placeholder">🥋</div>`}
    <div class="photo-overlay"></div>
    <div class="type-badge">${label}</div>
  </div>
  <div class="body">
    <div class="name">${event.name || "Event"}</div>
    ${event.nameCn ? `<div class="name-cn">${event.nameCn}</div>` : `<div style="height:10px"></div>`}
    ${dateStr ? `<div class="meta"><span class="meta-icon">📅</span><span class="meta-text">${dateStr}</span></div>` : ""}
    ${event.time ? `<div class="meta"><span class="meta-icon">⏰</span><span class="meta-text">${event.time}</span></div>` : ""}
    ${event.location ? `<div class="meta"><span class="meta-icon">📍</span><span class="meta-text">${event.location}</span></div>` : ""}
    ${descBlock ? `<div class="divider"></div><div class="desc">${descBlock}</div>` : ""}
  </div>
  <div class="bottom">
    <div style="flex:1">
      <div class="brand-name">BUSHIDO BJJ</div>
      <div class="brand-sub">Academy · Shanghai</div>
    </div>
    <div>
      <div id="qr"></div>
      <div class="qr-label">Scan to register</div>
    </div>
  </div>
  <div class="red-bar"></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>
<script>
try{
  var qr=qrcode(0,'M');
  qr.addData('${portalUrl}');
  qr.make();
  var img=qr.createImgTag(4,0);
  document.getElementById('qr').innerHTML=img;
  var el=document.getElementById('qr').querySelector('img');
  if(el){el.style.borderRadius='4px';el.style.display='block';}
}catch(e){
  document.getElementById('qr').innerHTML='<div style="width:80px;height:80px;border:2px solid #2a2a2a;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#444;text-align:center;padding:4px">QR</div>';
}
</script>
</body>
</html>`;
}

function nextEventId(events) {
  const nums = (events || []).map(e => parseInt((e.id || "EVT-000").split("-")[1] || 0)).filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return "EVT-" + String(max + 1).padStart(3, "0");
}

const EMPTY_FORM = {
  name: "", nameCn: "", type: "gym",
  description: "", descriptionCn: "",
  location: "", gym: null,
  date: "", time: "10:00",
  imageUrl: "",
};

export function EventsScreen({ events, setEvents, roster, config, loggedCoach, selectedEventId, setSelectedEventId }) {
  const [view, setView] = useState("upcoming");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detailId, setDetailId] = useState(selectedEventId || null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync external selectedEventId into local detailId
  React.useEffect(() => {
    if (selectedEventId) { setDetailId(selectedEventId); if (setSelectedEventId) setSelectedEventId(null); }
  }, [selectedEventId]);

  const todayStr = today();
  const gyms = config.gyms || [];
  const safeEvents = events || [];

  const upcoming = safeEvents.filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date));
  const past = safeEvents.filter(e => e.date < todayStr).sort((a, b) => b.date.localeCompare(a.date));
  const displayed = view === "upcoming" ? upcoming : past;

  const activeRoster = (roster || []).filter(k => k.active);

  function responseSummary(event) {
    const gymKids = event.gym ? activeRoster.filter(k => k.gym === event.gym) : activeRoster;
    const responded = event.responses || {};
    const confirmed = Object.values(responded).filter(r => r.status === "confirmed").length;
    const interested = Object.values(responded).filter(r => r.status === "interested").length;
    const declined = Object.values(responded).filter(r => r.status === "declined").length;
    const noReply = gymKids.filter(k => !responded[k.id]).length;
    return { confirmed, interested, declined, noReply };
  }

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(event) {
    setForm({ ...event });
    setEditingId(event.id);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name || !form.date) return;
    setSaving(true);
    const now = new Date().toISOString();
    if (editingId) {
      setEvents(prev => (prev || []).map(e => e.id === editingId ? { ...e, ...form, id: editingId } : e));
    } else {
      const id = nextEventId(safeEvents);
      setEvents(prev => [...(prev || []), { ...form, id, createdBy: loggedCoach, createdAt: now, responses: {} }]);
    }
    setSaving(false);
    setShowForm(false);
  }

  function handleDelete(id) {
    setEvents(prev => (prev || []).filter(e => e.id !== id));
    setConfirmDelete(null);
  }

  async function handlePhotoUpload(file) {
    setUploading(true);
    try {
      const url = await uploadPhoto(file);
      setForm(f => ({ ...f, imageUrl: url }));
    } catch {
      alert("Photo upload failed");
    }
    setUploading(false);
  }

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (detailId) {
    const event = safeEvents.find(e => e.id === detailId);
    if (!event) { setDetailId(null); return null; }
    const gymKids = event.gym ? activeRoster.filter(k => k.gym === event.gym) : activeRoster;
    const responded = event.responses || {};
    const confirmed = gymKids.filter(k => responded[k.id]?.status === "confirmed");
    const interested = gymKids.filter(k => responded[k.id]?.status === "interested");
    const declined = gymKids.filter(k => responded[k.id]?.status === "declined");
    const noReply = gymKids.filter(k => !responded[k.id]);
    const tc = TYPE_COLORS[event.type] || C.textDim;

    const KidRow = ({ kid }) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{kid.name}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>{kid.belt}{kid.stripes > 0 ? ` · ${kid.stripes}★` : ""} · {kid.gym}</div>
        </div>
      </div>
    );

    const Group = ({ label, color, kids }) => kids.length === 0 ? null : (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: 1, padding: "6px 14px", background: color + "18", borderBottom: `1px solid ${C.border}` }}>{label} ({kids.length})</div>
        {kids.map(k => <KidRow key={k.id} kid={k} />)}
      </div>
    );

    return (
      <div style={s.page}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => setDetailId(null)} style={s.btnSm}>← Back</button>
          <h1 style={{ ...s.h1, margin: 0, flex: 1, fontSize: 18 }}>{event.name}</h1>
        </div>
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ ...s.badge(tc), fontSize: 10 }}>{TYPE_LABELS[event.type] || event.type}</span>
            {event.gym && <span style={{ fontSize: 11, color: C.textDim }}>📍 {event.gym}</span>}
          </div>
          <div style={{ fontSize: 12, color: C.textDim }}>{event.date}{event.time ? ` · ${event.time}` : ""}{event.location ? ` · ${event.location}` : ""}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>✓ {confirmed.length} confirmed</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>? {interested.length} interested</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#e74c3c" }}>✗ {declined.length} declined</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.textDim }}>— {noReply.length} no reply</span>
          </div>
        </div>
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <Group label="Confirmed" color={C.green} kids={confirmed} />
          <Group label="Interested" color={C.orange} kids={interested} />
          <Group label="Declined" color="#e74c3c" kids={declined} />
          <Group label="No Reply" color={C.textDim} kids={noReply} />
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div style={s.page}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => setShowForm(false)} style={s.btnSm}>← Back</button>
          <h1 style={{ ...s.h1, margin: 0, flex: 1 }}>{editingId ? "Edit Event" : "New Event"}</h1>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>Event Photo</label>
          {form.imageUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={form.imageUrl} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />
              <button type="button" onClick={() => up("imageUrl", "")} style={s.btnDanger}>Remove</button>
            </div>
          ) : (
            <label style={{ cursor: "pointer" }}>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files[0] && handlePhotoUpload(e.target.files[0])} disabled={uploading} />
              <span style={{ ...s.btnSm, display: "inline-block" }}>{uploading ? "Uploading…" : "Upload Photo"}</span>
            </label>
          )}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={s.label}>Event Name *</label>
          <input style={s.input} value={form.name} onChange={e => up("name", e.target.value)} placeholder="e.g. Spring Tournament" />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={s.label}>Chinese Name (活动名称)</label>
          <input style={s.input} value={form.nameCn} onChange={e => up("nameCn", e.target.value)} placeholder="e.g. 春季锦标赛" />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={s.label}>Type</label>
          <select style={s.select} value={form.type} onChange={e => up("type", e.target.value)}>
            <option value="gym">Gym Event</option>
            <option value="competition">Competition</option>
            <option value="promotion">Promotion</option>
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={s.label}>Description</label>
          <textarea style={{ ...s.input, minHeight: 70, resize: "vertical" }} value={form.description} onChange={e => up("description", e.target.value)} placeholder="Event details…" />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={s.label}>Description (Chinese / 中文描述)</label>
          <textarea style={{ ...s.input, minHeight: 70, resize: "vertical" }} value={form.descriptionCn} onChange={e => up("descriptionCn", e.target.value)} placeholder="活动详情…" />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={s.label}>Location</label>
          <input style={s.input} value={form.location} onChange={e => up("location", e.target.value)} placeholder="e.g. Jing'An Gym" />
        </div>

        <div style={{ ...s.grid2, marginBottom: 10 }}>
          <div>
            <label style={s.label}>Gym Scope</label>
            <select style={s.select} value={form.gym || ""} onChange={e => up("gym", e.target.value || null)}>
              <option value="">All Gyms</option>
              {gyms.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Date *</label>
            <input type="date" style={s.input} value={form.date} onChange={e => up("date", e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Time</label>
          <input type="time" style={{ ...s.input, maxWidth: 180 }} value={form.time} onChange={e => up("time", e.target.value)} />
        </div>

        <button onClick={handleSave} disabled={saving || !form.name || !form.date} style={{ ...s.btn, width: "100%", opacity: (!form.name || !form.date) ? 0.5 : 1 }}>
          {saving ? "Saving…" : editingId ? "Save Changes" : "Create Event"}
        </button>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h1 style={{ ...s.h1, margin: 0, flex: 1 }}>Manage Events</h1>
        <button onClick={openNew} style={s.btn}>+ New Event</button>
      </div>

      <div style={{ display: "flex", marginBottom: 16, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {[["upcoming", `Upcoming (${upcoming.length})`], ["past", `Past (${past.length})`]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: "8px 4px", border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 12, textTransform: "uppercase",
            background: view === v ? C.red + "18" : "transparent",
            borderBottom: view === v ? `2px solid ${C.red}` : "2px solid transparent",
            color: view === v ? C.red : C.textDim, transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", color: C.textDim, fontSize: 13, padding: 24 }}>
          No {view} events
        </div>
      ) : displayed.map(event => {
        const summary = responseSummary(event);
        const tc = TYPE_COLORS[event.type] || C.textDim;
        return (
          <div key={event.id} style={{ ...s.card, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 8, flexShrink: 0, overflow: "hidden",
                background: C.card2, border: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {event.imageUrl
                  ? <img src={event.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 24 }}>📅</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{event.name}</span>
                  <span style={{ ...s.badge(tc), fontSize: 10 }}>{TYPE_LABELS[event.type] || event.type}</span>
                </div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 2 }}>
                  {event.date}{event.time ? ` · ${event.time}` : ""}{event.location ? ` · ${event.location}` : ""}
                </div>
                <div style={{ fontSize: 11, color: C.textDim }}>
                  {event.gym ? `📍 ${event.gym}` : "📍 All Gyms"}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>✓ {summary.confirmed} confirmed</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.orange }}>? {summary.interested} interested</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#e74c3c" }}>✗ {summary.declined} declined</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim }}>— {summary.noReply} no reply</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setDetailId(event.id)} style={s.btnSm}>Responses</button>
              <button onClick={() => openEdit(event)} style={s.btnSm}>Edit</button>
              <button onClick={() => { const w = window.open("", "_blank"); w.document.write(buildFlyerHtml(event)); w.document.close(); }} style={s.btnSm}>Flyer</button>
              {confirmDelete === event.id ? (
                <>
                  <span style={{ fontSize: 12, color: "#e74c3c", alignSelf: "center" }}>Delete?</span>
                  <button onClick={() => handleDelete(event.id)} style={s.btnDanger}>Yes, delete</button>
                  <button onClick={() => setConfirmDelete(null)} style={s.btnSm}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(event.id)} style={s.btnDanger}>Delete</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
