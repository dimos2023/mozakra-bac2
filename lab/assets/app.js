/* ===================================================
   معمل البرمجة والأمن السيبراني — الملف المشترك
   التقدم بيتحفظ على جهاز الطالب (localStorage)
   =================================================== */

// سجل كل المعامل — لو ضفت مهمة جديدة في صفحة، ضيف الـ id بتاعها هنا
const LABS = [
  { id: 'symmetric', cat: 'enc', icon: '🔑', title: 'التشفير المتماثل', lesson: '2-1',
    desc: 'شفّر وفك رسائل بمفتاح مشترك واحد (AES) وشوف إيه اللي بيحصل لو المفتاح غلط.',
    href: 'labs/symmetric.html', tasks: ['caesar', 'encrypt', 'secret', 'wrongkey', 'q1'] },
  { id: 'publickey', cat: 'enc', icon: '🗝️', title: 'التشفير بالمفتاح العام و HTTPS', lesson: '2-1',
    desc: 'زوج مفاتيح (عام/خاص)، ابعت رسالة سرية لمنى، وحاول تتجسس — ورتّب مصافحة TLS.',
    href: 'labs/public-key.html', tasks: ['keys', 'send', 'spy', 'tls', 'q1'] },
  { id: 'https', cat: 'enc', icon: '🔍', title: 'فاحص HTTPS: هل الموقع مشفّر فعلاً؟', lesson: '2-1',
    desc: 'افحص شهادة أي موقع حقيقي، واكتب بايثون يكشف الشهادات المنتهية والمزوّرة ويشتغل على الإنترنت.',
    href: 'labs/https-check.html', tasks: ['valid', 'problems', 'code', 'live'] },
  { id: 'hash', cat: 'enc', icon: '#️⃣', title: 'دوال التجزئة (Hash)', lesson: '2-1',
    desc: 'SHA-256 على الهواء: غيّر حرف واحد وشوف البصمة كلها تتغير، واكشف ملف متلاعب فيه.',
    href: 'labs/hash.html', tasks: ['avalanche', 'password', 'integrity', 'q1'] },
  { id: 'signature', cat: 'enc', icon: '✍️', title: 'التوقيع الرقمي', lesson: '2-1',
    desc: 'وقّع شهادة بالمفتاح الخاص، وتحقق منها بالمفتاح العام، واكتشف التزوير.',
    href: 'labs/signature.html', tasks: ['sign', 'tamper', 'q1', 'q2'] },
  { id: 'twofa', cat: 'cyber', icon: '📱', title: 'المصادقة الثنائية (2FA)', lesson: '2-1',
    desc: 'تطبيق مصادقة حقيقي بيولّد كود كل 30 ثانية — ادخل بالباسورد + الكود.',
    href: 'labs/2fa.html', tasks: ['login', 'expired', 'factors'] },
  { id: 'password', cat: 'cyber', icon: '🔒', title: 'قوة كلمة المرور', lesson: '2-1',
    desc: 'احسب قوة الباسورد والوقت اللازم لكسره بالتخمين.',
    href: 'labs/password.html', tasks: ['strong', 'rank', 'q1'] },
  { id: 'firewall', cat: 'cyber', icon: '🧱', title: 'جدار الحماية و DMZ', lesson: '2-2',
    desc: 'اكتب قواعد الجدار الناري لشبكة مدرسة وشغّل المحاكاة على الحزم.',
    href: 'labs/firewall.html', tasks: ['rules', 'q1', 'q2'] },
  { id: 'incident', cat: 'cyber', icon: '🚨', title: 'الاستجابة للحوادث والمخاطر', lesson: '2-3',
    desc: 'رتّب المراحل الست، صنّف الإجراءات، واحسب الخطر = التأثير × الاحتمالية.',
    href: 'labs/incident.html', tasks: ['order', 'classify', 'risk'] },
  { id: 'http', cat: 'code', icon: '🌐', title: 'HTTP و API', lesson: '3-2',
    desc: 'ابعت طلبات GET/POST/DELETE لخادم تجريبي وشوف رموز الحالة و JSON.',
    href: 'labs/http.html', tasks: ['get', 'notfound', 'post', 'auth'] },
  { id: 'python', cat: 'code', icon: '🐍', title: 'معمل بايثون', lesson: 'تطبيقي',
    desc: 'اكتب كود بايثون حقيقي يتنفذ في المتصفح، وتحديات بتتصحح أوتوماتيك.',
    href: 'labs/python.html', tasks: ['c1', 'c2', 'c3', 'c4', 'c5'] },
  { id: 'web', cat: 'code', icon: '🎨', title: 'معمل الويب HTML/CSS/JS', lesson: '3-3',
    desc: 'اكتب صفحة ويب وشوفها فورًا، مع تحديات HTML الدلالية والتصميم المتجاوب.',
    href: 'labs/web.html', tasks: ['w1', 'w2', 'w3', 'w4'] },
];

const CATS = {
  enc: { title: 'التشفير', icon: '🔐' },
  cyber: { title: 'الأمن السيبراني', icon: '🛡️' },
  code: { title: 'البرمجة والويب', icon: '💻' },
};

/* ---------- التخزين ---------- */
const KEY = 'cyberlab-progress-v1';
const NAME_KEY = 'cyberlab-student';
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* وضع خاص */ }
}
function getName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
function setName(n) {
  try { localStorage.setItem(NAME_KEY, n); } catch { /* تجاهل */ }
}
function isDone(lab, task) {
  const p = loadProgress();
  return !!(p[lab] && p[lab][task]);
}
function labStats(lab) {
  const p = loadProgress()[lab.id] || {};
  const done = lab.tasks.filter(t => p[t]).length;
  return { done, total: lab.tasks.length };
}

/* ---------- الإشعار ---------- */
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- المهام ---------- */
const PAGE_LAB = document.body.dataset.lab;

function markDone(task, lab = PAGE_LAB) {
  const p = loadProgress();
  p[lab] = p[lab] || {};
  const firstTime = !p[lab][task];
  p[lab][task] = new Date().toISOString();
  saveProgress(p);
  refreshTasks();
  if (firstTime) toast('🎉 أحسنت! المهمة اتسجلت');
}

function refreshTasks() {
  document.querySelectorAll('.card.task[data-task]').forEach((el, i) => {
    const done = isDone(PAGE_LAB, el.dataset.task);
    el.classList.toggle('done', done);
    const b = el.querySelector('.task-badge');
    if (b) b.textContent = done ? '✓ تمت' : `مهمة ${i + 1}`;
  });
  const lab = LABS.find(l => l.id === PAGE_LAB);
  const line = document.querySelector('.progress-line');
  if (lab && line) {
    const s = labStats(lab);
    line.querySelector('.bar > span').style.width = (100 * s.done / s.total) + '%';
    line.querySelector('.count').textContent = `${s.done} من ${s.total} مهام`;
  }
}

// إظهار نتيجة داخل عنصر .result
function showResult(el, kind, html) {
  if (typeof el === 'string') el = document.querySelector(el);
  if (!el) return;
  el.className = 'result show ' + kind;
  el.innerHTML = html;
}

/* ---------- أسئلة الاختيار من متعدد ----------
   <div class="mcq" data-answer="b" data-explain="...">  + زر [data-check-mcq] */
function wireMcq(root = document) {
  // المهمة ممكن يبقى فيها أكتر من سؤال .mcq — كلهم لازم يبقوا صح
  root.querySelectorAll('.card.task').forEach(task => {
    const qs = [...task.querySelectorAll('.mcq')];
    const btn = task.querySelector('[data-check-mcq]');
    if (!qs.length || !btn) return;
    const res = task.querySelector('.result');
    btn.addEventListener('click', () => {
      let right = 0, anyEmpty = false;
      qs.forEach(q => {
        const picked = q.querySelector('input:checked');
        if (!picked) anyEmpty = true;
        else if (picked.value === q.dataset.answer) right++;
      });
      if (anyEmpty) return showResult(res, 'info', 'جاوب على كل الأسئلة الأول 🙂');
      if (right === qs.length) {
        const explain = qs.map(q => q.dataset.explain || '').join(' ');
        showResult(res, 'ok', '✓ إجابة صحيحة. ' + explain);
        markDone(task.dataset.task);
      } else {
        showResult(res, 'bad', qs.length > 1
          ? `✗ ${right} من ${qs.length} صح — راجع الباقي وجرب تاني.`
          : '✗ مش صح — راجع الدرس وجرب تاني.');
      }
    });
  });
}

/* ---------- ترتيب الخطوات ----------
   <ol class="order-list" data-order="a,b,c"> <li data-id="a">...</li> + زر [data-check-order] */
function wireOrder(root = document) {
  root.querySelectorAll('.order-list').forEach(list => {
    const items = [...list.children];
    // خلط عشوائي مع ضمان إنه مش مترتب صح من الأول
    const correct = list.dataset.order.split(',');
    do { items.sort(() => Math.random() - .5); } while (items.map(i => i.dataset.id).join() === correct.join());
    items.forEach(li => {
      const txt = li.innerHTML;
      li.innerHTML = `<span class="num"></span><span class="txt">${txt}</span>
        <button type="button" aria-label="لأعلى">▲</button><button type="button" aria-label="لأسفل">▼</button>`;
      const [up, down] = li.querySelectorAll('button');
      up.onclick = () => { if (li.previousElementSibling) list.insertBefore(li, li.previousElementSibling); renum(); };
      down.onclick = () => { if (li.nextElementSibling) list.insertBefore(li.nextElementSibling, li); renum(); };
      list.appendChild(li);
    });
    function renum() { [...list.children].forEach((li, i) => li.querySelector('.num').textContent = (i + 1) + '.'); }
    renum();
    const task = list.closest('.card.task');
    task.querySelector('[data-check-order]').addEventListener('click', () => {
      const now = [...list.children].map(li => li.dataset.id);
      const right = now.filter((id, i) => id === correct[i]).length;
      const res = task.querySelector('.result');
      if (right === correct.length) {
        showResult(res, 'ok', '✓ الترتيب صحيح بالكامل!');
        markDone(task.dataset.task);
      } else {
        showResult(res, 'bad', `✗ ${right} من ${correct.length} في مكانهم الصح. كمّل ترتيب.`);
      }
    });
  });
}

/* ---------- أدوات مساعدة ---------- */
const enc = new TextEncoder();
const dec = new TextDecoder();
function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(str) {
  const s = atob(str.trim());
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function hex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- الهيدر ---------- */
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function buildHeader() {
  const root = document.body.dataset.root || '.';
  const bar = document.createElement('header');
  bar.className = 'topbar';
  bar.innerHTML = `<div class="container">
      <a class="brand" href="${root}/index.html"><span class="logo">🛡️</span> معمل البرمجة والأمن السيبراني</a>
      <span class="spacer"></span>
      <span class="student-chip"></span>
      <a class="back-link" href="${root}/../index.html">📘 المذكرة</a>
      <button class="icon-btn" id="themeBtn" type="button" title="تغيير الوضع">🌓</button>
    </div>`;
  document.body.prepend(bar);
  const n = getName();
  bar.querySelector('.student-chip').textContent = n ? '👤 ' + n : '';
  let theme = null;
  try { theme = localStorage.getItem('cyberlab-theme'); } catch { /* تجاهل */ }
  applyTheme(theme);
  bar.querySelector('#themeBtn').onclick = () => {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const cur = document.documentElement.dataset.theme || (dark ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('cyberlab-theme', next); } catch { /* تجاهل */ }
  };
}

/* ---------- رأس صفحة المعمل ---------- */
function buildLabHead() {
  const lab = LABS.find(l => l.id === PAGE_LAB);
  const holder = document.querySelector('#labHead');
  if (!lab || !holder) return;
  document.title = lab.title + ' — معمل البرمجة والأمن السيبراني';
  holder.className = 'page-head';
  holder.innerHTML = `
    <div class="crumbs"><a href="../index.html">الرئيسية</a> ‹ ${CATS[lab.cat].title}</div>
    <h1>${lab.icon} ${lab.title} <span class="lesson-tag">الدرس ${lab.lesson}</span></h1>
    <p class="lead">${holder.dataset.lead || lab.desc}</p>
    <div class="progress-line"><div class="bar"><span></span></div><span class="count"></span></div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  buildHeader();
  buildLabHead();
  wireMcq();
  wireOrder();
  refreshTasks();
});
