'use strict';

/* ==========================================================
   Impix – jogi szövegek: ÁSZF, Adatkezelési tájékoztató, Impresszum

   FIGYELEM: ez sablon, nem jogi tanács. Éles használat előtt egyeztesd jogásszal / adatvédelmi szakértővel és a könyvelőddel,
   mert a szövegnek a te tényleges vállalkozási formádhoz, adózási helyzetedhez és működésedhez kell igazodnia.

   A szövegben {{név}} helyőrzők vannak: ezeket az oldal a szerver /api/legal végpontjából tölti ki (a szerver .env fájljából:
   SELLER_NAME, SELLER_ADDRESS, SELLER_TAX_ID, SELLER_EMAIL, SELLER_PHONE, SELLER_REG_NUMBER, HOSTING_NAME, …).
   A `body` tömb elemei: szöveg (bekezdés), vagy tömb (felsorolás). A **kiemelés** félkövér lesz.
   ========================================================== */

window.IMPIX_LEGAL = {

  // =====================================================================================
  terms: {
    title: 'Általános Szerződési Feltételek (ÁSZF)',
    lead: 'Az Impix online filmes és sorozatos szolgáltatás igénybevételének feltételei. Kérjük, a regisztráció és az előfizetés előtt figyelmesen olvasd el.',
    sections: [
      { h: '1. A szolgáltató adatai és az ÁSZF hatálya', body: [
        'Jelen Általános Szerződési Feltételek (a továbbiakban: **ÁSZF**) az alábbi szolgáltató (a továbbiakban: **Szolgáltató**) és az Impix szolgáltatást igénybe vevő természetes vagy jogi személy (a továbbiakban: **Felhasználó**) közötti jogviszony feltételeit szabályozzák.',
        ['**Szolgáltató neve:** {{name}}', '**Székhelye / levelezési címe:** {{address}}', '**Adószáma:** {{taxId}}', '**Nyilvántartási száma:** {{regNumber}} ({{regLabel}})', '**E-mail címe:** {{email}}', '**Telefonszáma:** {{phone}}', '**A szolgáltatás weboldala:** {{siteUrl}}', '**Tárhelyszolgáltató:** {{hostingName}}, {{hostingAddress}}, {{hostingEmail}}'],
        'Az ÁSZF hatálya kiterjed az Impix weboldalon (a továbbiakban: **Weboldal**) elérhető valamennyi szolgáltatásra, így különösen a regisztrációra, az előfizetésre, a filmek és sorozatok megtekintésére, a kedvencek kezelésére és az ajánlások beküldésére.',
        'Az ÁSZF a Felhasználóval kötött szerződés részévé válik. A Szolgáltató a jelen ÁSZF-ben nem szabályozott kérdésekben a magyar jogszabályok, különösen a Polgári Törvénykönyv (2013. évi V. törvény), az elektronikus kereskedelmi szolgáltatások, az információs társadalommal összefüggő szolgáltatások egyes kérdéseiről szóló 2001. évi CVIII. törvény, a fogyasztóvédelemről szóló 1997. évi CLV. törvény, a fogyasztó és a vállalkozás közötti szerződések részletes szabályairól szóló 45/2014. (II. 26.) Korm. rendelet, valamint a digitális tartalom és digitális szolgáltatás nyújtására irányuló szerződésekről szóló 373/2021. (VI. 30.) Korm. rendelet rendelkezései szerint jár el.',
      ] },

      { h: '2. Fogalmak', body: [[
        '**Szolgáltatás:** az Impix által nyújtott, interneten keresztül elérhető filmes és sorozatos tartalomszolgáltatás (streaming).',
        '**Fiók:** a Felhasználó regisztrációval létrehozott, személyes hozzáférése a Weboldalhoz.',
        '**Csomag:** a Szolgáltató által meghirdetett előfizetési konstrukció, amely meghatározza a havi díjat, a legmagasabb elérhető képminőséget és az egyidejűleg használható képernyők számát.',
        '**Előfizetés:** a Felhasználó által megvásárolt, meghatározott időszakra szóló, havonta megújuló hozzáférés a kiválasztott Csomaghoz.',
        '**Tartalom:** a Weboldalon elérhető filmek, sorozatok, epizódok, borítóképek, leírások és minden egyéb, szerzői jogi védelem alatt álló anyag.',
        '**Fogyasztó:** az önálló foglalkozásán és gazdasági tevékenységén kívül eső célból eljáró természetes személy Felhasználó.',
        '**Fizetési szolgáltató:** a bankkártyás fizetést lebonyolító Stripe Payments Europe, Limited (Írország) és kapcsolt vállalkozásai.',
      ]] },

      { h: '3. A szolgáltatás leírása', body: [
        'Az Impix előfizetéses tartalomszolgáltatás: a Felhasználó érvényes Előfizetés esetén a Weboldalon elérhető filmeket és sorozatokat böngészheti, kereshet közöttük, kedvencei közé mentheti őket, és megtekintheti azokat a saját eszközén, a Csomagja által megengedett minőségben és képernyőszámmal.',
        'A Csomagok főbb jellemzői (az aktuális árakat és tartalmat a Csomagok oldal mutatja):',
        ['**Alap:** legfeljebb HD (720p) képminőség, 1 egyidejű képernyő.', '**Standard:** legfeljebb Full HD (1080p) képminőség, 2 egyidejű képernyő.', '**Prémium:** legfeljebb Ultra HD (4K) képminőség, 4 egyidejű képernyő.'],
        'A ténylegesen elérhető képminőség függ attól is, hogy az adott tartalomból a Szolgáltató milyen minőségű változatot tett közzé, valamint a Felhasználó internetkapcsolatától és eszközétől. Ha egy tartalom nem érhető el a Csomag szerinti legjobb minőségben, a Felhasználó a rendelkezésre álló legjobb, a Csomagja által megengedett változatot kapja.',
        'A Szolgáltató a kínálatot folyamatosan alakítja: Tartalmakat vehet fel, módosíthat vagy távolíthat el (például a jogosultsági szerződések lejárta, jogi kifogás vagy technikai ok miatt). A Szolgáltató **nem vállal garanciát** arra, hogy egy adott Tartalom a teljes Előfizetési időszak alatt elérhető marad, és a Szolgáltatás nem tartalmaz meghatározott mennyiségű vagy összetételű kínálatra vonatkozó ígéretet.',
        'Egyes Tartalmak lejátszása külső szolgáltatók (pl. Videa, YouTube, Vimeo) beágyazott lejátszóján keresztül történik. Ezeknél a külső szolgáltató saját feltételei és adatkezelése is vonatkozik a lejátszásra, amelyre a Szolgáltatónak korlátozott ráhatása van. Beágyazott lejátszó esetén a következő rész automatikus indítása és a minőségbeállítás eltérhet.',
      ] },

      { h: '4. Regisztráció és a Fiók', body: [
        'A tartalmak megtekintéséhez regisztráció szükséges. A regisztráció ingyenes; az Előfizetés megvásárlása külön lépés. A regisztráció során a Felhasználó megadja nevét, e-mail címét és jelszavát, és elfogadja jelen ÁSZF-et, valamint az Adatkezelési tájékoztatót.',
        'Szerződést csak cselekvőképes személy köthet. Korlátozottan cselekvőképes (különösen 18 év alatti) személy kizárólag törvényes képviselője beleegyezésével, illetve a törvényes képviselő nevében és felelősségére használhatja a Szolgáltatást és vásárolhat Előfizetést.',
        'A Felhasználó köteles valós adatokat megadni, és azokat naprakészen tartani. A Fiók **személyes**: nem ruházható át, nem értékesíthető, és a Felhasználó nem oszthatja meg a belépési adatait harmadik személlyel. A Fiókhoz tartozó jelszó bizalmas kezeléséért a Felhasználó felel. Ha a Felhasználó a jogosulatlan használat gyanúját észleli, haladéktalanul módosítsa jelszavát, és jelezze a Szolgáltató felé.',
        'Egy e-mail címhez egy Fiók tartozhat. A Szolgáltató jogosult a valótlan adatokkal, jogszabályba vagy jelen ÁSZF-be ütköző módon létrehozott Fiókot korlátozni, felfüggeszteni vagy törölni.',
      ] },

      { h: '5. Az Előfizetés megkötése, a szerződés létrejötte', body: [
        'Előfizetést a bejelentkezett Felhasználó a Csomagok oldalon választott Csomag kiválasztásával, az ÁSZF elfogadásával, a szolgáltatás azonnali megkezdésére vonatkozó nyilatkozat megtételével, majd a fizetési szolgáltató biztonságos felületén végrehajtott bankkártyás fizetéssel vásárolhat.',
        'A vásárlás lépései: (1) Csomag kiválasztása; (2) a szükséges nyilatkozatok elfogadása az Előfizetés oldalon; (3) átirányítás a fizetési szolgáltató oldalára, ahol a Felhasználó megadja számlázási adatait és bankkártyaadatait; (4) a fizetés megerősítése. A bevitt adatok a fizetés véglegesítése előtt a fizetési oldalon ellenőrizhetők és javíthatók; a folyamat a böngésző Vissza gombjával vagy a Mégse gombbal bármikor megszakítható.',
        'A szerződés a **sikeres fizetés visszaigazolásával** jön létre, és attól kezdve az Előfizetés aktív. A szerződés magyar nyelven, elektronikus úton jön létre; nem minősül írásbeli szerződésnek, azt a Szolgáltató külön nem iktatja, de az ÁSZF a Weboldalon bármikor elérhető, és a Felhasználó azt elmentheti vagy kinyomtathatja. A tranzakció adatai (csomag, időszak, összeg, dátum) a Felhasználó Fiók oldalán megtekinthetők.',
        'A Szolgáltató fenntartja a jogot arra, hogy a megrendelést indokolt esetben (például csalás gyanúja, sikertelen fizetés, technikai hiba miatt) visszautasítsa; ilyenkor a már levont összeget haladéktalanul visszatéríti.',
      ] },

      { h: '6. Árak, fizetés, számlázás', body: [
        'A Csomagok árai forintban (HUF), havi díjként szerepelnek a Csomagok oldalon, és **tartalmazzák az általános forgalmi adót** (amennyiben a Szolgáltató ÁFA-köteles; az alanyi adómentes Szolgáltató ÁFA-t nem számláz, erről a számla is tájékoztat). A Szolgáltató a megjelenített áron felül további díjat nem számít fel, a bankkártya-kibocsátó által esetlegesen felszámított költségek (pl. devizaváltás) a Felhasználót terhelik.',
        'A díj **előre fizetendő**, az Előfizetési időszak elején. A bankkártyás fizetést a Fizetési szolgáltató bonyolítja. A Szolgáltató a bankkártyaadatokat nem ismeri meg és nem tárolja. Sikertelen fizetés esetén az Előfizetés nem indul el, illetve nem hosszabbodik meg; a Fizetési szolgáltató a levonást a saját szabályai szerint újra megkísérelheti.',
        'A Szolgáltató a kifizetett díjról **számlát** állít ki, amelyet a Felhasználó a Fiók oldalon elektronikus (PDF) formában tölthet le. A számla a Felhasználó által a fizetési oldalon megadott számlázási névre és címre szól; ezek helyességéért a Felhasználó felel. A számlák a Szolgáltató könyvelési kötelezettsége miatt a Fiók törlése után is megőrzésre kerülnek. Az elektronikus számla elfogadásával a Felhasználó egyetért.',
        'Árváltozás esetén az új ár az újonnan vásárolt Előfizetésekre vonatkozik. A folyamatban lévő Előfizetés díját a Szolgáltató az adott Előfizetés fennállása alatt nem emeli. Ha a Szolgáltató a meglévő előfizetők díját mégis módosítani kívánja, azt legalább **30 nappal** a hatálybalépés előtt közli, és a Felhasználó a módosítás hatálybalépése előtt díjmentesen lemondhatja az Előfizetést.',
      ] },

      { h: '7. Automatikus megújulás és lemondás', body: [
        'Az Előfizetés **havonta automatikusan megújul**, és a Felhasználó bankkártyáját a Fizetési szolgáltató a megújulás napján terheli az aktuális havi díjjal, amíg a Felhasználó az Előfizetést le nem mondja. A Felhasználót az Előfizetés vásárlása előtt és a Fiók oldalon a Szolgáltató kiemelten tájékoztatja az automatikus megújulásról. Az admin által ajándékként vagy kézzel adott előfizetés nem újul meg automatikusan.',
        'A Felhasználó az Előfizetést **bármikor lemondhatja** a Fiók oldalon a „Lemondás” gombbal vagy a „Számlázás kezelése” felületen. A lemondás a jövőbeli megújulást állítja le: a Felhasználó a már kifizetett Előfizetési időszak végéig továbbra is használhatja a Szolgáltatást, azt követően a hozzáférése megszűnik, és további díjat nem kell fizetnie. A lemondás az Előfizetési időszak lejárta előtt visszavonható, ha az azonos Csomagra vonatkozik.',
        'A már megkezdett Előfizetési időszak díja – a jogszabályi kötelezettségek és a 9. pontban foglaltak kivételével – nem jár vissza időarányosan.',
        'Az Előfizetés lejártakor (vagy megszüntetésekor) a hozzáférés **azonnal megszűnik**: a Felhasználó nem tekintheti meg a Tartalmakat, és az oldalon csak a Csomagok és a Fiók érhető el, amíg új Előfizetést nem vásárol.',
      ] },

      { h: '8. Csomagváltás', body: [
        'Aktív Előfizetés mellett másik Csomag nem vásárolható. Csomagváltáshoz a Felhasználónak előbb le kell mondania a jelenlegi Előfizetést.',
        'Lemondás után új Csomag vásárlása esetén az **új Csomag azonnal indul** és az új díj fizetendő, a korábbi Előfizetés még hátralévő napjai elvesznek, és megtérítésre nem kerülnek. Erről a Szolgáltató a vásárlás előtt külön figyelmezteti a Felhasználót. A korábbi Előfizetés díjfizetése ilyenkor megszűnik, párhuzamos számlázás nem történik.',
      ] },

      { h: '9. Elállási jog (tájékoztatás Fogyasztók részére)', body: [
        'A Fogyasztót a 45/2014. (II. 26.) Korm. rendelet szerint főszabályként megilleti az a jog, hogy a távollévők között kötött szerződéstől **indokolás nélkül, a szerződés megkötésétől számított 14 napon belül elálljon**. Elállási szándékát a Fogyasztó egyértelmű nyilatkozattal közölheti a Szolgáltató 1. pontban megadott elérhetőségén (e-mailben vagy postai úton). Használhatja az alábbi mintát is, de ez nem kötelező.',
        '**A szolgáltatás azonnali megkezdése.** Az Előfizetés vásárlásakor a Felhasználó kifejezetten kéri, hogy a Szolgáltatás teljesítése az elállási határidő lejárta előtt, azonnal megkezdődjön. A Fogyasztó a vásárláskor (külön jelölőnégyzet bejelölésével) kifejezetten tudomásul veszi, hogy ha a Szolgáltatás nyújtása az ő kifejezett előzetes hozzájárulásával megkezdődött, akkor a szolgáltatás teljes teljesítését követően elveszíti az elállási jogát.',
        'Ha a Fogyasztó a teljesítés megkezdése után, a határidőn belül él az elállási jogával, a Szolgáltató a kapott díjat az elállásról szóló értesítés kézhezvételétől számított 14 napon belül visszatéríti, azonban a Fogyasztó köteles megfizetni a szolgáltatásnak az elállási nyilatkozat közléséig igénybe vett részével arányos díjat. A visszatérítés ugyanazon fizetési móddal történik, amelyet a Fogyasztó az eredeti tranzakcióhoz használt, kivéve, ha a Fogyasztó kifejezetten más módot kér.',
        'A jogi személy és az önálló foglalkozása vagy gazdasági tevékenysége körében eljáró Felhasználót az elállási jog nem illeti meg.',
        '**Elállási nyilatkozat-minta:** „Alulírott, {a Felhasználó neve}, {e-mail címe}, kijelentem, hogy gyakorlom elállási jogomat az Impix {a Csomag neve} előfizetésre vonatkozó szerződés tekintetében. A szerződés megkötésének dátuma: {dátum}. Kelt: {dátum}. {aláírás, ha papíron küldi}”.',
      ] },

      { h: '10. A Szolgáltatás használatának szabályai', body: [
        'A Szolgáltatás kizárólag **személyes, nem kereskedelmi célú** felhasználásra szolgál. A Felhasználó a Szolgáltatás használata során köteles a jogszabályokat és jelen ÁSZF-et betartani. Tilos különösen:',
        ['a Tartalmak letöltése, rögzítése, másolása, közvetítése, nyilvános előadása, továbbértékesítése vagy bármilyen más módon történő terjesztése;', 'a Weboldal védelmi, hozzáférés-korlátozási vagy másolásvédelmi megoldásainak megkerülése, visszafejtése, vagy erre irányuló kísérlet;', 'automatizált eszközzel (robot, scraper) adatok gyűjtése a Weboldalról;', 'a Fiók megosztása, továbbadása; a Csomag által megengedett egyidejű képernyőszám túllépése;', 'a Weboldal vagy a szerverek működésének megzavarása, túlterhelése, jogosulatlan hozzáférés megszerzése;', 'jogsértő, sértő vagy valótlan tartalom beküldése az ajánlás funkcióban.'],
        'A Szolgáltató a szabályok megsértése esetén jogosult a Felhasználó hozzáférését korlátozni (például a lejátszást megtagadni), a Fiókot felfüggeszteni vagy megszüntetni. Súlyos vagy ismételt szabályszegés esetén a Szolgáltató az Előfizetést díjvisszatérítés nélkül megszüntetheti, a jogszabályi kötelezettségek sérelme nélkül. A Szolgáltató a felmerült kárának megtérítését is követelheti.',
        'A Weboldal technikai védelmi megoldásai (például a jobb kattintás vagy a fejlesztői eszközök tiltása) elrettentő jellegűek, jelenlétük a Felhasználó jogszerű felhasználási körét nem tágítja.',
      ] },

      { h: '11. Szerzői jog, a Tartalmak, ajánlások', body: [
        'A Weboldal, a szoftver, a grafikai elemek, az „Impix” név és logó, valamint a Tartalmak a Szolgáltató vagy a jogosultak szerzői jogi és egyéb védelme alatt állnak. A Felhasználó az Előfizetés időtartama alatt kizárólag a Tartalmak személyes megtekintésére kap korlátozott, nem kizárólagos, nem átruházható felhasználási jogot. Ezen túlmenően semmilyen jog nem száll át a Felhasználóra.',
        'A Felhasználó az **ajánlás** funkción keresztül filmet vagy sorozatot ajánlhat a Szolgáltatónak. Az ajánlás nem minősül megrendelésnek, és a Szolgáltató nem köteles azt teljesíteni vagy megválaszolni. A Felhasználó az ajánlásban csak olyan információt adhat meg, amelyet jogosult megosztani. A Szolgáltató az ajánlásokat az adatkezelési tájékoztatóban leírtak szerint kezeli.',
        'Ha valaki úgy ítéli meg, hogy a Weboldalon elérhető Tartalom megsérti a jogait (különösen a szerzői jogait), kérjük, jelezze a Szolgáltató e-mail címén, megjelölve a Tartalmat, a jogosultságát és az elérhetőségét. A Szolgáltató a megalapozott bejelentés alapján a Tartalmat haladéktalanul elérhetetlenné teszi, és a vonatkozó jogszabályok (különösen a 2001. évi CVIII. törvény 13. §-a) szerint jár el.',
      ] },

      { h: '12. Korhatár-besorolás, kiskorúak védelme', body: [
        'A Tartalmak mellett a Szolgáltató megjeleníti az ajánlott korhatárt (korhatár nélkül, 6, 12, 16 vagy 18 év). A besorolás tájékoztató jellegű. A kiskorúak által megtekintett Tartalmakért, valamint a Fiók kiskorúak általi használatáért a törvényes képviselő felelős. A Szolgáltató jelenleg nem kínál külön gyermekprofilt vagy szülői felügyeleti beállítást.',
      ] },

      { h: '13. Rendelkezésre állás, karbantartás, technikai feltételek', body: [
        'A Szolgáltató törekszik a Szolgáltatás folyamatos elérhetőségére, de **nem garantálja a megszakítás nélküli működést**. A Szolgáltatás átmenetileg szünetelhet karbantartás, fejlesztés, biztonsági beavatkozás, harmadik fél (pl. tárhely-, hálózati vagy fizetési szolgáltató) hibája vagy elháríthatatlan külső ok miatt. A tervezhető karbantartásról a Szolgáltató lehetőség szerint előre tájékoztat.',
        'A Szolgáltatás használatához internetkapcsolat, modern böngésző (aktív JavaScript-tel) és a videó lejátszására alkalmas eszköz szükséges. A Felhasználó felel az ehhez szükséges eszközök és kapcsolat biztosításáért és költségeiért (pl. adatforgalmi díj).',
      ] },

      { h: '14. Szavatosság, hibás teljesítés', body: [
        'A Szolgáltató a digitális szolgáltatás nyújtására irányuló szerződés teljesítéséért a vonatkozó jogszabályok (különösen a Polgári Törvénykönyv és a 373/2021. (VI. 30.) Korm. rendelet) szerint felel. A Szolgáltatás akkor hibás, ha nem felel meg a szerződésben vagy a jogszabályban meghatározott követelményeknek.',
        'Hibás teljesítés esetén a Felhasználó elsősorban a Szolgáltatás szerződésszerű állapotának helyreállítását kérheti. Ha a helyreállítás nem lehetséges, aránytalan költséggel járna, vagy a Szolgáltató nem végzi el megfelelő határidőn belül, a Felhasználó a díj arányos csökkentésére vagy – a hiba súlyosságától függően – a szerződés felmondására jogosult. A Fogyasztót megillető törvényes jogok ezen ÁSZF által nem korlátozhatók.',
        'Hibabejelentést a Felhasználó a Szolgáltató 1. pontban megadott e-mail címén tehet. A bejelentésben kérjük megadni a hiba leírását, az eszközt és böngészőt, valamint a Tartalom címét, hogy a Szolgáltató a hibát gyorsan azonosítani tudja.',
      ] },

      { h: '15. Felelősség', body: [
        'A Szolgáltató a Szolgáltatás nyújtásáért a jogszabályok szerint felel. A Szolgáltató nem felel a Felhasználó eszközének vagy internetkapcsolatának hibájából, a Felhasználó jogszabályba vagy jelen ÁSZF-be ütköző magatartásából, harmadik fél (pl. külső videószolgáltató, fizetési szolgáltató, internetszolgáltató) működéséből, valamint elháríthatatlan külső okból eredő károkért.',
        'A felelősség korlátozása vagy kizárása nem vonatkozik a szándékosan okozott, továbbá az emberi életet, testi épséget vagy egészséget megkárosító szerződésszegésből eredő kárra, valamint arra, amit jogszabály a Fogyasztóval szemben nem enged korlátozni vagy kizárni.',
        'A Weboldal külső hivatkozásokat és beágyazott tartalmakat tartalmazhat. A Szolgáltató ezek tartalmáért, adatkezeléséért nem felel.',
      ] },

      { h: '16. Adatvédelem', body: [
        'A Szolgáltató a Felhasználó személyes adatait az **Adatkezelési tájékoztatóban** foglaltak szerint kezeli, amely a Weboldalon az ÁSZF mellett bármikor elérhető. A regisztrációval a Felhasználó nyilatkozik, hogy az Adatkezelési tájékoztatót megismerte.',
      ] },

      { h: '17. A jogviszony megszűnése', body: [
        'A Felhasználó a Fiókját bármikor megszüntetheti, ehhez kérheti a Fiókja törlését a Szolgáltató e-mail címén. Aktív Előfizetés esetén a törlés az Előfizetés megszűnésével jár, a kifizetett díj a 7. és 9. pont szerint jár vissza. A Fiók törlésekor a Szolgáltató a személyes adatokat az Adatkezelési tájékoztatóban foglaltak szerint törli, kivéve azokat, amelyek megőrzésére jogszabály kötelezi (például számlák).',
        'Az Előfizetés a lejárat pillanatában megszűnik, ha azt a Felhasználó lemondta, vagy ha a díj megújítása nem sikerült. A Szolgáltató a szerződést azonnali hatállyal felmondhatja, ha a Felhasználó a jelen ÁSZF-et súlyosan vagy ismételten megszegi, jogszabályba ütköző cselekményt követ el, vagy a Szolgáltatással visszaél.',
        'Ha a Szolgáltató a szolgáltatás nyújtását megszünteti, azt a Felhasználókkal legalább 30 nappal előre közli, és a már kifizetett, még fel nem használt időszak díját időarányosan visszatéríti.',
      ] },

      { h: '18. Panaszkezelés és jogorvoslati lehetőségek', body: [
        'A Felhasználó panaszát szóban (telefonon) vagy írásban (e-mailben, postai úton) közölheti a Szolgáltatóval az 1. pontban megadott elérhetőségeken. A szóbeli panaszt a Szolgáltató azonnal megvizsgálja és szükség szerint orvosolja. Ha a Felhasználó a panasz kezelésével nem ért egyet, vagy azonnali kivizsgálása nem lehetséges, a Szolgáltató a panaszról és az arra adott álláspontjáról jegyzőkönyvet vesz fel, amelyet három évig megőriz. Az **írásbeli panaszt** a Szolgáltató a beérkezéstől számított **30 napon belül** érdemben megválaszolja. Elutasítás esetén az indokot közli, és tájékoztat a jogorvoslati lehetőségekről.',
        'Ha a Fogyasztó és a Szolgáltató közötti vita nem rendeződik, a Fogyasztó az alábbi lehetőségekkel élhet:',
        ['**Békéltető testület:** a Fogyasztó lakóhelye vagy tartózkodási helye szerint illetékes, a megyei kereskedelmi és iparkamarák mellett működő békéltető testülethez fordulhat (a Szolgáltatónak együttműködési kötelezettsége van). A testületek elérhetősége a békéltető testületek hivatalos jegyzékében található.', '**Fogyasztóvédelmi hatóság:** panasszal fordulhat a lakóhelye szerint illetékes kormányhivatal fogyasztóvédelmi hatóságához.', '**Bírósági eljárás:** a Fogyasztó polgári peres eljárást is kezdeményezhet az illetékes bíróság előtt.'],
      ] },

      { h: '19. Irányadó jog', body: [
        'Jelen ÁSZF-re és a Szolgáltató és a Felhasználó közötti jogviszonyra a **magyar jog** irányadó. Fogyasztó esetén a Fogyasztó szokásos tartózkodási helye szerinti állam kötelező fogyasztóvédelmi rendelkezései is alkalmazandók, ha azok a Fogyasztóra nézve kedvezőbbek. A jogviták elbírálására – jogszabály eltérő rendelkezése hiányában – a magyar bíróságok rendelkeznek joghatósággal.',
      ] },

      { h: '20. Az ÁSZF módosítása', body: [
        'A Szolgáltató jogosult az ÁSZF-et egyoldalúan módosítani, különösen jogszabályváltozás, a Szolgáltatás bővítése vagy módosítása, működési vagy biztonsági okok miatt. A módosításról a Szolgáltató a Weboldalon vagy a Felhasználó e-mail címén a hatálybalépés előtt legalább **15 nappal** tájékoztatja a Felhasználókat.',
        'Ha a Felhasználó a módosítást nem fogadja el, jogosult a hatálybalépés előtt az Előfizetést díjmentesen lemondani, vagy a Fiókja törlését kérni. A hatálybalépést követő továbbhasználat a módosított ÁSZF elfogadásának minősül. A módosítás a már kifizetett időszakra a Felhasználóra nézve hátrányosan nem hat.',
      ] },

      { h: '21. Záró rendelkezések', body: [
        'Ha az ÁSZF bármely rendelkezése érvénytelen vagy végrehajthatatlan, az a többi rendelkezés érvényességét nem érinti. A Szolgáltató nem él azzal a joggal, hogy valamely jogát azonnal gyakorolja, ez nem jelenti arról való lemondást.',
        'Az ÁSZF jelen változata a Weboldalon közzétett napon (**{{version}}**) lép hatályba, és visszavonásig érvényes. A korábbi változatok kérésre elérhetők.',
      ] },
    ],
  },

  // =====================================================================================
  privacy: {
    title: 'Adatkezelési tájékoztató (adatvédelmi nyilatkozat)',
    lead: 'Ebben a tájékoztatóban azt írjuk le, hogy az Impix milyen személyes adatokat kezel, milyen célból és jogalappal, meddig, kinek adja át, és milyen jogaid vannak.',
    sections: [
      { h: '1. Az adatkezelő adatai', body: [
        'A személyes adatok kezelésének a Szolgáltató az adatkezelője:',
        ['**Név:** {{name}}', '**Székhely / levelezési cím:** {{address}}', '**Adószám:** {{taxId}}', '**Nyilvántartási szám:** {{regNumber}} ({{regLabel}})', '**E-mail (adatvédelmi kérdések, kérelmek):** {{email}}', '**Telefon:** {{phone}}', '**Weboldal:** {{siteUrl}}'],
        'Az adatkezelő adatvédelmi tisztviselő kinevezésére a jogszabályok alapján jelenleg nem kötelezett. Adatvédelmi kérdéseiddel és kérelmeiddel a fenti e-mail címen fordulhatsz hozzánk.',
      ] },

      { h: '2. Jogszabályi háttér', body: [
        'Az adatkezelés során az alábbi jogszabályok szerint járunk el:',
        ['az Európai Parlament és a Tanács (EU) 2016/679 rendelete (**GDPR**) a természetes személyeknek a személyes adatok kezelése tekintetében történő védelméről;', 'az információs önrendelkezési jogról és az információszabadságról szóló **2011. évi CXII. törvény** (Infotv.);', 'az elektronikus kereskedelmi szolgáltatások egyes kérdéseiről szóló **2001. évi CVIII. törvény**;', 'az elektronikus hírközlésről szóló **2003. évi C. törvény** (a sütik használatára vonatkozó szabályok);', 'a számvitelről szóló **2000. évi C. törvény** és az általános forgalmi adóról szóló **2007. évi CXXVII. törvény** (számlák, bizonylatok megőrzése);', 'a fogyasztóvédelemről szóló **1997. évi CLV. törvény** (panaszkezelés) és a Polgári Törvénykönyv (**2013. évi V. törvény**).'],
      ] },

      { h: '3. Az adatkezelés alapelvei', body: [
        'Személyes adatot csak meghatározott, egyértelmű és jogszerű célból, a cél megvalósulásához szükséges mértékben és ideig kezelünk. Az adatokat pontosan és naprakészen tartjuk, biztonságos módon tároljuk, és csak annak adjuk át, aki azt a jogszabály alapján vagy a szolgáltatás nyújtásához igényli. Nem használunk profilalkotást, és **nem hozunk kizárólag automatizált döntést**, amely rád nézve joghatással járna.',
      ] },

      { h: '4. A kezelt adatok, az adatkezelés célja, jogalapja és időtartama', body: [
        '**a) Regisztráció, a Fiók működtetése.** Kezelt adatok: név, e-mail cím, jelszó (kizárólag erős, egyirányú kivonat, scrypt hash formájában, a jelszó nem visszafejthető), regisztráció ideje, a beállításaid (téma, kiemelő szín). Cél: a Fiók létrehozása és működtetése, belépés, a szolgáltatás nyújtása. Jogalap: a szerződés teljesítése (GDPR 6. cikk (1) b)). Időtartam: a Fiók törléséig.',
        '**b) Előfizetés és fizetés.** Kezelt adatok: választott Csomag, az Előfizetés kezdete és lejárata, állapota (aktív, lemondott, lejárt), a fizetési előzmények (összeg, időpont, típus), a Fizetési szolgáltató által adott ügyfél- és előfizetés-azonosító. A **bankkártyaadataidat nem ismerjük meg és nem tároljuk**, azokat a Stripe kezeli. Cél: az Előfizetés kezelése, a hozzáférés biztosítása, a díj elszámolása. Jogalap: szerződés teljesítése (6. cikk (1) b)). Időtartam: a Fiók törléséig, a számviteli bizonylatok tekintetében lásd a c) pontot.',
        '**c) Számlázás.** Kezelt adatok: számlázási név és cím (amit a fizetési oldalon megadsz), e-mail cím, a vásárlás tárgya és összege, számlaszám és a kiállítás adatai. Cél: számla kiállítása és a számviteli, adójogi kötelezettségek teljesítése. Jogalap: jogi kötelezettség teljesítése (6. cikk (1) c)), a számvitelről szóló 2000. évi C. törvény és az Áfa tv. alapján. Időtartam: a számviteli törvény szerint **legalább 8 évig**, a Fiók törlése után is.',
        '**d) A Szolgáltatás használata.** Kezelt adatok: kedvencek listája, az általad beküldött ajánlások (cím, típus, link, megjegyzés) és azok állapota, a lejátszás technikai adatai (a lejátszás azonosítója, kezdő és utolsó jelzési időpont, az egyidejű képernyők számának ellenőrzéséhez). Cél: a szolgáltatás nyújtása, a Csomag szerinti képernyőszám betartatása, a visszaélések megelőzése. Jogalap: szerződés teljesítése (6. cikk (1) b)), illetve jogos érdek a Fiók-megosztás és a visszaélések megelőzéséhez (6. cikk (1) f)). Időtartam: a lejátszási adatokat rövid ideig (percekig, legfeljebb a lejátszás befejezéséig) tároljuk; a kedvenceket és az ajánlásokat a Fiók törléséig.',
        '**e) Munkamenet.** Kezelt adatok: a belépéshez tartozó munkamenet-azonosító (az adatbázisban csak titkosított kivonata) és lejárata. Cél: a bejelentkezett állapot fenntartása. Jogalap: szerződés teljesítése és a szolgáltatás biztonsága (6. cikk (1) b) és f)). Időtartam: legfeljebb 30 nap, vagy kijelentkezésig.',
        '**f) Nyilatkozatok naplója.** Kezelt adatok: az ÁSZF és az Adatkezelési tájékoztató elfogadásának, valamint a szolgáltatás azonnali megkezdésére és az elállási jog elvesztésére vonatkozó nyilatkozat tényének időpontja, a szövegek változata és a kapcsolódó Csomag. Cél: a szerződéskötés és a fogyasztóvédelmi tájékoztatási kötelezettségek teljesítésének bizonyítása. Jogalap: jogos érdek (6. cikk (1) f)), illetve jogi kötelezettség. Időtartam: a szerződés megszűnésétől számított 5 évig (általános elévülési idő).',
        '**g) Kapcsolattartás, panaszkezelés.** Kezelt adatok: az általad megadott név, e-mail, a megkeresés és a válasz tartalma, panasz esetén a jegyzőkönyv. Cél: megkeresések, kérelmek, panaszok kezelése. Jogalap: jogi kötelezettség (panasz esetén, Fgytv.), egyébként jogos érdek (6. cikk (1) f)). Időtartam: a panaszról készült jegyzőkönyvet és a válasz másolatát 3 évig, egyéb megkereséseket az ügy lezárását követő legfeljebb 1 évig őrizzük.',
        '**h) Technikai és biztonsági naplók.** A szerver a működés során technikai adatokat (pl. IP-cím, a kérés időpontja és címe, hibaüzenetek) naplózhat. Cél: a szolgáltatás biztonsága, hibaelhárítás, visszaélések felderítése. Jogalap: jogos érdek (6. cikk (1) f)). Időtartam: legfeljebb 30 nap, biztonsági esemény esetén az ügy lezárásáig.',
        'Az adatkezelési célok megvalósításához szükséges adatok megadása a szerződéskötés feltétele. Ha ezeket nem adod meg, a Fiók vagy az Előfizetés nem hozható létre.',
      ] },

      { h: '5. Sütik és hasonló technológiák', body: [
        'A Weboldal kizárólag a működéséhez **feltétlenül szükséges** technológiákat használ, ezért ezekhez az elektronikus hírközlésről szóló törvény szerint külön hozzájárulás nem szükséges:',
        ['**Munkamenet-süti (`impix_sid`)**: a bejelentkezett állapotot tartja fenn, biztonsági beállításokkal (httpOnly), legfeljebb 30 napig érvényes. Ha a weboldal és a szerver külön címen fut, a munkamenet-azonosító a böngésző helyi tárolójában (`impix.token`) tárolódik ugyanezzel a céllal.', '**Beállítások a böngészőben**: a kiválasztott téma és kiemelő szín a böngésző helyi tárolójában is megjelenik, hogy az oldal betöltéskor a helyes megjelenéssel induljon.'],
        'Nem használunk analitikai, marketing vagy hirdetési sütiket, és nem követünk oldalakon átívelően. **Külső szolgáltatók:** ha olyan Tartalmat játszol le, amely külső lejátszót (Videa, YouTube, Vimeo) használ, a lejátszó betöltésekor az adott szolgáltató saját technológiákat (pl. sütiket) helyezhet el, és a saját adatkezelési szabályai szerint kezelheti az adataidat. Erre mi nem gyakorolunk befolyást. A Stripe fizetési oldalán a Stripe sütiket használhat a csalás megelőzése érdekében. A sütiket a böngésződ beállításaiban törölheted vagy tilthatod; a szükséges sütik tiltása esetén a belépés nem működik.',
      ] },

      { h: '6. Adatfeldolgozók és adattovábbítás', body: [
        'A személyes adatokat elsősorban mi kezeljük. A szolgáltatás nyújtásához az alábbi szolgáltatókat vesszük igénybe, akik adatfeldolgozóként vagy önálló adatkezelőként járnak el:',
        ['**Tárhelyszolgáltató (a szerver üzemeltetője):** {{hostingName}}, {{hostingAddress}}. Cél: az alkalmazás és az adatbázis üzemeltetése.', '**GitHub, Inc.** (USA): a weboldal statikus fájljainak kiszolgálása (GitHub Pages). A GitHub a látogatás technikai adatait (pl. IP-cím) a saját szabályai szerint kezelheti.', '**Stripe Payments Europe, Limited** (Írország) és kapcsolt vállalkozásai: a bankkártyás fizetés lebonyolítása, az előfizetés kezelése, csalásmegelőzés. A Stripe egyes célokra (jogi megfelelés, csalásmegelőzés) önálló adatkezelő.', '**Domain- és DNS-szolgáltató:** a weboldal címének (domain) üzemeltetése; személyes adatot a Szolgáltatás tartalmából nem kap.', '**Könyvelő, adótanácsadó:** a számviteli és adókötelezettségek teljesítéséhez a számlák adatai.', '**Külső videószolgáltatók (Videa, YouTube, Vimeo):** csak akkor, ha beágyazott lejátszóval indítasz el egy Tartalmat.'],
        'Az adatfeldolgozók csak az utasításaink szerint, a szolgáltatás nyújtásához szükséges mértékben kezelhetik az adatokat. Az adatokat egyéb harmadik félnek nem adjuk át, kivéve, ha erre jogszabály kötelez (pl. hatósági megkeresés), vagy azt te kéred.',
        '**Harmadik országba történő továbbítás:** egyes szolgáltatók (különösen a GitHub, a Stripe és a Google/YouTube) az Európai Gazdasági Térségen kívül, például az Amerikai Egyesült Államokban is kezelhetnek adatokat. Az ilyen továbbítás megfelelő garanciák (pl. az Európai Bizottság megfelelőségi határozata, az EU–USA adatvédelmi keretrendszer, vagy általános szerződési feltételek) mellett történik.',
      ] },

      { h: '7. Adatbiztonság', body: [
        'A személyes adatok védelme érdekében ésszerű technikai és szervezési intézkedéseket alkalmazunk, többek között:',
        ['a szerver és a weboldal közötti kommunikáció titkosított (HTTPS/TLS);', 'a jelszavakat kizárólag erős, egyirányú kivonat (scrypt) formájában tároljuk;', 'a munkamenet-azonosítókat az adatbázisban kivonatolva tároljuk, és lejáratuk van;', 'a videófájlokhoz aláírt, időben korlátozott hivatkozásokat adunk ki, amelyeket minden kérésnél újra ellenőrzünk;', 'az adminisztrátori funkciók külön jogosultsághoz kötöttek, a kérések eredetét és tartalomtípusát ellenőrizzük;', 'a bankkártyaadatok kezelése teljes egészében a Fizetési szolgáltatónál történik.'],
        'Adatvédelmi incidens esetén a jogszabályok szerint eljárunk: a NAIH-nak az incidenst a tudomásszerzéstől számított 72 órán belül bejelentjük (kivéve, ha az valószínűsíthetően nem jár kockázattal), és ha az incidens magas kockázattal jár, tájékoztatunk az érintetteket is.',
      ] },

      { h: '8. Az érintett jogai', body: [
        'A GDPR alapján az alábbi jogok illetnek meg:',
        ['**Hozzáférés joga (15. cikk):** tájékoztatást kérhetsz arról, hogy kezelünk-e rólad adatot, és kérhetsz másolatot.', '**Helyesbítés joga (16. cikk):** kérheted a pontatlan adatok kijavítását, a hiányos adatok kiegészítését (a nevet a Fiók oldalon magad is módosíthatod).', '**Törlés joga (17. cikk):** kérheted személyes adataid törlését, ha az adatkezelés célja megszűnt, visszavontad a hozzájárulásodat, vagy az adatkezelés jogellenes. A törlési kérelem nem terjed ki azokra az adatokra, amelyek megőrzésére jogszabály kötelez (pl. számlák).', '**Korlátozás joga (18. cikk):** kérheted az adatkezelés korlátozását, például az adat pontosságának vitatása esetén.', '**Adathordozhatóság joga (20. cikk):** a szerződés teljesítésén alapuló, általad megadott adataidat tagolt, géppel olvasható formában megkaphatod.', '**Tiltakozás joga (21. cikk):** a jogos érdeken alapuló adatkezelés ellen tiltakozhatsz.', '**Hozzájárulás visszavonásának joga:** ahol az adatkezelés hozzájáruláson alapul, azt bármikor visszavonhatod, ez a visszavonás előtti adatkezelés jogszerűségét nem érinti.'],
        'A kérelmedet a fenti e-mail címre küldheted. Személyazonosságodat a Fiókodhoz tartozó e-mail címről érkező kérelemmel, vagy szükség esetén más módon ellenőrizzük. A kérelemre indokolatlan késedelem nélkül, de legfeljebb **egy hónapon belül** válaszolunk; ez a határidő szükség esetén, a kérelem összetettsége vagy a kérelmek száma miatt további két hónappal meghosszabbítható, erről és az okáról időben tájékoztatunk. A tájékoztatás és az intézkedés díjmentes, kivéve, ha a kérelem egyértelműen megalapozatlan vagy túlzó.',
      ] },

      { h: '9. Jogorvoslat', body: [
        'Ha úgy látod, hogy személyes adataid kezelése sérti a jogszabályokat, kérjük, előbb fordulj hozzánk, hogy a problémát megoldhassuk. Emellett bármikor panaszt tehetsz a felügyeleti hatóságnál:',
        ['**Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)**', 'Székhely: 1055 Budapest, Falk Miksa utca 9-11.', 'Levelezési cím: 1363 Budapest, Pf. 9.', 'E-mail: ugyfelszolgalat@naih.hu', 'Honlap: www.naih.hu'],
        'Jogaid megsértése esetén **bírósághoz** is fordulhatsz. A per a te választásod szerint a lakóhelyed vagy tartózkodási helyed szerint illetékes törvényszék előtt is megindítható.',
      ] },

      { h: '10. Gyermekek', body: [
        'A Szolgáltatás általánosságban nem gyermekeknek szól. A regisztrációhoz és az Előfizetéshez cselekvőképesség szükséges; 16 évnél fiatalabb személy személyes adatait a törvényes képviselő hozzájárulása nélkül nem kezeljük. Ha tudomásunkra jut, hogy jogosulatlanul gyűjtöttünk adatot gyermektől, azt haladéktalanul töröljük.',
      ] },

      { h: '11. Az adatkezelési tájékoztató módosítása', body: [
        'Az adatkezelési tájékoztatót időről időre módosíthatjuk, például jogszabályváltozás vagy a szolgáltatás bővülése miatt. A lényeges módosításokról a Weboldalon, vagy e-mailben tájékoztatunk. A tájékoztató mindenkori hatályos változata a Weboldalon érhető el. Jelen változat hatálya kezdete: **{{version}}**.',
      ] },
    ],
  },

  // =====================================================================================
  imprint: {
    title: 'Impresszum',
    lead: 'Az Impix szolgáltatás és weboldal üzemeltetőjének adatai az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII. törvény szerint.',
    sections: [
      { h: 'A szolgáltató adatai', body: [
        ['**Név:** {{name}}', '**Székhely / levelezési cím:** {{address}}', '**Adószám:** {{taxId}}', '**Nyilvántartási szám:** {{regNumber}} ({{regLabel}})', '**E-mail cím:** {{email}}', '**Telefonszám:** {{phone}}', '**Weboldal:** {{siteUrl}}'],
        'A szolgáltató a fenti adatokkal jár el a weboldal üzemeltetőjeként és a szolgáltatás nyújtójaként. Az ügyfélszolgálat a megadott e-mail címen és telefonszámon érhető el. E-mailben érkezett megkeresésekre lehetőség szerint 2 munkanapon belül válaszolunk.',
      ] },

      { h: 'Tárhelyszolgáltató és üzemeltetés', body: [
        ['**Az alkalmazás (szerver) tárhelyszolgáltatója:** {{hostingName}}, {{hostingAddress}}, e-mail: {{hostingEmail}}', '**A weboldal statikus fájljainak tárhelye:** GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA', '**Domain-szolgáltató:** a domain (impix.hu) nyilvántartója és DNS-szolgáltatója: Rackhost'],
      ] },

      { h: 'Fizetési szolgáltató', body: [
        ['**A bankkártyás fizetés lebonyolítója:** Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Írország', 'A kártyaadatokat kizárólag a fizetési szolgáltató kezeli, az Impix szervere azokat nem ismeri meg és nem tárolja.'],
      ] },

      { h: 'Jogi dokumentumok', body: [
        'A szolgáltatás igénybevételére az **Általános Szerződési Feltételek**, a személyes adatok kezelésére az **Adatkezelési tájékoztató** vonatkozik. Mindkettő elérhető az oldal láblécén keresztül.',
      ] },

      { h: 'Panaszkezelés, fogyasztói jogok, felügyeleti szervek', body: [
        'Panaszaidat a fent megadott e-mail címen vagy telefonon jelezheted. A panaszkezelés és a jogorvoslati lehetőségek részleteit az ÁSZF 18. pontja tartalmazza.',
        ['**Fogyasztóvédelmi hatóság:** a lakóhelyed szerint illetékes kormányhivatal fogyasztóvédelmi hatósága.', '**Békéltető testület:** a lakóhelyed vagy tartózkodási helyed szerint illetékes, a kereskedelmi és iparkamara mellett működő békéltető testület.', '**Adatvédelmi felügyeleti hatóság:** Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH), 1055 Budapest, Falk Miksa utca 9-11., www.naih.hu, ugyfelszolgalat@naih.hu.'],
      ] },

      { h: 'Szerzői jogok és védjegyek', body: [
        'A weboldal grafikai elemei, kódja, szövegei, az „Impix” név és logó a szolgáltató szerzői jogi és egyéb védelme alatt állnak. A weboldalon elérhető filmek, sorozatok és borítóképek a jogosultak tulajdonát képezik. Tartalmak másolása, terjesztése vagy más felhasználása a jogosult engedélye nélkül tilos. Jogsértést a fenti e-mail címen lehet jelezni; a bejelentést haladéktalanul kivizsgáljuk.',
      ] },

      { h: 'Felelősség kizárása, külső hivatkozások', body: [
        'A weboldal külső oldalakra mutató hivatkozásokat és beágyazott tartalmakat (pl. Videa, YouTube, Vimeo) tartalmazhat. Ezek tartalmáért és adatkezeléséért az érintett külső szolgáltató felel. A szolgáltató a weboldal tartalmának pontosságára törekszik, de a hibákért és az esetleges kimaradásokért a jogszabályok által megengedett körben nem vállal felelősséget.',
      ] },
    ],
  },
};
