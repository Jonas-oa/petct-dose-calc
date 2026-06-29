const CACHE='petct-v4';
const PRECACHE=[
  '/',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap'
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>
      Promise.allSettled(
        PRECACHE.map(url=>
          fetch(url,{cache:'no-cache'}).then(r=>{
            if(r&&r.ok) c.put(url,r.clone());
          }).catch(()=>{})
        )
      )
    ).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(ks=>
      Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    ).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=e.request.url;
  const isCDN=url.includes('cdnjs.cloudflare.com')||url.includes('fonts.g');
  if(isCDN){
    e.respondWith(
      caches.match(e.request).then(cached=>{
        if(cached) return cached;
        return fetch(e.request).then(resp=>{
          if(resp&&resp.ok){
            caches.open(CACHE).then(c=>c.put(e.request,resp.clone()));
          }
          return resp;
        }).catch(()=>new Response('',{status:503}));
      })
    );
  } else {
    e.respondWith(
      fetch(e.request).then(resp=>{
        if(resp&&resp.ok){
          caches.open(CACHE).then(c=>c.put(e.request,resp.clone()));
        }
        return resp;
      }).catch(()=>caches.match(e.request).then(c=>c||new Response('Offline',{status:503})))
    );
  }
});
