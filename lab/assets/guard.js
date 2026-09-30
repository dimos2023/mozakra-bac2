// ============================================================
//  حارس المعمل — نفس دخول المذكرة
//  ------------------------------------------------------------
//  الصفحة مخفية (html.guard-pending) لحد ما نتأكد إن الزائر:
//    مسجّل دخول بجوجل + إيميله في allowlist + حسابه active
//  غير كده يرجع لشاشة الدخول في المذكرة.
//
//  ملحوظة: ملفات المعمل نفسها في ريبو public — الحارس بيقفل الواجهة
//  للطلبة المسجلين، لكنه مش حماية لمحتوى سري (المعمل مفيهوش أسرار).
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "../../js/firebase-config.js";

// صفحة المذكرة الرئيسية (جذر الموقع)
const SITE_HOME = new URL("../../index.html", import.meta.url).href;

function reveal() {
  document.documentElement.classList.remove("guard-pending");
}

function blocked(html) {
  document.body.innerHTML = `<main class="container" style="padding:60px 16px;text-align:center">
    <h1>🔒 المعمل للطلبة المسجلين بس</h1><p class="lead" style="margin:0 auto 18px">${html}</p>
    <a class="btn" href="${SITE_HOME}">الدخول للمذكرة</a></main>`;
  reveal();
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace(SITE_HOME);
    return;
  }
  const email = (user.email || "").toLowerCase();
  if (!email || !user.emailVerified) {
    return blocked("إيميل حسابك غير موثّق من جوجل.");
  }
  let data = null;
  try {
    const snap = await getDoc(doc(db, "allowlist", email));
    if (snap.exists()) data = snap.data() || {};
  } catch (e) {
    return blocked("تعذّر التحقق من حسابك — اتأكد من الإنترنت واعمل ريفرش.");
  }
  if (!data) {
    return blocked("حسابك مش مسجّل لسه. ادخل على المذكرة وقدّم طلب انضمام للمدرس.");
  }
  if (data.active === false) {
    return blocked("حسابك موقوف حاليًا. كلّم المدرس.");
  }

  // اسم الطالب من حسابه بدل ما يكتبه بإيده
  const name = data.name || user.displayName || email.split("@")[0];
  window.setName?.(name);
  window.LAB_USER = { uid: user.uid, email, name, role: data.role === "teacher" ? "teacher" : "student" };
  document.querySelectorAll(".student-chip").forEach(n => { n.textContent = "👤 " + name; });
  const nameCard = document.getElementById("nameCard");
  if (nameCard) nameCard.hidden = true;
  document.dispatchEvent(new CustomEvent("lab:user", { detail: window.LAB_USER }));
  reveal();
});
