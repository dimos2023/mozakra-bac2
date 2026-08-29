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
    ${ctx.isTeacher ? `<button class="tbtn lock-btn${s.released ? " on" : ""}" type="button"
        data-act="toggle-release" data-id="${escapeHTML(s.id)}">${
        s.released ? "🔓 مفتوحة للطلبة" : "🔒 مقفولة"}</button>` : ""}
  </div>`;

  if (ctx.isTeacher && !s.released) {
    h += `<div class="box warn no-print lock-note" style="margin:0 0 18px">
      <div class="bt"><span class="ic">🔒</span>مقفولة — الطلبة مش شايفينها</div>
      <p>اضغط <b>🔒 مقفولة</b> فوق عشان تفتحها. هتظهر عندهم فورًا.</p></div>`;
  }

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

/* ---------------- الحضور ---------------- */

/** بطاقة تسجيل الحضور التي يراها الطالب أعلى الحصة. */
export function attendanceCard(session, isOpen, myRecord) {
  if (myRecord) {
    const t = myRecord.atDate || myRecord.at?.toDate?.();
    return `<div class="att done no-print">
      <div class="att-h"><span class="att-ico">✓</span>حضورك اتسجّل</div>
      <p>حصة ${session.n}${t ? ` — الساعة ${fmtTime(t)}` : ""}${
        myRecord.by === "teacher" ? " · سجّله المدرس" : ""}</p>
    </div>`;
  }
  if (!isOpen) return "";
  return `<div class="att open no-print">
    <div class="att-h"><span class="att-ico">◉</span>المدرس فتح تسجيل الحضور</div>
    <p>سجّل حضورك في <b>حصة ${session.n}</b> دلوقتي — التسجيل هيتقفل بعد شوية.</p>
    <button class="gbtn primary" type="button" data-act="check-in">سجّل حضوري</button>
  </div>`;
}

/** زر فتح/قفل الحضور الذي يراه المدرس داخل الحصة. */
export function attendanceToggle(session, openId, count) {
  const isOpen = openId === session.id;
  const elsewhere = openId && !isOpen;
  return `<div class="att ${isOpen ? "open" : "idle"} no-print">
    <div class="att-h"><span class="att-ico">${isOpen ? "◉" : "○"}</span>${
      isOpen ? `تسجيل الحضور مفتوح — سجّل ${count}` : "تسجيل الحضور مقفول"}</div>
    <p>${isOpen
      ? "الطلبة شايفين زر التسجيل دلوقتي. اقفله في آخر الحصة عشان محدش يسجّل بعدين."
      : elsewhere
        ? "التسجيل مفتوح على حصة تانية — فتحه هنا هيقفله هناك."
        : "افتحه في أول الحصة، والطلبة الحاضرين هيسجّلوا."}</p>
    <div class="att-act">
      <button class="tbtn ${isOpen ? "bad" : "ok"}" type="button"
              data-act="${isOpen ? "close-att" : "open-att"}" data-id="${escapeHTML(session.id)}">${
        isOpen ? "اقفل التسجيل" : "افتح تسجيل الحضور"}</button>
      <button class="tbtn" type="button" data-view-go="attendance">كشف الحضور</button>
    </div>
  </div>`;
}

/** صفحة الحضور: مصفوفة الطلبة × الحصص. */
export function renderAttendance(sessions, students, records, openId) {
  const released = sessions.filter(s => s.released);
  const learners = students.filter(s => s.role === "student" && s.uid);
  const key = (sid, uid) => sid + "_" + uid;
  const map = new Set(records.map(r => key(r.sessionId, r.uid)));

  const openSession = sessions.find(s => s.id === openId);
  const todayCount = openId ? records.filter(r => r.sessionId === openId).length : 0;

  let h = `<header class="page-head"><h2>كشف الحضور</h2>
    <p>الطالب يسجّل حضوره بنفسه وقت ما تفتح التسجيل — وتقدر تعدّل أي خانة بالضغط عليها.</p></header>`;

  /* --- حالة النافذة --- */
  h += openSession
    ? `<div class="att open no-print">
        <div class="att-h"><span class="att-ico">◉</span>التسجيل مفتوح على حصة ${openSession.n} — سجّل ${todayCount} من ${learners.length}</div>
        <div class="att-act">
          <button class="tbtn bad" type="button" data-act="close-att">اقفل التسجيل</button>
        </div></div>`
    : `<div class="att idle no-print">
        <div class="att-h"><span class="att-ico">○</span>التسجيل مقفول</div>
        <p>افتحه من داخل الحصة، أو اختر حصة من هنا:</p>
        <div class="att-act">${
          released.slice(-6).reverse().map(s =>
            `<button class="tbtn" type="button" data-act="open-att" data-id="${escapeHTML(s.id)}">حصة ${s.n}</button>`
          ).join("")}</div></div>`;

  if (!learners.length) return h + '<div class="empty">مفيش طلبة مسجّلين بعد.</div>';
  if (!released.length) return h + '<div class="empty">لسه ما فتحتش أي حصة.</div>';

  /* --- إحصائيات ---
     الجدول يعرض الموقوفين أيضًا لأن حضورهم السابق سجلّ،
     لكن الإحصائيات تُحسب على النشطين وحدهم فلا يشوّهها من خرج من الفصل. */
  const totals = learners.map(s => released.filter(x => map.has(key(x.id, s.uid))).length);
  const activeTotals = learners
    .map((s, i) => ({ active: s.active !== false, t: totals[i] }))
    .filter(x => x.active).map(x => x.t);
  const avg = activeTotals.length
    ? Math.round(activeTotals.reduce((a, b) => a + b, 0) / activeTotals.length * 10) / 10 : 0;
  const perfect = activeTotals.filter(t => t === released.length).length;
  const zero = activeTotals.filter(t => t === 0).length;

  h += `<div class="stats">
    <div class="stat"><div class="sv">${released.length}</div><div class="sl">حصة مفتوحة</div></div>
    <div class="stat"><div class="sv">${avg}</div><div class="sl">متوسط الحضور</div></div>
    <div class="stat"><div class="sv">${perfect}</div><div class="sl">حضروا كل الحصص</div></div>
    <div class="stat"><div class="sv">${zero}</div><div class="sl">لم يحضروا نهائيًا</div></div>
  </div>`;

  h += `<div class="topbar no-print"><span class="spacer"></span>
    <button class="tbtn" type="button" data-act="refresh-att">تحديث</button>
    <button class="tbtn" type="button" data-act="export-att">تصدير CSV</button>
    <button class="tbtn" type="button" data-act="print">طباعة</button></div>`;

  /* --- المصفوفة --- */
  h += `<div class="tw"><table class="att-grid"><caption>الحضور — اضغط أي خانة لتعديلها</caption>
    <thead><tr><th>الطالب</th>${
      released.map(s => `<th class="att-col" title="${escapeHTML(s.title || "")}">${s.n}</th>`).join("")
    }<th>الإجمالي</th></tr></thead><tbody>`;

  learners.forEach((st, i) => {
    const total = totals[i];
    const pct = released.length ? Math.round(total / released.length * 100) : 0;
    h += `<tr><td class="att-name">${escapeHTML(st.name)}${
      st.active ? "" : ' <span class="hit-k">(موقوف)</span>'}</td>`;
    released.forEach(s => {
      const on = map.has(key(s.id, st.uid));
      h += `<td class="att-cell"><button class="attx${on ? " on" : ""}" type="button"
        data-act="toggle-att" data-sid="${escapeHTML(s.id)}" data-uid="${escapeHTML(st.uid)}"
        title="${escapeHTML(st.name)} — حصة ${s.n}: ${on ? "حاضر" : "غائب"}"
        aria-label="${on ? "حاضر" : "غائب"}">${on ? "✓" : "·"}</button></td>`;
    });
    h += `<td class="att-total"><span class="num">${total}/${released.length}</span>
      <span class="mini-bar"><span style="width:${pct}%"></span></span></td></tr>`;
  });

  return h + "</tbody></table></div>";
}

export function attendanceCSV(sessions, students, records) {
  const released = sessions.filter(s => s.released);
  const learners = students.filter(s => s.role === "student" && s.uid);
  const map = new Set(records.map(r => r.sessionId + "_" + r.uid));
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["name", "email", ...released.map(s => "S" + s.n), "total"].map(esc).join(",")];
  learners.forEach(st => {
    const cells = released.map(s => (map.has(s.id + "_" + st.uid) ? "1" : "0"));
    lines.push([st.name, st.email, ...cells,
      cells.filter(c => c === "1").length].map(esc).join(","));
  });
  return "﻿" + lines.join("\r\n");
}

function fmtTime(d) {
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------------- الاشتراك: شريط الطالب ---------------- */

/** شريط يظهر أعلى الحصة عندما يستحقّ على الطالب شهر. */
export function billingBanner(cfg, b) {
  if (!cfg.enabled) return "";

  if (b.pending) {
    return `<div class="bill wait no-print">
      <div class="bill-h"><span class="bill-ico">⏳</span>إقرارك بالتحويل وصل للمدرس</div>
      <p>الشهر ${b.cycle} — مستني تأكيد المدرس. هيختفي الشريط ده أول ما يأكّد.</p>
    </div>`;
  }

  if (!b.due) {
    // لا مستحقّات: نعرض تقدّم الشهر الجاري فقط
    const left = b.perCycle - b.inCycle;
    return `<div class="bill ok no-print">
      <div class="bill-h"><span class="bill-ico">✓</span>اشتراكك سليم</div>
      <p>فُتح ${b.inCycle} من ${b.perCycle} حصص في الشهر الحالي${
        left > 0 ? ` — باقي <b>${left}</b> على الدفعة الجاية.` : "."}</p>
    </div>`;
  }

  return `<div class="bill due no-print">
    <div class="bill-h"><span class="bill-ico">!</span>${
      b.due > 1 ? `عليك ${b.due} أشهر متأخرة` : `حان موعد اشتراك الشهر ${b.cycle}`}</div>
    <p>المدرس فتح <b>${b.earned * b.perCycle}</b> حصة، يعني <b>${b.earned}</b> ${
      b.earned > 1 ? "أشهر" : "شهر"} من الدراسة.${
      b.rejected ? " <b>إقرارك السابق اتّرفض</b> — راجع رقم العملية وابعت تاني." : ""}</p>
    <div class="bill-grid">
      <div class="bill-cell"><span>المبلغ</span><b>${escapeHTML(String(cfg.amount))} ${escapeHTML(cfg.currency)}</b></div>
      ${cfg.instapay ? `<div class="bill-cell"><span>حوّل على إنستاباي</span>
        <b class="mail" id="ipHandle">${escapeHTML(cfg.instapay)}</b>
        <button class="tbtn tiny" type="button" data-act="copy-instapay"
                data-v="${escapeHTML(cfg.instapay)}">نسخ</button></div>` : ""}
    </div>
    ${cfg.note ? `<p class="bill-note">${escapeHTML(cfg.note)}</p>` : ""}
    <div class="bill-act">
      <button class="tbtn ok" type="button" data-act="open-claim">حوّلت — سجّل الإقرار</button>
    </div>
  </div>`;
}

/** نموذج إقرار التحويل. */
export function claimFormHTML(cfg, b) {
  return `<div class="bill due no-print" id="claimBox">
    <div class="bill-h"><span class="bill-ico">✎</span>إقرار تحويل — الشهر ${b.cycle}</div>
    <p>اكتب <b>رقم العملية</b> أو آخر 4 أرقام من الحساب اللي حوّلت منه، عشان المدرس يقدر يطابقها.</p>
    <label class="fld">
      <span>رقم العملية أو مرجع التحويل</span>
      <input type="text" id="payRef" maxlength="80" placeholder="مثلاً: 1234567890">
    </label>
    <div class="jerr" id="payErr" hidden></div>
    <div class="bill-act">
      <button class="tbtn ok" type="button" data-act="send-claim">إرسال الإقرار</button>
      <button class="tbtn" type="button" data-act="cancel-claim">إلغاء</button>
    </div>
    <p class="bill-note">الموقع <b>لا يتحقق من التحويل</b> — المدرس هو اللي بيراجع ويأكّد.</p>
  </div>`;
}

/* ---------------- الاشتراك: صفحة المدرس ---------------- */

export function renderBilling(cfg, payments, students, releasedCount) {
  const perCycle = Math.max(1, cfg.perCycle || 4);
  const earned = Math.floor(releasedCount / perCycle);
  const claimed = payments.filter(p => p.status === "claimed");
  const confirmed = payments.filter(p => p.status === "confirmed");
  const learners = students.filter(s => s.role === "student" && s.active);

  // من عليه مستحقّات
  const paidBy = {};
  confirmed.forEach(p => { paidBy[p.uid] = (paidBy[p.uid] || 0) + 1; });
  const owing = learners.filter(s => {
    const uid = s.uid || "";
    return earned - (paidBy[uid] || 0) > 0;
  });

  let h = `<header class="page-head"><h2>الاشتراكات</h2>
    <p>الحساب بعدد الحصص اللي فتحتها — كل ${perCycle} حصص = شهر.</p></header>`;

  h += `<div class="stats">
    <div class="stat"><div class="sv">${releasedCount}</div><div class="sl">حصة مفتوحة</div></div>
    <div class="stat"><div class="sv">${earned}</div><div class="sl">شهر مستحق على كل طالب</div></div>
    <div class="stat"><div class="sv">${claimed.length}</div><div class="sl">إقرار مستني تأكيدك</div></div>
    <div class="stat"><div class="sv">${confirmed.length}</div><div class="sl">دفعة مؤكَّدة</div></div>
  </div>`;

  h += `<div class="topbar no-print"><span class="spacer"></span>
    <button class="tbtn" type="button" data-act="refresh-billing">تحديث</button></div>`;

  /* --- الإعدادات --- */
  h += `<section class="blk"><div class="blabel">إعدادات الاشتراك</div>
    <div class="card-form">
      <label class="fld chk">
        <input type="checkbox" id="bEnabled" ${cfg.enabled ? "checked" : ""}>
        <span>فعّل تذكير الاشتراك للطلبة</span>
      </label>
      <div class="fld-row">
        <label class="fld"><span>المبلغ الشهري</span>
          <input type="number" id="bAmount" min="0" step="1" value="${escapeHTML(String(cfg.amount))}"></label>
        <label class="fld"><span>العملة</span>
          <input type="text" id="bCurrency" maxlength="12" value="${escapeHTML(cfg.currency)}"></label>
        <label class="fld"><span>عدد الحصص في الشهر</span>
          <input type="number" id="bPerCycle" min="1" max="12" value="${escapeHTML(String(perCycle))}"></label>
      </div>
      <label class="fld"><span>حساب إنستاباي (الاسم أو الرقم اللي الطالب هيحوّل عليه)</span>
        <input type="text" id="bInstapay" maxlength="80" value="${escapeHTML(cfg.instapay)}"
               placeholder="مثلاً: ahmed@instapay أو 010xxxxxxxx"></label>
      <label class="fld"><span>ملحوظة تظهر للطالب <em>(اختياري)</em></span>
        <textarea id="bNote" rows="2" maxlength="300"
                  placeholder="مثلاً: اكتب اسمك في خانة الملاحظات عند التحويل">${escapeHTML(cfg.note)}</textarea></label>
      <div class="bill-act">
        <button class="tbtn ok" type="button" data-act="save-billing">حفظ الإعدادات</button>
      </div>
    </div></section>`;

  /* --- إقرارات في الانتظار --- */
  h += `<section class="blk"><div class="blabel">إقرارات مستنية تأكيدك ${
    claimed.length ? `(${claimed.length})` : ""}</div>`;
  if (!claimed.length) {
    h += '<div class="empty">مفيش إقرارات جديدة.</div>';
  } else {
    h += claimed.map(p => `<div class="req">
      <div class="req-who">
        <span class="avatar">${escapeHTML((p.name || "؟").charAt(0))}</span>
        <div>
          <div class="req-nm">${escapeHTML(p.name || "—")}</div>
          <div class="req-ml"><span class="en">${escapeHTML(p.email || "")}</span></div>
          ${p.claimedAtDate ? `<div class="req-dt">${fmtDate(p.claimedAtDate)}</div>` : ""}
        </div>
      </div>
      <div class="req-note">الشهر <b>${p.cycle}</b> · المبلغ <b>${escapeHTML(String(p.amount))}</b>
        ${p.ref ? ` · المرجع <b class="mail">${escapeHTML(p.ref)}</b>` : " · <b>بلا مرجع</b>"}</div>
      <div class="req-act">
        <span class="spacer"></span>
        <button class="tbtn ok"  type="button" data-act="confirm-pay" data-id="${escapeHTML(p.id)}">تأكيد الاستلام</button>
        <button class="tbtn bad" type="button" data-act="reject-pay"  data-id="${escapeHTML(p.id)}">رفض</button>
      </div>
    </div>`).join("");
  }
  h += "</section>";

  /* --- من عليه مستحقّات --- */
  h += `<section class="blk"><div class="blabel">عليهم مستحقّات ${owing.length ? `(${owing.length})` : ""}</div>`;
  if (!earned) {
    h += `<div class="empty">لسه ما فتحتش ${perCycle} حصص، فمفيش مستحقّات.</div>`;
  } else if (!owing.length) {
    h += '<div class="empty">كل الطلبة دافعين. 👌</div>';
  } else {
    h += `<div class="tw"><table><caption>مستحقّات حتى الحصة ${releasedCount}</caption><thead><tr>
      <th>الاسم</th><th>الإيميل</th><th>مدفوع</th><th>مستحق</th><th>المتأخر</th></tr></thead><tbody>`;
    owing.forEach(s => {
      const paid = paidBy[s.uid || ""] || 0;
      h += `<tr>
        <td>${escapeHTML(s.name)}</td>
        <td><span class="en">${escapeHTML(s.email)}</span></td>
        <td class="num">${paid}</td>
        <td class="num">${earned}</td>
        <td><span class="badge rejected">${earned - paid}</span></td>
      </tr>`;
    });
    h += "</tbody></table></div>";
  }
  h += "</section>";

  /* --- سجل الدفعات --- */
  const done = payments.filter(p => p.status !== "claimed");
  if (done.length) {
    h += `<section class="blk"><div class="blabel">سجل الدفعات</div><div class="tw"><table>
      <caption>آخر ${Math.min(done.length, 30)} دفعة</caption>
      <thead><tr><th>الاسم</th><th>الشهر</th><th>المبلغ</th><th>المرجع</th><th>الحالة</th><th>التاريخ</th><th class="no-print"></th></tr></thead><tbody>`;
    done.slice(0, 30).forEach(p => {
      h += `<tr>
        <td>${escapeHTML(p.name || "—")}</td>
        <td class="num">${p.cycle}</td>
        <td class="num">${escapeHTML(String(p.amount))}</td>
        <td><span class="en">${escapeHTML(p.ref || "—")}</span></td>
        <td><span class="badge ${p.status === "confirmed" ? "approved" : "rejected"}">${
          p.status === "confirmed" ? "مؤكَّدة" : "مرفوضة"}</span></td>
        <td class="num">${p.claimedAtDate ? fmtDate(p.claimedAtDate) : "—"}</td>
        <td class="no-print"><button class="iconbtn danger" type="button"
             data-act="delete-pay" data-id="${escapeHTML(p.id)}" title="حذف السجل">✕</button></td>
      </tr>`;
    });
    h += "</tbody></table></div></section>";
  }

  return h;
}

/* ---------------- شاشة الحصة المقفولة ---------------- */

/** يعرضها الطالب لما يفتح حصة لسه المدرس ما فتحهاش. */
export function renderLocked(o, ctx = {}) {
  const nextOpen = ctx.nextOpen;
  return `
  <div class="topbar no-print">
    <span class="chip">${o.unit ? "الوحدة " + o.unit : "مراجعة نهائية"}</span>
    ${o.pages ? `<span class="chip">${escapeHTML(o.pages)}</span>` : ""}
  </div>

  <header class="shead locked-head">
    <div class="kicker">
      <span class="bignum lock">🔒 حصة ${o.n}</span>
      <span class="dateline">${escapeHTML(o.date || "")}</span>
      ${o.ref ? `<span class="lref">${escapeHTML(o.ref)}</span>` : ""}
    </div>
    <h2>${escapeHTML(o.title || "")}</h2>
    ${o.sub ? `<p class="sub">${escapeHTML(o.sub)}</p>` : ""}
  </header>

  <div class="locked-card">
    <div class="locked-ico">🔒</div>
    <h3>الحصة دي لسه مقفولة</h3>
    <p>المدرس بيفتح كل حصة يوم ما يشرحها. أول ما يفتحها هتظهر عندك
       <b>على طول</b> من غير ما تعمل أي حاجة.</p>
    ${o.date ? `<p class="locked-when">موعدها المتوقّع: <b>${escapeHTML(o.date)}</b></p>` : ""}
    ${nextOpen ? `<button class="gbtn primary" type="button" data-go="${nextOpen.n}"
        style="max-width:340px;margin-inline:auto">ارجع لآخر حصة مفتوحة — حصة ${nextOpen.n}</button>` : ""}
  </div>`;
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

/* ---------------- صفحة الإدارة: الطلبات والمجموعات ---------------- */

function groupOptions(groups, selected, includeNone = true) {
  return (includeNone ? `<option value=""${selected ? "" : " selected"}>— بدون مجموعة —</option>` : "") +
    groups.map(g =>
      `<option value="${escapeHTML(g.id)}"${g.id === selected ? " selected" : ""}>${escapeHTML(g.name)}</option>`
    ).join("");
}

/* ---------------- لوحة فتح الحصص ---------------- */

export function renderRelease(sessions) {
  const open = sessions.filter(s => s.released).length;
  const nextLocked = sessions.find(s => !s.released);

  let h = `<header class="page-head"><h2>الحصص المتاحة للطلبة</h2>
    <p>افتح الحصة يوم ما تشرحها. المقفولة <b>محتواها مش بيوصل أجهزة الطلبة أصلًا</b>.</p></header>`;

  h += `<div class="stats">
    <div class="stat"><div class="sv">${open}</div><div class="sl">حصة مفتوحة</div></div>
    <div class="stat"><div class="sv">${sessions.length - open}</div><div class="sl">حصة مقفولة</div></div>
    <div class="stat"><div class="sv">${nextLocked ? nextLocked.n : "—"}</div><div class="sl">التالية للفتح</div></div>
  </div>`;

  h += `<div class="topbar no-print"><span class="spacer"></span>
    ${nextLocked ? `<button class="tbtn ok" type="button" data-act="release-next"
        data-id="${escapeHTML(nextLocked.id)}">افتح الحصة ${nextLocked.n} التالية</button>` : ""}
    <button class="tbtn" type="button" data-act="release-all">افتح الكل</button>
    <button class="tbtn bad" type="button" data-act="lock-all">اقفل الكل عدا الأولى</button>
  </div>`;

  h += '<div class="rel-grid">';
  sessions.forEach(s => {
    h += `<button class="rel${s.released ? " on" : ""}" type="button"
      data-act="toggle-release" data-id="${escapeHTML(s.id)}"
      title="${s.released ? "اضغط للقفل" : "اضغط للفتح"}">
      <span class="rel-n">${s.n}</span>
      <span class="rel-t">${escapeHTML(s.rev ? s.ref : s.title)}</span>
      <span class="rel-d">${escapeHTML(s.date)}</span>
      <span class="rel-s">${s.released ? "🔓 مفتوحة" : "🔒 مقفولة"}</span>
    </button>`;
  });
  h += "</div>";

  return h;
}

export function renderAdmin(requests, groups, counts) {
  const pending  = requests.filter(r => r.status === "pending");
  const decided  = requests.filter(r => r.status !== "pending");

  let h = `<header class="page-head"><h2>طلبات الانضمام والمجموعات</h2>
    <p>الطلبة اللي سجّلوا دخول ومستنيين موافقتك، وتنظيم مجموعاتك.</p></header>`;

  h += `<div class="topbar no-print"><span class="spacer"></span>
    <button class="tbtn" type="button" data-act="refresh-admin">تحديث</button></div>`;

  /* --- الطلبات المعلّقة --- */
  h += `<section class="blk"><div class="blabel">طلبات في الانتظار ${
    pending.length ? `(${pending.length})` : ""}</div>`;

  if (!pending.length) {
    h += '<div class="empty">مفيش طلبات جديدة دلوقتي.</div>';
  } else {
    h += pending.map(r => {
      const wanted = groups.find(g => g.id === r.groupId);
      return `<div class="req" data-uid="${escapeHTML(r.uid)}">
        <div class="req-who">
          ${r.photo
            ? `<img src="${escapeHTML(r.photo)}" alt="" referrerpolicy="no-referrer">`
            : `<span class="avatar">${escapeHTML((r.name || "؟").charAt(0))}</span>`}
          <div>
            <div class="req-nm">${escapeHTML(r.name || "—")}</div>
            <div class="req-ml"><span class="en">${escapeHTML(r.email)}</span></div>
            ${r.createdAtDate ? `<div class="req-dt">${fmtDate(r.createdAtDate)}</div>` : ""}
          </div>
        </div>
        ${r.note ? `<div class="req-note">${escapeHTML(r.note)}</div>` : ""}
        ${wanted ? `<div class="req-want">طلب الانضمام لـ <b>${escapeHTML(wanted.name)}</b></div>` : ""}
        <div class="req-act">
          <label class="sel">
            <span>المجموعة</span>
            <select data-role="group-pick">${groupOptions(groups, r.groupId)}</select>
          </label>
          <button class="tbtn ok"  type="button" data-act="approve" data-uid="${escapeHTML(r.uid)}">قبول</button>
          <button class="tbtn bad" type="button" data-act="reject"  data-uid="${escapeHTML(r.uid)}">رفض</button>
        </div>
      </div>`;
    }).join("");
  }
  h += "</section>";

  /* --- المجموعات --- */
  h += `<section class="blk"><div class="blabel">المجموعات</div>`;
  h += `<div class="newgrp no-print">
    <input type="text" id="newGroupName" placeholder="اسم المجموعة — مثلاً: مجموعة السبت 10ص" maxlength="60">
    <button class="tbtn" type="button" data-act="add-group">إضافة مجموعة</button>
  </div>`;

  if (!groups.length) {
    h += '<div class="empty">لسه مفيش مجموعات. أضف واحدة فوق عشان توزّع عليها الطلبة.</div>';
  } else {
    h += '<div class="grps">' + groups.map(g => `
      <div class="grp" data-gid="${escapeHTML(g.id)}">
        <div class="grp-nm">${escapeHTML(g.name)}</div>
        <div class="grp-ct">${counts[g.id] || 0} طالب</div>
        <div class="grp-act no-print">
          <button class="iconbtn" type="button" data-act="rename-group" data-gid="${escapeHTML(g.id)}"
                  title="إعادة تسمية" aria-label="إعادة تسمية">✎</button>
          <button class="iconbtn danger" type="button" data-act="delete-group" data-gid="${escapeHTML(g.id)}"
                  title="حذف" aria-label="حذف">✕</button>
        </div>
      </div>`).join("") + "</div>";
  }
  h += "</section>";

  /* --- الطلبات المنتهية --- */
  if (decided.length) {
    h += `<section class="blk"><div class="blabel">طلبات سابقة</div>
      <div class="box an" style="margin:0 0 12px"><div class="bt"><span class="ic">ت</span>ملحوظة</div>
      <p>حذف السجل من هنا <b>لا يُلغي وصول الطالب</b> — ده أرشيف الطلبات بس.
         لإلغاء الوصول فعليًا، روح <b>متابعة الطلبة</b> واستخدم زر الإيقاف أو الحذف.</p></div>
      <div class="tw"><table>
      <caption>آخر ${Math.min(decided.length, 25)} طلب</caption>
      <thead><tr><th>الاسم</th><th>الإيميل</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead><tbody>`;
    decided.slice(0, 25).forEach(r => {
      h += `<tr>
        <td>${escapeHTML(r.name || "—")}</td>
        <td><span class="en">${escapeHTML(r.email)}</span></td>
        <td><span class="badge ${r.status}">${r.status === "approved" ? "مقبول" : "مرفوض"}</span></td>
        <td class="num">${r.createdAtDate ? fmtDate(r.createdAtDate) : "—"}</td>
        <td class="no-print"><button class="iconbtn danger" type="button"
             data-act="delete-request" data-uid="${escapeHTML(r.uid)}" title="حذف سجل الطلب من الأرشيف (لا يلغي الوصول)">✕</button></td>
      </tr>`;
    });
    h += "</tbody></table></div></section>";
  }

  return h;
}

/* ---------------- متابعة الطلبة (للمدرس) ---------------- */

export function renderStudents(rows, totalSessions, groups = [], filterGroup = "all",
                               attendance = [], releasedCount = 0) {
  const gname = id => groups.find(g => g.id === id)?.name || "";
  const attBy = {};
  attendance.forEach(r => { attBy[r.uid] = (attBy[r.uid] || 0) + 1; });
  const shown = rows.filter(r =>
    filterGroup === "all" ? true :
    filterGroup === "none" ? !r.groupId : r.groupId === filterGroup);

  const students = shown.filter(r => r.role === "student");
  const active = students.filter(r => r.loginCount > 0).length;
  const avg = students.length
    ? Math.round(students.reduce((a, r) => a + r.completed, 0) / students.length * 10) / 10
    : 0;

  let h = `<header class="page-head"><h2>متابعة الطلبة</h2>
    <p>مين دخل، وإمتى، وفين وصل في المذكرة.</p></header>`;

  h += `<div class="stats">
    <div class="stat"><div class="sv">${students.length}</div><div class="sl">طالب${
      filterGroup === "all" ? " مسجَّل" : " في المجموعة"}</div></div>
    <div class="stat"><div class="sv">${active}</div><div class="sl">دخل مرة على الأقل</div></div>
    <div class="stat"><div class="sv">${students.length - active}</div><div class="sl">لم يدخل بعد</div></div>
    <div class="stat"><div class="sv">${avg}</div><div class="sl">متوسط الحصص المنجزة</div></div>
  </div>`;

  if (groups.length) {
    h += '<div class="filters no-print"><span class="chip">المجموعة</span>';
    h += `<button class="fbtn" type="button" data-filter="group" data-val="all"
            aria-pressed="${filterGroup === "all"}">الكل</button>`;
    groups.forEach(g => {
      h += `<button class="fbtn" type="button" data-filter="group" data-val="${escapeHTML(g.id)}"
              aria-pressed="${filterGroup === g.id}">${escapeHTML(g.name)}</button>`;
    });
    h += `<button class="fbtn" type="button" data-filter="group" data-val="none"
            aria-pressed="${filterGroup === "none"}">بدون مجموعة</button></div>`;
  }

  h += `<div class="topbar no-print"><span class="spacer"></span>
    <button class="tbtn" type="button" data-act="refresh-students">تحديث</button>
    <button class="tbtn" type="button" data-act="export-csv">تصدير CSV</button>
    <button class="tbtn" type="button" data-act="print">طباعة / PDF</button></div>`;

  if (!shown.length) {
    return h + '<div class="empty">مفيش طلبة هنا. لما طالب يسجّل دخول هيظهر طلبه في صفحة «طلبات الانضمام».</div>';
  }

  h += `<div class="tw"><table><caption>الطلبة${
    filterGroup !== "all" && filterGroup !== "none" ? " — " + escapeHTML(gname(filterGroup)) : ""
  }</caption><thead><tr>
    <th>الاسم</th><th>الإيميل</th><th>المجموعة</th><th>آخر دخول</th>
    <th>الدخول</th><th>الحضور</th><th>التقدّم</th><th class="no-print"></th></tr></thead><tbody>`;

  shown.forEach(r => {
    const pct = totalSessions ? Math.round(r.completed / totalSessions * 100) : 0;
    h += `<tr data-email="${escapeHTML(r.email)}">
      <td>${escapeHTML(r.name)}${r.role === "teacher" ? ' <span class="badge t">مدرس</span>' : ""}${
        r.active ? "" : ' <span class="badge off">موقوف</span>'}</td>
      <td><span class="en">${escapeHTML(r.email)}</span></td>
      <td class="no-print"><select class="gsel" data-act="move-group" data-email="${escapeHTML(r.email)}"
           ${r.role === "teacher" ? "disabled" : ""}>${groupOptions(groups, r.groupId)}</select></td>
      <td class="num">${r.lastLogin ? fmtDate(r.lastLogin) : "—"}</td>
      <td class="num">${r.loginCount || 0}</td>
      <td class="num">${r.role === "teacher" ? "—" : `${attBy[r.uid] || 0} / ${releasedCount}`}</td>
      <td><span class="num">${r.completed} / ${totalSessions}</span>
        <span class="mini-bar"><span style="width:${pct}%"></span></span></td>
      <td class="no-print">${r.role === "teacher" ? "" :
        `<button class="iconbtn" type="button" data-act="toggle-active" data-email="${escapeHTML(r.email)}"
                 data-active="${r.active}" title="${r.active ? "إيقاف" : "تفعيل"}">${r.active ? "⏸" : "▶"}</button>
         <button class="iconbtn danger" type="button" data-act="remove-student" data-email="${escapeHTML(r.email)}"
                 title="إلغاء الوصول نهائيًا">✕</button>`}</td>
    </tr>`;
  });

  return h + "</tbody></table></div>";
}

function fmtDate(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function studentsCSV(rows, totalSessions, groups = []) {
  const gname = id => groups.find(g => g.id === id)?.name || "";
  const head = ["name", "email", "role", "group", "active", "lastLogin", "loginCount", "completed", "total"];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.join(",")];
  rows.forEach(r => lines.push([
    r.name, r.email, r.role, gname(r.groupId), r.active ? "yes" : "no",
    r.lastLogin ? r.lastLogin.toISOString() : "", r.loginCount || 0,
    r.completed, totalSessions
  ].map(esc).join(",")));
  return "﻿" + lines.join("\r\n");
}

/* ---------------- فورم طلب الانضمام (شاشة الدخول) ---------------- */

export function joinFormHTML(user, groups, existing) {
  const name = existing?.name || user.displayName || "";
  const note = existing?.note || "";
  const gid  = existing?.groupId || "";
  const resubmit = existing?.status === "rejected";

  return `
    ${resubmit ? '<div class="gate-msg err">طلبك السابق اترفض. تقدر تعدّل بياناتك وتبعت تاني.</div>' : ""}
    <p class="gate-note">حسابك <span class="mail">${escapeHTML(user.email || "")}</span> مش مسجَّل لسه.
       اعمل طلب انضمام والمدرس هيراجعه.</p>
    <div class="jform">
      <label class="fld">
        <span>اسمك بالكامل</span>
        <input type="text" id="jName" value="${escapeHTML(name)}" maxlength="60" placeholder="مثلاً: محمد علي حسن">
      </label>
      ${groups.length ? `
      <label class="fld">
        <span>مجموعتك</span>
        <select id="jGroup">
          <option value=""${gid ? "" : " selected"}>— مش متأكد / المدرس يحدد —</option>
          ${groups.map(g => `<option value="${escapeHTML(g.id)}"${
            g.id === gid ? " selected" : ""}>${escapeHTML(g.name)}</option>`).join("")}
        </select>
      </label>` : ""}
      <label class="fld">
        <span>ملحوظة للمدرس <em>(اختياري)</em></span>
        <textarea id="jNote" rows="2" maxlength="300"
                  placeholder="مثلاً: أنا من مدرسة كذا، ميعادي السبت الصبح">${escapeHTML(note)}</textarea>
      </label>
      <div class="jerr" id="jErr" hidden></div>
      <button class="gbtn primary" type="button" id="jSend">${resubmit ? "إعادة إرسال الطلب" : "إرسال طلب الانضمام"}</button>
    </div>`;
}

export function pendingHTML(req, groups) {
  const g = groups.find(x => x.id === req.groupId);
  return `
    <div class="gate-msg wait">
      <b>طلبك وصل للمدرس ومستني الموافقة.</b><br>
      هتقدر تدخل أول ما يوافق — جرّب تحدّث الصفحة بعدين.
    </div>
    <div class="jsum">
      <div><span>الاسم</span><b>${escapeHTML(req.name || "—")}</b></div>
      <div><span>الإيميل</span><b class="mail">${escapeHTML(req.email)}</b></div>
      ${g ? `<div><span>المجموعة</span><b>${escapeHTML(g.name)}</b></div>` : ""}
    </div>
    <button class="gbtn" type="button" id="jRecheck">تحقّق دلوقتي</button>`;
}
