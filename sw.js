/* 미로 탈출 서비스워커
   network-first 전략 + HTTP 캐시 강제 우회: 온라인이면 항상 서버의 진짜 최신 파일을 받아온다.
   (주의) fetch(request)만으로는 브라우저의 HTTP 디스크 캐시가 GitHub Pages의
   Cache-Control 헤더를 보고 네트워크 요청 자체를 건너뛰고 예전 파일을 돌려줄 수 있다.
   그래서 매번 { cache: 'no-store' }로 새 Request를 만들어 HTTP 캐시까지 확실히 우회한다.
   오프라인일 때만 Service Worker 캐시로 대체한다. */
const CACHE = 'maze-escape-v4';
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
  // no-store로 새로 만든 요청: 브라우저 HTTP 캐시도, GitHub Pages의 Cache-Control도 무시하고 항상 네트워크로 감
  const freshReq = new Request(e.request.url, { cache: 'no-store', credentials: e.request.credentials });
  e.respondWith(
    fetch(freshReq).then(res => {
      // 온라인: 최신 응답을 받아서 그대로 쓰고, 오프라인 대비용으로 캐시도 갱신
      if (res && res.status === 200) {
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
