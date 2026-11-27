/* 级数和弦速查 · 离线缓存
   线上静态资源需携带 sharecode，故从 SW 自身 URL 中提取并拼接到预缓存地址 */
var CACHE = 'music-v23';
var SC = '';
try { SC = new URL(self.location.href).searchParams.get('sharecode') || ''; } catch (e) {}
var SUF = SC ? ('?sharecode=' + encodeURIComponent(SC)) : '';
var DOC = './%E7%BA%A7%E6%95%B0%E5%92%8C%E5%BC%A6%E9%80%9F%E6%9F%A5.html';
var ASSETS = [
  './' + SUF,
  './index.html' + SUF,
  DOC + SUF,
  './manifest.json' + SUF
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 逐个缓存，单个失败不阻断整体安装 */
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 导航请求网络优先（保证打开即最新），静态资源缓存优先 + 后台更新；离线时回退缓存文档 */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var isNav = e.request.mode === 'navigate';
  var netFetch = fetch(e.request).then(function (resp) {
    /* 502 等错误响应视为失败，交给缓存兜底，绝不把错误页发给用户 */
    if (!resp || !resp.ok) return null;
    if (e.request.url.startsWith(self.location.origin)) {
      var copy = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    }
    return resp;
  }).catch(function () { return null; });
  if (isNav) {
    e.respondWith(netFetch.then(function (resp) {
      if (resp) return resp;
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match(DOC, { ignoreSearch: true });
      });
    }));
  } else {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || netFetch;
      })
    );
  }
});
