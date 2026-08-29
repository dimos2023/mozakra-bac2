// ============================================================
//  طبقة البيانات — جلب المحتوى، التخزين المؤقت، تقدّم الطالب
// ============================================================

import {
  collection, query, where, getDocs, doc, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db } from "./auth.js";
import { TERM } from "./firebase-config.js";

const CACHE_KEY = `memo:${TERM}:sessions`;
const CACHE_VER_KEY = `memo:${TERM}:ver`;
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 ساعة

/* ---------------- المحتوى ---------------- */

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || Date.now() - at > CACHE_TTL) return null;
    if (!Array.isArray(data) || !data.length) return null;
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch { /* التخزين ممتلئ أو محجوب — نتجاهل */ }
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_VER_KEY);
  } catch {}
}

/** يجلب كل حصص الفصل الدراسي، من الكاش أولًا ثم من Firestore. */
export async function loadSessions({ force = false } = {}) {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  // فلترة بمساواة واحدة فقط — يستخدم الفهرس التلقائي ولا يحتاج فهرسًا مركّبًا.
  // الترتيب يتم في المتصفح لأن العدد صغير (20 حصة).
  const q = query(collection(db, "sessions"), where("term", "==", TERM));
  const snap = await getDocs(q);

  // كل حصة مخزّنة كنص JSON في حقل payload — لأن Firestore
  // لا يسمح بمصفوفة داخل مصفوفة (timing و terms و rows).
  const data = snap.docs
    .map(d => {
      try { return JSON.parse(d.data().payload); }
      catch { console.warn("حصة تالفة:", d.id); return null; }
    })
    .filter(Boolean)
    .sort((a, b) => a.n - b.n);

  if (!data.length) throw new Error("empty-content");
  writeCache(data);
  return data;
}

/* ---------------- تقدّم الطالب ---------------- */

export async function loadProgress(uid) {
  try {
    const snap = await getDoc(doc(db, "progress", uid));
    if (!snap.exists()) return { completed: [], lastSession: 1 };
    const d = snap.data() || {};
    return {
      completed: Array.isArray(d.completed) ? d.completed.slice() : [],
      lastSession: Number(d.lastSession) || 1
    };
  } catch {
    return { completed: [], lastSession: 1 };
  }
}

let saveTimer = null;
let pending = null;

/** يحفظ التقدّم مع تجميع الكتابات المتتالية لتقليل عمليات الكتابة. */
export function saveProgress(uid, email, progress) {
  pending = { uid, email, progress: { ...progress } };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushProgress, 900);
}

export async function flushProgress() {
  if (!pending) return;
  const { uid, email, progress } = pending;
  pending = null;
  try {
    await setDoc(doc(db, "progress", uid), {
      email,
      completed: progress.completed,
      lastSession: progress.lastSession,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn("تعذّر حفظ التقدّم:", e.code || e.message);
  }
}

// نحاول الحفظ قبل إغلاق الصفحة
addEventListener("pagehide", () => { flushProgress(); });

/* ---------------- المجموعات ---------------- */

/** يجلب كل المجموعات مرتّبة بالاسم. متاح لأي مستخدم مسجّل (لاختيارها في الطلب). */
export async function loadGroups() {
  try {
    const snap = await getDocs(collection(db, "groups"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
  } catch {
    return [];
  }
}

export async function createGroup(name, note = "") {
  const ref = await addDoc(collection(db, "groups"), {
    name: String(name).trim(),
    note: String(note).trim(),
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export function renameGroup(gid, name, note = "") {
  return updateDoc(doc(db, "groups", gid), { name: String(name).trim(), note: String(note).trim() });
}

/** يحذف المجموعة ويفكّ ارتباط طلبتها (لا يحذف الطلبة أنفسهم). */
export async function deleteGroup(gid) {
  const snap = await getDocs(query(collection(db, "allowlist"), where("groupId", "==", gid)));
  const batch = writeBatch(db);
  snap.forEach(d => batch.update(d.ref, { groupId: "" }));
  batch.delete(doc(db, "groups", gid));
  await batch.commit();
  return snap.size;
}

/* ---------------- طلبات الانضمام ---------------- */

/** يقرأ طلب المستخدم الحالي إن وُجد. */
export async function loadMyRequest(uid) {
  try {
    const snap = await getDoc(doc(db, "requests", uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch {
    return null;
  }
}

/** ينشئ أو يعيد إرسال طلب انضمام. الحالة دائمًا pending. */
export function submitRequest(user, { name, groupId = "", note = "" }) {
  return setDoc(doc(db, "requests", user.uid), {
    email: (user.email || "").toLowerCase(),
    name: String(name).trim(),
    photo: user.photoURL || "",
    groupId,
    note: String(note).trim().slice(0, 300),
    status: "pending",
    createdAt: serverTimestamp()
  });
}

/** يجلب كل الطلبات — للمدرس فقط. */
export async function loadRequests() {
  const snap = await getDocs(collection(db, "requests"));
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data(), createdAtDate: d.data().createdAt?.toDate?.() || null }))
    .sort((a, b) => (b.createdAtDate?.getTime() || 0) - (a.createdAtDate?.getTime() || 0));
}

/** يقبل الطلب: يضيف الطالب لقائمة المسموح لهم ويعلّم الطلب كمقبول. */
export async function approveRequest(req, { groupId = "", role = "student" } = {}) {
  const email = String(req.email).toLowerCase();
  const batch = writeBatch(db);
  batch.set(doc(db, "allowlist", email), {
    name: req.name || email.split("@")[0],
    role,
    active: true,
    groupId
  }, { merge: true });
  batch.update(doc(db, "requests", req.uid), {
    status: "approved",
    groupId,
    decidedAt: serverTimestamp()
  });
  await batch.commit();
}

export function rejectRequest(req) {
  return updateDoc(doc(db, "requests", req.uid), {
    status: "rejected",
    decidedAt: serverTimestamp()
  });
}

export function deleteRequest(uid) {
  return deleteDoc(doc(db, "requests", uid));
}

/* ---------------- إدارة الطلبة ---------------- */

/** ينقل طالبًا لمجموعة أخرى. */
export function setStudentGroup(email, groupId) {
  return updateDoc(doc(db, "allowlist", String(email).toLowerCase()), { groupId });
}

/** يوقف أو يفعّل طالبًا. */
export function setStudentActive(email, active) {
  return updateDoc(doc(db, "allowlist", String(email).toLowerCase()), { active: !!active });
}

/** يحذف طالبًا من قائمة المسموح لهم نهائيًا. */
export function removeStudent(email) {
  return deleteDoc(doc(db, "allowlist", String(email).toLowerCase()));
}

/* ---------------- بيانات المدرس ---------------- */

/** يجلب قائمة الطلبة مع آخر دخول وتقدّمهم. للمدرس فقط. */
export async function loadStudents() {
  const [listSnap, usersSnap, progSnap] = await Promise.all([
    getDocs(collection(db, "allowlist")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "progress"))
  ]);

  const users = new Map();
  usersSnap.forEach(d => users.set((d.data().email || "").toLowerCase(), { uid: d.id, ...d.data() }));

  const prog = new Map();
  progSnap.forEach(d => {
    const p = d.data();
    if (p.email) prog.set(String(p.email).toLowerCase(), p);
  });

  const rows = [];
  listSnap.forEach(d => {
    const email = d.id.toLowerCase();
    const a = d.data() || {};
    const u = users.get(email);
    const p = prog.get(email);
    rows.push({
      email,
      name: a.name || u?.name || email.split("@")[0],
      role: a.role === "teacher" ? "teacher" : "student",
      active: a.active !== false,
      groupId: a.groupId || "",
      lastLogin: u?.lastLogin?.toDate?.() || null,
      loginCount: u?.loginCount || 0,
      completed: Array.isArray(p?.completed) ? p.completed.length : 0,
      lastSession: p?.lastSession || null
    });
  });

  rows.sort((x, y) => (y.lastLogin?.getTime() || 0) - (x.lastLogin?.getTime() || 0));
  return rows;
}
