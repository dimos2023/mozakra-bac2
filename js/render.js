// ============================================================
//  محرك العرض — بناء صفحات الحصص والبحث وبنك الأسئلة والطلبة
// ============================================================

export const UNITS = [
  { n: 1, name: "تكنولوجيا المعلومات والمجتمع" },
  { n: 2, name: "الأمن السيبراني" },
  { n: 3, name: "تطبيقات الويب" },
  { n: 4, name: "تصميم الويب والوسائط" },
  { n: 0, name: "المراجعة النهائية" }
];

const ICONS = { ex: "م", an: "ت", exam: "!", warn: "✕" };
const BOXT  = { ex: "مثال", an: "تشبيه", exam: "تنبيه", warn: "انتبه" };
const LTR   = ["أ", "ب", "جـ", "د", "هـ", "و"];

/** الصناديق التي تُخفى في وضع الطالب. */
const TEACHER_BOXES = new Set(["exam"]);

/* ---------------- أدوات ---------------- */

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** يجرّد وسوم HTML للحصول على نص صافٍ (للبحث والمقتطفات). */
export function plain(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------------- أجزاء الحصة ---------------- */

function tableHTML(t) {
  if (!t) return "";
  let h = `<div class="tw"><table><caption>${t.cap}</caption><thead><tr>`;
  t.head.forEach(c => { h += `<th>${c}</th>`; });
  h += "</tr></thead><tbody>";
  t.rows.forEach(r => {
    h += "<tr>";
    r.forEach(c => { h += `<td>${c}</td>`; });
    h += "</tr>";
  });
  return h + "</tbody></table></div>";
}

function boxHTML(b) {
  return `<div class="box ${b.k}"><div class="bt"><span class="ic">${ICONS[b.k] || "•"}</span>${
    b.t || BOXT[b.k] || ""}</div>${b.h}</div>`;
}

function conceptHTML(c, i, teacherMode) {
  let h = `<article class="concept"><div class="chead"><span class="cn">${i + 1}</span><div><h3>${c.t}</h3>` +
          (c.en ? `<span class="cen">${c.en}</span>` : "") + "</div></div><div class=\"cbody\">";
  if (c.def)    h += `<div class="def">${c.def}</div>`;
  if (c.body)   h += c.body;
  if (c.table)  h += tableHTML(c.table);
  if (c.body2)  h += `<div style="margin-top:14px">${c.body2}</div>`;
  if (c.table2) h += `<div style="margin-top:12px">${tableHTML(c.table2)}</div>`;
  (c.boxes || []).forEach(b => {
    if (!teacherMode && TEACHER_BOXES.has(b.k)) return;
    h += boxHTML(b);
  });
  return h + "</div></article>";
}

function questionHTML(q, i, opts = {}) {
  let h = `<div class="q"><div class="qh"><span class="qn">${i + 1}</span><div><div class="qt">${q.t}</div>`;
  if (opts.source) h += `<div class="qsrc">${opts.source}</div>`;
  if (q.o) {
    h += '<ul class="opts">';
    q.o.forEach((o, j) => {
      h += `<li><span class="ol">${LTR[j] || j + 1}</span><span>${o}</span></li>`;
    });
    h += "</ul>";
  }
  h += `<div class="ans" hidden>${q.a}</div></div></div></div>`;
  return h;
}

/* ---------------- صفحة الحصة ---------------- */

export function renderSession(s, ctx) {
  const { teacherMode, isDone, prev, next } = ctx;
  const total = s.timing.reduce((a, t) => a + t[1], 0);

  let h = `<div class="topbar no-print">
    <span class="chip">${s.unit ? "الوحدة " + s.unit : "مراجعة نهائية"}</span>
    <span class="chip">${s.pages}</span>
    <span class="chip">${total} دقيقة</span>
    <span class="spacer"></span>
    <button class="tbtn done-btn${isDone ? " on" : ""}" type="button" data-act="toggle-done">${
      isDone ? "✓ تمّت المذاكرة" : "علّم كمذاكَرة"}</button>
    <button class="tbtn" type="button" data-act="toggle-ans">إظهار الإجابات</button>
    <button class="tbtn" type="button" data-act="print">طباعة / PDF</button>
  </div>`;

  h += `<header class="shead${s.rev ? " rev" : ""}">
    <div class="kicker">
      <span class="bignum">حصة ${s.n}</span>
      <span class="dateline">${s.date} ${s.n >= 19 ? "" : "2026"}</span>
      <span class="lref">${s.ref}</span>
    </div>
    <h2>${s.title}</h2><p class="sub">${s.sub}</p></header>`;

  h += '<div class="timing">';
  s.timing.forEach(t => {
    h += `<div class="tseg"><span class="tl">${t[0]}</span><span class="tm">${t[1]} د</span></div>`;
  });
  h += "</div>";

  h += `<section class="blk"><div class="blabel">أهداف الحصة</div><div class="obj"><ul>${
    s.obj.map(o => `<li><span>${o}</span></li>`).join("")}</ul></div></section>`;

  h += `<section class="blk"><div class="blabel">التمهيد</div><div class="hook"><p>${
    s.hook.p}</p><span class="hq">${s.hook.q}</span></div></section>`;

  h += `<section class="blk"><div class="blabel">الشرح</div>${
    s.concepts.map((c, i) => conceptHTML(c, i, teacherMode)).join("")}</section>`;

  if (s.terms && s.terms.length) {
    h += `<section class="blk"><div class="blabel">المصطلحات</div><div class="terms">${
      s.terms.map(t =>
        `<div class="term"><span class="ta">${t[0]}</span><span class="te">${t[1]}</span><span class="td">${t[2]}</span></div>`
      ).join("")}</div></section>`;
  }

  h += `<section class="blk"><div class="blabel">أسئلة الحصة</div>${
    s.qs.map((q, i) => questionHTML(q, i)).join("")}</section>`;

  h += `<section class="blk"><div class="blabel">الواجب</div><div class="hw">${s.hw}</div></section>`;

  h += `<nav class="pager no-print">${
    prev
      ? `<button class="pbtn" type="button" data-go="${prev.n}"><span>&rarr; الحصة السابقة</span><b>${
          prev.rev ? prev.ref : prev.title}</b></button>`
      : '<button class="pbtn" type="button" disabled><span>&rarr; الحصة السابقة</span><b>بداية المذكرة</b></button>'
  }${
    next
      ? `<button class="pbtn next" type="button" data-go="${next.n}"><span>الحصة التالية &larr;</span><b>${
          next.rev ? next.ref : next.title}</b></button>`
      : '<button class="pbtn next" type="button" disabled><span>الحصة التالية &larr;</span><b>نهاية الترم الأول</b></button>'
  }</nav>`;

  return h;
}

/* ---------------- البحث ---------------- */

/** يبني فهرسًا مسطّحًا قابلًا للبحث من كل الحصص. */
export function buildIndex(sessions) {
  const idx = [];
  sessions.forEach(s => {
    const add = (kind, title, text) => {
      const t = plain(text);
      if (t) idx.push({ n: s.n, sTitle: s.rev ? s.ref : s.title, kind, title, text: t, low: t.toLowerCase() });
    };
    add("عنوان الحصة", s.ref, s.title + " — " + s.sub);
    s.obj.forEach(o => add("هدف", s.ref, o));
    add("تمهيد", s.ref, s.hook.p + " " + s.hook.q);
    (s.concepts || []).forEach(c => {
      add("مفهوم", c.t, [c.def, c.body, c.body2].filter(Boolean).join(" "));
      if (c.table)  add("جدول", c.table.cap, c.table.rows.flat().join(" · "));
      if (c.table2) add("جدول", c.table2.cap, c.table2.rows.flat().join(" · "));
      (c.boxes || []).forEach(b => add(BOXT[b.k] || "ملحوظة", b.t || c.t, b.h));
    });
    (s.terms || []).forEach(t => add("مصطلح", t[0] + " — " + t[1], t[2]));
    (s.qs || []).forEach(q => add("سؤال", s.ref, plain(q.t) + " " + (q.o || []).map(plain).join(" ")));
    add("واجب", s.ref, s.hw);
  });
  return idx;
}

export function search(idx, termRaw) {
  const term = termRaw.trim().toLowerCase();
  if (term.length < 2) return [];
  return idx
    .filter(r => r.low.includes(term))
    .slice(0, 60)
    .map(r => ({ ...r, snippet: snippetOf(r.text, term) }));
}

function snippetOf(text, term) {
  const at = text.toLowerCase().indexOf(term);
  if (at < 0) return escapeHTML(text.slice(0, 160));
  const from = Math.max(0, at - 70);
  const to = Math.min(text.length, at + term.length + 90);
  const before = escapeHTML(text.slice(from, at));
  const hit    = escapeHTML(text.slice(at, at + term.length));
  const after  = escapeHTML(text.slice(at + term.length, to));
  return (from > 0 ? "… " : "") + before + "<mark>" + hit + "</mark>" + after + (to < text.length ? " …" : "");
}

export function renderSearch(results, term) {
  let h = `<header class="page-head"><h2>نتائج البحث</h2><p>${
    results.length ? `${results.length} نتيجة لـ «${escapeHTML(term)}»` : `لا توجد نتائج لـ «${escapeHTML(term)}»`
  }</p></header>`;

  if (!results.length) {
    return h + '<div class="empty">جرّب كلمة أقصر أو مصطلحًا مختلفًا — البحث يشمل الشرح والجداول والمصطلحات والأسئلة.</div>';
  }

  h += results.map(r => `
    <div class="hit" data-go="${r.n}" role="button" tabindex="0">
      <div class="hit-top">
        <span class="hit-n">حصة ${r.n}</span>
        <span class="hit-t">${escapeHTML(r.title)}</span>
        <span class="hit-k">${r.kind}</span>
      </div>
      <div class="hit-x">${r.snippet}</div>
    </div>`).join("");
  return h;
}

/* ---------------- بنك الأسئلة ---------------- */

export function renderBank(sessions, filter) {
  const rows = [];
  sessions.forEach(s => {
    if (filter.unit !== "all" && String(s.unit) !== String(filter.unit)) return;
    (s.qs || []).forEach((q, i) => {
      const type = q.o ? "mcq" : "essay";
      if (filter.type !== "all" && filter.type !== type) return;
      rows.push({ q, i, s, type });
    });
  });

  let h = `<header class="page-head"><h2>بنك الأسئلة</h2>
    <p>كل أسئلة الترم الأول في مكان واحد — ${rows.length} سؤال معروض.</p></header>`;

  h += '<div class="filters no-print">';
  h += '<span class="chip">الوحدة</span>';
  [["all", "الكل"], ["1", "الأولى"], ["2", "الثانية"], ["3", "الثالثة"], ["4", "الرابعة"], ["0", "مراجعة"]]
    .forEach(([v, l]) => {
      h += `<button class="fbtn" type="button" data-filter="unit" data-val="${v}" aria-pressed="${
        String(filter.unit) === v}">${l}</button>`;
    });
  h += '<span class="chip">النوع</span>';
  [["all", "الكل"], ["mcq", "اختيار وتوصيل"], ["essay", "مقالي"]].forEach(([v, l]) => {
    h += `<button class="fbtn" type="button" data-filter="type" data-val="${v}" aria-pressed="${
      filter.type === v}">${l}</button>`;
  });
  h += '</div>';

  h += `<div class="topbar no-print">
    <span class="spacer"></span>
    <button class="tbtn" type="button" data-act="toggle-ans">إظهار الإجابات</button>
    <button class="tbtn" type="button" data-act="print">طباعة / PDF</button>
  </div>`;

  if (!rows.length) return h + '<div class="empty">لا توجد أسئلة بهذه الفلترة.</div>';

  h += rows.map((r, i) =>
    questionHTML(r.q, i, { source: `حصة ${r.s.n} · ${r.s.ref}` })).join("");
  return h;
}

/* ---------------- متابعة الطلبة (للمدرس) ---------------- */

export function renderStudents(rows, totalSessions) {
  const students = rows.filter(r => r.role === "student");
  const active = students.filter(r => r.loginCount > 0).length;
  const avg = students.length
    ? Math.round(students.reduce((a, r) => a + r.completed, 0) / students.length * 10) / 10
    : 0;

  let h = `<header class="page-head"><h2>متابعة الطلبة</h2>
    <p>مين دخل، وإمتى، وفين وصل في المذكرة.</p></header>`;

  h += `<div class="stats">
    <div class="stat"><div class="sv">${students.length}</div><div class="sl">طالب مسجَّل</div></div>
    <div class="stat"><div class="sv">${active}</div><div class="sl">دخل الموقع مرة على الأقل</div></div>
    <div class="stat"><div class="sv">${students.length - active}</div><div class="sl">لم يدخل بعد</div></div>
    <div class="stat"><div class="sv">${avg}</div><div class="sl">متوسط الحصص المنجزة</div></div>
  </div>`;

  h += `<div class="topbar no-print"><span class="spacer"></span>
    <button class="tbtn" type="button" data-act="refresh-students">تحديث</button>
    <button class="tbtn" type="button" data-act="export-csv">تصدير CSV</button>
    <button class="tbtn" type="button" data-act="print">طباعة / PDF</button></div>`;

  if (!rows.length) return h + '<div class="empty">قائمة المسموح لهم فارغة. شغّل سكربت seed لإضافة الطلبة.</div>';

  h += `<div class="tw"><table><caption>الطلبة وقائمة المسموح لهم</caption><thead><tr>
    <th>الاسم</th><th>الإيميل</th><th>الدور</th><th>آخر دخول</th>
    <th>مرات الدخول</th><th>التقدّم</th></tr></thead><tbody>`;

  rows.forEach(r => {
    const pct = totalSessions ? Math.round(r.completed / totalSessions * 100) : 0;
    h += `<tr>
      <td>${escapeHTML(r.name)}${r.active ? "" : ' <span class="hit-k">(موقوف)</span>'}</td>
      <td><span class="en">${escapeHTML(r.email)}</span></td>
      <td>${r.role === "teacher" ? "مدرس" : "طالب"}</td>
      <td class="num">${r.lastLogin ? fmtDate(r.lastLogin) : "—"}</td>
      <td class="num">${r.loginCount || 0}</td>
      <td><span class="num">${r.completed} / ${totalSessions}</span>
        <span class="mini-bar"><span style="width:${pct}%"></span></span></td>
    </tr>`;
  });

  return h + "</tbody></table></div>";
}

function fmtDate(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function studentsCSV(rows, totalSessions) {
  const head = ["name", "email", "role", "active", "lastLogin", "loginCount", "completed", "total"];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.join(",")];
  rows.forEach(r => lines.push([
    r.name, r.email, r.role, r.active ? "yes" : "no",
    r.lastLogin ? r.lastLogin.toISOString() : "", r.loginCount || 0,
    r.completed, totalSessions
  ].map(esc).join(",")));
  return "﻿" + lines.join("\r\n");
}
