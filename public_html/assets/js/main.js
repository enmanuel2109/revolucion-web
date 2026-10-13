
(function(){
  try{
    var target=Date.UTC(2026,9,26,14,0,0); // 26 oct 2026, 10:00 a. m. Miami (EDT, UTC-4)
    var boxes=document.querySelectorAll('[data-cd]');
    function pad(n){return n<10?'0'+n:''+n;}
    function tick(){
      var diff=target-Date.now();
      boxes.forEach(function(b){
        if(diff<=0){
          b.querySelector('.cd-grid').hidden=true;
          b.querySelector('.cd-note').innerHTML='<strong>¡R-evolución ya comenzó!</strong> Primera clase: 26 de octubre de 2026, 10:00 a. m. (hora de Miami)';
          return;
        }
        var t=Math.floor(diff/1000);
        var v={d:Math.floor(t/86400),h:Math.floor(t%86400/3600),m:Math.floor(t%3600/60),s:t%60};
        for(var k in v){var el=b.querySelector('[data-u="'+k+'"]'); if(el) el.textContent=k==='d'?String(v[k]):pad(v[k]);}
      });
      if(diff>0) setTimeout(tick,1000);
    }
    tick();
  }catch(e){}
})();



(function(){
  try{
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var root=document.documentElement, nav=document.querySelector('.nav'), bar=document.querySelector('.progress'), trophy=document.querySelector('.trophy');
    // scroll-linked: progress bar, nav shadow, trophy drift
    if(!reduce){
      var ticking=false;
      function onScroll(){
        if(ticking) return; ticking=true;
        requestAnimationFrame(function(){
          var y=window.pageYOffset||0, max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
          if(bar) bar.style.transform='scaleX('+Math.min(1,y/max)+')';
          if(nav) nav.classList.toggle('scrolled',y>10);
          if(trophy && window.innerWidth>860) trophy.style.transform='translateY('+Math.min(y*0.07,36).toFixed(1)+'px)';
          ticking=false;
        });
      }
      window.addEventListener('scroll',onScroll,{passive:true}); onScroll();
    }
    // reveal on scroll (content stays readable at rest: transform + light fade only)
    if(!reduce && 'IntersectionObserver' in window){
      var groups=['.stats .stat','.about .wrap > *','.band .wrap > *','.program-head > *','.mod','.exp .wrap > *','.guestwork .gw-card','.history h2','.founders > *','.cal .wrap > *','.tl li','.pricing .head','.plan','.pay .card','.how .head','.step','.notes','.comm-card','.final-photo','.final h2','.final .sub','.final .cta-row'];
      var els=[];
      groups.forEach(function(sel){
        document.querySelectorAll(sel).forEach(function(el,i){
          el.classList.add('reveal'); el.style.setProperty('--d',((i%3)*0.09)+'s'); els.push(el);
        });
      });
      root.classList.add('rv');
      var io=new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); if(e.target.classList.contains('stat')) count(e.target.querySelector('b')); } });
      },{threshold:0.12,rootMargin:'0px 0px -6% 0px'});
      els.forEach(function(el){io.observe(el);});
    }
    function count(b){
      if(!b||reduce) return; var end=parseInt(b.textContent,10); if(!/^\d+$/.test(b.textContent.trim())||!end) return;
      var t0=null, dur=1100; b.textContent='0';
      function step(t){ if(!t0) t0=t; var k=Math.min(1,(t-t0)/dur); b.textContent=String(Math.round(end*(1-Math.pow(1-k,3)))); if(k<1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    }
  }catch(e){}
})();
