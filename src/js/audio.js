  import { getState, setState, subscribe } from './state.js';

const SOUNDS = {
  rain: { name: 'Skylight Rain', accent: 'primary' },
  cafe: { name: 'Quiet Cafe', accent: 'secondary' },
  wind: { name: 'Pine Wind', accent: 'primary' },
  train: { name: 'Night Rails', accent: 'primary' },
  forest: { name: 'Deep Forest', accent: 'primary' },
};

const BTN_ON = {
  primary: 'sound-toggle w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center transition-transform active:scale-90',
  secondary: 'sound-toggle w-9 h-9 rounded-full bg-secondary text-on-secondary flex items-center justify-center transition-transform active:scale-90',
};
const BTN_OFF = 'sound-toggle w-9 h-9 rounded-full bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface flex items-center justify-center transition-all active:scale-90';
const ICON_ON = {
  primary: 'w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center',
  secondary: 'w-12 h-12 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center',
};
const ICON_OFF = 'w-12 h-12 rounded-xl bg-surface-container-high text-on-surface-variant flex items-center justify-center';

const $ = (id) => document.getElementById(id);
const escapeHtml = (str) =>
  str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Her ses için tek bir Audio nesnesi (loop)
const players = Object.fromEntries(
  Object.keys(SOUNDS).map((key) => {
    const audio = new Audio(`src/assets/sounds/${key}.mp3`);
    audio.loop = true;
    audio.preload = 'none';
    return [key, audio];
  })
);

let masterVolume = 0.8;
let masterPaused = false;

function syncAudio() {
  const { activeSounds, ambientVolumes } = getState();
  Object.entries(players).forEach(([key, audio]) => {
    audio.volume = Math.min(1, (ambientVolumes[key] ?? 0.5) * masterVolume);
    const shouldPlay = activeSounds.includes(key) && !masterPaused;
    if (shouldPlay && audio.paused) {
      audio.play().catch((err) => console.warn(`Could not play ${key}:`, err));
    } else if (!shouldPlay && !audio.paused) {
      audio.pause();
    }
  });
}

function renderMixer() {
  const { activeSounds, ambientVolumes } = getState();

  document.querySelectorAll('[data-sound]').forEach((card) => {
    const key = card.dataset.sound;
    const { accent } = SOUNDS[key];
    const isActive = activeSounds.includes(key);
    const percent = Math.round((ambientVolumes[key] ?? 0) * 100);

    const button = card.querySelector('.sound-toggle');
    button.className = isActive ? BTN_ON[accent] : BTN_OFF;
    button.querySelector('.material-symbols-outlined').textContent = isActive ? 'pause' : 'play_arrow';

    card.querySelector('div.w-12').className = isActive ? ICON_ON[accent] : ICON_OFF;

    const slider = card.querySelector('.volume-slider');
    slider.value = percent;
    slider.classList.toggle('opacity-50', !isActive);

    const label = card.querySelector('.volume-label');
    label.textContent = `${percent}%`;
  });

  const names = activeSounds.map((key) => SOUNDS[key].name);
  $('active-count').textContent = `${names.length} active ${names.length === 1 ? 'sound' : 'sounds'}`;
  $('now-playing').textContent = masterPaused && names.length
    ? 'Paused'
    : names.length ? names.join(' + ') : 'Nothing playing';

  const master = $('master-toggle');
  const playing = names.length > 0 && !masterPaused;
  master.querySelector('.material-symbols-outlined').textContent = playing ? 'pause' : 'play_arrow';

  renderPresets();
}

function renderPresets() {
  const { presets } = getState();
  $('presets-list').innerHTML = presets
    .map(
      ({ id, name }) => `
      <span class="inline-flex items-center rounded-full bg-surface-container-high text-on-surface font-label-md text-label-md">
        <button data-preset="${id}" class="px-space-md py-space-xs hover:text-primary transition-colors">${escapeHtml(name)}</button>
        <button data-delete-preset="${id}" class="pr-space-sm text-on-surface-variant hover:text-error transition-colors" title="Delete preset">×</button>
      </span>`
    )
    .join('');
}

function toggleSound(key) {
  masterPaused = false;
  setState(({ activeSounds }) => ({
    activeSounds: activeSounds.includes(key)
      ? activeSounds.filter((k) => k !== key)
      : [...activeSounds, key],
  }));
}

function setVolume(key, value) {
  setState(({ ambientVolumes }) => ({
    ambientVolumes: { ...ambientVolumes, [key]: value },
  }));
}

function openPresetModal() {
  const names = getState().activeSounds.map((key) => SOUNDS[key].name);
  $('preset-summary').textContent = names.join(' + ');
  $('preset-error').classList.toggle('hidden', names.length > 0);
  $('preset-name').value = '';
  $('preset-modal').classList.replace('hidden', 'flex');
  $('preset-name').focus();
}

function closePresetModal() {
  $('preset-modal').classList.replace('flex', 'hidden');
}

function submitPreset(e) {
  e.preventDefault();
  const { activeSounds, ambientVolumes } = getState();
  const name = $('preset-name').value.trim();
  if (!name || activeSounds.length === 0) return;
  setState(({ presets }) => ({
    presets: [...presets, { id: Date.now(), name, sounds: [...activeSounds], volumes: { ...ambientVolumes } }],
  }));
  closePresetModal();
}

function applyPreset(id) {
  const preset = getState().presets.find((p) => p.id === id);
  if (!preset) return;
  masterPaused = false;
  setState({ activeSounds: [...preset.sounds], ambientVolumes: { ...preset.volumes } });
}

function deletePreset(id) {
  setState(({ presets }) => ({ presets: presets.filter((p) => p.id !== id) }));
}

export function initAudio() {
  document.querySelectorAll('[data-sound]').forEach((card) => {
    const key = card.dataset.sound;
    card.querySelector('.sound-toggle').addEventListener('click', () => toggleSound(key));
    card.querySelector('.volume-slider').addEventListener('input', (e) => setVolume(key, Number(e.target.value) / 100));
  });

  $('master-volume').addEventListener('input', (e) => {
    masterVolume = Number(e.target.value) / 100;
    syncAudio();
  });

  $('master-toggle').addEventListener('click', () => {
    if (getState().activeSounds.length === 0) return;
    masterPaused = !masterPaused;
    syncAudio();
    renderMixer();
  });

  $('save-preset-btn').addEventListener('click', openPresetModal);
$('preset-form').addEventListener('submit', submitPreset);
$('preset-cancel').addEventListener('click', closePresetModal);
$('preset-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePresetModal(); // boşluğa tıklayınca kapan
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePresetModal();
});

  $('presets-list').addEventListener('click', (e) => {
    const apply = e.target.closest('[data-preset]');
    const del = e.target.closest('[data-delete-preset]');
    if (apply) applyPreset(Number(apply.dataset.preset));
    if (del) deletePreset(Number(del.dataset.deletePreset));
  });

  masterVolume = Number($('master-volume').value) / 100;
  subscribe(() => {
    syncAudio();
    renderMixer();
  });
  syncAudio();
  renderMixer();
}