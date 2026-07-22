import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getDatabase, ref, get, update, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

// Ez követi közvetlenül az importokat
const firebaseConfig = {
    apiKey: "AIzaSyBesK1asoVKe8c70E84L-Ar5wTJQ_PDfHo",
    authDomain: "impix-db.firebaseapp.com",
    projectId: "impix-db",
    storageBucket: "impix-db.firebasestorage.app",
    messagingSenderId: "280647199300",
    appId: "1:280647199300:web:9cd729557e8c752a90ea11",
    measurementId: "G-2DQKCRBNJJ"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);


// A katalógus (filmek/sorozatok) mostantól a Firebase Realtime Database "content/" ága alatt él,
// nem itt a kódban -- az admin.html felületen kezelhető, kódmódosítás és újra-deploy nélkül.
let movies = [];
let series = [];

const movieGrid = document.getElementById('movie-grid');
const seriesGrid = document.getElementById('series-grid');
const modal = document.getElementById('modal');
const player = document.getElementById('player');
const shield = document.getElementById('video-shield');

function toggleTheme() {
    const body = document.body;
    const themeBtn = document.getElementById('theme-btn');

    body.classList.toggle('light-theme');

    if (body.classList.contains('light-theme')) {
        themeBtn.innerText = "Sötét mód";
    } else {
        themeBtn.innerText = "Világos mód";
    }
}

const LOGIN_EXPIRY_TIME = 1 * 24 * 60 * 60 * 1000;

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

let heroPicked = false;

function refreshContent() {
    const newMovies = movies.filter(item => item.isNew === true);
    const newSeries = series.filter(item => item.isNew === true);
    const allNewReleases = [...newMovies, ...newSeries];

    shuffleArray(movies);
    shuffleArray(series);

    renderGrid(allNewReleases, 'new-releases-grid', 'movie');
    renderGrid(movies, 'movie-grid', 'movie');
    renderGrid(series, 'series-grid', 'series');

    if (!heroPicked && allNewReleases.length > 0) {
        heroPicked = true;
        const featured = allNewReleases[Math.floor(Math.random() * allNewReleases.length)];
        renderHero(featured);
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim() !== '') {
        handleSearch();
    }
}

function initApp() {
    checkSessionAndPassword();
    setInterval(checkSessionAndPassword, 10000);

    // Élő adatbázis-figyelés: az admin felületen végzett módosítások azonnal
    // megjelennek minden nyitott oldalon, kód-módosítás és újratöltés nélkül.
    onValue(ref(database, 'content/movies'), (snapshot) => {
        const data = snapshot.val();
        movies = data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : [];
        refreshContent();
    });

    onValue(ref(database, 'content/series'), (snapshot) => {
        const data = snapshot.val();
        series = data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : [];
        refreshContent();
    });

    document.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('keydown', function (e) {
        if (e.key === "F12" || e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.keyCode === 73)) {
            e.preventDefault();
            return false;
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.keyCode === 74)) {
            e.preventDefault();
            return false;
        }
        if (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
            e.preventDefault();
            return false;
        }
    });

    if (shield && player) {
        shield.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        shield.addEventListener('click', () => {
            shield.style.display = 'none';
            setTimeout(() => {
                shield.style.display = 'block';
            }, 650);
        });
    }

    window.addEventListener('click', function () {
        const dropdown = document.getElementById('season-dropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    });
}


function checkSessionAndPassword() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const loginLoginTime = localStorage.getItem('loginTime');
    const lockedPassword = localStorage.getItem('locked_password');
    const currentTime = new Date().getTime();

    const loginGate = document.getElementById('login-gate');
    const mainNav = document.getElementById('main-nav');
    const mainContent = document.getElementById('main-content');

    const forceLogout = (isPasswordExpired) => {
        const msg = isPasswordExpired
            ? "Az előfizetésed lejárt! Fizess elő újból és regisztráld újra jelszavad hogy használhasd a streaming szolgáltatásunkat!"
            : "A napi biztonsági munkameneted lejárt. Kérjük, jelentkezz be újra!";

        showImpixAlert(msg, () => {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('loginTime');
            localStorage.removeItem('locked_password');

            if (typeof closeModal === "function") {
                closeModal();
            }

            document.body.style.overflow = 'hidden';
            if (loginGate) loginGate.classList.remove('hidden');
            if (mainNav) mainNav.classList.add('hidden');
            if (mainContent) mainContent.classList.add('hidden');

            setupLoginListeners();
        });
    };

    if (isLoggedIn && loginLoginTime && lockedPassword) {
        // 1. Helyi munkamenet időtartam ellenőrzése
        const isSessionExpired = (currentTime - parseInt(loginLoginTime)) > LOGIN_EXPIRY_TIME;
        if (isSessionExpired) {
            forceLogout(false);
            return;
        }

        // 2. ÉLŐ FIGYELŐ: Nem csak egyszer kérjük le, hanem folyamatosan fülelünk!
        const passwordRef = ref(database, 'passwords/' + lockedPassword);

        // Az onValue azonnal észreveszi, ha a Firebase-ben módosítasz vagy TÖRLÖD a jelszót
        onValue(passwordRef, (snapshot) => {
            const passwordData = snapshot.val();
            const liveCurrentTime = new Date().getTime();

            // SOKKAL FONTOSABB: Ha a jelszót törölték a Firebase-ből, AZONNAL KIRÚGJUK!
            if (!passwordData) {
                forceLogout(true);
                return;
            }

            // Lejárat ellenőrzése
            const [year, month, day] = passwordData.expireDate.split('-');
            const expiration = new Date(year, month - 1, day, 23, 59, 59).getTime();

            if (liveCurrentTime > expiration) {
                // Amint a háttérben lejárt az idő, a JS azonnal törli EZT AZ EGY jelszót
                update(ref(database, 'passwords'), {
                    [lockedPassword]: null
                }).then(() => {
                    forceLogout(true);
                }).catch((err) => {
                    console.error("Háttérbeni törlési hiba:", err);
                });
            } else {

                // Görgetés menedzsment (a modal állapota szerint)
                const modal = document.getElementById('modal');
                const isModalOpen = modal && (modal.style.display === 'block' || modal.classList.contains('active') || !modal.classList.contains('hidden'));

                if (isModalOpen) {
                    document.body.style.overflow = 'hidden';
                    if (mainContent) mainContent.style.overflow = 'hidden';
                } else {
                    document.body.style.overflow = 'auto';
                    if (mainContent) mainContent.style.overflow = 'auto';
                }

                if (loginGate) loginGate.classList.add('hidden');
                if (mainNav) mainNav.classList.remove('hidden');
                if (mainContent) mainContent.classList.remove('hidden');

                if (typeof showMainPage === "function") {
                    showMainPage();
                }
            }
        }, (error) => {
            console.error("Élő adatbázis figyelési hiba:", error);
        });

    } else {
        // Ha nincs bejelentkezve
        document.body.style.overflow = 'hidden';
        if (loginGate) loginGate.classList.remove('hidden');
        if (mainNav) mainNav.classList.add('hidden');
        if (mainContent) mainContent.classList.remove('hidden');
        setupLoginListeners();
    }
}


function setupLoginListeners() {
    const passInput = document.getElementById('password-input');
    if (passInput) {
        passInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });
    }
}

function checkPassword() {
    const inputField = document.getElementById('password-input');
    const errorMsg = document.getElementById('login-error-msg');
    const enteredPassword = inputField.value.trim();

    if (enteredPassword === '') {
        errorMsg.classList.remove('hidden');
        inputField.focus();
        return;
    }

    const userDeviceToken = getOrCreateDeviceId();
    const passwordRef = ref(database, 'passwords/' + enteredPassword);

    get(passwordRef).then((snapshot) => {
        const passwordData = snapshot.val();

        if (!passwordData) {
            errorMsg.classList.remove('hidden');
            inputField.value = '';
            inputField.focus();
            return;
        }

        const currentTime = new Date().getTime();
        const [year, month, day] = passwordData.expireDate.split('-');
        const expiration = new Date(year, month - 1, day, 23, 59, 59).getTime();

        if (currentTime > expiration) {
            // CSAK ezt az egy lefutott jelszót töröljük a Firebase-ből azzal, hogy null-ra frissítjük
            update(ref(database, 'passwords'), {
                [enteredPassword]: null
            }).then(() => {
                showImpixAlert("Az előfizetésed lejárt! Fizess elő újból és regisztráld újra jelszavad hogy használhasd a streaming szolgáltatásunkat!", () => {
                    inputField.value = '';
                    inputField.focus();
                });
            }).catch((err) => {
                console.error("Hiba az automatikus törlés során:", err);
            });
            return;
        }

        if (passwordData.usedBy && passwordData.usedBy !== userDeviceToken) {
            // A szöveg után átadjuk a callback függvényt () => { ... }
            showImpixAlert("Sajnos ezt a jelszót már egy másik felhasználó aktiválta és használja!", () => {
                inputField.value = '';
                inputField.focus();
            });
            return; // Megállítjuk a checkPassword további futását, míg rá nem nyomnak a gombra
        }

        if (!passwordData.usedBy) {
            update(passwordRef, {
                usedBy: userDeviceToken
            });
        }

        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('loginTime', currentTime.toString());
        localStorage.setItem('locked_password', enteredPassword);

        // Biztonságos elemkezelés: csak akkor módosítunk, ha létezik az elem
        const errorMsg = document.getElementById('error-message'); // Ellenőrizd az ID-t!
        if (errorMsg) errorMsg.classList.add('hidden');

        document.body.style.overflow = 'auto'; // Görgetés feloldása

        const loginGate = document.getElementById('login-gate');
        const mainNav = document.getElementById('main-nav');
        const mainContent = document.getElementById('main-content');

        if (loginGate) loginGate.classList.add('hidden');
        if (mainNav) mainNav.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('hidden');

        // Meghívjuk az alertet. Ha a háttérben valamiért mégis elakadt a showMainPage,
        // az OK gomb megnyomása után kényszerítjük a megjelenítést.
        showImpixAlert("Sikeres bejelentkezés! Üdvözlünk az IMPIX streaming platformon!", () => {
            if (typeof showMainPage === "function") {
                showMainPage();
            }
        });

    }).catch((error) => {
        console.error("Adatbázis hiba:", error);
        showImpixAlert("Hiba történt az ellenőrzés során. Próbáld újra később!", () => {
            inputField.value = '';
            inputField.focus();
        });
    });
}

window.checkPassword = checkPassword;


function getOrCreateDeviceId() {
    // 1. Megnézzük, hogy a böngésző tárolójában van-e már elmentett eszköz ID
    let deviceId = localStorage.getItem('impix_device_id');

    // 2. Ha még nincs (első belépés ezen a gépen/böngészőben)
    if (!deviceId) {
        // Generálunk egy teljesen egyedi, véletlenszerű karaktersorozatot (UUID stílusban)
        const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const timestamp = new Date().getTime();

        deviceId = 'impix_device_' + randomString + '_' + timestamp;

        // Ezt most elmentjük a gépén örökre (túléli az újraindítást, böngésző bezárást)
        localStorage.setItem('impix_device_id', deviceId);
    }

    // 3. Visszaadjuk a fix azonosítót
    return deviceId;
}

// NAGYON FONTOS: Mivel a script tetején importokat használunk, a függvény "bezáródik" a modulba.
// Ahhoz, hogy a HTML-ben lévő gomb (onclick="checkPassword()") továbbra is elérje, ki kell tennünk a globális ablakra:


function showMainPage() {
    const loginGate = document.getElementById('login-gate');
    const mainNav = document.getElementById('main-nav');
    const mainContent = document.getElementById('main-content');

    if (loginGate) loginGate.classList.add('hidden');
    if (mainNav) mainNav.classList.remove('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
}

function handleLogout() {
    // 1. Feldobjuk a fentről becsúszó IMPIX értesítést
    showImpixAlert("Sikeresen kijelentkeztél! Várunk vissza legközelebb is.", () => {

        // 2. CSAK az OK gomb megnyomása után töröljük az adatokat és frissítünk
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('loginTime');
        localStorage.removeItem('locked_password'); // Ezt is takarítjuk a biztonság kedvéért

        document.body.style.overflow = 'hidden';

        // Oldal újratöltése: mivel töröltük a kulcsokat, a kapu fogadja majd
        window.location.reload();
    });
}

function renderGrid(data, gridId, type) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';

    if (data.length === 0) {
        grid.innerHTML = `<div class="no-results">Nincs a keresésnek megfelelő ${type === 'movie' ? 'film' : 'sorozat'}.</div>`;
        return;
    }

    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div class="card-bg" style="background-image: url('${item.thumbnail}');"></div>
            ${item.isNew ? '<span class="card-badge-new">Új</span>' : ''}
            <span class="card-badge-hd">HD</span>
            <div class="card-desc">
                <div class="card-title-text">${item.title}</div>
                <div class="card-meta-text">
                    <span style="color: #d34646">${item.year}</span>
                    <span class="age-tag">${item.age}</span>
                </div>
            </div>
        `;
        const actualType = item.seasons ? 'series' : type;

        div.onclick = () => openModal(item, actualType);
        grid.appendChild(div);
    });
}

function renderHero(item) {
    const hero = document.getElementById('hero-section');
    if (!hero || !item) return;

    hero.style.backgroundImage = `url('${item.thumbnail}')`;
    document.getElementById('hero-title').innerText = item.title;
    document.getElementById('hero-desc').innerText = item.description;
    document.getElementById('hero-year').innerText = item.year;
    document.getElementById('hero-age').innerText = item.age;

    const heroPlayBtn = document.getElementById('hero-play-btn');
    if (heroPlayBtn) {
        heroPlayBtn.onclick = () => openModal(item, item.seasons ? 'series' : 'movie');
    }
}

function scrollRow(gridId, direction) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.scrollBy({ left: direction * grid.clientWidth * 0.85, behavior: 'smooth' });
}

function handleSearch() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const query = searchInput.value.toLowerCase().trim();

    // Megkeressük az Újdonságok teljes konténerét
    // (Győződj meg róla, hogy a HTML-ben a cím és a hozzá tartozó sáv egy közös id="news-section" dobozban van!)
    const newsSection = document.getElementById('new-releases-grid');

    if (searchInput.value.length > 0) {
        clearBtn.classList.remove('hidden');
        // Kereséskor elrejtjük a teljes szekciót a címmel együtt
        if (newsSection) newsSection.classList.add('hidden');
    } else {
        clearBtn.classList.add('hidden');
        // Ha üres a kereső, a teljes szekció (cím + tartalom) újra megjelenik
        if (newsSection) newsSection.classList.remove('hidden');
    }

    const filteredMovies = movies.filter(movie =>
        movie.title.toLowerCase().includes(query)
    );

    const filteredSeries = series.filter(show =>
        show.title.toLowerCase().includes(query)
    );

    renderGrid(filteredMovies, 'movie-grid', 'movie');
    renderGrid(filteredSeries, 'series-grid', 'series');
}

function clearSearch() {
    const searchInput = document.getElementById('search-input');

    searchInput.value = '';
    handleSearch();
    searchInput.focus();
}

function toggleDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('season-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

function selectSeason(seasonIndex) {
    const label = document.getElementById('selected-season-label');
    const dropdown = document.getElementById('season-dropdown');

    const selectedSeason = window.currentActiveSeries.seasons[seasonIndex];

    if (selectedSeason) {
        if (label) label.innerText = `${selectedSeason.season}. Évad`;

        if (selectedSeason.episodes.length > 0) {
            updateEpisodeList(selectedSeason.episodes);
            player.src = selectedSeason.episodes[0].iframe;
        }
    }

    if (dropdown) dropdown.classList.remove('active');
}

function openModal(item, type) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    document.getElementById('modal-title').innerText = item.title;
    document.getElementById('modal-year').innerText = item.year;
    document.getElementById('modal-age').innerText = item.age;
    document.getElementById('modal-description').innerText = item.description;

    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.overflow = 'hidden';
    }

    const selectorBox = document.getElementById('selector-box');
    const epList = document.getElementById('ep-list');

    if (type === 'series') {
        selectorBox.style.display = 'block';
        epList.style.display = 'flex';
        window.currentActiveSeries = item;

        selectorBox.innerHTML = `
            <div class="custom-dropdown" id="season-dropdown">
                <div class="dropdown-trigger" onclick="toggleDropdown(event)">
                    <span id="selected-season-label">${item.seasons[0].season}. Évad</span>
                    <span class="dropdown-arrow">▼</span>
                </div>
                <ul class="dropdown-menu">
                    ${item.seasons.map((s, i) => `
                        <li onclick="selectSeason(${i})">${s.season}. Évad</li>
                    `).join('')}
                </ul>
            </div>
        `;

        updateEpisodeList(item.seasons[0].episodes);
        player.src = item.seasons[0].episodes[0].iframe;
    } else {
        selectorBox.style.display = 'none';
        epList.style.display = 'none';
        player.src = item.iframe;
    }
}

function updateEpisodeList(episodes) {
    const listContainer = document.getElementById('ep-list');
    listContainer.innerHTML = episodes.map((ep, i) => `
        <div class="ep-item${i === 0 ? ' active' : ''}" onclick="playEpisode(this, '${ep.iframe}')">
            <span>${ep.title}</span>
            <span class="ep-item-icon">▶</span>
        </div>
    `).join('');
}

function playEpisode(el, src) {
    player.src = src;
    document.querySelectorAll('#ep-list .ep-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');
}

function closeModal() {
    modal.classList.add('hidden');
    player.src = '';

    const loginGate = document.getElementById('login-gate');
    const mainContent = document.getElementById('main-content');

    if (loginGate && !loginGate.classList.contains('hidden')) {
        document.body.style.overflow = 'hidden';
        if (mainContent) mainContent.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
        if (mainContent) mainContent.style.overflow = 'auto';
    }
}


function showImpixAlert(message, callback = null) {
    const alertOverlay = document.getElementById('impix-alert');
    const alertMessage = document.getElementById('impix-alert-message');
    const alertBtn = document.getElementById('impix-alert-btn');

    if (!alertOverlay || !alertMessage || !alertBtn) return;

    alertMessage.innerText = message;

    alertOverlay.classList.remove('hidden');
    alertOverlay.classList.remove('active');

    void alertOverlay.offsetWidth; // Reflow az animációnak

    alertOverlay.classList.add('active');

    // JS TILTÁS: Amikor a modal megnyílik, a külső görgetést azonnal lekapcsoljuk
    document.body.style.overflow = 'hidden';

    const closeAlert = () => {
        alertOverlay.classList.remove('active');
        alertBtn.removeEventListener('click', closeAlert);

        // Megvárjuk a 0.5 másodperces elhalványulást
        setTimeout(() => {
            alertOverlay.classList.add('hidden');

            // JS VISSZAÁLLÍTÁS: Megnézzük, hogy a login gate kint van-e még
            const loginGate = document.getElementById('login-gate');
            if (loginGate && !loginGate.classList.contains('hidden')) {
                // Ha a login fül még aktív, a külső oldal továbbra is maradjon letiltva
                document.body.style.overflow = 'hidden';
            } else {
                // Ha már sikeresen bent vagyunk a főoldalon, visszaadjuk a görgetést
                document.body.style.overflow = 'auto';
            }

            if (typeof callback === 'function') {
                callback();
            }
        }, 500);
    };

    alertBtn.addEventListener('click', closeAlert);
}

window.showImpixAlert = showImpixAlert;
window.checkPassword = checkPassword;
window.toggleTheme = toggleTheme;
window.closeModal = closeModal;
window.handleLogout = handleLogout;
window.handleSearch = handleSearch;
window.clearSearch = clearSearch;
window.selectSeason = selectSeason;
window.toggleDropdown = toggleDropdown;
window.scrollRow = scrollRow;
window.playEpisode = playEpisode;
initApp();