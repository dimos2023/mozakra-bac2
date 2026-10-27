#!/usr/bin/env node
/* ============================================================
 *  رفع اختبار أونلاين إلى Firestore
 *  ------------------------------------------------------------
 *  الاستخدام:
 *    node seed-exam.js                       رفع exam-u1u2.js
 *    node seed-exam.js --file=exam-u1u2.js   تحديد الملف
 *    node seed-exam.js --dry                 عرض ما سيحدث دون كتابة
 *
 *  بيكتب وثيقتين:
 *    exams/{id}     الأسئلة بلا إجابات — الطالب يقراها لو open == true
 *    examKeys/{id}  الإجابات والتعليلات — المدرس وحده يقراها
 *
 *  الاختبار يُرفع **مقفولًا** (open: false) حتى يراجعه المدرس
 *  ويفتحه بزر واحد من صفحة الاختبارات.
 * ============================================================ */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY  = args.includes("--dry");
const fileArg = (args.find(a => a.startsWith("--file=")) || "").slice(7);
const EXAM_PATH = join(HERE, fileArg || "exam-u1u2.js");

function die(msg) { console.error("\n✗ " + msg + "\n"); process.exit(1); }

if (!existsSync(EXAM_PATH)) die(`لم يُعثر على ملف الاختبار: ${EXAM_PATH}`);

const exam = (await import(pathToFileURL(EXAM_PATH).href)).default;

/* ---------------- تسطيح الأسئلة وترقيمها ---------------- */

const TF_OPTS = ["صح", "خطأ"];

const questions = [];   // للطالب — بلا إجابات
const key       = [];   // للمدرس — الإجابة والتعليل

exam.sections.forEach((sec, si) => {
  sec.qs.forEach(q => {
    const n = questions.length + 1;
    const o = sec.type === "tf" ? TF_OPTS.slice() : q.o.slice();
    if (!Array.isArray(o) || o.length < 2) die(`السؤال ${n} بلا بدائل.`);
    if (!(q.a >= 0 && q.a < o.length))     die(`السؤال ${n} إجابته الصحيحة خارج نطاق البدائل.`);
    if (!q.t || !q.why)                    die(`السؤال ${n} ناقص النص أو التعليل.`);
    questions.push({ n, sec: si, type: sec.type, t: q.t, o, marks: 1, s: q.s });
    key.push({ n, a: q.a, why: q.why, s: q.s });
  });
});

const total = questions.reduce((a, q) => a + q.marks, 0);

const meta = {
  id:    exam.id,
  term:  exam.term,
  title: exam.title,
  sub:   exam.sub,
  mins:  exam.mins,
  from:  exam.from,
  to:    exam.to,
  total,
  count: questions.length,
  rules: exam.rules,
  sections: exam.sections.map((s, i) => ({
    i, t: s.t, lead: s.lead, type: s.type,
    n: s.qs.length,
    marks: s.qs.length
  }))
};

/* ---------------- تقرير قبل الرفع ---------------- */

console.log(`\n  ${meta.title}`);
console.log(`  ${meta.sub}`);
console.log(`  ${meta.count} سؤالًا · ${meta.total} درجة · ${meta.mins} دقيقة\n`);
meta.sections.forEach(s => console.log(`    ${s.t}: ${s.n} سؤال (${s.type === "tf" ? "صح وخطأ" : "اختيار من متعدد"})`));

const perSession = {};
key.forEach(k => { perSession[k.s] = (perSession[k.s] || 0) + 1; });
console.log("\n  التوزيع على الحصص:");
Object.keys(perSession).sort((a, b) => a - b)
  .forEach(s => console.log(`    حصة ${s}: ${perSession[s]} سؤال`));

if (DRY) { console.log("\n  (--dry) لم يُكتب شيء.\n"); process.exit(0); }

/* ---------------- الرفع ---------------- */

const KEY_PATH = join(HERE, "service-account.json");
if (!existsSync(KEY_PATH)) die("لم يُعثر على service-account.json في مجلد seed.");

const SA = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const app = initializeApp({ credential: cert(SA), projectId: SA.project_id });
const db  = getFirestore(app);

console.log(`\n  المشروع: ${SA.project_id}`);

const ref  = db.collection("exams").doc(exam.id);
const prev = await ref.get();
// الفتح وعرض النتائج يتحكّم فيهما المدرس من الموقع — فلا نصفّرهما
// عند إعادة الرفع، وإلا قفلنا اختبارًا جاريًا بالغلط.
const open        = prev.exists ? prev.data().open        === true : false;
const showResults = prev.exists ? prev.data().showResults === true : false;

await ref.set({
  ...meta,
  open,
  showResults,
  payload: JSON.stringify(questions),
  updatedAt: new Date()
}, { merge: true });

await db.collection("examKeys").doc(exam.id).set({
  term: exam.term,
  examId: exam.id,
  payload: JSON.stringify(key),
  updatedAt: new Date()
}, { merge: true });

console.log(`\n✓ اترفع: exams/${exam.id} و examKeys/${exam.id}`);
console.log(`  الحالة: ${open ? "مفتوح للطلبة" : "مقفول — افتحه من صفحة «الاختبارات» في الموقع"}\n`);
process.exit(0);
