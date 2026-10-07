import { STORAGE_KEY, RECOVERY_KEY, createSeedState, isValidState } from './domain.js';

export const RECOVERED_MESSAGE = 'Saved house data could not be loaded. Demo data has been restored.';
export const SAVE_FAILED_MESSAGE = 'Changes are available in this session but could not be saved.';

// Keeps one bounded copy of unreadable data so it is not silently lost.
const MAX_RECOVERY_LENGTH = 200000;

export function loadState() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: createSeedState(), notice: SAVE_FAILED_MESSAGE, isFirstLaunch: true };
  }

  if (raw === null) return { state: createSeedState(), notice: null, isFirstLaunch: true };

  try {
    const parsed = JSON.parse(raw);
    if (isValidState(parsed)) return { state: parsed, notice: null, isFirstLaunch: false };
  } catch {
    // Fall through to recovery.
  }

  try {
    window.localStorage.setItem(RECOVERY_KEY, raw.slice(0, MAX_RECOVERY_LENGTH));
  } catch {
    // Recovery copy is best effort.
  }
  return { state: createSeedState(), notice: RECOVERED_MESSAGE, isFirstLaunch: true };
}

export function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
