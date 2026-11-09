import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getDatabase,ref,get,set} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app=initializeApp({apiKey:"AIzaSyAR9wR9J8Qh1Git78zIT4pc6VVWIKemN40",authDomain:"blackp2p.firebaseapp.com",databaseURL:"https://blackp2p-default-rtdb.firebaseio.com",projectId:"blackp2p",storageBucket:"blackp2p.firebasestorage.app",messagingSenderId:"875717005059",appId:"1:875717005059:web:4e91211f751dddf7a2e336"});
const auth=getAuth(app),db=getDatabase(app);

document.getElementById('app').innerHTML = `
  <div style="text-align:center; padding: 50px; font-family: sans-serif;">
    <h1>اختبار قاعدة البيانات</h1>
    <button id="loginBtn" style="padding: 15px; font-size: 18px; background: #18181b; color: white; border-radius: 10px; width: 100%; max-width: 300px; border: none;">تسجيل الدخول بجوجل</button>
    <p id="status" style="margin-top: 20px; font-size: 16px; font-weight: bold; color: green;"></p>
  </div>
`;

document.getElementById('loginBtn').onclick = () => {
  signInWithPopup(auth, new GoogleAuthProvider()).catch(e => alert(e.message));
};

onAuthStateChanged(auth, async (u) => {
  const status = document.getElementById('status');
  if (u) {
    status.innerText = "جاري حفظ البيانات في قاعدة البيانات...";
    const r = ref(db, 'users/' + u.uid);
    const snap = await get(r);
    if (!snap.exists()) {
       try {
         await set(r, {
           name: u.displayName || 'مستخدم',
           email: u.email,
           balance: 0,
           createdAt: Date.now()
         });
         status.innerText = "✅ تم حفظ المستخدم بنجاح في قاعدة البيانات!";
       } catch(e) {
         status.innerText = "❌ خطأ في الحفظ: " + e.message;
       }
    } else {
       status.innerText = "✅ المستخدم موجود بالفعل في قاعدة البيانات!";
    }
  } else {
    status.innerText = "غير مسجل الدخول";
  }
});
