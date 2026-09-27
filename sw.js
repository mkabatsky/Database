// Service worker: lets the app open offline and pick up new versions when online.
// Bump CACHE when you upload a new app.enc / index.html so phones refresh.
var CACHE = "equipment-db-v12";
var CORE = ["./", "./index.html", "./app.enc", "./access.json", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CORE); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // our own files (login page, app.enc, access.json, icons): network first so new
  // users and new versions arrive right away, cached copy when offline
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req, {cache: "no-cache"}).then(function(res){
        if (res && res.ok) {
          var copy = res.clone();
          var key = req.mode === "navigate" ? "./index.html" : req;
          caches.open(CACHE).then(function(c){ c.put(key, copy); });
        }
        return res;
      }).catch(function(){
        return caches.match(req).then(function(r){
          return r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error());
        });
      })
    );
    return;
  }

  // libraries from CDNs: cached copy first, then network and remember it
  e.respondWith(
    caches.match(req).then(function(hit){
      if (hit) return hit;
      return fetch(req).then(function(res){
        if (res && (res.ok || res.type === "opaque")) {
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
