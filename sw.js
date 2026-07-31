/* 미로 탈출 서비스워커 — 네트워크 우선 전략
   목표: 온라인이면 항상 최신, 오프라인이면 캐시로 동작.
   내용을 수정하면 CACHE 버전을 올릴 것. */
const CACHE = 'maze-escape-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())        // 대기하지 않고 즉시 교체
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())      // 열려 있는 탭도 즉시 인계
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

function isDocument(req) {
  if (req.mode === 'navigate' || req.destination === 'document') return true;
  const p = new URL(req.url).pathname;
  return p.endsWith('/') || p.endsWith('/index.html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  // HTML은 네트워크 우선 + HTTP 캐시 무시 → 새로고침 한 번에 최신 반영
  if (isDocument(req)) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 그 외 정적 파일은 캐시로 즉시 응답하고 백그라운드에서 갱신
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
