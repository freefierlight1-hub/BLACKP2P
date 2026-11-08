self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // هذا الكود يسمح للمتصفح بالتعرف على الموقع كتطبيق
});