# Impix

Streaming szolgáltatás (Netflix-szerű) felhasználói felülettel és admin panellel.
Node.js + Express + beépített SQLite (`node:sqlite`), a felület dependency nélküli JavaScript.

## Indítás

```bash
npm install
npm start
```

Ezután: <http://localhost:3000>

Az **első indításkor** a konzolon megjelenik az admin fiók e-mail címe és egyszeri jelszava.
Saját adatokat is megadhatsz (csak az első indításkor számít):

```powershell
$env:ADMIN_EMAIL = "te@example.com"; $env:ADMIN_PASSWORD = "eros-jelszo-123"; npm start
```

Elfelejtett admin jelszó, vagy meglévő felhasználó adminná tétele:

```bash
npm run create-admin -- te@example.com uj-jelszo-123
```

Környezeti változók:

| Változó | Jelentés |
|---|---|
| `PORT` | port (alap: 3000) |
| `IMPIX_DB` | adatbázisfájl helye (alap: `data/impix.db`); a feltöltött videók az adatbázis melletti `videos/` mappába kerülnek |
| `MAX_UPLOAD_MB` | feltöltött videó legnagyobb mérete MB-ban (alap: 2048) |
| `CORS_ORIGINS` | melyik weboldalak (pl. GitHub Pages) hívhatják az API-t, vesszővel elválasztva |
| `MEDIA_SECRET` | feltöltött videólinkek aláírásához (alapból a `data/media.key` fájlba generálódik) |
| `TRUST_PROXY` | reverse proxy mögött állítsd `1`-re (HTTPS felismerés, kliens IP) |
| `IMPIX_ALLOW_DEVTOOLS=1` | kikapcsolja a jobb klikk / F12 tiltást (fejlesztéshez) |

## Üzemeltetés: weboldal GitHubon (Pages) + Node szerver külön

> **Lépésről lépésre útmutató az impix.hu élesítéséhez (Rackhost DNS, Ubuntu VPS, GitHub Pages): [DEPLOY.md](DEPLOY.md).**
> A szerver telepítő szkriptjei a `deploy/` mappában vannak.

A `public/` mappa (a weboldal) automatikusan kikerül **GitHub Pagesre**, a Node szerver (`server.js`) pedig külön tárhelyen fut
(VPS, Render, Railway, Fly.io stb. – GitHub Pages csak statikus fájlokat tud kiszolgálni).

**1. GitHub oldal**
1. Repo létrehozása és a kód feltöltése a `main` ágra. *(Ingyenes GitHub Pageshez a repónak nyilvánosnak kell lennie.)*
2. `Settings → Pages → Source: GitHub Actions`
3. `Settings → Secrets and variables → Actions → Variables → New repository variable`:
   `IMPIX_API_URL` = a Node szervered HTTPS címe, például `https://api.impix.example.com` (záró perjel nélkül)
4. A `.github/workflows/pages.yml` minden `public/` módosításnál újra kiteszi az oldalt (kézzel is indítható az Actions fülön).
   Az oldal címe: `https://<felhasznalo>.github.io/<repo>/`

**2. Node szerver (külön tárhelyen)**

```bash
npm install --omit=dev
CORS_ORIGINS=https://<felhasznalo>.github.io TRUST_PROXY=1 npm start
```

- `CORS_ORIGINS`: csak az oldal *eredete* (protokoll + domain, **útvonal nélkül**), több érték vesszővel elválasztva.
  Saját domain esetén annak címe is (pl. `https://www.impix.hu`).
- A szervernek **HTTPS-en** kell futnia (a Pages HTTPS, a böngésző a vegyes tartalmat blokkolja).
- A `data/` mappának tartós tárhelyen kell lennie (adatbázis + feltöltött videók). Ha a tárhely újraindításkor törli a fájlokat,
  minden adat elvész.
- Opcionálisan `MEDIA_SECRET` (feltöltött videók linkjeinek aláírása); ha nincs megadva, a szerver generál egyet a `data/media.key` fájlba.

**Hogyan működik ilyenkor a belépés?** Más eredetről a böngészők a sütiket megbízhatatlanul kezelik (Safari tiltja), ezért az oldal
tokent kap belépéskor, és azt `Authorization` fejlécben küldi. A token a böngésző `localStorage`-ában van, ezért fontos, hogy az
oldal csak saját szkriptet futtasson (ezt a `<meta>` tartalombiztonsági szabály kikényszeríti, és minden kimenet escape-elt).
A feltöltött videók aláírt, 6 óráig érvényes linkeken érhetők el, és minden kérésnél ellenőrizzük, hogy a nézőnek még van-e előfizetése.

Ha az oldalt és az API-t ugyanaz a szerver szolgálja ki (helyi fejlesztés), a `public/config.js` üresen marad, és a belépés
`httpOnly` sütivel működik – ehhez nem kell semmit beállítani.

## Funkciók

**Felhasználó**
- Regisztráció, belépés, kilépés, profil- és jelszómódosítás
- Csomagválasztás (Alap / Standard / Prémium), csomagváltás, megújítás, lemondás
- Katalógus (filmek, sorozatok, keresés, műfajszűrés), lejátszó, sorozatoknál automatikus következő epizód
- A videó csak érvényes előfizetéssel érhető el (a szerver adja ki a címet, a katalógus nem tartalmazza)
- Téma: sötét / világos / automatikus + 5 kiemelő szín; a fiókhoz mentődik
- **Keresés**: élő keresőoldal (cím, műfaj, év, leírás), szűrés típusra és műfajra
- **Kedvencek**: a ♥ gombbal bármelyik film/sorozat a kedvencekbe tehető (külön oldal + sáv a főoldalon)
- **Ajánlás**: a felhasználó filmet/sorozatot ajánlhat az adminnak (cím, típus, link, megjegyzés), és látja az állapotát

**Admin panel** (`/#/admin`)
- Áttekintés: felhasználók, aktív/lejárt előfizetések, bevétel, csomag-eloszlás
- Felhasználók: keresés, előfizetés adása, admin jog adása/elvétele, tiltás, törlés
- Előfizetések: szűrés állapot szerint, adás, megújítás (N nappal), szerkesztés (csomag, lejárat), azonnali megszüntetés, törlés
- Csomagok: létrehozás, szerkesztés, elrejtés/törlés
- Tartalmak: filmek és sorozatok, epizódok kezelése, kiemelés a főoldalon. Minden tartalomnál kötelező a **leírás**,
  az **elkészülés éve** és az **ajánlott életkor** (korhatár nélkül / 6 / 12 / 16 / 18)
- Ajánlások: a felhasználók ajánlásai egy helyen (új ajánlás jelvény a menüben), egy kattintással
  „Hozzáadás a katalógushoz" – az űrlap előtöltődik, mentés után az ajánlás automatikusan „felkerült" lesz

### Videó megadása

Filmnél és sorozat-epizódnál háromféleképpen adható meg a videó:

1. **Videa / YouTube / Vimeo link** – a link (oldal- vagy beágyazó cím) automatikusan beágyazott lejátszóvá alakul.
2. **Közvetlen videófájl-link** (`https://…/film.mp4`, `.webm`) – a beépített lejátszóval megy.
3. **Fájlfeltöltés** (mp4, m4v, webm, ogv) – az admin űrlapon, folyamatjelzővel; a fájl a szerveren tárolódik,
   és csak bejelentkezett, érvényes előfizetéssel rendelkező felhasználó éri el.

Beágyazott (Videa/YouTube/Vimeo) videónál a lejátszó külső oldalon fut: ott a következő rész automatikus indítása nem működik,
és az előfizetés-ellenőrzés csak a videó címének kiadására vonatkozik (aki ismeri a Videa-azonosítót, közvetlenül is megnyithatja).

## Fontos tudnivalók

- **A fizetés szimulált.** Nincs fizetési szolgáltató bekötve, és kártyaadatot sem kér az oldal.
  Éles használathoz (pl. Stripe) a `POST /api/subscription` és `/api/subscription/renew` végpontokat kell hozzákötni
  a fizetés visszaigazolásához.
- **Automatikus megújítás nincs**: az előfizetés a 30 napos időszak végén lejár, a felhasználó (vagy az admin) újíthatja meg.
- A bemutató tartalmak videói külső, szabad licencű forrásokra mutatnak (Blender, archive.org, MDN).
  Az admin panelen bármelyik videó címe kicserélhető a saját tárhelyedre.
- Éles üzemben HTTPS mögé kell tenni (reverse proxy); a szerver `Secure` sütit használ, ha a kapcsolat HTTPS.
  Reverse proxy mögött állítsd be az Express `trust proxy` értékét.
- **A jobb klikk és az F12 / Ctrl+Shift+I / Ctrl+U tiltás csak elrettentés** (`public/protect.js`). A böngésző saját menüjéből
  vagy kikapcsolt JavaScripttel megkerülhető, és a hálózati forgalomból a közvetlen videólinkek kiolvashatók. A tartalom valódi
  védelméhez DRM-es streaming szolgáltatás kell. A feltöltött fájlokat aláírt, lejáró linkek védik, a külső (link) videókat nem.
- A `data/` mappa az adatbázist és a feltöltött videókat tartalmazza – ne verziókezeld, és készíts róla mentést.

> **Olyan tárhelyen, ahol nincs nginx és nincs root (pl. Pterodactyl):** a szerver maga tud HTTPS-t kiszolgálni. Útmutató: [DEPLOY-PTERODACTYL.md](DEPLOY-PTERODACTYL.md).
