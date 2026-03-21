import React, { useState } from "react";
import { C, s } from "../styles.js";
import { today } from "../utils.js";
import { uploadPhoto } from "../storage.js";

const TYPE_COLORS = { gym: C.red, competition: C.blue, promotion: C.green };
const TYPE_LABELS = { gym: "Gym Event", competition: "Competition", promotion: "Promotion" };

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

export function EventsScreen({ events, setEvents, roster, config, loggedCoach }) {
  const [view, setView] = useState("upcoming");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
              <button onClick={() => openEdit(event)} style={s.btnSm}>Edit</button>
              <button onClick={() => alert("Flyer feature coming soon")} style={s.btnSm}>Flyer</button>
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
