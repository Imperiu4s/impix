# Bankkártyás fizetés Stripe-pal

Az Impix előfizetései a **Stripe**-on keresztül fizethetők: havi, automatikusan megújuló előfizetés. A kártyaadatokat a Stripe
kezeli (a felhasználó a Stripe biztonságos fizetési oldalán fizet), a mi szerverünk azokat soha nem látja és nem tárolja.

## Hogyan működik

| Helyzet | Mi történik |
|---|---|
| Felhasználó előfizet | A Stripe fizetési oldalára kerül, fizet, visszatér az oldalra, és az előfizetése azonnal aktív |
| Hónap vége | A Stripe automatikusan levonja a díjat, az előfizetés megújul |
| Sikertelen fizetés | A hozzáférés nem hosszabbodik, a Stripe újrapróbálja a levonást |
| Lemondás | A kifizetett időszak végéig marad a hozzáférés, utána nem újul meg és nem terhelik a kártyát |
| Csomagváltás | **Aktív előfizetés mellett nem lehet.** Előbb le kell mondani. Lemondás után az új csomag **azonnal indul**, a régi hátralévő napjai elvesznek (a régi Stripe előfizetés is megszűnik, dupla számlázás nincs) |
| Lemondás visszavonása | Azonos csomagnál fizetés nélkül, egy kattintással |
| Kártya módosítása, számlák | A „Számlázás kezelése" gomb a Stripe ügyfélportáljára visz |

**Amit a csomag ténylegesen ad** (a szerver kényszeríti ki, nem csak kiírja):
- **Minőség:** Alap legfeljebb 720p, Standard 1080p, Prémium 4K. A videóhoz az admin három változatot adhat meg (alap 720p,
  Full HD, 4K). A felhasználó a csomagja határáig elérhető legjobbat kapja, a magasabb minőségű változat linkje **ki sem megy** a szerverről.
- **Képernyők:** Alap 1, Standard 2, Prémium 4 egyidejű lejátszás. Ha elfogyott a hely, a lejátszás nem indul el.

## Beállítás lépésről lépésre

### 1. Stripe fiók
1. Regisztrálj a <https://stripe.com> oldalon (Magyarország támogatott).
2. **Teszt módban azonnal dolgozhatsz**, valódi fizetéshez a Stripe kéri a cég/egyéni vállalkozó adatait és a bankszámlát.

### 2. API kulcs
Stripe irányítópult → **Fejlesztők → API-kulcsok** → **Titkos kulcs** (`sk_test_…` teszt módban, `sk_live_…` élesben).

A szerver `.env` fájljába (a `server.js` mellé, **ne GitHubra**):

```
STRIPE_SECRET_KEY=sk_test_ide_a_kulcsod
SITE_URL=https://impix.hu
```

A `SITE_URL` a weboldal címe (záró perjel nélkül): ide tér vissza a felhasználó a fizetés után.
Kulcs nélkül a fizetés ki van kapcsolva, és az admin panelen piros figyelmeztetés jelenik meg.

### 3. Webhook (ajánlott)
Stripe irányítópult → **Fejlesztők → Webhookok → Végpont hozzáadása**:
- **URL:** `https://api.impix.hu:PORT/api/stripe/webhook` (a PORT a szerver kiosztott portja)
- **Események:** `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- A létrehozás után másold ki a **Aláíró titkot** (`whsec_…`), és add a `.env` fájlhoz:

```
STRIPE_WEBHOOK_SECRET=whsec_ide_a_titok
```

> A Stripe csak „nyilvánosan elérhető HTTPS" címet ígér. Hogy a nem szabványos port (pl. `:25573`) működik-e, azt nem tudtam
> ellenőrizni. **Ha a webhook nem érkezik meg, semmi sem romlik el**: a szerver fizetés után, és utána a felhasználó használata
> közben (15 percenként, lejárat közelében 2 percenként) maga is lekérdezi a Stripe-ot, így a megújulás, a lemondás és a bukott
> fizetés webhook nélkül is helyesen frissül. A webhook csak azonnalivá teszi.

### 4. Ügyfélportál (a „Számlázás kezelése" gombhoz)
Stripe irányítópult → **Beállítások → Billing → Ügyfélportál** → **Aktiválás**. Engedélyezd a fizetési mód módosítását és a
számlák megtekintését. Teszt és éles módban külön kell beállítani.

### 5. Feltöltés a szerverre
A következő fájlokat töltsd fel: `server.js`, `db.js`, `billing.js` (új), `package.json`, `package-lock.json`, `public/` és a `.env`
(a fentiekkel bővítve). A Pterodactyl induláskor lefuttatja az `npm install`-t, így a `stripe` csomag magától telepszik.
Az adatbázis (`data/`) a következő indításkor **magától átalakul**, a meglévő adataid megmaradnak.

## Kipróbálás teszt módban

Teszt kártyaszámok (bármilyen jövőbeli lejárati dátum, bármilyen CVC):

| Kártya | Eredmény |
|---|---|
| `4242 4242 4242 4242` | sikeres fizetés |
| `4000 0000 0000 0002` | elutasított kártya |
| `4000 0025 0000 3155` | 3D Secure jóváhagyást kér |

A megújulás gyors kipróbálásához a Stripe **teszt óra** (test clock) funkcióját használd.

## Élesítés

1. Stripe: végezd el a fiók aktiválását.
2. Cseréld a `.env`-ben `STRIPE_SECRET_KEY` értékét `sk_live_…` kulcsra.
3. Hozd létre a webhookot és az ügyfélportált **élő módban is** (külön `whsec_…` titok jár hozzá), és frissítsd a `STRIPE_WEBHOOK_SECRET`-et.
4. Indítsd újra a szervert. Az admin panelről eltűnik a „TESZT mód" figyelmeztetés.

A csomagok árait a Stripe-ban az Impix magától hozza létre (termék + havi ár, **forintban**). Ha az admin panelen megváltoztatod egy csomag
árát, az új ár az **új vásárlókra** vonatkozik, a meglévő előfizetők a régi áron maradnak. A legkisebb ár 175 Ft (a Stripe minimuma).

## Meglévő előfizetők

A korábbi, ingyenes (demó) vagy az admin által adott előfizetések a lejáratukig érvényesek. Utána a felhasználónak a Stripe-on kell
újra előfizetnie. Ezeket lemondani is lehet, csomagot váltani pedig csak lemondás után.

## Admin

- A **Stripe-os előfizetéseknél** az admin csak megszüntetheti vagy törölheti az előfizetést (ilyenkor a Stripe-ban is leáll a
  számlázás). Időt adni, csomagot cserélni vagy lejáratot módosítani nem lehet, mert azt a Stripe kezeli.
- **Felhasználó törlésekor** a Stripe előfizetése is megszűnik. Ha ez nem sikerül, a fiók nem törlődik (különben a számlázás folytatódna).
- Az admin által adott ("ingyen") előfizetés továbbra is működik, és külön jelölve van a listában.

## Jogi és pénzügyi tudnivalók (ez nem jogi tanács)

Bankkártyás értékesítés előtt érdemes tisztázni: általános szerződési feltételek (ÁSZF), adatkezelési tájékoztató, a fogyasztót
megillető elállási jog digitális szolgáltatásnál, valamint a számlázás (a Stripe nyugtát/számlát küld, de a magyar
adózás szerinti számla kiállítása külön számlázóprogramot igényelhet). Ezekben kérdezd meg a könyvelődet vagy egy jogászt.

## Fejlesztéshez

`DEMO_PAYMENTS=1` mellett, Stripe kulcs nélkül, ingyenes teszt előfizetés adható. **Éles oldalon ne kapcsold be**, mert bárki ingyen
előfizethetne (az admin panelen figyelmeztetés jelenik meg, ha be van kapcsolva).
