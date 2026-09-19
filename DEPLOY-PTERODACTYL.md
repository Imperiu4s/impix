# Impix Pterodactyl-tárhelyen: HTTPS a Node szerveren

Ha a szerver olyan tárhelyen fut, ahol nincs nginx és nincs root (pl. Pterodactyl panel), a Node szerver **maga szolgál ki HTTPS-t**.
Az API címe így `https://api.impix.hu:PORT` lesz (a PORT a panel *Network* fülén látható kiosztott port). A látogatók ezt nem látják.

A tanúsítvány ingyenes (Let's Encrypt), kb. **90 napig érvényes**, és kézzel kell megújítani (lásd lent). Az admin panel az utolsó
21 napban figyelmeztet.

## 1. DNS a Rackhostnál

| Típus | Név | Érték |
|---|---|---|
| A | `api` | a szerver IP-címe (a panel *Network* fülén) |

(A GitHub Pages rekordok – `@` A rekordok és `www` CNAME – a `DEPLOY.md` szerint már megvannak.)

## 2. Tanúsítvány kérése – a saját gépeden

1. Nyisd meg a projekt `tools/get-cert` mappáját, és **kattints duplán a `get-cert.bat` fájlra**.
   (Első futásnál letölti a szükséges csomagot. Node.js kell hozzá a gépeden.)
2. Add meg a domaint (`api.impix.hu`) és az e-mail címedet.
3. A program kiír egy **TXT rekordot**. Vedd fel a Rackhost DNS-kezelőjében:
   - Típus: `TXT`
   - Név: `_acme-challenge.api`
   - Érték: amit a program kiírt
4. Nyomj Entert. A program megvárja, míg a rekord terjed (pár perc), és elkéri a tanúsítványt.
5. Az eredmény a projekt **`tls`** mappájába kerül: `fullchain.pem` és `privkey.pem`.
   A TXT rekordot utána törölheted.

> A `privkey.pem` **titkos**. Ne tedd GitHubra és senkinek ne add oda. (A `tls/` mappát a `.gitignore` kizárja.)

## 3. Feltöltés a szerverre

A szerveren a `server.js` mellett hozz létre egy **`tls`** mappát, és töltsd fel bele:

```
tls/fullchain.pem
tls/privkey.pem
```

Töltsd fel az új **`server.js`** fájlt is (ez tudja a HTTPS-t), majd indítsd újra a szervert.
A konzolon ezt kell látnod: `Impix fut: https://localhost:PORT` és `HTTPS aktív. A tanúsítvány lejár: …`

Ha a fájlok hiányoznak, a szerver figyelmeztetéssel sima HTTP-n indul (csak tesztre jó).

## 4. Ellenőrzés

Böngészőben: `https://api.impix.hu:PORT/api/plans` → JSON-t kell látnod a csomagokkal, lakat ikonnal, tanúsítványhiba nélkül.

## 5. GitHub

- **Settings → Secrets and variables → Actions → Variables** → `IMPIX_API_URL` = `https://api.impix.hu:PORT`
  (a porttal együtt, záró perjel nélkül)
- Az Actions fülön futtasd újra a „Weboldal kitétele GitHub Pagesre" munkafolyamatot.
- A szerver `.env` fájljában a `CORS_ORIGINS` tartalmazza az oldal címét (`https://impix.hu`, `https://www.impix.hu`).

## Megújítás (kb. 60–80 naponként)

1. `tools/get-cert/get-cert.bat` (2. lépés ugyanígy).
2. Az új `tls/fullchain.pem` és `tls/privkey.pem` fájlokat töltsd fel a szerver `tls` mappájába (felülírva a régieket).
3. **Újraindítás nem kell.** A szerver percenként ellenőrzi a fájlokat, és átveszi az újat. Ha csak az egyik fájl érkezett meg, a
   régi tanúsítványt tartja meg, amíg a pár teljes nem lesz.

## Hibaelhárítás

| Tünet | Ok |
|---|---|
| A böngésző nem éri el a `https://api.impix.hu:PORT` címet | A port nincs kinyitva a szolgáltatónál, vagy az `api` A rekord még nem terjedt el |
| „Nem biztonságos a kapcsolat" | A tanúsítvány lejárt, vagy nem a `api.impix.hu`-ra szól |
| A `get-cert` nem találja a TXT rekordot | Rossz a Név mező: a Rackhost általában csak `_acme-challenge.api`-t kér, nem a teljes domaint |
| A szerver induláskor „a HTTPS tanúsítvány nem tölthető be" hibával leáll | A `fullchain.pem` és a `privkey.pem` nem egy párhoz tartozik, vagy hibás a fájl. Futtasd újra a `get-cert.bat`-ot |
