/* 미로 탈출 서비스워커
   network-first 전략: 온라인이면 항상 서버의 최신 파일을 우선 받아온다.
   오프라인일 때만 캐시로 대체한다. 그래서 이제 내용을 고쳐도
   테스터가 캐시를 수동으로 지울 필요가 없다 — 온라인이기만 하면 자동으로 최신 반영됨.
   (그래도 완전히 새 캐시로 갈아엎고 싶으면 아래 버전 문자열을 바꾸면 됨) */
const CACHE = 'maze-escape-v3';
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
      // 개별 add + catch: 파일 하나가 404여도 설치 전체가 실패하지 않게
      .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      // 온라인: 최신 응답을 받아서 그대로 쓰고, 오프라인 대비용으로 캐시도 갱신
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() =>
      // 오프라인일 때만 캐시된 예전 파일 사용
      caches.match(e.request).then(hit => hit || caches.match('./index.html'))
    )
  );
});
