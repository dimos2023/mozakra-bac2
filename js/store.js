// ============================================================
//  طبقة البيانات — جلب المحتوى، التخزين المؤقت، تقدّم الطالب
// ============================================================

import {
  collection, query, where, getDocs, doc, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, serverTimestamp, writeBatch, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db } from "./auth.js";
import { TERM } from "./firebase-config.js";

const CACHE_KEY = `memo:${TERM}:sessions`;

/* ---------------- المحتوى ---------------- */

export function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

/**
 * يجلب فهرس الحصص — وثائق خفيفة بلا محتوى، يراها كل طالب مقبول.
 * ده اللي بيبني قائمة الحصص الجانبية، فالطالب يشوف الخطة كاملة.
 */
export async function loadOutline() {
  const snap = await getDocs(query(collection(db, "sessions"), where("term", "==", TERM)));
  const rows = snap.docs.map(d => ({ ...d.data(), released: d.data().released === true }))
                        .sort((a, b) => a.n - b.n);
  if (!rows.length) throw new Error("empty-content");
  return rows;
}

/** استعلام المحتوى: المدرس يطلب الكل، والطالب المفتوح فقط. */
function contentQuery(isTeacher) {
  const col = collection(db, "content");
  return isTeacher ? col : query(col, where("released", "==", true));
}

function toContent(docs) {
  const map = new Map();
  docs.forEach(d => {
    try {
      const raw = d.data();
      if (raw.term && raw.term !== TERM) return;
      // المحتوى مخزّن كنص JSON لأن Firestore لا يسمح بمصفوفة داخل مصفوفة
      map.set(d.id, JSON.parse(raw.payload));
    } catch { console.warn("حصة تالفة:", d.id); }
  });
  return map;
}

/** يجلب محتوى الحصص المتاحة للمستخدم الحالي. */
export async function loadContent(isTeacher) {
  const snap = await getDocs(contentQuery(isTeacher));
  return toContent(snap.docs);
}

/**
 * يراقب الفهرس والمحتوى لحظيًا. أول ما المدرس يفتح حصة،
 * تظهر عند الطلبة المفتوح عندهم الموقع فورًا بدون تحديث.
 */
export function watchSessions(isTeacher, onChange) {
  let outline = null, content = null;
  const emit = () => { if (outline && content) onChange(outline, content); };

  const un1 = onSnapshot(query(collection(db, "sessions"), where("term", "==", TERM)),
    snap => {
      outline = snap.docs.map(d => ({ ...d.data(), released: d.data().released === true }))
                         .sort((a, b) => a.n - b.n);
      emit();
    },
    err => console.warn("تعذّرت مراقبة الفهرس:", err.code || err.message));

  const un2 = onSnapshot(contentQuery(isTeacher),
    snap => { content = toContent(snap.docs); emit(); },
    err => console.warn("تعذّرت مراقبة المحتوى:", err.code || err.message));

  return () => { un1(); un2(); };
}

/** يفتح أو يقفل حصة — يقلب المفتاح في الفهرس والمحتوى معًا. */
export function setReleased(sessionId, released) {
  const batch = writeBatch(db);
  batch.update(doc(db, "sessions", sessionId), { released: !!released });
  batch.update(doc(db, "content",  sessionId), { released: !!released });
  return batch.commit();
}

/** يفتح أو يقفل مجموعة حصص دفعة واحدة. */
export async function setReleasedBulk(sessionIds, released) {
  // 500 عملية كحد أقصى للدفعة، وكل حصة عمليتان
  for (let i = 0; i < sessionIds.length; i += 200) {
    const batch = writeBatch(db);
    sessionIds.slice(i, i + 200).forEach(id => {
      batch.update(doc(db, "sessions", id), { released: !!released });
      batch.update(doc(db, "content",  id), { released: !!released });
    });
    await batch.commit();
  }
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

/* ---------------- مراقبة الصلاحية لحظيًا ---------------- */

/**
 * يراقب وثيقة المستخدم في allowlist. لو اتحذفت أو اتوقفت،
 * ينادي onRevoked فورًا — حتى لو التبويب مفتوح من ساعات.
 * يرجع دالة لإيقاف المراقبة.
 */
export function watchAccess(email, onRevoked) {
  const ref = doc(db, "allowlist", String(email).toLowerCase());
  let first = true;
  return onSnapshot(ref,
    snap => {
      // نتجاهل أول لقطة لأنها حالة الدخول التي تم التحقق منها بالفعل
      if (first) { first = false; if (snap.exists() && snap.data().active !== false) return; }
      if (!snap.exists())               onRevoked("removed");
      else if (snap.data().active === false) onRevoked("disabled");
    },
    err => {
      // فقدان صلاحية القراءة نفسه يعني أن الوصول أُلغي
      if (err.code === "permission-denied") onRevoked("removed");
    }
  );
}

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
