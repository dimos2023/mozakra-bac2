# مذكرة البرمجة والذكاء الاصطناعي — الصف الثاني الثانوي

موقع مذكرة الترم الأول (20 حصة) بتسجيل دخول جوجل، مقصور على قائمة طلبة محدّدة.

**المميزات:** تسجيل دخول بجوجل · قائمة مسموح لهم · تتبّع تقدّم كل طالب · وضع مدرس/طالب · بحث في المذكرة كلها · بنك أسئلة مفلتر · طباعة وتصدير PDF · متابعة الطلبة للمدرس · وضع ليلي تلقائي.

---

## كيف تعمل الحماية

| الطبقة | ماذا تمنع |
|---|---|
| **Firebase Authentication** | لا أحد يدخل بدون حساب جوجل بإيميل مُوثَّق |
| **مجموعة `allowlist`** | لا أحد يدخل إلا لو إيميله مضاف من المدرس |
| **Firestore Rules** | تُطبَّق **على الخادم** — لا يمكن الالتفاف عليها من المتصفح |
| **المحتوى خارج المستودع** | حتى لو الريبو `public`، المذكرة ليست فيه |

> ### ⚠️ القاعدة الذهبية
> ملف `seed/content-term1.json` هو **المذكرة كاملة**. لو رفعته على GitHub في ريبو عام، أي شخص يقدر يقرأه بدون تسجيل دخول وتصبح كل الحماية بلا معنى.
>
> الملف مُدرَج في `.gitignore` بالفعل — **لا تحذفه من هناك**. احتفظ بنسخة احتياطية منه على جهازك أو Google Drive.

---

## المتطلبات

- حساب جوجل
- [Node.js](https://nodejs.org) نسخة 18 أو أحدث (لسكربت الرفع مرة واحدة فقط)
- حساب GitHub

---

## خطوات الإعداد

### 1) إنشاء مشروع Firebase

1. افتح [console.firebase.google.com](https://console.firebase.google.com) واضغط **Add project**
2. سمّه مثلًا `mozakra-bac2` ← **Continue**
3. Google Analytics: اختر **Disable** (مش محتاجها) ← **Create project**

### 2) تفعيل الدخول بجوجل

1. من القائمة الجانبية: **Build ← Authentication ← Get started**
2. تبويب **Sign-in method** ← اختر **Google** ← فعّل **Enable**
3. اختر **Project support email** (إيميلك) ← **Save**

### 3) إنشاء قاعدة البيانات

1. **Build ← Firestore Database ← Create database**
2. اختر **Start in production mode** (مهم — لا تختر test mode)
3. اختر الموقع `eur3` أو `europe-west` (الأقرب لمصر) ← **Enable**

### 4) رفع قواعد الأمان

1. في Firestore ← تبويب **Rules**
2. امسح المحتوى كله والصق محتوى ملف [`firestore.rules`](firestore.rules) بالكامل
3. اضغط **Publish**

### 5) ربط الموقع بالمشروع

1. في Firebase: **⚙️ Project settings** ← انزل لـ **Your apps**
2. اضغط أيقونة الويب **`</>`** ← سمّه `mozakra-web` ← **Register app**
3. هتظهر لك قطعة كود فيها `firebaseConfig` — انسخ القيم
4. افتح [`js/firebase-config.js`](js/firebase-config.js) والصقها مكان القيم الافتراضية

```js
export const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "mozakra-bac2.firebaseapp.com",
  projectId:         "mozakra-bac2",
  storageBucket:     "mozakra-bac2.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abc123"
};
```

> القيم دي **ليست أسرارًا** — Firebase مصمّم على إنها تظهر في كود المتصفح. الحماية من `firestore.rules` مش من إخفائها.

### 6) مفتاح الخادم (لسكربت الرفع)

1. **⚙️ Project settings ← Service accounts**
2. **Generate new private key** ← **Generate key**
3. احفظ الملف باسم **`service-account.json`** داخل مجلد `seed/`

> 🔴 **الملف ده سرّ حقيقي.** هو في `.gitignore` — لا ترفعه على GitHub أبدًا.

### 7) قائمة الطلبة

انسخ `seed/students.sample.csv` وسمّه **`seed/students.csv`**، واملأه بإيميلات جوجل الحقيقية:

```csv
email,name,role,active
ahmed.ashry@gmail.com,أحمد عشري,teacher,yes
mohamed@gmail.com,محمد علي,student,yes
sara@gmail.com,سارة حسن,student,yes
```

| العمود | الوصف |
|---|---|
| `email` | **مطلوب.** إيميل جوجل بالظبط (Gmail أو Google Workspace) |
| `name` | الاسم كما يظهر في الموقع. لو فاضي، يُستخدم جزء الإيميل |
| `role` | `teacher` أو `student`. المدرس يرى التنبيهات الامتحانية وصفحة المتابعة |
| `active` | `yes` أو `no`. `no` = يمنع الدخول مؤقتًا دون حذف الحساب |

> ضع **نفسك** كـ `teacher`، وإلا لن يستطيع أحد رؤية صفحة متابعة الطلبة.

### 8) رفع المحتوى وقائمة الطلبة

```bash
cd seed
npm install
npm run seed -- --dry     # معاينة: يعرض ما سيحدث دون كتابة
npm run seed              # الرفع الفعلي
```

المفروض تشوف:

```
▸ المحتوى: 20 حصة
   ✓ تم رفع 20 حصة إلى sessions/
▸ قائمة المسموح لهم: 3 حساب (1 مدرس)
   ✓ تم رفع 3 حساب إلى allowlist/
✓ تمّ.
```

### 9) تجربة محلية

الموقع يستخدم ES Modules، فلازم يُفتح عبر خادم — **مش** بفتح `index.html` مباشرة.

```bash
cd ..           # ارجع لجذر المشروع
npx serve .     # أو:  python -m http.server 8000
```

افتح `http://localhost:3000` (أو `:8000`) وجرّب الدخول. `localhost` مسموح في Firebase افتراضيًا.

### 10) النشر على GitHub Pages

```bash
git init
git add .
git commit -m "مذكرة البرمجة والذكاء الاصطناعي — الترم الأول"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

قبل الـ push، **تأكد** أن هذين الملفين غير مُدرَجين:

```bash
git status --short          # لا يجب أن يظهر أيٌّ مما يلي:
#   seed/service-account.json
#   seed/content-term1.json
#   seed/students.csv
```

ثم في GitHub: **Settings ← Pages ← Source: Deploy from a branch ← main / (root) ← Save**

بعد دقيقتين الموقع يشتغل على `https://USERNAME.github.io/REPO/`

### 11) السماح للدومين ⚠️ لا تنسَ هذه

في Firebase: **Authentication ← Settings ← Authorized domains ← Add domain**

أضف: `USERNAME.github.io`

> بدون الخطوة دي هيظهر خطأ **`auth/unauthorized-domain`** ولن يعمل تسجيل الدخول.

---

## الاستخدام اليومي

### إضافة أو حذف طالب

عدّل `seed/students.csv` ثم:

```bash
cd seed && npm run seed -- --users
```

**لإيقاف طالب مؤقتًا:** غيّر `active` إلى `no` وأعد التشغيل — يُمنع من الدخول فورًا مع الاحتفاظ بتقدّمه.

**لحذف طالب نهائيًا:** احذف وثيقته من Firebase Console ← Firestore ← `allowlist`. (السكربت يضيف ويعدّل فقط، لا يحذف — حماية من الحذف بالغلط.)

### تعديل محتوى حصة

عدّل `seed/content-term1.json` ثم:

```bash
cd seed && npm run seed -- --content
```

الطلبة يشوفوا التعديل خلال 12 ساعة (مدة التخزين المؤقت)، أو فورًا لو عملوا **تسجيل خروج ودخول**.

### إضافة الترم الثاني

1. جهّز `seed/content-term2.json` بنفس بنية ملف الترم الأول، مع `"term": "term2"` و `"id": "term2-01"` … في كل حصة
2. في `seed/seed.js` غيّر `content-term1.json` إلى `content-term2.json`، وشغّل `npm run seed -- --content`
3. في `js/firebase-config.js` غيّر `TERM` إلى `"term2"`

---

## اختصارات الكيبورد

| المفتاح | الوظيفة |
|---|---|
| `/` | الانتقال لخانة البحث |
| `←` | الحصة التالية |
| `→` | الحصة السابقة |

---

## حل المشاكل

| الخطأ | السبب والحل |
|---|---|
| `auth/unauthorized-domain` | الدومين غير مضاف. **الخطوة 11** |
| `auth/popup-blocked` | المتصفح حجب النافذة — الموقع يتحوّل تلقائيًا لوضع التوجيه، اقبل إعادة التحميل |
| «حسابك غير مسجَّل» | الإيميل غير موجود في `allowlist`. راجع الإملاء في `students.csv` وأعد `npm run seed -- --users` |
| «المحتوى غير موجود» | لم تُشغّل سكربت الرفع. **الخطوة 8** |
| `Missing or insufficient permissions` | قواعد الأمان لم تُرفع. **الخطوة 4** |
| الصفحة بيضاء + خطأ CORS في Console | فتحت `index.html` مباشرة. لازم خادم — **الخطوة 9** |
| صفحة متابعة الطلبة لا تظهر | حسابك `role` ليس `teacher`. عدّل `students.csv` وأعد الرفع |
| تعديل المحتوى لا يظهر | التخزين المؤقت. سجّل خروج ودخول |

للاطلاع على الخطأ الحقيقي: افتح **F12 ← Console** في المتصفح.

---

## التكلفة

كل ده داخل **الحد المجاني** لـ Firebase (خطة Spark) بفارق كبير:

| المورد | الحد المجاني اليومي | استهلاك 40 طالب |
|---|---|---|
| قراءات Firestore | 50,000 | ~150 (بفضل التخزين المؤقت) |
| كتابات Firestore | 20,000 | ~200 |
| المصادقة | غير محدود | — |
| GitHub Pages | مجاني | — |

لن تحتاج بطاقة ائتمان.

---

## بنية المشروع

```
├── index.html                 صفحة الدخول + هيكل التطبيق
├── css/style.css              نظام التصميم كامل (فاتح/غامق/طباعة)
├── js/
│   ├── firebase-config.js     ← تعدّل هذا الملف
│   ├── auth.js                الدخول بجوجل + التحقق من الصلاحية
│   ├── store.js               جلب المحتوى + التخزين المؤقت + التقدّم
│   ├── render.js              بناء صفحات الحصص والبحث والبنك
│   └── app.js                 المتحكّم الرئيسي
├── seed/
│   ├── seed.js                سكربت الرفع
│   ├── package.json
│   ├── students.sample.csv    نموذج — انسخه إلى students.csv
│   ├── students.csv           🔒 محلي (gitignored)
│   ├── content-term1.json     🔒 محلي (gitignored) — المذكرة كاملة
│   └── service-account.json   🔒 محلي (gitignored) — سرّ
├── firestore.rules            قواعد الأمان
├── .gitignore
└── .nojekyll                  يمنع GitHub من معالجة الملفات
```

### بنية قاعدة البيانات

```
allowlist/{email}    { name, role, active }              قراءة: صاحبها فقط · كتابة: ممنوعة
sessions/{id}        { n, title, concepts, qs, ... }     قراءة: المسموح لهم · كتابة: ممنوعة
users/{uid}          { email, name, lastLogin, count }   قراءة/كتابة: صاحبها · قراءة: المدرس
progress/{uid}       { completed[], lastSession }        قراءة/كتابة: صاحبها · قراءة: المدرس
```

الكتابة في `allowlist` و `sessions` **ممنوعة تمامًا من المتصفح** — تتم فقط عبر `seed.js` بصلاحيات Admin.
