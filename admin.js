import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getDatabase, ref, onValue, push, update, remove, set } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { SEED_MOVIES, SEED_SERIES } from "./catalog-seed.js";

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
const storage = getStorage(app);

// Ideiglenes admin jelszó -- csak kliensoldali kapu, ugyanolyan biztonsági szinten mint a VIP jelszavak.
// Cseréld le ezt egy csak általad ismert értékre!
const ADMIN_PASSWORD = "ImpixAdmin2026!";

let moviesCache = {};
let seriesCache = {};

function checkAdminPassword() {
    const input = document.getElementById('admin-password-input');
    const errorMsg = document.getElementById('admin-error-msg');

    if (input.value === ADMIN_PASSWORD) {
        sessionStorage.setItem('impix_admin_ok', 'true');
        showAdminPanel();
    } else {
        errorMsg.classList.remove('hidden');
        input.value = '';
        input.focus();
    }
}

function showAdminPanel() {
    document.getElementById('admin-gate').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    document.body.style.overflow = 'auto';
}

function initAdmin() {
    if (sessionStorage.getItem('impix_admin_ok') === 'true') {
        showAdminPanel();
    } else {
        document.body.style.overflow = 'hidden';
    }

    const passInput = document.getElementById('admin-password-input');
    if (passInput) {
        passInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkAdminPassword();
        });
    }

    document.getElementById('movie-form').addEventListener('submit', handleMovieSubmit);
    document.getElementById('series-form').addEventListener('submit', handleSeriesSubmit);
    document.getElementById('movie-cancel-edit').addEventListener('click', cancelMovieEdit);
    document.getElementById('series-cancel-edit').addEventListener('click', cancelSeriesEdit);

    onValue(ref(database, 'content/movies'), (snapshot) => {
        moviesCache = snapshot.val() || {};
        renderMoviesList();
        checkImportBanner();
    });

    onValue(ref(database, 'content/series'), (snapshot) => {
        seriesCache = snapshot.val() || {};
        renderSeriesList();
        checkImportBanner();
    });
}

function checkImportBanner() {
    const banner = document.getElementById('import-banner');
    const isEmpty = Object.keys(moviesCache).length === 0 && Object.keys(seriesCache).length === 0;
    banner.classList.toggle('hidden', !isEmpty);
}

function switchTab(tab) {
    document.getElementById('tab-movies').classList.toggle('hidden', tab !== 'movies');
    document.getElementById('tab-series').classList.toggle('hidden', tab !== 'series');
    document.getElementById('tab-btn-movies').classList.toggle('active', tab === 'movies');
    document.getElementById('tab-btn-series').classList.toggle('active', tab === 'series');
}

function setStatus(elId, message, type) {
    const el = document.getElementById(elId);
    el.textContent = message;
    el.className = 'admin-form-status' + (type ? ' ' + type : '');
    if (message) {
        setTimeout(() => { el.textContent = ''; el.className = 'admin-form-status'; }, 4000);
    }
}

async function resolveThumbnail(urlInputId, fileInputId, fallback) {
    const fileInput = document.getElementById(fileInputId);
    const file = fileInput.files[0];

    if (file) {
        const path = `thumbnails/${Date.now()}_${file.name}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
    }

    const urlValue = document.getElementById(urlInputId).value.trim();
    return urlValue || fallback || '';
}

// ============ FILMEK ============

async function handleMovieSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById('movie-edit-id').value;
    const existingThumb = editId ? (moviesCache[editId] || {}).thumbnail : '';

    try {
        const thumbnail = await resolveThumbnail('movie-thumb-url', 'movie-thumb-file', existingThumb);
        if (!thumbnail) {
            setStatus('movie-form-status', 'Adj meg egy borítókép URL-t, vagy tölts fel egy képet.', 'error');
            return;
        }

        const movieData = {
            title: document.getElementById('movie-title').value.trim(),
            year: document.getElementById('movie-year').value.trim(),
            age: document.getElementById('movie-age').value.trim(),
            iframe: document.getElementById('movie-iframe').value.trim(),
            description: document.getElementById('movie-desc').value.trim(),
            thumbnail,
            isNew: document.getElementById('movie-isnew').checked
        };

        if (editId) {
            await update(ref(database, 'content/movies/' + editId), movieData);
            setStatus('movie-form-status', 'Film frissítve!', 'success');
        } else {
            await push(ref(database, 'content/movies'), movieData);
            setStatus('movie-form-status', 'Film hozzáadva!', 'success');
        }

        cancelMovieEdit();
    } catch (err) {
        console.error(err);
        setStatus('movie-form-status', 'Hiba történt mentés közben: ' + err.message, 'error');
    }
}

function editMovie(id) {
    const item = moviesCache[id];
    if (!item) return;

    document.getElementById('movie-edit-id').value = id;
    document.getElementById('movie-title').value = item.title || '';
    document.getElementById('movie-year').value = item.year || '';
    document.getElementById('movie-age').value = item.age || '';
    document.getElementById('movie-iframe').value = item.iframe || '';
    document.getElementById('movie-desc').value = item.description || '';
    document.getElementById('movie-thumb-url').value = item.thumbnail || '';
    document.getElementById('movie-isnew').checked = !!item.isNew;

    document.getElementById('movie-form-title').textContent = 'Film szerkesztése: ' + item.title;
    document.getElementById('movie-cancel-edit').classList.remove('hidden');
    document.getElementById('movie-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelMovieEdit() {
    document.getElementById('movie-form').reset();
    document.getElementById('movie-edit-id').value = '';
    document.getElementById('movie-form-title').textContent = 'Új film hozzáadása';
    document.getElementById('movie-cancel-edit').classList.add('hidden');
}

async function deleteMovie(id) {
    const item = moviesCache[id];
    if (!item) return;
    if (!confirm(`Biztosan törlöd: "${item.title}"?`)) return;
    await remove(ref(database, 'content/movies/' + id));
}

function renderMoviesList() {
    const container = document.getElementById('movies-list');
    const entries = Object.entries(moviesCache);

    if (entries.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">Még nincs felvett film.</p>';
        return;
    }

    container.innerHTML = entries.map(([id, item]) => `
        <div class="admin-item">
            <div class="admin-item-thumb" style="background-image: url('${item.thumbnail}');"></div>
            <div class="admin-item-info">
                <div class="admin-item-title">${item.title}</div>
                <div class="admin-item-meta">
                    <span>${item.year}</span>
                    <span>${item.age}</span>
                    ${item.isNew ? '<span>Újdonság</span>' : ''}
                </div>
            </div>
            <div class="admin-item-actions">
                <button data-action="edit-movie" data-id="${id}">Szerkesztés</button>
                <button data-action="delete-movie" data-id="${id}" class="admin-delete-btn">Törlés</button>
            </div>
        </div>
    `).join('');
}

// ============ SOROZATOK ============

async function handleSeriesSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById('series-edit-id').value;
    const existingThumb = editId ? (seriesCache[editId] || {}).thumbnail : '';

    try {
        const thumbnail = await resolveThumbnail('series-thumb-url', 'series-thumb-file', existingThumb);
        if (!thumbnail) {
            setStatus('series-form-status', 'Adj meg egy borítókép URL-t, vagy tölts fel egy képet.', 'error');
            return;
        }

        const baseData = {
            title: document.getElementById('series-title').value.trim(),
            year: document.getElementById('series-year').value.trim(),
            age: document.getElementById('series-age').value.trim(),
            description: document.getElementById('series-desc').value.trim(),
            thumbnail,
            isNew: document.getElementById('series-isnew').checked
        };

        if (editId) {
            await update(ref(database, 'content/series/' + editId), baseData);
            setStatus('series-form-status', 'Sorozat frissítve!', 'success');
        } else {
            await push(ref(database, 'content/series'), { ...baseData, seasons: [{ season: 1, episodes: [] }] });
            setStatus('series-form-status', 'Sorozat hozzáadva! Most add hozzá az epizódokat lentebb.', 'success');
        }

        cancelSeriesEdit();
    } catch (err) {
        console.error(err);
        setStatus('series-form-status', 'Hiba történt mentés közben: ' + err.message, 'error');
    }
}

function editSeries(id) {
    const item = seriesCache[id];
    if (!item) return;

    document.getElementById('series-edit-id').value = id;
    document.getElementById('series-title').value = item.title || '';
    document.getElementById('series-year').value = item.year || '';
    document.getElementById('series-age').value = item.age || '';
    document.getElementById('series-desc').value = item.description || '';
    document.getElementById('series-thumb-url').value = item.thumbnail || '';
    document.getElementById('series-isnew').checked = !!item.isNew;

    document.getElementById('series-form-title').textContent = 'Sorozat szerkesztése: ' + item.title;
    document.getElementById('series-cancel-edit').classList.remove('hidden');
    document.getElementById('series-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelSeriesEdit() {
    document.getElementById('series-form').reset();
    document.getElementById('series-edit-id').value = '';
    document.getElementById('series-form-title').textContent = 'Új sorozat hozzáadása';
    document.getElementById('series-cancel-edit').classList.add('hidden');
}

async function deleteSeries(id) {
    const item = seriesCache[id];
    if (!item) return;
    if (!confirm(`Biztosan törlöd: "${item.title}" (minden évaddal, epizóddal együtt)?`)) return;
    await remove(ref(database, 'content/series/' + id));
}

function toggleSeasonsView(id) {
    const el = document.getElementById('seasons-' + id);
    if (el) el.classList.toggle('open');
}

async function saveSeasons(id, seasons) {
    await set(ref(database, 'content/series/' + id + '/seasons'), seasons);
}

async function addSeason(id) {
    const item = seriesCache[id];
    if (!item) return;
    const seasons = item.seasons ? [...item.seasons] : [];
    const nextNumber = seasons.length > 0 ? Math.max(...seasons.map(s => s.season)) + 1 : 1;
    seasons.push({ season: nextNumber, episodes: [] });
    await saveSeasons(id, seasons);
}

async function deleteSeason(id, seasonIndex) {
    const item = seriesCache[id];
    if (!item || !item.seasons) return;
    if (!confirm(`Biztosan törlöd a(z) ${item.seasons[seasonIndex].season}. évadot?`)) return;
    const seasons = item.seasons.filter((_, i) => i !== seasonIndex);
    await saveSeasons(id, seasons);
}

async function addEpisode(id, seasonIndex) {
    const item = seriesCache[id];
    if (!item || !item.seasons) return;

    const titleInput = document.getElementById(`ep-title-${id}-${seasonIndex}`);
    const iframeInput = document.getElementById(`ep-iframe-${id}-${seasonIndex}`);
    const title = titleInput.value.trim();
    const iframe = iframeInput.value.trim();

    if (!title || !iframe) {
        alert('Add meg az epizód címét és a videa.hu embed linket is.');
        return;
    }

    const seasons = item.seasons.map((s, i) => {
        if (i !== seasonIndex) return s;
        const episodes = s.episodes ? [...s.episodes, { title, iframe }] : [{ title, iframe }];
        return { ...s, episodes };
    });

    await saveSeasons(id, seasons);
    titleInput.value = '';
    iframeInput.value = '';
}

async function deleteEpisode(id, seasonIndex, episodeIndex) {
    const item = seriesCache[id];
    if (!item || !item.seasons) return;

    const seasons = item.seasons.map((s, i) => {
        if (i !== seasonIndex) return s;
        return { ...s, episodes: s.episodes.filter((_, ei) => ei !== episodeIndex) };
    });

    await saveSeasons(id, seasons);
}

function renderSeriesList() {
    const container = document.getElementById('series-list');
    const entries = Object.entries(seriesCache);

    if (entries.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">Még nincs felvett sorozat.</p>';
        return;
    }

    container.innerHTML = entries.map(([id, item]) => {
        const seasons = item.seasons || [];
        const seasonsHtml = seasons.map((s, si) => `
            <div class="admin-season-block">
                <div class="admin-season-header">
                    <span>${s.season}. évad</span>
                    <button data-action="delete-season" data-id="${id}" data-season="${si}" class="admin-delete-btn" style="background:transparent;border:none;color:var(--text-dark-gray);cursor:pointer;">Évad törlése</button>
                </div>
                ${(s.episodes || []).map((ep, ei) => `
                    <div class="admin-episode-row">
                        <span>${ep.title}</span>
                        <button data-action="delete-episode" data-id="${id}" data-season="${si}" data-ep="${ei}" style="background:transparent;border:none;color:var(--text-dark-gray);cursor:pointer;">✕</button>
                    </div>
                `).join('') || '<p class="admin-empty-note" style="padding:8px 0;">Nincs még epizód ebben az évadban.</p>'}
                <div class="admin-add-episode">
                    <input type="text" id="ep-title-${id}-${si}" placeholder="Epizód címe, pl. 1. rész">
                    <input type="text" id="ep-iframe-${id}-${si}" placeholder="Videa.hu embed link">
                    <button data-action="add-episode" data-id="${id}" data-season="${si}">+ Epizód</button>
                </div>
            </div>
        `).join('');

        return `
            <div class="admin-item" style="flex-direction:column;align-items:stretch;">
                <div style="display:flex;gap:16px;align-items:center;">
                    <div class="admin-item-thumb" style="background-image: url('${item.thumbnail}');"></div>
                    <div class="admin-item-info">
                        <div class="admin-item-title">${item.title}</div>
                        <div class="admin-item-meta">
                            <span>${item.year}</span>
                            <span>${item.age}</span>
                            <span>${seasons.length} évad</span>
                            ${item.isNew ? '<span>Újdonság</span>' : ''}
                        </div>
                    </div>
                    <div class="admin-item-actions">
                        <button data-action="toggle-seasons" data-id="${id}">Évadok</button>
                        <button data-action="edit-series" data-id="${id}">Szerkesztés</button>
                        <button data-action="delete-series" data-id="${id}" class="admin-delete-btn">Törlés</button>
                    </div>
                </div>
                <div class="admin-seasons" id="seasons-${id}">
                    ${seasonsHtml}
                    <button data-action="add-season" data-id="${id}" class="admin-add-season-btn" style="align-self:flex-start;">+ Új évad</button>
                </div>
            </div>
        `;
    }).join('');
}

// ============ IMPORT ============

async function importExistingCatalog() {
    if (!confirm('Importálod az eredeti katalógust (filmek + sorozatok) a Firebase adatbázisba? Ez csak egyszer szükséges.')) return;

    try {
        for (const movie of SEED_MOVIES) {
            await push(ref(database, 'content/movies'), movie);
        }
        for (const show of SEED_SERIES) {
            await push(ref(database, 'content/series'), show);
        }
        alert('Katalógus sikeresen importálva!');
    } catch (err) {
        console.error(err);
        alert('Hiba történt az importálás közben: ' + err.message);
    }
}

// Eseménykezelés delegálással a dinamikusan generált gombokhoz
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const seasonIndex = btn.dataset.season !== undefined ? parseInt(btn.dataset.season, 10) : null;
    const epIndex = btn.dataset.ep !== undefined ? parseInt(btn.dataset.ep, 10) : null;

    switch (action) {
        case 'edit-movie': editMovie(id); break;
        case 'delete-movie': deleteMovie(id); break;
        case 'edit-series': editSeries(id); break;
        case 'delete-series': deleteSeries(id); break;
        case 'toggle-seasons': toggleSeasonsView(id); break;
        case 'add-season': addSeason(id); break;
        case 'delete-season': deleteSeason(id, seasonIndex); break;
        case 'add-episode': addEpisode(id, seasonIndex); break;
        case 'delete-episode': deleteEpisode(id, seasonIndex, epIndex); break;
    }
});

window.checkAdminPassword = checkAdminPassword;
window.switchTab = switchTab;
window.importExistingCatalog = importExistingCatalog;

initAdmin();
