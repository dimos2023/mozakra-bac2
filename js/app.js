// ============================================================
//  المتحكّم الرئيسي — الحالة والتوجيه وربط الأحداث
// ============================================================

import {
  auth, signIn, signOutNow, catchRedirect, verifyAccess, onAuthStateChanged
} from "./auth.js";
import {
  loadSessions, loadProgress, saveProgress, flushProgress, loadStudents, clearCache,
  loadGroups, createGroup, renameGroup, deleteGroup,
  loadMyRequest, submitRequest, loadRequests, approveRequest, rejectRequest, deleteRequest,
  setStudentGroup, setStudentActive, removeStudent, watchAccess,
  watchSessions, setReleased, setReleasedBulk
} from "./store.js";
import {
  UNITS, renderSession, renderSearch, renderBank, renderStudents, renderAdmin, renderRelease,
  buildIndex, search, studentsCSV, escapeHTML, joinFormHTML, pendingHTML
} from "./render.js";

/* ---------------- الحالة ---------------- */

const state = {
  user: null,
  role: "student",
  name: "",
  sessions: [],
  index: [],
  progress: { completed: [], lastSession: 1 },
  view: "session",        // session | search | bank | students | admin | release
  current: 1,
  teacherMode: false,
  answersOpen: false,
  bankFilter: { unit: "all", type: "all" },
  students: null,
  requests: null,
  groups: [],
  groupFilter: "all",
  myGroup: "",
  searchTerm: ""
};

const $ = id => document.getElementById(id);
const el = {
  boot: $("boot"), gate: $("gate"), gateBody: $("gateBody"), shell: $("shell"),
  nav: $("nav"), main: $("main"), me: $("me"),
  progressNum: $("progressNum"), progressFill: $("progressFill"),
  searchInput: $("searchInput"),
  side: $("side"), scrim: $("scrim"), menuBtn: $("menuBtn"),
  mSearchBtn: $("mSearchBtn"), mtitle: $("mtitle")
};

/* ---------------- درج القائمة على الموبايل ---------------- */

function drawer(open) {
  el.side.classList.toggle("open", open);
  el.scrim.hidden = !open;
  el.menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  document.body.style.overflow = open ? "hidden" : "";
}

const isMobile = () => matchMedia("(max-width:900px)").matches;

el.menuBtn.addEventListener("click", () => drawer(!el.side.classList.contains("open")));
el.scrim.addEventListener("click", () => drawer(false));
el.mSearchBtn.addEventListener("click", () => {
  drawer(true);
  setTimeout(() => el.searchInput.focus(), 240);
});
addEventListener("keydown", ev => {
  if (ev.key === "Escape" && el.side.classList.contains("open")) drawer(false);
});
// لو المستخدم لفّ الموبايل أو كبّر النافذة، نقفل الدرج حتى لا يعلق مفتوحًا
addEventListener("resize", () => { if (!isMobile()) drawer(false); });

/** يحدّث عنوان الشريط العلوي على الموبايل. */
function setMobileTitle() {
  const map = { search: "نتائج البحث", bank: "بنك الأسئلة",
                students: "متابعة الطلبة", admin: "طلبات الانضمام", release: "الحصص المتاحة" };
  if (state.view === "session") {
    const s = state.sessions.find(x => x.n === state.current);
    el.mtitle.textContent = s ? `حصة ${s.n} · ${s.rev ? s.ref : s.title}` : "المذكرة";
  } else {
    el.mtitle.textContent = map[state.view] || "المذكرة";
  }
}

/* ---------------- شاشة الدخول ---------------- */

const GATE_MSG = {
  "disabled": () => "حسابك موقوف حاليًا. كلّم المدرس لإعادة تفعيله.",
  "unverified": () => "إيميل حسابك غير مُوثَّق من جوجل. وثّقه ثم أعد المحاولة.",
  "no-email": () => "تعذّر قراءة الإيميل من حساب جوجل.",
  "denied": () => "تم رفض الوصول. جرّب تسجيل الخروج والدخول تاني."
};

/** الزائر غير المسجَّل: يعرض فورم طلب انضمام أو حالة طلبه القائم. */
async function showJoinFlow(user) {
  gateWaiting("جارٍ التحميل…");

  const [groups, existing] = await Promise.all([loadGroups(), loadMyRequest(user.uid)]);

  if (existing && existing.status === "pending") {
    el.gateBody.innerHTML = pendingHTML(existing, groups) +
      '<button class="linkish" type="button" id="retryBtn">تسجيل الدخول بحساب آخر</button>';
    bindRetry();
    $("jRecheck").addEventListener("click", () => location.reload());
    return;
  }

  el.gateBody.innerHTML = joinFormHTML(user, groups, existing) +
    '<button class="linkish" type="button" id="retryBtn">تسجيل الدخول بحساب آخر</button>';
  bindRetry();

  const send = $("jSend");
  send.addEventListener("click", async () => {
    const name = $("jName").value.trim();
    const err  = $("jErr");
    if (name.length < 3) {
      err.textContent = "اكتب اسمك بالكامل من فضلك.";
      err.hidden = false;
      return;
    }
    err.hidden = true;
    send.disabled = true;
    send.textContent = "جارٍ الإرسال…";
    try {
      await submitRequest(user, {
        name,
        groupId: $("jGroup")?.value || "",
        note: $("jNote").value
      });
      await showJoinFlow(user);
    } catch (e) {
      err.innerHTML = e.code === "permission-denied"
        ? "<b>قواعد الأمان الجديدة لم تُنشر بعد.</b><br>" +
          "للمدرس: افتح Firebase ← Firestore ← Rules، والصق محتوى ملف " +
          '<span class="mail">firestore.rules</span> ثم اضغط Publish.'
        : "تعذّر إرسال الطلب: " + escapeHTML(e.code || e.message);
      err.hidden = false;
      send.disabled = false;
      send.textContent = "إرسال طلب الانضمام";
    }
  });
}

function bindRetry() {
  const r = $("retryBtn");
  if (r) r.addEventListener("click", async () => {
    await signOutNow().catch(() => {});
    resetGate();
  });
}

function gateMessage(kind, html, showRetry = true) {
  el.gateBody.innerHTML =
    `<div class="gate-msg ${kind}">${html}</div>` +
    (showRetry ? '<button class="linkish" type="button" id="retryBtn">تسجيل الدخول بحساب آخر</button>' : "");
  const r = $("retryBtn");
  if (r) r.addEventListener("click", async () => {
    await signOutNow().catch(() => {});
    resetGate();
  });
}

function gateWaiting(text) {
  el.gateBody.innerHTML = `<div class="gate-msg wait">${text}</div>`;
}

const REVOKED_MSG = {
  removed:  "تم إلغاء وصولك للمذكرة. لو ده بالغلط، كلّم المدرس أو اعمل طلب انضمام جديد.",
  disabled: "تم إيقاف حسابك مؤقتًا. كلّم المدرس لإعادة تفعيله."
};

function resetGate() {
  let notice = "";
  try {
    const r = sessionStorage.getItem("memo:revoked");
    if (r) {
      notice = `<div class="gate-msg err">${REVOKED_MSG[r] || REVOKED_MSG.removed}</div>`;
      sessionStorage.removeItem("memo:revoked");
    }
  } catch {}

  el.gateBody.innerHTML = notice + `
    <p class="gate-note">سجّل الدخول بحساب جوجل المسجَّل لدى المدرس للوصول إلى المذكرة.</p>
    <button class="gbtn" type="button" id="signinBtn">
      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.8 6.1C12.3 13.9 17.7 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17.3z"/>
        <path fill="#FBBC05" d="M10.4 28.2c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16 0 19.9 0 23.5s1 7.5 2.6 10.8l7.8-6.1z"/>
        <path fill="#34A853" d="M24 47c6.2 0 11.5-2 15.3-5.5l-7.5-5.8c-2.1 1.4-4.8 2.2-7.8 2.2-6.3 0-11.7-4.4-13.6-10.3l-7.8 6.1C6.5 41.6 14.6 47 24 47z"/>
      </svg><span>الدخول بحساب جوجل</span></button>`;
  bindSignIn();
}

function bindSignIn() {
  const b = $("signinBtn");
  if (!b) return;
  b.addEventListener("click", async () => {
    b.disabled = true;
    gateWaiting("جارٍ فتح نافذة جوجل…");
    try {
      await signIn();
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") {
        resetGate();
      } else if (err.code === "auth/unauthorized-domain") {
        gateMessage("err",
          "هذا النطاق غير مصرّح به في إعدادات Firebase.<br>" +
          "أضف الدومين في: Authentication ← Settings ← Authorized domains.", false);
      } else {
        gateMessage("err", "تعذّر تسجيل الدخول: " + escapeHTML(err.code || err.message));
      }
    }
  });
}

/* ---------------- الشريط الجانبي ---------------- */

function renderMe() {
  const photo = state.user.photoURL
    ? `<img src="${escapeHTML(state.user.photoURL)}" alt="" referrerpolicy="no-referrer"
           onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'avatar',textContent:this.dataset.i}))"
           data-i="${escapeHTML((state.name || "؟").trim().charAt(0))}">`
    : `<span class="avatar">${escapeHTML((state.name || "؟").trim().charAt(0))}</span>`;
  el.me.innerHTML = `${photo}
    <div class="who">
      <div class="nm">${escapeHTML(state.name)}</div>
      <div class="rl${state.role === "teacher" ? " t" : ""}">${
        state.role === "teacher" ? "مدرس"
          : (state.groups.find(g => g.id === state.myGroup)?.name || "طالب")}</div>
    </div>
    <button class="iconbtn" type="button" id="signoutBtn" title="تسجيل الخروج" aria-label="تسجيل الخروج">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>
      </svg></button>`;
  $("signoutBtn").addEventListener("click", async () => {
    await flushProgress();
    clearCache();
    await signOutNow();
    location.reload();
  });
}

function renderNav() {
  el.nav.innerHTML = "";
  UNITS.forEach(u => {
    const list = state.sessions.filter(s => s.unit === u.n);
    if (!list.length) return;
    const g = document.createElement("div");
    g.className = "unitgrp";
    g.innerHTML = `<div class="ulabel"><span class="unum">${
      u.n ? "U" + u.n : "REV"}</span><span>${u.name}</span></div>`;
    list.forEach(s => {
      const done = state.progress.completed.includes(s.n);
      const b = document.createElement("button");
      b.type = "button";
      const locked = state.role === "teacher" && !s.released;
      b.className = "navbtn" + (s.rev ? " rev" : "") + (done ? " done" : "") + (locked ? " locked" : "");
      b.dataset.n = s.n;
      b.innerHTML = `<span class="nn">${s.n}</span>
        <span>${s.rev ? s.ref : s.title}<span class="nd">${s.date}</span></span>
        <span class="tick">${locked ? "🔒" : "✓"}</span>`;
      b.addEventListener("click", () => go("session", s.n));
      g.appendChild(b);
    });
    el.nav.appendChild(g);
  });
  markNav();
}

function markNav() {
  document.querySelectorAll(".navbtn").forEach(b => {
    b.setAttribute("aria-current",
      state.view === "session" && Number(b.dataset.n) === state.current ? "true" : "false");
  });
  document.querySelectorAll(".link-btn[data-view]").forEach(b => {
    b.setAttribute("aria-current", state.view === b.dataset.view ? "true" : "false");
  });
}

function renderProgress() {
  const total = state.sessions.length || 20;
  const done = state.progress.completed.length;
  el.progressNum.textContent = `${done} / ${total}`;
  el.progressFill.style.width = total ? (done / total * 100) + "%" : "0%";
}

/* ---------------- التوجيه ---------------- */

function go(view, arg) {
  state.view = view;
  if (view === "session" && arg) state.current = Number(arg);
  state.answersOpen = false;
  drawer(false);
  draw();
  window.scrollTo(0, 0);
  if (view === "session") {
    state.progress.lastSession = state.current;
    persist();
    history.replaceState(null, "", "#h" + state.current);
  }
}

function draw() {
  if (state.view === "session") {
    const s = state.sessions.find(x => x.n === state.current);
    if (!s) return;
    el.main.innerHTML = renderSession(s, {
      isTeacher: state.role === "teacher",
      teacherMode: state.role === "teacher" && state.teacherMode,
      isDone: state.progress.completed.includes(s.n),
      prev: state.sessions.find(x => x.n === s.n - 1),
      next: state.sessions.find(x => x.n === s.n + 1)
    });
    injectModeToggle();
  } else if (state.view === "search") {
    el.main.innerHTML = renderSearch(search(state.index, state.searchTerm), state.searchTerm);
  } else if (state.view === "bank") {
    el.main.innerHTML = renderBank(state.sessions, state.bankFilter);
  } else if (state.view === "students") {
    if (!state.students) {
      el.main.innerHTML = '<div class="empty">جارٍ تحميل بيانات الطلبة…</div>';
      loadStudents().then(rows => {
        state.students = rows;
        if (state.view === "students") draw();
      }).catch(e => {
        el.main.innerHTML = `<div class="empty">تعذّر تحميل البيانات: ${escapeHTML(e.code || e.message)}</div>`;
      });
      return;
    }
    el.main.innerHTML = renderStudents(state.students, state.sessions.length,
                                       state.groups, state.groupFilter);
  } else if (state.view === "release") {
    el.main.innerHTML = renderRelease(state.sessions);
  } else if (state.view === "admin") {
    if (!state.requests) {
      el.main.innerHTML = '<div class="empty">جارٍ تحميل الطلبات…</div>';
      Promise.all([loadRequests(), loadGroups(), state.students ? state.students : loadStudents()])
        .then(([reqs, groups, students]) => {
          state.requests = reqs;
          state.groups = groups;
          state.students = students;
          if (state.view === "admin") draw();
        })
        .catch(e => {
          el.main.innerHTML = `<div class="empty">تعذّر التحميل: ${escapeHTML(e.code || e.message)}</div>`;
        });
      return;
    }
    const counts = {};
    (state.students || []).forEach(s => {
      if (s.groupId) counts[s.groupId] = (counts[s.groupId] || 0) + 1;
    });
    el.main.innerHTML = renderAdmin(state.requests, state.groups, counts);
  }
  markNav();
  updateBadge();
  setMobileTitle();
}

/** يضيف زر تبديل وضع المدرس/الطالب في شريط أدوات الحصة. */
function injectModeToggle() {
  if (state.role !== "teacher") return;
  const bar = el.main.querySelector(".topbar");
  if (!bar) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tbtn" + (state.teacherMode ? " on" : "");
  b.dataset.act = "toggle-mode";
  b.textContent = state.teacherMode ? "وضع المدرس" : "وضع الطالب";
  bar.appendChild(b);
}

/* ---------------- الأحداث ---------------- */

el.main.addEventListener("click", ev => {
  const goBtn = ev.target.closest("[data-go]");
  if (goBtn) { go("session", goBtn.dataset.go); return; }

  const f = ev.target.closest("[data-filter]");
  if (f) {
    if (f.dataset.filter === "group") state.groupFilter = f.dataset.val;
    else state.bankFilter[f.dataset.filter] = f.dataset.val;
    draw();
    return;
  }

  const a = ev.target.closest("[data-act]");
  if (!a) return;

  if (adminAction(a)) return;

  switch (a.dataset.act) {
    case "toggle-ans": {
      state.answersOpen = !state.answersOpen;
      el.main.querySelectorAll(".ans").forEach(x => { x.hidden = !state.answersOpen; });
      el.main.querySelectorAll('[data-act="toggle-ans"]').forEach(btn => {
        btn.textContent = state.answersOpen ? "إخفاء الإجابات" : "إظهار الإجابات";
        btn.classList.toggle("on", state.answersOpen);
      });
      break;
    }
    case "toggle-done": {
      const n = state.current;
      const i = state.progress.completed.indexOf(n);
      if (i >= 0) state.progress.completed.splice(i, 1);
      else state.progress.completed.push(n);
      state.progress.completed.sort((x, y) => x - y);
      persist();
      renderProgress();
      renderNav();
      draw();
      break;
    }
    case "toggle-mode":
      state.teacherMode = !state.teacherMode;
      try { localStorage.setItem("memo:teacherMode", state.teacherMode ? "1" : "0"); } catch {}
      draw();
      break;
    case "print":
      window.print();
      break;
    case "refresh-students":
      state.students = null;
      draw();
      break;
    case "export-csv": {
      const csv = studentsCSV(state.students || [], state.sessions.length, state.groups);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "students.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      break;
    }
  }
});

/* ---------------- أفعال الإدارة ---------------- */

/** ينفّذ أفعال صفحة الإدارة. يرجع true لو تعامل مع الحدث. */
function adminAction(a) {
  const act = a.dataset.act;
  const ADMIN = ["approve", "reject", "delete-request", "add-group", "rename-group",
                 "delete-group", "refresh-admin", "toggle-active", "remove-student",
                 "toggle-release", "release-next", "release-all", "lock-all"];
  if (!ADMIN.includes(act)) return false;
  if (state.role !== "teacher") return true;

  const busy = (on, txt) => { a.disabled = on; if (txt) a.textContent = txt; };
  const reload = () => { state.requests = null; state.students = null; draw(); };
  const fail = e => { alert("تعذّر التنفيذ: " + (e.code || e.message)); reload(); };

  switch (act) {
    case "approve": {
      const req = state.requests.find(r => r.uid === a.dataset.uid);
      if (!req) return true;
      const card = a.closest(".req");
      const gid = card?.querySelector('[data-role="group-pick"]')?.value || "";
      busy(true, "جارٍ القبول…");
      approveRequest(req, { groupId: gid }).then(reload).catch(fail);
      return true;
    }
    case "reject": {
      const req = state.requests.find(r => r.uid === a.dataset.uid);
      if (!req) return true;
      if (!confirm(`رفض طلب ${req.name || req.email}؟`)) return true;
      busy(true, "…");
      rejectRequest(req).then(reload).catch(fail);
      return true;
    }
    case "delete-request":
      if (!confirm("حذف سجل الطلب من الأرشيف؟\nده مش هيلغي وصول الطالب — لو عايز تلغيه روح متابعة الطلبة.")) return true;
      deleteRequest(a.dataset.uid).then(reload).catch(fail);
      return true;

    case "add-group": {
      const input = $("newGroupName");
      const name = (input?.value || "").trim();
      if (name.length < 2) { input?.focus(); return true; }
      busy(true, "…");
      createGroup(name).then(reload).catch(fail);
      return true;
    }
    case "rename-group": {
      const g = state.groups.find(x => x.id === a.dataset.gid);
      const name = prompt("الاسم الجديد للمجموعة:", g?.name || "");
      if (name === null || !name.trim()) return true;
      renameGroup(a.dataset.gid, name.trim()).then(reload).catch(fail);
      return true;
    }
    case "delete-group": {
      const g = state.groups.find(x => x.id === a.dataset.gid);
      if (!confirm(`حذف مجموعة «${g?.name}»؟\nالطلبة مش هيتحذفوا — هيبقوا بدون مجموعة.`)) return true;
      deleteGroup(a.dataset.gid).then(() => {
        state.groups = [];
        if (state.groupFilter === a.dataset.gid) state.groupFilter = "all";
        reload();
      }).catch(fail);
      return true;
    }
    case "refresh-admin":
      reload();
      return true;

    case "toggle-release":
    case "release-next": {
      const sess = state.sessions.find(x => x.id === a.dataset.id);
      if (!sess) return true;
      a.disabled = true;
      setReleased(sess.id, !sess.released).catch(fail);
      return true;
    }
    case "release-all": {
      const ids = state.sessions.filter(x => !x.released).map(x => x.id);
      if (!ids.length) return true;
      if (!confirm(`فتح ${ids.length} حصة لكل الطلبة؟`)) return true;
      a.disabled = true;
      setReleasedBulk(ids, true).catch(fail);
      return true;
    }
    case "lock-all": {
      const ids = state.sessions.filter(x => x.released && x.n !== 1).map(x => x.id);
      if (!ids.length) return true;
      if (!confirm(`قفل ${ids.length} حصة؟ الحصة الأولى هتفضل مفتوحة.`)) return true;
      a.disabled = true;
      setReleasedBulk(ids, false).catch(fail);
      return true;
    }

    case "toggle-active": {
      const on = a.dataset.active !== "true";
      setStudentActive(a.dataset.email, on).then(reload).catch(fail);
      return true;
    }
    case "remove-student":
      if (!confirm(`إلغاء وصول ${a.dataset.email} نهائيًا؟
هيتقفل عليه فورًا حتى لو الموقع مفتوح عنده دلوقتي.`)) return true;
      removeStudent(a.dataset.email).then(reload).catch(fail);
      return true;
  }
  return false;
}

// نقل طالب لمجموعة أخرى من القائمة المنسدلة
el.main.addEventListener("change", ev => {
  const sel = ev.target.closest('select[data-act="move-group"]');
  if (!sel || state.role !== "teacher") return;
  sel.disabled = true;
  setStudentGroup(sel.dataset.email, sel.value)
    .then(() => { state.students = null; state.requests = null; draw(); })
    .catch(e => { alert("تعذّر النقل: " + (e.code || e.message)); sel.disabled = false; });
});

// إضافة مجموعة بالضغط على Enter
el.main.addEventListener("keydown", ev => {
  if (ev.key === "Enter" && ev.target.id === "newGroupName") {
    ev.preventDefault();
    el.main.querySelector('[data-act="add-group"]')?.click();
  }
});

/** يحدّث عدّاد الطلبات المعلّقة على زر الإدارة. */
function updateBadge() {
  const btn = document.querySelector('.link-btn[data-view="admin"]');
  if (!btn) return;
  const n = (state.requests || []).filter(r => r.status === "pending").length;
  let dot = btn.querySelector(".badge-n");
  if (!n) { dot?.remove(); return; }
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "badge-n";
    btn.appendChild(dot);
  }
  dot.textContent = n;
}

el.main.addEventListener("keydown", ev => {
  if (ev.key !== "Enter" && ev.key !== " ") return;
  const hit = ev.target.closest(".hit[data-go]");
  if (!hit) return;
  ev.preventDefault();
  go("session", hit.dataset.go);
});

document.querySelectorAll(".link-btn[data-view]").forEach(b => {
  b.addEventListener("click", () => go(b.dataset.view));
});

let searchTimer = null;
el.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const v = el.searchInput.value.trim();
    state.searchTerm = v;
    if (v.length >= 2) { state.view = "search"; drawer(false); draw(); window.scrollTo(0, 0); }
    else if (state.view === "search") go("session", state.current);
  }, 220);
});

addEventListener("keydown", ev => {
  if (ev.target.matches("input, textarea")) return;
  if (ev.key === "/") { ev.preventDefault(); el.searchInput.focus(); return; }
  if (state.view !== "session") return;
  if (ev.key === "ArrowLeft" && state.sessions.some(s => s.n === state.current + 1)) go("session", state.current + 1);
  if (ev.key === "ArrowRight" && state.sessions.some(s => s.n === state.current - 1)) go("session", state.current - 1);
});

function persist() {
  if (!state.user) return;
  saveProgress(state.user.uid, (state.user.email || "").toLowerCase(), state.progress);
}

/* ---------------- الإقلاع ---------------- */

bindSignIn();

async function boot(user) {
  gateWaiting("جارٍ التحقق من صلاحية الوصول…");

  const res = await verifyAccess(user);
  if (!res.ok) {
    el.boot.hidden = true;
    el.gate.hidden = false;
    // غير مسجَّل → فورم طلب انضمام بدل الرفض
    if (res.reason === "not-listed") {
      await showJoinFlow(user);
    } else {
      gateMessage("err", (GATE_MSG[res.reason] || GATE_MSG.denied)(user.email || ""));
    }
    return;
  }

  state.user = user;
  state.role = res.role;
  state.name = res.name;
  state.myGroup = res.groupId || "";
  state.teacherMode = res.role === "teacher";
  try {
    const saved = localStorage.getItem("memo:teacherMode");
    if (saved !== null && res.role === "teacher") state.teacherMode = saved === "1";
  } catch {}

  gateWaiting("جارٍ تحميل المذكرة…");

  try {
    const [sessions, progress] = await Promise.all([
      loadSessions({ isTeacher: res.role === "teacher" }),
      loadProgress(user.uid)
    ]);
    state.sessions = sessions;
    state.index = buildIndex(sessions);
    state.progress = progress;
  } catch (e) {
    const msg = e.message === "empty-content"
      ? "المحتوى غير موجود في قاعدة البيانات.<br>شغّل <span class=\"mail\">npm run seed</span> من مجلد seed لرفع المذكرة."
      : "تعذّر تحميل المحتوى: " + escapeHTML(e.code || e.message);
    gateMessage("err", msg, false);
    el.boot.hidden = true;
    el.gate.hidden = false;
    return;
  }

  // الحصة المطلوبة من الرابط، وإلا آخر حصة محفوظة
  const fromHash = Number((location.hash.match(/^#h(\d+)$/) || [])[1]);
  state.current = state.sessions.some(s => s.n === fromHash)
    ? fromHash
    : (state.sessions.some(s => s.n === state.progress.lastSession) ? state.progress.lastSession : 1);

  document.querySelectorAll(".teacher-only").forEach(x => { x.hidden = state.role !== "teacher"; });

  // المجموعات: المدرس يحتاجها للإدارة، والطالب لعرض اسم مجموعته
  state.groups = await loadGroups();

  if (state.role === "teacher") {
    // نجلب الطلبات في الخلفية عشان يظهر عدّاد المعلّقة فورًا
    loadRequests().then(r => { state.requests = r; updateBadge(); }).catch(() => {});
  }

  renderMe();
  renderNav();
  renderProgress();
  draw();

  el.boot.hidden = true;
  el.gate.hidden = true;
  el.shell.hidden = false;

  // الحصص لحظيًا: أول ما المدرس يفتح حصة تظهر عند الطلبة فورًا
  watchSessions(state.role === "teacher", list => {
    const before = state.sessions.length;
    state.sessions = list;
    state.index = buildIndex(list);
    if (!list.some(x => x.n === state.current)) state.current = list[0]?.n || 1;
    renderNav();
    renderProgress();
    if (list.length !== before || state.view === "release") draw();
  });

  // إلغاء الوصول لحظيًا: لو المدرس حذف الطالب أو أوقفه، يخرج فورًا
  watchAccess(user.email, async reason => {
    try { sessionStorage.setItem("memo:revoked", reason); } catch {}
    await flushProgress();
    clearCache();
    await signOutNow().catch(() => {});
    location.reload();
  });
}

catchRedirect().finally(() => {
  onAuthStateChanged(auth, user => {
    if (user) {
      boot(user).catch(err => {
        gateMessage("err", "خطأ غير متوقع: " + escapeHTML(err.message || String(err)));
        el.boot.hidden = true;
        el.gate.hidden = false;
      });
    } else {
      state.user = null;
      el.boot.hidden = true;
      el.shell.hidden = true;
      el.gate.hidden = false;
      resetGate();
    }
  });
});
