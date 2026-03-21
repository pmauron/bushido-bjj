import { useState, useEffect, useCallback, useRef } from "react";

/* ━━━ JSONBIN CONFIG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export const JSONBIN_KEY = "$2a$10$MyeP14NXV2Sb2juLdlMwOey8DKwTs8PJEYsUrgI.etARfDcle7ReK";
export const BIN_IDS = {
  "bushido:config": "69a2839943b1c97be9a59cba",
  "bushido:roster": "69a28371ae596e708f516ab3",
  "bushido:assessments": "69a2834a43b1c97be9a59c35",
  "bushido:selections": "69a282fd43b1c97be9a59baa",
  "bushido:attendance": "69a326fe43b1c97be9a7016b",
  "bushido:registrations": "69ba1a16aa77b81da9f49237",
  "bushido:events": "69beb9e9aa77b81da9064f13",
};

let saveTimers = {};
export const _deletedKidIds = new Set();

export async function binRead(key) {
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

/* ━━━ CLOUDINARY IMAGE UPLOAD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const CLOUDINARY_CLOUD = "dzghquzxw";
const CLOUDINARY_PRESET = "bushido";
export async function uploadPhoto(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url;
}

export async function binWrite(key, value) {
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

export async function binWriteNow(key, value) {
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

/* ━━━ STORAGE HOOK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function useStorage(key, fallback) {
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
