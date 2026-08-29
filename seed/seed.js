#!/usr/bin/env node
/* ============================================================
 *  سكربت رفع المحتوى وقائمة الطلبة إلى Firestore
 *  ------------------------------------------------------------
 *  الاستخدام:
 *    npm install
 *    npm run seed              رفع المحتوى + قائمة الطلبة
 *    npm run seed -- --content رفع المحتوى فقط
 *    npm run seed -- --users   رفع قائمة الطلبة فقط
 *    npm run seed -- --dry     عرض ما سيحدث دون كتابة
 *
 *  يحتاج ملف service-account.json في نفس المجلد (لا تضعه على GitHub).
 * ============================================================ */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const only = { content: args.includes("--content"), users: args.includes("--users") };
const doAll = !only.content && !only.users;
const DRY = args.includes("--dry");

const KEY_PATH      = join(HERE, "service-account.json");
const CONTENT_PATH  = join(HERE, "content-term1.json");
const STUDENTS_PATH = join(HERE, "students.csv");

function die(msg) {
  console.error("\n✗ " + msg + "\n");
  process.exit(1);
}

if (!existsSync(KEY_PATH)) {
  die(`لم يُعثر على service-account.json في مجلد seed.

  الخطوات:
  1. افتح Firebase Console ← Project settings ← Service accounts
  2. اضغط Generate new private key
  3. احفظ الملف باسم service-account.json داخل مجلد seed
  4. تأكد أنه مذكور في .gitignore (وهو كذلك افتراضيًا)`);
}

const KEY = JSON.parse(readFileSync(KEY_PATH, "utf8"));
if (!KEY.project_id) die("ملف service-account.json لا يحتوي على project_id — تأكد أنه المفتاح الصحيح.");

const app = initializeApp({ credential: cert(KEY), projectId: KEY.project_id });
const db = getFirestore(app);

console.log(`  المشروع: ${KEY.project_id}`);

/* ---------------- رفع المحتوى ---------------- */

async function seedContent() {
  if (!existsSync(CONTENT_PATH)) die(`لم يُعثر على ${CONTENT_PATH}`);

  const sessions = JSON.parse(readFileSync(CONTENT_PATH, "utf8"));
  if (!Array.isArray(sessions) || !sessions.length) die("ملف المحتوى فارغ أو غير صالح.");

  console.log(`\n▸ المحتوى: ${sessions.length} حصة`);

  // Firestore لا يسمح بمصفوفة داخل مصفوفة (timing و terms و rows كلها كذلك)،
  // لذلك نخزّن الحصة كنص JSON في حقل واحد، ونُبقي n و term كحقول عُليا للفلترة.
  // نقرأ حالة الفتح الحالية حتى لا نلغي اختيارات المدرس عند إعادة الرفع.
  // ملحوظة: نُسجّل فقط الوثائق التي *عرَّفت* الحقل — الوثيقة القديمة التي
  // لا تحتوي عليه تُعامَل كأنها جديدة فتأخذ الافتراضي، لا كأنها مقفولة.
  const existing = new Map();
  const cur = await db.collection("sessions").get();
  cur.forEach(d => {
    const v = d.data().released;
    if (typeof v === "boolean") existing.set(d.id, v);
  });

  const RELEASE_ALL  = args.includes("--release-all");
  const RELEASE_NONE = args.includes("--lock-all");

  const docs = sessions.map(s => {
    if (!s.id) die(`حصة رقم ${s.n} بلا معرّف id`);
    const payload = JSON.stringify(s);
    const size = Buffer.byteLength(payload, "utf8");
    if (size > 900_000) die(`حصة ${s.n} حجمها ${size} بايت — أكبر من حد Firestore.`);

    // الأولوية: الأعلام الصريحة ← الحالة المحفوظة ← الافتراضي (الأولى مفتوحة فقط)
    const released = RELEASE_ALL  ? true
                   : RELEASE_NONE ? (s.n === 1)
                   : existing.has(s.id) ? existing.get(s.id)
                   : (s.n === 1);

    return { doc: { id: s.id, n: s.n, term: s.term, title: s.title, released, payload }, size };
  });

  const openCount = docs.filter(d => d.doc.released).length;
  console.log(`   الفتح: ${openCount} مفتوحة · ${docs.length - openCount} مقفولة`);

  const total = docs.reduce((a, d) => a + d.size, 0);
  console.log(`   الحجم الكلي: ${(total / 1024).toFixed(0)} كيلوبايت` +
              ` · أكبر حصة: ${(Math.max(...docs.map(d => d.size)) / 1024).toFixed(0)} كيلوبايت`);

  if (DRY) {
    docs.forEach(d => console.log(`   [تجريبي] sessions/${d.doc.id} — ${d.doc.title}`));
    return;
  }

  // Firestore يسمح بـ 500 عملية في الدفعة الواحدة
  let batch = db.batch(), count = 0, written = 0;
  for (const d of docs) {
    batch.set(db.collection("sessions").doc(d.doc.id), d.doc);
    if (++count === 400) { await batch.commit(); written += count; batch = db.batch(); count = 0; }
  }
  if (count) { await batch.commit(); written += count; }

  console.log(`   ✓ تم رفع ${written} حصة إلى sessions/`);
}

/* ---------------- رفع قائمة الطلبة ---------------- */

function parseCSV(text) {
  const rows = [];
  // نتجاهل الأسطر الفارغة وأسطر التعليق التي تبدأ بـ #
  const lines = text.replace(/^﻿/, "").split(/\r?\n/)
    .filter(l => l.trim() && !l.trim().startsWith("#"));
  if (!lines.length) return rows;

  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  const iEmail = header.indexOf("email");
  const iName  = header.indexOf("name");
  const iRole  = header.indexOf("role");
  const iActive = header.indexOf("active");
  if (iEmail < 0) die("ملف students.csv لازم يحتوي على عمود email.");

  for (let i = 1; i < lines.length; i++) {
    const c = splitLine(lines[i]);
    const email = (c[iEmail] || "").trim().toLowerCase();
    // تحقق صارم: لا مسافات ولا فواصل، و"@" واحدة، ونطاق فيه نقطة
    if (!/^[^\s@,;/]+@[^\s@,;/]+\.[^\s@,;/]+$/.test(email)) {
      console.warn(`   ! تخطّي السطر ${i + 1}: إيميل غير صالح "${c[iEmail] || ""}"`);
      continue;
    }
    rows.push({
      email,
      name:   (iName  >= 0 ? c[iName]  : "").trim() || email.split("@")[0],
      role:   ((iRole >= 0 ? c[iRole] : "").trim().toLowerCase() === "teacher") ? "teacher" : "student",
      active: iActive >= 0 ? !/^(no|false|0)$/i.test((c[iActive] || "").trim()) : true
    });
  }
  return rows;
}

function splitLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function seedUsers() {
  if (!existsSync(STUDENTS_PATH)) {
    die(`لم يُعثر على students.csv في مجلد seed.
  انسخ students.sample.csv وسمّه students.csv واملأه بإيميلات طلبتك.`);
  }

  const rows = parseCSV(readFileSync(STUDENTS_PATH, "utf8"));
  if (!rows.length) die("students.csv لا يحتوي على أي إيميل صالح.");

  const teachers = rows.filter(r => r.role === "teacher");
  if (!teachers.length) {
    console.warn("   ! تحذير: مفيش أي حساب بدور teacher. لن يستطيع أحد رؤية صفحة متابعة الطلبة.");
  }

  console.log(`\n▸ قائمة المسموح لهم: ${rows.length} حساب (${teachers.length} مدرس)`);

  if (DRY) {
    rows.forEach(r => console.log(`   [تجريبي] allowlist/${r.email} — ${r.name} (${r.role})`));
    return;
  }

  let batch = db.batch(), count = 0, written = 0;
  for (const r of rows) {
    batch.set(db.collection("allowlist").doc(r.email),
      { name: r.name, role: r.role, active: r.active }, { merge: true });
    if (++count === 400) { await batch.commit(); written += count; batch = db.batch(); count = 0; }
  }
  if (count) { await batch.commit(); written += count; }

  console.log(`   ✓ تم رفع ${written} حساب إلى allowlist/`);
}

/* ---------------- التشغيل ---------------- */

(async () => {
  console.log(DRY ? "\n=== تشغيل تجريبي (لن تُكتب أي بيانات) ===" : "\n=== رفع البيانات إلى Firestore ===");
  try {
    if (doAll || only.content) await seedContent();
    if (doAll || only.users)   await seedUsers();
    console.log("\n✓ تمّ.\n");
    process.exit(0);
  } catch (err) {
    die("فشل الرفع: " + (err.message || err));
  }
})();
