// ============================================================
//  المسارات — الصف الأول والصف الثاني
//  ------------------------------------------------------------
//  كل مسار له مفتاح term خاص به في Firestore، وقائمة وحدات،
//  وعنوان وميعاد حصة. التبديل بينهما يخزَّن محليًا لكل متصفح.
// ============================================================

export const TRACKS = {
  // ——— الصف الثاني الثانوي ———
  g2: {
    id:    "g2",
    term:  "term1",
    grade: "الصف الثاني الثانوي",
    short: "ثانية ثانوي",
    title: "البرمجة والذكاء الاصطناعي",
    sub:   "الصف الثاني الثانوي — البكالوريا المصرية",
    slot:  "الجمعة · 6 م",
    eyebrow: "Term 1 · 2026/2027",
    icon:  "📘",
    units: [
      { n: 1, name: "تكنولوجيا المعلومات والمجتمع" },
      { n: 2, name: "الأمن السيبراني" },
      { n: 3, name: "تطبيقات الويب" },
      { n: 4, name: "تصميم الويب والوسائط" },
      { n: 0, name: "المراجعة النهائية" }
    ]
  },

  // ——— الصف الأول الثانوي ———
  g1: {
    id:    "g1",
    term:  "g1t1",
    grade: "الصف الأول الثانوي",
    short: "أولى ثانوي",
    title: "مقدمة في تكنولوجيا المعلومات والاتصالات",
    sub:   "الصف الأول الثانوي — مدارس اللغات",
    slot:  "الجمعة · 4 م",
    eyebrow: "Term 1 · 2026/2027",
    icon:  "📗",
    units: [
      { n:  1, name: "ما هي المعلومات؟" },
      { n:  2, name: "القواعد والحقوق في مجتمع المعلومات" },
      { n:  3, name: "أمن المعلومات" },
      { n:  4, name: "تكنولوجيا المعلومات والمجتمع" },
      { n:  5, name: "الاتصال" },
      { n:  6, name: "تصميم المعلومات" },
      { n:  7, name: "الحواسيب" },
      { n:  8, name: "الشبكات" },
      { n:  9, name: "قواعد البيانات" },
      { n: 10, name: "تحليل البيانات" },
      { n: 11, name: "المحاكاة" },
      { n:  0, name: "المراجعات والاختبارات" }
    ]
  }
};

const STORE_KEY = "memo:track";
const DEFAULT_ID = "g2";

function readStored() {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return TRACKS[v] ? v : DEFAULT_ID;
  } catch { return DEFAULT_ID; }
}

let currentId = readStored();

/** المسار المعروض حاليًا. */
export function track() { return TRACKS[currentId]; }

/** مفتاح الترم المستخدم في استعلامات Firestore. */
export function termKey() { return TRACKS[currentId].term; }

/** وحدات المسار الحالي — تبني القائمة الجانبية وفلاتر بنك الأسئلة. */
export function units() { return TRACKS[currentId].units; }

/**
 * يبدّل المسار ويعيد تحميل الصفحة.
 * إعادة التحميل مقصودة: أبسط وأأمن من إعادة تركيب كل المراقبات
 * والفهارس والتقدّم في نفس الجلسة.
 */
export function setTrack(id, { reload = true } = {}) {
  if (!TRACKS[id] || id === currentId) return;
  currentId = id;
  try { localStorage.setItem(STORE_KEY, id); } catch {}
  if (reload) location.reload();
}

/** يطبّق عناوين المسار على الترويسة وشاشة الدخول وعنوان الصفحة. */
export function applyTrackChrome() {
  const t = track();
  document.title = `مذكرة ${t.title} — ${t.grade}`;

  document.querySelectorAll("[data-track-title]").forEach(n => n.textContent = t.title);
  document.querySelectorAll("[data-track-sub]").forEach(n => n.textContent = t.sub);
  document.querySelectorAll("[data-track-slot]").forEach(n => n.textContent = t.slot);
  document.querySelectorAll("[data-track-eyebrow]").forEach(n => n.textContent = t.eyebrow);
  document.querySelectorAll("[data-track-mark]").forEach(n => n.textContent = t.icon);

  document.querySelectorAll("[data-track-btn]").forEach(b => {
    const on = b.dataset.trackBtn === currentId;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

/** يربط أزرار التبديل. يُستدعى مرة واحدة بعد تحميل الصفحة. */
export function wireTrackSwitch() {
  document.querySelectorAll("[data-track-btn]").forEach(b => {
    b.addEventListener("click", () => setTrack(b.dataset.trackBtn));
  });
  applyTrackChrome();
}
