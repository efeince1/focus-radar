import { getState, setState, subscribe } from './state.js';

const MODES = {
  focus: { seconds: 25 * 60, label: 'Deep Work Sprint', buttonId: 'mode-focus' },
  short: { seconds: 5 * 60, label: 'Short Break', buttonId: 'mode-short' },
  long: { seconds: 15 * 60, label: 'Long Break', buttonId: 'mode-long' },
};
const DAILY_GOAL = 4;
const RING_LENGTH = 653.45; // 2 * PI * r (r = 104)

const ACTIVE_PILL = 'px-space-lg py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm transition-all';
const IDLE_PILL = 'px-space-lg py-space-xs rounded-full text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors';

let remaining = MODES[getState().timerState.mode].seconds;
let endTime = 0;
let intervalId = null;

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const formatTime = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

function formatLogged(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const [h, m] = [Math.floor(minutes / 60), minutes % 60];
  return h > 0 ? `${h}h ${m}m logged today` : `${m}m logged today`;
}

const setTimerState = (patch) =>
  setState(({ timerState }) => ({ timerState: { ...timerState, ...patch } }));

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + delay;
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch (err) {
    console.warn('Beep failed:', err);
  }
}

function stop() {
  clearInterval(intervalId);
  intervalId = null;
}

function switchMode(mode) {
  stop();
  remaining = MODES[mode].seconds;
  setTimerState({ mode, status: 'idle' });
}

function complete() {
  stop();
  beep();
  const { mode } = getState().timerState;

  if (mode === 'focus') {
    setState(({ stats }) => ({
      stats: {
        ...stats,
        sessions: stats.sessions + 1,
        focusSeconds: stats.focusSeconds + MODES.focus.seconds,
      },
    }));
    // Her 4. oturumdan sonra uzun mola
    switchMode(getState().stats.sessions % DAILY_GOAL === 0 ? 'long' : 'short');
  } else {
    switchMode('focus');
  }
}

function tick() {
  remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
  render();
  if (remaining === 0) complete();
}

function start() {
  if (getState().timerState.status === 'running' || remaining === 0) return;
  endTime = Date.now() + remaining * 1000;
  intervalId = setInterval(tick, 250);
  setTimerState({ status: 'running' });
}

function pause() {
  if (getState().timerState.status !== 'running') return;
  stop();
  remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
  setTimerState({ status: 'paused' });
}

function reset() {
  switchMode(getState().timerState.mode);
}

function render() {
  const { timerState, stats } = getState();
  const { mode, status } = timerState;
  const total = MODES[mode].seconds;

  $('timer-display').textContent = formatTime(remaining);
  $('timer-progress').style.strokeDashoffset = RING_LENGTH * (1 - remaining / total);
  $('session-name').textContent = MODES[mode].label;

  const startLabel = { idle: 'Start Session', running: 'Running...', paused: 'Resume' }[status];
  $('btn-timer-start').querySelector('span:last-child').textContent = startLabel;
  $('btn-timer-start').classList.toggle('opacity-70', status === 'running');

  Object.entries(MODES).forEach(([key, { buttonId }]) => {
    $(buttonId).className = key === mode ? ACTIVE_PILL : IDLE_PILL;
  });

  const { sessions, focusSeconds } = stats;
  $('sessions-text').textContent = `${sessions} of ${DAILY_GOAL} Sessions Completed`;
  $('sessions-percent').textContent = `${Math.min(100, Math.round((sessions / DAILY_GOAL) * 100))}% of daily goal`;
  $('focus-time').textContent = formatLogged(focusSeconds);
  $('session-dots').innerHTML = Array.from({ length: DAILY_GOAL }, (_, i) =>
    `<div class="h-2.5 flex-1 rounded-full ${i < sessions ? 'bg-primary shadow-sm shadow-primary/30' : 'bg-surface-container-high'}"></div>`
  ).join('');

  document.title = status === 'running' ? `${formatTime(remaining)} · FocusRadar` : 'FocusRadar';
}

export function initTimer() {
  $('btn-timer-start').addEventListener('click', start);
  $('btn-timer-pause').addEventListener('click', pause);
  $('btn-timer-reset').addEventListener('click', reset);
  Object.entries(MODES).forEach(([key, { buttonId }]) => {
    $(buttonId).addEventListener('click', () => switchMode(key));
  });

  subscribe(render);
  render();
}