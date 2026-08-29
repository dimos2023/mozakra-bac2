// ============================================================
//  إعدادات Firebase
//  ------------------------------------------------------------
//  استبدل القيم دي بقيم مشروعك من:
//  Firebase Console ← Project settings ← Your apps ← Web app ← SDK setup
//
//  ملحوظة مهمة: القيم دي *ليست أسرارًا*. Firebase مصمّم على إنها تكون
//  ظاهرة في كود المتصفح. الحماية الحقيقية بتيجي من Firestore Rules
//  (ملف firestore.rules) ومن قائمة الـ Authorized domains، مش من إخفاء المفاتيح.
// ============================================================

export const firebaseConfig = {
  apiKey:            "AIzaSyAjQIIuSx9eGh9jpWJSw2vQjjPl5ePh3BY",
  authDomain:        "mozakra-bac2.firebaseapp.com",
  projectId:         "mozakra-bac2",
  storageBucket:     "mozakra-bac2.firebasestorage.app",
  messagingSenderId: "53399503976",
  appId:             "1:53399503976:web:fc858fa72cd373e5d0e7dd"
};

// الفصل الدراسي المعروض حاليًا. غيّرها لـ "term2" لما تجهّز الترم التاني.
export const TERM = "term1";
