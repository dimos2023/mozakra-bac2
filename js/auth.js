// ============================================================
//  المصادقة — تسجيل الدخول بجوجل + التحقق من قائمة المسموح لهم
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged, setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/** يبدأ تدفّق تسجيل الدخول. يرجع للنافذة المنبثقة، ويتحوّل للتوجيه لو اتحجبت. */
export async function signIn() {
  await setPersistence(auth, browserLocalPersistence);
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const fallback = [
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/cancelled-popup-request",
      "auth/operation-not-supported-in-this-environment"
    ];
    if (fallback.includes(err.code)) {
      if (err.code === "auth/popup-closed-by-user") throw err;
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

export function signOutNow() {
  return signOut(auth);
}

/** يلتقط نتيجة التوجيه لو رجعنا من signInWithRedirect. */
export function catchRedirect() {
  return getRedirectResult(auth).catch(() => null);
}

/**
 * يتحقق من أن المستخدم في قائمة المسموح لهم، ويسجّل دخوله.
 * يرجع { ok, role, name, reason }
 */
export async function verifyAccess(user) {
  const email = (user.email || "").toLowerCase();
  if (!email) return { ok: false, reason: "no-email" };
  if (!user.emailVerified) return { ok: false, reason: "unverified" };

  let snap;
  try {
    snap = await getDoc(doc(db, "allowlist", email));
  } catch {
    // القواعد بترفض القراءة لو الإيميل مش بتاع المستخدم — نعتبرها رفض وصول
    return { ok: false, reason: "denied" };
  }

  if (!snap.exists()) return { ok: false, reason: "not-listed" };

  const data = snap.data() || {};
  if (data.active === false) return { ok: false, reason: "disabled" };

  const role = data.role === "teacher" ? "teacher" : "student";

  // تسجيل الدخول في users/{uid} — لا نوقف الدخول لو فشل
  try {
    const uref = doc(db, "users", user.uid);
    const prev = await getDoc(uref);
    const base = {
      email,
      name: data.name || user.displayName || email.split("@")[0],
      photo: user.photoURL || "",
      lastLogin: serverTimestamp()
    };
    if (prev.exists()) {
      await setDoc(uref, { ...base, loginCount: increment(1) }, { merge: true });
    } else {
      await setDoc(uref, { ...base, firstLogin: serverTimestamp(), loginCount: 1 });
    }
  } catch (e) {
    console.warn("تعذّر تسجيل الدخول في users:", e.code || e.message);
  }

  return {
    ok: true,
    role,
    groupId: data.groupId || "",
    name: data.name || user.displayName || email.split("@")[0]
  };
}

export { onAuthStateChanged };
