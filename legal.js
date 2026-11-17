(function(){
  var root=document.documentElement;
  var btn=document.getElementById('theme-btn');
  function paint(){ if(!btn) return; btn.innerHTML = root.classList.contains('dark') ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>'; }
  paint();
  if(btn) btn.addEventListener('click',function(){
    root.classList.toggle('dark');
    try{ localStorage.setItem('theme', root.classList.contains('dark')?'dark':'light'); }catch(e){}
    paint();
  });

  // الفهرس: افتح تلقائياً على الشاشات الكبيرة، وأغلقه على الجوال بعد الضغط
  var toc=document.getElementById('toc');
  if(toc){
    var wide=window.matchMedia('(min-width:920px)');
    var sync=function(){ if(wide.matches) toc.setAttribute('open',''); else toc.removeAttribute('open'); };
    sync(); wide.addEventListener('change',sync);
    toc.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',function(){ if(!wide.matches) toc.removeAttribute('open'); }); });
  }

  // تمييز القسم الحالي في الفهرس
  var links={}; document.querySelectorAll('#toc a').forEach(function(a){ links[a.getAttribute('href').slice(1)]=a; });
  var secs=document.querySelectorAll('section.s');
  if('IntersectionObserver' in window && secs.length){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){
        Object.values(links).forEach(function(l){ l.classList.remove('on'); });
        if(links[e.target.id]) links[e.target.id].classList.add('on');
      }});
    },{rootMargin:'-20% 0px -70% 0px'});
    secs.forEach(function(s){ io.observe(s); });
  }
})();
