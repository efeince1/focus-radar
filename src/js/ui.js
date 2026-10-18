import { getState, setState, subscribe, isFavorite, toggleFavorite, visiblePlaces } from './state.js';
import { geocodeCity, fetchWorkspaces, ApiError } from './api.js';
import { initMap, focusPlace } from './map.js';

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (url) => (/^https?:\/\//i.test(url ?? '') ? url : null);
const formatDistance = (km) => (km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1)} km`);

const TYPE_STYLE = {
  library: { label: 'Library', icon: 'local_library', text: 'text-primary', glow: 'bg-primary/10', badge: 'bg-primary-container text-on-primary-container' },
  cafe: { label: 'Cafe', icon: 'local_cafe', text: 'text-secondary', glow: 'bg-secondary/10', badge: 'bg-secondary-container text-on-secondary-container' },
  coworking: { label: 'Coworking', icon: 'domain', text: 'text-tertiary', glow: 'bg-primary/10', badge: 'bg-tertiary-container text-on-tertiary-container' },
};

const CHIP_ACTIVE = ['bg-primary', 'text-on-primary', 'shadow-sm'];
const CHIP_IDLE = ['bg-surface-container-high', 'text-on-surface', 'hover:bg-surface-container-highest'];

// ---------- Veri yükleme ----------
let requestId = 0;
let lastRequest = null;

async function load(resolveOrigin) {
  const id = ++requestId; // eski istek yenisinin üstüne yazmasın
  lastRequest = resolveOrigin;
  setState({ status: 'loading', error: null });
  try {
    const origin = await resolveOrigin();
    const workspaces = await fetchWorkspaces(origin);
    if (id !== requestId) return;
    setState({ currentCity: origin, workspaces, status: 'idle', error: null });
  } catch (err) {
    if (id !== requestId) return;
    setState({ status: 'error', error: err?.message ?? 'Something went wrong.' });
  }
}

const getPosition = () =>
  new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }));

async function locateUser() {
  if (!navigator.geolocation) throw new ApiError('Geolocation is not supported by this browser.');
  try {
    const { coords } = await getPosition();
    return { name: 'Your location', lat: coords.latitude, lon: coords.longitude };
  } catch {
    throw new ApiError('Could not get your location. Allow location access or search by city.');
  }
}

// ---------- Render yardımcıları ----------

const countByType = (places) =>
  places.reduce((acc, { type }) => ({ ...acc, [type]: (acc[type] ?? 0) + 1 }), { all: places.length });

function message({ icon, title, text, spin = false, retry = false }) {
  return `
    <div class="col-span-full flex flex-col items-center text-center gap-space-sm py-space-xl text-on-surface-variant">
      <span class="material-symbols-outlined text-[48px] text-primary/70 ${spin ? 'animate-spin' : ''}">${icon}</span>
      <h3 class="font-title-md text-title-md text-on-surface">${title}</h3>
      <p class="font-body-md text-body-md max-w-md">${escapeHtml(text)}</p>
      ${retry ? '<button data-retry class="mt-space-sm px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors">Try again</button>' : ''}
    </div>`;
}

function placeCard(place, { showDistance = true } = {}) {
  const style = TYPE_STYLE[place.type];
  const fav = isFavorite(place.id);
  const website = safeUrl(place.website);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;

  return `
<article data-card="${escapeHtml(place.id)}" class="cursor-pointer group bg-surface-container/80 backdrop-blur-xl rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all flex flex-col justify-between">      <div class="relative h-36 w-full overflow-hidden bg-gradient-to-br from-surface-container-high via-surface-container-low to-surface-container-lowest flex items-center justify-center border-b border-surface-container-highest">
        <div class="absolute -right-8 -top-8 w-40 h-40 ${style.glow} rounded-full blur-2xl pointer-events-none"></div>
        <div class="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none">
          <span class="material-symbols-outlined text-[96px] ${style.text}">${style.icon}</span>
        </div>
        <div class="absolute top-space-md left-space-md flex items-center gap-space-xs z-10">
          <span class="${style.badge} font-label-sm text-label-sm px-space-sm py-space-xs rounded-full">${style.label}</span>
          ${showDistance ? `<span class="bg-surface-container-lowest/80 backdrop-blur-md text-on-surface font-label-sm text-label-sm px-space-sm py-space-xs rounded-full flex items-center gap-1">
            <span class="material-symbols-outlined text-label-sm ${style.text}">near_me</span> ${formatDistance(place.distanceKm)}</span>` : ''}
        </div>
        <button data-fav="${escapeHtml(place.id)}" aria-label="${fav ? 'Remove from favorites' : 'Add to favorites'}"
          class="absolute top-space-md right-space-md w-9 h-9 rounded-full bg-surface-container-lowest/80 backdrop-blur-md flex items-center justify-center ${fav ? 'text-secondary' : 'text-on-surface-variant hover:text-secondary'} hover:scale-110 transition-transform z-10">
          <span class="material-symbols-outlined text-headline-sm" style="font-variation-settings: 'FILL' ${fav ? 1 : 0};">favorite</span>
        </button>
      </div>
      <div class="p-space-lg flex-1 flex flex-col justify-between">
        <div>
          <h3 class="font-title-md text-title-md text-on-surface font-semibold">${escapeHtml(place.name)}</h3>
          ${place.address ? `<p class="font-body-sm text-body-sm text-on-surface-variant mt-1 flex items-center gap-1"><span class="material-symbols-outlined text-label-sm text-outline">location_on</span><span class="truncate">${escapeHtml(place.address)}</span></p>` : ''}
          ${place.hours ? `<p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5 flex items-center gap-1" title="${escapeHtml(place.hours)}"><span class="material-symbols-outlined text-label-sm text-primary">schedule</span><span class="truncate">${escapeHtml(place.hours)}</span></p>` : ''}
        </div>
        <div class="mt-space-md pt-space-sm border-t border-surface-container-highest flex items-center justify-between font-label-sm text-label-sm">
          ${website ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer" class="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-0.5">Website <span class="material-symbols-outlined text-label-sm">open_in_new</span></a>` : '<span></span>'}
          <a href="${directions}" target="_blank" rel="noopener noreferrer" class="text-primary font-semibold flex items-center gap-0.5">Directions <span class="material-symbols-outlined text-label-sm">chevron_right</span></a>
        </div>
      </div>
    </article>`;
}

// ---------- Render ----------
function renderRadar(state) {
  const { status, error, currentCity, workspaces } = state;
  if (status === 'loading') {
    return message({ icon: 'progress_activity', title: 'Scanning for quiet places...', text: 'This takes a few seconds.', spin: true });
  }
  if (status === 'error') {
    return message({ icon: 'error', title: 'Something went wrong', text: error, retry: true });
  }
  if (!currentCity) {
    return message({ icon: 'travel_explore', title: 'Search a city to start', text: 'Find libraries, cafes and coworking spaces near you.' });
  }
  const places = visiblePlaces(state);
  if (places.length === 0) {
    return workspaces.length
      ? message({ icon: 'filter_alt_off', title: 'Nothing in this category', text: 'Try another filter.' })
      : message({ icon: 'search_off', title: 'No places found', text: 'Try a bigger city or another neighborhood.' });
  }
  return places.map((place) => placeCard(place)).join('');
}

function renderFilters({ activeFilter, workspaces, currentCity }) {
  const counts = countByType(workspaces);
  document.querySelectorAll('[data-filter]').forEach((chip) => {
    const key = chip.dataset.filter;
    const on = key === activeFilter;
    chip.classList.add(...(on ? CHIP_ACTIVE : CHIP_IDLE));
    chip.classList.remove(...(on ? CHIP_IDLE : CHIP_ACTIVE));
    chip.querySelector('.material-symbols-outlined')?.classList.toggle('!text-on-primary', on);

    const label = chip.querySelector('span:last-child') ?? chip;
    chip.dataset.label ??= label.textContent.trim();
    label.textContent = currentCity ? `${chip.dataset.label} (${counts[key] ?? 0})` : chip.dataset.label;
  });
}

const RENDER_KEYS = ['workspaces', 'activeFilter', 'sortBy', 'favorites', 'status', 'error', 'currentCity'];
let previous = null;

function render(state) {
  // Ses slider'ı gibi alakasız state değişimlerinde kartları yeniden çizme
  if (previous && RENDER_KEYS.every((key) => previous[key] === state[key])) return;
  previous = state;

  $('radar-grid').innerHTML = renderRadar(state);
  $('radar-subtitle').textContent = state.currentCity
    ? `${state.workspaces.length} places near ${state.currentCity.name}`
    : 'Libraries, cafes and coworking spaces near you.';
  $('sort-select').value = state.sortBy;
  renderFilters(state);

  $('favorites-grid').innerHTML = state.favorites.length
    ? state.favorites.map((place) => placeCard(place, { showDistance: false })).join('')
    : message({ icon: 'favorite', title: 'No favorites yet', text: 'Tap the heart on a place to save it here.' });
}

// ---------- Olaylar ----------
function onGridClick(e) {
  if (e.target.closest('[data-retry]')) {
    if (lastRequest) load(lastRequest);
    return;
  }
  const heart = e.target.closest('[data-fav]');
  if (heart) {
    const { workspaces, favorites } = getState();
    const place = [...workspaces, ...favorites].find(({ id }) => id === heart.dataset.fav);
    if (place) toggleFavorite(place);
    return;
  }
  if (e.target.closest('a')) return; // Website / Directions linkleri normal çalışsın
  const card = e.target.closest('[data-card]');
  if (card) focusPlace(card.dataset.card);
}

export function initUI() {
  const input = $('hero-search-input');
  const scrollToRadar = () => $('radar').scrollIntoView({ behavior: 'smooth' });
  const search = (query) => {
    scrollToRadar();
    load(() => geocodeCity(query));
  };

  $('search-btn').addEventListener('click', () => search(input.value));
  input.addEventListener('keydown', (e) => e.key === 'Enter' && search(input.value));
  $('gps-btn').addEventListener('click', () => {
    scrollToRadar();
    load(locateUser);
  });
  document.querySelectorAll('[data-city]').forEach((chip) =>
    chip.addEventListener('click', () => {
      input.value = chip.dataset.city;
      search(chip.dataset.city);
    })
  );
  document.querySelectorAll('[data-filter]').forEach((chip) =>
    chip.addEventListener('click', () => setState({ activeFilter: chip.dataset.filter }))
  );
  $('sort-select').addEventListener('change', (e) => setState({ sortBy: e.target.value }));
  $('radar-grid').addEventListener('click', onGridClick);
  $('favorites-grid').addEventListener('click', onGridClick);
initMap();
  subscribe(render);
  render(getState());
}