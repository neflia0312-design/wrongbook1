const SHELL_CACHE='wrongbook-shell';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.png'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(CORE).catch(()=>{})));
});
self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message',event=>{
  if(event.data && event.data.type==='SKIP_WAITING')self.skipWaiting();
});

async function networkFirst(request){
  const cache=await caches.open(SHELL_CACHE);
  try{
    const fresh=await fetch(new Request(request,{cache:'no-store'}));
    if(fresh && fresh.ok){
      cache.put(request,fresh.clone()).catch(()=>{});
      if(request.mode==='navigate')cache.put('./index.html',fresh.clone()).catch(()=>{});
    }
    return fresh;
  }catch(e){
    return (await cache.match(request))
      || (request.mode==='navigate' ? await cache.match('./index.html') : null)
      || Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'
     || /\/(?:index\.html|version\.json|manifest\.webmanifest|sw\.js)$/.test(url.pathname)){
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    const cached=await cache.match(req);
    const freshPromise=fetch(req).then(r=>{
      if(r && r.ok)cache.put(req,r.clone()).catch(()=>{});
      return r;
    }).catch(()=>null);
    return cached || await freshPromise || Response.error();
  })());
});
