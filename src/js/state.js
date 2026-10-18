const STORAGE_KEY = 'focusradar:v1';
const PERSISTED_KEYS = ['currentCity', 'workspaces', 'favorites', 'ambientVolumes', 'presets', 'stats'];
const todayKey = () => new Date().toISOString().slice(0, 10);

const defaultState = {
  currentCity: null,
  workspaces: [],
  status: 'idle', // 'idle' | 'loading' | 'error'
  error: null,
  activeFilter: 'all',
  sortBy: 'distance',
  favorites: [],
  ambientVolumes: { rain: 0.75, cafe: 0.4, wind: 0.25, train: 0.5, forest: 0.6 },
  activeSounds: [],
  presets: [],
  timerState: { mode: 'focus', status: 'idle' },
  stats: { date: todayKey(), sessions: 0, focusSeconds: 0 },
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
    const loaded = { ...defaultState, ...saved };
    // Yeni güne geçildiyse günlük istatistikleri sıfırla
    if (loaded.stats?.date !== todayKey()) loaded.stats = { ...defaultState.stats };
    return loaded;
  } catch {
    return { ...defaultState };
  }
}

function save() {
  try {
    const data = Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('State could not be saved:', err);
  }
}

let state = load();
const listeners = new Set();

export const getState = () => state;

export function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  save();
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isFavorite = (id) => state.favorites.some((place) => place.id === id);

export function toggleFavorite(place) {
  setState(({ favorites }) => ({
    favorites: isFavorite(place.id)
      ? favorites.filter((p) => p.id !== place.id)
      : [...favorites, place],
  }));
}