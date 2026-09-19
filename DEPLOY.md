# Impix élesítése: impix.hu

| Cím | Hova mutat | Mit szolgál ki |
|---|---|---|
| `https://www.impix.hu` (és `impix.hu`) | GitHub Pages | a weboldal (`public/` mappa) |
| `https://api.impix.hu` | a VPS (Ubuntu 24.04) | a Node szerver: API, adatbázis, feltöltött videók |

Sorrend: **1. DNS → 2. VPS → 3. GitHub → 4. Ellenőrzés**

---

## 1. DNS a Rackhostnál

A Rackhost ügyfélfelületén a `impix.hu` domain DNS-beállításainál vedd fel az alábbi rekordokat.
A `@`, `www` és `api` név alatt korábban lévő rekordokat (Rackhost tárhely, parkoló oldal) **töröld**, különben ütköznek.

| Típus | Név (host) | Érték |
|---|---|---|
| A | `api` | *a VPS IPv4-címe* |
| CNAME | `www` | `imperiu4s.github.io` |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

- A GitHub Pages IP-címeit a GitHub dokumentációja szerint ellenőrizd:
  <https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>
- Ha a VPS-nek IPv6-címe is van, felvehetsz `AAAA` rekordot is az `api` névre.
- A DNS terjedése percektől akár órákig tarthat. Ellenőrzés: `nslookup api.impix.hu`

---

## 2. VPS (Ubuntu 24.04)

Lépj be SSH-val, és futtasd (a repó nyilvános, ezért a klónozáshoz nem kell jelszó):

```bash
git clone https://github.com/Imperiu4s/impix.git /tmp/impix-install
sudo bash /tmp/impix-install/deploy/install.sh
```

A szkript:
- telepíti az nginx-et, a certbotot, a gitet és a Node.js 22-t,
- létrehozza az `impix` rendszerfelhasználót, a kódot az `/opt/impix` mappába teszi,
- létrehozza a `/etc/impix.env` beállításfájlt, és **kiírja a generált admin jelszót** (jegyezd fel!),
- elindítja az `impix` systemd szolgáltatást, és beállítja az nginx-et.

Miután az `api.impix.hu` már erre a szerverre mutat a DNS-ben, kérd le a HTTPS tanúsítványt:

```bash
sudo certbot --nginx -d api.impix.hu
```

A certbot magától átírja az nginx-konfigot, és beállítja az automatikus megújítást.

Ellenőrzés: a böngészőben a `https://api.impix.hu/api/plans` cím JSON-t ad a csomagokkal.

**Tűzfal (ajánlott).** Csak az SSH, a HTTP és a HTTPS legyen nyitva. Ha az SSH nem a 22-es porton fut, előbb azt engedélyezd!

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### Hol vannak az adatok?
- Adatbázis, feltöltött videók, titkos kulcs: `/var/lib/impix/`
- Beállítások: `/etc/impix.env` (a `CORS_ORIGINS` sor már tartalmazza az `impix.hu` címeket)
- Naplók: `journalctl -u impix -f`

### Frissítés
```bash
sudo bash /opt/impix/deploy/update.sh
```

### Mentés
Az adatbázis és a videók a `/var/lib/impix` mappában vannak. A legbiztosabb a VPS-szolgáltató pillanatfelvétele (snapshot).
Kézi mentéshez állítsd le a szolgáltatást a másolás idejére: `sudo systemctl stop impix`, másolás, `sudo systemctl start impix`.

---

## 3. GitHub (`Imperiu4s/impix`)

1. Töltsd fel a kódot a helyi gépedről:
   ```bash
   git push -u origin main
   ```
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**
3. **Settings → Secrets and variables → Actions → Variables → New repository variable**
   - Name: `IMPIX_API_URL`
   - Value: `https://api.impix.hu`
4. Az **Actions** fülön indítsd el kézzel a „Weboldal kitétele GitHub Pagesre" munkafolyamatot (vagy push-old újra a `public/` mappát).
5. **Settings → Pages → Custom domain**: `www.impix.hu` → **Save**. A DNS-ellenőrzés után pipáld be az **Enforce HTTPS** opciót
   (a tanúsítványt a GitHub adja, az első alkalommal akár egy órát is igénybe vehet).
6. Ajánlott: **Domain ellenőrzés**. GitHub-fiók *Settings → Pages → Add a domain* → `impix.hu`, a megadott TXT rekordot vedd fel a Rackhostnál.
   Ez megakadályozza, hogy más átvegye a domainedet.

> **Fontos:** az ingyenes GitHub Pageshez a repónak **nyilvánosnak** kell lennie. A kód látható lesz, titkot viszont nem tartalmaz
> (jelszavak és kulcsok a szerveren, a `/etc/impix.env` és a `/var/lib/impix` mappában vannak).

---

## 4. Ellenőrzés

1. `https://www.impix.hu` betölt (lakat ikonnal).
2. Regisztráció, belépés, csomag választása működik.
3. Admin belépés a telepítéskor kapott adatokkal → Admin panel → feltöltés próba egy kis videóval.

## Hibaelhárítás

| Tünet | Valószínű ok |
|---|---|
| Az oldalon „Failed to fetch" / hálózati hiba | Az `IMPIX_API_URL` hiányzik vagy hibás, vagy a `CORS_ORIGINS` (`/etc/impix.env`) nem tartalmazza az oldal címét. Módosítás után: `sudo systemctl restart impix` |
| 502 Bad Gateway az `api.impix.hu`-n | A Node nem fut: `sudo systemctl status impix`, `journalctl -u impix -n 50` |
| Videófeltöltés „413" hibával elakad | nginx `client_max_body_size` (be van állítva 2100 MB-ra), vagy nagyobb a fájl, mint a `MAX_UPLOAD_MB` |
| Az Actions hibával áll le: „Hiányzik az IMPIX_API_URL" | A 3. lépés 3. pontja kimaradt |
| A tanúsítványkérés (certbot) elbukik | Az `api.impix.hu` DNS még nem a VPS-re mutat, vagy a 80-as port zárva van |
| Elfelejtett admin jelszó | `cd /opt/impix && sudo -u impix IMPIX_DB=/var/lib/impix/impix.db node scripts/create-admin.js te@example.com uj-jelszo-123` |
