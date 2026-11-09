import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut, reauthenticateWithPopup} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getDatabase,ref,get,set,update,push,onValue,runTransaction,remove,query,orderByChild,equalTo,limitToLast} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app=initializeApp({apiKey:"AIzaSyAR9wR9J8Qh1Git78zIT4pc6VVWIKemN40",authDomain:"blackp2p.firebaseapp.com",databaseURL:"https://blackp2p-default-rtdb.firebaseio.com",projectId:"blackp2p",storageBucket:"blackp2p.firebasestorage.app",messagingSenderId:"875717005059",appId:"1:875717005059:web:4e91211f751dddf7a2e336"});
const auth=getAuth(app),db=getDatabase(app),R=p=>ref(db,p);

const WORKER_URL = "https://late-haze-3fe4.freefierlight1.workers.dev";
const IMGBB_API_KEY = "53bcd76af848af724a74013f151c9743";

const $=id=>document.getElementById(id);
window.$ = $; 

const Security = {
  amount(v,min=1,max=100000000){const n=Math.round(Number(v));if(!Number.isFinite(n)||n<min||n>max)throw new Error(`المبلغ غير صالح`);return n},
  text(v,min=1,max=500){v=String(v||'').trim();if(v.length<min||v.length>max)throw new Error(`النص يجب أن يكون بين ${min} و ${max} حرفاً`);return v},
  file(f){if(!f||!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>8e6)throw new Error('الملف يجب أن يكون صورة JPG/PNG/WebP بحجم أقصى 8MB');return f},
  chat(t){if(/(whats|telegram|واتس|تيليجرام|تلجرام|\d{10,}|\S+@\S+\.\S+)/i.test(t))throw new Error('ممنوع مشاركة وسائل تواصل خارج المنصة');return t},
  hits:{},
  limit(k,max,ms){const n=Date.now(),a=(this.hits[k]||[]).filter(t=>n-t<ms);if(a.length>=max)throw new Error('تجاوزت الحد المسموح، حاول لاحقاً');a.push(n);this.hits[k]=a},
  esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  img: a => { if (!a) return []; let arr = typeof a === 'string' ? [a] : Object.values(a); return arr.filter(x => typeof x === 'string' && (x.startsWith('http') || /^data:image\/(jpeg|png|webp);base64,/.test(x))); }
};
const E=Security.esc;

const ok=t=>Swal.fire({icon:'success',title:t,timer:1400,showConfirmButton:false});
const bad=e=>e && e.message==='CANCEL' ? 0 : Swal.fire({icon:'error',title:'تعذر التنفيذ',text:e.message||String(e)});
const ask=t=>Swal.fire({icon:'question',title:t,showCancelButton:true,confirmButtonText:'نعم، متأكد',cancelButtonText:'إلغاء'}).then(r=>r.isConfirmed);

const form=(title,html,fn,btn='إرسال')=>Swal.fire({
  title,html,
  showCancelButton:true,
  confirmButtonText:btn,
  cancelButtonText:'إلغاء',
  preConfirm:async()=>{
    try{
      const cbtn = Swal.getConfirmButton();
      cbtn.disabled = true;
      cbtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';
      await fn();
      return true;
    }catch(e){
      const cbtn = Swal.getConfirmButton();
      cbtn.disabled = false;
      cbtn.innerHTML = btn;
      Swal.showValidationMessage(e.message);
      return false;
    }
  }
});

const inp=(id,ph,t='text')=>`<input id="${id}" type="${t}" placeholder="${ph}">`;

const compressToBlob = (f, text = 'BLACKP2P') => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => {
        const s = Math.min(1, 800 / Math.max(i.width, i.height));
        const c = document.createElement('canvas');
        c.width = i.width * s; c.height = i.height * s;
        const ctx = c.getContext('2d');
        ctx.drawImage(i, 0, 0, c.width, c.height);
        ctx.font = 'bold 20px Cairo, sans-serif';
        ctx.fillStyle = 'rgba(24, 24, 27, 0.2)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, c.width / 2, c.height / 2);
        c.toBlob((blob) => res(blob), 'image/jpeg', 0.7); 
    };
    i.onerror = () => rej(new Error('تعذر قراءة الصورة'));
    i.src = URL.createObjectURL(f);
});

const img = async f => {
    const file = Security.file(f);
    const blob = await compressToBlob(file);
    const formData = new FormData();
    formData.append('image', blob, 'image.jpg');
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) return data.data.url;
    throw new Error('فشل رفع الصورة، حاول مرة أخرى.');
};

const ago=t=>{const m=(Date.now()-t)/6e4;return m<1?'الآن':m<60?`${m|0}د`:m<1440?`${m/60|0}س`:`${m/1440|0}ي`};
const timeOnly=t=>new Date(t).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
const notify=(uid,title,body,type='info',extra={})=>{if(uid)set(push(R('notifications/'+uid)),{title,body,type,popup:false,read:false,createdAt:Date.now(),...extra})};
const initials=n=>{n=String(n||'?').trim();const a=n.split(' ');return (a[0]?.[0]||'?')+(a[1]?.[0]||'')};

let me=null,isAdmin=false,S={},P={},N={},T={},view='feed',VS='',OT='run',OD=[],MP=[],U=[],GU=[],shown=new Set(),F={q:'',game:'',sort:'new'};
let maintenanceActive=false, settingsLoaded=false, userLoaded=false, initialized=false;

const clearU = () => { U.forEach(f => f()); U = []; };
const clearGU = () => { GU.forEach(f => f()); GU = []; };

document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

function showMaintenanceScreen(){
    $('nav').classList.add('hidden');
    $('app').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;padding:20px;text-align:center">
      <div style="width:80px;height:80px;border-radius:22px;background:var(--warn-bg);border:2px solid var(--warn-bd);display:flex;align-items:center;justify-content:center;color:var(--warn-tx);font-size:36px;margin-bottom:20px"><i class="fa-solid fa-screwdriver-wrench"></i></div>
      <h1 style="font-size:20px;font-weight:900;color:var(--text);margin-bottom:8px">الموقع تحت الصيانة</h1>
      <p style="font-size:13px;color:var(--text-3);font-weight:700;margin-bottom:20px;max-width:340px">${E(S.maintenanceMessage || 'نعمل حالياً على تحسين الخدمة. سنعود قريباً.')}</p>
      ${me ? `<button class="btn btn-primary" onclick="logout()" style="padding:11px 24px">تسجيل الخروج</button>` : `<button class="btn btn-outline" onclick="signIn()" style="padding:11px 24px;font-size:11px"><i class="fa-solid fa-user-shield"></i> دخول المشرفين</button>`}
    </div>`;
}

function showSignInScreen(){
    $('nav').classList.add('hidden');
    $('app').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;padding:20px;text-align:center">
      <div style="width:80px;height:80px;border-radius:22px;background:#18181b;color:#fff;font-size:32px;display:flex;align-items:center;justify-content:center;margin-bottom:20px"><i class="fa-solid fa-shield-halved"></i></div>
      <h1 style="font-size:22px;font-weight:900;color:var(--text);margin-bottom:6px">سوق الحسابات الآمن</h1>
      <p style="font-size:12px;color:var(--text-3);font-weight:700;margin-bottom:24px;max-width:300px;line-height:1.6">الدفع محجوز لدى المنصة حتى تستلم حسابك وتتأكد منه 100%</p>
      <button class="btn btn-primary" onclick="signIn()" style="width:100%;max-width:320px;padding:14px;font-size:14px"><i class="fa-brands fa-google"></i> الدخول بحساب Google</button>
    </div>`;
}

window.go = v => {
    if (maintenanceActive) { showMaintenanceScreen(); return; }
    clearU(); view = v;
    document.querySelectorAll('.nav-item').forEach(b => { b.classList.toggle('active', b.dataset.tab === v); });
    ({feed, add, chats, notes, wallet, me: profile, orders, chat: null}[v]||feed)();
};

window.signIn = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(bad);
window.logout = () => signOut(auth);

onAuthStateChanged(auth, async u => {
  clearU(); clearGU();
  settingsLoaded = false; userLoaded = false; initialized = false;
  
  const settingsSnap = await get(R('settings'));
  S = settingsSnap.val() || {};
  
  if (u) {
    isAdmin = (await get(R('admins/' + u.uid))).exists();
  }
  
  maintenanceActive = !!S.maintenanceMode;
  if (maintenanceActive) {
    showMaintenanceScreen();
    return;
  }
  
  if (!u) {
    me = null; isAdmin = false;
    $('nav').classList.add('hidden');
    $('bal').textContent = '0 ج';
    $('nb').classList.add('hidden');
    showSignInScreen();
    return;
  }
  
  try {
    const r = R('users/' + u.uid);
    const snap = await get(r);
    if (!snap.exists()) {
      await set(r, {name: u.displayName || 'مستخدم', email: u.email, photo: u.photoURL || '', balance: 0, verified: false, role: 'user', suspended: false, deviceInfo: navigator.userAgent.slice(0,120), createdAt: Date.now(), lastSeen: Date.now()});
    } else {
      update(r, {lastSeen: Date.now(), deviceInfo: navigator.userAgent.slice(0,120)});
    }
    
    GU.push(onValue(R('settings'), s => {
      S = s.val() || {}; settingsLoaded = true;
      $('ttl').textContent = S.siteName || 'BLACKP2P';
      const t = $('tick');
      if (S.tickerText) { t.textContent = S.tickerText; t.classList.remove('hidden'); } else { t.classList.add('hidden'); }
      const wasMaintenance = maintenanceActive;
      maintenanceActive = !!S.maintenanceMode;
      if (maintenanceActive && !wasMaintenance) { showMaintenanceScreen(); }
      if (!maintenanceActive && wasMaintenance && me) { $('nav').classList.remove('hidden'); go('feed'); }
    }));
    
    GU.push(onValue(r, s => {
      me = {uid: u.uid, ...s.val()}; userLoaded = true;
      $('bal').textContent = me.balance + ' ج';
      
      if (me.suspended) {
        if (me.banUntil && Date.now() > me.banUntil) {
          update(R('users/' + u.uid), {suspended: false, banReason: null, banUntil: null});
        } else {
          $('nav').classList.add('hidden');
          $('app').innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;padding:20px;text-align:center">
            <div style="width:80px;height:80px;border-radius:22px;background:var(--danger-bg);border:2px solid var(--danger-bd);display:flex;align-items:center;justify-content:center;color:var(--danger-tx);font-size:36px;margin-bottom:20px"><i class="fa-solid fa-ban"></i></div>
            <h2 style="font-size:18px;font-weight:900;color:var(--text);margin-bottom:8px">تم تعليق حسابك</h2>
            <div style="background:var(--danger-bg);border:1px solid var(--danger-bd);border-radius:10px;padding:12px;margin-bottom:16px;max-width:340px">
              <p style="font-size:11px;font-weight:800;color:var(--danger-tx);margin-bottom:4px">السبب:</p>
              <p style="font-size:12px;font-weight:700;color:var(--danger-tx)">${E(me.banReason || 'غير محدد')}</p>
            </div>
            <button class="btn btn-primary" onclick="logout()">تسجيل الخروج</button>
          </div>`;
          return;
        }
      }
      if (maintenanceActive) { showMaintenanceScreen(); return; }
      if (!initialized && settingsLoaded) { initialized = true; $('nav').classList.remove('hidden'); if (view === 'feed' || !view) go('feed'); }
      else if (view === 'wallet' || view === 'me') { go(view); }
    }));
    
    GU.push(onValue(R('posts'), s => {
      const allPosts = s.val() || {};
      P = Object.fromEntries(Object.entries(allPosts).filter(([id, p]) => p && p.status === 'active'));
      if (view === 'feed' && $('list')) renderFeed();
    }));
    
    GU.push(onValue(R('notifications/' + u.uid), s => {
      N = s.val() || {};
      const c = Object.values(N).filter(n => !n.read).length;
      $('nb').textContent = c; $('nb').classList.toggle('hidden', !c);
      Object.entries(N).forEach(([id, n]) => {
        if (n.popup && !n.read && !n.fields && !shown.has(id)) {
          shown.add(id);
          Swal.fire({ title: E(n.title), text: n.body, confirmButtonText: 'حسناً', icon: 'info' }).then(() => set(R(`notifications/${u.uid}/${id}/read`), true));
        }
      });
      if (view === 'notes') notes();
    }));
    
    GU.push(onValue(R('user_verifications/' + u.uid), s => { 
        VS = (s.val() || {}).status || ''; 
        if (view === 'me') profile(); 
    }));
    
  } catch(e) { bad(e); }
});

const trust = p => { const age = Math.min(30, (Date.now() - (p.sellerSince || Date.now())) / 864e5 / 10); return Math.round((p.sellerVerified ? 40 : 0) + age + (T[p.sellerId] || 0) / 5 * 30); };
async function loadT(ids) {
  let n = 0;
  for (const s of ids) if (!(s in T)) { T[s] = 0; n++; const x = await get(R('ratings/' + s)); const v = Object.values(x.val() || {}).map(o => o.rating); T[s] = v.length ? v.reduce((a,b) => a+b) / v.length : 0; }
  if (n && view === 'feed') renderFeed();
}

function feed() {
  const games = S.games && S.games.length > 0 ? S.games : ['فري فاير','ببجي موبايل','كلاش أوف كلانس','فورتنايت','روبلوكس'];
  const sortOpts = [['new','الأحدث'],['lo','الأرخص'],['hi','الأغلى']];
  
  $('app').innerHTML = `
  <div style="position:relative;margin-bottom:10px">
    <i class="fa-solid fa-search" style="position:absolute;right:13px;top:50%;transform:translateY(-50%);color:var(--text-4);font-size:13px;pointer-events:none"></i>
    <input id="q" placeholder="ابحث عن لعبة أو وصف..." value="${E(F.q)}" style="margin:0;padding-right:38px">
  </div>
  <div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:10px;padding-bottom:4px" class="hide-scroll">
    <button class="chip ${!F.game?'active':''}" data-game="">الكل</button>
    ${games.map(g => `<button class="chip ${F.game===g?'active':''}" data-game="${E(g)}">${E(g)}</button>`).join('')}
  </div>
  <div style="display:flex;gap:5px;overflow-x:auto;margin-bottom:12px;padding-bottom:4px" class="hide-scroll">
    ${sortOpts.map(([k,l]) => `<button class="chip ${F.sort===k?'active':''}" data-sort="${k}" style="padding:5px 12px;font-size:11px"><i class="fa-solid ${k==='new'?'fa-clock':k==='lo'?'fa-arrow-down-wide-short':'fa-arrow-up-wide-short'}" style="font-size:9px"></i>${l}</button>`).join('')}
  </div>
  <div id="list" class="posts-grid"></div>`;
  
  $('q').oninput = e => { F.q = e.target.value; renderFeed(); };
  document.querySelectorAll('[data-game]').forEach(b => b.onclick = () => { F.game = b.dataset.game; document.querySelectorAll('[data-game]').forEach(x => x.classList.toggle('active', x.dataset.game === F.game)); renderFeed(); });
  document.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { F.sort = b.dataset.sort; document.querySelectorAll('[data-sort]').forEach(x => x.classList.toggle('active', x.dataset.sort === F.sort)); renderFeed(); });
  renderFeed();
}

function renderFeed() {
  let a = Object.entries(P).map(([id,p]) => ({id, ...p})).filter(p => p.status === 'active');
  const q = F.q.toLowerCase();
  a = a.filter(p => (!q || [p.game,p.desc,p.server].join(' ').toLowerCase().includes(q)) && (!F.game || (p.game||'').toLowerCase() === F.game.toLowerCase()));
  a.sort((x,y) => F.sort === 'lo' ? x.price - y.price : F.sort === 'hi' ? y.price - x.price : (y.featured?1:0) - (y.featured?1:0) || y.createdAt - x.createdAt);
  
  if (a.length === 0) { $('list').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-4);"><i class="fa-regular fa-face-frown" style="font-size: 32px; margin-bottom: 8px;"></i><p>لا توجد إعلانات مطابقة</p></div>`; return; }
  
  $('list').innerHTML = a.map(p => {
    const photos = Security.img(p.photos); const tr = trust(p); const trc = tr > 70 ? 'trust-high' : tr > 40 ? 'trust-mid' : 'trust-low';
    return `<div class="post-card" onclick="openPost('${p.id}')">
      <div class="post-img-wrap">
        ${photos[0] ? `<img src="${photos[0]}" class="post-card-image" loading="lazy" alt="">` : `<div class="post-card-image-placeholder"><i class="fa-regular fa-image"></i></div>`}
        <div class="post-price-badge">${p.price} ج</div>
        ${p.featured ? '<div class="post-featured-badge"><i class="fa-solid fa-star"></i> مميز</div>' : ''}
      </div>
      <div class="post-body">
        <div>
          <div style="font-size:13px;font-weight:900;color:var(--text);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(p.game)}</div>
          <div style="display:flex;align-items:center;gap:4px;font-size:9.5px;color:var(--text-3);margin-bottom:8px">
            <span class="badge badge-neutral" style="padding:1px 5px">${E(p.server)}</span>
            <span>•</span>
            <span>${ago(p.createdAt)}</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:5px;min-width:0">
            <div class="avatar-initial">${E(initials(p.sellerName))}</div>
            <span style="font-size:10.5px;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(p.sellerName)}</span>
          </div>
          <span class="trust-meter ${trc}"><span style="width:5px;height:5px;border-radius:50%;background:currentColor"></span>${tr}%</span>
        </div>
      </div>
    </div>`;
  }).join('');
  loadT([...new Set(a.map(p => p.sellerId))]);
}

window.toggleFav = async postId => { if (!me) return signIn(); try { const r = R(`favorites/${me.uid}/${postId}`); const snap = await get(r); if (snap.exists()) { await remove(r); ok('أزيلت من المفضلة'); } else { await set(r, true); ok('أضيفت للمفضلة'); } } catch(e) { bad(e); } };

window.openPost = async id => {
  try {
    clearU(); view = 'post'; const p = (await get(R('posts/' + id))).val(); if (!p) return go('feed');
    const liked = (await get(R(`likes/${id}/${me.uid}`))).exists(); const rs = Object.values((await get(R('ratings/' + p.sellerId))).val() || {}).map(o => o.rating); const avg = rs.length ? rs.reduce((a,b) => a+b) / rs.length : 0; T[p.sellerId] = avg;
    const ph = Security.img(p.photos); const mine = p.sellerId === me.uid; const mainImg = ph.length > 0 ? ph[0] : null; const tr = trust(p); const trc = tr > 70 ? 'trust-high' : tr > 40 ? 'trust-mid' : 'trust-low';
    
    // تصميم السلايدر الجديد
    const sliderHtml = ph.length > 0 ? `
        <div style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;gap:8px;padding-bottom:8px;margin:0 -12px;padding-left:12px;padding-right:12px;">
            ${ph.map(img => `<img src="${img}" style="flex:0 0 100%;scroll-snap-align:center;object-fit:contain;max-height:400px;border-radius:12px;background:var(--surface-2);cursor:pointer;" onclick="zoom('${img}')">`).join('')}
        </div>
    ` : `<div style="aspect-ratio:16/10;background:var(--surface-2);display:flex;align-items:center;justify-content:center;color:var(--text-4);font-size:32px;border-radius:12px"><i class="fa-regular fa-image"></i></div>`;

    $('app').innerHTML = `
    <button class="btn btn-ghost" onclick="go('feed')" style="margin-bottom:10px;padding:7px 12px;font-size:11px"><i class="fa-solid fa-arrow-right"></i> العودة</button>
    
    <div class="card" style="padding:14px;overflow:hidden;padding-bottom:80px;"> <!-- مساحة لزر الشراء السفلي -->
      
      ${sliderHtml}

      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-top:14px;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <b style="font-size:20px;font-weight:900;color:var(--text);display:block;margin-bottom:6px">${E(p.game)}</b>
          <span class="badge badge-neutral">${E(p.server)}</span>
        </div>
        <div style="text-align:left;flex-shrink:0">
          <b style="font-size:24px;font-weight:900;color:var(--success-tx);display:block">${p.price} <span style="font-size:12px;font-weight:700">ج</span></b>
          <button id="lk" style="margin-top:6px;padding:4px 12px;border-radius:20px;background:var(--surface-2);border:1px solid var(--border);font-size:12px;font-weight:800;color:var(--text-3)" onclick="like('${id}')"></button>
        </div>
      </div>
      
      <div style="padding-top:12px;border-top:1px solid var(--border);margin-bottom:14px">
        <b style="font-size:13px;font-weight:900;color:var(--text);display:block;margin-bottom:6px">الوصف</b>
        <p style="font-size:13px;color:var(--text-2);font-weight:600;line-height:1.7;white-space:pre-line">${E(p.desc)}</p>
      </div>
      
      <div class="info-grid" style="margin-bottom:14px">
        <div class="info-cell"><span class="info-label">نوع الربط</span><span class="info-value" style="font-size:12px">${E(p.linkType)}</span></div>
        <div class="info-cell"><span class="info-label">السيرفر</span><span class="info-value" style="font-size:12px">${E(p.server)}</span></div>
      </div>

      <!-- معلومات البائع وتقييمه -->
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <b style="font-size:12px;font-weight:900;color:var(--text)">معلومات البائع</b>
            <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px;min-height:28px;border-color:var(--warn-bd);color:var(--warn-tx);background:var(--warn-bg)" onclick="rate('${p.sellerId}')">
                <i class="fa-solid fa-star"></i> تقييم البائع
            </button>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
            <div class="avatar-initial" style="width:44px;height:44px;font-size:16px">${E(initials(p.sellerName))}</div>
            <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:4px;margin-bottom:2px">
                    <b style="font-size:14px;font-weight:900;color:var(--text)">${E(p.sellerName)}</b>
                    ${p.sellerVerified ? '<i class="fa-solid fa-circle-check" style="color:var(--success-solid);font-size:12px"></i>' : ''}
                </div>
                <span style="font-size:10px;color:var(--text-3);font-weight:700">عضو منذ ${new Date(p.sellerSince||Date.now()).toLocaleDateString('ar-EG')}</span>
            </div>
            <div style="text-align:center">
                <span class="trust-meter ${trc}" style="margin-bottom:4px"><span style="width:5px;height:5px;border-radius:50%;background:currentColor"></span>${tr}% ثقة</span>
                <span class="info-value" style="color:var(--warn-tx);font-size:12px;display:block">${avg ? '⭐ ' + avg.toFixed(1) : 'لا يوجد تقييم'}</span>
            </div>
        </div>
      </div>
    </div>

    <!-- زر الشراء الثابت في الأسفل -->
    ${p.status === 'active' && !mine ? `
    <div style="position:fixed;bottom:60px;left:0;right:0;padding:10px 15px;background:var(--glass-strong);backdrop-filter:blur(10px);border-top:1px solid var(--border);z-index:40;max-width:640px;margin:0 auto;">
        <button class="btn btn-primary" style="width:100%;padding:14px;font-size:15px;border-radius:12px;box-shadow:var(--shadow-lg);" onclick="buy('${id}')">
            <i class="fa-solid fa-shield-halved"></i> شراء بضمان المنصة (${p.price} ج)
        </button>
    </div>` : `<p style="text-align:center;font-size:12px;font-weight:800;color:var(--text-4);padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-top:4px">${mine ? 'أنت صاحب هذا الإعلان' : 'الإعلان غير متاح'}</p>`}`;
    
    window._lk = {liked, n: p.likeCount || 0}; paintLike(liked, p.likeCount || 0);
  } catch(e) { bad(e); }
};

const paintLike = (l, n) => { $('lk').innerHTML = `<i class="fa-${l ? 'solid text-red' : 'regular'} fa-heart" style="${l ? 'color:#dc2626' : ''}"></i> ${n}`; };
window.like = async id => { try { Security.limit('like', 20, 6e4); const {liked:l} = window._lk, r = R(`likes/${id}/${me.uid}`); const c = await runTransaction(R(`posts/${id}/likeCount`), v => v === null ? 0 : l ? (v > 0 ? v - 1 : undefined) : (v || 0) + 1); if (!c.committed) return; await (l ? remove(r) : set(r, true)); const n = c.snapshot.val(); window._lk = {liked: !l, n}; paintLike(!l, n); } catch(e) { bad(e); } };
window.zoom = u => Swal.fire({imageUrl: u, imageWidth: '100%', showConfirmButton: false, showCloseButton: true, background: '#0a0a0a'});

window.buy = async function(id) {
  try {
    Security.limit('buy', 3, 6e4);
    if (!await ask('هل أنت متأكد من الشراء؟ سيتم حجز المبلغ حتى تؤكد الاستلام.')) return;
    Swal.fire({title:'جاري تنفيذ الشراء بأمان...', didOpen:()=>Swal.showLoading(), showConfirmButton:false});
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(WORKER_URL + "/buy", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ postId: id })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'فشل الاتصال بالخادم');
    Swal.close(); ok('تم الشراء بنجاح'); openChat(result.chatId);
  } catch(e) { Swal.close(); bad(e); }
};

window.add = function() {
  if (!me.verified) {
    $('app').innerHTML = `<div class="card" style="padding:24px;text-align:center;margin-top:20px"><div style="width:80px;height:80px;border-radius:22px;background:var(--warn-bg);border:2px solid var(--warn-bd);display:flex;align-items:center;justify-content:center;color:var(--warn-tx);font-size:32px;margin:0 auto 16px"><i class="fa-solid fa-shield-halved"></i></div>${VS === 'pending' ? `<p style="font-size:14px;font-weight:900;color:var(--warn-tx);margin-bottom:6px">طلب التوثيق قيد المراجعة</p><p style="font-size:11px;color:var(--text-3);font-weight:700">سيتفعّل النشر فور القبول.</p>` : `<p style="font-size:13px;color:var(--text-2);font-weight:700;margin-bottom:16px">يجب توثيق حسابك قبل نشر إعلان.</p><button class="btn btn-primary" style="width:100%;padding:14px;font-size:13px" onclick="go('me')">توثيق الحساب الآن</button>`}</div>`;
    return;
  }
  const gamesList = S.games && S.games.length > 0 ? S.games : ['فري فاير','ببجي موبايل','كلاش أوف كلانس','فورتنايت','روبلوكس'];
  const serversList = S.servers && S.servers.length > 0 ? S.servers : ['MENA','Europe','Asia','Global','North America'];
  const linkTypes = ['Google','Facebook','Apple','Email'];
  $('app').innerHTML = `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><div style="width:38px;height:38px;border-radius:10px;background:#18181b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px"><i class="fa-solid fa-plus"></i></div><h2 style="font-size:18px;font-weight:900;color:var(--text)">إعلان جديد</h2></div>
  <div class="card">
    <label style="font-size:11px;font-weight:800;color:var(--text-3);display:block;margin-bottom:5px">اسم اللعبة</label><select id="a_g" style="margin-bottom:12px">${gamesList.map(g => `<option value="${E(g)}">${E(g)}</option>`).join('')}</select>
    <label style="font-size:11px;font-weight:800;color:var(--text-3);display:block;margin-bottom:5px">السيرفر</label><select id="a_s" style="margin-bottom:12px">${serversList.map(s => `<option value="${E(s)}">${E(s)}</option>`).join('')}</select>
    <label style="font-size:11px;font-weight:800;color:var(--text-3);display:block;margin-bottom:5px">وصف الحساب</label><textarea id="a_d" placeholder="اكتب تفاصيل الحساب..." rows="4" style="margin-bottom:12px"></textarea>
    <label style="font-size:11px;font-weight:800;color:var(--text-3);display:block;margin-bottom:5px">السعر (ج)</label><input id="a_p" type="number" placeholder="مثال: 500" style="margin-bottom:12px">
    <label style="font-size:11px;font-weight:800;color:var(--text-3);display:block;margin-bottom:5px">نوع الربط</label><select id="a_l" style="margin-bottom:12px" onchange="updateLinkInput()">${linkTypes.map(l => `<option value="${l}">${l}</option>`).join('')}</select>
    
    <label style="font-size:11px;font-weight:800;color:var(--text-3);display:block;margin-bottom:5px">صور الحساب (حتى 10 صور)</label>
    <div style="position:relative;border:2px dashed var(--border-2);background:var(--surface-2);border-radius:12px;padding:20px;text-align:center;cursor:pointer;margin-bottom:12px"><input id="a_f" type="file" accept="image/*" multiple style="position:absolute;inset:0;opacity:0;cursor:pointer"><i class="fa-solid fa-cloud-arrow-up" style="font-size:26px;color:var(--text-3);margin-bottom:6px;display:block"></i><span style="font-size:12px;font-weight:800;color:var(--text-2);display:block">اضغط لاختيار الصور</span><span id="file-count" style="font-size:10.5px;color:var(--text-3);font-weight:700;margin-top:4px;display:block"></span></div>
    <div style="background:var(--warn-bg);border:1px solid var(--warn-bd);border-radius:10px;padding:11px;margin-bottom:14px"><p style="font-size:11px;color:var(--warn-tx);font-weight:900;margin-bottom:8px"><i class="fa-solid fa-lock"></i> بيانات الدخول (مشفرة)</p><input id="a_e" type="text" placeholder="إيميل / اسم الحساب" style="background:var(--surface);border-color:var(--warn-bd);margin-bottom:6px;font-size:12px"><input id="a_w" type="password" placeholder="كلمة المرور" style="background:var(--surface);border-color:var(--warn-bd);margin:0;font-size:12px"></div>
    <button class="btn btn-primary" style="width:100%;padding:14px;font-size:13px" id="a_b">نشر للمراجعة</button>
  </div>`;
  window.updateLinkInput = () => { const type = $('a_l').value; const input = $('a_e'); if (type === 'Facebook') { input.type = 'tel'; input.placeholder = 'رقم الهاتف'; } else if (type === 'Google' || type === 'Apple' || type === 'Email') { input.type = 'email'; input.placeholder = 'البريد الإلكتروني'; } else { input.type = 'text'; input.placeholder = 'اسم الحساب'; } };
  updateLinkInput();
  
  $('a_f').onchange = e => { 
      const len = e.target.files.length;
      if(len > 10) { bad(new Error('الحد الأقصى 10 صور')); e.target.value=''; $('file-count').textContent = ''; return; }
      $('file-count').textContent = `تم اختيار ${len} صور`; 
  };
  
  $('a_b').onclick = async () => {
    try {
      Security.limit('post', 5, 36e5);
      const g = Security.text($('a_g').value, 2, 40), sv = Security.text($('a_s').value, 1, 40), d = Security.text($('a_d').value, 10, 800), pr = Security.amount($('a_p').value, 1, 100000000), em = Security.text($('a_e').value, 3, 120), pw = Security.text($('a_w').value, 3, 120);
      const fs = [...$('a_f').files]; 
      if (fs.length === 0) throw new Error('ارفع صور الحساب');
      if (fs.length > 10) throw new Error('الحد الأقصى 10 صور');
      
      $('a_b').disabled = true; $('a_b').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري معالجة ورفع الصور...';
      Swal.fire({title:'جاري رفع الصور للسيرفر...', didOpen:()=>Swal.showLoading(), showConfirmButton:false}); 
      
      const photos = []; 
      for (const f of fs) {
          photos.push(await img(f));
      }
      
      const TEMP_KEY = "A7x!9pQ2$mW5vB8@kL1zR4tY6nC3hJ0sX9fG2dE5w";
      const encryptAES = async (text, secret) => {
          const enc = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(text));
          const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
          combined.set(salt, 0);
          combined.set(iv, salt.length);
          combined.set(new Uint8Array(encrypted), salt.length + iv.length);
          return btoa(String.fromCharCode.apply(null, combined));
      };
      const encryptedEmail = await encryptAES(em, TEMP_KEY);
      const encryptedPass = await encryptAES(pw, TEMP_KEY);

      const id = push(R('posts')).key; await set(R('posts/' + id), { sellerId: me.uid, sellerName: me.name, sellerVerified: me.verified, sellerSince: me.createdAt, game: g, server: sv, desc: d, price: pr, linkType: $('a_l').value, photos, likeCount: 0, status: 'pending', createdAt: Date.now(), featured: false });
      await set(R('post_private/' + id), {email: encryptedEmail, password: encryptedPass});
      Swal.close(); ok('تم الإرسال للمراجعة'); go('feed');
    } catch(e) { Swal.close(); bad(e); $('a_b').disabled = false; $('a_b').innerHTML = 'نشر للمراجعة'; }
  };
};

async function chats() {
  $('app').innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px"><button class="btn btn-primary" onclick="supportChat()" style="padding:12px"><i class="fa-solid fa-headset"></i> الدعم الفني</button><button class="btn btn-ghost" onclick="go('orders')" style="padding:12px"><i class="fa-solid fa-receipt"></i> طلباتي</button></div><div id="cl" style="display:grid;gap:8px"></div>`;
  U.push(onValue(R('user_chats/' + me.uid), async s => {
    const ids = Object.keys(s.val() || {});
    const cs = (await Promise.all(ids.map(async i => { try { const c = (await get(R('chats/' + i))).val(); if (!c) return null; if (i.startsWith('support_') && c.status === 'closed') return null; return [i, c]; } catch { return null; } }))).filter(x => x && x[1]).sort((a,b) => b[1].updatedAt - a[1].updatedAt);
    if ($('cl')) {
      if (cs.length === 0) { $('cl').innerHTML = `<div class="empty-state"><i class="fa-regular fa-comments"></i><p>لا توجد محادثات</p></div>`; } 
      else {
        $('cl').innerHTML = cs.map(([i,c]) => `<div class="card card-hover" style="cursor:pointer;padding:12px" onclick="openChat('${i}')"><div style="display:flex;align-items:center;gap:8px"><div class="avatar-initial" style="width:36px;height:36px;font-size:13px">${E(initials(c.buyerId === me.uid ? c.sellerName : c.buyerName))}</div><div style="flex:1;min-width:0"><b style="font-size:12.5px;font-weight:900;color:var(--text);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(c.buyerId === me.uid ? c.sellerName : c.buyerName)}</b><p style="font-size:10.5px;color:var(--text-3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(c.lastMessage || '—')}</p></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">${c.dealStatus ? `<span class="badge badge-info">${E(c.dealStatus)}</span>` : ''}<i class="fa-solid fa-chevron-left" style="color:var(--text-4);font-size:10px"></i></div></div></div>`).join('');
      }
    }
  }));
}

window.supportChat = async () => {
  try {
    Swal.fire({title:'جاري التحميل...', didOpen:()=>Swal.showLoading(), showConfirmButton:false});
    const myChats = (await get(R('user_chats/' + me.uid))).val() || {};
    const ids = Object.keys(myChats).filter(id => id.startsWith('support_' + me.uid));
    let activeCid = null;
    for (let id of ids) { 
        const c = (await get(R('chats/' + id))).val(); 
        if (c && c.status !== 'closed') { activeCid = id; break; } 
    }
    
    if (activeCid) { 
        Swal.close(); openChat(activeCid); 
    } else {
        if (me.suspended) {
            Swal.close(); 
            return bad(new Error('حسابك محظور حالياً. لا يمكنك فتح تذاكر دعم جديدة.'));
        }
        const cid = `support_${me.uid}_${Date.now()}`;
        await set(R('chats/' + cid), { buyerId: me.uid, sellerId: 'admin_support', buyerName: me.name, sellerName: 'الدعم الفني', lastMessage: 'تذكرة جديدة', dealStatus: '', status: 'open', updatedAt: Date.now(), adminRead: false });
        await set(R(`user_chats/${me.uid}/${cid}`), true);
        
        if(S.autoReplyText) {
           await set(push(R(`chats/${cid}/messages`)), { senderId: 'admin_support', type: 'admin', text: S.autoReplyText, createdAt: Date.now() });
        }
        
        Swal.close(); openChat(cid);
    }
  } catch(e) { Swal.close(); bad(e); }
};

async function send(cid, text, image) {
  Security.limit('msg', 20, 6e4);
  const m = {senderId: me.uid, type: image ? 'image' : 'text', createdAt: Date.now(), read: false};
  if (image) m.imageUrl = image; else m.text = Security.chat(Security.text(text, 1, 1000));
  await set(push(R(`chats/${cid}/messages`)), m);
  await update(R('chats/' + cid), {lastMessage: image ? '📷 صورة' : m.text.slice(0, 60), updatedAt: Date.now(), adminRead: false});
}

window.openChat = cid => {
  clearU(); view = 'chat'; let c = null, d = null, last = 0;
  $('app').innerHTML = `
  <div class="chat-shell">
    <div class="chat-header">
      <button class="icon-btn" onclick="go('chats')" style="width:30px;height:30px"><i class="fa-solid fa-arrow-right" style="font-size:11px"></i></button>
      <div id="chat-avatar" class="chat-avatar">?</div>
      <div class="chat-info"><div id="ch" class="chat-name">—</div><div id="chat-status" class="chat-status"><span class="status-dot"></span><span>—</span></div></div>
    </div>
    <div id="dp"></div>
    <div id="ms" class="chat-messages"></div>
    <p id="ty" style="font-size:10px;font-weight:800;color:var(--info-tx);height:16px;padding:0 12px;margin-top:4px"></p>
    <div class="chat-input-bar">
      <input type="file" id="mf" accept="image/*" style="display:none">
      <button class="icon-btn" onclick="document.getElementById('mf').click()"><i class="fa-solid fa-image"></i></button>
      <input id="mi" placeholder="اكتب رسالة...">
      <button class="btn btn-primary" id="mb" style="padding:8px 12px;min-height:38px"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  </div>`;
  
  const doSend = async (t, i) => { try { await send(cid, t, i); if (!i) $('mi').value = ''; } catch(e) { bad(e); } };
  $('mb').onclick = () => doSend($('mi').value);
  $('mi').onkeydown = e => e.key === 'Enter' && doSend($('mi').value);
  
  $('mf').onchange = async e => { 
      try { 
          if (e.target.files[0]) {
              Swal.fire({title:'جاري رفع الصورة...', didOpen:()=>Swal.showLoading(), showConfirmButton:false});
              const url = await img(e.target.files[0]); 
              await doSend('', url); 
              Swal.close();
          } 
      } catch(x) { Swal.close(); bad(x); } 
  };
  
  $('mi').oninput = () => { if (Date.now() - last > 2500) { last = Date.now(); set(R(`chats/${cid}/typing/${me.uid}`), last).catch(()=>{}); } };
  
  const renderMsg = m => {
    if (m.type === 'image' && (m.imageUrl.startsWith('http') || /^data:image\//.test(m.imageUrl))) { return `<img src="${m.imageUrl}" style="border-radius:8px;max-height:200px;max-width:100%;object-fit:contain;cursor:pointer;display:block" onclick="zoom(this.src)">`; }
    else if (m.type === 'transaction') { return `<div style="width:100%;display:flex;justify-content:center;margin:6px 0"><div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px 12px;font-size:11px;text-align:right;max-width:260px" dir="rtl"><div style="font-weight:900;color:var(--success-tx);margin-bottom:5px;display:flex;justify-content:space-between;gap:8px"><span><i class="fa-solid fa-receipt"></i> ${m.txType || 'معاملة'}</span><span style="color:var(--text-4);font-size:9px" dir="ltr">#${(m.txId||'').slice(0,8)}</span></div><div style="display:flex;justify-content:space-between;color:var(--text-3);margin-bottom:2px"><span>المبلغ:</span><b style="color:var(--text)">${m.amount} ج</b></div><div style="display:flex;justify-content:space-between;color:var(--text-3)"><span>الحالة:</span><b style="color:${m.status==='approved'||m.status==='completed'?'var(--success-tx)':'var(--warn-tx)'}">${m.status}</b></div></div></div>`; }
    else if (m.type === 'system') { return `<div class="msg-system"><div class="msg-system-bubble"><i class="fa-solid fa-circle-info"></i> ${E(m.text)}</div></div>`; }
    else if (m.type === 'admin') { return `<div class="msg-admin"><div class="msg-admin-bubble" style="white-space:pre-line;text-align:right;direction:rtl;"><i class="fa-solid fa-headset"></i> ${E(m.text)}</div></div>`; }
    return E(m.text);
  };
  
  U.push(onValue(R('chats/' + cid), s => {
    c = s.val(); if (!c) return;
    const otherName = c.buyerId === me.uid ? c.sellerName : c.buyerName;
    $('ch').textContent = otherName + (c.frozen ? ' • مجمّدة' : '') + (c.status === 'closed' ? ' • مغلقة' : '');
    $('chat-avatar').textContent = initials(otherName);
    const statusEl = $('chat-status');
    if (c.status === 'closed') statusEl.innerHTML = '<span class="status-dot closed"></span><span>مغلقة</span>';
    else if (c.frozen) statusEl.innerHTML = '<span class="status-dot frozen"></span><span>مجمدة</span>';
    else statusEl.innerHTML = '<span class="status-dot"></span><span>نشطة</span>';
    const t = c.typing || {}; $('ty').textContent = Object.entries(t).some(([u,v]) => u !== me.uid && Date.now() - v < 4000) ? 'يكتب الآن...' : '';
    if (c.dealId && typeof c.dealId === 'string' && c.dealId.trim() !== '' && !d) { U.push(onValue(R('deals/' + c.dealId), x => { d = x.val(); if (d) dealPanel(cid, c, d); })); }
    const isClosed = c.status === 'closed'; const isFrozen = c.frozen;
    if (isClosed || isFrozen) { $('mi').disabled = true; $('mb').disabled = true; $('mf').disabled = true; $('mi').placeholder = isClosed ? 'تم إغلاق التذكرة' : 'الدردشة مجمدة'; $('mb').style.opacity = 0.5; } 
    else { $('mi').disabled = false; $('mb').disabled = false; $('mf').disabled = false; $('mi').placeholder = 'اكتب رسالة...'; $('mb').style.opacity = 1; }
  }));
  
  U.push(onValue(query(R(`chats/${cid}/messages`), limitToLast(100)), s => {
    const a = Object.values(s.val() || {}).sort((x,y) => x.createdAt - y.createdAt);
    if (a.length === 0) { $('ms').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-4);font-size:12px;font-weight:700">لا توجد رسائل</div>'; return; }
    $('ms').innerHTML = a.map(m => {
      if (m.type === 'transaction' || m.type === 'system' || m.type === 'admin') { return renderMsg(m); }
      const isMe = m.senderId === me.uid; const align = isMe ? 'me' : 'other';
      return `<div class="msg-row ${align}"><div class="msg-bubble ${align}">${renderMsg(m)}<span class="msg-time">${timeOnly(m.createdAt)}</span></div></div>`;
    }).join('');
    $('ms').scrollTop = 1e9;
  }));
};

function dealPanel(cid, c, d) {
  const el = $('dp'); if (!el || !d) return;
  const isBuyer = d.buyerId === me.uid; const isSeller = d.sellerId === me.uid; let btns = '';
  if (d.status === 'disputed') btns = `<span class="badge badge-warning"><i class="fa-solid fa-triangle-exclamation"></i> نزاع مفتوح</span>`;
  else if (d.status === 'held') {
    if (isBuyer) btns = `<button class="btn btn-ghost" style="padding:5px 10px;font-size:10px" onclick="dispute('${cid}')">إبلاغ</button>`;
    else if (isSeller) btns = `<button class="btn btn-success" style="padding:5px 10px;font-size:10px" onclick="deliver('${cid}')">تسليم الحساب</button>`;
  } else if (d.status === 'delivered') {
    if (isBuyer) {
        btns = `<button class="btn btn-warning" style="padding:5px 10px;font-size:10px" onclick="reveal('${d.postId}')"><i class="fa-solid fa-eye"></i> عرض البيانات</button>
                <button class="btn btn-success" style="padding:5px 10px;font-size:10px" onclick="confirmRx('${cid}')">تأكيد الاستلام</button>
                <button class="btn btn-danger" style="padding:5px 10px;font-size:10px" onclick="dispute('${cid}')">نزاع</button>`;
    } else if (isSeller) {
        btns = `<span style="font-size:10px;color:var(--text-3);font-weight:800">بانتظار المشتري</span>`;
    }
  } else if (d.status === 'completed') {
    btns = `<span class="badge badge-success"><i class="fa-solid fa-check"></i> مكتملة</span>`;
    if (isBuyer) {
        btns += `<button class="btn btn-warning" style="padding:5px 10px;font-size:10px;margin-right:4px" onclick="reveal('${d.postId}')"><i class="fa-solid fa-eye"></i> عرض البيانات</button>
                 <button class="btn btn-ghost" style="padding:5px 10px;font-size:10px;margin-right:4px" onclick="rate('${d.sellerId}')">تقييم</button>`;
    }
  } else if (d.status === 'refunded') { btns = `<span class="badge badge-danger"><i class="fa-solid fa-rotate-left"></i> مسترد</span>`; }
  const steps = ['held', 'delivered', 'completed']; const idx = steps.indexOf(d.status);
  const step = (label, done, icon) => `<div class="deal-step"><div class="deal-step-circle ${done ? 'done' : ''}"><i class="fa-solid ${icon}"></i></div><span class="deal-step-label ${done ? 'done' : ''}">${label}</span></div>`;
  el.innerHTML = `<div class="deal-panel"><div class="deal-header"><b class="deal-amount">${d.amount} ج</b><div class="deal-actions">${btns}</div></div><div class="deal-steps">${step('الدفع', true, 'fa-check')}${step('التسليم', idx >= 1, 'fa-box')}${step('الاكتمال', idx >= 2, 'fa-flag-checkered')}</div></div>`;
}

window.deliver = async cid => { try { if (!await ask('هل سلّمت بيانات الحساب بالكامل؟')) return; const chat = (await get(R('chats/' + cid))).val(); if (!chat || !chat.dealId) throw new Error('لم يتم العثور على الصفقة'); const updates = {}; updates[`deals/${chat.dealId}/status`] = 'delivered'; updates[`chats/${cid}/dealStatus`] = 'delivered'; await update(ref(db), updates); notify(chat.buyerId, 'تم تسليم حسابك', 'راجع الدردشة ثم أكّد الاستلام.', 'deal'); ok('تم تحديد الحساب كمسلم'); } catch(e) { bad(e); } };

window.reveal = async pid => { 
    try { 
        Swal.fire({title:'جاري فك التشفير...', didOpen:()=>Swal.showLoading(), showConfirmButton:false}); 
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch(WORKER_URL + "/decrypt", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
            body: JSON.stringify({ postId: pid })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'فشل الاتصال بالخادم');
        
        Swal.fire({ title:'بيانات الحساب', html:`<div style="background:var(--warn-bg);border:1px solid var(--warn-bd);padding:14px;border-radius:10px;text-align:left;margin-top:6px" dir="ltr"><p style="font-size:12px;margin-bottom:6px;color:var(--warn-tx)"><b>Email:</b> <span style="user-select:all">${E(result.email)}</span></p><p style="font-size:12px;color:var(--warn-tx)"><b>Password:</b> <span style="user-select:all">${E(result.password)}</span></p></div>`, confirmButtonText: 'نسخ وإغلاق' }).then(r => { if (r.isConfirmed) navigator.clipboard.writeText(`Email: ${result.email}\nPass: ${result.password}`); }); 
    } catch(e) { Swal.close(); bad(e); } 
};

window.confirmRx = async cid => { try { if (!await ask('هل قمت بضغط زر (عرض البيانات) وتغيير بيانات الحساب لضمان عدم سرقته؟ لا يمكن التراجع بعد التأكيد.')) return; const chat = (await get(R('chats/' + cid))).val(); if (!chat || !chat.dealId) throw new Error('لم يتم العثور على الصفقة'); const d = (await get(R('deals/' + chat.dealId))).val(); if (!d) throw new Error('لم يتم العثور على بيانات الصفقة'); const com = Math.round(d.amount * (Number(S.commission) || 0) / 100); const updates = {}; updates[`deals/${chat.dealId}/status`] = 'completed'; updates[`chats/${cid}/dealStatus`] = 'completed'; updates[`pending_payouts/${chat.dealId}`] = { sellerId: d.sellerId, buyerId: me.uid, amount: d.amount - com, grossAmount: d.amount, commission: com, status: 'pending', createdAt: Date.now() }; await update(ref(db), updates); notify(d.sellerId, 'اكتملت الصفقة', `أُضيف ${d.amount - com} ج لأرباحك المعلقة.`, 'deal'); ok('تم تأكيد الاستلام'); } catch(e) { bad(e); } };
window.dispute = async cid => { const {value: r} = await Swal.fire({ title:'سبب النزاع / الإبلاغ', input:'textarea', placeholder:'اكتب تفاصيل المشكلة بوضوح...', showCancelButton:true, confirmButtonText:'إرسال للإدارة', cancelButtonText:'إلغاء' }); if (!r) return; try { const chat = (await get(R('chats/' + cid))).val(); if (!chat || !chat.dealId) throw new Error('لم يتم العثور على الصفقة'); const d = (await get(R('deals/' + chat.dealId))).val(); const exist = await get(R('refund_queue/' + chat.dealId)); if (exist.exists() && exist.val().status === 'pending') throw new Error('يوجد نزاع مفتوح بالفعل.'); if (me.uid !== d.buyerId && me.uid !== d.sellerId) throw new Error('غير مصرح'); const updates = {}; updates['refund_queue/' + chat.dealId] = { buyerId: d.buyerId, sellerId: d.sellerId, amount: d.amount, status: 'pending', reason: Security.text(r, 5, 500), createdAt: Date.now(), raisedBy: me.uid, raisedByRole: me.uid === d.buyerId ? 'المشتري' : 'البائع' }; updates[`deals/${chat.dealId}/status`] = 'disputed'; updates[`chats/${cid}/frozen`] = true; updates[`chats/${cid}/dealStatus`] = 'disputed'; await update(ref(db), updates); await set(push(R(`chats/${cid}/messages`)), {senderId: 'system', type: 'system', text: '⚠️ تم فتح نزاع. يرجى الانتظار.', createdAt: Date.now()}); ok('تم فتح النزاع وسيراجعه الدعم'); } catch(e) { bad(e); } };
window.rate = async sid => { if (!sid) return bad(new Error('معرف غير صالح')); const {value: v} = await Swal.fire({title:'تقييم البائع', input:'select', inputOptions:{5:'⭐⭐⭐⭐⭐',4:'⭐⭐⭐⭐',3:'⭐⭐⭐',2:'⭐⭐',1:'⭐'}, showCancelButton:true}); if (!v) return; try { await set(R(`ratings/${sid}/${me.uid}`), {rating: +v, createdAt: Date.now()}); ok('شكراً لتقييمك'); } catch(e) { bad(e); } };

async function wallet() {
  $('app').innerHTML = `<div style="background:#18181b;border-radius:14px;padding:20px;color:#fff;margin-bottom:14px;position:relative;overflow:hidden"><div style="position:absolute;top:-40%;right:-20%;width:60%;height:200%;background:radial-gradient(circle,rgba(255,255,255,0.08) 0%,transparent 70%);pointer-events:none"></div><p style="font-size:11px;opacity:0.8;font-weight:700;margin-bottom:4px;position:relative">الرصيد المتاح</p><b style="font-size:32px;font-weight:900;letter-spacing:-0.02em;position:relative">${me.balance} <span style="font-size:14px;font-weight:700">ج</span></b><div style="display:flex;align-items:center;gap:4px;margin-top:8px;font-size:10px;font-weight:800;opacity:0.7;position:relative"><i class="fa-solid fa-lock" style="font-size:9px"></i>محفظة مؤمّنة ومشفرة</div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px"><button onclick="deposit()" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;box-shadow:var(--shadow);min-height:80px"><div style="width:36px;height:36px;border-radius:10px;background:var(--success-bg);color:var(--success-tx);display:flex;align-items:center;justify-content:center;font-size:14px"><i class="fa-solid fa-arrow-down"></i></div><span style="font-size:11px;font-weight:900;color:var(--text)">شحن</span></button><button onclick="withdraw()" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;box-shadow:var(--shadow);min-height:80px"><div style="width:36px;height:36px;border-radius:10px;background:var(--danger-bg);color:var(--danger-tx);display:flex;align-items:center;justify-content:center;font-size:14px"><i class="fa-solid fa-arrow-up"></i></div><span style="font-size:11px;font-weight:900;color:var(--text)">سحب</span></button><button onclick="coupon()" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;box-shadow:var(--shadow);min-height:80px"><div style="width:36px;height:36px;border-radius:10px;background:var(--warn-bg);color:var(--warn-tx);display:flex;align-items:center;justify-content:center;font-size:14px"><i class="fa-solid fa-ticket"></i></div><span style="font-size:11px;font-weight:900;color:var(--text)">كوبون</span></button></div><h3 style="font-size:14px;font-weight:900;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-clock-rotate-left" style="color:var(--text-3);font-size:12px"></i> سجل المعاملات</h3><div id="tx-history" style="display:grid;gap:6px"><div class="skeleton" style="height:60px"></div><div class="skeleton" style="height:60px"></div></div>`;
  try {
    const [depsSnap, wdsSnap] = await Promise.all([
      get(query(R('deposits'), orderByChild('userId'), equalTo(me.uid), limitToLast(10))),
      get(query(R('withdrawals'), orderByChild('userId'), equalTo(me.uid), limitToLast(10)))
    ]);
    const toTransactions = snap => Object.entries(snap.val() || {})
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const deps = toTransactions(depsSnap);
    const wds = toTransactions(wdsSnap);
    const allTxs = [...deps.map(d => ({...d, type: 'dep'})), ...wds.map(w => ({...w, type: 'wd'}))].sort((a,b) => b.createdAt - a.createdAt);
    if (allTxs.length === 0) { $('tx-history').innerHTML = '<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>لا توجد معاملات</p></div>'; return; }
    $('tx-history').innerHTML = allTxs.map(tx => { const isDep = tx.type === 'dep'; const stMap = {pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger'}; const stLabel = {pending: 'معلق', approved: 'مقبول', rejected: 'مرفوض'}; return `<div class="card" style="padding:10px 12px;margin-bottom:0"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:8px"><div style="width:32px;height:32px;border-radius:8px;background:${isDep ? 'var(--success-bg)' : 'var(--danger-bg)'};color:${isDep ? 'var(--success-tx)' : 'var(--danger-tx)'};display:flex;align-items:center;justify-content:center;font-size:13px"><i class="fa-solid ${isDep ? 'fa-arrow-down' : 'fa-arrow-up'}"></i></div><div><b style="font-size:12px;font-weight:900;color:var(--text);display:block">${isDep ? 'شحن' : 'سحب'}</b><span style="font-size:10px;color:var(--text-3);font-weight:700">${ago(tx.createdAt)}</span></div></div><div style="text-align:left"><b style="font-size:13px;font-weight:900;color:${isDep ? 'var(--success-tx)' : 'var(--danger-tx)'};display:block" dir="ltr">${isDep ? '+' : '-'}${tx.amount} ج</b><span class="badge ${stMap[tx.status]}" style="font-size:9px;margin-top:2px">${stLabel[tx.status]}</span></div></div></div>`; }).join('');
  } catch(e) { $('tx-history').innerHTML = '<p style="text-align:center;color:var(--danger-tx);font-size:12px;font-weight:700">تعذر جلب السجل</p>'; }
}

const fetchList = async p => Object.entries((await get(R(p))).val() || {}).map(([id, o]) => ({id, ...o})).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

// شاشة الإيداع: تم تعديل الحد الأدنى والأقصى
window.deposit = () => form('شحن الرصيد', `<p style="font-size:11px;font-weight:800;color:var(--danger-tx);background:var(--danger-bg);padding:8px;border-radius:8px;border:1px solid var(--danger-bd);margin-bottom:8px">${E(S.depositWarning || 'يرجى تحويل المبلغ ثم إرفاق صورة الإيصال.')}</p><p style="font-size:11px;font-weight:800;background:var(--surface-2);padding:8px;border-radius:8px;border:1px solid var(--border);margin-bottom:10px">${E(S.bankName || '')} · ${E(S.accountName || '')} · <b style="color:var(--success-tx);font-size:12px">${E(S.walletNumber || '')}</b></p>${inp('f_a','المبلغ (ج)','number')}<input id="f_f" type="file" accept="image/*" style="font-size:11px;padding:8px">`, async () => { 
    // تعديل الحد الأدنى 100 والأقصى 10,000,000
    const a = Security.amount($('f_a').value, 100, 10000000); 
    const url = await img($('f_f').files[0]); 
    await set(push(R('deposits')), {userId: me.uid, userName: me.name, amount: a, receiptUrl: url, status: 'pending', createdAt: Date.now()}); 
    ok('تم إرسال الإيصال للمراجعة'); go('wallet'); 
});

window.withdraw = () => form('طلب سحب', 
  inp('f_a','المبلغ (ج)','number') + 
  inp('f_m','الطريقة (مثال: فودافون كاش)') + 
  inp('f_c','رقم الحساب/المحفظة') + 
  inp('f_n','اسم صاحب الحساب'), 
  async () => { 
    Security.limit('wd', 3, 36e5); 
    const a = Security.amount($('f_a').value, 50, 10000000); // سماح بالسحب حتى 10 ملايين
    if (a > me.balance) throw new Error('الرصيد غير كافٍ'); 

    Swal.fire({title: 'جاري التحقق من هويتك...', didOpen: () => Swal.showLoading(), showConfirmButton: false});
    try {
      await reauthenticateWithPopup(auth, new GoogleAuthProvider());
    } catch(e) {
      Swal.close();
      throw new Error('فشل التحقق من الهوية. حاول مرة أخرى.');
    }
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(WORKER_URL + "/withdraw", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ 
            amount: a, 
            method: Security.text($('f_m').value, 2, 40), 
            account: Security.text($('f_c').value, 3, 60), 
            accountName: Security.text($('f_n').value, 3, 60) 
        })
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'فشل الاتصال بالخادم');
    
    Swal.close();
    ok('تم تسجيل طلب السحب'); 
    go('wallet'); 
});

window.coupon = () => form('استبدال كوبون', inp('f_k','كود الكوبون'), async () => { const k = $('f_k').value.trim(); if (!/^[A-Za-z0-9_-]{4,40}$/.test(k)) throw new Error('كود غير صالح'); await set(R(`credit_queue/${me.uid}/${k}`), {userId: me.uid, code: k, amount: 0, status: 'pending', createdAt: Date.now()}); ok('تم إرسال الكوبون للمراجعة'); });

function notes() {
  const a = Object.entries(N).sort((x, y) => y[1].createdAt - x[1].createdAt);
  if (a.length === 0) { $('app').innerHTML = '<div class="empty-state"><i class="fa-regular fa-bell"></i><p>لا توجد إشعارات</p></div>'; return; }
  $('app').innerHTML = a.map(([id, n]) => `<div class="card" style="${n.read ? 'opacity:0.7' : ''}"><div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px"><b style="font-size:13px;font-weight:900;color:var(--text)">${E(n.title)}</b><span style="font-size:9px;font-weight:800;color:var(--text-3);background:var(--surface-2);padding:2px 6px;border-radius:5px;white-space:nowrap">${ago(n.createdAt)}</span></div><p style="font-size:12px;color:var(--text-2);font-weight:600;line-height:1.6">${E(n.body)}</p>${n.fields && !n.response ? `<div style="margin-top:10px;background:var(--surface-2);padding:10px;border-radius:8px;border:1px solid var(--border)">${Object.entries(n.fields).map(([k, f]) => inp(`nf_${id}_${k}`, E(f.label || f))).join('')}<button class="btn btn-primary" style="width:100%;padding:10px;font-size:11.5px" onclick="sendForm('${id}')">إرسال</button></div>` : ''}${!n.read ? `<button class="btn btn-ghost" style="margin-top:8px;padding:7px 12px;font-size:11px" onclick="markRead('${id}')">تعليم كمقروء</button>` : ''}</div>`).join('');
}

window.markRead = id => set(R(`notifications/${me.uid}/${id}/read`), true);
window.sendForm = async id => { try { const n = N[id], v = {}; for (const k of Object.keys(n.fields)) v[k] = Security.text($(`nf_${id}_${k}`).value, 1, 300); await set(R(`notifications/${me.uid}/${id}/response`), {values: v, createdAt: Date.now()}); await markRead(id); ok('تم إرسال الاستمارة'); } catch(e) { bad(e); } };

function profile() {
  const vb = me.verified ? '' : VS === 'pending' ? `<div style="margin-top:12px;background:var(--warn-bg);border:1px solid var(--warn-bd);color:var(--warn-tx);border-radius:10px;padding:10px;font-size:11px;font-weight:800"><i class="fa-solid fa-hourglass-half"></i> طلب التوثيق قيد المراجعة</div>` : `${VS === 'rejected' ? '<p style="font-size:11px;font-weight:800;color:var(--danger-tx);background:var(--danger-bg);padding:10px;border-radius:10px;border:1px solid var(--danger-bd);margin-top:10px">تم رفض الطلب. أعد المحاولة بصور أوضح.</p>' : ''}<button class="btn btn-primary" style="width:100%;padding:12px;margin-top:12px;font-size:12.5px" onclick="verify()"><i class="fa-solid fa-shield-halved"></i> توثيق الحساب</button>`;
  $('app').innerHTML = `<div class="card" style="text-align:center;padding:24px 16px;margin-top:8px"><div style="position:relative;display:inline-block;margin-bottom:10px"><img src="${E(me.photo)}" style="width:88px;height:88px;border-radius:22px;object-fit:cover;border:3px solid var(--surface);box-shadow:var(--shadow-lg)" alt="">${me.verified ? '<div style="position:absolute;bottom:0;right:0;width:26px;height:26px;background:var(--surface);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow)"><i class="fa-solid fa-circle-check" style="color:var(--success-solid);font-size:14px"></i></div>' : ''}</div><b style="font-size:17px;font-weight:900;color:var(--text);display:block;margin-bottom:4px">${E(me.name)}</b><span style="font-size:11px;font-weight:800;color:var(--text-3);background:var(--surface-2);padding:4px 12px;border-radius:20px;display:inline-block">${E(me.email)}</span>${vb}</div><div style="display:grid;gap:8px"><button class="btn btn-ghost" style="width:100%;padding:14px;font-size:13px" onclick="go('orders')"><i class="fa-solid fa-receipt"></i> طلباتي وإعلاناتي</button><button class="btn btn-ghost" style="width:100%;padding:14px;font-size:13px" onclick="showTerms()"><i class="fa-solid fa-file-contract"></i> الشروط والأحكام</button><button class="btn btn-ghost" style="width:100%;padding:14px;font-size:13px;color:var(--danger-tx);border-color:var(--danger-bd)" onclick="logout()"><i class="fa-solid fa-arrow-right-from-bracket"></i> تسجيل الخروج</button></div>`;
}

window.showTerms = () => {
  Swal.fire({
    title: 'الشروط والأحكام',
    html: `<div style="text-align:right; font-size:12px; line-height:1.8; max-height:60vh; overflow-y:auto; padding:10px;" dir="rtl"><b>1. طبيعة المنصة:</b> BLACKP2P هي منصة وسيطة (وسيط) لتسهيل عمليات بيع وشراء الحسابات بين المستخدمين. المنصة لا تمتلك الحسابات ولا تتحمل مسؤولية أي إجراء تتخذه شركات الألعاب (مثل الحظر).<br><br><b>2. الضمان:</b> يتم حجز المبلغ لدى المنصة حتى يقوم المشتري بتأكيد استلام الحساب وتغيير بياناته. بمجرد ضغط المشتري على "تأكيد الاستلام"، يتم تحويل المبلغ للبائع ولا يمكن التراجع.<br><br><b>3. النزاعات:</b> في حال وجود مشكلة، يجب فتح نزاع خلال 24 ساعة من استلام الحساب. الإدارة لها الحق في اتخاذ القرار النهائي بناءً على الأدلة المقدمة.<br><br><b>4. الحسابات المسروقة:</b> يُمنع منعاً باتاً بيع حسابات مسروقة. أي مستخدم يثبت تورطه في ذلك سيتم حظر حسابه نهائياً وتجميد أمواله.<br><br><b>5. المسؤولية:</b> أنت مسؤول عن الحفاظ على سرية بيانات حسابك على المنصة.</div>`,
    confirmButtonText: 'موافق', width: '90%'
  });
};

window.verify = () => {
    if (VS === 'pending') return bad(new Error('طلبك قيد المراجعة بالفعل، يرجى الانتظار.'));
    if (me.verified) return bad(new Error('حسابك موثق بالفعل.'));

    form('توثيق الحساب', '<label style="font-size:11px;font-weight:800;color:var(--text-3);display:block;margin-bottom:4px">صورة الهوية</label><input id="f_i" type="file" accept="image/*" style="margin-bottom:10px;font-size:11px;padding:8px"><label style="font-size:11px;font-weight:800;color:var(--text-3);display:block;margin-bottom:4px">سيلفي مع الهوية</label><input id="f_s" type="file" accept="image/*" style="font-size:11px;padding:8px">', 
    async () => { 
        const a = await img($('f_i').files[0]); 
        const b = await img($('f_s').files[0]); 
        await set(R('user_verifications/' + me.uid), {idUrl: a, selfieUrl: b, status: 'pending', createdAt: Date.now()}); 
        VS = 'pending';
        if (view === 'me') profile(); 
        ok('تم إرسال طلب التوثيق'); 
    });
};

const ST = {held:'بانتظار التسليم', delivered:'تم التسليم', completed:'مكتملة', cancelled:'ملغية', refunded:'مستردة', disputed:'نزاع'};
const PS = {pending:'قيد المراجعة', active:'منشور', sold:'مباع', deleted:'محذوف'};
const GR = {run:['held','delivered','disputed'], done:['completed'], bad:['cancelled','refunded']};

async function orders() {
  $('app').innerHTML = `<div id="ot" style="display:flex;gap:2px;padding:4px;background:var(--surface-2);border-radius:10px;margin-bottom:14px"></div><div id="ol" style="display:grid;gap:8px"><div class="skeleton" style="height:70px"></div><div class="skeleton" style="height:70px"></div></div>`;
  try {
    const ids = Object.keys((await get(R('user_chats/' + me.uid))).val() || {}).filter(i => !i.startsWith('support_'));
    OD = (await Promise.all(ids.map(async i => { const c = (await get(R('chats/' + i))).val(); if (!c || !c.dealId) return null; const d = (await get(R('deals/' + c.dealId))).val(); const p = (await get(R('posts/' + c.postId))).val(); return d && {cid: i, d, g: (p || {}).game || '—'}; }))).filter(Boolean).sort((a, b) => b.d.createdAt - a.d.createdAt);
    MP = Object.entries((await get(query(R('posts'), orderByChild('sellerId'), equalTo(me.uid)))).val() || {}).map(([id, p]) => ({id, ...p})).sort((a, b) => b.createdAt - a.createdAt);
    renderOrders();
  } catch(e) { bad(e); }
}

function renderOrders() {
  if (view !== 'orders' && !$('ot')) return;
  $('ot').innerHTML = [['run','جارية'],['done','مكتملة'],['bad','ملغية'],['ads','إعلاناتي']].map(([k,l]) => `<button style="flex:1;padding:8px;border-radius:7px;font-size:11.5px;font-weight:900;color:${OT===k?'var(--text)':'var(--text-3)'};background:${OT===k?'var(--surface)':'transparent'};box-shadow:${OT===k?'var(--shadow)':'none'}" onclick="setOT('${k}')">${l}</button>`).join('');
  const row = (click, t, sub, st) => `<div class="card card-hover" style="cursor:pointer;padding:12px" onclick="${click}"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="min-width:0;flex:1"><b style="font-size:12.5px;font-weight:900;color:var(--text);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(t)}</b><p style="font-size:10.5px;font-weight:700;color:var(--text-3);margin-top:2px">${sub}</p></div><span class="badge badge-info" style="flex-shrink:0">${st}</span></div></div>`;
  const items = OT === 'ads' ? MP.map(p => row(`openPost('${p.id}')`, p.game, `${p.price} ج · ${ago(p.createdAt)} · ❤ ${p.likeCount||0}`, PS[p.status] || p.status)) : OD.filter(o => GR[OT].includes(o.d.status)).map(o => row(`openChat('${o.cid}')`, o.g, `${o.d.buyerId === me.uid ? 'شراء' : 'بيع'} · ${o.d.amount} ج · ${ago(o.d.createdAt)}`, ST[o.d.status] || o.d.status));
  $('ol').innerHTML = items.length ? items.join('') : '<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>لا يوجد شيء هنا</p></div>';
}

window.setOT = k => { OT = k; renderOrders(); };
