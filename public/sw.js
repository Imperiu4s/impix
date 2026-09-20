// A régi Impix oldal service workerének leváltása.
//
// A korábbi oldal ezen a címen (./sw.js) regisztrált egy service workert, amely az oldal fájljait a böngészőben
// gyorsítótárazta és onnan szolgálta ki. Az új Impix nem használ service workert, de a régi látogatók böngészőjében
// a régi worker továbbra is a régi oldalt adná. Amikor a böngésző legközelebb frissítést keres, ezt a fájlt kapja:
// kitörli a gyorsítótárat, kiregisztrálja magát, és újratölti az oldalt, így a látogató már az újat látja.
//
// Ezt a fájlt ne töröld, amíg a régi látogatók böngészőjében marad régi worker (érdemes hónapokig meghagyni).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    windows.forEach((client) => client.navigate(client.url));
  })());
});

// Nincs fetch eseménykezelő: minden kérés közvetlenül a hálózatra megy.
