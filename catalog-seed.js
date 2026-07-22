// Egyszeri import forrása az admin felülethez: az eredetileg kódba írt katalógus,
// hogy a Firebase adatbázisba tölthető legyen egy kattintással.

export const SEED_MOVIES = [
    {
        title: "K-Pop Démon Vadászok",
        description: "Amikor Rumi, Mira és Zoey K-pop-szupersztárok koncertje nem telt házas, a titkos képességeiket használják, hogy megvédjék rajongóikat a természetfeletti fenyegetésektől.",
        thumbnail: "assets/kpop.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=zYJUZZ0GBZjuZJPf",
        year: "2025",
        age: "10+"
    },
    {
        title: "A kém",
        description: "Susan Cooper, a háttérben dolgozó CIA-elemző kénytelen terepre lépni, hogy megakadályozza egy nukleáris fegyver eladását, miközben veszélyes bűnözőket és kettős játékot játszó ügynököket próbál leleplezni.",
        thumbnail: "assets/a_kém.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=IdWDoVY6krd7gBkM",
        year: "2015",
        age: "16+"
    },
    {
        title: "365 nap",
        description: "Egy nő egy befolyásos maffiafőnök áldozatául esik, aki elrabolja, és egy évet ad neki, hogy beleszeressen.",
        thumbnail: "assets/365nap.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=YAeRUsWR2JC81m1S",
        year: "2020",
        age: "16+"
    },
    {
        title: "365 nap: Ma",
        description: "Laura és Massimo visszatér, és erősebb, mint valaha. De Massimo családi kötelékei és a Laura szívére pályázó titokzatos férfi megnehezítik a szerelmesek életét.",
        thumbnail: "assets/365napma.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=XuCWhGFzj17ezFnM",
        year: "2022",
        age: "16+"
    },
    {
        title: "365 nap: Egy újabb nap",
        description: "Laura és Massimo kapcsolata egy hajszálon függ, miközben próbálják megoldani bizalmi problémáikat, Nacho pedig kitartóan azon ügyködik, hogy elszakítsa őket egymástól.",
        thumbnail: "assets/365napegyújabbnap.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=cN8MNjmVFJK7sUmk",
        year: "2022",
        age: "18+"
    },
    {
        title: "Sokkal több mint testőr",
        description: "Egy felhajtást kerülő testőrnek életben kell tartania egy sztártanút – aki történetesen egy lobbanékony bérgyilkos –, hogy vallomást tehessen egy brutális diktátor ellen.",
        thumbnail: "assets/sokkal_több_mint_testőr_1.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=shuMFmlaiNE41Wlh",
        year: "2017",
        age: "16+"
    },
    {
        title: "Sokkal több mint testőr 2",
        description: "A testőr Michael Bryce Darius Kincaid bérgyilkossal és annak Sonia nevű feleségével közösen belekeveredik egy globális összeesküvésbe ebben a fergeteges vígjátékban.",
        thumbnail: "assets/sokkal_több_mint_testőr_2.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=tEuZPQAFuaoAPAqF",
        year: "2021",
        age: "16+"
    },
    {
        title: "Nász-ajánlat",
        description: "Egy könyvkiadó idegesítő főszerkesztője megtudja, hogy elutasították a vízumkérelmét, és ki fogják toloncolni az országból, ezért rákényszeríti asszisztensét, hogy feleségül vegye.",
        thumbnail: "assets/nász_ajánlat.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=gI6XQUhA7wIyxVZY",
        year: "2009",
        age: "13+"
    },
    {
        title: "Amerika kapitány: Az első bosszúálló",
        description: "Amerika Kapitány szuperkatonává válik, és legyőzi a HYDRA vezetőjét, miközben megmenti a világot. Önfeláldozása után évtizedekkel később a modern korban ébred fel.",
        thumbnail: "assets/akelsobosszuallo.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=gieXTQt3qIVhqxsW",
        year: "2011",
        age: "12+"
    },
    {
        title: "Amerika kapitány: Szép új világ",
        description: "Amerika Kapitány szuperkatonává válik, és legyőzi a HYDRA vezetőjét, miközben megmenti a világot. Önfeláldozása után évtizedekkel később a modern korban ébred fel.",
        thumbnail: "assets/akszepujvilag.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=Ys4NCuliTxIzpdId",
        year: "2025",
        age: "12+"
    },
    {
        title: "Női szervek",
        description: "Az FBI-ügynök Sarah Ashburn és a bostoni rendőrnő Shannon Mullins teljesen különbözőek, ezért ki nem állhatják egymást. Egy veszélyes drogbáró elfogásához azonban össze kell fogniuk, és a közös nyomozás során megtanulják tisztelni egymást.",
        thumbnail: "assets/női_szervek.png",
        isNew: false,
        iframe: "https://videa.hu/player?v=4HSRvSpmcCE6fHZb",
        year: "2013",
        age: "16+"
    },
    {
        title: "Apáca show",
        description: "Whoopi Goldberg egy bárénekesnőt alakít, aki a maffia elől egy kolostorba menekül. Ott apácának álcázva váratlanul felvirágoztatja a kórust, de a sikere veszélybe sodorja a titkát.",
        thumbnail: "assets/apácashow1.png",
        isNew: true,
        iframe: "https://videa.hu/player?v=m47PT2v2exM4EnvO",
        year: "1992",
        age: "6+"
    },
    {
        title: "Apáca show 2.",
        description: "Deloris ismét Mary Clarence bőrébe bújik, hogy egy iskolában zenetanárként problémás diákokból kórust formáljon, és megmentse az intézményt a bezárástól.",
        thumbnail: "assets/apácashow2.png",
        isNew: true,
        iframe: "https://videa.hu/player?v=dbfIjPOfN6ewejwD",
        year: "1993",
        age: "6+"
    },
    {
        title: "Tavaszi szél",
        description: "A dokumentumfilm Magyar Péter politikai mozgalmának születését követi, egy éven át bemutatva a kampányokat és a nyilvánosság előtt eddig nem látott személyes pillanatokat.",
        thumbnail: "assets/tavasziszél.png",
        isNew: true,
        iframe: "https://videa.hu/player?v=rIoRmMchuCbuwiAr",
        year: "2026",
        age: "12+"
    },
    {
        title: "Randiguru",
        description: "Egy jóképű New York-i randiguru tőle szokatlan módon őrülten belehabarodik egy okos és cinikus riporterbe, aki immunisnak tűnik a sármjára.",
        thumbnail: "assets/randiguru.png",
        isNew: true,
        iframe: "https://videa.hu/player?v=68lVVGrtMDuDZoTK",
        year: "2005",
        age: "13+"
    },
    {
        title: "Családi üzelmek",
        description: "Hogy törlessze adósságát egy drogbárónak, egy fűdíler meggyőzi a szomszédjait, játsszák el a családját és segítsenek neki átcsempészni egy nagy szállítmányt a határon.",
        thumbnail: "assets/családi_üzelmek.png",
        isNew: true,
        iframe: "https://videa.hu/player?v=RUnCkLkGwsoD0EHu",
        year: "2013",
        age: "16+"
    },
    {
        title: "A méhész",
        description: "Clay egy titkos „Méhészek” nevű, a törvény felett álló kormányzati szervezetre dolgozott, amely a társadalom védelmét látja el. A bosszúhadjárat során egy szilícium-völgyi techcég és az amerikai elnök (Derek Danforth édesanyja) körüli összeesküvést derít fel.",
        thumbnail: "assets/a_méhész.png",
        isNew: true,
        iframe: "https://videa.hu/player?v=oG0IsfSwwsqXwoa5",
        year: "2024",
        age: "16+"
    }
];

export const SEED_SERIES = [
    {
        title: "Stranger Things",
        description: "Egy fiatal fiú eltűnését követően a kisváros lakói titkos kísérletekre, rémisztő természetfeletti erőkre és egy furcsa kislányra derítenek fényt.",
        thumbnail: "assets/stranger_things.png",
        isNew: false,
        year: "2025",
        age: "16+",
        seasons: [
            {
                season: 1,
                episodes: [
                    { title: "1. rész", iframe: "https://videa.hu/player?v=qp7BrkowMbi2gvu7" },
                    { title: "2. rész", iframe: "https://videa.hu/player?v=SVYXkGUZRuhBF0Mc" }
                ]
            }
        ]
    },
    {
        title: "Ginny és Georgia",
        description: "A szabad szellemű Georgia két gyerekével, Ginnyvel és Austinnal északra költözik, hogy új életet kezdjenek, azonban az új kezdethez vezető út rögösnek bizonyul.",
        thumbnail: "assets/ginny_and_georgia.png",
        isNew: true,
        year: "2025",
        age: "16+",
        seasons: [
            {
                season: 1,
                episodes: [
                    { title: "1. rész", iframe: "https://videa.hu/player?v=Szmkx4Gh6SEWAePU" },
                    { title: "2. rész", iframe: "https://videa.hu/player?v=uwXUFpiYnhYqhKYP" },
                    { title: "3. rész", iframe: "https://videa.hu/player?v=fJ73CyaQoCRhZpfd" },
                    { title: "4. rész", iframe: "https://videa.hu/player?v=lf8okFRC47gTnS6u" },
                    { title: "5. rész", iframe: "https://videa.hu/player?v=YlkKPbNqSPe3q4zs" },
                    { title: "6. rész", iframe: "https://videa.hu/player?v=lgAdqXeMMVTmRUk4" },
                    { title: "7. rész", iframe: "https://videa.hu/player?v=tWmrK2EzpUsVLs8p" },
                    { title: "8. rész", iframe: "https://videa.hu/player?v=zFINp66VXLeyfP82" },
                    { title: "9. rész", iframe: "https://videa.hu/player?v=4TEvvsVD3EijQoCk" },
                    { title: "10. rész", iframe: "https://videa.hu/player?v=MO1CvTWz4uJUHfpe" }
                ]
            },
            {
                season: 2,
                episodes: [
                    { title: "1. rész", iframe: "https://videa.hu/player?v=ksBPcWpeVf3wTSAL" },
                    { title: "2. rész", iframe: "https://videa.hu/player?v=HV3CQ4pQrpAQLVDp" },
                    { title: "3. rész", iframe: "https://videa.hu/player?v=CgHjq7tccrAoA5Zw" },
                    { title: "4. rész", iframe: "https://videa.hu/player?v=Djwna2eQLjKwkbHG" },
                    { title: "5. rész", iframe: "https://videa.hu/player?v=OHr5S4C2vtrV9peD" },
                    { title: "6. rész", iframe: "https://videa.hu/player?v=R4lmiWhnbxJcnldZ" },
                    { title: "7. rész", iframe: "https://videa.hu/player?v=DkNsaRqk4j7TqRPv" },
                    { title: "8. rész", iframe: "https://videa.hu/player?v=RYGxID3qd4wBcGQY" },
                    { title: "9. rész", iframe: "https://videa.hu/player?v=Fh5y2Leqs1jD9GXA" },
                    { title: "10. rész", iframe: "https://videa.hu/player?v=cffLj9zXLWT80Fgs" }
                ]
            },
            {
                season: 3,
                episodes: [
                    { title: "1. rész", iframe: "https://videa.hu/player?v=HbdiztADlls5OmA0" },
                    { title: "2. rész", iframe: "https://videa.hu/player?v=LexUI1Al2xtvtTk8" },
                    { title: "3. rész", iframe: "https://videa.hu/player?v=PlEikhNkUErC7U5c" },
                    { title: "4. rész", iframe: "https://videa.hu/player?v=PGwBcBiVgPH1eDY8" },
                    { title: "5. rész", iframe: "https://videa.hu/player?v=Hiria3Q7Kj77pI58" },
                    { title: "6. rész", iframe: "https://videa.hu/player?v=w9rsspw88HsbvYu0" },
                    { title: "7. rész", iframe: "https://videa.hu/player?v=79r3b5VcBAEzrjWZ" },
                    { title: "8. rész", iframe: "https://videa.hu/player?v=tifsYAtqUCkmo0Iz" },
                    { title: "9. rész", iframe: "https://videa.hu/player?v=0INUbGFHfP0dIjY8" },
                    { title: "10. rész", iframe: "https://videa.hu/player?v=CH7UZgUqhBVsvUlc" }
                ]
            }
        ]
    },
    {
        title: "Modern család",
        description: "A modern család három különböző család életét mutatja be egy dokumentumfilmes stáb kameráján keresztül. Ennek a bonyolult, zűrös, szerető és modern családnak Jay Pritchett a feje.",
        thumbnail: "assets/modern_család.png",
        isNew: false,
        year: "2009",
        age: "12+",
        seasons: [
            {
                season: 1,
                episodes: [
                    { title: "1. rész", iframe: "https://videa.hu/player?v=Szmkx4Gh6SEWAePU" },
                    { title: "2. rész", iframe: "https://videa.hu/player?v=uwXUFpiYnhYqhKYP" },
                    { title: "3. rész", iframe: "https://videa.hu/player?v=fJ73CyaQoCRhZpfd" },
                    { title: "4. rész", iframe: "https://videa.hu/player?v=lf8okFRC47gTnS6u" },
                    { title: "5. rész", iframe: "https://videa.hu/player?v=YlkKPbNqSPe3q4zs" },
                    { title: "6. rész", iframe: "https://videa.hu/player?v=lgAdqXeMMVTmRUk4" },
                    { title: "7. rész", iframe: "https://videa.hu/player?v=tWmrK2EzpUsVLs8p" },
                    { title: "8. rész", iframe: "https://videa.hu/player?v=zFINp66VXLeyfP82" },
                    { title: "9. rész", iframe: "https://videa.hu/player?v=4TEvvsVD3EijQoCk" },
                    { title: "10. rész", iframe: "https://videa.hu/player?v=MO1CvTWz4uJUHfpe" }
                ]
            },
            {
                season: 2,
                episodes: [
                    { title: "1. rész", iframe: "https://videa.hu/player?v=ksBPcWpeVf3wTSAL" },
                    { title: "2. rész", iframe: "https://videa.hu/player?v=HV3CQ4pQrpAQLVDp" },
                    { title: "3. rész", iframe: "https://videa.hu/player?v=CgHjq7tccrAoA5Zw" },
                    { title: "4. rész", iframe: "https://videa.hu/player?v=Djwna2eQLjKwkbHG" },
                    { title: "5. rész", iframe: "https://videa.hu/player?v=OHr5S4C2vtrV9peD" },
                    { title: "6. rész", iframe: "https://videa.hu/player?v=R4lmiWhnbxJcnldZ" },
                    { title: "7. rész", iframe: "https://videa.hu/player?v=DkNsaRqk4j7TqRPv" },
                    { title: "8. rész", iframe: "https://videa.hu/player?v=RYGxID3qd4wBcGQY" },
                    { title: "9. rész", iframe: "https://videa.hu/player?v=Fh5y2Leqs1jD9GXA" },
                    { title: "10. rész", iframe: "https://videa.hu/player?v=cffLj9zXLWT80Fgs" }
                ]
            },
            {
                season: 3,
                episodes: [
                    { title: "1. rész", iframe: "https://videa.hu/player?v=HbdiztADlls5OmA0" },
                    { title: "2. rész", iframe: "https://videa.hu/player?v=LexUI1Al2xtvtTk8" },
                    { title: "3. rész", iframe: "https://videa.hu/player?v=PlEikhNkUErC7U5c" },
                    { title: "4. rész", iframe: "https://videa.hu/player?v=PGwBcBiVgPH1eDY8" },
                    { title: "5. rész", iframe: "https://videa.hu/player?v=Hiria3Q7Kj77pI58" },
                    { title: "6. rész", iframe: "https://videa.hu/player?v=w9rsspw88HsbvYu0" },
                    { title: "7. rész", iframe: "https://videa.hu/player?v=79r3b5VcBAEzrjWZ" },
                    { title: "8. rész", iframe: "https://videa.hu/player?v=tifsYAtqUCkmo0Iz" },
                    { title: "9. rész", iframe: "https://videa.hu/player?v=0INUbGFHfP0dIjY8" },
                    { title: "10. rész", iframe: "https://videa.hu/player?v=CH7UZgUqhBVsvUlc" }
                ]
            }
        ]
    },
    {
        title: "Kémbarátok",
        description: "Egy NSA-ügynök megbízást kap, hogy összekötőként működjön a brit kormányzati kommunikációs központ kiberbűnözés elleni részlegénél, és hamar ellenszenvessé teszi az egység vezetőjét pimasz stílusával és azzal a hajlamával, hogy megpróbálja átvenni a hatalmat.",
        thumbnail: "assets/kémbarátok.png",
        isNew: true,
        year: "2020",
        age: "14+",
        seasons: [
            {
                season: 1,
                episodes: [
                    { title: "1. rész", iframe: "https://videa.hu/player?v=4l3dutbyvSyPMDEC" },
                    { title: "2. rész", iframe: "https://videa.hu/player?v=0mdmy7ZtYmfWXVDY" },
                    { title: "3. rész", iframe: "https://videa.hu/player?v=Ecmj8Wf6jcgOttNd" },
                    { title: "4. rész", iframe: "https://videa.hu/player?v=wrySxYYRbR1qNsho" },
                    { title: "5. rész", iframe: "https://videa.hu/player?v=Ah2P6LWAaySrZuY5" },
                    { title: "6. rész", iframe: "https://videa.hu/player?v=MdQtrmZDdyi92Fh0" }
                ]
            }
        ]
    }
];
